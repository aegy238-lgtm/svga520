import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowRight, RefreshCw, Maximize2, Minimize2, ExternalLink, 
  Package, Box, Sparkles, Layers, Car, Film, Download, ShieldCheck,
  CheckCircle2, AlertCircle, FileCode, HardDrive
} from 'lucide-react';

interface ApkAssetExtractorProps {
  onClose: () => void;
  initialSection?: 'extractor' | 'car' | 'svga';
}

export const ApkAssetExtractor: React.FC<ApkAssetExtractorProps> = ({
  onClose,
  initialSection = 'extractor'
}) => {
  const [activeSection, setActiveSection] = useState<'extractor' | 'car' | 'svga'>(initialSection);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine hash anchor
  const getSectionHash = (sec: 'extractor' | 'car' | 'svga') => {
    switch (sec) {
      case 'car':
        return '#car-importer';
      case 'svga':
        return '#svgaLab';
      case 'extractor':
      default:
        return '#drop';
    }
  };

  const iframeSrc = `/apk_extractor.html${getSectionHash(activeSection)}`;

  // Handle switching tabs
  const handleSectionChange = (section: 'extractor' | 'car' | 'svga') => {
    setActiveSection(section);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const hash = getSectionHash(section);
        iframeRef.current.contentWindow.location.hash = hash;
        const targetEl = iframeRef.current.contentDocument?.querySelector(hash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch {
        // Fallback reload with hash
        iframeRef.current.src = `/apk_extractor.html${getSectionHash(section)}`;
      }
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setReloadKey(prev => prev + 1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle direct file downloads requested from inner iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && (event.data.action === 'DOWNLOAD_FILE' || event.data.type === 'DOWNLOAD_FILE')) {
        try {
          const blob = event.data.blob;
          const filename = event.data.name || event.data.filename || 'download.zip';
          const downloadUrl = event.data.downloadUrl;

          if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            a.style.position = 'fixed';
            a.style.top = '-9999px';
            a.style.left = '-9999px';
            a.style.opacity = '0';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try { a.remove(); } catch (e) {}
            }, 30000);
            return;
          }

          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.position = 'fixed';
          a.style.top = '-9999px';
          a.style.left = '-9999px';
          a.style.opacity = '0';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            try { a.remove(); } catch (e) {}
            try { URL.revokeObjectURL(url); } catch (e) {}
          }, 120000);
        } catch (err) {
          console.error('Parent download handler error:', err);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[1200] bg-[#070b16] flex flex-col overflow-hidden text-slate-100 select-none animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* Top Professional Header Bar */}
      <header className="h-16 md:h-18 px-3 sm:px-6 bg-[#0a1024]/95 backdrop-blur-xl border-b border-indigo-500/20 flex items-center justify-between gap-3 shrink-0 shadow-xl z-20">
        {/* Right side: Back + Title & Badge */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/10 hover:border-indigo-400/40 transition-all cursor-pointer text-xs sm:text-sm font-bold active:scale-95 shrink-0"
            title="رجوع إلى لوحة التحكم الرئيسية"
          >
            <ArrowRight className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">رجوع للرئيسية</span>
          </button>

          <div className="w-px h-6 bg-white/10 hidden sm:block shrink-0" />

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-cyan-500 to-teal-400 p-0.5 shadow-[0_0_18px_rgba(34,211,166,0.35)] shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b1022] rounded-[10px] flex items-center justify-center">
                <Box className="w-5 h-5 text-cyan-300" />
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                  مُستخرِج أصول التطبيقات ومشاريع السيارات
                </h1>
                <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold shrink-0">
                  <Download className="w-3 h-3 text-amber-400" />
                  مجلد ZIP أصفر معتمد لويندوز
                </span>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold shrink-0">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" />
                  مستقل 100% محلي
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden xs:block">
                استخراج صور وSVG وفيكتور وأنيميشن وفيديو وتصميمات السيارات من APK / ZIP / AAB بلا سيرفر
              </p>
            </div>
          </div>
        </div>

        {/* Center: Quick Section Switcher Tabs */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-white/10 shadow-inner">
          <button
            onClick={() => handleSectionChange('extractor')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'extractor'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>مستخرج الحزم (APK / ZIP)</span>
          </button>

          <button
            onClick={() => handleSectionChange('car')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'car'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>مستورد ومحرر السيارات</span>
          </button>

          <button
            onClick={() => handleSectionChange('svga')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSection === 'svga'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>مختبر SVGA 2.0</span>
          </button>
        </div>

        {/* Left side actions: Refresh, Fullscreen, Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95"
            title="إعادة تحميل الأداة"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95"
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-amber-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="relative flex-1 w-full h-full bg-[#080d1e] overflow-hidden">
        {/* Loading Spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#080d1e]/90 backdrop-blur-md">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-ping" />
              <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-bold text-slate-300">جارٍ تهيئة مستخرج ومحلل الأصول...</p>
          </div>
        )}

        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={iframeSrc}
          title="مُستخرِج أصول التطبيقات ومشاريع السيارات"
          className="w-full h-full border-0 block"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};
