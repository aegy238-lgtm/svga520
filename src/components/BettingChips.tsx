import React from 'react';
import { Users } from 'lucide-react';

interface BettingChipsProps {
  chips: number[];
  selectedBet: number;
  onSelectBet: (amount: number) => void;
  isAutoPlay: boolean;
  onToggleAutoPlay: () => void;
  totalPlayers: number;
  disabled?: boolean;
}

export const BettingChips: React.FC<BettingChipsProps> = ({
  chips,
  selectedBet,
  onSelectBet,
  isAutoPlay,
  onToggleAutoPlay,
  totalPlayers,
  disabled = false,
}) => {
  const getChipStyle = (val: number) => {
    if (val <= 100) {
      return {
        bg: 'from-amber-400 via-yellow-500 to-amber-600 border-amber-300 text-slate-950',
        label: val >= 1000 ? `${val / 1000}K` : String(val),
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
      };
    } else if (val <= 1000) {
      return {
        bg: 'from-pink-500 via-rose-600 to-purple-700 border-pink-300 text-white',
        label: val >= 1000 ? `${val / 1000}K` : String(val),
        glow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]',
      };
    } else if (val <= 5000) {
      return {
        bg: 'from-indigo-500 via-purple-600 to-violet-800 border-indigo-300 text-white',
        label: `${val / 1000}K`,
        glow: 'shadow-[0_0_15px_rgba(129,140,248,0.5)]',
      };
    } else {
      return {
        bg: 'from-emerald-500 via-teal-600 to-emerald-800 border-emerald-300 text-white',
        label: `${val / 1000}K`,
        glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
      };
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:gap-2.5">
      {/* Chips Stack */}
      <div className="flex flex-col gap-2 sm:gap-2.5 items-center bg-slate-950/40 p-2 sm:p-2.5 rounded-3xl border border-cyan-500/20 backdrop-blur-md">
        {chips.map((val) => {
          const style = getChipStyle(val);
          const isSelected = selectedBet === val;

          return (
            <button
              key={val}
              id={`chip-bet-${val}`}
              onClick={() => onSelectBet(val)}
              disabled={disabled}
              className={`relative group w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all duration-200 select-none shadow-md ${
                isSelected
                  ? `scale-110 ring-4 ring-amber-300 ${style.glow}`
                  : 'hover:scale-105 hover:brightness-110'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
            >
              {/* Outer Casino Chip Ridges */}
              <div
                className={`w-full h-full rounded-full bg-gradient-to-b ${style.bg} p-1 border-2 flex items-center justify-center`}
              >
                {/* Inner Ring with Dashes */}
                <div className="w-full h-full rounded-full border border-dashed border-white/60 flex items-center justify-center">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/20 backdrop-blur-xs flex items-center justify-center font-extrabold tracking-tighter">
                    {style.label}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* AUTO PLAY Button (Matching Video luminous blue pill) */}
      <button
        id="btn-toggle-autoplay"
        onClick={onToggleAutoPlay}
        className={`w-full py-1.5 px-3 rounded-full text-[11px] sm:text-xs font-black tracking-wider transition-all duration-300 flex items-center justify-center shadow-lg select-none ${
          isAutoPlay
            ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] ring-2 ring-cyan-300'
            : 'bg-slate-900/80 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 hover:border-cyan-400'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isAutoPlay ? 'bg-emerald-300 animate-pulse' : 'bg-slate-500'
            }`}
          />
          AUTO PLAY
        </span>
      </button>

      {/* Players Counter Pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-700/50 text-[10px] sm:text-xs font-medium text-slate-300">
        <Users className="w-3.5 h-3.5 text-cyan-400" />
        <span>{totalPlayers} Players</span>
      </div>
    </div>
  );
};
