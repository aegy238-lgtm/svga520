/**
 * Memory Management & Resource Cleanup Engine
 * Ensures canvases, Blob URLs, and file buffers are immediately released from RAM.
 */

const trackedUrls = new Set<string>();

/**
 * Release an HTMLCanvasElement backing buffer immediately to free VRAM/RAM
 */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // Setting dimensions to 0 releases the GPU/CPU backing store in Blink, WebKit, and Gecko
    canvas.width = 0;
    canvas.height = 0;
  } catch (err) {
    // Ignore context already lost errors
  }
}

/**
 * Creates and tracks an Object URL, ensuring it can be bulk-cleaned or auto-revoked
 */
export function createTrackedBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  trackedUrls.add(url);
  return url;
}

/**
 * Safely revoke an Object URL and remove it from tracking
 */
export function safeRevokeUrl(url: string | null | undefined, delayMs: number = 0): void {
  if (!url || !url.startsWith('blob:')) return;
  
  const doRevoke = () => {
    try {
      URL.revokeObjectURL(url);
      trackedUrls.delete(url);
    } catch {}
  };

  if (delayMs > 0) {
    setTimeout(doRevoke, delayMs);
  } else {
    doRevoke();
  }
}

/**
 * Clean up all tracked URLs when leaving heavy views
 */
export function purgeTrackedUrls(): void {
  trackedUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  trackedUrls.clear();
}

/**
 * Read a file or blob in chunks with a callback to keep heap allocation constant
 */
export async function readBlobInChunks(
  blob: Blob,
  chunkSize: number = 2 * 1024 * 1024,
  onChunk: (chunk: Uint8Array, offset: number, total: number) => Promise<void>
): Promise<void> {
  const total = blob.size;
  let offset = 0;

  while (offset < total) {
    const end = Math.min(offset + chunkSize, total);
    const slice = blob.slice(offset, end);
    const arrayBuffer = await slice.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    await onChunk(uint8, offset, total);
    
    offset = end;
  }
}

/**
 * Smart Concurrency Queue: Executes an array of async task generators with a strict concurrency limit
 * Prevents browser tabs from freezing when processing 10, 20, or 100 files simultaneously.
 */
export async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  taskFn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number, latestResult?: R) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  let completedCount = 0;

  const effectiveLimit = Math.max(1, Math.min(limit, items.length));

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      const item = items[idx];
      try {
        const res = await taskFn(item, idx);
        results[idx] = res;
      } catch (err) {
        console.error(`[ConcurrencyQueue] Task failed at index ${idx}:`, err);
        throw err;
      } finally {
        completedCount++;
        if (onProgress) {
          onProgress(completedCount, items.length, results[idx]);
        }
      }
    }
  }

  // Launch workers up to the concurrency limit
  const workers = Array.from({ length: effectiveLimit }, () => worker());
  await Promise.all(workers);

  return results;
}
