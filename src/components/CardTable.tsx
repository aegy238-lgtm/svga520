import React, { useEffect, useRef } from 'react';
import { HandEvaluation, Player, RoundPhase, TableState } from '../types/game';
import { PlayerSeat } from './PlayerSeat';
import { BettingChips } from './BettingChips';
import { sound } from '../lib/audio';
import confetti from 'canvas-confetti';
import { Coins, Sparkles, Trophy, AlertCircle } from 'lucide-react';

interface CardTableProps {
  table: TableState;
  currentUserId: string;
  selectedBet: number;
  onSelectBet: (amount: number) => void;
  onToggleAutoPlay: () => void;
  isAutoPlay: boolean;
  onPlaceBet: (amount: number) => void;
  onInsufficientBalance: () => void;
  userBalance: number;
}

export const CardTable: React.FC<CardTableProps> = ({
  table,
  currentUserId,
  selectedBet,
  onSelectBet,
  onToggleAutoPlay,
  isAutoPlay,
  onPlaceBet,
  onInsufficientBalance,
  userBalance,
}) => {
  const prevPhase = useRef<RoundPhase>(table.phase);
  const prevTimer = useRef<number>(table.timerRemaining);

  // Play audio sound effects based on phase and timer changes
  useEffect(() => {
    // Sound on phase transition
    if (prevPhase.current !== table.phase) {
      if (table.phase === 'COUNTDOWN') {
        sound.playGameStart();
      } else if (table.phase === 'DEALING') {
        sound.playDealCard();
      } else if (table.phase === 'SHOWDOWN' || table.phase === 'RESULTS') {
        sound.playWinFanfare();

        // Trigger celebratory confetti if current user won!
        if (table.currentWinnerIds.includes(currentUserId)) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#10b981', '#06b6d4', '#ec4899', '#fbbf24'],
          });
        }
      }
      prevPhase.current = table.phase;
    }

    // Timer tick audio for last 5 seconds of countdown
    if (
      table.phase === 'COUNTDOWN' &&
      table.timerRemaining <= 5 &&
      table.timerRemaining > 0 &&
      prevTimer.current !== table.timerRemaining
    ) {
      sound.playTimerTick();
    }
    prevTimer.current = table.timerRemaining;
  }, [table.phase, table.timerRemaining, table.currentWinnerIds, currentUserId]);

  const handleBetClick = (amount: number) => {
    onSelectBet(amount);
    if (userBalance < amount) {
      onInsufficientBalance();
      return;
    }
    sound.playChipBet();
    onPlaceBet(amount);
  };

  const humanPlayer = table.players.find((p) => p && p.id === currentUserId);
  const isGameDisabled = !table.isGameActive;

  // Seat positioning: 3 seats around the table
  const seat0 = table.players[0] || null; // Bottom / Main Player
  const seat1 = table.players[1] || null; // Top-Right (e.g. Sophia)
  const seat2 = table.players[2] || null; // Top-Left (e.g. Chef Raj)

  const activePlayersCount = table.players.filter((p) => p !== null).length;

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* Game Disabled Banner */}
      {isGameDisabled && (
        <div className="absolute top-4 z-40 px-4 py-2 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>Game is temporarily disabled by admin. Please wait...</span>
        </div>
      )}

      {/* Main Playing Field */}
      <div className="relative w-full max-w-5xl flex items-center justify-center gap-3 sm:gap-6">
        {/* Left Side: Betting Chips & Auto Play (Matching video frame 0) */}
        <div className="z-20 shrink-0">
          <BettingChips
            chips={table.availableChips}
            selectedBet={selectedBet}
            onSelectBet={handleBetClick}
            isAutoPlay={isAutoPlay}
            onToggleAutoPlay={onToggleAutoPlay}
            totalPlayers={activePlayersCount}
            disabled={table.phase !== 'COUNTDOWN' || isGameDisabled}
          />
        </div>

        {/* The Oval Poker Felt Table */}
        <div className="relative flex-1 aspect-[16/10] sm:aspect-[16/9] max-h-[72vh] rounded-[45px] sm:rounded-[75px] md:rounded-[90px] border-[10px] sm:border-[16px] md:border-[20px] border-slate-900 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_10px_30px_rgba(0,0,0,0.9)] bg-gradient-to-br from-[#0d3b43] via-[#082a30] to-[#04191d] flex flex-col justify-between p-3 sm:p-6 overflow-hidden select-none">
          {/* Outer Chrome / Neon Felt Accent Line */}
          <div className="absolute inset-2 sm:inset-3 rounded-[35px] sm:rounded-[60px] md:rounded-[70px] border border-cyan-400/25 pointer-events-none shadow-[inset_0_0_40px_rgba(6,182,212,0.12)]" />

          {/* Table Center Watermark / Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
            <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border-4 border-white flex items-center justify-center">
              <span className="font-serif text-6xl text-white font-black">ROYAL</span>
            </div>
          </div>

          {/* TOP ROW: Opponent Seats (Seat 2 & Seat 1) */}
          <div className="relative z-10 w-full flex items-start justify-between gap-2 px-1 sm:px-4">
            {/* Seat 2 (Left Opponent, e.g., Chef Raj) */}
            <div className="w-1/2 flex justify-start">
              <PlayerSeat
                player={seat2}
                seatIndex={2}
                isSelf={seat2?.id === currentUserId}
                phase={table.phase}
                isWinner={table.currentWinnerIds.includes(seat2?.id || '')}
                evaluation={seat2 ? table.evaluations[seat2.id] : undefined}
                totalPot={table.totalPot}
              />
            </div>

            {/* Seat 1 (Right Opponent, e.g., Sophia) */}
            <div className="w-1/2 flex justify-end">
              <PlayerSeat
                player={seat1}
                seatIndex={1}
                isSelf={seat1?.id === currentUserId}
                phase={table.phase}
                isWinner={table.currentWinnerIds.includes(seat1?.id || '')}
                evaluation={seat1 ? table.evaluations[seat1.id] : undefined}
                totalPot={table.totalPot}
              />
            </div>
          </div>

          {/* TABLE CENTER: Pot, Chips Pile, & Game Start / Starting Countdown Banner */}
          <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
            {/* Active Pot Badge with Casino Chips */}
            <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-slate-950/70 border border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-md mb-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 text-[9px] font-black">
                <Coins className="w-2.5 h-2.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-mono font-black text-amber-300">
                POT: {table.totalPot.toLocaleString()}
              </span>
            </div>

            {/* PHASE 1: COUNTDOWN / "Game Start" Banner (Matching Video Frames 0 to 16) */}
            {table.phase === 'COUNTDOWN' && (
              <div className="relative flex items-center justify-center">
                {/* Glossy Green / Gold Banner */}
                <div className="relative flex items-center gap-3 px-6 sm:px-8 py-2 rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-800 border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                  <span className="text-white font-serif font-black tracking-wider text-sm sm:text-lg md:text-xl drop-shadow-md">
                    Game Start
                  </span>

                  {/* Circular Countdown Timer Badge (e.g. 16, 15, 14... 1) */}
                  <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-950/80 border-2 border-amber-300 flex items-center justify-center text-white font-mono font-black text-xs sm:text-sm shadow-inner">
                    <span className={table.timerRemaining <= 5 ? 'text-amber-400 animate-ping absolute' : ''}>
                      {table.timerRemaining}
                    </span>
                    <span>{table.timerRemaining}</span>
                  </div>
                </div>
              </div>
            )}

            {/* PHASE 2: DEALING / "Starting 3s... 2s... 1s..." (Matching Video Frame 29) */}
            {table.phase === 'DEALING' && (
              <div className="animate-pulse flex items-center justify-center">
                <div className="px-5 sm:px-7 py-2 rounded-2xl bg-slate-950/80 border border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-md">
                  <span className="text-cyan-300 font-black tracking-wide text-sm sm:text-base md:text-lg">
                    Starting {table.timerRemaining}s
                  </span>
                </div>
              </div>
            )}

            {/* PHASE 3 & 4: SHOWDOWN & RESULTS */}
            {(table.phase === 'SHOWDOWN' || table.phase === 'RESULTS') && (
              <div className="flex flex-col items-center animate-fadeIn">
                <div className="flex items-center gap-2 px-5 py-1.5 rounded-2xl bg-amber-500/20 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
                  <Trophy className="w-5 h-5 text-amber-300 fill-amber-300 animate-bounce" />
                  <span className="text-white font-black tracking-wide text-xs sm:text-sm md:text-base">
                    {table.winningHand ? table.winningHand.rankName : 'Showdown Results'}
                  </span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <p className="text-[10px] sm:text-xs text-slate-300 mt-1 font-semibold">
                  Next round starting in {table.timerRemaining}s...
                </p>
              </div>
            )}
          </div>

          {/* BOTTOM ROW: Player Seat (Seat 0, e.g. User) */}
          <div className="relative z-10 w-full flex justify-center">
            <PlayerSeat
              player={seat0}
              seatIndex={0}
              isSelf={seat0?.id === currentUserId}
              phase={table.phase}
              isWinner={table.currentWinnerIds.includes(seat0?.id || '')}
              evaluation={seat0 ? table.evaluations[seat0.id] : undefined}
              totalPot={table.totalPot}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
