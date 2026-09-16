import React from 'react';
import { ChevronRight, Flame, History, Trophy } from 'lucide-react';

interface QuickLinksBarProps {
  topPlayerName?: string;
  topPlayerRevenue?: number;
  onOpenRankList: () => void;
  onOpenHistory: () => void;
}

export const QuickLinksBar: React.FC<QuickLinksBarProps> = ({
  topPlayerName = 'MR. JIGAR',
  topPlayerRevenue = 3015000,
  onOpenRankList,
  onOpenHistory,
}) => {
  const formatNum = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="w-full max-w-[390px] mx-auto px-3 mt-4 flex items-center gap-2 select-none">
      {/* Today RankList Card */}
      <button
        type="button"
        onClick={onOpenRankList}
        className="flex-1 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-200 hover:from-amber-200 hover:to-yellow-200 border border-amber-400 rounded-xl px-2.5 py-1.5 shadow-md flex items-center justify-between transition-transform active:scale-98 cursor-pointer group"
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-inner flex-shrink-0">
            <Trophy className="w-3.5 h-3.5 fill-amber-100 text-amber-900" />
          </div>
          <div className="flex flex-col items-start leading-tight min-w-0">
            <div className="flex items-center gap-0.5 text-[10px] font-bold text-amber-900">
              <span className="truncate">{topPlayerName}</span>
              <Flame className="w-2.5 h-2.5 text-red-500 fill-red-500 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-amber-700">
              <span className="text-[9px]">💎</span>
              <span>{formatNum(topPlayerRevenue)}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-700 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </button>

      {/* MyHistory Card */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="flex-1 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-200 hover:from-amber-200 hover:to-orange-200 border border-amber-400 rounded-xl px-2.5 py-1.5 shadow-md flex items-center justify-between transition-transform active:scale-98 cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-400 to-amber-300 flex items-center justify-center text-amber-950 shadow-inner flex-shrink-0">
            <History className="w-3.5 h-3.5 text-amber-950" />
          </div>
          <div className="text-xs font-black text-amber-900">
            MyHistory
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-amber-700 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </button>
    </div>
  );
};
