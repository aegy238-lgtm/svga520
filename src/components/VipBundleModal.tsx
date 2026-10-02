import React, { useState } from 'react';
import { 
  X, 
  Crown, 
  Gift, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Share2, 
  MessageCircle, 
  Download, 
  Layers, 
  Gem, 
  Flame, 
  Rocket, 
  Star,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { VipBundle, VipSubItem, Language } from '../types';

interface VipBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  bundles: VipBundle[];
  selectedBundleId?: string | null;
  onSelectBundleId?: (id: string) => void;
}

export const VipBundleModal: React.FC<VipBundleModalProps> = ({
  isOpen,
  onClose,
  lang,
  bundles,
  selectedBundleId,
  onSelectBundleId
}) => {
  if (!isOpen) return null;

  // Only show visible bundles to the end user
  const visibleBundles = bundles.filter(b => b.isVisible !== false);

  // Active bundle selection
  const [localSelectedId, setLocalSelectedId] = useState<string>(() => {
    if (selectedBundleId && visibleBundles.some(b => b.id === selectedBundleId)) {
      return selectedBundleId;
    }
    return visibleBundles[0]?.id || '';
  });

  const currentId = selectedBundleId || localSelectedId;
  const activeBundle = visibleBundles.find(b => b.id === currentId) || visibleBundles[0];

  // Copied link toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (subItem: VipSubItem) => {
    navigator.clipboard.writeText(subItem.url);
    setCopiedId(subItem.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSelectTab = (id: string) => {
    if (onSelectBundleId) {
      onSelectBundleId(id);
    } else {
      setLocalSelectedId(id);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-gradient-to-b from-[#141926] via-[#0e121c] to-[#0a0c13] border border-amber-500/40 shadow-2xl shadow-amber-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'باقات وهدايا VIP الحصرية' : 'Exclusive VIP Bundles'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  VIP ACCESS
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multiple Bundles Navigation Tabs (if more than 1 visible bundle) */}
        {visibleBundles.length > 1 && (
          <div className="px-5 pt-3 pb-2 flex items-center gap-2 overflow-x-auto border-b border-slate-800/60 bg-slate-950/40 shrink-0 scrollbar-none">
            {visibleBundles.map((b) => {
              const isActive = b.id === activeBundle?.id;
              return (
                <button
                  key={b.id}
                  onClick={() => handleSelectTab(b.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span>{b.name}</span>
                  {b.subItems && b.subItems.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {b.subItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
          {!activeBundle ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Crown className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm">{lang === 'ar' ? 'لا توجد باقات VIP متاحة حالياً' : 'No VIP bundles available at the moment'}</p>
            </div>
          ) : (
            <>
              {/* Selected Main Bundle Header Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/30 border border-amber-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-600/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
                      {renderBundleIcon(activeBundle.icon)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-black text-white">
                          {activeBundle.name}
                        </h3>
                        {activeBundle.badge && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {activeBundle.badge}
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-xl">
                        {activeBundle.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center shrink-0 self-start sm:self-center">
                    <div className="text-[10px] text-slate-400 font-medium">
                      {lang === 'ar' ? 'الروابط المتاحة' : 'Available Links'}
                    </div>
                    <div className="text-base font-black text-amber-300 font-mono">
                      {activeBundle.subItems?.length || 0} {lang === 'ar' ? 'روابط' : 'Links'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Items / Nested Links List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'ar' ? 'قائمة الروابط والباقات الفرعية المشمولة:' : 'Included Links & Sub-Packages:'}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {lang === 'ar' ? 'اضغط لفتح الرابط مباشرة' : 'Click to open directly'}
                  </span>
                </div>

                {!activeBundle.subItems || activeBundle.subItems.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                    {lang === 'ar' ? 'سيتم إضافة روابط هذه الباقة قريباً من قبل الإدارة.' : 'Links will be added soon.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {activeBundle.subItems.map((item, index) => {
                      const isCopied = copiedId === item.id;
                      const isWhatsApp = item.url.includes('wa.me') || item.url.includes('whatsapp');

                      return (
                        <div
                          key={item.id}
                          className={`p-4 rounded-2xl border transition-all group ${
                            item.isHighlighted
                              ? 'bg-gradient-to-r from-[#171c2b] to-[#121622] border-amber-500/40 shadow-md shadow-amber-500/5'
                              : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                            {/* Left: Number, Title, Description, Badge */}
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                                    {item.title}
                                  </h5>

                                  {item.badge && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {item.badge}
                                    </span>
                                  )}

                                  {item.priceText && (
                                    <span className="text-[10px] text-emerald-400 font-semibold">
                                      {item.priceText}
                                    </span>
                                  )}
                                </div>

                                {item.description && (
                                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {/* Copy Link Button */}
                              <button
                                type="button"
                                onClick={() => handleCopyLink(item)}
                                className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                                  isCopied
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                                title={lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                              >
                                {isCopied ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>

                              {/* Main Open Link Action */}
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                                  isWhatsApp
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                                    : 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-slate-950 shadow-amber-500/20'
                                }`}
                              >
                                {isWhatsApp ? (
                                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                )}
                                <span>{item.buttonText || (lang === 'ar' ? 'فتح الرابط' : 'Open Link')}</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#0b0e14] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'ar' ? 'يتم تحديث باقات VIP بشكل متواصل من الإدارة' : 'VIP bundles are continuously updated'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
