import { MegaStorageRecord, MegaStorageStats, MegaSettings, MegaConnectionTestResult, MegaUploadProgress, MegaFileCategory } from '../types';

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

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            onProgress?.({
              percentage: 100,
              stage: 'completed',
              message: response.isDuplicate ? 'الملف موجود مسبقاً في الكاش (تم منع التكرار بنجاح)!' : 'تم التخزين على MEGA بنجاح!',
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
 * Fetch storage settings
 */
export async function fetchStorageSettings(): Promise<MegaSettings> {
  const res = await fetch('/api/storage/settings');
  if (!res.ok) throw new Error('Failed to fetch storage settings');
  const data = await res.json();
  return data.settings;
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
