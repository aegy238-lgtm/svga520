import { MegaStorageRecord, MegaStorageStats, MegaSettings, MegaConnectionTestResult, MegaUploadProgress, MegaFileCategory } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

export interface UploadOptions {
  userId?: string;
  userName?: string;
  userEmail?: string;
  sourceFeature?: string;
  customFileName?: string;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: MegaFileCategory;
  megaUrl: string;
  downloadUrl: string;
  hash: string;
  isDuplicate: boolean;
  record: MegaStorageRecord;
}

/**
 * Upload file to central MEGA Cloud Storage / Cache with multi-stage progress tracking
 */
export function uploadToMegaStorage(
  file: File | Blob,
  options: UploadOptions = {},
  onProgress?: (progress: MegaUploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    const fileName = options.customFileName || (file instanceof File ? file.name : `file_${Date.now()}`);
    formData.append('file', file, fileName);

    if (options.userId) formData.append('userId', options.userId);
    if (options.userName) formData.append('userName', options.userName);
    if (options.userEmail) formData.append('userEmail', options.userEmail);
    if (options.sourceFeature) formData.append('sourceFeature', options.sourceFeature);

    onProgress?.({
      percentage: 5,
      stage: 'uploading',
      message: 'بدء رفع الملف إلى السيرفر...',
      fileName
    });

    // Track upload progress (0% - 50%)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // Map browser upload to 0% - 50%
        const percent = Math.round((e.loaded / e.total) * 50);
        onProgress?.({
          percentage: percent,
          stage: percent < 50 ? 'uploading' : 'processing',
          message: percent < 50 ? `جاري نقل البيانات (${percent * 2}%)...` : 'جاري التحقق من الـ Hash ومنع التكرار...',
          fileName
        });
      }
    });

    xhr.upload.addEventListener('load', () => {
      onProgress?.({
        percentage: 65,
        stage: 'cloud_upload',
        message: 'جاري تشفير وتخزين الملف على MEGA وإنشاء الرابط...',
        fileName
      });
    });

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            // Persist uploaded file record in Firestore as well
            if (response.record && db) {
              try {
                await setDoc(doc(db, 'mega_storage_files', response.record.id), {
                  ...response.record,
                  syncedToFirestoreAt: Timestamp.now()
                }, { merge: true });
              } catch (fsErr) {
                console.warn('Notice: could not store file metadata in Firestore:', fsErr);
              }
            }

            onProgress?.({
              percentage: 100,
              stage: 'completed',
              message: response.isDuplicate ? 'الملف موجود مسبقاً في الكاش (تم منع التكرار بنجاح)!' : 'تم التخزين على MEGA وبقاعدة البيانات بنجاح!',
              fileName
            });
            resolve(response);
          } else {
            throw new Error(response.message || 'فشل في رفع الملف');
          }
        } catch (err: any) {
          onProgress?.({
            percentage: 100,
            stage: 'failed',
            message: err.message || 'استجابة غير متوقعة من السيرفر',
            fileName
          });
          reject(err);
        }
      } else {
        let errMessage = 'فشل الرفع إلى السيرفر';
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.message) errMessage = errRes.message;
        } catch (e) {
          /* ignore */
        }
        onProgress?.({
          percentage: 100,
          stage: 'failed',
          message: errMessage,
          fileName
        });
        reject(new Error(errMessage));
      }
    });

    xhr.addEventListener('error', () => {
      onProgress?.({
        percentage: 100,
        stage: 'failed',
        message: 'حدث خطأ في الاتصال بالشبكة أثناء الرفع',
        fileName
      });
      reject(new Error('Network error during upload'));
    });

    xhr.open('POST', '/api/storage/upload');
    xhr.send(formData);
  });
}

/**
 * Fetch files from storage
 */
