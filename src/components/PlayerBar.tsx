import React from 'react';
import { Plus } from 'lucide-react';

interface PlayerBarProps {
  playerName: string;
  avatarUrl: string;
  diamonds: number;
  todayRevenue: number;
  isAutoPlay: boolean;
  onToggleAutoPlay: () => void;
  onOpenRecharge: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  playerName,
  avatarUrl,
  diamonds,
  todayRevenue,
  isAutoPlay,
  onToggleAutoPlay,
  onOpenRecharge,
}) => {
  const formatNum = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="w-full max-w-[390px] mx-auto px-3 mt-2.5 mb-2 select-none">
      <div className="bg-emerald-950/60 backdrop-blur-md rounded-2xl p-2 border border-emerald-400/40 shadow-xl flex items-center justify-between gap-2">
        {/* Left: Player Profile & Balance */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar with VIP border */}
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-yellow-400 shadow-md bg-slate-800">
              <img
                src={avatarUrl}
                alt={playerName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            {/* VIP Crown/Badge */}
            <div className="absolute -top-1 -right-1 bg-red-600 text-yellow-300 text-[8px] font-black px-1 rounded-full border border-yellow-300 shadow leading-tight">
              VIP
            </div>
          </div>

          {/* Name & Diamonds */}
          <div className="flex flex-col min-w-0">
            {/* Name */}
            <div className="text-[11px] font-extrabold text-white truncate max-w-[90px] leading-tight">
              {playerName}
            </div>

            {/* Diamond Balance Pill */}
            <div className="flex items-center gap-1 mt-0.5 bg-black/40 rounded-full px-2 py-0.5 border border-amber-400/40">
              <span className="text-xs">💎</span>
              <span className="text-xs font-black text-amber-300">
                {formatNum(diamonds)}
              </span>
              <button
                type="button"
                onClick={onOpenRecharge}
                className="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-400 hover:from-cyan-500 hover:to-sky-300 text-white flex items-center justify-center ml-0.5 transition-transform active:scale-90 cursor-pointer shadow-xs"
                title="Recharge Diamonds"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>

        {/* Center: Today's Revenue */}
        <div className="flex flex-col items-center justify-center px-1 border-x border-emerald-500/30 min-w-0">
          <span className="text-[9px] font-bold text-amber-200/90 uppercase tracking-tight whitespace-nowrap">
            Today's Revenue:
          </span>
          <div className="flex items-center gap-1 text-[11px] font-black text-yellow-300 mt-0.5">
            <span className="text-[10px]">💎</span>
            <span className={todayRevenue > 0 ? 'text-emerald-300' : todayRevenue < 0 ? 'text-rose-400' : 'text-yellow-300'}>
              {todayRevenue > 0 ? `+${formatNum(todayRevenue)}` : formatNum(todayRevenue)}
            </span>
          </div>
        </div>

        {/* Right: Auto Play Button */}
        <button
          type="button"
          onClick={onToggleAutoPlay}
          className={`relative px-2.5 py-2 rounded-xl flex flex-col items-center justify-center font-black transition-all duration-200 shadow-lg cursor-pointer active:scale-95 flex-shrink-0 ${
            isAutoPlay
              ? 'bg-gradient-to-b from-red-500 to-rose-700 border-2 border-yellow-300 text-white animate-pulse'
              : 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 hover:from-yellow-200 hover:to-amber-400 border-2 border-yellow-200 text-amber-950'
          }`}
        >
          <span className="text-xs font-black tracking-wide leading-none">
            {isAutoPlay ? 'Auto ON' : 'Auto Play'}
          </span>
          <span className="text-[8px] opacity-85 leading-tight mt-0.5 font-bold">
            {isAutoPlay ? 'Tap to Stop' : 'Loop Bet'}
          </span>
        </button>
      </div>
    </div>
  );
};
