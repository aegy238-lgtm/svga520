import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, Timestamp, serverTimestamp, 
  writeBatch
} from 'firebase/firestore';
import { ref, deleteObject, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { StoredFileRecord, StorageCenterStats, StorageActivityLog } from '../types';
import { getFileCategory } from './centralUploadService';

/**
 * Fetch Storage Center Stats
 */
export async function fetchStorageCenterStats(): Promise<StorageCenterStats> {
  try {
    const q = query(collection(db, 'files'));
    const snapshot = await getDocs(q);

    let totalSize = 0;
    let trashCount = 0;
    let activeCount = 0;
    let filesToday = 0;
    let filesThisWeek = 0;
    let filesThisMonth = 0;
    const categoryCounts: Record<string, number> = {
      svga: 0,
      vap: 0,
      lottie: 0,
      video: 0,
      image: 0,
      audio: 0,
      zip: 0,
      pdf: 0,
      other: 0
    };

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    snapshot.docs.forEach((d) => {
      const data = d.data() as StoredFileRecord;
      const size = Number(data.size) || 0;
      totalSize += size;

      if (data.status === 'trash') {
        trashCount++;
      } else {
        activeCount++;
      }

      // Date comparisons
      let createdTime = 0;
      if (data.createdAt?.toMillis) {
        createdTime = data.createdAt.toMillis();
      } else if (data.createdAt?.seconds) {
        createdTime = data.createdAt.seconds * 1000;
      } else if (typeof data.createdAt === 'string') {
        createdTime = new Date(data.createdAt).getTime();
      }

      if (createdTime > oneDayAgo) filesToday++;
      if (createdTime > oneWeekAgo) filesThisWeek++;
      if (createdTime > oneMonthAgo) filesThisMonth++;

      // Category breakdown
      const cat = getFileCategory(data.extension || '', data.mimeType || '');
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return {
      totalFiles: snapshot.docs.length,
      totalSize,
      filesToday,
      filesThisWeek,
      filesThisMonth,
      trashCount,
      activeCount,
      categoryCounts,
      provider: 'Firebase Storage (Google Cloud)'
    };
  } catch (error) {
    console.error('Error fetching Storage Center stats:', error);
    return {
      totalFiles: 0,
      totalSize: 0,
      filesToday: 0,
      filesThisWeek: 0,
      filesThisMonth: 0,
      trashCount: 0,
      activeCount: 0,
      categoryCounts: {},
      provider: 'Firebase Storage'
    };
  }
}

/**
 * Fetch Stored Files with filtering & search
 */
export async function fetchStoredFiles(params: {
  status?: 'active' | 'trash';
  search?: string;
  category?: string;
  sortBy?: 'createdAt' | 'size' | 'originalName';
  sortOrder?: 'desc' | 'asc';
  limitCount?: number;
}): Promise<StoredFileRecord[]> {
  try {
    const {
      status = 'active',
      search = '',
      category = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limitCount = 200
    } = params;

    // Fetch documents
    const q = query(
      collection(db, 'files'),
      where('status', '==', status)
    );

    const snapshot = await getDocs(q);
    let list: StoredFileRecord[] = snapshot.docs.map(d => ({
      ...d.data(),
      fileId: d.id
    } as StoredFileRecord));

    // Filter by search query (File Name, User Name, Firebase UID)
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(f => 
        (f.originalName && f.originalName.toLowerCase().includes(s)) ||
        (f.storedName && f.storedName.toLowerCase().includes(s)) ||
        (f.fileId && f.fileId.toLowerCase().includes(s)) ||
        (f.userId && f.userId.toLowerCase().includes(s)) ||
        (f.userName && f.userName.toLowerCase().includes(s)) ||
        (f.userEmail && f.userEmail.toLowerCase().includes(s))
      );
    }

    // Filter by category
    if (category && category !== 'all') {
      list = list.filter(f => {
        const cat = getFileCategory(f.extension || '', f.mimeType || '');
        return cat === category;
      });
    }

    // Sort in-memory
    list.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'createdAt') {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }

      if (sortBy === 'size') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (sortOrder === 'desc') {
        return valA > valB ? -1 : 1;
      }
      return valA > valB ? 1 : -1;
    });

    return list.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching stored files:', error);
    return [];
  }
}

