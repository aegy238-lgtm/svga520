import React, { useRef, useState } from 'react';
import { 
  Download, CheckCircle2, FolderOpen, Smartphone, Sparkles, PlusCircle 
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAAndroidActionButtonsProps {
  onOpenFile?: (files: File[]) => void;
  variant?: 'header' | 'hero' | 'mobile-bar';
  className?: string;
}

export const PWAAndroidActionButtons: React.FC<PWAAndroidActionButtonsProps> = ({
  onOpenFile,
  variant = 'header',
  className = ''
}) => {
  const { 
    isInstallable, 
    canInstallDirectly, 
    isInstalled, 
    isAndroid, 
    isIOS, 
    triggerInstall 
  } = usePWAInstall();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInstallClick = async () => {
    if (isInstalled) {
      setIsModalOpen(true);
      return;
    }
    const { success, manualNeeded } = await triggerInstall();
    if (manualNeeded || !success) {
      setIsModalOpen(true);
    }
  };

  const handleOpenFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onOpenFile) {
      const files = Array.from(e.target.files);
      onOpenFile(files);
      e.target.value = '';
    }
  };

  // Supported format extensions
  const supportedExtensions = ".svga,.svg,.vap,.mp4,.webp,.gif,.apng,.png,.json,.lottie,.pag,.webm,.mov";

  /* Render Header Variant */
  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedExtensions}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 1. Open File Button (فتح ملف) */}
        {onOpenFile && (
          <button
            type="button"
            onClick={handleOpenFileClick}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-sky-600/20 to-indigo-600/20 hover:from-sky-600/30 hover:to-indigo-600/30 text-sky-200 hover:text-white border border-sky-500/30 hover:border-sky-500/50 transition-all font-bold text-xs shrink-0 shadow-sm active:scale-95 cursor-pointer"
            title="فتح ملف من هاتفك أو جهازك (يدعم SVGA, SVG, MP4, VAP, GIF, WebP, Lottie)"
          >
            <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
            <span className="font-arabic font-extrabold whitespace-nowrap">فتح ملف</span>
          </button>
        )}

        {/* 2. Install App / App Installed Button (تثبيت التطبيق) */}
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl transition-all font-bold text-xs shrink-0 shadow-sm active:scale-95 cursor-pointer border ${
            isInstalled
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25 shadow-emerald-500/10'
              : 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white border-indigo-400/40 hover:from-indigo-500 hover:to-sky-500 shadow-md shadow-indigo-600/25 animate-pulse-subtle'
          }`}
          title={isInstalled ? 'التطبيق مثبت بنجاح - انقر لمعلومات النظام' : 'تثبيت المنصة كتطبيق Android مستقل على هاتفك'}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="font-arabic font-extrabold whitespace-nowrap">التطبيق مثبت</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
              <span className="font-arabic font-extrabold whitespace-nowrap">تثبيت التطبيق</span>
            </>
          )}
        </button>

        {/* Install Modal Guide */}
        <PWAInstallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isAndroid={isAndroid}
          isIOS={isIOS}
          canInstallDirectly={canInstallDirectly}
          onDirectInstall={() => triggerInstall()}
          isInstalled={isInstalled}
        />
      </div>
    );
  }

  /* Render Hero / Dashboard Variant */
  if (variant === 'hero') {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 ${className}`}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedExtensions}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Open File Button */}
        {onOpenFile && (
          <button
            type="button"
            onClick={handleOpenFileClick}
            className="group relative flex items-center gap-3 px-5 sm:px-7 py-3 rounded-2xl bg-gradient-to-r from-[#0d162e] to-[#111c38] hover:from-[#132042] hover:to-[#17274f] text-white border border-sky-500/30 hover:border-sky-400 shadow-[0_8px_25px_rgba(14,165,233,0.15)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-start">
              <span className="font-black text-sm text-white font-arabic">فتح ملف من الهاتف</span>
              <span className="text-[10px] text-sky-300 font-sans">SVGA • MP4 • SVG • VAP • WebP • GIF</span>
            </div>
          </button>
        )}

        {/* Install App Button */}
        <button
          type="button"
          onClick={handleInstallClick}
          className={`group relative flex items-center gap-3 px-5 sm:px-7 py-3 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer border ${
            isInstalled
              ? 'bg-emerald-950/40 text-white border-emerald-500/40 hover:border-emerald-400 shadow-[0_8px_25px_rgba(16,185,129,0.15)]'
              : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 text-white border-indigo-400/50 hover:border-indigo-300 shadow-[0_10px_30px_rgba(99,102,241,0.3)]'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
            isInstalled 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
              : 'bg-white/20 text-white border border-white/30'
          }`}>
            {isInstalled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            ) : (
              <Smartphone className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex flex-col text-start">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm font-arabic">
                {isInstalled ? 'التطبيق مثبت' : 'تثبيت التطبيق'}
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                isInstalled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-white/20 text-white'
              }`}>
                {isInstalled ? 'Standalone' : 'Android PWA'}
              </span>
            </div>
            <span className="text-[10px] text-indigo-200">
              {isInstalled ? 'يعمل كتطبيق أصلي مستقل' : 'تشغيل وفتح الملفات كبرنامج أندرويد'}
            </span>
          </div>
        </button>

        {/* Install Modal */}
        <PWAInstallModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isAndroid={isAndroid}
          isIOS={isIOS}
          canInstallDirectly={canInstallDirectly}
          onDirectInstall={() => triggerInstall()}
          isInstalled={isInstalled}
        />
      </div>
    );
  }

  /* Render Mobile Bottom Floating Bar Variant */
  return (
    <div className={`fixed bottom-4 left-3 right-3 sm:hidden z-[900] ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={supportedExtensions}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="bg-[#090e1f]/95 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl p-2 flex items-center justify-between gap-2 shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
        {onOpenFile && (
          <button
            type="button"
            onClick={handleOpenFileClick}
            className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30 flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition-transform"
          >
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <span className="font-arabic font-black">فتح ملف</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs active:scale-95 transition-transform border ${
            isInstalled
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
              : 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white border-indigo-400/40 shadow-md shadow-indigo-600/30'
          }`}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-arabic font-black">التطبيق مثبت</span>
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 text-white" />
              <span className="font-arabic font-black">تثبيت التطبيق</span>
            </>
          )}
        </button>
      </div>

      <PWAInstallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isAndroid={isAndroid}
        isIOS={isIOS}
        canInstallDirectly={canInstallDirectly}
        onDirectInstall={() => triggerInstall()}
        isInstalled={isInstalled}
      />
    </div>
  );
};
