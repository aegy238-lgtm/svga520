import { GiftItem } from '../types';
import { saveMediaToIndexedDb, getMediaFromIndexedDb, resolveMediaUrl, globalMemoryCache } from './mediaStorage';

export interface PreloadProgress {
  total: number;
  completed: number;
  cached: number; // already cached items
  failed: number;
  currentUrl: string;
  activeDownloads: number;
  percent: number;
  isFinished: boolean;
}

// Keep a set of actively preloading URLs to prevent double-downloading
const activePreloadUrls = new Set<string>();

/**
 * Checks if a specific media is already cached in IndexedDB or globalMemoryCache
 */
export async function isMediaCached(key: string): Promise<boolean> {
  if (!key) return false;
  if (globalMemoryCache.has(key)) return true;
  try {
    const blob = await getMediaFromIndexedDb(key);
    return blob !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Preload a single URL into IndexedDB cache
 */
export async function preloadUrl(id: string, url: string): Promise<boolean> {
  if (!url) return false;
  
  const cacheKey = url.trim();
  const alreadyCached = await isMediaCached(id) || await isMediaCached(cacheKey);
  if (alreadyCached) {
    return true;
  }

  if (activePreloadUrls.has(cacheKey)) {
    // Already in progress, wait or skip
    return false;
  }

  activePreloadUrls.add(cacheKey);

  try {
    const resolvedUrl = resolveMediaUrl(cacheKey);
    // Fetch the file as a blob
    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Fetched blob is empty');
    }

    // Save to IndexedDB using both ID and URL as keys for faster retrieval
    await saveMediaToIndexedDb(id, blob);
    await saveMediaToIndexedDb(cacheKey, blob);
    
    return true;
  } catch (error) {
    console.warn(`Failed to preload media [ID: ${id}, URL: ${url}]:`, error);
    return false;
  } finally {
    activePreloadUrls.delete(cacheKey);
  }
}

/**
 * Background preloader queue manager
 */
class GiftBackgroundPreloader {
  private queue: { id: string; url: string }[] = [];
  private total = 0;
  private completed = 0;
  private cached = 0;
  private failed = 0;
  private activeCount = 0;
  private maxConcurrency = 3; // safe limit to avoid blocking client UI thread
  private listeners: ((progress: PreloadProgress) => void)[] = [];
  private isRunning = false;
  private currentUrl = '';

  public addListener(callback: (progress: PreloadProgress) => void) {
    this.listeners.push(callback);
    // Send current status immediately
    callback(this.getProgress());
  }

  public removeListener(callback: (progress: PreloadProgress) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notify() {
    const progress = this.getProgress();
    this.listeners.forEach(l => l(progress));
  }

  public getProgress(): PreloadProgress {
    const totalCount = this.total || 1;
    const progressPercent = Math.min(
      100,
      Math.round(((this.completed + this.cached) / totalCount) * 100)
    );

    return {
      total: this.total,
      completed: this.completed,
      cached: this.cached,
      failed: this.failed,
      currentUrl: this.currentUrl,
      activeDownloads: this.activeCount,
      percent: progressPercent,
      isFinished: this.completed + this.cached + this.failed >= this.total && this.total > 0
    };
  }

  /**
   * Starts preloading a list of gifts
   */
  public async start(gifts: GiftItem[]) {
    // 1. Gather all unique video & poster URLs that need preloading
    const itemsToPreload: { id: string; url: string }[] = [];
    const seenUrls = new Set<string>();

    for (const gift of gifts) {
      if (gift.videoUrl && !seenUrls.has(gift.videoUrl)) {
        seenUrls.add(gift.videoUrl);
        itemsToPreload.push({ id: gift.id, url: gift.videoUrl });
      }
      if (gift.posterUrl && gift.posterUrl.trim() && !seenUrls.has(gift.posterUrl)) {
        seenUrls.add(gift.posterUrl);
        itemsToPreload.push({ id: `${gift.id}_poster`, url: gift.posterUrl });
      }
    }

    // Reset statistics
    this.queue = itemsToPreload;
    this.total = itemsToPreload.length;
    this.completed = 0;
    this.cached = 0;
    this.failed = 0;
    this.activeCount = 0;
    this.currentUrl = '';
    
    if (this.total === 0) {
      this.notify();
      return;
    }

    this.notify();

    if (!this.isRunning) {
      this.isRunning = true;
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0 && this.activeCount === 0) {
      this.isRunning = false;
      this.notify();
      return;
    }

    // Fill up to max concurrency
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeCount++;
      this.currentUrl = item.url;
      this.notify();

      // Run download in background
      this.preloadItem(item.id, item.url);
    }
  }

  private async preloadItem(id: string, url: string) {
    try {
      // Check if already in cache before starting network
      const isAlreadyCached = await isMediaCached(id) || await isMediaCached(url);
      if (isAlreadyCached) {
        this.cached++;
      } else {
        const success = await preloadUrl(id, url);
        if (success) {
          this.completed++;
        } else {
          this.failed++;
        }
      }
    } catch (e) {
      this.failed++;
    } finally {
      this.activeCount--;
      this.processQueue();
      this.notify();
    }
  }
}

export const giftPreloader = new GiftBackgroundPreloader();
