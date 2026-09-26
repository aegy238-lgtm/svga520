/**
 * Hardware & Resource Profiler for Smart Workload Distribution
 * Dynamically balances CPU, RAM, browser main-thread, and server resources.
 */

export interface DeviceProfile {
  cpuCores: number;
  deviceMemoryGB: number;
  isLowEndDevice: boolean;
  isMobile: boolean;
  concurrencyLimit: number;
  maxRecommendedClientFileSizeMB: number;
}

/**
 * Detect current device hardware capabilities
 */
export function getDeviceProfile(): DeviceProfile {
  const isMobile = typeof navigator !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     (typeof window !== 'undefined' && window.innerWidth < 768));

  const cpuCores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
  
  // navigator.deviceMemory is supported in Chromium browsers (returns RAM in GB: 0.25, 0.5, 1, 2, 4, 8)
  const navAny = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const deviceMemoryGB = navAny.deviceMemory ? Number(navAny.deviceMemory) : (isMobile ? 2 : 4);

  const isLowEndDevice = cpuCores <= 2 || deviceMemoryGB <= 2 || isMobile;

  // Safe concurrency limit to avoid freezing the browser when multiple files are uploaded
  let concurrencyLimit = 2;
  if (isLowEndDevice) {
    concurrencyLimit = 1; // Process 1 at a time on low-end hardware
  } else if (cpuCores >= 8 && deviceMemoryGB >= 8) {
    concurrencyLimit = 3; // Max 3 parallel heavy processes on high-end desktop
  } else {
    concurrencyLimit = 2; // Balanced 2 parallel
  }

  // Max recommended file size for in-browser memory loading before recommending server offload
  const maxRecommendedClientFileSizeMB = isLowEndDevice ? 15 : (deviceMemoryGB >= 8 ? 60 : 30);

  return {
    cpuCores,
    deviceMemoryGB,
    isLowEndDevice,
    isMobile,
    concurrencyLimit,
    maxRecommendedClientFileSizeMB,
  };
}

export interface WorkloadDecision {
  destination: 'client' | 'server';
  reason: string;
  recommendedChunkSize: number;
  concurrencyLimit: number;
}

/**
 * Intelligently decides whether a job should run on client or be offloaded to server
 */
export function decideWorkload(params: {
  fileSizeBytes: number;
  fileCount?: number;
  operationType: 'vap-export' | 'svga-convert' | 'batch-export' | 'video-transcode' | 'audio-merge' | 'lottie-build' | string;
  forcedMode?: 'auto' | 'client' | 'server';
}): WorkloadDecision {
  const profile = getDeviceProfile();
  const fileCount = params.fileCount || 1;
  const sizeMB = params.fileSizeBytes / (1024 * 1024);

  // If user or caller explicitly forced a mode
  if (params.forcedMode === 'server') {
    return {
      destination: 'server',
      reason: 'تم اختيار التصدير السحابي المباشر بناءً على تفضيل المستخدم.',
      recommendedChunkSize: 2 * 1024 * 1024,
      concurrencyLimit: profile.concurrencyLimit
    };
  }
  if (params.forcedMode === 'client') {
    return {
      destination: 'client',
      reason: 'تم فرض المعالجة المحلية.',
      recommendedChunkSize: 1024 * 1024,
      concurrencyLimit: profile.concurrencyLimit
    };
  }

  // Heavy server criteria:
  // 1. Single file exceeds recommended RAM threshold
  if (sizeMB > profile.maxRecommendedClientFileSizeMB) {
    return {
      destination: 'server',
      reason: `حجم الملف كبير (${sizeMB.toFixed(1)} ميجابايت) ويتجاوز سعة الذاكرة الآمنة للمتصفح (${profile.maxRecommendedClientFileSizeMB} ميجابايت)؛ تم التحويل للسيرفر لحماية المتصفح من التجمّد.`,
      recommendedChunkSize: 2 * 1024 * 1024,
      concurrencyLimit: profile.concurrencyLimit
    };
  }

  // 2. High batch file count with moderate size
  if (fileCount > 10 && sizeMB > 20) {
    return {
      destination: 'server',
      reason: `عدد ملفات كبير (${fileCount} ملفات)؛ تم تفويض المعالجة للسيرفر لضمان سرعة التصدير وبقاء المتصفح خفيفاً.`,
      recommendedChunkSize: 2 * 1024 * 1024,
      concurrencyLimit: profile.concurrencyLimit
    };
  }

  // 3. Mobile device with moderate video file
  if (profile.isMobile && sizeMB > 12 && (params.operationType.includes('video') || params.operationType.includes('vap'))) {
    return {
      destination: 'server',
      reason: 'جهاز جوال أو ذو موارد محدودة؛ تم تشغيل المعالجة السحابية لتوفير طاقة البطارية والذاكرة.',
      recommendedChunkSize: 1024 * 1024,
      concurrencyLimit: 1
    };
  }

  // Otherwise, fast client processing
  return {
    destination: 'client',
    reason: 'عملية خفيفة متوافقة تماماً مع معالجة الجهاز المحلية فائقة السرعة.',
    recommendedChunkSize: 1024 * 1024,
    concurrencyLimit: profile.concurrencyLimit
  };
}

/**
 * Yield control to the browser main thread to avoid UI lag and frame drops
 */
export function yieldToMainThread(ms: number = 0): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined' && ms === 0) {
      requestIdleCallback(() => resolve(), { timeout: 16 });
    } else {
      setTimeout(resolve, ms);
    }
  });
}
