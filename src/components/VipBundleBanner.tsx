import React from 'react';
import { Crown, Gift, Sparkles, Gem, Flame, Rocket, Star, Layers, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { VipBundle, Language } from '../types';

interface VipBundleBannerProps {
  lang: Language;
  bundles: VipBundle[];
  onOpenBundle: (bundle: VipBundle) => void;
}

export const VipBundleBanner: React.FC<VipBundleBannerProps> = ({
  lang,
  bundles,
  onOpenBundle
}) => {
  // Only show bundles that are marked visible
  const visibleBundles = bundles.filter(b => b.isVisible !== false);

  if (visibleBundles.length === 0) return null;

  const renderBundleIcon = (iconKey?: string) => {
    switch (iconKey) {
      case 'crown': return <Crown className="w-6 h-6 text-amber-400" />;
      case 'sparkles': return <Sparkles className="w-6 h-6 text-amber-300" />;
      case 'gem': return <Gem className="w-6 h-6 text-cyan-400" />;
      case 'flame': return <Flame className="w-6 h-6 text-orange-400" />;
      case 'rocket': return <Rocket className="w-6 h-6 text-purple-400" />;
      case 'star': return <Star className="w-6 h-6 text-yellow-400" />;
      case 'layers': return <Layers className="w-6 h-6 text-blue-400" />;
      default: return <Gift className="w-6 h-6 text-amber-400" />;
    }
  };

  return (
    <div className="mb-6 space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></div>
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 fill-current" />
            {lang === 'ar' ? 'باقات وهدايا VIP المميزة' : 'Featured VIP Bundles'}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {lang === 'ar' ? 'اضغط على الباقة لفتح كافة الروابط الحصرية' : 'Click to view all included links'}
        </span>
      </div>

      <div className={`grid gap-3.5 ${
        visibleBundles.length === 1 
          ? 'grid-cols-1' 
          : visibleBundles.length === 2 
          ? 'grid-cols-1 md:grid-cols-2' 
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      }`}>
        {visibleBundles.map((bundle) => {
          const count = bundle.subItems ? bundle.subItems.length : 0;

          return (
            <div
              key={bundle.id}
              onClick={() => onOpenBundle(bundle)}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#141926] via-[#101420] to-[#0d101a] border border-amber-500/40 hover:border-amber-400/80 p-4 sm:p-5 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/15 transition-all duration-300 cursor-pointer group hover:-translate-y-0.5"
            >
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none"></div>

              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-600/20 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 group-hover:border-amber-400 transition-all">
                    {renderBundleIcon(bundle.icon)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                        {bundle.name}
                      </h3>
                      {bundle.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {bundle.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                      {bundle.description}
                    </p>

                    <div className="flex items-center gap-3 mt-3 text-[11px]">
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {count} {lang === 'ar' ? 'روابط وباقات مشمولة' : 'Links Included'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow / Button Indicator */}
                <div className="shrink-0 self-center">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 group-hover:bg-amber-500 border border-amber-500/30 group-hover:border-amber-400 text-amber-400 group-hover:text-slate-950 flex items-center justify-center shadow-md transition-all">
                    {lang === 'ar' ? (
                      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                    ) : (
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
