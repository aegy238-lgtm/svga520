import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Server, 
  Cpu, 
  Trash2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { backgroundExportManager, BackgroundExportJob } from '../services/backgroundExportManager';

export const GlobalExportWidget: React.FC = () => {
  const [jobs, setJobs] = useState<BackgroundExportJob[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const unsubscribe = backgroundExportManager.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, []);

  if (jobs.length === 0) {
    return null;
  }

  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'queued');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const latestActiveJob = activeJobs[0];
  const latestCompletedJob = completedJobs[0];

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed bottom-5 left-5 z-[9999] pointer-events-auto font-sans" dir="rtl">
      {/* Minimized Floating Circle Indicator */}
      {isMinimized ? (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl text-white hover:border-cyan-400 transition-all group"
        >
          {activeJobs.length > 0 ? (
            <>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-xs font-bold text-cyan-300">
                جاري التصدير ({latestActiveJob.progress}%)
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">
                {completedJobs.length} ملفات جاهزة
              </span>
            </>
          )}
        </motion.button>
      ) : (
        /* Floating Card / Drawer */
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-[360px] sm:w-[420px] bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col transition-all"
          style={{
            boxShadow: activeJobs.length > 0 
              ? '0 10px 40px -10px rgba(6, 182, 212, 0.25), 0 0 20px rgba(14, 165, 233, 0.15)' 
              : '0 10px 30px -10px rgba(16, 185, 129, 0.2)'
          }}
        >
          {/* Header Bar */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>مركز التصدير الخلفي المستمر</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                  {jobs.length}
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isExpanded ? 'طي القائمة' : 'عرض كافة المهام'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="تصغير إلى شريط جانبي"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Job Spotlight (Always visible if a job is in progress) */}
          {latestActiveJob && (
            <div className="p-4 bg-cyan-950/20 border-b border-cyan-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                    {latestActiveJob.mode === 'server' ? (
                      <Server className="w-4 h-4 animate-pulse text-cyan-400" />
                    ) : (
                      <Cpu className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate max-w-[220px]">
                      {latestActiveJob.fileName}
                    </p>
                    <p className="text-[10px] text-cyan-300/80 flex items-center gap-1">
                      {latestActiveJob.mode === 'server' ? (
                        <span>سيرفر سحابي فائق السرعة</span>
                      ) : (
                        <span>معالجة خلفية خفيفة بدون تهنيج</span>
                      )}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-cyan-400 shrink-0">
                  {latestActiveJob.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${latestActiveJob.progress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate max-w-[280px]">{latestActiveJob.message}</span>
                <button
                  onClick={() => backgroundExportManager.cancelJob(latestActiveJob.id)}
                  className="text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Quick Download Strip for Latest Completed Job if not expanded */}
          {!isExpanded && latestCompletedJob && !latestActiveJob && (
            <div className="p-4 bg-emerald-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate max-w-[200px]">
                    {latestCompletedJob.fileName}
                  </p>
                  <p className="text-[10px] text-emerald-400/80">
                    اكتمل بنجاح {formatSize(latestCompletedJob.fileSize)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => backgroundExportManager.downloadJob(latestCompletedJob.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل الملف</span>
              </button>
            </div>
          )}

          {/* Expanded List of All Jobs */}
          {isExpanded && (
            <div className="max-h-[300px] overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/40">
              {jobs.map((job) => (
                <div key={job.id} className="pt-2.5 first:pt-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {job.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />}
                      {job.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      {job.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                      {job.status === 'cancelled' && <X className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      
                      <div className="truncate">
                        <span className="text-xs text-slate-200 font-medium block truncate max-w-[210px]">
                          {job.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {job.message} {formatSize(job.fileSize)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.status === 'completed' && (
                        <button
                          onClick={() => backgroundExportManager.downloadJob(job.id)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                          title="تحميل الملف"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => backgroundExportManager.removeJob(job.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                        title="حذف من السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {job.status === 'processing' && (
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <div 
                        className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-[10px] text-slate-500">
                  تستمر العمليات في الخلفية حتى لو انتقلت لصفحة أخرى
                </span>
                <button
                  onClick={() => backgroundExportManager.clearFinishedJobs()}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  مسح المكتمل
                </button>
              </div>
            </div>
          )}

          {/* Footer Notice */}
          <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>توزيع ذكي بين المعالجة المحلية والسحابية</span>
            </span>
            <span className="text-slate-500">مستمر حتى إغلاق الموقع</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};
