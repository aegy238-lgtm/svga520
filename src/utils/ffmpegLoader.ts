import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// Module-level cached blob URLs for zero-latency reuse across the app
let cachedCoreBlobUrl: string | null = null;
let cachedWasmBlobUrl: string | null = null;

// Loading promises map to prevent concurrent load conflicts on the same instance
const loadingMap = new WeakMap<FFmpeg, Promise<void>>();

/**
 * Fetch a resource and convert to an Object URL safely verifying HTTP status and Content-Type
 */
const safeFetchToBlobUrl = async (url: string, mimeType: string, timeoutMs = 25000): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    
    // Guard against CDNs returning a 200 OK HTML error page
    if (blob.size < 5000) {
      const sampleText = await blob.slice(0, 100).text();
      if (sampleText.toLowerCase().includes('<!doctype') || sampleText.toLowerCase().includes('<html')) {
        throw new Error(`Received HTML error page instead of binary asset for ${url}`);
      }
    }
    
    return URL.createObjectURL(new Blob([blob], { type: mimeType }));
  } finally {
    clearTimeout(timer);
  }
};

export const loadFFmpegWithFallbacks = async (
  ffmpeg: FFmpeg, 
  onLog?: (msg: string) => void
): Promise<void> => {
  if (ffmpeg.loaded) return;

  // If this instance is already loading, await existing promise
  const existingPromise = loadingMap.get(ffmpeg);
  if (existingPromise) {
    return existingPromise;
  }

  const loadPromise = (async () => {
    if (onLog) {
      ffmpeg.on('log', ({ message }) => {
        onLog(message);
      });
    } else {
      ffmpeg.on('log', ({ message }) => {
        console.log("[FFmpeg Log]", message);
      });
    }

    // 1. If we already have validated blob URLs cached in memory, use them immediately
    if (cachedCoreBlobUrl && cachedWasmBlobUrl) {
      try {
        console.log("[FFmpeg Loader] Using in-memory cached blob URLs...");
        await ffmpeg.load({
          coreURL: cachedCoreBlobUrl,
          wasmURL: cachedWasmBlobUrl
        });
        console.log("[FFmpeg Loader] Loaded successfully from cache");
        return;
      } catch (cacheErr) {
        console.warn("[FFmpeg Loader] Cached blob URLs failed, invalidating cache:", cacheErr);
        cachedCoreBlobUrl = null;
        cachedWasmBlobUrl = null;
      }
    }

    // 2. Candidate base locations in priority order: Local server first, then external CDNs
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const candidateBases: string[] = [];

    // Local endpoints served directly from the application server/container
    if (origin) {
      candidateBases.push(`${origin}/vendor/ffmpeg-core`);
    }
    candidateBases.push('/vendor/ffmpeg-core');

    // External CDN fallbacks
    candidateBases.push(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
      'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
    );

    let lastError: any = null;

    for (const base of candidateBases) {
      try {
        console.log(`[FFmpeg Loader] Attempting to load FFmpeg from base: ${base}...`);

        let coreURL: string;
        let wasmURL: string;

        try {
          coreURL = await safeFetchToBlobUrl(`${base}/ffmpeg-core.js`, 'text/javascript', 20000);
          wasmURL = await safeFetchToBlobUrl(`${base}/ffmpeg-core.wasm`, 'application/wasm', 35000);
        } catch (fetchErr) {
          console.warn(`[FFmpeg Loader] safeFetchToBlobUrl failed for ${base}, falling back to toBlobURL:`, fetchErr);
          coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript');
          wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm');
        }

        await ffmpeg.load({ coreURL, wasmURL });

        // Successfully loaded! Cache for all future instances
        cachedCoreBlobUrl = coreURL;
        cachedWasmBlobUrl = wasmURL;
        console.log(`[FFmpeg Loader] FFmpeg successfully initialized from: ${base}`);
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[FFmpeg Loader] Failed to load from ${base}:`, err);
      }
    }

    console.error("[FFmpeg Loader] All FFmpeg sources failed. Last error:", lastError);
    throw new Error('فشل تحميل محرك المعالجة المحلي من الخوادم السحابية ومصادر الحزمة المحلية.');
  })();

  loadingMap.set(ffmpeg, loadPromise);

  try {
    await loadPromise;
  } finally {
    loadingMap.delete(ffmpeg);
  }
};
