import React from 'react';
import { 
  Download, Smartphone, CheckCircle2, X, Share2, 
  MoreVertical, Sparkles, Layers, FileCode, Film, ArrowRight
} from 'lucide-react';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAndroid: boolean;
  isIOS: boolean;
  canInstallDirectly: boolean;
  onDirectInstall: () => void;
  isInstalled: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isAndroid,
  isIOS,
  canInstallDirectly,
  onDirectInstall,
  isInstalled
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0a0f1e] border border-indigo-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-white scrollbar-thin scrollbar-thumb-indigo-500/30"
        dir="rtl"
      >
        {/* Glow backdrop */}
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-sky-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-all cursor-pointer"
          title="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Logo and Badges */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-indigo-700 p-0.5 shadow-xl shadow-indigo-500/25 shrink-0 flex items-center justify-center">
            <div className="w-full h-full rounded-2xl bg-[#090e1c] flex items-center justify-center overflow-hidden">
              <img src="/pwa-192x192.png" alt="App Logo" className="w-12 h-12 object-contain" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white font-arabic">
                تثبيت التطبيق على جهازك
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA Android
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تجربة تطبيق أندرويد حقيقية ومستقلة مع سرعة فائقة
            </p>
          </div>
        </div>

        {/* Installed State Notification */}
        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3.5 mb-6">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-300">
                التطبيق مثبت بنجاح ويعمل بنظام Standalone!
              </p>
              <p className="text-xs text-emerald-200/70 mt-0.5">
                يمكنك فتح ملفات الرسوم والوسائط مباشرة من مدير ملفات الهاتف.
              </p>
            </div>
          </div>
        ) : (
          /* Primary Install Action Button */
          <div className="mb-6 flex flex-col gap-2.5">
            <button
              onClick={() => {
                onDirectInstall();
                if (canInstallDirectly) {
                  onClose();
                }
              }}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-600 text-white font-black text-base shadow-xl shadow-indigo-600/35 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer border border-indigo-400/40"
            >
              <Download className="w-5 h-5 animate-bounce text-sky-200" />
              <span>تثبيت التطبيق الآن على الهاتف</span>
            </button>
            <p className="text-center text-[11px] text-slate-400">
              {canInstallDirectly 
                ? 'اضغط للتثبيت الفوري وإضافة أيقونة التطبيق لشاشتك الرئيسية ودرج التطبيقات.' 
                : 'إذا لم تظهر نافذة المتصفح تلقائياً، اتبع الخطوات السريعة أدناه.'}
            </p>
          </div>
        )}

        {/* Step by Step Manual Guide for Android / iOS */}
        <div className="space-y-4 mb-6">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>خطوات التثبيت على الهاتف:</span>
          </h3>

          {isIOS ? (
            /* iOS Safari Instructions */
            <div className="space-y-2.5 text-xs text-slate-300 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">1</div>
                <div className="flex items-center gap-1.5">
                  اضغط على زر المشاركة <Share2 className="w-4 h-4 text-sky-400 inline mx-1" /> في شريط متصفح Safari.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">2</div>
                <div>مرر لأسفل واختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0">3</div>
                <div>اضغط على <strong>"إضافة" (Add)</strong> بالأعلى لتثبيت التطبيق.</div>
              </div>
            </div>
          ) : (
            /* Android Instructions (Chrome, Samsung Internet, Edge, etc.) */
            <div className="space-y-3 text-xs text-slate-300 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">1</div>
                <div className="flex items-center gap-1">
                  اضغط على قائمة المتصفح <MoreVertical className="w-4 h-4 text-indigo-400 inline" /> (الثلاث نقاط في أعلى أو أسفل الشاشة).
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">2</div>
                <div>
                  اختر <strong>"تثبيت التطبيق" (Install App)</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong>.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">3</div>
                <div>
                  أكّد التثبيت، وسيظهر التطبيق بأيقونته الرسمية على شاشة هاتفك مثل أي تطبيق أندرويد.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advantages of the Installed App */}
        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 mb-6">
          <p className="text-xs font-bold text-indigo-300 mb-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>مميزات تثبيت تطبيق الأندرويد:</span>
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>فتح الملفات من الهاتف مباشرة</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تشغيل كامل بدون أشرطة المتصفح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>الحفاظ على الجلسة وحفظ المشاريع</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>أداء وسرعة مضاعفة مع كاش ذكي</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
