import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { 
  isR2Configured, 
  uploadBufferToR2, 
  uploadLocalFileToR2, 
  deleteR2Object, 
  getR2PresignedDownloadUrl,
  getR2Config 
} from './r2Storage';

const router = express.Router();

// Ensure cache storage directories exist
const CACHE_BASE_DIR = path.join(process.cwd(), 'uploads', 'cache');
const TEMP_CHUNKS_DIR = path.join(process.cwd(), 'uploads', 'cache_chunks');

if (!fs.existsSync(CACHE_BASE_DIR)) {
  fs.mkdirSync(CACHE_BASE_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_CHUNKS_DIR)) {
  fs.mkdirSync(TEMP_CHUNKS_DIR, { recursive: true });
}

// Memory / Disk upload configuration
const upload = multer({
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB max per single upload
  }
});

// Multipart Upload Sessions In-Memory Tracker
interface MultipartSession {
  uploadId: string;
  fileId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  source: string;
  totalParts: number;
  uploadedParts: Set<number>;
  createdAt: number;
  metadata?: Record<string, any>;
  callbackUrl?: string;
}

const activeMultipartSessions = new Map<string, MultipartSession>();

// In-Memory Activity & Stats store for high-speed backend telemetry
interface ServerCacheFileMeta {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  fileName: string;
  originalName: string;
  extension: string;
  category: string;
  mimeType: string;
  size: number;
  sha256: string;
  storageProvider: 'server' | 'r2' | 's3' | 'firebase';
  storagePath: string;
  storageKey?: string;
  fileUrl: string;
  downloadUrl: string;
  source: string;
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DELETED' | 'EXPIRED' | 'active';
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  downloadCount: number;
  metadata?: Record<string, any>;
}

const serverCachedFiles = new Map<string, ServerCacheFileMeta>();

// Auto category detector
function detectCategory(filename: string, mimeType: string = ''): string {
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

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function generateFileId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `cf_${timestamp}_${randomStr}`;
}

// Clean old multipart sessions (> 24 hours)
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, session] of activeMultipartSessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      const sessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      activeMultipartSessions.delete(uploadId);
    }
  }
}, 30 * 60 * 1000);

// ==========================================
// 1. Direct Single Upload API
// POST /api/cache/upload
// ==========================================
router.post('/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'FILE_REQUIRED', message: 'لم يتم إرسال أي ملف' });
    }

    const userId = (req.body.userId || req.headers['x-user-id'] || 'anonymous').toString();
    const userName = req.body.userName || 'مستخدم';
    const userEmail = req.body.userEmail || '';
    const source = req.body.source || req.body.sourceFeature || 'Central Cache API';
    const customName = req.body.customName || file.originalname || `cache_file_${Date.now()}`;
    const rawFileName = customName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = rawFileName.includes('.') ? rawFileName.split('.').pop()?.toLowerCase() || '' : '';
    const mimeType = file.mimetype || 'application/octet-stream';
    const category = detectCategory(rawFileName, mimeType);

    // Compute SHA-256 Hash
    const sha256 = calculateSha256(file.buffer);

    // Duplicate Check
    const allowDuplicates = req.body.allowDuplicates === 'true' || req.body.allowDuplicates === true;
    if (!allowDuplicates) {
      for (const existing of serverCachedFiles.values()) {
        if (existing.userId === userId && existing.sha256 === sha256 && existing.status !== 'DELETED') {
          return res.json({
            success: true,
            isDuplicate: true,
            message: 'الملف موجود مسبقاً في الكاش',
            file: existing
          });
        }
      }
    }

    // Save File Object to Cloudflare R2 or Server Storage
    const fileId = generateFileId();
    const storageFileName = `${fileId}_${rawFileName}`;
    const userDir = path.join(CACHE_BASE_DIR, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const finalFilePath = path.join(userDir, storageFileName);
    fs.writeFileSync(finalFilePath, file.buffer);

    let storageProvider: 'server' | 'r2' | 's3' | 'firebase' = 'server';
    let r2DirectUrl: string | undefined = undefined;
    const storageKey = `user_cache/${userId}/${storageFileName}`;

    // Upload to Cloudflare R2 if configured
    if (isR2Configured()) {
      try {
        const r2Result = await uploadBufferToR2(storageKey, file.buffer, mimeType, {
          userId,
          fileId,
          originalName: encodeURIComponent(file.originalname || rawFileName)
        });
        storageProvider = 'r2';
        r2DirectUrl = r2Result.publicUrl;
      } catch (r2Err) {
        console.warn('[Cache API] Cloudflare R2 upload fallback to local server:', r2Err);
      }
    }

    const origin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const fileUrl = r2DirectUrl || `${origin}/api/cache/file/${fileId}`;
    const downloadUrl = `${origin}/api/cache/file/${fileId}/download`;

    const cacheRecord: ServerCacheFileMeta = {
      id: fileId,
      userId,
      userName,
      userEmail,
      fileName: rawFileName,
      originalName: file.originalname || rawFileName,
      extension,
      category,
      mimeType,
      size: file.size,
      sha256,
      storageProvider,
      storagePath: path.relative(process.cwd(), finalFilePath),
      storageKey,
      fileUrl,
      downloadUrl,
      source,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadCount: 0,
      metadata: req.body.metadata ? (typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata) : undefined
    };

    serverCachedFiles.set(fileId, cacheRecord);

    // Return Complete Response
    return res.status(201).json({
      success: true,
      fileId,
      file: cacheRecord
    });
  } catch (error: any) {
    console.error('[Cache API] Upload error:', error);
    return res.status(500).json({ error: 'CACHE_UPLOAD_FAILED', message: error.message });
  }
});

