import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, X, DownloadCloud, ArrowUpCircle, CheckCircle2, Zap, ShieldCheck } from 'lucide-react';
import { checkForServerUpdate, forceAppUpdateAndClearCache, CURRENT_APP_VERSION } from '../utils/versionControl';

export const AppUpdateToast: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateData, setUpdateData] = useState<{
    serverVersion?: string;
    serverBuildId?: string;
    serverBuildTime?: string;
  }>({});
  
  // Post-update notification state ("تم التحديث")
  const [justUpdatedInfo, setJustUpdatedInfo] = useState<{
    version: string;
    show: boolean;
  } | null>(null);

  // Check on mount if the user just updated
  useEffect(() => {
    try {
      const stored = localStorage.getItem('app_just_updated_msg');
      if (stored) {
        const parsed = JSON.parse(stored);
        const diff = Date.now() - (parsed.timestamp || 0);
        // Show if updated within last 2 minutes
        if (diff < 120000) {
          setJustUpdatedInfo({
            version: parsed.version || CURRENT_APP_VERSION,
            show: true
          });
          // Auto-hide success toast after 6 seconds
          setTimeout(() => {
            setJustUpdatedInfo(null);
          }, 6000);
        }
        localStorage.removeItem('app_just_updated_msg');
      }
    } catch (e) {}
  }, []);

  const check = async () => {
    if (isUpdating) return;
    const res = await checkForServerUpdate();
    if (res.hasUpdate) {
      setUpdateAvailable(true);
      setUpdateData({
        serverVersion: res.serverVersion,
        serverBuildId: res.serverBuildId,
        serverBuildTime: res.serverBuildTime
      });
    } else {
      setUpdateAvailable(false);
    }
  };

  useEffect(() => {
    // Initial check after 3 seconds
    const initialTimer = setTimeout(() => {
      check();
    }, 3000);

    // Frequent background check every 45 seconds
    const interval = setInterval(() => {
      check();
    }, 45 * 1000);

    // Check immediately when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isUpdating]);

  const handleApplyUpdate = () => {
    setIsUpdating(true);
    const targetVersion = updateData.serverVersion || CURRENT_APP_VERSION;
    try {
      localStorage.setItem('app_just_updated_msg', JSON.stringify({
        version: targetVersion,
        timestamp: Date.now()
      }));
      localStorage.setItem('applied_app_version', targetVersion);
    } catch (e) {}

    // Show brief downloading progress then reload cleanly
    setTimeout(() => {
      setUpdateAvailable(false);
      forceAppUpdateAndClearCache();
    }, 600);
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    if (updateData.serverVersion) {
      try {
        localStorage.setItem('applied_app_version', updateData.serverVersion);
      } catch (e) {}
    }
  };

  return (
    <>
      {/* 1. Post-Update Success Toast ("تم التحديث بنجاح") */}
      <AnimatePresence>
        {justUpdatedInfo?.show && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[4000] w-[92%] max-w-md"
            dir="rtl"
          >
            <div className="p-4 bg-gradient-to-r from-emerald-950/95 via-slate-900/95 to-emerald-950/95 border-2 border-emerald-500/60 backdrop-blur-2xl rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.35)] flex items-center justify-between gap-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      تم التحديث بنجاح 🎉
                    </span>
                    <span className="text-xs font-mono font-bold text-teal-300 dir-ltr">
                      {justUpdatedInfo.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 font-semibold leading-relaxed">
                    تم تنزيل وتثبيت أحدث إصدار وتفعيل محركات دمج VAP بنجاح.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setJustUpdatedInfo(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Mandatory Update Modal (رسالة إجبارية لتنزيل وتطبيق التحديث الجديد) */}
      <AnimatePresence>
        {updateAvailable && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900/95 border-2 border-indigo-500/60 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(79,70,229,0.4)] text-white overflow-hidden"
            >
              {/* Background ambient glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl -z-10 pointer-events-none" />

              {/* Close / Dismiss Button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/30 animate-pulse">
                  <ArrowUpCircle className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                      تحديث إجباري مباشر 🚀
                    </span>
                    {updateData.serverVersion && (
                      <span className="text-xs font-mono font-black text-cyan-300 dir-ltr bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/30">
                        {updateData.serverVersion}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    يتوفر تحديث جديد للموقع والتطبيق
                  </h3>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                تم نشر إصدار جديد يتضمن تحسينات أساسية لمحرك استبدال ودمج الصوت في ملفات VAP وحل مشكلات الأداء على الرابط المباشر. يُرجى الضغط على الزر أدناه لتنزيل التحديث وتطبيقه فوراً.
              </p>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-6 space-y-2.5">
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>دمج وتغيير مسار الصوت في VAP فوراً بدون انتظار أو ضغط على المتصفح.</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>تحديث وإعادة ضبط ملفات الكاش على الرابط لضمان عمل كامل الوظائف.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleApplyUpdate}
                  disabled={isUpdating}
                  className="w-full sm:flex-1 py-3.5 px-6 bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 disabled:opacity-75 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/30 transition-all flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
                >
                  <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span>{isUpdating ? 'جاري تنزيل التحديث وتطبيق الملفات...' : 'تنزيل وتثبيت التحديث الآن 🔄'}</span>
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isUpdating}
                  className="w-full sm:w-auto py-3.5 px-5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-2xl border border-slate-700 transition-all cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
