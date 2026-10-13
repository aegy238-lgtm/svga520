/**
 * Core Security Protection & Content Shield
 * 
 * Provides comprehensive client-side security hardening:
 * 1. Global Context Menu (Right-Click) Suppression across all current & future pages.
 * 2. Whitelists text inputs, textareas, and contenteditable elements to allow normal user typing/pasting.
 * 3. Mobile Long-Press Callout Suppression for images, videos, and preview canvases.
 * 4. Image/Video Drag-to-Desktop Prevention without breaking internal drag-and-drop UI.
 * 5. Keyboard Shortcut Protection (Ctrl+S / Cmd+S, Ctrl+U).
 * 6. Content selection protection on media assets while keeping inputs selectable.
 */

let shieldInitialized = false;
let toastTimeout: any = null;

// Disables default context menu except on designated text/editing fields
function handleContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Check if target or any parent is an allowed editable input
  const isInput = target.tagName === 'INPUT';
  const isTextarea = target.tagName === 'TEXTAREA';
  const isContentEditable = target.isContentEditable || target.getAttribute('contenteditable') === 'true';
  const isExplicitlyAllowed = Boolean(target.closest('[data-allow-context-menu="true"]'));

  if (isInput) {
    const inputEl = target as HTMLInputElement;
    const type = (inputEl.type || 'text').toLowerCase();
    // Allow right-click menu inside text fields for paste, cut, copy, spellcheck
    const textTypes = ['text', 'password', 'email', 'number', 'search', 'url', 'tel', 'date', 'time'];
    if (textTypes.includes(type)) {
      return;
    }
  }

  if (isTextarea || isContentEditable || isExplicitlyAllowed) {
    return;
  }

  // Prevent right-click context menu on all other elements (images, videos, canvases, modals, buttons, backgrounds)
  e.preventDefault();
  e.stopPropagation();

  // Show subtle non-intrusive notification to inform the user
  showSecurityToast();
}

// Shows a discrete floating badge indicating content protection
function showSecurityToast() {
  if (typeof document === 'undefined') return;

  let toast = document.getElementById('security-protection-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'security-protection-toast';
    toast.className = 'security-shield-toast';
    toast.setAttribute('dir', 'rtl');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      color: #f8fafc;
      border: 1px solid rgba(59, 130, 246, 0.4);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(59, 130, 246, 0.2);
      border-radius: 9999px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 999999;
      opacity: 0;
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    toast.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>تم تفعيل الحماية الأمنية لحفظ حقوق ومحتوى المنصة</span>
    `;
    document.body.appendChild(toast);
  }

  // Animate toast in
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(15px)';
    }
  }, 2200);
}

// Prevents accidental saving or inspecting via keyboard shortcuts
function handleKeyDown(e: KeyboardEvent) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;
  if (!isCtrlOrCmd) return;

  const target = e.target as HTMLElement | null;
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

  const key = e.key.toLowerCase();

  // Block Ctrl+S / Cmd+S (Save Page as HTML)
  if (key === 's') {
    e.preventDefault();
    return;
  }

  // Block Ctrl+U / Cmd+U (View Source)
  if (key === 'u' && !isInput) {
    e.preventDefault();
    return;
  }
}

// Prevents dragging media files (images, videos, canvases) to desktop/browser tabs
function handleDragStart(e: DragEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Allow intentional drag-and-drop elements that have data-allow-drag or draggable
  if (target.closest('[data-allow-drag="true"]') || target.closest('.dnd-item') || target.closest('.sortable-item')) {
    return;
  }

  const isMedia = target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'CANVAS';
  if (isMedia) {
    e.preventDefault();
  }
}

// Injects protective stylesheet to disable iOS callout and unwanted selection
function injectSecurityStyles() {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'app-security-protection-styles';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Protection against iOS long-press preview and unwanted selection on media */
    img, video, canvas, svg, .protected-media, .gift-preview, .svga-player-canvas {
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      user-select: none !important;
      -webkit-user-drag: none !important;
    }

    /* Preserve smooth selection and context interaction for inputs and text */
    input, textarea, [contenteditable="true"] {
      -webkit-touch-callout: default !important;
      -webkit-user-select: text !important;
      user-select: text !important;
    }

    /* Watermark / Anti-scraping helper utility class */
    .media-protected-wrapper {
      position: relative;
      user-select: none;
      -webkit-user-select: none;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initializes the full Application Security Shield.
 * Can be safely called multiple times (idempotent).
 */
export function initClientSecurityShield() {
  if (shieldInitialized || typeof window === 'undefined') return;
  shieldInitialized = true;

  // 1. Global contextmenu handler with capture phase
  window.addEventListener('contextmenu', handleContextMenu, { capture: true });

  // 2. Prevent keyboard source dump shortcuts
  window.addEventListener('keydown', handleKeyDown, { capture: true });

  // 3. Prevent dragging media files out
  window.addEventListener('dragstart', handleDragStart, { capture: true });

  // 4. Inject protective CSS rules
  injectSecurityStyles();

  console.log('[SecurityShield] Global protection active: Context menu, mobile callouts & asset theft safeguards enabled.');
}
