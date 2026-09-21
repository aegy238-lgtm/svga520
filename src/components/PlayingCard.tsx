import React from 'react';
import { Card } from '../types/game';

interface PlayingCardProps {
  card?: Card;
  isFaceDown?: boolean;
  delay?: number;
  highlight?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isFaceDown = true,
  delay = 0,
  highlight = false,
}) => {
  const isRed = card?.suit === '♥' || card?.suit === '♦';

  return (
    <div
      className={`relative w-12 h-18 sm:w-14 sm:h-20 md:w-16 md:h-24 rounded-lg shadow-xl transition-all duration-500 transform preserve-3d ${
        highlight ? 'ring-2 ring-amber-400 -translate-y-1' : ''
      }`}
      style={{
        perspective: '1000px',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Front of Card */}
      <div
        className={`absolute inset-0 w-full h-full rounded-lg bg-white border border-slate-200 p-1 sm:p-1.5 flex flex-col justify-between select-none shadow-md transition-opacity duration-300 ${
          isFaceDown ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex justify-between items-start leading-none">
          <span
            className={`font-black text-xs sm:text-sm md:text-base ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.rank}
          </span>
          <span
            className={`text-xs sm:text-sm ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.suit}
          </span>
        </div>

        <div
          className={`self-center text-lg sm:text-2xl md:text-3xl ${
            isRed ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {card?.suit}
        </div>

        <div className="flex justify-between items-end rotate-180 leading-none">
          <span
            className={`font-black text-xs sm:text-sm md:text-base ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.rank}
          </span>
          <span
            className={`text-xs sm:text-sm ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.suit}
          </span>
        </div>
      </div>

      {/* Back of Card (Classic blue diamond lattice pattern from video) */}
      <div
        className={`absolute inset-0 w-full h-full rounded-lg bg-gradient-to-br from-blue-700 via-sky-600 to-indigo-900 border-2 border-white/80 p-1 flex items-center justify-center select-none shadow-md overflow-hidden transition-opacity duration-300 ${
          isFaceDown ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Diamond Lattice Pattern */}
        <div 
          className="w-full h-full rounded border border-blue-300/40 relative opacity-85"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px),
              linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%),
              linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.15) 75%)`,
            backgroundSize: '8px 8px, 12px 12px, 12px 12px',
            backgroundPosition: '0 0, 0 0, 6px 6px'
          }}
        >
          <div className="absolute inset-2 border border-white/30 rounded-sm flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border border-white/40 bg-blue-600/50 flex items-center justify-center">
              <span className="text-[9px] text-white/90">♠</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
