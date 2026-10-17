import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { SmartChromaSettings, SmartCompressionConfig, DetectedVideoElement } from '../utils/smartMp4Engine';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SmartMp4TaskRecord {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
  trimStart: number;
  trimEnd: number;
  elementsCount: number;
  exportedCount: number;
  status: 'uploaded' | 'analyzing' | 'ready' | 'exporting' | 'completed' | 'error';
  progress: number;
  statusMessage: string;
  chromaSettings: SmartChromaSettings;
  compressionSettings: SmartCompressionConfig;
  elementsSummary: Array<{
    id: string;
    name: string;
    category: string;
    width: number;
    height: number;
    frames: number;
    estimatedSizeKb: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const IDB_NAME = 'smart_mp4_studio_db';
const IDB_VERSION = 1;
const STORE_PROJECTS = 'projects_state';
const STORE_CHUNKS = 'video_chunks';

function openStudioIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_PROJECTS)) {
        database.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_CHUNKS)) {
        database.createObjectStore(STORE_CHUNKS, { keyPath: 'chunkKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Chunked & Resumable File Ingestion into IndexedDB (2MB chunks)
 * Ensures large videos are safely buffered without memory spikes and can resume if interrupted.
 */
export async function ingestVideoFileChunked(
  file: File,
  projectId: string,
  onProgress?: (loadedBytes: number, totalBytes: number, chunkIndex: number, totalChunks: number) => void
): Promise<void> {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per chunk
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const idb = await openStudioIdb();

  for (let i = 0; i < totalChunks; i++) {
    const chunkKey = `${projectId}_chunk_${i}`;
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const slice = file.slice(start, end);
    const buf = await slice.arrayBuffer();

    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE_CHUNKS, 'readwrite');
      const store = tx.objectStore(STORE_CHUNKS);
      store.put({
        chunkKey,
        projectId,
        chunkIndex: i,
        totalChunks,
        data: buf,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    onProgress?.(end, file.size, i + 1, totalChunks);
  }
}

/**
 * Reconstruct a video File from stored IndexedDB chunks when resuming a saved project session
 */
export async function reconstructVideoFromChunks(
  projectId: string,
  fileName: string,
  mimeType = 'video/mp4'
): Promise<File | null> {
  try {
    const idb = await openStudioIdb();
    const chunks: Array<{ chunkIndex: number; data: ArrayBuffer }> = await new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_CHUNKS, 'readonly');
      const store = tx.objectStore(STORE_CHUNKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []).filter((item: any) => item.projectId === projectId);
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });

    if (chunks.length === 0) return null;
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const blobs = chunks.map((c) => new Blob([c.data]));
    return new File(blobs, fileName, { type: mimeType });
  } catch {
    return null;
  }
}

/**
 * Save full project state (including masks and elements) to IndexedDB + metadata to Firestore `user_cache`
 */
export async function saveSmartMp4ProjectState(
  record: SmartMp4TaskRecord,
  elements: DetectedVideoElement[]
): Promise<void> {
  // 1. Save full state locally in IndexedDB for instant offline/navigation recovery
  try {
    const idb = await openStudioIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.put({
        id: record.id,
        record,
        elements,
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Local IDB project save warning:', err);
  }

  // 2. Sync lightweight project metadata to Firestore `user_cache` if user is signed in with Firebase Auth
  if (auth.currentUser?.uid) {
    const path = 'user_cache';
    try {
      const docRef = doc(db, path, `smart_mp4_${record.id}`);
      await setDoc(
        docRef,
        {
          id: `smart_mp4_${record.id}`,
          projectId: record.id,
          userId: auth.currentUser.uid,
          toolType: 'SMART_MP4_STUDIO',
          fileName: record.fileName.slice(0, 180),
          fileSize: record.fileSize,
          width: record.width,
          height: record.height,
          duration: record.duration,
          fps: record.fps,
          elementsCount: record.elementsCount,
          exportedCount: record.exportedCount,
          status: record.status,
          statusMessage: record.statusMessage.slice(0, 240),
          elementsSummary: record.elementsSummary.slice(0, 30),
          createdAt: record.createdAt,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      // Only throw structured FirestoreError if it's a permission error
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }
}

/**
 * Load all saved Smart MP4 Studio projects from IndexedDB + Firestore
 */
export async function loadSmartMp4ProjectsHistory(): Promise<
  Array<{ record: SmartMp4TaskRecord; elements: DetectedVideoElement[] }>
> {
  const localMap = new Map<string, { record: SmartMp4TaskRecord; elements: DetectedVideoElement[] }>();

  try {
    const idb = await openStudioIdb();
    const allLocal: any[] = await new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const item of allLocal) {
      if (item?.record?.id) {
        localMap.set(item.record.id, {
          record: item.record,
          elements: item.elements || [],
        });
      }
    }
  } catch (err) {
    console.warn('Could not read local IDB history:', err);
  }

  if (auth.currentUser?.uid) {
    const path = 'user_cache';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.toolType === 'SMART_MP4_STUDIO' && d.projectId && !localMap.has(d.projectId)) {
          localMap.set(d.projectId, {
            record: {
              id: d.projectId,
              userId: d.userId,
              fileName: d.fileName || 'video.mp4',
              fileSize: d.fileSize || 0,
              width: d.width || 1280,
              height: d.height || 720,
              duration: d.duration || 0,
              fps: d.fps || 24,
              trimStart: 0,
              trimEnd: d.duration || 0,
              elementsCount: d.elementsCount || 0,
              exportedCount: d.exportedCount || 0,
              status: d.status || 'ready',
              progress: 100,
              statusMessage: d.statusMessage || 'محفوظ في السحابة',
              chromaSettings: {} as any,
              compressionSettings: {} as any,
              elementsSummary: d.elementsSummary || [],
              createdAt: d.createdAt || new Date().toISOString(),
              updatedAt: d.updatedAt || new Date().toISOString(),
            },
            elements: [],
          });
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }
  }

  return Array.from(localMap.values()).sort(
    (a, b) => new Date(b.record.updatedAt).getTime() - new Date(a.record.updatedAt).getTime()
  );
}

export async function deleteSmartMp4Project(projectId: string): Promise<void> {
  try {
    const idb = await openStudioIdb();
    await new Promise<void>((resolve) => {
      const tx = idb.transaction([STORE_PROJECTS, STORE_CHUNKS], 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}

  if (auth.currentUser?.uid) {
    const path = 'user_cache';
    try {
      await deleteDoc(doc(db, path, `smart_mp4_${projectId}`));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  }
}
