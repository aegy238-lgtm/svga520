import React from 'react';
import { HandEvaluation, Player, RoundPhase } from '../types/game';
import { PlayingCard } from './PlayingCard';
import { Crown, Sparkles } from 'lucide-react';

interface PlayerSeatProps {
  player: Player | null;
  seatIndex: number;
  isSelf: boolean;
  phase: RoundPhase;
  isWinner: boolean;
  evaluation?: HandEvaluation;
  totalPot: number;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isSelf,
  phase,
  isWinner,
  evaluation,
}) => {
  if (!player) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/40 border border-dashed border-cyan-500/20 backdrop-blur-sm min-w-[200px] sm:min-w-[240px]">
        <div className="w-12 h-12 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center text-cyan-400/50 text-xs">
          Open
        </div>
        <div className="text-xs text-slate-400 font-medium">Waiting for player...</div>
      </div>
    );
  }

  const isCardsVisible = phase === 'SHOWDOWN' || phase === 'RESULTS';
  const hasPlacedBet = player.currentBet > 0;

  return (
    <div
      className={`relative flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-2xl transition-all duration-300 backdrop-blur-md ${
        isWinner
          ? 'bg-amber-500/20 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.4)] scale-105'
          : isSelf
          ? 'bg-cyan-950/60 border border-cyan-400/50 shadow-lg shadow-cyan-950/40'
          : 'bg-slate-900/70 border border-slate-700/60'
      }`}
    >
      {/* Winner Laurel Wreath & Crown Animation */}
      {isWinner && (
        <div className="absolute -top-3.5 -left-2 z-20 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-lg animate-bounce">
          <Crown className="w-3.5 h-3.5" />
          <span>WINNER!</span>
          <Sparkles className="w-3 h-3 text-amber-950" />
        </div>
      )}

      {/* Reaction Emoji Bubble during showdown */}
      {isCardsVisible && player.lastReaction && (
        <div className="absolute -top-5 right-2 z-20 text-2xl sm:text-3xl animate-bounce">
          {player.lastReaction === 'win' ? '😆' : player.lastReaction === 'lose' ? '😢' : '😐'}
        </div>
      )}

      {/* Player Avatar & Info */}
      <div className="flex flex-col items-center shrink-0">
        <div className="relative">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 transition-all duration-300 shadow-md ${
              isWinner
                ? 'border-yellow-400 ring-4 ring-yellow-400/30'
                : isSelf
                ? 'border-cyan-400 ring-2 ring-cyan-400/20'
                : 'border-slate-500'
            }`}
          >
            <img
              src={player.avatar}
              alt={player.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Auto-Play Indicator Badge */}
          {player.isAutoPlay && (
            <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-[9px] text-slate-950 font-extrabold px-1 rounded-full shadow">
              AUTO
            </div>
          )}
        </div>

        {/* Player Name */}
        <div className="mt-1 text-center max-w-[70px] sm:max-w-[85px]">
          <p className="text-[11px] sm:text-xs font-bold text-slate-100 truncate">
            {isSelf ? `${player.name} (You)` : player.name}
          </p>
          <p className="text-[10px] text-amber-400 font-semibold font-mono">
            {player.chips.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Center / Cards Section */}
      <div className="flex flex-col items-start gap-1">
        {/* Pot & Mine Badge */}
        <div className="flex items-center gap-2 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-700/50 text-[10px] sm:text-[11px] font-mono">
          <span className="text-slate-400">
            Pot:<strong className="text-amber-400 ml-1">{player.currentBet > 0 ? player.currentBet * 3 : 0}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">
            Mine:<strong className="text-emerald-400 ml-1">{player.currentBet}</strong>
          </span>
          {hasPlacedBet && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </div>

        {/* Cards container */}
        <div className="relative flex items-center -space-x-4 sm:-space-x-5 mt-0.5">
          {player.cards && player.cards.length === 3 ? (
            <>
              {player.cards.map((c, i) => (
                <PlayingCard
                  key={i}
                  card={c}
                  isFaceDown={!isCardsVisible}
                  delay={i * 80}
                  highlight={isWinner}
                />
              ))}

              {/* Hand Category Label Ribbon (Matching Video yellow ribbon e.g. "High card") */}
              {isCardsVisible && evaluation && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 text-[10px] sm:text-[11px] font-extrabold px-2 sm:px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap border border-yellow-200">
                  {evaluation.rankName}
                </div>
              )}
            </>
          ) : (
            /* Placeholder slots before cards are dealt */
            <div className="flex -space-x-4 sm:-space-x-5 opacity-40">
              {[0, 1, 2].map(idx => (
                <div
                  key={idx}
                  className="w-12 h-18 sm:w-14 sm:h-20 md:w-16 md:h-24 rounded-lg border-2 border-dashed border-slate-600 bg-slate-800/30"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
