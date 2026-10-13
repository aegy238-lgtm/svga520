import express from 'express';
import multer from 'multer';
import path from 'path';
import megaService from './megaService';

const router = express.Router();

// Configure Multer for in-memory buffer handling for files up to 250MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024 // 250MB
  }
});

// Dangerous file extensions blacklist to protect against web shells & malware
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.jsp', '.asp', '.aspx', '.cgi', '.pl', '.py', '.js', '.mjs', '.vbs',
  '.msi', '.jar', '.html', '.htm', '.xhtml', '.svgz', '.scr', '.dll', '.com'
]);

function isDangerousFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(ext);
}

function sanitizeFilename(filename: string): string {
  // Strip null bytes and directory traversal characters
  const clean = filename.replace(/\0/g, '').replace(/\.\.+[/\\]/g, '');
  return clean.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_').substring(0, 200);
}

function checkAdminAuth(req: express.Request): boolean {
  const email = ((req.body?.userEmail || req.headers['x-user-email'] || '') as string).toLowerCase().trim();
  const adminKey = req.headers['x-admin-key'] as string;
  const adminSecret = process.env.ADMIN_SECRET || 'svga_sec_adm_9912499987';
  
  const MASTER_EMAILS = ['aegy238@gmail.com', 'uhbijnokmpl098900@gmail.com', 'iejehdgdig@gmail.com'];
  if (MASTER_EMAILS.includes(email) && (req.headers['authorization'] || req.headers['x-auth-verified'] === 'true')) {
    return true;
  }
  if (adminKey && adminKey === adminSecret) {
    return true;
  }
  return false;
}

/**
 * POST /api/storage/upload
 * Centralized upload API with strict validation and dangerous file rejection
 */
router.post('/upload', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE_PROVIDED',
        message: 'يرجى تقديم ملف صالح للرفع.'
      });
    }

    const originalName = req.file.originalname || `upload_${Date.now()}`;
    
    // Security check: Block dangerous executable and script files
    if (isDangerousFile(originalName)) {
      return res.status(400).json({
        success: false,
        error: 'DANGEROUS_FILE_TYPE_BLOCKED',
        message: 'نوع الملف غير مسموح به لأسباب أمنية. تم حظر رفع الملفات التنفيذية والبرمجية.'
      });
    }

    const safeName = sanitizeFilename(originalName);
    const { userId, userName, userEmail, sourceFeature } = req.body;

    const record = await megaService.uploadFile({
      buffer: req.file.buffer,
      fileName: safeName || `upload_${Date.now()}`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      userId: userId || (req.headers['x-user-id'] as string) || 'guest_user',
      userName: userName || (req.headers['x-user-name'] as string) || 'مستخدم',
      userEmail: userEmail || (req.headers['x-user-email'] as string) || '',
      sourceFeature: sourceFeature || 'central_uploader'
    });

    return res.json({
      success: true,
      fileId: record.fileId,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      category: record.category,
      megaUrl: record.megaUrl,
      downloadUrl: record.downloadUrl,
      hash: record.hash,
      isDuplicate: record.isDuplicate || false,
      record
    });
  } catch (error: any) {
    console.error('Storage upload route error:', error);
    return res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'فشل رفع الملف إلى التخزين السحابي.'
    });
  }
});

/**
 * GET /api/storage/files
 * Fetch paginated files with search and filtering
 */
router.get('/files', (req: express.Request, res: express.Response) => {
  try {
    const search = req.query.search as string;
    const category = req.query.category as string;
    const userId = req.query.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = (req.query.sortBy as any) || 'uploadedAt';
    const sortOrder = (req.query.sortOrder as any) || 'desc';

    const result = megaService.queryFiles({
      search,
      category,
      userId,
      page,
      limit,
      sortBy,
      sortOrder
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Storage list route error:', error);
    return res.status(500).json({
      success: false,
      error: 'QUERY_FAILED',
      message: error.message || 'فشل جلب قائمة الملفات.'
    });
  }
});

/**
 * GET /api/storage/download/:id
 * Streams file from MEGA or local disk cache
 */
router.get('/download/:id', async (req: express.Request, res: express.Response) => {
  try {
    const fileId = String(req.params.id);
    const downloadData = await megaService.getDownloadStream(fileId);

    if (!downloadData) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'الملف المطلوب غير موجود أو تم حذفه.'
      });
    }

    const { stream, record, isStreamFromMega } = downloadData;

    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalName || record.fileName)}"`);
    if (record.fileSize) {
      res.setHeader('Content-Length', record.fileSize);
    }
    res.setHeader('X-Storage-Provider', 'MEGA');
    res.setHeader('X-Storage-Source', isStreamFromMega ? 'MEGA_CLOUD' : 'LOCAL_CACHE');

    stream.on('error', (err: any) => {
      console.error('Error during file stream delivery:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'STREAM_FAILED', message: 'فشل إرسال تدفق الملف للمستخدم.' });
      }
    });

    stream.pipe(res);
  } catch (error: any) {
    console.error('Storage download route error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'DOWNLOAD_FAILED',
        message: error.message || 'حدث خطأ أثناء تنزيل الملف.'
      });
    }
  }
});

