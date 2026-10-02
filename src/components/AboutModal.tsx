import React from 'react';
import { X, Sparkles, ShieldCheck, CheckCircle2, Award, Zap, Phone, Mail } from 'lucide-react';
import { Language, SiteSettings } from '../types';
import { translations } from '../utils/translations';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  siteSettings?: SiteSettings;
  onOpenContact?: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  lang,
  siteSettings,
  onOpenContact
}) => {
  const t = translations[lang];
  if (!isOpen) return null;

  const siteName = siteSettings?.siteName?.trim() || (lang === 'ar' ? 'Destroy KING Designer' : 'Destroy KING Designer');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-[#111520] border border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge & Brand */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-600/30 to-purple-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-wide">
                {siteName}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                PRO STUDIO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ar' 
                ? 'استوديو تصميم مؤثرات وهدايا وإطارات البث المباشر المعتمد' 
                : 'Premium Live Stream Animation & Avatar Frame Design Studio'}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed py-2">
          <p className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
            {lang === 'ar'
              ? 'مرحباً بكم في منصتنا الرائدة المتخصصة في ابتكار وتصميم أحدث المؤثرات البصرية المتحركة (SVGA, MP4 Alpha, VAP, PAG, GIF) وإطارات الأفاتار المخصصة لمنصات البث المباشر (TikTok, Bigo Live, Likee, وغيرها).'
              : 'Welcome to our premier design studio specialized in crafting custom live stream animations (SVGA, MP4 Alpha, VAP, PAG, GIF) and exclusive avatar frames for TikTok, Bigo Live, Likee, and global streaming apps.'}
          </p>

          {/* Features Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white text-[11px]">
                  {lang === 'ar' ? 'حماية وترخيص تجاري' : 'Licensed & Verified'}
                </strong>
                <span className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'تصاميم أصلية 100% مع ضمان عدم الانتهاك' : 'Original artwork with safe commercial usage'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white text-[11px]">
                  {lang === 'ar' ? 'تسليم فوري ومباشر' : 'Instant Delivery'}
                </strong>
                <span className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'استلام مباشر لملفات SVGA ومصادر المشروع' : 'Direct cloud link & project source files'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <Award className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white text-[11px]">
                  {lang === 'ar' ? 'جودة فائقة 4K 60FPS' : 'Ultra Quality 60FPS'}
                </strong>
                <span className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'دقة سينمائية وتأثيرات ضوئية متطورة' : 'Smooth animations with transparent alpha'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white text-[11px]">
                  {lang === 'ar' ? 'تعديل وطلب مخصص' : 'Custom Requests'}
                </strong>
                <span className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'إمكانية طلب تصميم حصري لهويتك' : 'Order exclusive designs on demand'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between gap-3">
          {onOpenContact && (
            <button
              onClick={() => {
                onClose();
                onOpenContact();
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t.contactSupport}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors ml-auto"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
