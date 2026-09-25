import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Star, Crown, ExternalLink, ShoppingBag, Layers, Globe, Sparkles } from 'lucide-react';
import { Uploader, UploadMode } from './Uploader';
import { UserRecord, AppSettings, CustomExternalLink } from '../types';
import { TOOLS_REGISTRY, CATEGORIES_CONFIG, ToolCategory } from '../config/toolsRegistry';
import { useStarredTools } from '../utils/starredTools';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardProps {
  onUpload: (files: File[], mode?: UploadMode) => void;
  onAction: (actionKey: string) => void;
  onUniversalPlay?: (file: File) => void;
  currentUser?: UserRecord | null;
  settings?: AppSettings | null;
  onOpenVipModal?: () => void;
  onOpenEmbeddedPortal?: (tabId: 'first' | 'second' | string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onUpload, 
  onAction, 
  onUniversalPlay,
  currentUser,
  settings,
  onOpenVipModal,
  onOpenEmbeddedPortal
}) => {
  const { isStarred, toggleStar } = useStarredTools();
  const { language, dir } = useLanguage();

  const isFeatureAllowed = (featureAccessKey: string) => {
    if (!currentUser) return true;
    if (currentUser.allFeaturesEnabled !== false) return true;
    const allowed = currentUser.allowedFeatures || [];
    return allowed.includes(featureAccessKey);
  };

  // Filter tools based on user access from central TOOLS_REGISTRY
  const allowedTools = TOOLS_REGISTRY.filter(tool => isFeatureAllowed(tool.featureAccessKey));

  const filteredCategories = (['svga', 'image', 'audio', 'batch', 'store'] as ToolCategory[]).map(catId => {
    const config = CATEGORIES_CONFIG[catId];
    const catTools = allowedTools.filter(t => t.category === catId);
    return {
      id: catId,
      label: config.label,
      icon: config.icon,
      color: config.color,
      hoverColor: config.hoverColor,
      borderColor: config.borderColor,
      textColor: config.textColor,
      tools: catTools
    };
  }).filter(cat => cat.tools.length > 0);

  // External Links defined by Admin in Settings
  const externalLinksConfig = settings?.externalLinks;
  const storeLink = externalLinksConfig?.storeLink;
  const svgaEditorLink = externalLinksConfig?.svgaEditorLink;
  const customLinks = (externalLinksConfig?.customLinks || []).filter(l => l.enabled && l.url);

  const hasConfiguredExternalLinks = 
    (storeLink?.enabled && storeLink?.url) ||
    (svgaEditorLink?.enabled && svgaEditorLink?.url) ||
    customLinks.length > 0;

  const handleOpenExternalUrl = (url: string, newTab: boolean = true) => {
    if (!url) return;
    const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    if (newTab) {
      window.open(formattedUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = formattedUrl;
    }
  };

  return (
    <div className="w-full flex justify-center pb-24 pt-4 px-4 sm:px-8 font-sans" dir={dir}>
      <div className="max-w-[1600px] w-full flex flex-col gap-12 sm:gap-18">
        
        {/* Main Hero / Uploader Section */}
        <section className="relative w-full rounded-[2rem] sm:rounded-[2.5rem] p-1.5 sm:p-3 bg-[#080d1a]/90 border border-white/[0.09] shadow-[0_24px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-fade-in overflow-hidden group">
            {/* Subtle luxury ambient glows */}
            <div className="absolute top-[-20%] left-[25%] w-[50%] h-[50%] bg-indigo-600/15 blur-[130px] rounded-full mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[25%] w-[50%] h-[50%] bg-sky-500/10 blur-[130px] rounded-full mix-blend-screen pointer-events-none"></div>
            
            <div className="text-center mt-6 sm:mt-9 mb-7 flex flex-col items-center gap-3 relative z-10 w-full px-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>منظومة متكاملة لمعالجة وتحويل الوسائط الرقمية</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                 SVGA MOTION STUDIO
              </h1>
              <p className="text-slate-400 font-medium text-xs sm:text-sm tracking-wide max-w-xl">
                 استوديو احترافي فائق السرعة لمعاينة، تحرير، ضغط، وتحويل ملفات الأنيميشن والفيديو
              </p>
            </div>
            
            <div className="relative z-10 px-2 sm:px-8 pb-8 sm:pb-10">
                <Uploader 
                    onUpload={onUpload} 
                    isUploading={false}
                    onUniversalPlay={onUniversalPlay}
                    onAnimationManagerOpen={isFeatureAllowed('animationManager') ? () => onAction('animationManager') : undefined}
                    onConverterOpen={isFeatureAllowed('videoConverter') ? () => onAction('videoConverter') : undefined}
                    onMultiSvgaOpen={isFeatureAllowed('multiSvga') ? () => onAction('multiSvga') : undefined}
                    onBatchImageOpen={isFeatureAllowed('batchImageProcessor') ? () => onAction('batchImageOpen') : undefined}
                    onOpenEmbeddedPortal={onOpenEmbeddedPortal}
                    externalLinksConfig={externalLinksConfig}
                />
            </div>
        </section>

        {/* Configured External Links Section */}
        {hasConfiguredExternalLinks && (
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="flex flex-col gap-8"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-5 px-4 relative">
              <div className="absolute bottom-0 right-0 w-1/3 h-[2px] bg-gradient-to-l from-transparent via-cyan-500/40 to-transparent"></div>
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-indigo-600/10 border border-cyan-500/30 shadow-xl text-cyan-400 backdrop-blur-md">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white font-arabic tracking-wide flex items-center gap-3">
                    المواقع والروابط المدمجة
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-sans">
                      Integrated In-App
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    فتح مباشر وفوري داخل الصفحة بأعلى درجات الأمان والسرعة
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 px-1 sm:px-2">
              {/* 1. اختيار المتجر إذا تم تفعيله */}
              {storeLink?.enabled && storeLink?.url && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEmbeddedPortal ? onOpenEmbeddedPortal('first') : handleOpenExternalUrl(storeLink.url, storeLink.openInNewTab !== false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (onOpenEmbeddedPortal) onOpenEmbeddedPortal('first');
                      else handleOpenExternalUrl(storeLink.url, storeLink.openInNewTab !== false);
                    }
                  }}
                  className="group relative text-start flex flex-col items-start gap-3 sm:gap-5 p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2rem] glass-panel transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1.5 border-fuchsia-500/40 hover:border-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.15)] hover:shadow-[0_0_35px_rgba(217,70,239,0.3)] bg-gradient-to-b from-[#180a22]/90 to-[#090e1c]/80"
                >
                  <span className="absolute top-3 sm:top-5 right-3 sm:right-5 px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-300 text-[10px] sm:text-xs font-black flex items-center gap-1 z-20">
                    <Sparkles className="w-3 h-3" />
                    <span>{storeLink.badge || 'الصفحة الأولى'}</span>
                  </span>

                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/15 to-purple-600/15 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>

                  <div className="relative z-10 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 group-hover:scale-105 shadow-[0_8px_16px_rgba(0,0,0,0.4)] border bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 text-white border-white/20">
                    <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-md text-fuchsia-300" />
                  </div>

                  <div className="relative z-10 flex flex-col gap-2 sm:gap-3 w-full h-full flex-grow">
                    <h3 className="text-sm sm:text-lg md:text-xl font-black text-white group-hover:text-fuchsia-300 transition-colors drop-shadow-md">
                      {storeLink.title || 'المتجر'}
                    </h3>

                    <div className="hidden sm:flex flex-col gap-2.5 mt-auto">
                      <div className="bg-[#070A12]/60 p-3 rounded-xl border border-white/5 shadow-inner group-hover:bg-[#070A12]/40 transition-colors backdrop-blur-sm">
                        <p className="text-[11px] sm:text-[13px] leading-relaxed font-bold text-slate-300">
                          {storeLink.desc || 'فتح موقع المتجر واستعراض القوالب والملفات'}
                        </p>
                      </div>
                      <div className="bg-fuchsia-500/10 p-2 rounded-xl border border-fuchsia-500/20 flex items-center gap-2 text-fuchsia-300 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-fuchsia-400" />
                        <span>فتح مباشر داخل الصفحة</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-3 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-fuchsia-600 to-purple-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(217,70,239,0.6)] border border-white/20">
                      <ArrowLeft className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. اختيار محرر SVGA إذا تم تفعيله */}
              {svgaEditorLink?.enabled && svgaEditorLink?.url && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEmbeddedPortal ? onOpenEmbeddedPortal('second') : handleOpenExternalUrl(svgaEditorLink.url, svgaEditorLink.openInNewTab !== false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (onOpenEmbeddedPortal) onOpenEmbeddedPortal('second');
                      else handleOpenExternalUrl(svgaEditorLink.url, svgaEditorLink.openInNewTab !== false);
                    }
                  }}
                  className="group relative text-start flex flex-col items-start gap-3 sm:gap-5 p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2rem] glass-panel transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1.5 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_35px_rgba(6,182,212,0.3)] bg-gradient-to-b from-[#091a24]/90 to-[#090e1c]/80"
                >
                  <span className="absolute top-3 sm:top-5 right-3 sm:right-5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] sm:text-xs font-black flex items-center gap-1 z-20">
                    <Sparkles className="w-3 h-3" />
                    <span>{svgaEditorLink.badge || 'الصفحة الثانية'}</span>
                  </span>

                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/15 to-blue-600/15 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>

                  <div className="relative z-10 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 group-hover:scale-105 shadow-[0_8px_16px_rgba(0,0,0,0.4)] border bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-white border-white/20">
                    <Layers className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-md text-cyan-300" />
                  </div>

                  <div className="relative z-10 flex flex-col gap-2 sm:gap-3 w-full h-full flex-grow">
                    <h3 className="text-sm sm:text-lg md:text-xl font-black text-white group-hover:text-cyan-300 transition-colors drop-shadow-md">
                      {svgaEditorLink.title || 'محرر ومصمم SVGA'}
                    </h3>

                    <div className="hidden sm:flex flex-col gap-2.5 mt-auto">
                      <div className="bg-[#070A12]/60 p-3 rounded-xl border border-white/5 shadow-inner group-hover:bg-[#070A12]/40 transition-colors backdrop-blur-sm">
                        <p className="text-[11px] sm:text-[13px] leading-relaxed font-bold text-slate-300">
                          {svgaEditorLink.desc || 'فتح محرر ومصمم ملفات SVGA'}
                        </p>
                      </div>
                      <div className="bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20 flex items-center gap-2 text-cyan-300 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
                        <span>فتح مباشر داخل الصفحة</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-3 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)] border border-white/20">
                      <ArrowLeft className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. الروابط الخارجية الإضافية المخصصة */}
              {customLinks.map((link) => (
                <div
                  key={link.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEmbeddedPortal ? onOpenEmbeddedPortal(link.id) : handleOpenExternalUrl(link.url, link.openInNewTab !== false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (onOpenEmbeddedPortal) onOpenEmbeddedPortal(link.id);
                      else handleOpenExternalUrl(link.url, link.openInNewTab !== false);
                    }
                  }}
                  className="group relative text-start flex flex-col items-start gap-3 sm:gap-5 p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2rem] glass-panel transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1.5 border-indigo-500/40 hover:border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:shadow-[0_0_35px_rgba(99,102,241,0.3)] bg-gradient-to-b from-[#100d26]/90 to-[#090e1c]/80"
                >
                  <span className="absolute top-3 sm:top-5 right-3 sm:right-5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] sm:text-xs font-black flex items-center gap-1 z-20">
                    <Sparkles className="w-3 h-3" />
                    <span>{link.badge || 'رابط مخصص'}</span>
                  </span>

                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none"></div>

                  <div className="relative z-10 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-300 group-hover:scale-105 shadow-[0_8px_16px_rgba(0,0,0,0.4)] border bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-white border-white/20">
                    <Globe className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-md text-indigo-300" />
                  </div>

                  <div className="relative z-10 flex flex-col gap-2 sm:gap-3 w-full h-full flex-grow">
                    <h3 className="text-sm sm:text-lg md:text-xl font-black text-white group-hover:text-indigo-300 transition-colors drop-shadow-md">
                      {link.title}
                    </h3>

                    <div className="hidden sm:flex flex-col gap-2.5 mt-auto">
                      <div className="bg-[#070A12]/60 p-3 rounded-xl border border-white/5 shadow-inner group-hover:bg-[#070A12]/40 transition-colors backdrop-blur-sm">
                        <p className="text-[11px] sm:text-[13px] leading-relaxed font-bold text-slate-300">
                          {link.desc || 'فتح الرابط المخصص'}
                        </p>
                      </div>
                      <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20 flex items-center gap-2 text-indigo-300 text-xs font-bold">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
                        <span>فتح مباشر داخل الصفحة</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-3 group-hover:translate-x-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.6)] border border-white/20">
                      <ArrowLeft className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Categories and Tools Grid */}
        <section className="flex flex-col gap-14">
           {filteredCategories.map((cat, idx) => (
              <motion.div 
                 key={cat.id}
                 initial={{ opacity: 0, y: 25 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.08, duration: 0.5, ease: "easeOut" }}
                 className="flex flex-col gap-6"
              >
                 <div className="flex items-center gap-3.5 border-b border-white/[0.08] pb-3.5 px-2 relative">
                    <div className="p-2.5 rounded-xl bg-[#0b1222] border border-white/[0.1] text-indigo-400 shadow-inner">
                       {cat.icon}
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">{cat.label}</h2>
                      <span className="text-[11px] text-slate-400 font-medium">الأدوات التخصصية لمعالجة وتصدير الوسائط</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 px-1">
                    {cat.tools.map(tool => {
                       const starred = isStarred(tool.id);
                       return (
                       <div
                          key={tool.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                             if (tool.id === 'store' && storeLink?.enabled && storeLink?.url) {
                               handleOpenExternalUrl(storeLink.url, storeLink.openInNewTab !== false);
                               return;
                             }
                             if ((tool.id === 'svgaEx' || tool.id === 'svgaLayerEditor') && svgaEditorLink?.enabled && svgaEditorLink?.url) {
                               handleOpenExternalUrl(svgaEditorLink.url, svgaEditorLink.openInNewTab !== false);
                               return;
                             }
                             onAction((tool as any).dashboardActionKey || (tool as any).actionKey);
                          }}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter' || e.key === ' ') {
                               if (tool.id === 'store' && storeLink?.enabled && storeLink?.url) {
                                 handleOpenExternalUrl(storeLink.url, storeLink.openInNewTab !== false);
                                 return;
                               }
                               if ((tool.id === 'svgaEx' || tool.id === 'svgaLayerEditor') && svgaEditorLink?.enabled && svgaEditorLink?.url) {
                                 handleOpenExternalUrl(svgaEditorLink.url, svgaEditorLink.openInNewTab !== false);
                                 return;
                               }
                               onAction((tool as any).dashboardActionKey || (tool as any).actionKey);
                             }
                          }}
                          className={`group relative text-start flex flex-col items-start gap-3.5 p-5 rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden border ${
                             tool.isVip
                              ? 'border-amber-500/40 hover:border-amber-400 bg-gradient-to-b from-[#181105]/85 to-[#090f1d]/95 shadow-[0_4px_24px_rgba(245,158,11,0.12)] hover:-translate-y-1'
                              : tool.highlight 
                                ? 'border-indigo-500/30 hover:border-indigo-400/60 bg-[#090f1e]/90 shadow-[0_4px_20px_rgba(99,102,241,0.12)] hover:-translate-y-1' 
                                : starred
                                  ? 'border-amber-500/30 hover:border-amber-400 bg-[#101420]/90 hover:-translate-y-1 shadow-[0_4px_16px_rgba(245,158,11,0.08)]'
                                  : 'border-white/[0.07] hover:border-indigo-500/40 bg-[#090e1c]/85 hover:bg-[#0d152a] hover:-translate-y-1 shadow-[0_4px_16px_rgba(0,0,0,0.45)]'
                          }`}
                       >
                          {/* VIP Badge on Tool Card */}
                          {tool.isVip && (
                            <span className="absolute top-3.5 right-3.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black flex items-center gap-1 z-20">
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>VIP</span>
                            </span>
                          )}

                          {/* Star Pin Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(tool.id);
                            }}
                            className={`absolute top-3.5 left-3.5 p-1.5 rounded-lg transition-all z-20 cursor-pointer ${
                              starred
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 opacity-100'
                                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-500 hover:text-amber-400 border border-white/[0.06] opacity-0 group-hover:opacity-100'
                            }`}
                            title={starred ? 'مثبتة بنجمة في البداية ⭐ (اضغط لإلغاء التثبيت)' : 'تثبيت الأداة بنجمة في البداية ⭐'}
                          >
                            <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          
                          {/* Icon Container */}
                          <div className={`p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-105 border ${
                             tool.highlight ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-white/[0.05] text-slate-300 border-white/[0.08]'
                          }`}>
                            {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
                          </div>

                          <div className="flex flex-col gap-1.5 w-full h-full flex-grow">
                             <div className="flex items-center justify-between gap-2">
                               <h3 className={`text-sm sm:text-base font-bold transition-colors ${tool.highlight ? 'text-white group-hover:text-indigo-300' : 'text-slate-100 group-hover:text-white'}`}>
                                  {tool.label}
                                </h3>
                             </div>
                             
                             <p className="text-xs text-slate-400 font-normal leading-relaxed line-clamp-2">
                                {language === 'en' ? tool.descEn : tool.descAr}
                             </p>

                             <div className="mt-auto pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">
                                <span>فتح الأداة</span>
                                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                             </div>
                          </div>
                       </div>
                    );
                    })}
                 </div>
              </motion.div>
           ))}
        </section>
      </div>
    </div>
  );
};