/**
 * DELETE /api/storage/files/:id
 * Delete file from MEGA & Registry (Protected)
 */
router.delete('/files/:id', async (req: express.Request, res: express.Response) => {
  try {
    const fileId = String(req.params.id);
    const isAuthorized = checkAdminAuth(req);
    
    // Non-admin can only delete if they own the file
    if (!isAuthorized) {
      const fileRecord = megaService.getFileRecord(fileId);
      const requesterId = (req.headers['x-user-id'] || req.body?.userId) as string;
      if (!fileRecord || !requesterId || fileRecord.userId !== requesterId) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'ليس لديك صلاحية لحذف هذا الملف.'
        });
      }
    }

    const deleted = await megaService.deleteFile(fileId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'الملف المراد حذفه غير موجود.'
      });
    }

    return res.json({
      success: true,
      message: 'تم حذف الملف بنجاح من التخزين وسجل البيانات.'
    });
  } catch (error: any) {
    console.error('Storage delete route error:', error);
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'فشل حذف الملف.'
    });
  }
});

/**
 * GET /api/storage/stats
 * Return overall storage analytics & category usage
 */
router.get('/stats', (req: express.Request, res: express.Response) => {
  try {
    const stats = megaService.getStats();
    return res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Storage stats route error:', error);
    return res.status(500).json({
      success: false,
      error: 'STATS_FAILED',
      message: error.message || 'فشل جلب إحصائيات التخزين.'
    });
  }
});

/**
 * GET /api/storage/settings
 * Return storage provider configuration & folder url (Sanitized, password never exposed)
 */
router.get('/settings', (req: express.Request, res: express.Response) => {
  try {
    const settings = megaService.getSettings();
    // Sanitize password from public read
    const safeSettings = {
      ...settings,
      password: settings.password ? '••••••••' : ''
    };
    return res.json({
      success: true,
      settings: safeSettings
    });
  } catch (error: any) {
    console.error('Storage settings route error:', error);
    return res.status(500).json({
      success: false,
      error: 'SETTINGS_FAILED',
      message: error.message || 'فشل جلب إعدادات التخزين.'
    });
  }
});

/**
 * POST /api/storage/settings
 * Update storage folder URL, credentials or folder configuration (Admin Only)
 */
router.post('/settings', (req: express.Request, res: express.Response) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'صلاحيات المدير مطلوبة لتعديل إعدادات التخزين السحابي.'
      });
    }

    const { folderUrl, folderName, megaEmail, megaPassword } = req.body;
    const settings = megaService.updateSettings({
      folderUrl,
      folderName,
      email: megaEmail,
      password: megaPassword
    });

    return res.json({
      success: true,
      settings: {
        ...settings,
        password: settings.password ? '••••••••' : ''
      },
      message: 'تم حفظ وتحديث إعدادات التخزين بنجاح!'
    });
  } catch (error: any) {
    console.error('Storage settings update error:', error);
    return res.status(500).json({
      success: false,
      error: 'UPDATE_SETTINGS_FAILED',
      message: error.message || 'فشل تحديث إعدادات التخزين.'
    });
  }
});

/**
 * POST /api/storage/test-connection
 * Real-time diagnostic test of MEGA credentials and upload (Admin Only)
 */
router.post('/test-connection', async (req: express.Request, res: express.Response) => {
  try {
    if (!checkAdminAuth(req)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'صلاحيات المدير مطلوبة لإجراء فحص الاتصال.'
      });
    }

    const result = await megaService.testConnection();
    return res.json(result);
  } catch (error: any) {
    console.error('Storage test-connection route error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'فشل اختبار الاتصال بخادم MEGA.',
      errorDetails: String(error)
    });
  }
});

export default router;
