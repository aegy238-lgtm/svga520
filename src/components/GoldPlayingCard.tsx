import React from 'react';
import { Card } from '../types/game';

interface GoldPlayingCardProps {
  card?: Card;
  isFaceDown?: boolean;
  highlight?: boolean;
}

export const GoldPlayingCard: React.FC<GoldPlayingCardProps> = ({
  card,
  isFaceDown = true,
  highlight = false,
}) => {
  const isRed = card?.suit === '♥' || card?.suit === '♦';

  return (
    <div
      className={`relative w-7 h-10 xs:w-8 xs:h-12 sm:w-10 sm:h-14 md:w-12 md:h-16 transition-transform duration-500 preserve-3d cursor-pointer ${
        highlight ? 'scale-110 -translate-y-2 z-30' : 'hover:-translate-y-1'
      }`}
      style={{
        transform: isFaceDown ? 'rotateY(0deg)' : 'rotateY(180deg)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D Drop Shadow projected on felt */}
      <div 
        className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-300 ${
          highlight 
            ? 'shadow-[0_12px_24px_rgba(250,204,21,0.5),0_6px_12px_rgba(0,0,0,0.8)]' 
            : 'shadow-[0_8px_16px_rgba(0,0,0,0.6)]'
        }`}
      />

      {/* Back Face (Golden Patterned Back - 0deg) */}
      <div
        className="absolute inset-0 w-full h-full rounded-lg border border-amber-300/80 bg-gradient-to-b from-[#ffea9f] via-[#f59e0b] to-[#b45309] p-0.5 flex items-center justify-center select-none overflow-hidden backface-hidden shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),inset_0_-2px_4px_rgba(0,0,0,0.5)]"
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Inner Gold Guilloche & Diamond Mesh Pattern */}
        <div className="w-full h-full rounded border border-amber-100/60 flex items-center justify-center relative bg-gradient-to-tr from-amber-500/30 via-transparent to-yellow-200/40">
          {/* Subtle Royal Medallion Watermark */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-amber-200/80 bg-yellow-300/40 flex items-center justify-center shadow-inner">
            <span className="text-[10px] sm:text-xs text-amber-950 font-serif leading-none font-black">👑</span>
          </div>

          {/* Corner Gold Flourishes */}
          <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l border-amber-100/90" />
          <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t border-r border-amber-100/90" />
          <div className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b border-l border-amber-100/90" />
          <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r border-amber-100/90" />
        </div>
      </div>

      {/* Front Face (Crisp Casino Card - 180deg) */}
      <div
        className={`absolute inset-0 w-full h-full rounded-lg bg-gradient-to-b from-white via-slate-50 to-slate-100 border border-slate-300 p-0.5 sm:p-1 flex flex-col justify-between select-none backface-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,1),inset_0_-2px_3px_rgba(0,0,0,0.15)] ${
          highlight ? 'ring-2 ring-yellow-400' : ''
        }`}
        style={{
          transform: 'rotateY(180deg)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* Top Left Rank & Suit */}
        <div className="flex justify-between items-start leading-none">
          <span
            className={`font-black text-[9px] sm:text-[11px] md:text-xs tracking-tight ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.rank}
          </span>
          <span
            className={`text-[8px] sm:text-[10px] ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.suit}
          </span>
        </div>

        {/* Center Suit Symbol with Depth */}
        <div
          className={`self-center text-xs sm:text-base md:text-xl font-bold filter drop-shadow-sm ${
            isRed ? 'text-red-600' : 'text-slate-900'
          }`}
        >
          {card?.suit}
        </div>

        {/* Bottom Right Inverted Rank & Suit */}
        <div className="flex justify-between items-end rotate-180 leading-none">
          <span
            className={`font-black text-[9px] sm:text-[11px] md:text-xs tracking-tight ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.rank}
          </span>
          <span
            className={`text-[8px] sm:text-[10px] ${
              isRed ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {card?.suit}
          </span>
        </div>
      </div>
    </div>
  );
};

