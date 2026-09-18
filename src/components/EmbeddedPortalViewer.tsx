import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, RefreshCw, Maximize2, Minimize2, X, 
  ShoppingBag, Layers, Globe, ShieldCheck, ExternalLink,
  ChevronLeft, Sparkles, AlertCircle
} from 'lucide-react';
import { AppSettings, CustomExternalLink } from '../types';

interface EmbeddedPortalViewerProps {
  settings?: AppSettings;
  initialTab?: 'first' | 'second' | string;
  onClose: () => void;
}

export const EmbeddedPortalViewer: React.FC<EmbeddedPortalViewerProps> = ({
  settings,
  initialTab = 'first',
  onClose
}) => {
  const externalConfig = settings?.externalLinks;
  const storeLink = externalConfig?.storeLink;
  const svgaEditorLink = externalConfig?.svgaEditorLink;
  const customLinks = (externalConfig?.customLinks || []).filter(l => l.enabled && l.url);

  // Available tabs
  const availableTabs: { id: string; title: string; url: string; icon: React.ReactNode; badge?: string }[] = [];

  if (storeLink?.enabled && storeLink?.url) {
    availableTabs.push({
      id: 'first',
      title: storeLink.title || 'المتجر',
      url: storeLink.url,
      icon: <ShoppingBag className="w-4 h-4 text-fuchsia-400" />,
      badge: storeLink.badge || 'الصفحة الأولى'
    });
  }

  if (svgaEditorLink?.enabled && svgaEditorLink?.url) {
    availableTabs.push({
      id: 'second',
      title: svgaEditorLink.title || 'ملفات ومحرر SVGA',
      url: svgaEditorLink.url,
      icon: <Layers className="w-4 h-4 text-cyan-400" />,
      badge: svgaEditorLink.badge || 'الصفحة الثانية'
    });
  }

  customLinks.forEach((link, idx) => {
    availableTabs.push({
      id: link.id || `custom_${idx}`,
      title: link.title,
      url: link.url,
      icon: <Globe className="w-4 h-4 text-indigo-400" />,
      badge: link.badge || 'رابط خارجي'
    });
  });

  // Determine active tab ID
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (initialTab && availableTabs.some(t => t.id === initialTab)) {
      return initialTab;
    }
    const defaultFromSettings = externalConfig?.defaultActiveList;
    if (defaultFromSettings && availableTabs.some(t => t.id === defaultFromSettings)) {
      return defaultFromSettings;
    }
    return availableTabs[0]?.id || 'first';
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = availableTabs.find(t => t.id === activeTabId) || availableTabs[0];

  useEffect(() => {
    setIsLoading(true);
  }, [activeTabId, refreshKey]);

  // Format URL safely
  const currentUrl = activeTab?.url
    ? activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://')
      ? activeTab.url
      : `https://${activeTab.url}`
    : '';

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey(prev => prev + 1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060813] flex flex-col overflow-hidden select-none animate-in fade-in duration-300">
      {/* Top Header / Portal Navigation Bar */}
      <header className="h-16 px-3 sm:px-6 bg-slate-950/95 border-b border-white/10 flex items-center justify-between gap-3 z-20 backdrop-blur-xl flex-shrink-0 shadow-lg">
        {/* Right side (RTL): Back Button and Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-all hover:border-cyan-500/40 active:scale-95 group shadow-sm"
            title="الرجوع إلى الداشبورد"
          >
            <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">العودة للداشبورد</span>
          </button>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block"></div>

          {/* Secure In-App Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>عرض متكامل داخل التطبيق</span>
          </div>
        </div>

        {/* Center: List Switcher Tabs (القائمة الأولى / القائمة الثانية / أخرى) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-white/10 rounded-2xl shadow-inner max-w-xl overflow-x-auto no-scrollbar">
          {availableTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id !== activeTabId) {
                    setActiveTabId(tab.id);
                  }
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? tab.id === 'first'
                      ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md shadow-fuchsia-500/30 scale-[1.02]'
                      : tab.id === 'second'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/30 scale-[1.02]'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30 scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span>{tab.title}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-sans ${
                    isActive ? 'bg-black/20 text-white' : 'bg-white/5 text-slate-400'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Left side: Controls (Refresh, Fullscreen, Close) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className={`p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 ${
              isLoading ? 'animate-spin text-cyan-400' : ''
            }`}
            title="تحديث الصفحة"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-95 hidden sm:block"
            title={isFullscreen ? 'إلغاء ملء الشاشة' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 hover:text-rose-200 transition-all active:scale-95"
            title="إغلاق والعودة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area / Embedded Iframe */}
      <div className="flex-1 relative w-full h-full bg-[#050711]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-[#060813]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 transition-opacity">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 animate-spin flex items-center justify-center p-0.5 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                <div className="w-full h-full bg-[#060813] rounded-2xl flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-cyan-400 animate-ping opacity-75"></div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-white mb-1">
                جاري فتح {activeTab?.title || 'الموقع'} داخل التطبيق...
              </h4>
              <p className="text-xs text-slate-400">
                يتم التحميل بأمان وسرعة فائقة
              </p>
            </div>
          </div>
        )}

        {/* The Secured Iframe */}
        {currentUrl ? (
          <iframe
            key={`${activeTabId}-${refreshKey}`}
            src={currentUrl}
            title={activeTab?.title || 'Embedded Portal'}
            className="w-full h-full border-0 outline-none bg-white/5"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            allow="camera; microphone; geolocation; clipboard-read; clipboard-write; fullscreen"
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center p-6">
            <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">لم يتم ضبط رابط لهذه القائمة بعد</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              يمكن لمدير النظام تحديد رابط الموقع المطلوب من لوحة التحكم في تبويب روابط الداشبورد.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
            >
              العودة للداشبورد
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
