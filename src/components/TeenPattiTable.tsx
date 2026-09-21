import React, { useEffect, useRef } from 'react';
import { SpotId, TableState } from '../types/game';
import { RoyalChair } from './RoyalChair';
import { GoldPlayingCard } from './GoldPlayingCard';
import { CasinoChipsBar } from './CasinoChipsBar';
import { sound } from '../lib/audio';
import confetti from 'canvas-confetti';
import { Star, RotateCcw, X, Trophy, Sparkles, AlertCircle, ArrowRight, Crown, Coins } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface TeenPattiTableProps {
  table: TableState;
  userBalance: number;
  selectedChip: number;
  onSelectChip: (chip: number) => void;
  onPlaceBet: (spot: SpotId, amount: number) => void;
  onOpenTopUp: () => void;
  onOpenHistory: () => void;
  onOpenRules: () => void;
  onOpenRank: () => void;
  onCloseGame?: () => void;
}

export const TeenPattiTable: React.FC<TeenPattiTableProps> = ({
  table,
  userBalance,
  selectedChip,
  onSelectChip,
  onPlaceBet,
  onOpenTopUp,
  onOpenHistory,
  onOpenRules,
  onOpenRank,
  onCloseGame,
}) => {
  const { t, language } = useLanguage();
  const prevPhase = useRef(table.phase);
  const prevTimer = useRef(table.timerRemaining);

  const getRankDisplayName = (name: string) => {
    if (language !== 'ar') return name;
    if (name.includes('Trail') || name.includes('Trio')) return 'تريو (ثلاثية)';
    if (name.includes('Pure Sequence')) return 'متتالية نقية';
    if (name.includes('Sequence')) return 'متتالية';
    if (name.includes('Color') || name.includes('Flush')) return 'لون موحد';
    if (name.includes('Pair')) return 'زوج';
    if (name.includes('High Card')) return 'كرت عالي';
    return name;
  };

  // Audio triggers
  useEffect(() => {
    if (prevPhase.current !== table.phase) {
      if (table.phase === 'COUNTDOWN') {
        sound.playGameStart();
      } else if (table.phase === 'DEALING') {
        sound.playDealCard();
      } else if (table.phase === 'SHOWDOWN' || table.phase === 'RESULTS') {
        sound.playWinFanfare();
        if (table.winningSpot && table.userBets[table.winningSpot] > 0) {
          confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#e11d48', '#3b82f6', '#c026d3', '#fef08a'],
          });
        }
      }
      prevPhase.current = table.phase;
    }

    if (
      table.phase === 'COUNTDOWN' &&
      table.timerRemaining <= 5 &&
      table.timerRemaining > 0 &&
      prevTimer.current !== table.timerRemaining
    ) {
      sound.playTimerTick();
    }
    prevTimer.current = table.timerRemaining;
  }, [table.phase, table.timerRemaining, table.winningSpot, table.userBets]);

  const handleSpotClick = (spot: SpotId) => {
    if (table.phase !== 'COUNTDOWN') return;
    if (userBalance < selectedChip) {
      onOpenTopUp();
      return;
    }
    sound.playChipBet();
    onPlaceBet(spot, selectedChip);
  };

  const isRevealed = table.phase === 'SHOWDOWN' || table.phase === 'RESULTS';

  const spotsConfig: { id: SpotId; chairColor: 'blue' | 'magenta' | 'red'; name: string }[] = [
    { id: 'A', chairColor: 'blue', name: 'A' },
    { id: 'B', chairColor: 'magenta', name: 'B' },
    { id: 'C', chairColor: 'red', name: 'C' },
  ];

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center select-none py-0.5 sm:py-2 px-1">
      {/* 3D Casino Table Perspective Stage */}
      <div 
        className="relative w-full rounded-[22px] xs:rounded-[28px] sm:rounded-[36px] p-1.5 xs:p-2 sm:p-3.5 transition-all duration-500 overflow-hidden"
        style={{
          perspective: '1200px',
          background: 'linear-gradient(180deg, #2b1408 0%, #150903 60%, #2e160a 100%)',
          boxShadow: '0 30px 70px -10px rgba(0,0,0,0.95), 0 0 0 3px #ca8a04, 0 0 0 6px #5c2d12, inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -4px 10px rgba(0,0,0,0.9)',
        }}
      >
        {/* Table Rail Gold Rivets / Studs */}
        <div className="absolute top-2 left-3 w-2 h-2 rounded-full bg-yellow-400 border border-amber-900 shadow-sm" />
        <div className="absolute top-2 right-3 w-2 h-2 rounded-full bg-yellow-400 border border-amber-900 shadow-sm" />
        <div className="absolute bottom-2 left-3 w-2 h-2 rounded-full bg-yellow-400 border border-amber-900 shadow-sm" />
        <div className="absolute bottom-2 right-3 w-2 h-2 rounded-full bg-yellow-400 border border-amber-900 shadow-sm" />

        {/* 3D Emerald Casino Felt Baize */}
        <div 
          className="relative w-full rounded-[18px] xs:rounded-[22px] sm:rounded-[28px] p-1.5 xs:p-2.5 sm:p-4 flex flex-col justify-between overflow-hidden border border-emerald-400/30"
          style={{
            background: 'radial-gradient(ellipse at 50% 25%, #19583b 0%, #0d3623 55%, #051b11 100%)',
            boxShadow: 'inset 0 0 45px rgba(0,0,0,0.85), inset 0 1px 2px rgba(255,255,255,0.2)',
          }}
        >
          {/* Silkscreen Golden Table Arc Line (Authentic Casino Table Print) */}
          <div className="absolute top-8 inset-x-4 h-24 border-b-2 border-yellow-400/20 rounded-[50%] pointer-events-none" />
          <div className="absolute top-11 inset-x-8 text-center pointer-events-none">
            <span className="text-[7px] xs:text-[8px] sm:text-[9px] font-mono tracking-[0.2em] sm:tracking-[0.25em] text-yellow-300/30 font-bold uppercase">
              ★ ROYAL TEEN PATTI • LIVE CASINO • PAYS 1:1 ★
            </span>
          </div>

          {/* Top Header Marquee Bar */}
          <div className="relative w-full flex items-center justify-between mb-1.5 sm:mb-2 z-20">
            {/* Back to Lobby 3D Button */}
            <button
              id="btn-back-to-lobby"
              onClick={onCloseGame}
              className="px-2 xs:px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg xs:rounded-xl bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 hover:brightness-110 border border-amber-300/70 text-white font-black text-[9px] xs:text-[10px] sm:text-xs shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center gap-1 sm:gap-1.5 transition-transform active:translate-y-0.5 cursor-pointer"
              title={t.backToLobby}
            >
              <ArrowRight className="w-3 h-3 xs:w-3.5 xs:h-3.5 rtl:rotate-0 ltr:rotate-180 text-amber-300" />
              <span>{t.lobby}</span>
            </button>

            {/* 3D Gold Arched Table Plaque */}
            <div className="relative px-3 xs:px-5 sm:px-8 py-0.5 sm:py-1 rounded-b-xl xs:rounded-b-2xl bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#b45309] border-b-2 border-x-2 border-amber-700 shadow-[0_6px_12px_rgba(0,0,0,0.5),inset_0_1px_2px_#fff]">
              <span className="font-serif font-black text-[11px] xs:text-xs sm:text-base md:text-lg text-amber-950 tracking-wider drop-shadow-sm flex items-center gap-1 sm:gap-1.5">
                <Crown className="w-3 h-3 sm:w-4 sm:h-4 fill-amber-900 text-amber-950 inline" />
                <span>{t.tableTitle}</span>
              </span>
            </div>

            {/* Red Round 3D Close Button */}
            <button
              id="btn-close-game"
              onClick={onCloseGame}
              className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-red-500 via-rose-600 to-red-800 border border-white text-white flex items-center justify-center shadow-[0_4px_8px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.7)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              title={t.backToLobby}
            >
              <X className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Main 3D Betting Floor Arena with Side Controls */}
          <div className="relative w-full flex items-center gap-1 xs:gap-1.5 sm:gap-2.5 z-10">
            {/* Left Vertical 3D Action Tabs: Rank & Rules */}
            <div className="flex flex-col gap-1.5 xs:gap-2 shrink-0 z-20">
              {/* Rank Tab */}
              <button
                id="btn-tab-rank"
                onClick={onOpenRank}
                className="px-1 xs:px-1.5 sm:px-2 py-1.5 xs:py-2.5 rounded-lg xs:rounded-xl bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-700 border border-amber-200 text-slate-950 font-black text-[8px] xs:text-[9px] sm:text-xs shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_#fff] flex flex-col items-center justify-center leading-tight transition-transform active:scale-95 cursor-pointer"
                title={t.rankTitle}
              >
                {language === 'ar' ? (
                  <div className="flex flex-col items-center font-black leading-3">
                    <span>تـ</span>
                    <span>ر</span>
                    <span>تـ</span>
                    <span>يـ</span>
                    <span>ب</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center leading-none font-bold">
                    <span>R</span>
                    <span>a</span>
                    <span>n</span>
                    <span>k</span>
                  </div>
                )}
              </button>

              {/* Rules Tab */}
              <button
                id="btn-tab-rules"
                onClick={onOpenRules}
                className="px-1 xs:px-1.5 sm:px-2 py-1.5 xs:py-2.5 rounded-lg xs:rounded-xl bg-gradient-to-b from-rose-500 via-red-600 to-rose-800 border border-rose-200 text-white font-black text-[8px] xs:text-[9px] sm:text-xs shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.6)] flex flex-col items-center justify-center leading-tight transition-transform active:scale-95 cursor-pointer"
                title={t.rulesTitle}
              >
                {language === 'ar' ? (
                  <div className="flex flex-col items-center font-black leading-3">
                    <span>قـ</span>
                    <span>و</span>
                    <span>ا</span>
                    <span>عـ</span>
                    <span>د</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center leading-none font-bold">
                    <span>R</span>
                    <span>u</span>
                    <span>l</span>
                    <span>e</span>
                    <span>s</span>
                  </div>
                )}
              </button>
            </div>

            {/* 3 Columns: Chair A, Chair B, Chair C with 3D Pedestals */}
            <div className="flex-1 grid grid-cols-3 gap-1 xs:gap-1.5 sm:gap-3.5 min-w-0">
              {spotsConfig.map((spotCfg) => {
                const spot = table.spots[spotCfg.id];
                const isCenterB = spotCfg.id === 'B';
                const isSpotWinner = isRevealed && table.winningSpot === spotCfg.id;
                const myBet = table.userBets[spotCfg.id] || 0;
                const spotPot = spot?.pot || 0;

                return (
                  <div
                    key={spotCfg.id}
                    className="flex flex-col items-center justify-between gap-1 xs:gap-1.5 sm:gap-2 min-w-0"
                  >
                    {/* 3D CARDS TRAY / RACK (Top of column) */}
                    <div 
                      className={`relative w-full p-0.5 xs:p-1 sm:p-1.5 rounded-xl flex items-center justify-center min-h-[46px] xs:min-h-[54px] sm:min-h-[72px] transition-all duration-300 ${
                        isSpotWinner
                          ? 'bg-amber-400/20 border-2 border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                          : 'bg-black/40 border border-amber-400/20 shadow-inner'
                      }`}
                    >
                      <div className="flex items-center -space-x-3 xs:-space-x-3.5 sm:-space-x-4">
                        {[0, 1, 2].map((cardIdx) => (
                          <GoldPlayingCard
                            key={cardIdx}
                            card={spot?.cards?.[cardIdx]}
                            isFaceDown={!isRevealed}
                            highlight={isSpotWinner}
                          />
                        ))}
                      </div>

                      {/* 3D FLOATING COUNTDOWN TIMER ON CENTER (SPOT B) */}
                      {isCenterB && (
                        <div className="absolute z-30 flex items-center justify-center pointer-events-none">
                          <div
                            className={`w-7 h-7 xs:w-9 xs:h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-indigo-600 via-purple-700 to-indigo-950 border-2 border-yellow-300 shadow-[0_0_20px_rgba(168,85,247,0.8),inset_0_2px_4px_rgba(255,255,255,0.6)] flex items-center justify-center text-yellow-200 font-mono font-black text-xs xs:text-sm sm:text-lg ${
                              table.timerRemaining <= 5 && table.phase === 'COUNTDOWN'
                                ? 'animate-ping'
                                : ''
                            }`}
                          >
                            <span>{table.timerRemaining}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3D ROYAL CHAIR WITH GLOWING PEDESTAL (Middle of column) */}
                    <button
                      onClick={() => handleSpotClick(spotCfg.id)}
                      disabled={table.phase !== 'COUNTDOWN'}
                      className={`relative cursor-pointer transition-all duration-200 group max-w-full ${
                        table.phase === 'COUNTDOWN' ? 'hover:scale-105 active:scale-95' : ''
                      }`}
                      title={`Bet on Chair ${spotCfg.name}`}
                    >
                      {/* Chair Underglow Halo */}
                      <div 
                        className={`absolute -inset-1 rounded-full filter blur-md pointer-events-none transition-opacity ${
                          isSpotWinner ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'
                        } ${
                          spotCfg.chairColor === 'blue' ? 'bg-blue-500' : spotCfg.chairColor === 'magenta' ? 'bg-fuchsia-500' : 'bg-red-500'
                        }`}
                      />

                      <RoyalChair
                        color={spotCfg.chairColor}
                        isWinner={isSpotWinner}
                      />

                      {/* Winner Crown Indicator on Showdown */}
                      {isSpotWinner && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center justify-center animate-bounce z-20">
                          <div className="px-1.5 xs:px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 border border-white text-slate-950 text-[8px] xs:text-[9px] font-black shadow-[0_4px_8px_rgba(0,0,0,0.6)] flex items-center gap-0.5">
                            <Trophy className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-slate-950 fill-current" />
                            <span>{t.win}</span>
                          </div>
                        </div>
                      )}
                    </button>

                    {/* 3D BETTING BOX & CHIP LANDING ZONE (Bottom of column) */}
                    <button
                      onClick={() => handleSpotClick(spotCfg.id)}
                      disabled={table.phase !== 'COUNTDOWN'}
                      className={`w-full rounded-xl xs:rounded-2xl border transition-all duration-200 overflow-hidden text-left relative cursor-pointer ${
                        table.phase === 'COUNTDOWN'
                          ? 'hover:border-yellow-400 hover:shadow-[0_8px_20px_rgba(245,158,11,0.35)] active:scale-98'
                          : ''
                      } ${
                        isSpotWinner
                          ? 'border-yellow-400 bg-gradient-to-b from-amber-200/90 to-amber-300/80 ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                          : 'border-amber-700/40 bg-gradient-to-b from-[#fef3c7] via-[#fde68a] to-[#fcd34d] shadow-[0_6px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.8)]'
                      }`}
                    >
                      {/* Header Tab with 'A', 'B', or 'C' with 3D Emboss */}
                      <div 
                        className={`w-full py-0.5 px-1 xs:px-2 text-center border-b border-black/15 flex items-center justify-center gap-1 ${
                          spotCfg.chairColor === 'blue'
                            ? 'bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700 text-white'
                            : spotCfg.chairColor === 'magenta'
                            ? 'bg-gradient-to-r from-fuchsia-700 via-purple-600 to-fuchsia-700 text-white'
                            : 'bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white'
                        }`}
                      >
                        <span className="font-serif font-black text-[10px] xs:text-xs sm:text-sm tracking-wide drop-shadow">
                          {t.chair} {spotCfg.name}
                        </span>
                      </div>

                      {/* Pot & My Rows with Chip Counts */}
                      <div className="p-0.5 xs:p-1 sm:p-1.5 flex flex-col gap-0.5 text-[9px] xs:text-[10px] sm:text-xs font-bold text-amber-950">
                        <div className="flex justify-between items-center">
                          <span className="text-amber-900/80 text-[8px] xs:text-[9px] sm:text-[10px]">{t.pot}:</span>
                          <span className="font-mono font-black text-amber-950">
                            {spotPot.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-[1px] bg-amber-900/15" />
                        <div className="flex justify-between items-center">
                          <span className="text-amber-900/80 text-[8px] xs:text-[9px] sm:text-[10px]">{t.my}:</span>
                          <span
                            className={`font-mono font-black ${
                              myBet > 0 ? 'text-emerald-800' : 'text-amber-950'
                            }`}
                          >
                            {myBet > 0 ? `+${myBet.toLocaleString()}` : '0'}
                          </span>
                        </div>
                      </div>

                      {/* 3D Stacked Chip Preview inside the betting box when chips are placed */}
                      {myBet > 0 && (
                        <div className="w-full py-0.5 bg-emerald-600 text-white text-[8px] xs:text-[9px] font-black text-center flex items-center justify-center gap-1 shadow-inner">
                          <Coins className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-yellow-300 fill-yellow-300" />
                          <span>{language === 'ar' ? 'تم الرهان' : 'BET PLACED'}</span>
                        </div>
                      )}

                      {/* Hand Rank Reveal Ribbon */}
                      {isRevealed && spot?.evaluation && (
                        <div className="w-full py-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 text-[8px] xs:text-[9px] sm:text-[10px] font-black text-center truncate px-1 shadow-sm border-t border-yellow-200">
                          {getRankDisplayName(spot.evaluation.rankName)}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase Announcement Sub-Banner */}
          {table.phase !== 'COUNTDOWN' && (
            <div className="w-full my-1 sm:my-1.5 flex items-center justify-center z-20">
              <div className="px-2.5 xs:px-4 py-1 sm:py-1.5 rounded-full bg-slate-950/90 border border-yellow-400 text-yellow-300 text-[10px] xs:text-xs font-black flex items-center gap-1.5 sm:gap-2 shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-fadeIn">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 animate-spin" />
                <span>
                  {table.phase === 'DEALING' && t.dealingCards}
                  {table.phase === 'SHOWDOWN' && `${t.winnerChair} ${table.winningSpot}!`}
                  {table.phase === 'RESULTS' && `${t.nextRoundIn} ${table.timerRemaining}${t.secondsShort}`}
                </span>
              </div>
            </div>
          )}

          {/* 3D Bottom Console Bar: Coins Balance, Top-up, 3D Chips, History */}
          <div className="w-full mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-emerald-400/20 flex items-center justify-between gap-1 xs:gap-1.5 sm:gap-2 z-20">
            {/* Left: 3D Star Coin Balance & Top-up */}
            <div className="flex items-center gap-1 xs:gap-1.5">
              <div className="flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-black/60 border border-amber-400/40 shadow-inner">
                <div className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 flex items-center justify-center text-slate-950 shadow-sm shrink-0">
                  <Star className="w-2 h-2 xs:w-2.5 xs:h-2.5 sm:w-3 sm:h-3 fill-slate-950 text-slate-950" />
                </div>
                <span className="font-mono font-black text-[10px] xs:text-xs sm:text-sm text-yellow-300">
                  {userBalance.toLocaleString()}
                </span>
              </div>

              {/* Top-up Button with 3D Bevel */}
              <button
                id="btn-top-up"
                onClick={onOpenTopUp}
                className="px-1.5 xs:px-2.5 py-0.5 sm:py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-[9px] xs:text-[11px] sm:text-xs shadow-[0_3px_6px_rgba(0,0,0,0.4),inset_0_1px_1px_#fff] flex items-center gap-0.5 active:scale-95 cursor-pointer shrink-0"
              >
                <span>{t.topUp}</span>
                <span className="text-[8px] xs:text-[9px] font-mono">&gt;</span>
              </button>
            </div>

            {/* Center: The 3D Chips Selector (100, 1K, 10K, 100K) */}
            <div className="flex items-center justify-center shrink-0">
              <CasinoChipsBar
                chips={table.availableChips}
                selectedChip={selectedChip}
                onSelectChip={onSelectChip}
                disabled={table.phase !== 'COUNTDOWN'}
              />
            </div>

            {/* Right: Golden 3D History Clock Button */}
            <button
              id="btn-game-history"
              onClick={onOpenHistory}
              className="w-7 h-7 xs:w-8 xs:h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 border-2 border-white shadow-[0_5px_12px_rgba(0,0,0,0.6),inset_0_2px_3px_#fff] text-amber-950 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title={t.gameHistory}
            >
              <RotateCcw className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
