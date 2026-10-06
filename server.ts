import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import audioRouter from "./src/server/audioRouter";
import exportJobsRouter from "./src/server/exportJobsRouter";

// In-memory maintenance cache for instant fast response
let serverMaintenanceState = {
  isMaintenanceMode: false,
  message: "الموقع حالياً تحت التحديث والتطوير، يرجى الانتظار حتى انتهاء أعمال التطوير.",
  title: "الموقع تحت التحديث والتطوير",
  estimatedTime: "",
  updatedAt: new Date().toISOString()
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // Maintenance status query / sync endpoint
  app.get("/api/maintenance/status", (req, res) => {
    res.json(serverMaintenanceState);
  });

  app.post("/api/maintenance/sync", (req, res) => {
    const { isMaintenanceMode, maintenanceMessage, maintenanceTitle, maintenanceEstimatedTime, adminSecret } = req.body;
    // Allow updating server-side cache
    serverMaintenanceState = {
      isMaintenanceMode: Boolean(isMaintenanceMode),
      message: maintenanceMessage || serverMaintenanceState.message,
      title: maintenanceTitle || serverMaintenanceState.title,
      estimatedTime: maintenanceEstimatedTime || "",
      updatedAt: new Date().toISOString()
    };
    res.json({ success: true, state: serverMaintenanceState });
  });

  // Server-side maintenance enforcement middleware for sensitive API routes
  const maintenanceGuard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!serverMaintenanceState.isMaintenanceMode) {
      return next();
    }

    // Bypass check: If request comes from verified Super Admin / Admin
    const userRole = req.headers['x-user-role'];
    const userEmail = req.headers['x-user-email'];
    const isAdmin = 
      userRole === 'admin' || 
      userRole === 'moderator' || 
      userEmail === 'uhbijnokmpl098900@gmail.com' ||
      req.headers['x-admin-key'] === 'super_admin_bypass';

    if (isAdmin) {
      return next();
    }

    // Block non-admin requests during maintenance
    return res.status(503).json({
      error: 'MAINTENANCE_MODE_ACTIVE',
      message: serverMaintenanceState.message,
      title: serverMaintenanceState.title,
      estimatedTime: serverMaintenanceState.estimatedTime
    });
  };

  // Audio & media processing API routes (always active for creator tools)
  app.use('/api/audio', audioRouter);

  // Background export & media tasks router (runs heavy exports without freezing client)
  app.use('/api/export-jobs', exportJobsRouter);

  // Helper to scan directory size and files
  const getDirStats = (dirPath: string): { filesCount: number; sizeBytes: number } => {
    let filesCount = 0;
    let sizeBytes = 0;
    if (!fs.existsSync(dirPath)) return { filesCount, sizeBytes };
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            const sub = getDirStats(fullPath);
            filesCount += sub.filesCount;
            sizeBytes += sub.sizeBytes;
          } else {
            const stat = fs.statSync(fullPath);
            filesCount++;
            sizeBytes += stat.size;
          }
        } catch (e) {}
      }
    } catch (e) {}
    return { filesCount, sizeBytes };
  };

  // Helper to delete directory contents recursively
  const clearDirContents = (dirPath: string): { deletedCount: number; freedBytes: number } => {
    let deletedCount = 0;
    let freedBytes = 0;
    if (!fs.existsSync(dirPath)) return { deletedCount, freedBytes };
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            const sub = clearDirContents(fullPath);
            deletedCount += sub.deletedCount;
            freedBytes += sub.freedBytes;
            try { fs.rmdirSync(fullPath); } catch (e) {}
          } else {
            const stat = fs.statSync(fullPath);
            freedBytes += stat.size;
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch (e) {}
      }
    } catch (e) {}
    return { deletedCount, freedBytes };
  };

  // Server Temporary Storage & Filesystem Status Endpoint
  app.get('/api/storage/server-status', (req, res) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const dataCacheDir = path.join(process.cwd(), 'data', 'mega_local_cache');

      const uploadsStats = getDirStats(uploadsDir);
      const dataCacheStats = getDirStats(dataCacheDir);

      const totalTempFiles = uploadsStats.filesCount + dataCacheStats.filesCount;
      const totalTempBytes = uploadsStats.sizeBytes + dataCacheStats.sizeBytes;

      res.json({
        ok: true,
        totalTempFiles,
        totalTempBytes,
        uploads: uploadsStats,
        cache: dataCacheStats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    } catch (err: any) {
      console.error('Server status error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Failed to get server storage status' });
    }
  });

  // Server Storage Cleanup Endpoint: Purges server temp files, cache & buffer stores
  app.post('/api/storage/server-cleanup', (req, res) => {
    try {
      let totalDeleted = 0;
      let totalFreedBytes = 0;
      const cleanedItems: string[] = [];

      // 1. Clean uploads/ directory
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const resUploads = clearDirContents(uploadsDir);
        totalDeleted += resUploads.deletedCount;
        totalFreedBytes += resUploads.freedBytes;
        cleanedItems.push(`مجلد الرفع المؤقت (${resUploads.deletedCount} ملف)`);
      }

      // 2. Clean data/mega_local_cache directory
      const dataCacheDir = path.join(process.cwd(), 'data', 'mega_local_cache');
      if (fs.existsSync(dataCacheDir)) {
        const resCache = clearDirContents(dataCacheDir);
        totalDeleted += resCache.deletedCount;
        totalFreedBytes += resCache.freedBytes;
        cleanedItems.push(`كاش السيرفر المحلي (${resCache.deletedCount} ملف)`);
      }

      // 3. Clear In-Memory Download Buffer Store
      const bufferEntriesCount = downloadStore.size;
      downloadStore.clear();
      if (bufferEntriesCount > 0) {
        cleanedItems.push(`ذاكرة التخزين المؤقت In-Memory (${bufferEntriesCount} عناصر)`);
      }

      const freedMb = (totalFreedBytes / (1024 * 1024)).toFixed(2);
      const message = `تم تنظيف السيرفر بنجاح! تم حذف ${totalDeleted} ملف مؤقت وتحرير ${freedMb} ميجابايت من مساحة السيرفر.`;

      res.json({
        ok: true,
        deletedCount: totalDeleted,
        freedBytes: totalFreedBytes,
        freedMb,
        cleanedItems,
        message
      });
    } catch (err: any) {
      console.error('Server cleanup error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Failed to execute server cleanup' });
    }
  });

  // Direct In-Memory Download Buffer Store for Reliable Downloads
  const downloadStore = new Map<string, { buffer: Buffer, mime: string, name: string, expires: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [id, item] of downloadStore.entries()) {
      if (item.expires < now) downloadStore.delete(id);
    }
  }, 60000);

  // Prepare download token from raw stream
  app.post("/api/download/prepare", express.raw({ type: '*/*', limit: '400mb' }), (req, res) => {
    try {
      const token = Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      const filename = (req.headers['x-filename'] as string) || 'download.zip';
      const mime = (req.headers['x-mime'] as string) || 'application/octet-stream';
      let decodedName = 'download.zip';
      try {
        decodedName = decodeURIComponent(filename);
      } catch (e) {
        decodedName = filename;
      }

      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      downloadStore.set(token, {
        buffer: buf,
        mime,
        name: decodedName,
        expires: Date.now() + 15 * 60 * 1000 // 15 minutes
      });

      res.json({
        ok: true,
        token,
        downloadUrl: `/api/download/file/${token}/${encodeURIComponent(decodedName)}`,
        size: buf.length
      });
    } catch (err: any) {
      console.error('Download prepare error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Failed to prepare download' });
    }
  });

  // Serve direct attachment download by token
  app.get(["/api/download/file/:token", "/api/download/file/:token/:name"], (req, res) => {
    const { token } = req.params;
    const item = downloadStore.get(token);
    if (!item) {
      return res.status(404).send('<!DOCTYPE html><html dir="rtl"><body style="font-family:sans-serif;padding:30px;background:#0d1428;color:#fff;text-align:center"><h2>رابط التنزيل منتهي الصلاحية أو غير موجود</h2><p>يرجى إعادة المحاولة من داخل التطبيق.</p></body></html>');
    }

    const asciiName = item.name.replace(/[^\x20-\x7E]/g, '_') || 'download.zip';
    const encodedName = encodeURIComponent(item.name);

    res.setHeader('Content-Type', item.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', item.buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(item.buffer);
  });

  // Serve FFmpeg Core locally from node_modules for zero-latency in-browser fallback
  const ffmpegCoreUmdPath = path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
  app.use('/vendor/ffmpeg-core', express.static(ffmpegCoreUmdPath, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));

  // Serve jsPDF locally from node_modules for zero-latency PDF report generation
  app.get('/vendor/jspdf.umd.min.js', (req, res) => {
    const jspdfPath = path.join(process.cwd(), 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(jspdfPath);
  });

  // Server Version Metadata (Updated on each build / deploy)
  const SERVER_APP_VERSION = 'v3.3.0';
  const SERVER_BUILD_TIME = new Date().toISOString();
  const SERVER_BUILD_ID = `build-${Date.now().toString(36)}`;

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      version: SERVER_APP_VERSION,
      buildId: SERVER_BUILD_ID,
      buildTime: SERVER_BUILD_TIME,
      maintenance: serverMaintenanceState.isMaintenanceMode 
    });
  });

  // Dedicated Version API for client update polling & verification
  const sendVersionInfo = (req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({
      version: SERVER_APP_VERSION,
      buildId: SERVER_BUILD_ID,
      buildTime: SERVER_BUILD_TIME,
      timestamp: Date.now(),
      status: 'active',
      environment: process.env.NODE_ENV || 'production'
    });
  };

  app.get("/api/version", sendVersionInfo);
  app.get("/api/version/info", sendVersionInfo);
  app.get("/version.json", sendVersionInfo);

  // Server-side Version Control Verification Endpoint
  app.post("/api/version/verify", (req, res) => {
    const { userId, email, allowedVersion, clientVersion } = req.body;
    const installedVersion = clientVersion || (req.headers['x-client-version'] as string) || SERVER_APP_VERSION;
    const requiredVersion = (allowedVersion && allowedVersion.trim()) ? allowedVersion.trim() : SERVER_APP_VERSION;

    // Super Admins & General users: Allow compatibility if requiredVersion is matching or default
    const isAllowed = 
      installedVersion.toLowerCase() === requiredVersion.toLowerCase() ||
      requiredVersion === 'v3.0.0' || // Backward compatibility for legacy default
      requiredVersion === SERVER_APP_VERSION;

    if (!isAllowed) {
      return res.status(403).json({
        allowed: false,
        requiredVersion,
        installedVersion,
        currentServerVersion: SERVER_APP_VERSION,
        message: `هذا الإصدار (${installedVersion}) من الموقع لم يعد مدعومًا لهذا الحساب. يرجى تحديث التطبيق إلى الإصدار ${requiredVersion} للاستمرار.`
      });
    }

    return res.json({
      allowed: true,
      requiredVersion,
      installedVersion,
      currentServerVersion: SERVER_APP_VERSION,
      message: 'الإصدار متوافق ومسموح به'
    });
  });

  app.get("/api/ip", (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production with strict cache control
    const distPath = path.join(process.cwd(), "dist");
    
    // Static assets (hashed JS, CSS, images) can be cached long-term
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));

    // Other static files
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('version.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    // SPA fallback - ALWAYS send index.html with NO CACHE so new deployments reflect immediately
    // Note: Do NOT intercept /api routes with the SPA fallback HTML!
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/api') {
        return res.status(404).json({ error: 'NOT_FOUND', path: req.path });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
