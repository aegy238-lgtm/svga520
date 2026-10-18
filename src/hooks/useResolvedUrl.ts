import { useState, useEffect } from 'react';
import { getLocalGiftFile } from '../components/giftIndexedDB';

/**
 * Resolves IndexedDB `idb://` URLs or standard HTTPS/blob URLs to playable media src
 */
export function useResolvedUrl(url?: string | null, fallback = '/logo.png'): string {
  const [resolved, setResolved] = useState<string>(url && !url.startsWith('idb://') ? url : fallback);

  useEffect(() => {
    if (!url) {
      setResolved(fallback);
      return;
    }

    if (url.startsWith('idb://')) {
      let isSubscribed = true;
      getLocalGiftFile(url).then((blobUrl) => {
        if (isSubscribed) {
          setResolved(blobUrl || fallback);
        }
      });
      return () => {
        isSubscribed = false;
      };
    } else {
      setResolved(url);
    }
  }, [url, fallback]);

  return resolved;
}
