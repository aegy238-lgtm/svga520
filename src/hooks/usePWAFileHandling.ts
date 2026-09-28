import { useEffect, useRef } from 'react';

interface UsePWAFileHandlingOptions {
  onFilesReceived: (files: File[]) => void;
}

export function usePWAFileHandling({ onFilesReceived }: UsePWAFileHandlingOptions) {
  const processedRef = useRef(false);
  const onFilesReceivedRef = useRef(onFilesReceived);
  onFilesReceivedRef.current = onFilesReceived;

  useEffect(() => {
    // 1. Listen for LaunchQueue (File Handling API on Android / Desktop Chromium)
    if ('launchQueue' in window && 'files' in (window as any).LaunchParams.prototype) {
      try {
        (window as any).launchQueue.setConsumer(async (launchParams: any) => {
          if (!launchParams.files || !launchParams.files.length) return;
          const files: File[] = [];
          for (const handle of launchParams.files) {
            try {
              const file = await handle.getFile();
              if (file) files.push(file);
            } catch (err) {
              console.error('[LaunchQueue] Failed to get file handle:', err);
            }
          }
          if (files.length > 0) {
            onFilesReceivedRef.current(files);
          }
        });
      } catch (err) {
        console.warn('[PWA] LaunchQueue registration notice:', err);
      }
    }

    // 2. Check for Web Share Target cached items
    const searchParams = new URLSearchParams(window.location.search);
    const isShared = searchParams.get('shared') === '1' || searchParams.get('file_launch') === '1';

    if (isShared && !processedRef.current) {
      processedRef.current = true;
      (async () => {
        try {
          if ('caches' in window) {
            const cache = await caches.open('pwa-shared-media-v1');
            const keys = await cache.keys();
            const retrievedFiles: File[] = [];

            for (const request of keys) {
              if (request.url.includes('/shared-file-temp-')) {
                const response = await cache.match(request);
                if (response) {
                  const blob = await response.blob();
                  const encodedName = response.headers.get('X-File-Name');
                  const filename = encodedName ? decodeURIComponent(encodedName) : `shared_media_${Date.now()}`;
                  const file = new File([blob], filename, {
                    type: blob.type || 'application/octet-stream',
                    lastModified: Date.now()
                  });
                  retrievedFiles.push(file);
                  await cache.delete(request);
                }
              }
            }

            // Clean up the URL query params without reloading
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', cleanUrl);

            if (retrievedFiles.length > 0) {
              onFilesReceivedRef.current(retrievedFiles);
            }
          }
        } catch (e) {
          console.error('[PWA] Failed to retrieve shared files from cache:', e);
        }
      })();
    }
  }, []);
}
