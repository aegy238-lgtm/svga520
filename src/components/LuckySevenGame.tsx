import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  RotateCcw, 
  History as HistoryIcon,
  Coins,
  Crown,
  Sparkles,
  Trophy,
  Dices,
  Flame,
  CheckCircle2,
  X
} from 'lucide-react';
import { sound } from '../lib/audio';

type GamePhase = 'BETTING' | 'ROLLING' | 'RESULT';
type BetSpot = 'DOWN' | 'SEVEN' | 'UP';

interface LuckySevenGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (delta: number) => Promise<boolean | void>;
  language: 'ar' | 'en';
}

interface RoundHistory {
  id: number;
  die1: number;
  die2: number;
  total: number;
  winningSpot: BetSpot;
  winAmount: number;
  timestamp: number;
}

const CHIP_VALUES = [50, 500, 2000, 10000];

export const LuckySevenGame: React.FC<LuckySevenGameProps> = ({
  onBack,
  balance,
  userId,
  userName,
  updateBalance,
  language,
}) => {
  const isRTL = language === 'ar';
  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [timeLeft, setTimeLeft] = useState<number>(8);
  const [selectedChip, setSelectedChip] = useState<number>(500);
  const [userBets, setUserBets] = useState<{ [spot in BetSpot]?: number }>({});
  const [previousBets, setPreviousBets] = useState<{ [spot in BetSpot]?: number }>({});
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  
  // Dice state
  const [die1, setDie1] = useState<number>(3);
  const [die2, setDie2] = useState<number>(4);
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [winningSpot, setWinningSpot] = useState<BetSpot | null>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [showResultBanner, setShowResultBanner] = useState<boolean>(false);
  
  // Modals & UI
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [betFeedback, setBetFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<RoundHistory[]>([
    { id: 1, die1: 3, die2: 4, total: 7, winningSpot: 'SEVEN', winAmount: 0, timestamp: Date.now() - 60000 },
    { id: 2, die1: 1, die2: 3, total: 4, winningSpot: 'DOWN', winAmount: 0, timestamp: Date.now() - 50000 },
    { id: 3, die1: 5, die2: 5, total: 10, winningSpot: 'UP', winAmount: 0, timestamp: Date.now() - 40000 },
    { id: 4, die1: 2, die2: 4, total: 6, winningSpot: 'DOWN', winAmount: 0, timestamp: Date.now() - 30000 },
    { id: 5, die1: 6, die2: 3, total: 9, winningSpot: 'UP', winAmount: 0, timestamp: Date.now() - 20000 },
    { id: 6, die1: 4, die2: 3, total: 7, winningSpot: 'SEVEN', winAmount: 0, timestamp: Date.now() - 10000 },
  ]);

  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const playSfx = (type: 'chip' | 'roll' | 'win' | 'tick') => {
    if (isMuted) return;
    try {
      if (type === 'chip') sound.playChipBet();
      else if (type === 'tick') sound.playTimerTick();
      else if (type === 'roll') sound.playDealCard();
      else if (type === 'win') sound.playWinFanfare();
    } catch {
      // fallback
    }
  };

  // Main game loop
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phase === 'BETTING') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleStartRoll();
            return 0;
          }
          if (prev <= 4) {
            playSfx('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, isMuted, userBets]);

  const handleStartRoll = () => {
    setPhase('ROLLING');
    setIsDiceRolling(true);
    playSfx('roll');

    // Rapid visual rolling animation
    let ticks = 0;
    rollIntervalRef.current = setInterval(() => {
      setDie1(Math.floor(Math.random() * 6) + 1);
      setDie2(Math.floor(Math.random() * 6) + 1);
      ticks++;
      if (ticks > 18) {
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      }
    }, 90);

    setTimeout(() => {
      // Final outcome
      const finalDie1 = Math.floor(Math.random() * 6) + 1;
      const finalDie2 = Math.floor(Math.random() * 6) + 1;
      const sum = finalDie1 + finalDie2;
      setDie1(finalDie1);
      setDie2(finalDie2);
      setIsDiceRolling(false);

      let resultSpot: BetSpot;
      if (sum < 7) {
        resultSpot = 'DOWN';
      } else if (sum === 7) {
        resultSpot = 'SEVEN';
      } else {
        resultSpot = 'UP';
      }

      handleShowdownResult(finalDie1, finalDie2, sum, resultSpot);
    }, 2800);
  };

  const handleShowdownResult = (
    finalDie1: number, 
    finalDie2: number, 
    sum: number, 
    resultSpot: BetSpot
  ) => {
    setPhase('RESULT');
    setWinningSpot(resultSpot);

    const betOnWinSpot = userBets[resultSpot] || 0;
    let multiplier = 2; // Down & Up are 2x (1:1 profit)
    if (resultSpot === 'SEVEN') {
      multiplier = 5; // Lucky 7 pays 5x
    }

    const winAmount = betOnWinSpot * multiplier;
    setLastWinAmount(winAmount);

    if (winAmount > 0) {
      updateBalance(winAmount);
      playSfx('win');
    }

    setShowResultBanner(true);

    const newRecord: RoundHistory = {
      id: Date.now(),
      die1: finalDie1,
      die2: finalDie2,
      total: sum,
      winningSpot: resultSpot,
      winAmount,
      timestamp: Date.now(),
    };

    setHistory((prev) => [newRecord, ...prev].slice(0, 20));

    // Save previous bets for repeat bet button
    setPreviousBets(userBets);

    setTimeout(() => {
      setShowResultBanner(false);
      resetRound();
    }, 4000);
  };

  const resetRound = () => {
    setPhase('BETTING');
    setTimeLeft(8);
    setWinningSpot(null);
    setUserBets({});
  };

  const placeBet = (spot: BetSpot) => {
    if (phase !== 'BETTING') return;
    if (balance < selectedChip) {
      setBetFeedback(isRTL ? 'الرصيد غير كافٍ! يرجى شحن الرصيد' : 'Insufficient balance! Please recharge');
      setTimeout(() => setBetFeedback(null), 2000);
      return;
    }

    playSfx('chip');
    updateBalance(-selectedChip);
    setUserBets((prev) => ({
      ...prev,
      [spot]: (prev[spot] || 0) + selectedChip,
    }));
  };

  const handleClearBets = () => {
    if (phase !== 'BETTING') return;
    const totalBet = Object.values(userBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    if (totalBet > 0) {
      updateBalance(totalBet);
      setUserBets({});
      playSfx('chip');
    }
  };

  const handleRepeatBets = () => {
    if (phase !== 'BETTING') return;
    const totalRepeat = Object.values(previousBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    if (totalRepeat <= 0) return;
    if (balance < totalRepeat) {
      setBetFeedback(isRTL ? 'الرصيد غير كافٍ لتكرار الرهان!' : 'Insufficient balance to repeat bet!');
      setTimeout(() => setBetFeedback(null), 2000);
      return;
    }
    // Deduct and apply
    updateBalance(-totalRepeat);
    setUserBets({ ...previousBets });
    playSfx('chip');
  };

  // Render dice face dots
  const renderDiceFace = (value: number) => {
    const dotPositions: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };

    const activeDots = dotPositions[value] || [4];

    return (
      <div className={`w-14 h-14 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 border-2 border-amber-300 shadow-[0_8px_20px_rgba(0,0,0,0.4),inset_0_2px_4px_rgba(255,255,255,0.9)] p-2 grid grid-cols-3 grid-rows-3 gap-1 ${
        isDiceRolling ? 'animate-spin' : ''
      }`}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
          <div key={index} className="flex items-center justify-center">
            {activeDots.includes(index) && (
              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${
                value === 1 || value === 4 ? 'bg-red-600' : 'bg-slate-900'
              } shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const totalCurrentBets = Object.values(userBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);

  return (
    <div 
      className="w-full min-h-screen bg-[#07130c] text-white flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-16 sm:pb-4 relative overflow-x-hidden font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Casino Table Felt texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/40 via-[#071910] to-[#040c07] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 w-full bg-[#081b11]/95 backdrop-blur-xl border-b border-amber-500/20 px-3 sm:px-6 py-2.5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 text-xs font-bold"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span className="hidden xs:inline">{isRTL ? 'اللوبي' : 'Lobby'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow flex items-center justify-center text-slate-950 font-black">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-black text-sm sm:text-base text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 leading-tight">
                {isRTL ? 'السبعتين (7 Up 7 Down)' : '7 Up 7 Down'}
              </h1>
              <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isRTL ? 'طاولة النرد الكلاسيكية الملكية' : 'Live Classic Dice Table'}
              </span>
            </div>
          </div>
        </div>

        {/* Real Balance & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-xl bg-emerald-950/90 border border-amber-500/40 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-amber-200 font-bold uppercase">{isRTL ? 'الرصيد الفعلي' : 'Real Balance'}</span>
              <span className="font-mono font-black text-xs sm:text-sm text-yellow-300">
                {balance.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              sound.setMuted(newMuted);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 text-slate-300 border border-emerald-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 text-slate-300 border border-emerald-800 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </header>

      {/* BET FEEDBACK TOAST */}
      {betFeedback && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-2xl animate-bounce border border-red-400">
          {betFeedback}
        </div>
      )}

      {/* MAIN GAME ARENA */}
      <main className="flex-1 flex flex-col items-center justify-between px-2 sm:px-4 py-2 z-10 max-w-4xl mx-auto w-full">
        
        {/* DICE ROLLING STAGE & TIMER */}
        <div className="w-full relative py-3 sm:py-5 flex flex-col items-center justify-center">
          
          {/* Phase & Countdown Badge */}
          <div className="mb-2 sm:mb-3 flex items-center gap-2">
            <div className={`px-4 py-1.5 rounded-full border shadow-xl flex items-center gap-2 ${
              phase === 'BETTING'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : phase === 'ROLLING'
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 animate-pulse'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}>
              <span className="text-xs font-black tracking-wider">
                {phase === 'BETTING' 
                  ? (isRTL ? `ضع رهانك (${timeLeft} ثوانٍ)` : `PLACE BETS (${timeLeft}s)`)
                  : phase === 'ROLLING'
                  ? (isRTL ? 'جاري رمي النرد...' : 'ROLLING DICE...')
                  : (isRTL ? 'النتيجة الفائزة!' : 'SHOWDOWN RESULT!')}
              </span>
              {phase === 'BETTING' && (
                <span className={`w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-mono font-black text-xs ${
                  timeLeft <= 3 ? 'animate-ping bg-red-500 text-white' : ''
                }`}>
                  {timeLeft}
                </span>
              )}
            </div>
          </div>

          {/* Golden Dice Shaker Tray & Active Dice */}
          <div className="relative w-[280px] xs:w-[320px] sm:w-[380px] h-[130px] sm:h-[160px] rounded-3xl bg-gradient-to-b from-[#0a2717] via-[#05180e] to-[#020d07] border-4 border-amber-500/40 shadow-[0_15px_35px_rgba(0,0,0,0.6),inset_0_4px_12px_rgba(0,0,0,0.8)] flex items-center justify-center gap-5 sm:gap-8 px-6">
            
            {/* Tray Velvet Ring */}
            <div className="absolute inset-1.5 rounded-[22px] border-2 border-emerald-500/20 pointer-events-none" />

            {/* Die 1 */}
            <div className="flex flex-col items-center gap-1">
              {renderDiceFace(die1)}
              <span className="text-[10px] font-mono text-amber-300/80 font-bold">{isRTL ? 'النرد 1' : 'Die 1'}</span>
            </div>

            {/* Plus sign */}
            <div className="font-mono font-black text-xl sm:text-2xl text-amber-400/70">
              +
            </div>

            {/* Die 2 */}
            <div className="flex flex-col items-center gap-1">
              {renderDiceFace(die2)}
              <span className="text-[10px] font-mono text-amber-300/80 font-bold">{isRTL ? 'النرد 2' : 'Die 2'}</span>
            </div>

            {/* Equal Sum Result Badge */}
            {phase === 'RESULT' && (
              <div className="absolute -bottom-4 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm sm:text-base shadow-2xl border-2 border-white animate-bounce flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>{isRTL ? `المجموع: ${die1 + die2}` : `TOTAL = ${die1 + die2}`}</span>
                <span>({die1 + die2 < 7 ? (isRTL ? 'أقل من 7' : '7 DOWN') : die1 + die2 === 7 ? (isRTL ? 'سبعة ذهبية' : 'LUCKY 7') : (isRTL ? 'أكثر من 7' : '7 UP')})</span>
              </div>
            )}
          </div>
        </div>

        {/* 3 PRIMARY BETTING ZONES */}
        <div className="w-full grid grid-cols-3 gap-2 sm:gap-4 my-3 sm:my-5">
          
          {/* 1. 7 DOWN (2 to 6) */}
          <button
            onClick={() => placeBet('DOWN')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'DOWN'
                ? 'bg-gradient-to-b from-blue-700/80 via-blue-900/90 to-slate-950 border-yellow-400 ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-pulse'
                : 'bg-gradient-to-b from-blue-950/60 via-slate-900/80 to-slate-950/90 border-blue-500/40 hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            {/* Multiplier Tag */}
            <div className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono font-black text-[9px] sm:text-xs shadow border border-blue-300">
              2X {isRTL ? 'مضاعف' : 'PAY'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-black text-lg sm:text-2xl mt-1">
              🔻
            </div>

            <div className="text-center my-1.5">
              <h3 className="font-serif font-black text-sm sm:text-lg text-blue-200">
                {isRTL ? 'أقل من 7' : '7 DOWN'}
              </h3>
              <p className="text-[10px] sm:text-xs font-mono text-blue-300/80 font-bold">
                [ 2 - 6 ]
              </p>
            </div>

            {/* Current Bet Tag */}
            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['DOWN'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-blue-950/80 text-blue-300/60 border border-blue-900'
            }`}>
              {(userBets['DOWN'] || 0) > 0 ? `+${userBets['DOWN']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>

          {/* 2. LUCKY 7 (EXACTLY 7) - HIGHEST PAYOUT */}
          <button
            onClick={() => placeBet('SEVEN')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'SEVEN'
                ? 'bg-gradient-to-b from-amber-600/90 via-yellow-700/90 to-slate-950 border-yellow-300 ring-4 ring-yellow-400 shadow-[0_0_35px_rgba(250,204,21,0.9)] animate-bounce'
                : 'bg-gradient-to-b from-amber-950/70 via-yellow-950/60 to-slate-950 border-amber-500/60 hover:border-amber-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            }`}
          >
            {/* Multiplier Tag */}
            <div className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-mono font-black text-[9px] sm:text-xs shadow border border-white animate-pulse">
              5X {isRTL ? 'السبعة الملكية' : 'JACKPOT'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/30 text-yellow-300 flex items-center justify-center font-black text-xl sm:text-3xl mt-1 shadow-inner">
              ⭐
            </div>

            <div className="text-center my-1.5">
              <h3 className="font-serif font-black text-sm sm:text-lg text-yellow-300">
                {isRTL ? 'رقم 7 بالضبط' : 'LUCKY 7'}
              </h3>
              <p className="text-[10px] sm:text-xs font-mono text-amber-300 font-bold">
                [ = 7 ]
              </p>
            </div>

            {/* Current Bet Tag */}
            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['SEVEN'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-amber-950/80 text-amber-300/60 border border-amber-900'
            }`}>
              {(userBets['SEVEN'] || 0) > 0 ? `+${userBets['SEVEN']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>

          {/* 3. 7 UP (8 to 12) */}
          <button
            onClick={() => placeBet('UP')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'UP'
                ? 'bg-gradient-to-b from-rose-700/80 via-red-900/90 to-slate-950 border-yellow-400 ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-pulse'
                : 'bg-gradient-to-b from-red-950/60 via-slate-900/80 to-slate-950/90 border-red-500/40 hover:border-red-400 hover:shadow-lg'
            }`}
          >
            {/* Multiplier Tag */}
            <div className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[9px] sm:text-xs shadow border border-red-300">
              2X {isRTL ? 'مضاعف' : 'PAY'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-500/20 text-red-300 flex items-center justify-center font-black text-lg sm:text-2xl mt-1">
              🔺
            </div>

            <div className="text-center my-1.5">
              <h3 className="font-serif font-black text-sm sm:text-lg text-red-200">
                {isRTL ? 'أكثر من 7' : '7 UP'}
              </h3>
              <p className="text-[10px] sm:text-xs font-mono text-red-300/80 font-bold">
                [ 8 - 12 ]
              </p>
            </div>

            {/* Current Bet Tag */}
            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['UP'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-red-950/80 text-red-300/60 border border-red-900'
            }`}>
              {(userBets['UP'] || 0) > 0 ? `+${userBets['UP']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>
        </div>

        {/* ROAD MAP & RECENT OUTCOMES BEAD PLATE */}
        <div className="w-full bg-[#081f13]/80 rounded-2xl p-2.5 border border-emerald-500/30 flex items-center justify-between gap-2 overflow-x-auto shadow-inner">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-amber-300">
            <HistoryIcon className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{isRTL ? 'تاريخ النتائج:' : 'History:'}</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {history.slice(0, 10).map((h) => (
              <div
                key={h.id}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex flex-col items-center justify-center text-[10px] font-mono font-black shrink-0 border shadow ${
                  h.winningSpot === 'SEVEN'
                    ? 'bg-amber-400 text-slate-950 border-yellow-200'
                    : h.winningSpot === 'DOWN'
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-red-600 text-white border-red-400'
                }`}
                title={`Total ${h.total} (${h.winningSpot})`}
              >
                <span>{h.total}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClearBets}
              disabled={phase !== 'BETTING' || totalCurrentBets === 0}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 border border-slate-700 disabled:opacity-40 transition-colors"
            >
              {isRTL ? 'إلغاء' : 'Clear'}
            </button>
            <button
              onClick={handleRepeatBets}
              disabled={phase !== 'BETTING'}
              className="px-2.5 py-1 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-[10px] font-bold text-emerald-200 border border-emerald-600 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isRTL ? 'تكرار' : 'Repeat'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM CHIPS SELECTOR BAR */}
        <div className="w-full mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-amber-300/80 uppercase">{isRTL ? 'اختر الرقاقة:' : 'Select Chip:'}</span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {CHIP_VALUES.map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    setSelectedChip(val);
                    playSfx('chip');
                  }}
                  className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full font-mono font-black text-[10px] sm:text-xs flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 ${
                    selectedChip === val
                      ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_15px_rgba(250,204,21,0.8)]'
                      : 'opacity-80 hover:opacity-100'
                  } ${
                    val === 50
                      ? 'bg-gradient-to-tr from-blue-700 to-blue-500 text-white border-2 border-blue-300'
                      : val === 500
                      ? 'bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white border-2 border-emerald-300'
                      : val === 2000
                      ? 'bg-gradient-to-tr from-purple-700 to-purple-500 text-white border-2 border-purple-300'
                      : 'bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-600 text-slate-950 border-2 border-yellow-200'
                  }`}
                >
                  <span>{val >= 1000 ? `${val / 1000}k` : val}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right rtl:text-left">
              <span className="text-[9px] text-slate-400 block">{isRTL ? 'مجموع رهاناتك' : 'Total Bet'}</span>
              <span className="font-mono font-black text-xs sm:text-sm text-yellow-300">
                {totalCurrentBets.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* SHOWDOWN RESULT MODAL BANNER */}
      {showResultBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className={`p-6 rounded-3xl border-3 shadow-2xl text-center max-w-sm w-full flex flex-col items-center gap-3 animate-scaleUp ${
            lastWinAmount > 0
              ? 'bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.6)]'
              : 'bg-slate-900 border-slate-700'
          }`}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-3xl shadow-xl">
              {lastWinAmount > 0 ? '🏆' : '🎲'}
            </div>

            <h3 className="font-serif font-black text-xl text-yellow-300">
              {lastWinAmount > 0
                ? (isRTL ? 'مبروك! فوز مستحق' : 'CONGRATULATIONS!')
                : (isRTL ? 'حظ أوفر في الجولة القادمة' : 'ROUND FINISHED')}
            </h3>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 w-full font-mono">
              <div className="text-xs text-slate-300">
                {isRTL ? 'النتيجة الفائزة:' : 'Winning Zone:'} <strong className="text-yellow-400">{winningSpot === 'SEVEN' ? '⭐ LUCKY 7' : winningSpot === 'DOWN' ? '🔻 7 DOWN' : '🔺 7 UP'}</strong>
              </div>
              <div className="text-sm font-black text-white mt-1">
                {isRTL ? `مجموع النرد: ${die1 + die2}` : `Dice Total: ${die1 + die2}`} ({die1} + {die2})
              </div>
            </div>

            {lastWinAmount > 0 ? (
              <div className="text-emerald-400 font-mono font-black text-2xl flex items-center gap-1.5 animate-pulse">
                <Coins className="w-6 h-6 text-yellow-400" />
                <span>+{lastWinAmount.toLocaleString()}</span>
              </div>
            ) : (
              <div className="text-slate-400 text-xs">
                {isRTL ? 'انتظر بدء الجولة التالية...' : 'Next round starting soon...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-serif font-black text-base text-yellow-300 flex items-center gap-2">
                <Dices className="w-5 h-5 text-amber-400" />
                <span>{isRTL ? 'قواعد لعبة السبعتين (7 Up 7 Down)' : '7 Up 7 Down Rules'}</span>
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <strong className="text-blue-300 block mb-1">🔻 {isRTL ? 'أقل من 7 (7 DOWN):' : '7 DOWN (2 to 6):'}</strong>
                <p>{isRTL ? 'يفوز إذا كان مجموع النردين 2 أو 3 أو 4 أو 5 أو 6. نسبة الربح 2X (1:1).' : 'Wins if sum of 2 dice is 2, 3, 4, 5, or 6. Payout is 2X.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/30">
                <strong className="text-yellow-400 block mb-1">⭐ {isRTL ? 'رقم 7 بالضبط (LUCKY 7):' : 'LUCKY 7 (Exactly 7):'}</strong>
                <p>{isRTL ? 'يفوز إذا كان مجموع النردين 7 بالضبط. الجائزة الكبرى 5X (4:1).' : 'Wins if sum of 2 dice is exactly 7. Super jackpot payout 5X.'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <strong className="text-red-300 block mb-1">🔺 {isRTL ? 'أكثر من 7 (7 UP):' : '7 UP (8 to 12):'}</strong>
                <p>{isRTL ? 'يفوز إذا كان مجموع النردين 8 أو 9 أو 10 أو 11 أو 12. نسبة الربح 2X (1:1).' : 'Wins if sum of 2 dice is 8, 9, 10, 11, or 12. Payout is 2X.'}</p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg"
            >
              {isRTL ? 'فهمت، حسناً' : 'Got it, let\'s play!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
