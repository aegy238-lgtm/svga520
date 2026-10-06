import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, HelpCircle, ShoppingBag, BookOpen, 
  Menu, Sliders, ChevronUp, ChevronDown, Layers, MessageCircle
} from 'lucide-react';
import { LanguageTranslatorWidget } from './LanguageTranslatorWidget';
import { PWAFloatingInstallButton } from './PWAFloatingInstallButton';
import { AppSettings } from '../types';

interface FloatingLeftActionsProps {
  settings: AppSettings | null;
  onOpenHelp: () => void;
  onOpenStore: () => void;
  onOpenFeaturesGuide: () => void;
}

export const FloatingLeftActions: React.FC<FloatingLeftActionsProps> = ({
  settings,
  onOpenHelp,
  onOpenStore,
  onOpenFeaturesGuide,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      // On mobile / small screens, default to closed (collapsed) so it doesn't block the screen
      if (window.innerWidth < 768) return false;
      const saved = localStorage.getItem('floating_actions_open');
      return saved !== null ? saved === 'true' : true;
    }
    return false;
  });

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isMobile && isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isOpen]);

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('floating_actions_open', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-4 sm:bottom-6 left-3 sm:left-6 z-[100] flex flex-col-reverse items-start gap-2.5 sm:gap-3 select-none"
    >
      {/* Main Toggle Button (العلامة التي تفتح وتقفل الأزرار) */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={isOpen ? "إغلاق قائمة الأدوات السريعة" : "فتح قائمة الأدوات السريعة"}
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer relative group border ${
          isOpen
            ? 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-400/50 shadow-rose-600/30 rotate-90 scale-105'
            : 'bg-gradient-to-tr from-indigo-700 via-indigo-600 to-sky-500 hover:from-indigo-600 hover:to-sky-400 text-white border-white/20 shadow-indigo-600/40 hover:scale-110 active:scale-95'
        }`}
        title={isOpen ? "إخلاق الأدوات السريعة (تصغير)" : "فتح الأدوات السريعة (الترجمة، المساعدة، المتجر، الواتساب، التثبيت)"}
      >
        {/* Pulsing Glow Ring when collapsed */}
        {!isOpen && (
          <span className="absolute -inset-1 rounded-2xl sm:rounded-3xl bg-indigo-500/30 blur-sm animate-pulse pointer-events-none" />
        )}

        {/* Small Active Count Badge on Mobile */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 font-black text-[9px] shadow-md border border-white/30 leading-none">
            6
          </span>
        )}

        {isOpen ? (
          <X className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300" />
        ) : (
          <div className="flex flex-col items-center justify-center">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-100 group-hover:rotate-12 transition-transform duration-300" />
          </div>
        )}
      </button>

      {/* Expanded Action Buttons */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col-reverse gap-2.5 sm:gap-3 p-1.5 sm:p-2 rounded-3xl bg-slate-950/70 backdrop-blur-xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
          >
            {/* 1. Language Translator Globe Widget */}
            <div className="relative group/btn flex items-center gap-2">
              <LanguageTranslatorWidget />
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-cyan-300 border border-cyan-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                ترجمة الموقع
              </span>
            </div>

            {/* 2. WhatsApp Floating Button */}
            {settings?.whatsappNumber && (
              <div className="relative group/btn flex items-center gap-2">
                <a 
                  href={`https://wa.me/${settings.whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 sm:w-12 sm:h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#25D366]/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تواصل معنا عبر واتساب"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </a>
                <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                  تواصل عبر واتساب
                </span>
              </div>
            )}

            {/* 3. Help Button */}
            <div className="relative group/btn flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  onOpenHelp();
                  if (isMobile) setIsOpen(false);
                }}
                className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0e172a] hover:bg-[#1e293b] text-sky-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="شرح الموقع والمنظومة"
              >
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-sky-300 border border-sky-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                شرح الموقع
              </span>
            </div>

            {/* 4. SVGA Store & Asset Library Floating Button */}
            <div className="relative group/btn flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  onOpenStore();
                  if (isMobile) setIsOpen(false);
                }}
                className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0e172a] hover:bg-[#1e293b] text-fuchsia-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="مكتبة ومتجر الأصول والقوالب"
              >
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-fuchsia-300 border border-fuchsia-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                متجر الأصول والقوالب
              </span>
            </div>

            {/* 5. Features Guide Button */}
            <div className="relative group/btn flex items-center gap-2">
              <button 
                type="button"
                onClick={() => {
                  onOpenFeaturesGuide();
                  if (isMobile) setIsOpen(false);
                }}
                className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0e172a] hover:bg-[#1e293b] text-indigo-400 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="دليل الميزات الشامل"
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-indigo-300 border border-indigo-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                دليل الميزات
              </span>
            </div>

            {/* 6. PWA Phone Install Floating Button */}
            <div className="relative group/btn flex items-center gap-2">
              <PWAFloatingInstallButton className="w-11 h-11 sm:w-12 sm:h-12" />
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-slate-900/90 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 shadow-md whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                تثبيت تطبيق الهاتف
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