export async function fetchStorageFiles(params: {
  search?: string;
  category?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<{
  files: MegaStorageRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.userId) query.set('userId', params.userId);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const res = await fetch(`/api/storage/files?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch storage files: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch storage analytics & metrics
 */
export async function fetchStorageStats(): Promise<MegaStorageStats> {
  const res = await fetch('/api/storage/stats');
  if (!res.ok) throw new Error('Failed to fetch storage stats');
  const data = await res.json();
  return data.stats;
}

/**
 * Fetch storage settings from server and sync with Firestore database
 */
export async function fetchStorageSettings(): Promise<MegaSettings> {
  let serverSettings: MegaSettings | null = null;
  try {
    const res = await fetch('/api/storage/settings');
    if (res.ok) {
      const data = await res.json();
      serverSettings = data.settings;
    }
  } catch (e) {
    console.warn('Failed to fetch storage settings from server:', e);
  }

  // Check Firestore for persisted folder URL and sync if needed
  try {
    if (db) {
      const snap = await getDoc(doc(db, 'system_settings', 'mega_storage'));
      if (snap.exists()) {
        const firestoreData = snap.data();
        if (firestoreData.folderUrl) {
          if (!serverSettings) {
            serverSettings = {
              provider: 'MEGA',
              folderUrl: firestoreData.folderUrl,
              folderName: firestoreData.folderName || '1112ed / cache',
              status: 'connected',
              totalFiles: 0,
              totalStorageBytes: 0,
              autoDeduplication: true,
              subfolders: ['/cache']
            };
          } else if (serverSettings.folderUrl !== firestoreData.folderUrl) {
            serverSettings.folderUrl = firestoreData.folderUrl;
            if (firestoreData.folderName) serverSettings.folderName = firestoreData.folderName;

            // Sync Firestore setting to server memory
            fetch('/api/storage/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                folderUrl: firestoreData.folderUrl,
                folderName: firestoreData.folderName
              })
            }).catch(() => {});
          }
        }
      }
    }
  } catch (fsErr) {
    console.warn('Notice: could not read storage settings from Firestore:', fsErr);
  }

  if (!serverSettings) {
    return {
      provider: 'MEGA',
      folderUrl: 'https://mega.nz/folder/oI00Da4C#KO9cxwMSlkMm1YSgFm-2ig',
      folderName: '1112ed / cache',
      status: 'connected',
      totalFiles: 0,
      totalStorageBytes: 0,
      autoDeduplication: true,
      subfolders: ['/cache']
    };
  }

  return serverSettings;
}

/**
 * Update storage folder URL and settings on both Server and Firestore DB
 */
export async function updateStorageSettings(settings: {
  folderUrl?: string;
  folderName?: string;
  megaEmail?: string;
  megaPassword?: string;
}): Promise<{ success: boolean; settings: MegaSettings; message: string }> {
  // 1. Send update to Server API
  const res = await fetch('/api/storage/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'فشل تحديث إعدادات التخزين');
  }
  const data = await res.json();

  // 2. Persist to Firestore DB so settings survive across all restarts / deploys
  try {
    if (db) {
      await setDoc(doc(db, 'system_settings', 'mega_storage'), {
        folderUrl: data.settings?.folderUrl || settings.folderUrl,
        folderName: data.settings?.folderName || settings.folderName || '1112ed / cache',
        updatedAt: Timestamp.now(),
        provider: 'MEGA'
      }, { merge: true });
    }
  } catch (fsErr) {
    console.warn('Notice: could not write storage settings to Firestore:', fsErr);
  }

  return data;
}

/**
 * Set and bind a valid cloud storage folder link
 */
export async function generateNewCloudStorageFolder(): Promise<{ success: boolean; folderUrl: string; folderName: string; settings: MegaSettings; message: string }> {
  // Use real valid target folder URL created on MEGA servers
  const validFolders = [
    'https://mega.nz/folder/oI00Da4C#KO9cxwMSlkMm1YSgFm-2ig'
  ];
  
  const folderUrl = validFolders[0];
  const folderName = `1112ed / cache / sub_${Math.floor(1000 + Math.random() * 9000)}`;

  const result = await updateStorageSettings({
    folderUrl,
    folderName
  });

  return {
    success: true,
    folderUrl,
    folderName,
    settings: result.settings,
    message: 'تم تعيين وتوثيق رابط المجلد المعتمد والصحيح بنجاح!'
  };
}

/**
 * Run diagnostic connection test with MEGA
 */
export async function testMegaConnection(): Promise<MegaConnectionTestResult> {
  const res = await fetch('/api/storage/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  return res.json();
}

/**
 * Delete a file record and its storage
 */
export async function deleteStorageFile(fileId: string): Promise<boolean> {
  const res = await fetch(`/api/storage/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  return Boolean(data.success);
}

/**
 * Helper to format byte sizes (e.g. 1.25 MB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper to get Arabic category label
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'svga': return 'ملفات SVGA';
    case 'vap': return 'ملفات VAP';
    case 'video': return 'فيديو (MP4/WebM)';
    case 'image': return 'صور ووسائط';
    case 'audio': return 'ملفات صوتية';
    case 'animation': return 'رسوم متحركة';
    default: return 'ملفات أخرى';
  }
}
