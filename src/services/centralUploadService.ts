import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  collection, doc, setDoc, getDoc, serverTimestamp, 
  Timestamp, query, where, getDocs, limit 
} from 'firebase/firestore';
import { auth, db, storage } from '../lib/firebase';
import { StoredFileRecord } from '../types';

let currentUserProvider: (() => any) | null = null;

export function registerCurrentUserProvider(provider: () => any) {
  currentUserProvider = provider;
}

/**
 * Determine category from extension or mime-type
 */
export function getFileCategory(extension: string, mimeType: string): string {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (ext === 'svga') return 'svga';
  if (ext === 'vap') return 'vap';
  if (ext === 'json' && mime.includes('lottie')) return 'lottie';
  if (ext === 'lottie' || ext === 'dotlottie') return 'lottie';
  if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'].includes(ext) || mime.startsWith('video/')) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'].includes(ext) || mime.startsWith('audio/')) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  return 'other';
}

/**
 * Clean & sanitize filename for secure storage
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\d._-]/g, '_').replace(/_{2,}/g, '_');
}

/**
 * Extract clean extension
 */
export function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export interface UploadOptions {
  uploadContext?: string;
  projectId?: string;
  customName?: string;
  user?: any;
  onProgress?: (percentage: number) => void;
}

/**
 * CentralUploadService: Single unified backend/storage upload service for the entire application.
 * Uploads file to Private Object Storage and stores metadata in Firestore collection 'files'.
 */
export class CentralUploadService {
  /**
   * Uploads any file from any part of the site to Private Object Storage & Firestore.
   */
  public static async uploadFile(
    file: File | Blob,
    options: UploadOptions = {}
  ): Promise<StoredFileRecord> {
    try {
      // 1. Resolve active user (Priority: Passed user -> Auth provider -> Firebase auth current user)
      const activeUser = 
        options.user || 
        (currentUserProvider ? currentUserProvider() : null) || 
        auth.currentUser;

      const userId = activeUser?.uid || activeUser?.id || 'guest_user';
      const userName = activeUser?.displayName || activeUser?.name || activeUser?.email || 'مستخدم المنصة';
      const userEmail = activeUser?.email || '';

      // 2. Resolve file names & properties
      const rawName = 
        options.customName || 
        (file instanceof File ? file.name : `file_${Date.now()}`);
      
      const extension = getFileExtension(rawName);
      const originalName = rawName;
      const storedName = sanitizeFileName(rawName);
      const mimeType = file.type || 'application/octet-stream';
      const size = file.size || 0;
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const uploadContext = options.uploadContext || 'central_upload';
      const projectId = options.projectId || '';

      // 3. Define Private Object Storage Key
      // Stored in private bucket path: private_storage/{userId}/{fileId}_{storedName}
      const storageKey = `private_storage/${userId}/${fileId}_${storedName}`;
      const storageRef = ref(storage, storageKey);

      // 4. Upload binary to Persistent Private Object Storage
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: mimeType,
        customMetadata: {
          fileId,
          userId,
          originalName,
          uploadContext,
          projectId
        }
      });

      // Track progress if callback provided
      if (options.onProgress) {
        uploadTask.on('state_changed', (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          options.onProgress?.(Math.round(progress));
        });
      }

      await uploadTask;

      // 5. Get Direct Download URL from Firebase Storage
      let directDownloadUrl = '';
      try {
        directDownloadUrl = await getDownloadURL(storageRef);
      } catch (urlErr) {
        console.warn('Could not retrieve direct download URL, falling back to proxy:', urlErr);
      }

      // 6. Build Firestore Record Document
      const now = Timestamp.now();
      const downloadProxyUrl = directDownloadUrl || `/api/files/download/${fileId}`;

      const fileRecord: StoredFileRecord = {
        fileId,
        userId,
        userName,
        userEmail,
        originalName,
        storedName,
        extension,
        mimeType,
        size,
        storageKey,
        storageProvider: 'firebase_storage',
        uploadContext,
        projectId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        downloadUrl: downloadProxyUrl,
        downloadCount: 0,
        lastDownloadedAt: null
      };

      // 7. Save Record in Firestore collection 'files'
      try {
        await setDoc(doc(db, 'files', fileId), {
          ...fileRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (firestoreErr) {
        console.warn('Notice: Firestore save error, retrying without serverTimestamp:', firestoreErr);
        await setDoc(doc(db, 'files', fileId), fileRecord);
      }

      // 8. Notify app and UI via custom event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('central_file_uploaded', { detail: fileRecord }));
      }

      return fileRecord;
    } catch (error: any) {
      console.error('CentralUploadService upload error:', error);
      throw new Error(error.message || 'فشل رفع وتخزين الملف في التخزين الدائم.');
    }
  }

  /**
   * Helper to batch upload multiple files
   */
  public static async uploadMultiple(
    files: Array<File | Blob>,
    options: UploadOptions = {}
  ): Promise<StoredFileRecord[]> {
    const results: StoredFileRecord[] = [];
    for (const file of files) {
      const res = await this.uploadFile(file, options);
      results.push(res);
    }
    return results;
  }
}

/**
 * Automatic caching disabled per user configuration to prevent consuming storage/quota.
 * Files remain ephemeral client-side unless explicitly exported.
 */
export function trackUploadedFile(file: File | Blob, uploadContext: string = 'general', customName?: string) {
  // Disabled: No automatic uploads/caching of uploaded files to Firebase
  return;
}

export default CentralUploadService;
