import express from 'express';
import multer from 'multer';
import megaService from './megaService';
import { storageManager } from './storageManager';

const router = express.Router();

// Configure Multer for in-memory buffer handling for files up to 250MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024 // 250MB
  }
});

/**
 * POST /api/storage/upload
 * Centralized upload API using StorageManager with Automatic Failover
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

    const { userId, userName, userEmail, sourceFeature } = req.body;

    // Execute upload via StorageManager (with automatic failover)
    const uploadRes = await storageManager.uploadFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname || `upload_${Date.now()}`,
      mimeType: req.file.mimetype || 'application/octet-stream',
      category: 'other',
      userId: userId || (req.headers['x-user-id'] as string) || 'guest_user',
      userName: userName || (req.headers['x-user-name'] as string) || 'مستخدم'
    });

    // Also register record in local metadata cache
    const record = await megaService.registerStorageRecord({
      fileName: req.file.originalname || `upload_${Date.now()}`,
      fileSize: req.file.size || req.file.buffer.length,
      mimeType: req.file.mimetype || 'application/octet-stream',
      megaUrl: uploadRes.storageUrl,
      downloadUrl: uploadRes.downloadUrl,
      hash: uploadRes.hash,
      providerId: uploadRes.providerId,
      providerName: uploadRes.providerName,
      storageFileId: uploadRes.storageFileId,
      uploadedBy: {
        userId: userId || 'guest_user',
        userName: userName || 'مستخدم',
        userEmail: userEmail || ''
      },
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
      providerId: record.providerId,
      providerName: record.providerName,
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
 * GET /api/storage/providers
 * Fetch all registered storage providers and active status
 */
router.get('/providers', (req: express.Request, res: express.Response) => {
  try {
    const providers = storageManager.getProviders();
    return res.json({
      success: true,
      providers
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/providers
 * Register or update a storage provider config
 */
router.post('/providers', (req: express.Request, res: express.Response) => {
  try {
    const config = req.body;
    if (!config.id) {
      config.id = `prov_${Date.now()}`;
    }
    if (!config.createdAt) config.createdAt = new Date().toISOString();
    config.updatedAt = new Date().toISOString();

    const adapter = storageManager.registerProviderConfig(config);
    return res.json({
      success: true,
      provider: config,
      message: `تم حفظ وإعداد المزود (${adapter.name}) بنجاح!`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/providers/:id/test
 * Run 7-Step real diagnostic verification on a provider
 */
router.post('/providers/:id/test', async (req: express.Request, res: express.Response) => {
  try {
    const providerId = req.params.id;
    const customConfig = req.body;
    
    let config = customConfig && customConfig.id ? customConfig : storageManager.getProviders().find(p => p.id === providerId);
    if (!config) {
      return res.status(404).json({ success: false, message: 'المزود المطلوب غير موجود' });
    }

    const testResult = await storageManager.testProviderConfig(config);
    return res.json({
      success: true,
      result: testResult
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/providers/switch
 * Switch active primary provider
 */
router.post('/providers/switch', async (req: express.Request, res: express.Response) => {
  try {
    const { providerId } = req.body;
    await storageManager.setPrimaryProvider(providerId);
    return res.json({
      success: true,
      message: 'تم تحويل وتفعيل مزود التخزين الرئيسي بنجاح! الملفات القديمة تظل متصلة بمزودها الأصلي.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/providers/failover
 * Update failover settings
 */
router.post('/providers/failover', async (req: express.Request, res: express.Response) => {
  try {
    const { backupProviderId, failoverEnabled } = req.body;
    if (typeof failoverEnabled === 'boolean') {
      storageManager.setFailoverEnabled(failoverEnabled);
    }
    if (backupProviderId !== undefined) {
      await storageManager.setBackupProvider(backupProviderId);
    }
    return res.json({
      success: true,
      message: 'تم تحديث إعدادات التبديل التلقائي عند الفشل (Failover) بنجاح!'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/providers/auto-detect
 * Auto probe domain API
 */
router.post('/providers/auto-detect', async (req: express.Request, res: express.Response) => {
  try {
    const { targetUrl } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رابط الموقع أو الـ API' });
    }
    const result = await storageManager.autoDetectProvider(targetUrl);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/storage/migration/start
 * Start file migration between providers
 */
router.post('/migration/start', async (req: express.Request, res: express.Response) => {
  try {
    const { sourceProviderId, targetProviderId, filterMode, keepOriginalFiles } = req.body;
    if (!sourceProviderId || !targetProviderId) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المزود المصدر والمزود الهدف' });
    }
    const job = await storageManager.startMigration(sourceProviderId, targetProviderId, {
      filterMode,
      keepOriginalFiles
    });
    return res.json({
      success: true,
      job,
      message: 'تم بدء عملية نقل الملفات بنجاح!'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/storage/migration/status
 * Get current migration progress
 */
router.get('/migration/status', (req: express.Request, res: express.Response) => {
  const job = storageManager.getMigrationStatus();
  return res.json({
    success: true,
    job
  });
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
    const fileId = req.params.id;
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
 * Delete file from MEGA & Registry
 */
router.delete('/files/:id', async (req: express.Request, res: express.Response) => {
  try {
    const fileId = req.params.id;
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
 * Return storage provider configuration & folder url
 */
router.get('/settings', (req: express.Request, res: express.Response) => {
  try {
    const settings = megaService.getSettings();
    return res.json({
      success: true,
      settings
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
 * Update storage folder URL, credentials or folder configuration
 */
router.post('/settings', (req: express.Request, res: express.Response) => {
  try {
    const { folderUrl, folderName, megaEmail, megaPassword } = req.body;
    const settings = megaService.updateSettings({
      folderUrl,
      folderName,
      email: megaEmail,
      password: megaPassword
    });

    return res.json({
      success: true,
      settings,
      message: 'تم حفظ وتحديث رابط مجلد التخزين بنجاح!'
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
 * Real-time diagnostic test of MEGA credentials and upload
 */
router.post('/test-connection', async (req: express.Request, res: express.Response) => {
  try {
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