/**
 * Log Admin storage activity
 */
export async function logStorageAdminActivity(
  adminUser: any,
  action: 'download' | 'delete' | 'restore' | 'cleanup' | 'create_secure_link',
  details: string,
  fileId?: string,
  fileName?: string
): Promise<void> {
  try {
    const logData: StorageActivityLog = {
      adminId: adminUser?.uid || adminUser?.id || 'admin',
      adminName: adminUser?.displayName || adminUser?.name || 'المدير',
      adminEmail: adminUser?.email || '',
      action,
      fileId: fileId || '',
      fileName: fileName || '',
      details,
      timestamp: serverTimestamp()
    };

    const newDoc = doc(collection(db, 'storageActivityLogs'));
    await setDoc(newDoc, logData);
  } catch (e) {
    console.warn('Notice: Failed to write activity log:', e);
  }
}

/**
 * Move file to Trash
 */
export async function moveFileToTrash(fileId: string, adminUser: any): Promise<void> {
  const fileRef = doc(db, 'files', fileId);
  const snap = await getDoc(fileRef);
  const data = snap.data() as StoredFileRecord;

  await updateDoc(fileRef, {
    status: 'trash',
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await logStorageAdminActivity(
    adminUser,
    'delete',
    `نقل الملف "${data?.originalName || fileId}" إلى سلة المهملات`,
    fileId,
    data?.originalName
  );
}

/**
 * Restore file from Trash
 */
export async function restoreFileFromTrash(fileId: string, adminUser: any): Promise<void> {
  const fileRef = doc(db, 'files', fileId);
  const snap = await getDoc(fileRef);
  const data = snap.data() as StoredFileRecord;

  await updateDoc(fileRef, {
    status: 'active',
    deletedAt: null,
    updatedAt: serverTimestamp()
  });

  await logStorageAdminActivity(
    adminUser,
    'restore',
    `استعادة الملف "${data?.originalName || fileId}" من سلة المهملات إلى الملفات النشطة`,
    fileId,
    data?.originalName
  );
}

/**
 * Permanently Delete File from Storage + Firestore
 */
export async function permanentlyDeleteFile(fileId: string, adminUser: any): Promise<void> {
  const fileRef = doc(db, 'files', fileId);
  const snap = await getDoc(fileRef);
  
  if (snap.exists()) {
    const data = snap.data() as StoredFileRecord;

    // 1. Delete binary from Firebase Storage
    if (data.storageKey) {
      try {
        const storageRef = ref(storage, data.storageKey);
        await deleteObject(storageRef);
      } catch (storageErr) {
        console.warn('Notice: Storage object might have already been removed:', storageErr);
      }
    }

    // 2. Delete document from Firestore
    await deleteDoc(fileRef);

    // 3. Log action
    await logStorageAdminActivity(
      adminUser,
      'delete',
      `حذف نهائي للملف "${data.originalName}" من التخزين وقاعدة البيانات`,
      fileId,
      data.originalName
    );
  }
}

/**
 * Generate Secure Download Link for Admin
 */
export async function generateSecureDownloadLink(fileId: string, adminUser: any): Promise<string> {
  const snap = await getDoc(doc(db, 'files', fileId));
  if (!snap.exists()) {
    throw new Error('الملف غير موجود في قاعدة البيانات');
  }

  const data = snap.data() as StoredFileRecord;
  let directUrl = '';

  if (data.storageKey) {
    try {
      const storageRef = ref(storage, data.storageKey);
      directUrl = await getDownloadURL(storageRef);
    } catch (e) {
      // Fallback to proxy
      directUrl = `/api/files/download/${fileId}`;
    }
  } else {
    directUrl = `/api/files/download/${fileId}`;
  }

  await logStorageAdminActivity(
    adminUser,
    'create_secure_link',
    `إنشاء رابط تحميل آمن للملف "${data.originalName}"`,
    fileId,
    data.originalName
  );

  return directUrl;
}

/**
 * Storage Cleanup Engine
 */
export async function executeStorageCleanup(
  options: {
    cleanTrashOnly?: boolean;
    trashDaysThreshold?: number;
  },
  adminUser: any
): Promise<{ freedBytes: number; deletedCount: number; message: string }> {
  const { cleanTrashOnly = true, trashDaysThreshold = 0 } = options;
  
  // Find files in trash
  const q = query(
    collection(db, 'files'),
    where('status', '==', 'trash')
  );

  const snapshot = await getDocs(q);
  let freedBytes = 0;
  let deletedCount = 0;

  const cutoffTime = Date.now() - (trashDaysThreshold * 24 * 60 * 60 * 1000);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as StoredFileRecord;

    let deletedTime = 0;
    if (data.deletedAt?.toMillis) {
      deletedTime = data.deletedAt.toMillis();
    } else if (data.deletedAt?.seconds) {
      deletedTime = data.deletedAt.seconds * 1000;
    } else {
      deletedTime = Date.now();
    }

    if (deletedTime <= cutoffTime) {
      freedBytes += Number(data.size) || 0;

      // Delete from Storage
      if (data.storageKey) {
        try {
          const storageRef = ref(storage, data.storageKey);
          await deleteObject(storageRef);
        } catch (e) {}
      }

      // Delete from Firestore
      await deleteDoc(docSnap.ref);
      deletedCount++;
    }
  }

  const freedMb = (freedBytes / (1024 * 1024)).toFixed(2);
  const msg = `تم تنظيف التخزين بنجاح! تم حذف ${deletedCount} ملف نهائياً وتحرير ${freedMb} ميجابايت من التخزين.`;

  await logStorageAdminActivity(
    adminUser,
    'cleanup',
    `تنظيف التخزين: حذف ${deletedCount} ملف من سلة المهملات وتحرير ${freedMb} MB`,
    undefined,
    undefined
  );

  return {
    freedBytes,
    deletedCount,
    message: msg
  };
}

/**
 * Fetch Activity Logs
 */
export async function fetchStorageActivityLogs(limitCount = 50): Promise<StorageActivityLog[]> {
  try {
    const q = query(
      collection(db, 'storageActivityLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as StorageActivityLog));
  } catch (error) {
    console.warn('Error fetching storage activity logs:', error);
    return [];
  }
}

/**
 * Fetch Server Filesystem Temp Status
 */
export async function fetchServerStatus(): Promise<{
  ok: boolean;
  totalTempFiles: number;
  totalTempBytes: number;
  uploads?: { filesCount: number; sizeBytes: number };
  cache?: { filesCount: number; sizeBytes: number };
}> {
  try {
    const res = await fetch('/api/storage/server-status');
    if (!res.ok) throw new Error('فشل جلب حالة ملفات السيرفر المؤقتة');
    return await res.json();
  } catch (e) {
    console.warn('Error fetching server status:', e);
    return { ok: false, totalTempFiles: 0, totalTempBytes: 0 };
  }
}

/**
 * Execute Server Filesystem & Cache Cleanup
 */
export async function executeServerCleanup(adminUser: any): Promise<{
  ok: boolean;
  deletedCount: number;
  freedBytes: number;
  freedMb: string;
  cleanedItems: string[];
  message: string;
}> {
  try {
    const res = await fetch('/api/storage/server-cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'فشل تنظيف ملفات السيرفر.');
    }

    await logStorageAdminActivity(
      adminUser,
      'cleanup',
      `تنظيف ملفات السيرفر المؤقتة: حذف ${data.deletedCount} ملف وتحرير ${data.freedMb} MB`,
      undefined,
      undefined
    );

    return data;
  } catch (err: any) {
    console.error('Server cleanup error:', err);
    throw err;
  }
}

