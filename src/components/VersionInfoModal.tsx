import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Server, 
  Clock, 
  Hash, 
  X as CloseIcon, 
  ShieldCheck, 
  DownloadCloud,
  Layers
} from 'lucide-react';
import { 
  getAppVersionInfo, 
  checkForServerUpdate, 
  forceAppUpdateAndClearCache,
  CURRENT_APP_VERSION,
  BUILD_NUMBER,
  BUILD_ID,
  BUILD_TIMESTAMP
} from '../utils/versionControl';

interface VersionInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionInfoModal: React.FC<VersionInfoModalProps> = ({ isOpen, onClose }) => {
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    checked: boolean;
    hasUpdate: boolean;
    serverVersion?: string;
    serverBuildId?: string;
    message?: string;
  }>({ checked: false, hasUpdate: false });

  const info = getAppVersionInfo();

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateResult({ checked: false, hasUpdate: false });
    try {
      const res = await checkForServerUpdate();
      if (res.hasUpdate) {
        setUpdateResult({
          checked: true,
          hasUpdate: true,
          serverVersion: res.serverVersion,
          serverBuildId: res.serverBuildId,
          message: `يوجد تحديث أحدث على السيرفر (${res.serverVersion || 'إصدار جديد'})!`
        });
      } else {
        setUpdateResult({
          checked: true,
          hasUpdate: false,
          message: 'أنت تستخدم أحدث إصدار وبناء متاح للنظام حالياً.'
        });
      }
    } catch (e) {
      setUpdateResult({
        checked: true,
        hasUpdate: false,
        message: 'تعذر الاتصال بخادم التحديثات حالياً.'
      });
    } finally {
      setChecking(false);
    }
  };

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(BUILD_TIMESTAMP);
      return d.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return BUILD_TIMESTAMP;
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#020617]/85 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-slate-900/95 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 text-right z-10"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-white">تفاصيل الإصدار والتحديثات</h3>
                <p className="text-xs text-slate-400">نظام التحقق وتتبع البناء المباشر</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Details Body */}
          <div className="py-4 space-y-3">
            {/* Version badge card */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-sm font-bold text-slate-300">رقم الإصدار الحالي:</span>
              </div>
              <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono font-black text-base rounded-xl dir-ltr">
                {info.version}
              </span>
            </div>

            {/* Build Details */}
            <div className="p-4 bg-slate-950/60 border border-white/5 rounded-2xl space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" />
                  رقم البناء (Build Number):
                </span>
                <span className="font-mono text-slate-200 font-bold dir-ltr">{BUILD_NUMBER}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  معرّف الحزمة (Build ID):
                </span>
                <span className="font-mono text-slate-300 dir-ltr text-[11px] truncate max-w-[170px]" title={BUILD_ID}>
                  {BUILD_ID}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  وقت النشر والبناء:
                </span>
                <span className="text-slate-300 font-medium">{formattedDate}</span>
              </div>
            </div>

            {/* Update check message result */}
            {updateResult.checked && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                  updateResult.hasUpdate 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {updateResult.hasUpdate ? (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                )}
                <div className="text-xs">
                  <p className="font-bold">{updateResult.message}</p>
                  {updateResult.hasUpdate && (
                    <p className="mt-1 text-slate-300">
                      اضغط على زر التحديث أدناه لتنزيل وتشغيل أحدث كود فوراً وتجاوز الكاش.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleCheckUpdate}
              disabled={checking}
              className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/15 active:scale-[0.99] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'جاري فحص السيرفر...' : 'التحقق من وجود تحديثات جديدة'}</span>
            </button>

            <button
              onClick={() => forceAppUpdateAndClearCache()}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 active:scale-[0.99] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all border border-white/20"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>تحديث الكاش والتحميل المباشر للنسخة الحية</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
