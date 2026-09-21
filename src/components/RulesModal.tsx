import React from 'react';
import { X, Award, HelpCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  const { t, isRTL, language } = useLanguage();
  if (!isOpen) return null;

  const handRankings = [
    {
      name: t.trioName,
      desc: t.trioDesc,
      badge: t.highest,
      color: 'text-amber-400 border-amber-400/40 bg-amber-500/10',
    },
    {
      name: t.pureSeqName,
      desc: t.pureSeqDesc,
      badge: t.veryRare,
      color: 'text-yellow-400 border-yellow-400/40 bg-yellow-500/10',
    },
    {
      name: t.seqName,
      desc: t.seqDesc,
      badge: t.strong,
      color: 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10',
    },
    {
      name: t.flushName,
      desc: t.flushDesc,
      badge: t.good,
      color: 'text-blue-400 border-blue-400/40 bg-blue-500/10',
    },
    {
      name: t.pairName,
      desc: t.pairDesc,
      badge: t.moderate,
      color: 'text-purple-400 border-purple-400/40 bg-purple-500/10',
    },
    {
      name: t.highCardName,
      desc: t.highCardDesc,
      badge: t.standard,
      color: 'text-slate-300 border-slate-700 bg-slate-800/40',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <button
          id="btn-close-rules"
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors`}
          title={t.rulesTitle}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{t.rulesTitle}</h3>
            <p className="text-xs text-slate-400">
              {t.rulesSubtitle}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {handRankings.map((h, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-2xl border ${h.color} flex flex-col gap-1`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-xs sm:text-sm text-white">{h.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/30 border border-white/20">
                  {h.badge}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{h.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
          <p className="font-bold text-amber-300">{language === 'ar' ? 'دورة الجولة:' : 'Round Cycle:'}</p>
          <p>{language === 'ar' ? '1. فترة الرهان: اختر الفيشة وضع رهانك على الكرسي المفضل (A أو B أو C) قبل انتهاء العداد.' : '1. Betting Phase: Choose chip and place bet on chair (A, B, or C) before countdown ends.'}</p>
          <p>{language === 'ar' ? '2. فترة التوزيع: توزع 3 أوراق لكل كرسي مقلوبة الوجه.' : '2. Dealing Phase: 3 cards are dealt face-down for each chair.'}</p>
          <p>{language === 'ar' ? '3. كشف النتائج: تكشف أوراق الكراسي وتحسب قوة الأيدي ويحصل الكرسي الفائز على كامل المجموع!' : '3. Showdown: Cards are revealed, hand ranks evaluated, and winning chair takes the pot!'}</p>
        </div>
      </div>
    </div>
  );
};