// ==========================================
// 2. Multipart / Chunk Upload Endpoints
// ==========================================

// POST /api/cache/multipart/init
router.post('/multipart/init', async (req: express.Request, res: express.Response) => {
  try {
    const { fileName, fileSize, mimeType, userId, userName, userEmail, source, totalParts, metadata, callbackUrl } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: 'PARAM_MISSING', message: 'اسم الملف وحجمه مطلوبان' });
    }

    const cleanUserId = (userId || req.headers['x-user-id'] || 'anonymous').toString();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadId = `mp_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
    const fileId = generateFileId();
    const chunkSize = 5 * 1024 * 1024; // 5 MB optimal chunk size
    const partsCount = totalParts || Math.ceil(Number(fileSize) / chunkSize);

    // Create session dir
    const sessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const session: MultipartSession = {
      uploadId,
      fileId,
      userId: cleanUserId,
      userName: userName || 'مستخدم',
      userEmail: userEmail || '',
      fileName: cleanFileName,
      originalName: fileName,
      fileSize: Number(fileSize),
      mimeType: mimeType || 'application/octet-stream',
      source: source || 'Multipart Cache API',
      totalParts: partsCount,
      uploadedParts: new Set<number>(),
      createdAt: Date.now(),
      metadata,
      callbackUrl
    };

    activeMultipartSessions.set(uploadId, session);

    return res.json({
      success: true,
      uploadId,
      fileId,
      chunkSize,
      totalParts: partsCount,
      expiresIn: 86400
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'MULTIPART_INIT_ERROR', message: err.message });
  }
});

// POST /api/cache/multipart/part
router.post('/multipart/part', upload.single('chunk'), async (req: express.Request, res: express.Response) => {
  try {
    const uploadId = req.body.uploadId;
    const partNumber = parseInt(req.body.partNumber, 10);
    const chunk = req.file;

    if (!uploadId || isNaN(partNumber) || !chunk) {
      return res.status(400).json({ error: 'INVALID_PART_REQUEST', message: 'بيانات الجزء غير مكتملة' });
    }

    const session = activeMultipartSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ error: 'SESSION_EXPIRED', message: 'جلسة الرفع غير موجودة أو انتهت صلاحيتها' });
    }

    const sessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    const partFilePath = path.join(sessionDir, `part_${partNumber.toString().padStart(5, '0')}`);
    fs.writeFileSync(partFilePath, chunk.buffer);

    const partHash = calculateSha256(chunk.buffer);
    session.uploadedParts.add(partNumber);

    return res.json({
      success: true,
      uploadId,
      partNumber,
      partHash,
      uploadedPartsCount: session.uploadedParts.size,
      totalParts: session.totalParts
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'PART_UPLOAD_FAILED', message: err.message });
  }
});

// POST /api/cache/multipart/complete
router.post('/multipart/complete', async (req: express.Request, res: express.Response) => {
  try {
    const { uploadId } = req.body;
    const session = activeMultipartSessions.get(uploadId);

    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'جلسة الرفع غير متوفرة' });
    }

    const sessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    const userDir = path.join(CACHE_BASE_DIR, session.userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const storageFileName = `${session.fileId}_${session.fileName}`;
    const finalFilePath = path.join(userDir, storageFileName);

    // Merge chunks sequentially
    const writeStream = fs.createWriteStream(finalFilePath);
    const hash = crypto.createHash('sha256');

    for (let p = 1; p <= session.totalParts; p++) {
      const partFilePath = path.join(sessionDir, `part_${p.toString().padStart(5, '0')}`);
      if (!fs.existsSync(partFilePath)) {
        writeStream.close();
        return res.status(400).json({
          error: 'MISSING_PART',
          message: `الجزء رقم ${p} مفقود، يرجى إعادة رفعه`,
          missingPart: p
        });
      }

      const chunkBuffer = fs.readFileSync(partFilePath);
      writeStream.write(chunkBuffer);
      hash.update(chunkBuffer);
    }

    writeStream.end();

    const finalSha256 = hash.digest('hex');

    // Clean up temporary chunks
    fs.rmSync(sessionDir, { recursive: true, force: true });
    activeMultipartSessions.delete(uploadId);

    const origin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const storageKey = `user_cache/${session.userId}/${storageFileName}`;
    let storageProvider: 'server' | 'r2' | 's3' | 'firebase' = 'server';
    let r2DirectUrl: string | undefined = undefined;

    // Upload merged file to Cloudflare R2 if configured
    if (isR2Configured()) {
      try {
        const r2Result = await uploadLocalFileToR2(storageKey, finalFilePath, session.mimeType, {
          userId: session.userId,
          fileId: session.fileId,
          originalName: encodeURIComponent(session.originalName || session.fileName)
        });
        storageProvider = 'r2';
        r2DirectUrl = r2Result.publicUrl;
      } catch (r2Err) {
        console.warn('[Cache API] Multipart Cloudflare R2 upload fallback to local server:', r2Err);
      }
    }

    const fileUrl = r2DirectUrl || `${origin}/api/cache/file/${session.fileId}`;
    const downloadUrl = `${origin}/api/cache/file/${session.fileId}/download`;
    const extension = session.fileName.includes('.') ? session.fileName.split('.').pop()?.toLowerCase() || '' : '';
    const category = detectCategory(session.fileName, session.mimeType);

    const cacheRecord: ServerCacheFileMeta = {
      id: session.fileId,
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      fileName: session.fileName,
      originalName: session.originalName,
      extension,
      category,
      mimeType: session.mimeType,
      size: session.fileSize,
      sha256: finalSha256,
      storageProvider,
      storagePath: path.relative(process.cwd(), finalFilePath),
      storageKey,
      fileUrl,
      downloadUrl,
      source: session.source,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadCount: 0,
      metadata: session.metadata
    };

    serverCachedFiles.set(session.fileId, cacheRecord);

    // Webhook Callback dispatch if configured
    if (session.callbackUrl) {
      try {
        fetch(session.callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'CACHE_UPLOAD_COMPLETED',
            fileId: session.fileId,
            url: fileUrl,
            downloadUrl,
            sha256: finalSha256,
            size: session.fileSize,
            status: 'completed'
          })
        }).catch(() => {});
      } catch (e) {}
    }

    return res.json({
      success: true,
      fileId: session.fileId,
      file: cacheRecord
    });
  } catch (err: any) {
    console.error('[Multipart Complete Error]:', err);
    return res.status(500).json({ error: 'MULTIPART_COMPLETE_FAILED', message: err.message });
  }
});

// POST /api/cache/multipart/abort
router.post('/multipart/abort', (req: express.Request, res: express.Response) => {
  const { uploadId } = req.body;
  if (uploadId) {
    const sessionDir = path.join(TEMP_CHUNKS_DIR, uploadId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    activeMultipartSessions.delete(uploadId);
  }
  return res.json({ success: true, message: 'تم إلغاء جلسة الرفع وحذف الأجزاء المؤقتة' });
});

// ==========================================
// 3. File Serving & Download Stream API
// ==========================================
const serveCacheFile = (req: express.Request, res: express.Response, forceDownload: boolean) => {
  const fileId = req.params.fileId;
  const meta = serverCachedFiles.get(fileId);

  // Search disk if not in memory
  let targetFilePath: string | null = null;
  let fileName = 'file';
  let mimeType = 'application/octet-stream';

  if (meta && meta.storagePath && fs.existsSync(meta.storagePath)) {
    targetFilePath = meta.storagePath;
    fileName = meta.originalName || meta.fileName;
    mimeType = meta.mimeType || 'application/octet-stream';
  } else {
    // Search recursively in CACHE_BASE_DIR
    const searchRecursive = (dir: string): string | null => {
      if (!fs.existsSync(dir)) return null;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const found = searchRecursive(full);
          if (found) return found;
        } else if (entry.name.startsWith(fileId)) {
          return full;
        }
      }
      return null;
    };
    targetFilePath = searchRecursive(CACHE_BASE_DIR);
    if (targetFilePath) {
      fileName = path.basename(targetFilePath).replace(new RegExp(`^${fileId}_`), '');
    }
  }

  if (!targetFilePath || !fs.existsSync(targetFilePath)) {
    return res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'الملف غير موجود في الكاش' });
  }

  const stat = fs.statSync(targetFilePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Accept-Ranges', 'bytes');

  if (forceDownload) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(targetFilePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
    });
    fs.createReadStream(targetFilePath).pipe(res);
  }

  if (meta) {
    meta.downloadCount = (meta.downloadCount || 0) + 1;
  }
};

router.get('/file/:fileId', (req, res) => serveCacheFile(req, res, false));
router.get('/file/:fileId/download', (req, res) => serveCacheFile(req, res, true));

// ==========================================
// 4. File List & Stats Query Endpoints
// ==========================================
router.get('/files', (req: express.Request, res: express.Response) => {
  const { userId, category, source, search, limit = 100 } = req.query;
  let result = Array.from(serverCachedFiles.values()).filter(f => f.status !== 'DELETED');

  if (userId && userId !== 'all') {
    result = result.filter(f => f.userId === userId);
  }
  if (category && category !== 'all') {
    result = result.filter(f => f.category === category);
  }
  if (source && source !== 'all') {
    result = result.filter(f => (f.source || '').toLowerCase().includes(source.toString().toLowerCase()));
  }
  if (search) {
    const q = search.toString().toLowerCase().trim();
    result = result.filter(f => 
      f.fileName.toLowerCase().includes(q) || 
      f.id.toLowerCase().includes(q) || 
      (f.userName || '').toLowerCase().includes(q)
    );
  }

  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.json({
    success: true,
    total: result.length,
    files: result.slice(0, Number(limit))
  });
});

// GET /api/cache/stats
router.get('/stats', (req: express.Request, res: express.Response) => {
  const activeFiles = Array.from(serverCachedFiles.values()).filter(f => f.status !== 'DELETED');
  const totalSizeBytes = activeFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const userSet = new Set(activeFiles.map(f => f.userId));

  const categoryCounts: Record<string, number> = {
    svga: 0,
    vap: 0,
    video: 0,
    image: 0,
    audio: 0,
    pag: 0,
    json: 0,
    other: 0
  };

  const topSources: Record<string, number> = {};

  const todayStr = new Date().toISOString().slice(0, 10);
  let todayUploadsCount = 0;

  for (const f of activeFiles) {
    categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    topSources[f.source || 'General'] = (topSources[f.source || 'General'] || 0) + 1;
    if (f.createdAt.startsWith(todayStr)) {
      todayUploadsCount++;
    }
  }

  const r2Active = isR2Configured();

  return res.json({
    success: true,
    stats: {
      totalFiles: activeFiles.length,
      totalSizeBytes,
      activeCacheUsersCount: userSet.size,
      todayUploadsCount,
      categoryCounts,
      topSources,
      storageProvider: r2Active ? 'Cloudflare R2 (10GB Free + Zero Egress CDN)' : 'High-Speed Object Storage'
    }
  });
});

// POST /api/cache/cleanup
router.post('/cleanup', async (req: express.Request, res: express.Response) => {
  const { retentionDays = 30 } = req.body;
  const days = Number(retentionDays);
  if (days <= 0) {
    return res.status(400).json({ error: 'INVALID_RETENTION', message: 'مدة الاحتفاظ غير صالحة' });
  }

  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  let deletedCount = 0;
  let freedBytes = 0;

  for (const [id, f] of serverCachedFiles.entries()) {
    const created = new Date(f.createdAt).getTime();
    if (created < cutoff) {
      if (f.storagePath && fs.existsSync(f.storagePath)) {
        try {
          fs.unlinkSync(f.storagePath);
          freedBytes += f.size || 0;
        } catch (e) {}
      }
      if (f.storageKey && isR2Configured()) {
        try {
          await deleteR2Object(f.storageKey);
        } catch (e) {}
      }
      f.status = 'EXPIRED';
      deletedCount++;
    }
  }

  return res.json({
    success: true,
    message: `تم تنظيف ${deletedCount} ملف بنجاح وتحرير ${Math.round(freedBytes / (1024 * 1024))} ميجابايت`,
    deletedCount,
    freedBytes
  });
});

// DELETE /api/cache/file/:fileId
router.delete('/file/:fileId', async (req: express.Request, res: express.Response) => {
  const fileId = req.params.fileId;
  const meta = serverCachedFiles.get(fileId);

  if (meta) {
    if (meta.storagePath && fs.existsSync(meta.storagePath)) {
      try {
        fs.unlinkSync(meta.storagePath);
      } catch (e) {}
    }
    if (meta.storageKey && isR2Configured()) {
      try {
        await deleteR2Object(meta.storageKey);
      } catch (e) {}
    }
    meta.status = 'DELETED';
    serverCachedFiles.delete(fileId);
  }

  return res.json({ success: true, message: 'تم حذف الملف من الكاش بنجاح' });
});

export default router;
