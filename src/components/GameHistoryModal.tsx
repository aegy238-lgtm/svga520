import React from 'react';
import { GameHistoryEntry } from '../types/game';
import { X, Trophy, History, Coins, Clock } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: GameHistoryEntry[];
}

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
}) => {
  const { t, isRTL, language } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#fde7be] via-[#f7cb93] to-[#fad6a5] border-4 border-amber-400 rounded-3xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto text-amber-950">
        <button
          id="btn-close-history-modal"
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center font-bold shadow`}
          title={t.gameHistory}
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-950">{t.gameHistory}</h3>
            <p className="text-xs text-amber-800 font-semibold">{t.gameHistorySubtitle}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {history.length === 0 ? (
            <div className="text-center py-10 text-amber-800">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="font-bold">{t.noRoundsYet}</p>
              <p className="text-xs">{t.placeChipsPrompt}</p>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-2xl bg-white/70 border border-amber-900/15 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-900/10 text-xs font-black text-amber-950 font-mono">
                      {language === 'ar' ? `الجولة #${entry.roundNumber}` : `Round #${entry.roundNumber}`}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-black text-amber-800">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t.pot}: {entry.totalPot.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-amber-800/80">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Winning Chair highlight */}
                <div className="flex items-center justify-between bg-amber-500/20 border border-amber-500/40 p-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-600 fill-amber-600" />
                    <span className="text-xs font-black text-amber-950">
                      {t.winningChair}: <span className="underline">{language === 'ar' ? `كرسي ${entry.winningSpot}` : `Chair ${entry.winningSpot}`}</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                    {entry.winningHandName}
                  </span>
                </div>

                {/* Breakdown of spots if present */}
                {entry.spotsSummary && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px]">
                    {entry.spotsSummary.map((s) => (
                      <div
                        key={s.spot}
                        className={`p-1.5 rounded-lg border text-center ${
                          s.isWinner
                            ? 'bg-amber-100 border-amber-500 font-bold text-amber-950 ring-1 ring-amber-400'
                            : 'bg-white/40 border-amber-900/10 text-amber-800'
                        }`}
                      >
                        <p className="font-black text-xs">{language === 'ar' ? `كرسي ${s.spot}` : `Chair ${s.spot}`}</p>
                        <p className="text-[10px] text-amber-900/70 truncate">{s.handName}</p>
                        <p className="font-mono text-[10px] font-bold">{t.pot}: {s.pot}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
