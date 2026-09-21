import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Trophy,
  Volume2,
  VolumeX,
  History,
  Sparkles,
  Zap,
  Coins,
  Flag,
  HelpCircle,
  X,
  Flame,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { sound } from '../lib/audio';

interface HorseRacingGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (amount: number) => void;
  language: string;
  winRate?: number;
}

interface Horse {
  id: number;
  number: number;
  nameAr: string;
  nameEn: string;
  jockeyAr: string;
  jockeyEn: string;
  color: string;
  bgSilk: string;
  borderSilk: string;
  odds: number;
  stars: number;
}

const HORSES: Horse[] = [
  {
    id: 1,
    number: 1,
    nameAr: 'البرق السريع',
    nameEn: 'Lightning Flash',
    jockeyAr: 'الفارس راشد',
    jockeyEn: 'Jockey Rashid',
    color: '#ef4444',
    bgSilk: 'bg-red-600',
    borderSilk: 'border-red-400',
    odds: 2.5,
    stars: 5,
  },
  {
    id: 2,
    number: 2,
    nameAr: 'أمير الصحراء',
    nameEn: 'Desert Prince',
    jockeyAr: 'الفارس فيصل',
    jockeyEn: 'Jockey Faisal',
    color: '#10b981',
    bgSilk: 'bg-emerald-600',
    borderSilk: 'border-emerald-400',
    odds: 3.8,
    stars: 4,
  },
  {
    id: 3,
    number: 3,
    nameAr: 'المجد الملكي',
    nameEn: 'Royal Glory',
    jockeyAr: 'الفارس سالم',
    jockeyEn: 'Jockey Salem',
    color: '#3b82f6',
    bgSilk: 'bg-blue-600',
    borderSilk: 'border-blue-400',
    odds: 5.5,
    stars: 4,
  },
  {
    id: 4,
    number: 4,
    nameAr: 'سهم الشمال',
    nameEn: 'Northern Arrow',
    jockeyAr: 'الفارس حمزة',
    jockeyEn: 'Jockey Hamza',
    color: '#a855f7',
    bgSilk: 'bg-purple-600',
    borderSilk: 'border-purple-400',
    odds: 8.0,
    stars: 3,
  },
  {
    id: 5,
    number: 5,
    nameAr: 'ظل الليل',
    nameEn: 'Night Shadow',
    jockeyAr: 'الفارس عمر',
    jockeyEn: 'Jockey Omar',
    color: '#06b6d4',
    bgSilk: 'bg-cyan-600',
    borderSilk: 'border-cyan-400',
    odds: 14.0,
    stars: 2,
  },
  {
    id: 6,
    number: 6,
    nameAr: 'الصقر الذهبي',
    nameEn: 'Golden Falcon',
    jockeyAr: 'الفارس منصور',
    jockeyEn: 'Jockey Mansour',
    color: '#f59e0b',
    bgSilk: 'bg-amber-600',
    borderSilk: 'border-amber-400',
    odds: 25.0,
    stars: 1,
  },
];

const CHIP_VALUES = [50, 200, 500, 2000, 10000];

type RacePhase = 'BETTING' | 'RACING' | 'RESULT';

