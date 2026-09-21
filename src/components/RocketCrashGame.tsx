import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Rocket,
  Flame,
  Volume2,
  VolumeX,
  History,
  TrendingUp,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { sound } from '../lib/audio';

interface RocketCrashGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (amount: number) => void;
  language: string;
  winRate?: number;
}

type Phase = 'BETTING' | 'FLYING' | 'CRASHED';

interface LivePlayer {
  id: string;
  name: string;
  avatar: string;
  bet: number;
  cashedOutMultiplier: number | null;
}

const PRESET_CHIPS = [50, 200, 500, 2000, 10000];

export const RocketCrashGame: React.FC<RocketCrashGameProps> = ({
  onBack,
  balance,
  userName,
  updateBalance,
  winRate = 42,
}) => {
  const { isRTL } = useLanguage();
  const [phase, setPhase] = useState<Phase>('BETTING');
  const [countdown, setCountdown] = useState<number>(5);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  const [crashPoint, setCrashPoint] = useState<number>(2.00);

  // User Bet state
  const [betAmount, setBetAmount] = useState<number>(100);
  const [hasPlacedBet, setHasPlacedBet] = useState<boolean>(false);
  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [winProfit, setWinProfit] = useState<number>(0);
  const [autoCashout, setAutoCashout] = useState<string>(''); // e.g. "2.00"

  // History of recent crash multipliers
  const [history, setHistory] = useState<number[]>([1.45, 3.20, 1.15, 8.42, 2.05, 1.84, 15.60, 1.22]);

  // Simulated active community players
  const [players, setPlayers] = useState<LivePlayer[]>([]);

  // Sound and UI controls
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [showRules, setShowRules] = useState<boolean>(false);
  const [bannerFeedback, setBannerFeedback] = useState<string | null>(null);

  // Animation frame reference
  const flightStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const autoCashoutVal = parseFloat(autoCashout);

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  // Generate realistic crash multiplier dynamically controlled by Admin Odds / RTP
  const generateCrashPoint = (): number => {
    // Admin configured winRate (default ~42%)
    const targetWinRate = Math.max(5, Math.min(95, winRate));
    const roll = Math.random() * 100;
    
    // If roll is outside target win rate, house favors an early crash
    if (roll > targetWinRate) {
      const sub = Math.random();
      if (sub < 0.25) return 1.00 + Number((Math.random() * 0.08).toFixed(2)); // Instant crash
      return Number((1.10 + Math.random() * 0.75).toFixed(2)); // Low multiplier (1.10x - 1.85x)
    }

    // Otherwise, generate favorable high multiplier for players
    const sub = Math.random();
    if (sub < 0.60) return Number((2.00 + Math.random() * 3.5).toFixed(2)); // 2.00x - 5.50x
    if (sub < 0.90) return Number((5.50 + Math.random() * 12.0).toFixed(2)); // 5.50x - 17.50x
    return Number((18.00 + Math.random() * 40.0).toFixed(2)); // 18x - 58x Epic Flight
  };

  // Populate mock players
  const generateMockPlayers = () => {
    const names = ['سلطان_VIP', 'أبو_فهد', 'الصاروخ99', 'Falcon_KSA', 'Prince_Ali', 'KingOfOdds', 'DesertStorm'];
    return names.map((name, i) => ({
      id: `p_${i}`,
      name,
      avatar: ['👑', '⚡', '🚀', '💎', '🔥', '🦁', '🌟'][i],
      bet: [100, 500, 1000, 2500, 5000][Math.floor(Math.random() * 5)],
      cashedOutMultiplier: null,
    }));
  };

  // Handle BETTING phase countdown
  useEffect(() => {
    let timer: any = null;
    if (phase === 'BETTING') {
      setCountdown(5);
      setCurrentMultiplier(1.00);
      setHasCashedOut(false);
      setCashedOutAt(null);
      setWinProfit(0);
      setPlayers(generateMockPlayers());

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            startFlight();
            return 0;
          }
          if (!isMuted) sound.playTimerTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // Start the flight
  const startFlight = () => {
    const target = generateCrashPoint();
    setCrashPoint(target);
    setPhase('FLYING');
    if (!isMuted) sound.playGameStart();
    flightStartTimeRef.current = performance.now();
  };

  // Flight multiplier tick loop
  useEffect(() => {
    if (phase !== 'FLYING') return;

    let crashed = false;

    const loop = (time: number) => {
      const elapsedSec = (time - flightStartTimeRef.current) / 1000;
      // Multiplier formula: exponential rise
      const mult = Number((Math.pow(Math.E, 0.075 * elapsedSec)).toFixed(2));

      // Simulate random other players cashing out
      setPlayers((prev) =>
        prev.map((p) => {
          if (!p.cashedOutMultiplier && mult > 1.25 && Math.random() < 0.015) {
            return { ...p, cashedOutMultiplier: mult };
          }
          return p;
        })
      );

      // Check user Auto Cashout
      if (
        hasPlacedBet &&
        !hasCashedOut &&
        autoCashoutVal > 1.01 &&
        mult >= autoCashoutVal &&
        mult < crashPoint
      ) {
        doCashout(mult);
      }

      // Check if reached crash point
      if (mult >= crashPoint) {
        crashed = true;
        setCurrentMultiplier(crashPoint);
        triggerCrash(crashPoint);
        return;
      }

      setCurrentMultiplier(mult);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, crashPoint, hasPlacedBet, hasCashedOut, autoCashoutVal]);

  // Trigger crash event
  const triggerCrash = (finalMult: number) => {
    setPhase('CRASHED');
    if (!isMuted) sound.playExplosion();
    setHistory((prev) => [finalMult, ...prev.slice(0, 9)]);

    // If user was betting and didn't cash out
    if (hasPlacedBet && !hasCashedOut) {
      setBannerFeedback(isRTL ? `انفجر الصاروخ عند x${finalMult.toFixed(2)}!` : `Rocket Crashed at x${finalMult.toFixed(2)}!`);
      setTimeout(() => setBannerFeedback(null), 3000);
    }

    setHasPlacedBet(false);

    // Wait 3.5 seconds before starting next betting phase
    setTimeout(() => {
      setPhase('BETTING');
    }, 3500);
  };

  // Place Bet
  const handlePlaceBet = () => {
    if (phase !== 'BETTING') return;
    if (hasPlacedBet) {
      // Cancel bet
      updateBalance(betAmount);
      setHasPlacedBet(false);
      return;
    }
    if (balance < betAmount) {
      setBannerFeedback(isRTL ? 'الرصيد غير كافٍ للرهان!' : 'Insufficient balance!');
      setTimeout(() => setBannerFeedback(null), 2500);
      return;
    }
    if (!isMuted) sound.playChip();
    updateBalance(-betAmount);
    setHasPlacedBet(true);
  };

  // Cashout during flight
  const doCashout = (mult: number) => {
    if (hasCashedOut || !hasPlacedBet || phase !== 'FLYING') return;
    const profit = Math.floor(betAmount * mult);
    setHasCashedOut(true);
    setCashedOutAt(mult);
    setWinProfit(profit);
    updateBalance(profit);

    if (!isMuted) {
      sound.playCashout();
      sound.playWinFanfare();
    }
    setBannerFeedback(
      isRTL ? `مبروك! ربحت +${profit.toLocaleString()} كوينز (x${mult.toFixed(2)})` : `Won +${profit.toLocaleString()} (x${mult.toFixed(2)})!`
    );
    setTimeout(() => setBannerFeedback(null), 4000);
  };

  // Calculate rocket visual position (0% bottom-left to 80% top-right)
  const flightProgress = Math.min(1, (currentMultiplier - 1.0) / 4.0);
  const rocketX = 12 + flightProgress * 70; // percentage
  const rocketY = 75 - flightProgress * 55; // percentage

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col select-none overflow-x-hidden">
      {/* Background Starry Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-black pointer-events-none" />

      {/* HEADER */}
      <header className="relative z-20 w-full px-3 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title={isRTL ? 'الرجوع للصالة' : 'Back to Lobby'}
          >
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Rocket className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-amber-200">
                {isRTL ? 'صاروخ الحظ (Rocket Crash)' : 'Rocket Crash 3D'}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{isRTL ? 'مباشر • اربح حتى 100X' : 'LIVE • Up to 100X'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Balance & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30">
            <Coins className="w-4 h-4 text-amber-400 animate-spin-slow" />
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

      {/* MULTIPLIER HISTORY PILLS */}
      <div className="relative z-10 w-full px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 shrink-0 px-1">
          <History className="w-3 h-3 text-amber-400" /> {isRTL ? 'السجل:' : 'History:'}
        </span>
        {history.map((mult, idx) => {
          const isHigh = mult >= 10;
          const isMed = mult >= 2;
          return (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-md font-bold text-[11px] shrink-0 border shadow-sm transition ${
                isHigh
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : isMed
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
            >
              x{mult.toFixed(2)}
            </span>
          );
        })}
      </div>

      {/* MAIN GAMEPLAY AREA */}
      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto p-2 md:p-4 flex flex-col gap-3">
        {/* FLIGHT STAGE (3D ROCKET CANVAS) */}
        <div className="relative w-full h-72 md:h-96 rounded-2xl bg-gradient-to-b from-slate-900 via-indigo-950/40 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center">
          {/* Coordinate Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

          {/* Curving Trajectory SVG Path */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <linearGradient id="rocketGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#ef4444" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="1" />
              </linearGradient>
            </defs>
            {phase === 'FLYING' && (
              <path
                d={`M 50 ${window.innerHeight > 0 ? 250 : 250} Q ${(rocketX / 100) * 400} 220 ${(rocketX / 100) * (typeof window !== 'undefined' ? window.innerWidth * 0.8 : 500)} ${(rocketY / 100) * 300}`}
                fill="none"
                stroke="url(#rocketGrad)"
                strokeWidth="3"
                strokeDasharray="4 2"
              />
            )}
          </svg>

          {/* FLIGHT STATES */}
          {phase === 'BETTING' && (
            <div className="flex flex-col items-center justify-center z-10 text-center animate-fade-in">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center mb-3 shadow-xl shadow-amber-500/10">
                <Rocket className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-amber-300">
                {isRTL ? 'الصاروخ يستعد للإقلاع!' : 'Rocket Preparing for Launch!'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 mb-3">
                {isRTL ? 'ضع رهانك الآن قبل انطلاق الرحلة' : 'Place your bet now before takeoff'}
              </p>
              {/* Radial Countdown Ring */}
              <div className="relative w-14 h-14 rounded-full border-4 border-amber-500/30 flex items-center justify-center bg-slate-900 shadow-inner">
                <span className="text-2xl font-black text-amber-400">{countdown}s</span>
              </div>
            </div>
          )}

          {phase === 'FLYING' && (
            <>
              {/* Multiplier Center Display */}
              <div className="absolute top-8 flex flex-col items-center z-10 pointer-events-none animate-pulse">
                <span className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-200 to-amber-500 drop-shadow-[0_4px_24px_rgba(245,158,11,0.5)]">
                  {currentMultiplier.toFixed(2)}x
                </span>
                <span className="text-xs uppercase tracking-widest text-amber-300/80 font-bold mt-1">
                  {isRTL ? 'المضاعف الحالي' : 'CURRENT MULTIPLIER'}
                </span>
              </div>

              {/* Ascending Flying Rocket with Thruster Flames */}
              <div
                className="absolute z-20 transition-all duration-75 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${rocketX}%`,
                  top: `${rocketY}%`,
                }}
              >
                <div className="relative rotate-45 flex items-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-500 to-yellow-400 p-2.5 shadow-[0_0_30px_rgba(244,63,94,0.8)] border border-white/40 flex items-center justify-center">
                    <Rocket className="w-full h-full text-white drop-shadow-md" />
                  </div>
                  {/* Fire Trail */}
                  <div className="absolute -bottom-6 -left-3 -rotate-45 flex flex-col items-center">
                    <Flame className="w-7 h-7 text-amber-400 animate-ping" />
                    <Flame className="w-5 h-5 text-rose-500 animate-pulse -mt-4" />
                  </div>
                </div>
              </div>
            </>
          )}

          {phase === 'CRASHED' && (
            <div className="flex flex-col items-center justify-center z-20 text-center animate-shake">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center mb-2 shadow-[0_0_40px_rgba(225,29,72,0.6)]">
                <Flame className="w-10 h-10 text-rose-500 animate-bounce" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-rose-400">
                {isRTL ? 'انفجر الصاروخ!' : 'FLEW AWAY / CRASHED!'}
              </h2>
              <span className="text-4xl md:text-5xl font-black text-white mt-1 drop-shadow-lg">
                @{currentMultiplier.toFixed(2)}x
              </span>
              <p className="text-xs text-slate-400 mt-2">
                {isRTL ? 'جولة جديدة ستبدأ بعد لحظات...' : 'Next round starts in moments...'}
              </p>
            </div>
          )}

          {/* Cashout notification bubble */}
          {hasCashedOut && (
            <div className="absolute bottom-4 left-4 z-30 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-bounce shadow-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isRTL ? `سحبت أرباحك عند x${cashedOutAt?.toFixed(2)} (+${winProfit.toLocaleString()})` : `Cashed out at x${cashedOutAt?.toFixed(2)} (+${winProfit.toLocaleString()})`}</span>
            </div>
          )}
        </div>

        {/* FEEDBACK BANNER */}
        {bannerFeedback && (
          <div className="w-full py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-center text-xs md:text-sm font-black text-amber-200 animate-fade-in">
            {bannerFeedback}
          </div>
        )}

        {/* BETTING CONTROLS & CASHOUT BUTTON (RESPONSIVE GRID) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Bet Amount Input & Presets */}
          <div className="md:col-span-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> {isRTL ? 'مبلغ الرهان (كوينز):' : 'Bet Amount (Coins):'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={hasPlacedBet}
                  onClick={() => setBetAmount((prev) => Math.max(50, Math.floor(prev / 2)))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 disabled:opacity-40"
                >
                  ½
                </button>
                <button
                  disabled={hasPlacedBet}
                  onClick={() => setBetAmount((prev) => Math.min(balance, prev * 2))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 disabled:opacity-40"
                >
                  2X
                </button>
                <button
                  disabled={hasPlacedBet}
                  onClick={() => setBetAmount(balance)}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-[11px] font-bold text-amber-300 disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Custom Input */}
            <div className="relative w-full">
              <input
                type="number"
                disabled={hasPlacedBet}
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold text-base focus:border-amber-400 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Chip Quick Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {PRESET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  disabled={hasPlacedBet}
                  onClick={() => setBetAmount(chip)}
                  className={`flex-1 min-w-[50px] py-1.5 rounded-lg text-xs font-black transition border ${
                    betAmount === chip
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40'
                  }`}
                >
                  +{chip >= 1000 ? `${chip / 1000}k` : chip}
                </button>
              ))}
            </div>

            {/* Auto Cashout Input */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <span className="text-[11px] font-medium text-slate-400">
                {isRTL ? 'سحب تلقائي عند مضاعف (اختياري):' : 'Auto Cashout Target (Optional):'}
              </span>
              <div className="flex items-center gap-1 w-24">
                <input
                  type="number"
                  step="0.1"
                  placeholder="2.00x"
                  value={autoCashout}
                  disabled={hasPlacedBet}
                  onChange={(e) => setAutoCashout(e.target.value)}
                  className="w-full px-2 py-1 text-center rounded-lg bg-slate-950 border border-slate-700 text-xs text-amber-300 font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ACTION BUTTON (BET OR CASHOUT) */}
          <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-center items-center gap-2 shadow-lg">
            {phase === 'BETTING' ? (
              <button
                onClick={handlePlaceBet}
                className={`w-full h-full min-h-[70px] rounded-2xl font-black text-lg transition flex flex-col items-center justify-center shadow-lg active:scale-95 ${
                  hasPlacedBet
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:brightness-110 text-slate-950 shadow-amber-500/30'
                }`}
              >
                {hasPlacedBet ? (
                  <>
                    <span>{isRTL ? 'إلغاء الرهان' : 'CANCEL BET'}</span>
                    <span className="text-xs font-normal text-rose-200">
                      ({betAmount.toLocaleString()} كوينز)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Rocket className="w-5 h-5" />
                      {isRTL ? 'تأكيد الرهان' : 'PLACE BET'}
                    </span>
                    <span className="text-xs font-bold opacity-80">
                      {betAmount.toLocaleString()} كوينز
                    </span>
                  </>
                )}
              </button>
            ) : phase === 'FLYING' ? (
              hasPlacedBet && !hasCashedOut ? (
                <button
                  onClick={() => doCashout(currentMultiplier)}
                  className="w-full h-full min-h-[70px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:brightness-110 text-slate-950 font-black text-lg shadow-xl shadow-emerald-500/40 active:scale-95 flex flex-col items-center justify-center animate-pulse"
                >
                  <span className="flex items-center gap-1.5 text-slate-950">
                    <Sparkles className="w-5 h-5" />
                    {isRTL ? 'سحب الأرباح الآن' : 'CASH OUT NOW'}
                  </span>
                  <span className="text-xs font-black text-slate-950 bg-emerald-300/60 px-2 py-0.5 rounded-full mt-0.5">
                    +{(Math.floor(betAmount * currentMultiplier)).toLocaleString()} كوينز (x{currentMultiplier.toFixed(2)})
                  </span>
                </button>
              ) : hasCashedOut ? (
                <div className="w-full h-full min-h-[70px] rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-1" />
                  <span className="text-xs font-bold">
                    {isRTL ? `تم سحب الأرباح (+${winProfit.toLocaleString()})` : `Cashed Out (+${winProfit.toLocaleString()})`}
                  </span>
                </div>
              ) : (
                <div className="w-full h-full min-h-[70px] rounded-2xl bg-slate-800/40 border border-slate-700 flex flex-col items-center justify-center text-slate-400">
                  <Rocket className="w-6 h-6 text-slate-500 mb-1" />
                  <span className="text-xs font-medium">
                    {isRTL ? 'الرحلة جارية... انتظر الجولة القادمة' : 'Flight in progress... Next round soon'}
                  </span>
                </div>
              )
            ) : (
              <div className="w-full h-full min-h-[70px] rounded-2xl bg-rose-950/30 border border-rose-800/40 flex flex-col items-center justify-center text-rose-300">
                <Flame className="w-6 h-6 text-rose-500 mb-1" />
                <span className="text-xs font-bold">
                  {isRTL ? 'انتهت الرحلة! جولة جديدة خلال ثوانٍ' : 'Round ended! New flight shortly'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* LIVE PLAYERS TABLE (COMMUNITY BETTING) */}
        <div className="w-full p-3 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {isRTL ? 'اللاعبون في هذه الجولة' : 'Live Round Players'} ({players.length + (hasPlacedBet ? 1 : 0)})
            </span>
            <span className="text-[10px] text-slate-400">
              {isRTL ? 'تحديث لحظي' : 'Realtime Sync'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {hasPlacedBet && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">👑</span>
                  <div>
                    <div className="text-xs font-bold text-amber-300">{userName} (أنت)</div>
                    <div className="text-[10px] text-slate-400">{betAmount.toLocaleString()} كوينز</div>
                  </div>
                </div>
                {hasCashedOut ? (
                  <span className="text-[11px] font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    x{cashedOutAt?.toFixed(2)}
                  </span>
                ) : phase === 'CRASHED' ? (
                  <span className="text-[11px] font-bold text-rose-400">خسارة</span>
                ) : (
                  <span className="text-[10px] text-amber-400 animate-pulse">في الطيران</span>
                )}
              </div>
            )}

            {players.map((p) => (
              <div
                key={p.id}
                className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-base">{p.avatar}</span>
                  <div className="truncate">
                    <div className="text-xs font-medium text-slate-300 truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.bet.toLocaleString()} كوينز</div>
                  </div>
                </div>
                {p.cashedOutMultiplier ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    x{p.cashedOutMultiplier.toFixed(2)}
                  </span>
                ) : phase === 'CRASHED' ? (
                  <span className="text-[10px] text-slate-600">—</span>
                ) : (
                  <span className="text-[10px] text-slate-400">...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/30 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-rose-500" />
                {isRTL ? 'قواعد لعبة الصاروخ (Crash)' : 'Rocket Crash Rules'}
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
                <span className="font-bold text-amber-400">1. مرحلة الرهان:</span>
                <p className="text-slate-400 mt-1">
                  اختر مبلغ الرهان واضغط "تأكيد الرهان" خلال العد التنازلي قبل إقلاع الصاروخ.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-400">2. الصعود والمضاعف:</span>
                <p className="text-slate-400 mt-1">
                  يبدأ الصاروخ بالطيران ويرتفع المضاعف تدريجياً (من 1.00x ويصل إلى 50x وأكثر).
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-rose-400">3. سحب الأرباح أو الانفجار:</span>
                <p className="text-slate-400 mt-1">
                  عليك الضغط على "سحب الأرباح" في أي وقت قبل انفجار الصاروخ. إذا انفجر الصاروخ قبل السحب، تخسر قيمة الرهان.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-sm"
            >
              {isRTL ? 'فهمت، لنبدأ اللعب!' : 'Got it, Let\'s Play!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
