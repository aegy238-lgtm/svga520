import React, { useState, useEffect } from 'react';
import { giftPreloader, PreloadProgress } from '../utils/giftPreloader';
import { Cpu, CheckCircle, Zap, X, Minimize2, Maximize2, HardDrive, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface PreloaderStatusProps {
  lang: Language;
}

export const PreloaderStatus: React.FC<PreloaderStatusProps> = ({ lang }) => {
  const [progress, setProgress] = useState<PreloadProgress | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    const saved = localStorage.getItem('jiawei_preloader_minimized');
    return saved === 'true';
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleProgressUpdate = (newProgress: PreloadProgress) => {
      setProgress(newProgress);
    };

    giftPreloader.addListener(handleProgressUpdate);
    return () => {
      giftPreloader.removeListener(handleProgressUpdate);
    };
  }, []);

  const handleToggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem('jiawei_preloader_minimized', String(next));
      return next;
    });
  };

  if (!progress || progress.total === 0 || !isVisible) return null;

  const { total, completed, cached, failed, percent, isFinished } = progress;

  // We only show it if there is work to do or if it recently finished.
  // If it's finished and percent is 100%, we can let the user dismiss it.
  const totalLoaded = completed + cached;

  const translationsLocal = {
    ar: {
      title: '⚡ معالج ومسرّع الهدايا',
      desc: 'جاري تحميل وتخزين كافة الهدايا والأنيميشن تلقائياً على جهازك لضمان تشغيل سريع وفوري بنسبة 100%!',
      finishedTitle: '⚡ تم تسريع الهدايا بالكامل!',
      finishedDesc: `تم بنجاح تكييش وحفظ جميع الهدايا (${totalLoaded}/${total}) في ذاكرة المتصفح. تصفح فوري وسريع للغاية بدون أي انتظار!`,
      statusPreloading: 'جاري تسريع الهدايا...',
      statusFinished: 'الهدايا نشطة ومسرّعة 100%',
      cachedBadge: 'تكييش محلي',
      dismiss: 'إخفاء',
      failedCount: 'فشل تحميل {count}',
      details: 'عرض {current} من {total}'
    },
    zh: {
      title: '⚡ 礼物动效秒开加速器',
      desc: '正在后台预先下载并缓存所有礼物和SVGA动效，确保点击时100%零延迟瞬时播放！',
      finishedTitle: '⚡ 动效加速已完成！',
      finishedDesc: `已成功将全部 ${totalLoaded}/${total} 个礼物资源缓存至本地。现在享受极致流畅、秒开播的畅快体验吧！`,
      statusPreloading: '正在智能加速中...',
      statusFinished: '秒开加速已就绪 100%',
      cachedBadge: '本地缓存',
      dismiss: '关闭',
      failedCount: '{count} 个失败',
      details: '已加载 {current} / 共 {total}'
    },
    en: {
      title: '⚡ Gift & Animation Accelerator',
      desc: 'Preloading and caching all gifts & SVGA assets in the background for 100% instant, lag-free playback!',
      finishedTitle: '⚡ Gifts Fully Accelerated!',
      finishedDesc: `Successfully cached all ${totalLoaded}/${total} gift animations to your browser storage. Enjoy immediate, zero-loading preview!`,
      statusPreloading: 'Accelerating assets...',
      statusFinished: 'Gifts fully optimized 100%',
      cachedBadge: 'Cached Local',
      dismiss: 'Dismiss',
      failedCount: '{count} failed',
      details: 'Loaded {current} of {total}'
    }
  };

  const t = translationsLocal[lang] || translationsLocal['ar'];

  return (
    <div 
      className={`fixed bottom-6 ${lang === 'ar' ? 'left-6' : 'right-6'} z-45 transition-all duration-500 transform ease-out`}
      style={{ maxWidth: '350px', width: 'calc(100vw - 48px)' }}
    >
      {isMinimized ? (
        /* Minimized Small Bubble */
        <button
          onClick={handleToggleMinimize}
          className={`flex items-center gap-2 p-3 rounded-full border bg-[#0b0e17]/95 backdrop-blur-md text-xs font-bold shadow-xl transition-all hover:scale-105 active:scale-95 ${
            isFinished 
              ? 'border-emerald-500/50 hover:border-emerald-400 text-emerald-400 shadow-emerald-950/20' 
              : 'border-cyan-500/50 hover:border-cyan-400 text-cyan-400 shadow-cyan-950/20'
          }`}
        >
          {isFinished ? (
            <CheckCircle className="w-4 h-4 animate-bounce text-emerald-400" />
          ) : (
            <Cpu className="w-4 h-4 animate-spin text-cyan-400" />
          )}
          <span className="font-mono">
            {isFinished ? '100%' : `${percent}%`}
          </span>
          <span className="hidden sm:inline-block">
            {isFinished ? t.statusFinished : t.statusPreloading}
          </span>
        </button>
      ) : (
        /* Expanded Dashboard Card */
        <div 
          className={`relative overflow-hidden rounded-2xl border bg-[#0c101b]/95 backdrop-blur-xl p-4 shadow-2xl flex flex-col gap-3 transition-all ${
            isFinished 
              ? 'border-emerald-500/30 shadow-emerald-950/20' 
              : 'border-cyan-500/30 shadow-cyan-950/30'
          }`}
        >
          {/* Futuristic subtle scanning line */}
          {!isFinished && (
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse" />
          )}

          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-900/95 pb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${isFinished ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                {isFinished ? <CheckCircle className="w-4 h-4" /> : <Cpu className="w-4 h-4 animate-spin" />}
              </div>
              <h4 className="text-[12px] font-black text-white uppercase tracking-wider">
                {isFinished ? t.finishedTitle : t.title}
              </h4>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleToggleMinimize} 
                className="p-1 rounded bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <button 
                onClick={() => setIsVisible(false)} 
                className="p-1 rounded bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-[10px] sm:text-[11px] leading-relaxed text-slate-300 font-medium">
            {isFinished ? t.finishedDesc : t.desc}
          </p>

          {/* Progress Bar Area */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-white">
                <HardDrive className="w-3 h-3 text-cyan-400" />
                <span>
                  {t.details.replace('{current}', String(totalLoaded)).replace('{total}', String(total))}
                </span>
              </span>
              <span className={`font-bold ${isFinished ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {percent}%
              </span>
            </div>

            {/* Glowing progress track */}
            <div className="w-full h-2 rounded-full bg-slate-950/95 overflow-hidden border border-slate-900 p-[1px]">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isFinished 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                    : 'bg-gradient-to-r from-cyan-600 via-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Status Metrics Strip */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1.5 rounded-xl text-center text-[9px] font-mono border border-slate-900">
            <div className="flex flex-col p-1 rounded-lg bg-[#080b12]">
              <span className="text-slate-500 text-[8px] uppercase">{lang === 'ar' ? 'مرفوع' : 'Downloaded'}</span>
              <span className="font-bold text-white mt-0.5">{completed}</span>
            </div>
            <div className="flex flex-col p-1 rounded-lg bg-[#080b12]">
              <span className="text-slate-500 text-[8px] uppercase">{lang === 'ar' ? 'مكيّش مسبقاً' : 'Cached Already'}</span>
              <span className="font-bold text-emerald-400 mt-0.5">{cached}</span>
            </div>
            <div className="flex flex-col p-1 rounded-lg bg-[#080b12]">
              <span className="text-slate-500 text-[8px] uppercase">{lang === 'ar' ? 'متبقي/فشل' : 'Left/Failed'}</span>
              <span className={`font-bold mt-0.5 ${failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {failed > 0 ? failed : total - totalLoaded}
              </span>
            </div>
          </div>

          {/* Floating bottom badge */}
          {isFinished && (
            <div className="flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold animate-pulse">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{t.cachedBadge}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
