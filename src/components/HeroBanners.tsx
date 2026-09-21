import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles, 
  Crown, 
  Bot, 
  Palette, 
  Package, 
  Globe2,
  Award
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface HeroBannersProps {
  lang: Language;
  onSelectQuickCategory: (catKey: string) => void;
  onOpenCustomDesignModal: () => void;
}

export const HeroBanners: React.FC<HeroBannersProps> = ({
  lang,
  onSelectQuickCategory,
  onOpenCustomDesignModal
}) => {
  const t = translations[lang];
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      badge: lang === 'ar' ? 'تصميم مخصص مرخص' : '原创定制 · 官方首发',
      title: t.hero1Title,
      subtitle: t.hero1Sub,
      bgGradient: 'from-slate-900 via-indigo-950/80 to-blue-950/90',
      accentColor: 'text-cyan-400',
      tagline: 'GENUINE COMMERCIAL GIFT ANIMATION PLATFORM',
      btnText: lang === 'ar' ? 'طلب تصميم خاص للمؤثرات' : '咨询定制方案 →',
      action: onOpenCustomDesignModal
    },
    {
      id: 2,
      badge: lang === 'ar' ? 'المنصة الشاملة' : '一站式正版平台',
      title: t.hero2Title,
      subtitle: t.hero2Sub,
      bgGradient: 'from-slate-900 via-blue-950/80 to-cyan-950/90',
      accentColor: 'text-blue-400',
      tagline: 'MORE THAN 50,000+ ORIGINAL VFX ASSETS',
      btnText: lang === 'ar' ? 'استكشف الهدايا الرائجة' : '探索爆款礼物 →',
      action: () => onSelectQuickCategory('featured')
    },
    {
      id: 3,
      badge: lang === 'ar' ? 'مشاركة المصممين' : '创作者共享生态',
      title: t.hero3Title,
      subtitle: t.hero3Sub,
      bgGradient: 'from-slate-900 via-purple-950/80 to-indigo-950/90',
      accentColor: 'text-purple-400',
      tagline: 'OVER 100+ TOP 3D VFX ANIMATORS',
      btnText: lang === 'ar' ? 'المختارات المتميزة' : '设计师精选 →',
      action: () => onSelectQuickCategory('designer')
    }
  ];

  const quickBadges = [
    { key: 'vip', label: t.quickVip, icon: Crown, color: 'from-amber-500/20 to-yellow-600/20 text-amber-300 border-amber-500/40' },
    { key: 'featured', label: t.quickFeatured, icon: Sparkles, color: 'from-cyan-500/20 to-blue-600/20 text-cyan-300 border-cyan-500/40' },
    { key: 'overseas', label: t.quickOverseas, icon: Globe2, color: 'from-blue-500/20 to-indigo-600/20 text-blue-300 border-blue-500/40' },
    { key: 'ai', label: t.quickAi, icon: Bot, color: 'from-purple-500/20 to-pink-600/20 text-purple-300 border-purple-500/40' },
    { key: 'designer', label: t.quickDesigner, icon: Palette, color: 'from-emerald-500/20 to-teal-600/20 text-emerald-300 border-emerald-500/40' },
    { key: 'app', label: t.quickAppPacks, icon: Package, color: 'from-rose-500/20 to-red-600/20 text-rose-300 border-rose-500/40' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="mb-6 space-y-4">
      {/* Banner Carousel */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
        <div 
          className={`relative min-h-[170px] sm:min-h-[200px] md:min-h-[220px] p-6 sm:p-8 flex flex-col justify-center bg-gradient-to-r ${slides[currentSlide].bgGradient} transition-all duration-700`}
        >
          {/* Background Decorative Pattern & Glows */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 pointer-events-none overflow-hidden flex items-center justify-center">
            <div className="w-96 h-96 rounded-full bg-cyan-500/30 blur-3xl"></div>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-4 opacity-40 pointer-events-none">
            <div className="w-28 h-28 rounded-2xl border-2 border-cyan-400/30 rotate-12 flex items-center justify-center bg-cyan-500/10 backdrop-blur-sm">
              <Award className="w-14 h-14 text-cyan-400" />
            </div>
            <div className="w-24 h-24 rounded-2xl border-2 border-blue-400/30 -rotate-6 flex items-center justify-center bg-blue-500/10 backdrop-blur-sm">
              <ShieldCheck className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 text-[11px] font-semibold text-cyan-300 mb-3 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{slides[currentSlide].badge}</span>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug mb-2 drop-shadow-md">
              {slides[currentSlide].title}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 max-w-xl">
              {slides[currentSlide].subtitle}
            </p>

            <button
              onClick={slides[currentSlide].action}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <span>{slides[currentSlide].btnText}</span>
            </button>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={() => setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/70 border border-slate-700/70 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/70 border border-slate-700/70 text-slate-300 hover:text-white flex items-center justify-center backdrop-blur transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentSlide ? 'w-6 bg-cyan-400' : 'w-2 bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Category Feature Cards Row (100% clone of video 0:43 - 0:48) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {quickBadges.map((badge) => {
          const Icon = badge.icon;
          return (
            <button
              key={badge.key}
              onClick={() => onSelectQuickCategory(badge.key)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r ${badge.color} border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-95 group`}
            >
              <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold whitespace-nowrap">{badge.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
