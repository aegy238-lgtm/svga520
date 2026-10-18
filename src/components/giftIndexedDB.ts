/**
 * Lightweight IndexedDB service for instant local storage of gift files
 * Prevents Firestore 1MB document property size limits while delivering instant local previews
 */

const DB_NAME = 'gifts_local_storage_db';
const STORE_NAME = 'gift_files';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save file or data string in local IndexedDB
 */
export async function saveLocalGiftFile(id: string, fileData: Blob | File | string): Promise<string> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(fileData, id);
      request.onsuccess = () => resolve(`idb://${id}`);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("IndexedDB save warning:", e);
    return '';
  }
}

/**
 * Retrieve file or data string from local IndexedDB
 */
export async function getLocalGiftFile(id: string): Promise<string | null> {
  try {
    const cleanId = id.replace('idb://', '');
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
        } else if (val instanceof Blob || val instanceof File) {
          resolve(URL.createObjectURL(val));
        } else if (typeof val === 'string') {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("IndexedDB fetch warning:", e);
    return null;
  }
}
