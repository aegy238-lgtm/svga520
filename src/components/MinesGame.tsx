import React, { useState } from 'react';
import {
  ArrowLeft,
  Bomb,
  Diamond,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Coins,
  HelpCircle,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { sound } from '../lib/audio';

interface MinesGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (amount: number) => void;
  language: string;
  winRate?: number;
}

interface TileState {
  index: number;
  isMine: boolean;
  isRevealed: boolean;
}

const PRESET_CHIPS = [50, 200, 500, 2000, 10000];
const MINE_OPTIONS = [1, 3, 5, 10, 20];

export const MinesGame: React.FC<MinesGameProps> = ({
  onBack,
  balance,
  userName,
  updateBalance,
  winRate = 45,
}) => {
  const { isRTL } = useLanguage();
  const [mineCount, setMineCount] = useState<number>(3);
  const [betAmount, setBetAmount] = useState<number>(100);

  // Game active states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tiles, setTiles] = useState<TileState[]>(() =>
    Array.from({ length: 25 }, (_, i) => ({
      index: i,
      isMine: false,
      isRevealed: false,
    }))
  );
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isWon, setIsWon] = useState<boolean>(false);
  const [cashoutAmount, setCashoutAmount] = useState<number>(0);
  const [explodedIndex, setExplodedIndex] = useState<number | null>(null);

  // Sounds & modal
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [showRules, setShowRules] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  // Multiplier calculation for n gems found with m mines out of 25 tiles
  const calculateMultiplier = (gemsFound: number, mines: number): number => {
    if (gemsFound === 0) return 1.0;
    let mult = 1.0;
    const totalTiles = 25;
    for (let i = 0; i < gemsFound; i++) {
      const remainingTiles = totalTiles - i;
      const remainingSafe = totalTiles - mines - i;
      mult *= remainingTiles / remainingSafe;
    }
    // Apply 3% house edge
    mult *= 0.97;
    return Number(Math.max(1.05, mult).toFixed(2));
  };

  const currentMultiplier = calculateMultiplier(revealedCount, mineCount);
  const nextMultiplier = calculateMultiplier(revealedCount + 1, mineCount);
  const currentWinAmount = Math.floor(betAmount * currentMultiplier);

  // Start New Round
  const handleStartGame = () => {
    if (balance < betAmount) {
      setFeedback(isRTL ? 'الرصيد غير كافٍ للرهان!' : 'Insufficient balance!');
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    // Deduct bet
    updateBalance(-betAmount);
    if (!isMuted) sound.playGameStart();

    // Randomly place mines
    const mineIndices = new Set<number>();
    while (mineIndices.size < mineCount) {
      const idx = Math.floor(Math.random() * 25);
      mineIndices.add(idx);
    }

    const newTiles: TileState[] = Array.from({ length: 25 }, (_, i) => ({
      index: i,
      isMine: mineIndices.has(i),
      isRevealed: false,
    }));

    setTiles(newTiles);
    setRevealedCount(0);
    setIsPlaying(true);
    setIsGameOver(false);
    setIsWon(false);
    setCashoutAmount(0);
    setExplodedIndex(null);
  };

  // Click on a tile
  const handleTileClick = (index: number) => {
    if (!isPlaying || isGameOver || tiles[index].isRevealed) return;

    let currentTiles = [...tiles];
    let isHit = currentTiles[index].isMine;

    // Apply Admin RTP / Win Rate dynamic probability balance
    const targetWinRate = Math.max(5, Math.min(95, winRate));
    const roll = Math.random() * 100;

    // If user hit a mine on the first 1-2 picks, but roll says player should win, swap mine with unrevealed gem
    if (isHit && roll <= targetWinRate && revealedCount < 3) {
      const safeIndex = currentTiles.findIndex((t, idx) => !t.isMine && !t.isRevealed && idx !== index);
      if (safeIndex !== -1) {
        currentTiles[index] = { ...currentTiles[index], isMine: false };
        currentTiles[safeIndex] = { ...currentTiles[safeIndex], isMine: true };
        isHit = false;
      }
    }

    if (isHit) {
      // EXPLOSION!
      setExplodedIndex(index);
      setIsGameOver(true);
      setIsPlaying(false);
      if (!isMuted) sound.playExplosion();

      // Reveal all tiles
      setTiles(
        currentTiles.map((t) => ({
          ...t,
          isRevealed: true,
        }))
      );
      setFeedback(isRTL ? 'انفجرت القنبلة! للأسف خسرت الرهان' : 'Bomb exploded! Better luck next time');
      setTimeout(() => setFeedback(null), 3000);
    } else {
      // GEM!
      if (!isMuted) sound.playGem();
      const nextCount = revealedCount + 1;
      setRevealedCount(nextCount);

      setTiles(
        currentTiles.map((t) => (t.index === index ? { ...t, isRevealed: true } : t))
      );

      // Check if all gems uncovered
      if (nextCount === 25 - mineCount) {
        handleCashout(nextCount);
      }
    }
  };

  // Cashout current winnings
  const handleCashout = (overrideCount?: number) => {
    if (!isPlaying || isGameOver) return;
    const count = overrideCount ?? revealedCount;
    if (count === 0) return;

    const mult = calculateMultiplier(count, mineCount);
    const win = Math.floor(betAmount * mult);

    setCashoutAmount(win);
    setIsWon(true);
    setIsPlaying(false);
    setIsGameOver(true);

    updateBalance(win);

    if (!isMuted) {
      sound.playCashout();
      sound.playWinFanfare();
    }

    // Reveal rest of board
    setTiles((prev) => prev.map((t) => ({ ...t, isRevealed: true })));

    setFeedback(
      isRTL
        ? `مبروك! سحبت أرباحك بنجاح: +${win.toLocaleString()} كوينز (x${mult})`
        : `Congratulations! Cashed out +${win.toLocaleString()} (x${mult})!`
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col select-none overflow-x-hidden">
      {/* Atmosphere Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-950/40 via-slate-950 to-black pointer-events-none" />

      {/* HEADER */}
      <header className="relative z-20 w-full px-3 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Diamond className="w-5 h-5 text-cyan-200 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-400">
                {isRTL ? 'كاشف القنابل والألماس (Mines)' : 'Mines & Gems'}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{isRTL ? 'خمن الألماس وتجنب القنابل' : 'Uncover Gems • Avoid Mines'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Balance & Header Icons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-xs md:text-sm font-bold text-amber-300">
              {balance.toLocaleString()}
            </span>
          </div>

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <HelpCircle className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div className="relative z-20 w-full py-1.5 px-4 bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-b border-teal-500/30 text-center text-xs font-bold text-teal-200">
          {feedback}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto p-2 md:p-4 flex flex-col md:flex-row gap-4 items-center justify-center">
        {/* 5x5 MINES GRID */}
        <div className="w-full max-w-sm md:max-w-md aspect-square p-3 rounded-3xl bg-slate-900/90 border-2 border-slate-800 shadow-2xl flex flex-col justify-between">
          <div className="grid grid-cols-5 gap-2 w-full h-full">
            {tiles.map((tile) => {
              const isExploded = tile.index === explodedIndex;
              return (
                <button
                  key={tile.index}
                  disabled={!isPlaying || tile.isRevealed}
                  onClick={() => handleTileClick(tile.index)}
                  className={`relative rounded-xl md:rounded-2xl transition-all duration-200 flex items-center justify-center font-bold shadow-md transform active:scale-95 ${
                    tile.isRevealed
                      ? tile.isMine
                        ? isExploded
                          ? 'bg-rose-600 border-2 border-rose-300 animate-shake shadow-rose-600/50'
                          : 'bg-rose-950/70 border border-rose-800 opacity-60'
                        : 'bg-gradient-to-tr from-emerald-600 to-teal-400 border-2 border-emerald-300 shadow-emerald-500/30'
                      : isPlaying
                      ? 'bg-gradient-to-b from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-slate-700 hover:border-amber-400/50'
                      : 'bg-slate-900/60 border border-slate-800/80 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {tile.isRevealed ? (
                    tile.isMine ? (
                      <span className="text-xl md:text-2xl animate-pulse">💣</span>
                    ) : (
                      <span className="text-xl md:text-2xl drop-shadow-md animate-bounce">💎</span>
                    )
                  ) : isPlaying ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 opacity-60" />
                  ) : (
                    <span className="text-xs text-slate-600">?</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SIDE CONTROLS & STATS PANEL */}
        <div className="w-full max-w-sm md:max-w-xs flex flex-col gap-3">
          {/* Active Round Multipliers */}
          {isPlaying && (
            <div className="p-3 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-teal-500/30 flex flex-col gap-2 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{isRTL ? 'الألماس المكتشف:' : 'Gems Found:'}</span>
                <span className="font-bold text-teal-300 flex items-center gap-1">
                  💎 {revealedCount} / {25 - mineCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{isRTL ? 'المضاعف الحالي:' : 'Current Multiplier:'}</span>
                <span className="font-black text-amber-300 text-sm">
                  {currentMultiplier.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{isRTL ? 'المضاعف القادم:' : 'Next Gem:'}</span>
                <span className="font-bold text-emerald-400">
                  {nextMultiplier.toFixed(2)}x
                </span>
              </div>
            </div>
          )}

          {/* Mines Count Selector */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <Bomb className="w-3.5 h-3.5 text-rose-500" />
              {isRTL ? 'عدد القنابل في الشبكة:' : 'Number of Mines:'}
            </span>
            <div className="grid grid-cols-5 gap-1">
              {MINE_OPTIONS.map((m) => (
                <button
                  key={m}
                  disabled={isPlaying}
                  onClick={() => setMineCount(m)}
                  className={`py-1.5 rounded-xl text-xs font-black transition border ${
                    mineCount === m
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount Controls */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                {isRTL ? 'مبلغ الرهان:' : 'Bet Amount:'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={isPlaying}
                  onClick={() => setBetAmount((prev) => Math.max(50, Math.floor(prev / 2)))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 disabled:opacity-40"
                >
                  ½
                </button>
                <button
                  disabled={isPlaying}
                  onClick={() => setBetAmount((prev) => Math.min(balance, prev * 2))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 disabled:opacity-40"
                >
                  2X
                </button>
                <button
                  disabled={isPlaying}
                  onClick={() => setBetAmount(balance)}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-bold text-amber-300 disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>

            <input
              type="number"
              disabled={isPlaying}
              value={betAmount}
              onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold text-base focus:outline-none disabled:opacity-50"
            />

            {/* Quick chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {PRESET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  disabled={isPlaying}
                  onClick={() => setBetAmount(chip)}
                  className={`flex-1 min-w-[45px] py-1 rounded-lg text-[11px] font-bold border transition ${
                    betAmount === chip
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40'
                  }`}
                >
                  +{chip >= 1000 ? `${chip / 1000}k` : chip}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN ACTION BUTTON (START ROUND OR CASHOUT) */}
          {isPlaying ? (
            <button
              disabled={revealedCount === 0}
              onClick={() => handleCashout()}
              className={`w-full py-3.5 rounded-2xl font-black text-base shadow-xl flex flex-col items-center justify-center transition active:scale-95 ${
                revealedCount > 0
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 text-slate-950 shadow-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-5 h-5" />
                {isRTL ? 'سحب الأرباح الآن' : 'CASH OUT'}
              </span>
              {revealedCount > 0 && (
                <span className="text-xs font-bold text-slate-950 bg-emerald-300/60 px-2 py-0.5 rounded-full mt-0.5">
                  +{currentWinAmount.toLocaleString()} كوينز ({currentMultiplier.toFixed(2)}x)
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={handleStartGame}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 font-black text-base shadow-xl shadow-amber-500/30 active:scale-95 flex items-center justify-center gap-2"
            >
              <Diamond className="w-5 h-5" />
              {isRTL ? 'بدء الجولة الجديدة' : 'START ROUND'}
            </button>
          )}
        </div>
      </div>

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-teal-500/30 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-black text-teal-300 flex items-center gap-2">
                <Diamond className="w-5 h-5 text-emerald-400" />
                {isRTL ? 'قواعد كاشف القنابل والألماس' : 'Mines & Gems Rules'}
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-amber-400">1. ضبط اللعبة:</span>
                <p className="text-slate-400 mt-1">
                  اختر عدد القنابل المخفية في الشبكة (مثلاً 3 أو 5 قنابل) ومبلغ الرهان ثم اضغط "بدء الجولة".
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-400">2. كشف المربعات:</span>
                <p className="text-slate-400 mt-1">
                  كل ألماسة 💎 تكشفها تزيد من مضاعف أرباحك بشكل تصاعدي!
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-rose-400">3. سحب الأرباح أو الانفجار:</span>
                <p className="text-slate-400 mt-1">
                  يمكنك سحب أرباحك في أي لحظة. إذا ضغطت على قنبلة 💣 تنفجر وتخسر الجولة.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950 font-black text-sm"
            >
              {isRTL ? 'فهمت، لنبدأ التحدي!' : 'Ready to Play!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
