import React from 'react';
import { X, Trophy, Medal, Flame } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface RankModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RankModal: React.FC<RankModalProps> = ({ isOpen, onClose }) => {
  const { t, isRTL, language } = useLanguage();
  if (!isOpen) return null;

  const topWinners = [
    { rank: 1, name: 'Sultan_VIP', winnings: '1,450,000', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80', badge: `🥇 ${t.topWinner}` },
    { rank: 2, name: 'RoyalQueen', winnings: '980,000', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80', badge: `🥈 ${t.master}` },
    { rank: 3, name: 'LuckyAce77', winnings: '640,000', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80', badge: `🥉 ${t.highRoller}` },
    { rank: 4, name: 'GoldKnight', winnings: '420,000', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80', badge: t.pro },
    { rank: 5, name: 'DiamondPlayer', winnings: '310,000', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80', badge: t.vip },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#fde7be] via-[#f7cb93] to-[#fad6a5] border-4 border-amber-400 rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto text-amber-950">
        <button
          id="btn-close-rank-modal"
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-bold shadow transition-transform active:scale-95`}
          title={t.rankTitle}
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-950">{t.rankTitle}</h3>
            <p className="text-xs text-amber-800 font-semibold">{t.rankSubtitle}</p>
          </div>
        </div>

        <div className="space-y-2">
          {topWinners.map((winner) => (
            <div
              key={winner.rank}
              className={`p-3 rounded-2xl flex items-center justify-between border ${
                winner.rank === 1
                  ? 'bg-amber-100/90 border-amber-500 shadow-md ring-1 ring-amber-400'
                  : 'bg-white/70 border-amber-900/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                    winner.rank === 1
                      ? 'bg-amber-500 text-white'
                      : winner.rank === 2
                      ? 'bg-slate-400 text-white'
                      : winner.rank === 3
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {winner.rank}
                </span>
                <img
                  src={winner.avatar}
                  alt={winner.name}
                  className="w-9 h-9 rounded-full object-cover border-2 border-amber-400 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950">{winner.name}</h4>
                  <span className="text-[10px] font-semibold text-amber-800">{winner.badge}</span>
                </div>
              </div>

              <div className={isRTL ? 'text-left' : 'text-right'}>
                <span className="text-xs sm:text-sm font-mono font-black text-amber-900">
                  +{winner.winnings}
                </span>
                <div className={`flex items-center ${isRTL ? 'justify-start' : 'justify-end'} gap-0.5 text-[9px] text-amber-700 font-bold`}>
                  <Flame className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                  <span>{t.winnings}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
