/**
 * Resource & Performance Monitor
 * Tracks API requests, operation execution times, processed file sizes,
 * animation conversion counters, slow operations, errors, and abuse/rate limit events.
 */

export interface ApiCallRecord {
  endpoint: string;
  timestamp: number;
  durationMs: number;
  status: number;
  sizeBytes?: number;
}

export interface ConversionRecord {
  format: string;
  timestamp: number;
  durationMs: number;
  fileSizeBytes: number;
  success: boolean;
}

export interface SlowOperationRecord {
  operation: string;
  durationMs: number;
  timestamp: number;
  details?: string;
}

export interface ErrorLogRecord {
  source: string;
  message: string;
  timestamp: number;
}

export interface AbuseAttemptRecord {
  ipOrReason: string;
  details: string;
  timestamp: number;
}

export interface ResourceMetrics {
  totalApiRequests: number;
  apiCallsByEndpoint: Record<string, number>;
  totalBytesProcessed: number;
  totalConversions: number;
  conversionsByFormat: Record<string, number>;
  recentApiCalls: ApiCallRecord[];
  recentConversions: ConversionRecord[];
  slowOperations: SlowOperationRecord[];
  errors: ErrorLogRecord[];
  abuseAttempts: AbuseAttemptRecord[];
  estimatedBandwidthSavedBytes: number;
}

const STORAGE_KEY = 'svga_resource_monitor_metrics_v1';
const MAX_LOG_ENTRIES = 60;

class ResourceMonitor {
  private metrics: ResourceMetrics;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.metrics = this.loadMetrics();
    this.setupGlobalFetchInterceptor();
  }

  private loadMetrics(): ResourceMetrics {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      totalApiRequests: 0,
      apiCallsByEndpoint: {},
      totalBytesProcessed: 0,
      totalConversions: 0,
      conversionsByFormat: {},
      recentApiCalls: [],
      recentConversions: [],
      slowOperations: [],
      errors: [],
      abuseAttempts: [],
      estimatedBandwidthSavedBytes: 0,
    };
  }

  private saveMetrics() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.metrics));
    } catch {}
    this.notify();
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public getMetrics(): ResourceMetrics {
    return { ...this.metrics };
  }

  public recordApiCall(endpoint: string, durationMs: number, status: number = 200, sizeBytes: number = 0) {
    const cleanEndpoint = endpoint.split('?')[0];
    this.metrics.totalApiRequests++;
    this.metrics.apiCallsByEndpoint[cleanEndpoint] = (this.metrics.apiCallsByEndpoint[cleanEndpoint] || 0) + 1;
    this.metrics.totalBytesProcessed += sizeBytes;

    this.metrics.recentApiCalls.unshift({
      endpoint: cleanEndpoint,
      timestamp: Date.now(),
      durationMs: Math.round(durationMs),
      status,
      sizeBytes,
    });
    if (this.metrics.recentApiCalls.length > MAX_LOG_ENTRIES) {
      this.metrics.recentApiCalls.pop();
    }

    if (durationMs > 2500) {
      this.recordSlowOp(`API Request: ${cleanEndpoint}`, durationMs, `Status ${status}, Size: ${this.formatBytes(sizeBytes)}`);
    }

    this.saveMetrics();
  }

  public recordConversion(format: string, durationMs: number, fileSizeBytes: number = 0, success: boolean = true) {
    this.metrics.totalConversions++;
    this.metrics.conversionsByFormat[format] = (this.metrics.conversionsByFormat[format] || 0) + 1;
    this.metrics.totalBytesProcessed += fileSizeBytes;

    // Track bandwidth saved by running heavy operations in-browser instead of Vercel serverless functions!
    this.metrics.estimatedBandwidthSavedBytes += fileSizeBytes;

    this.metrics.recentConversions.unshift({
      format,
      timestamp: Date.now(),
      durationMs: Math.round(durationMs),
      fileSizeBytes,
      success,
    });
    if (this.metrics.recentConversions.length > MAX_LOG_ENTRIES) {
      this.metrics.recentConversions.pop();
    }

    if (durationMs > 3000) {
      this.recordSlowOp(`Animation Conversion (${format})`, durationMs, `Size: ${this.formatBytes(fileSizeBytes)}`);
    }

    this.saveMetrics();
  }

  public recordSlowOp(operation: string, durationMs: number, details?: string) {
    this.metrics.slowOperations.unshift({
      operation,
      durationMs: Math.round(durationMs),
      timestamp: Date.now(),
      details,
    });
    if (this.metrics.slowOperations.length > MAX_LOG_ENTRIES) {
      this.metrics.slowOperations.pop();
    }
    this.saveMetrics();
  }

  public recordError(source: string, message: string) {
    this.metrics.errors.unshift({
      source,
      message,
      timestamp: Date.now(),
    });
    if (this.metrics.errors.length > MAX_LOG_ENTRIES) {
      this.metrics.errors.pop();
    }
    this.saveMetrics();
  }

  public recordAbuseAttempt(ipOrReason: string, details: string) {
    this.metrics.abuseAttempts.unshift({
      ipOrReason,
      details,
      timestamp: Date.now(),
    });
    if (this.metrics.abuseAttempts.length > MAX_LOG_ENTRIES) {
      this.metrics.abuseAttempts.pop();
    }
    this.saveMetrics();
  }

  public resetMetrics() {
    this.metrics = {
      totalApiRequests: 0,
      apiCallsByEndpoint: {},
      totalBytesProcessed: 0,
      totalConversions: 0,
      conversionsByFormat: {},
      recentApiCalls: [],
      recentConversions: [],
      slowOperations: [],
      errors: [],
      abuseAttempts: [],
      estimatedBandwidthSavedBytes: 0,
    };
    this.saveMetrics();
  }

  public formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  private setupGlobalFetchInterceptor() {
    if (typeof window === 'undefined' || !window.fetch) return;
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      
      // Only monitor app API requests
      const isApi = url.includes('/api/') || url.startsWith('/api/');
      if (!isApi) {
        return originalFetch(...args);
      }

      const start = performance.now();
      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;
        const contentLength = Number(response.headers.get('content-length') || 0);

        this.recordApiCall(url, duration, response.status, contentLength);

        if (response.status === 429) {
          this.recordAbuseAttempt('RateLimitHit', `Hit 429 Too Many Requests on ${url.split('?')[0]}`);
        } else if (response.status >= 500) {
          this.recordError(`API Error (${response.status})`, `${url.split('?')[0]} failed with status ${response.status}`);
        }

        return response;
      } catch (err: any) {
        const duration = performance.now() - start;
        this.recordApiCall(url, duration, 0, 0);
        this.recordError('Network Fetch Failure', `${url.split('?')[0]}: ${err?.message || err}`);
        throw err;
      }
    };
  }
}

export const resourceMonitor = new ResourceMonitor();
