import React from 'react';

interface ResultsBarProps {
  results: string[]; // array of foodIds from newest to oldest
}

export const ResultsBar: React.FC<ResultsBarProps> = ({ results }) => {
  return (
    <div className="w-full max-w-[390px] mx-auto px-3 mt-2 select-none">
      <div className="flex items-center gap-2 bg-emerald-950/25 backdrop-blur-xs rounded-xl p-1.5 border border-emerald-400/30 shadow-inner overflow-hidden">
        {/* Label */}
        <div className="text-[11px] font-black text-amber-200 tracking-wide pl-1 whitespace-nowrap flex-shrink-0 drop-shadow-sm">
          Results:
        </div>

        {/* Scrollable Results List */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-0.5">
          {results.length === 0 ? (
            <div className="text-[10px] text-amber-200/70 italic px-2">Spin to see past results...</div>
          ) : (
            results.map((foodId, idx) => {
              const isNewest = idx === 0;
              return (
                <div key={`${foodId}-${idx}`} className="relative flex-shrink-0 flex flex-col items-center">
                  {/* NEW Tag */}
                  {isNewest && (
                    <div className="absolute -top-2.5 z-10 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-md animate-bounce border border-yellow-300 uppercase leading-tight tracking-wider">
                      NEW
                    </div>
                  )}

                  {/* Circular Result Badge */}
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
                      isNewest
                        ? 'bg-gradient-to-b from-yellow-100 to-amber-300 ring-2 ring-yellow-400 ring-offset-1 ring-offset-amber-950 scale-105'
                        : 'bg-white/90 border border-amber-300/80 hover:bg-white'
                    }`}
                  >
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