export const HorseRacingGame: React.FC<HorseRacingGameProps> = ({
  onBack,
  balance,
  userName,
  updateBalance,
  winRate = 38,
}) => {
  const { isRTL } = useLanguage();
  const [phase, setPhase] = useState<RacePhase>('BETTING');
  const [countdown, setCountdown] = useState<number>(10);
  const [selectedChip, setSelectedChip] = useState<number>(100);

  // User Bets: map horseId -> amount
  const [bets, setBets] = useState<Record<number, number>>({});
  const [previousBets, setPreviousBets] = useState<Record<number, number>>({});

  // Real-time race positions (0 to 100 percent)
  const [positions, setPositions] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0,
  });

  // Speeds and finish order
  const [raceCommentary, setRaceCommentary] = useState<string>('');
  const [winners, setWinners] = useState<Horse[]>([]);
  const [winPayout, setWinPayout] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([1, 3, 2, 6, 2, 4, 1]);

  // Modals & sounds
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());
  const [showRules, setShowRules] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const raceIntervalRef = useRef<any>(null);

  const toggleSound = () => {
    const next = !isMuted;
    sound.setMuted(next);
    setIsMuted(next);
  };

  // Betting Countdown timer
  useEffect(() => {
    let timer: any = null;
    if (phase === 'BETTING') {
      setCountdown(10);
      setPositions({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
      setWinners([]);
      setWinPayout(0);
      setRaceCommentary(isRTL ? 'ضع رهانك على الحصان البطل!' : 'Place your bet on the champion horse!');

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            startRace();
            return 0;
          }
          if (!isMuted) sound.playTimerTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase]);

  // Start the Live Race
  const startRace = () => {
    setPhase('RACING');
    if (!isMuted) sound.playBugle();

    // Check if player placed bets
    let userFavoriteHorseId: number | null = null;
    let maxBet = 0;
    Object.entries(bets).forEach(([hId, val]) => {
      const numVal = Number(val);
      if (numVal > maxBet) {
        maxBet = numVal;
        userFavoriteHorseId = Number(hId);
      }
    });

    const targetWinRate = Math.max(5, Math.min(95, winRate));
    const roll = Math.random() * 100;
    const shouldPlayerWin = maxBet > 0 && roll <= targetWinRate;

    // Determine target speeds biased by horse odds and target winRate
    const speeds: Record<number, number> = {};
    HORSES.forEach((h) => {
      // lower odds = higher base chance
      const baseProb = (1 / h.odds) * 1.5;
      let bias = 0;
      if (userFavoriteHorseId !== null) {
        if (h.id === userFavoriteHorseId) {
          bias = shouldPlayerWin ? 0.35 : -0.22;
        }
      }
      speeds[h.id] = Math.max(0.6, 0.8 + Math.random() * 0.4 + baseProb * 0.3 + bias);
    });

    let currentPos: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let tickCount = 0;

    raceIntervalRef.current = setInterval(() => {
      tickCount++;

      // Play occasional hoof sound
      if (!isMuted && tickCount % 4 === 0) {
        sound.playGallop();
      }

      let leaderId = 1;
      let maxDist = 0;

      HORSES.forEach((h) => {
        // Random micro speed variations
        const jitter = (Math.random() - 0.48) * 0.6;
        currentPos[h.id] = Math.min(100, currentPos[h.id] + speeds[h.id] + jitter);
        if (currentPos[h.id] > maxDist) {
          maxDist = currentPos[h.id];
          leaderId = h.id;
        }
      });

      setPositions({ ...currentPos });

      // Live commentary
      const leaderHorse = HORSES.find((h) => h.id === leaderId);
      if (maxDist < 30) {
        setRaceCommentary(isRTL ? `انطلاقة قوية وسريعة للمتسابقين!` : `Fast explosive start!`);
      } else if (maxDist < 70) {
        setRaceCommentary(
          isRTL
            ? `${leaderHorse?.nameAr} يقود السباق بثبات ورشاقة!`
            : `${leaderHorse?.nameEn} takes the lead with authority!`
        );
      } else if (maxDist < 95) {
        setRaceCommentary(
          isRTL
            ? `الأمتار الأخيرة الحاسمة! منافسة نارية على خط النهاية!`
            : `Final intense furlongs! Fierce battle to the wire!`
        );
      }

      // Check if any horse crossed 100%
      if (maxDist >= 100) {
        clearInterval(raceIntervalRef.current);
        finishRace(currentPos);
      }
    }, 120);
  };

  // Finish Race and calculate winnings
  const finishRace = (finalPositions: Record<number, number>) => {
    // Sort horses by distance descending
    const sorted = [...HORSES].sort((a, b) => finalPositions[b.id] - finalPositions[a.id]);
    const champion = sorted[0];

    setWinners(sorted.slice(0, 3));
    setPhase('RESULT');
    setHistory((prev) => [champion.number, ...prev.slice(0, 9)]);

    // Check user payout
    const userBetOnChamp = bets[champion.id] || 0;
    if (userBetOnChamp > 0) {
      const payout = Math.floor(userBetOnChamp * champion.odds);
      setWinPayout(payout);
      updateBalance(payout);
      if (!isMuted) sound.playWinFanfare();
      setFeedback(
        isRTL
          ? `مبروك! فاز حصانك ${champion.nameAr}! ربحت +${payout.toLocaleString()} كوينز`
          : `Congratulations! ${champion.nameEn} won! You earned +${payout.toLocaleString()} coins!`
      );
    } else {
      setFeedback(
        isRTL
          ? `الفائز بالمركز الأول: ${champion.nameAr} (${champion.odds}X)`
          : `1st Place: ${champion.nameEn} (${champion.odds}X)`
      );
    }

    // Save previous bets for rebet
    setPreviousBets(bets);
    setBets({});

    // Reset to betting after 6 seconds
    setTimeout(() => {
      setPhase('BETTING');
    }, 6000);
  };

  // Handle Placing Bet on Horse
  const handleBetHorse = (horseId: number) => {
    if (phase !== 'BETTING') return;
    if (balance < selectedChip) {
      setFeedback(isRTL ? 'الرصيد غير كافٍ!' : 'Insufficient balance!');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }

    if (!isMuted) sound.playChip();
    updateBalance(-selectedChip);
    setBets((prev) => ({
      ...prev,
      [horseId]: (prev[horseId] || 0) + selectedChip,
    }));
  };

  // Clear all bets
  const handleClearBets = () => {
    if (phase !== 'BETTING') return;
    const totalBet = Object.values(bets).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    if (totalBet > 0) {
      updateBalance(totalBet);
      setBets({});
    }
  };

  // Repeat previous bets
  const handleRepeatBets = () => {
    if (phase !== 'BETTING') return;
    const totalRepeat = Object.values(previousBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    if (totalRepeat <= 0) return;
    if (balance < totalRepeat) {
      setFeedback(isRTL ? 'الرصيد غير كافٍ لتكرار الرهان!' : 'Insufficient balance!');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }
    updateBalance(-totalRepeat);
    setBets(previousBets);
    if (!isMuted) sound.playChip();
  };

  const totalBetsPlaced = Object.values(bets).reduce<number>((a, b) => a + (Number(b) || 0), 0);

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col select-none overflow-x-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/40 via-slate-950 to-black pointer-events-none" />

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <span className="text-xl">🐎</span>
            </div>
            <div>
              <h1 className="text-sm md:text-base font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-400 to-amber-200">
                {isRTL ? 'سباق الخيول الملكي (Royal Derby)' : 'Royal Derby Horses'}
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>{isRTL ? 'مضمار مباشر • 6 خيول عربية' : 'LIVE Turf • 6 Racehorses'}</span>
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

      {/* RECENT WINNERS HISTORY */}
      <div className="relative z-10 w-full px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 shrink-0 px-1">
          <History className="w-3 h-3 text-amber-400" /> {isRTL ? 'أبطال الجولات:' : 'Last Winners:'}
        </span>
        {history.map((num, idx) => {
          const horse = HORSES.find((h) => h.number === num);
          return (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md font-black text-[11px] shrink-0 border flex items-center gap-1 shadow-sm"
              style={{
                backgroundColor: `${horse?.color}20`,
                borderColor: horse?.color,
                color: horse?.color,
              }}
            >
              #{num} {isRTL ? horse?.nameAr : horse?.nameEn}
            </span>
          );
        })}
      </div>

      {/* MAIN DERBY ARENA */}
      <div className="relative z-10 flex-1 w-full max-w-5xl mx-auto p-2 md:p-4 flex flex-col gap-3">
        {/* LIVE RACE TRACK & LANES */}
        <div className="relative w-full rounded-2xl bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl p-2.5 md:p-4 flex flex-col gap-2 overflow-hidden">
          {/* Status & Live Commentary Top Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-amber-300 truncate">
                {raceCommentary}
              </span>
            </div>
            {phase === 'BETTING' && (
              <span className="text-xs font-black text-rose-400 animate-pulse flex items-center gap-1">
                ⏳ {countdown}s
              </span>
            )}
            {phase === 'RACING' && (
              <span className="text-xs font-black text-emerald-400 animate-bounce flex items-center gap-1">
                🏁 {isRTL ? 'السباق جارٍ!' : 'RACE IN PROGRESS!'}
              </span>
            )}
          </div>

          {/* 6 RACE LANES */}
          <div className="relative w-full flex flex-col gap-1.5 py-1">
            {/* Finish Line (Right side in LTR, Left in RTL) */}
            <div
              className={`absolute top-0 bottom-0 ${
                isRTL ? 'left-6' : 'right-6'
              } w-3 z-10 bg-[repeating-linear-gradient(45deg,#fff,#fff_4px,#000_4px,#000_8px)] opacity-80 shadow-lg pointer-events-none`}
            />

            {HORSES.map((horse) => {
              const pos = positions[horse.id] || 0;
              const userBet = bets[horse.id] || 0;
              const isLead =
                phase === 'RACING' &&
                pos === Math.max(...HORSES.map((h) => positions[h.id] || 0)) &&
                pos > 5;

              return (
                <div
                  key={horse.id}
                  className="relative w-full h-11 md:h-12 rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden flex items-center px-2"
                >
                  {/* Lane Turf markings */}
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] bg-[size:20px_100%] pointer-events-none" />

                  {/* Horse Label (Static on start edge) */}
                  <div className="z-10 flex items-center gap-1.5 min-w-[100px] md:min-w-[130px]">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] text-white shadow-md"
                      style={{ backgroundColor: horse.color }}
                    >
                      {horse.number}
                    </span>
                    <div className="truncate">
                      <div className="text-[11px] font-bold text-slate-200 truncate">
                        {isRTL ? horse.nameAr : horse.nameEn}
                      </div>
                      <div className="text-[9px] text-amber-400 font-semibold">
                        {horse.odds}X {userBet > 0 && `• [${userBet.toLocaleString()}]`}
                      </div>
                    </div>
                  </div>

                  {/* Running Horse Icon Moving on Lane */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-100 flex items-center gap-1 z-20"
                    style={{
                      [isRTL ? 'right' : 'left']: `calc(${100 + (pos / 100) * (window?.innerWidth > 600 ? 500 : 200)}px)`,
                    }}
                  >
                    <div
                      className={`relative flex items-center justify-center p-1 rounded-full shadow-lg ${
                        phase === 'RACING' ? 'animate-bounce' : ''
                      }`}
                      style={{
                        backgroundColor: `${horse.color}30`,
                        border: `1.5px solid ${horse.color}`,
                      }}
                    >
                      <span className="text-lg md:text-xl">🐎</span>
                      {isLead && (
                        <Flame className="absolute -top-3 -right-2 w-4 h-4 text-amber-400 animate-ping" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PODIUM CEREMONY (RESULT PHASE) */}
          {phase === 'RESULT' && winners.length > 0 && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mb-2 shadow-2xl shadow-amber-500/30">
                <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-amber-300">
                {isRTL ? 'نتائج سباق الخيول الرسمي!' : 'Official Derby Results!'}
              </h2>

              <div className="grid grid-cols-3 gap-2 w-full max-w-sm my-3">
                {/* 2nd Place */}
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center">
                  <span className="text-lg">🥈</span>
                  <span className="text-xs font-bold text-slate-300 truncate">
                    #{winners[1]?.number} {isRTL ? winners[1]?.nameAr : winners[1]?.nameEn}
                  </span>
                  <span className="text-[10px] text-slate-400">المركز الثاني</span>
                </div>

                {/* 1st Place */}
                <div className="p-2.5 rounded-xl bg-gradient-to-b from-amber-500/20 to-yellow-500/10 border-2 border-amber-400 flex flex-col items-center shadow-lg transform -translate-y-2">
                  <span className="text-2xl">🥇</span>
                  <span className="text-xs font-black text-amber-300 truncate">
                    #{winners[0]?.number} {isRTL ? winners[0]?.nameAr : winners[0]?.nameEn}
                  </span>
                  <span className="text-[10px] font-bold text-amber-400">{winners[0]?.odds}X</span>
                </div>

                {/* 3rd Place */}
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center">
                  <span className="text-lg">🥉</span>
                  <span className="text-xs font-bold text-slate-300 truncate">
                    #{winners[2]?.number} {isRTL ? winners[2]?.nameAr : winners[2]?.nameEn}
                  </span>
                  <span className="text-[10px] text-slate-400">المركز الثالث</span>
                </div>
              </div>

              {winPayout > 0 ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-black animate-bounce">
                  {isRTL ? `تهانينا! ربحت +${winPayout.toLocaleString()} كوينز` : `Won +${winPayout.toLocaleString()} Coins!`}
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {isRTL ? 'حظ أوفر في الجولة القادمة!' : 'Better luck in the next race!'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className="w-full py-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-center text-xs font-bold text-amber-200">
            {feedback}
          </div>
        )}

        {/* BETTING CONTROLS & HORSES BET CARDS */}
        <div className="w-full flex flex-col gap-2">
          {/* Chip Selector and Action Buttons */}
          <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            {/* Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-xs font-bold text-slate-400 px-1">
                {isRTL ? 'الرقاقة:' : 'Chip:'}
              </span>
              {CHIP_VALUES.map((chip) => (
                <button
                  key={chip}
                  disabled={phase !== 'BETTING'}
                  onClick={() => setSelectedChip(chip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-md active:scale-95 ${
                    selectedChip === chip
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 disabled:opacity-40'
                  }`}
                >
                  +{chip >= 1000 ? `${chip / 1000}k` : chip}
                </button>
              ))}
            </div>

            {/* Clear & Repeat buttons */}
            <div className="flex items-center gap-1.5">
              <button
                disabled={phase !== 'BETTING' || totalBetsPlaced === 0}
                onClick={handleClearBets}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 disabled:opacity-40"
              >
                {isRTL ? 'مسح الرهان' : 'Clear'}
              </button>
              <button
                disabled={phase !== 'BETTING'}
                onClick={handleRepeatBets}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-bold border border-indigo-500/40 disabled:opacity-40 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isRTL ? 'تكرار' : 'Repeat'}
              </button>
            </div>
          </div>

          {/* Horse Betting Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {HORSES.map((horse) => {
              const currentBet = bets[horse.id] || 0;
              return (
                <button
                  key={horse.id}
                  disabled={phase !== 'BETTING'}
                  onClick={() => handleBetHorse(horse.id)}
                  className={`relative p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between shadow-lg active:scale-95 disabled:opacity-60 ${
                    currentBet > 0
                      ? 'bg-amber-500/15 border-amber-400 shadow-amber-500/20 ring-1 ring-amber-400'
                      : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800'
                  }`}
                >
                  {/* Horse Badge Header */}
                  <div className="flex items-center justify-between w-full mb-1">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] text-white"
                      style={{ backgroundColor: horse.color }}
                    >
                      {horse.number}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                      {horse.odds}X
                    </span>
                  </div>

                  {/* Horse Info */}
                  <div className="w-full truncate">
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {isRTL ? horse.nameAr : horse.nameEn}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {isRTL ? horse.jockeyAr : horse.jockeyEn}
                    </div>
                  </div>

                  {/* Current Bet on this horse */}
                  <div className="w-full mt-2 pt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">{isRTL ? 'رهانك:' : 'Bet:'}</span>
                    <span
                      className={`font-black ${
                        currentBet > 0 ? 'text-amber-300' : 'text-slate-500'
                      }`}
                    >
                      {currentBet > 0 ? currentBet.toLocaleString() : '—'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-amber-500/30 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-base font-black text-amber-300 flex items-center gap-2">
                <span className="text-xl">🐎</span>
                {isRTL ? 'قواعد سباق الخيول الملكي' : 'Royal Derby Rules'}
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
                <span className="font-bold text-amber-400">1. مرحلة المراهنة:</span>
                <p className="text-slate-400 mt-1">
                  لديك 10 ثوانٍ لاختيار الحصان المفضل لديك ووضع الرقاقات عليه قبل بدء السباق.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-400">2. السباق المباشر:</span>
                <p className="text-slate-400 mt-1">
                  تنطلق الخيول الستة في مضمار عشبي مباشر، وتتنافس حتى خط النهاية مع سرعات فيزيائية واقعية.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-bold text-rose-400">3. احتساب الأرباح:</span>
                <p className="text-slate-400 mt-1">
                  الحصان الذي يعبر خط النهاية بالمركز الأول يفوز بمضاعفه الكامل (مثلاً 2.5X إلى 25X) ويتم تحويل الأرباح فوراً لرصيدك.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-sm"
            >
              {isRTL ? 'فهمت، جاهز للسباق!' : 'Ready to Race!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
