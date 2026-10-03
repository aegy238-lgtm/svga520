import React, { useEffect, useState } from 'react';
import { UserRecord, AppSettings } from '../types';

interface ScreenProtectionOverlayProps {
  currentUser: UserRecord | null;
  settings: AppSettings | null;
}

export const ScreenProtectionOverlay: React.FC<ScreenProtectionOverlayProps> = ({
  currentUser,
  settings,
}) => {
  const isProtectedUser = !currentUser?.isSuperAdmin && currentUser?.role !== 'admin';
  const screenshotProtected = !!(settings?.screenshotProtectionEnabled && isProtectedUser);
  const recordingProtected = !!(settings?.screenRecordingProtectionEnabled && isProtectedUser);
  const [isRecordingOrUnfocused, setIsRecordingOrUnfocused] = useState(false);

  useEffect(() => {
    if (!screenshotProtected && !recordingProtected) return;

    // 1. Prevent right-click context menu (blocks easy inspect & image saving)
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Overrides for Print screen, save, print keyboard shortcuts
    const preventShortcuts = (e: KeyboardEvent) => {
      // Prevent PrintScreen key
      if (e.key === 'PrintScreen') {
        alert('لقطات الشاشة غير مسموح بها لحماية حقوق المنصة المحتوى المحمي 🔒');
        e.preventDefault();
      }

      // Prevent Print (Ctrl + P)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        alert('الطباعة غير مسموح بها لحماية المحتوى 🔒');
        e.preventDefault();
      }

      // Prevent Save (Ctrl + S)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }

      // Prevent Inspect element shortcuts
      if (e.key === 'F12' || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j'))) {
        e.preventDefault();
      }
    };

    if (screenshotProtected) {
      window.addEventListener('contextmenu', preventContextMenu);
      window.addEventListener('keydown', preventShortcuts);
    }

    return () => {
      window.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('keydown', preventShortcuts);
    };
  }, [screenshotProtected, recordingProtected]);

  // 3. Screen Recording Protection (Window Blur / Visibility Detection)
  useEffect(() => {
    if (!recordingProtected) return;

    const handleWindowBlur = () => {
      // Blur when window loses focus (prevent background video recording or multi-window screenshares)
      setIsRecordingOrUnfocused(true);
    };

    const handleWindowFocus = () => {
      setIsRecordingOrUnfocused(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsRecordingOrUnfocused(true);
      } else {
        setIsRecordingOrUnfocused(false);
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [recordingProtected]);

  // Generate Repeating Watermark text
  const watermarkText = currentUser 
    ? `${currentUser.name || 'مستخدم'} • ${currentUser.email || ''} • ID: ${currentUser.numericId || currentUser.id?.slice(0, 8)}`
    : 'SVGA AHMED STUDIO';

  return (
    <>
      {/* Print protection styles */}
      {screenshotProtected && (
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body {
              display: none !important;
              background: #000000 !important;
            }
          }
          /* Custom anti-selection and secure canvas */
          .secure-workspace-area {
            user-select: none !important;
            -webkit-user-select: none !important;
            -ms-user-select: none !important;
          }
        `}} />
      )}

      {/* Screen blur overlay if unfocused during recording protection */}
      {recordingProtected && isRecordingOrUnfocused && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/90 backdrop-blur-3xl flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-white text-lg font-black mb-2">تم حجب الشاشة لحماية الخصوصية 🔒</h2>
          <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
            تفعيل حماية تسجيل الشاشة يمنع استعراض المحتوى الحساس عند عدم التفاعل المباشر مع واجهة الموقع.
          </p>
        </div>
      )}

      {/* Watermark Grid Layer */}
      {screenshotProtected && currentUser && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none opacity-[0.04]">
          <div className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-24 gap-x-12 rotate-[-15deg] scale-125">
            {Array.from({ length: 40 }).map((_, idx) => (
              <div 
                key={idx}
                className="text-[10px] sm:text-xs font-bold text-white font-mono whitespace-nowrap text-center select-none"
              >
                {watermarkText}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
