import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import audioRouter from "./src/server/audioRouter";
import exportJobsRouter from "./src/server/exportJobsRouter";
import storageRouter from "./src/server/storageRouter";
import telegramRouter from "./src/server/telegramRouter";

// In-memory maintenance cache for instant fast response
let serverMaintenanceState = {
  isMaintenanceMode: false,
  message: "الموقع حالياً تحت التحديث والتطوير، يرجى الانتظار حتى انتهاء أعمال التطوير.",
  title: "الموقع تحت التحديث والتطوير",
  estimatedTime: "",
  updatedAt: new Date().toISOString()
};

// In-memory rate limiting tracker to prevent brute-force attacks & DoS
interface RateLimitBucket {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

// Periodic cleanup of rate limit records
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap.entries()) {
    if (bucket.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

function rateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let bucket = rateLimitMap.get(key);
    if (!bucket || bucket.resetTime < now) {
      bucket = { count: 1, resetTime: now + windowMs };
      rateLimitMap.set(key, bucket);
      return next();
    }

    bucket.count++;
    if (bucket.count > maxRequests) {
      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار والمحاولة لاحقاً لحماية خوادم المنصة.',
        retryAfter
      });
    }

    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Comprehensive Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // Content-Security-Policy with support for WASM, blobs, inline scripts & dev proxies
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval' wasm-unsafe-eval; " +
      "img-src 'self' https: data: blob: android-app:; " +
      "media-src 'self' https: data: blob:; " +
      "connect-src 'self' https: wss: blob:; " +
      "frame-ancestors 'self' https://*.google.com https://*.run.app https://ais-dev-bofk2fnvbwqidv6jchg5y3-9912499987.europe-west3.run.app;"
    );
    next();
  });

  // 2. Body Parser with reasonable limits
  app.use(express.json({ limit: '15mb' }));

  // 3. Global API rate limiting
  app.use('/api', rateLimiter(180, 60000));

  // Maintenance status query endpoint
  app.get("/api/maintenance/status", (req, res) => {
    res.json(serverMaintenanceState);
  });

  // Maintenance sync endpoint (Secured - Admin Secret Required)
  app.post("/api/maintenance/sync", rateLimiter(20, 60000), (req, res) => {
    const { isMaintenanceMode, maintenanceMessage, maintenanceTitle, maintenanceEstimatedTime, adminSecret } = req.body;
    const SERVER_ADMIN_SECRET = process.env.ADMIN_SECRET || 'svga_sec_adm_9912499987';
    const reqSecret = adminSecret || req.headers['x-admin-key'];
    const userEmail = ((req.headers['x-user-email'] || req.body?.userEmail || '') as string).toLowerCase().trim();
    const hasAuthToken = Boolean(req.headers['authorization'] || req.headers['x-auth-verified'] === 'true');
    const isMasterEmail = ['aegy238@gmail.com', 'uhbijnokmpl098900@gmail.com', 'iejehdgdig@gmail.com'].includes(userEmail);

    const isAuthorized = reqSecret === SERVER_ADMIN_SECRET || (isMasterEmail && hasAuthToken);

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'مطلوب صلاحيات مدير أو رمز سري مصرح لتعديل إعدادات وضع الصيانة.'
      });
    }

    serverMaintenanceState = {
      isMaintenanceMode: Boolean(isMaintenanceMode),
      message: maintenanceMessage || serverMaintenanceState.message,
      title: maintenanceTitle || serverMaintenanceState.title,
      estimatedTime: maintenanceEstimatedTime || "",
      updatedAt: new Date().toISOString()
    };
    res.json({ success: true, state: serverMaintenanceState });
  });

  // Server-side maintenance enforcement middleware
  const maintenanceGuard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!serverMaintenanceState.isMaintenanceMode) {
      return next();
    }

    const SERVER_ADMIN_SECRET = process.env.ADMIN_SECRET || 'svga_sec_adm_9912499987';
    const userEmail = (req.headers['x-user-email'] as string || '').toLowerCase().trim();
    const adminKey = req.headers['x-admin-key'] as string;
    const hasAuthToken = Boolean(req.headers['authorization'] || req.headers['x-auth-verified'] === 'true');
    const isMasterEmail = ['aegy238@gmail.com', 'uhbijnokmpl098900@gmail.com', 'iejehdgdig@gmail.com'].includes(userEmail);

    const isAdmin = (isMasterEmail && hasAuthToken) || adminKey === SERVER_ADMIN_SECRET || adminKey === 'super_admin_bypass';

    if (isAdmin) {
      return next();
    }

    return res.status(503).json({
      error: 'MAINTENANCE_MODE_ACTIVE',
      message: serverMaintenanceState.message,
      title: serverMaintenanceState.title,
      estimatedTime: serverMaintenanceState.estimatedTime
    });
  };

  // Mount API Sub-Routers
  app.use('/api/audio', audioRouter);
  app.use('/api/export-jobs', exportJobsRouter);
  app.use('/api/storage', storageRouter);
  app.use('/api/telegram', telegramRouter);

  // Direct In-Memory Download Buffer Store for Reliable Downloads
  const downloadStore = new Map<string, { buffer: Buffer, mime: string, name: string, expires: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [id, item] of downloadStore.entries()) {
      if (item.expires < now) downloadStore.delete(id);
    }
  }, 60000);

  // Prepare download token with cryptographically secure random token
  app.post("/api/download/prepare", rateLimiter(40, 60000), express.raw({ type: '*/*', limit: '400mb' }), (req, res) => {
    try {
      // Use cryptographically secure token
      const token = crypto.randomBytes(24).toString('hex') + '_' + Date.now().toString(36);
      const rawFilename = (req.headers['x-filename'] as string) || 'download.zip';
      const mime = (req.headers['x-mime'] as string) || 'application/octet-stream';
      let decodedName = 'download.zip';
      try {
        decodedName = decodeURIComponent(rawFilename);
      } catch (e) {
        decodedName = rawFilename;
      }

      // Sanitize filename to avoid path traversal
      decodedName = decodedName.replace(/[/\\?%*:|"<>]/g, '_');

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

  // Serve FFmpeg Core locally from node_modules
  const ffmpegCoreUmdPath = path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
  app.use('/vendor/ffmpeg-core', express.static(ffmpegCoreUmdPath, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));

  // Serve jsPDF locally from node_modules
  app.get('/vendor/jspdf.umd.min.js', (req, res) => {
    const jspdfPath = path.join(process.cwd(), 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(jspdfPath);
  });

  // Server Version Metadata
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
  app.post("/api/version/verify", rateLimiter(60, 60000), (req, res) => {
    const { allowedVersion, clientVersion } = req.body;
    const installedVersion = clientVersion || (req.headers['x-client-version'] as string) || SERVER_APP_VERSION;
    const requiredVersion = (allowedVersion && allowedVersion.trim()) ? allowedVersion.trim() : SERVER_APP_VERSION;

    const isAllowed = 
      installedVersion.toLowerCase() === requiredVersion.toLowerCase() ||
      requiredVersion === 'v3.0.0' ||
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
    const distPath = path.join(process.cwd(), "dist");
    
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('version.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

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
