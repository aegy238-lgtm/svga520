/**
 * Persistent Media Storage & Upload Utility
 * Handles persistent server file storage via /api/upload and IndexedDB caching for offline resilience.
 */

const DB_NAME = 'jiawei_media_vault';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

// Open IndexedDB database
function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a media Blob / File to IndexedDB
 */
export async function saveMediaToIndexedDb(id: string, blob: Blob | File, filename?: string): Promise<void> {
  try {
    const db = await openMediaDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      id,
      blob,
      type: blob.type,
      filename: filename || id,
      timestamp: Date.now()
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Could not save media to IndexedDB:', e);
  }
}

/**
 * Retrieves a media Blob from IndexedDB
 */
export async function getMediaFromIndexedDb(id: string): Promise<Blob | null> {
  try {
    const db = await openMediaDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        if (request.result && request.result.blob) {
          resolve(request.result.blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Uploads a file to the persistent backend server storage
 */
export async function uploadMediaToServer(
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
  const formData = new FormData();
  formData.append('file', file, fileName);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.url) {
      return data;
    }
    throw new Error('Invalid upload response from server');
  } catch (err: any) {
    console.warn('Server upload fallback:', err);
    // Fallback URL if server upload fails
    const localBlobUrl = URL.createObjectURL(file);
    return {
      url: localBlobUrl,
      filename: fileName,
      size: file.size,
      mimeType: file.type || 'video/mp4'
    };
  }
}

/**
 * Resolves a media URL to an absolute or playable stream URL
 * Supports local uploads, Google Drive, Dropbox, Top4top, and general web videos & images
 */
export function resolveMediaUrl(url?: string, useProxy = false): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Handle Google Drive view links -> convert to direct thumbnail/image links
  const gdriveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Handle Dropbox share links -> convert to direct raw links
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?dl=[01]/, '');
  }

  // Automatically proxy sites with strict hotlink blocking or scraping requirements
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (
      useProxy ||
      trimmed.includes('top4top.') ||
      trimmed.includes('ibb.co') ||
      trimmed.includes('postimg.cc') ||
      trimmed.includes('streamable.com') ||
      trimmed.includes('catbox.moe') ||
      trimmed.includes('gofile.io')
    ) {
      return `/api/proxy-media?url=${encodeURIComponent(trimmed)}`;
    }
  }

  return trimmed;
}

/**
 * Gets a proxy streaming URL for an external media resource to bypass CORS and allow canvas frame capturing
 */
export function getProxyMediaUrl(url: string): string {
  if (!url || url.startsWith('/uploads/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  return `/api/proxy-media?url=${encodeURIComponent(url.trim())}`;
}
