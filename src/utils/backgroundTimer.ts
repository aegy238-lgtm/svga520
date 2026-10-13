/**
 * Background Timer Utility
 * Provides unthrottled timers and asynchronous yielding for video encoding,
 * frame extraction, and heavy export tasks.
 * 
 * In background tabs, browsers aggressively throttle setTimeout (to 1000ms+)
 * and completely freeze requestAnimationFrame.
 * This worker-backed timer ensures that encoding and rendering tasks continue
 * running at full speed without stalling or freezing at 1% / 2%.
 */

let worker: Worker | null = null;
let workerMsgId = 0;
const workerCallbacks = new Map<number, () => void>();

function getWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      const workerCode = `
        self.onmessage = function(e) {
          var id = e.data.id;
          var ms = e.data.ms || 0;
          setTimeout(function() {
            self.postMessage({ id: id });
          }, ms);
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => {
        const id = e.data?.id;
        const cb = workerCallbacks.get(id);
        if (cb) {
          workerCallbacks.delete(id);
          cb();
        }
      };
      worker.onerror = () => {
        // Fallback if worker throws
        worker = null;
      };
    } catch {
      worker = null;
    }
  }
  return worker;
}

/**
 * Asynchronous sleep that does NOT freeze when the browser tab is hidden or backgrounded.
 */
export function backgroundSleep(ms: number = 0): Promise<void> {
  const w = getWorker();
  if (w) {
    return new Promise((resolve) => {
      const id = ++workerMsgId;
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          workerCallbacks.delete(id);
          resolve();
        }
      };
      workerCallbacks.set(id, done);
      try {
        w.postMessage({ id, ms });
      } catch {
        done();
      }
      // Watchdog timeout to guarantee resolution
      setTimeout(done, Math.max(20, ms + 50));
    });
  }

  // Fallback using microtask / MessageChannel or setTimeout
  return new Promise((resolve) => {
    if (typeof MessageChannel !== 'undefined' && ms <= 0) {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    } else {
      setTimeout(resolve, ms);
    }
  });
}

/**
 * Yields execution to allow UI updates, encoder flush, and message handling
 * without pausing when the tab is backgrounded.
 */
export function backgroundYield(): Promise<void> {
  return backgroundSleep(0);
}
