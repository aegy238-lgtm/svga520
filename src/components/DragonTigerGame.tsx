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
  Flame,
  Swords,
  Shield,
  X
} from 'lucide-react';
import { sound } from '../lib/audio';

type GamePhase = 'BETTING' | 'DEALING' | 'RESULT';
type BetSpot = 'DRAGON' | 'TIE' | 'TIGER';

interface CardData {
  suit: '♠' | '♥' | '♣' | '♦';
  rank: string;
  value: number; // 1 (Ace) to 13 (King)
  isRed: boolean;
}

interface DragonTigerGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (delta: number) => Promise<boolean | void>;
  language: 'ar' | 'en';
}

interface RoundRecord {
  id: number;
  dragonCard: CardData;
  tigerCard: CardData;
  winner: BetSpot;
  winAmount: number;
  timestamp: number;
}

const CHIP_VALUES = [50, 500, 2000, 10000];

const SUITS: ('♠' | '♥' | '♣' | '♦')[] = ['♠', '♥', '♣', '♦'];
const RANKS = [
  { rank: 'A', value: 1 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 11 },
  { rank: 'Q', value: 12 },
  { rank: 'K', value: 13 },
];

function getRandomCard(): CardData {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const rankItem = RANKS[Math.floor(Math.random() * RANKS.length)];
  const isRed = suit === '♥' || suit === '♦';
  return {
    suit,
    rank: rankItem.rank,
    value: rankItem.value,
    isRed,
  };
}

export const DragonTigerGame: React.FC<DragonTigerGameProps> = ({
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

  // Cards
  const [dragonCard, setDragonCard] = useState<CardData>({ suit: '♠', rank: 'K', value: 13, isRed: false });
  const [tigerCard, setTigerCard] = useState<CardData>({ suit: '♥', rank: 'Q', value: 12, isRed: true });
  const [isDragonRevealed, setIsDragonRevealed] = useState<boolean>(false);
  const [isTigerRevealed, setIsTigerRevealed] = useState<boolean>(false);
  const [winningSpot, setWinningSpot] = useState<BetSpot | null>(null);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [showResultBanner, setShowResultBanner] = useState<boolean>(false);

  // Modals & UI
  const [showRules, setShowRules] = useState<boolean>(false);
  const [betFeedback, setBetFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<RoundRecord[]>([
    { id: 1, dragonCard: { suit: '♠', rank: 'K', value: 13, isRed: false }, tigerCard: { suit: '♦', rank: '9', value: 9, isRed: true }, winner: 'DRAGON', winAmount: 0, timestamp: Date.now() - 50000 },
    { id: 2, dragonCard: { suit: '♣', rank: '7', value: 7, isRed: false }, tigerCard: { suit: '♥', rank: '10', value: 10, isRed: true }, winner: 'TIGER', winAmount: 0, timestamp: Date.now() - 40000 },
    { id: 3, dragonCard: { suit: '♦', rank: 'J', value: 11, isRed: true }, tigerCard: { suit: '♠', rank: 'J', value: 11, isRed: false }, winner: 'TIE', winAmount: 0, timestamp: Date.now() - 30000 },
    { id: 4, dragonCard: { suit: '♥', rank: 'A', value: 1, isRed: true }, tigerCard: { suit: '♣', rank: '4', value: 4, isRed: false }, winner: 'TIGER', winAmount: 0, timestamp: Date.now() - 20000 },
    { id: 5, dragonCard: { suit: '♠', rank: 'Q', value: 12, isRed: false }, tigerCard: { suit: '♦', rank: '8', value: 8, isRed: true }, winner: 'DRAGON', winAmount: 0, timestamp: Date.now() - 10000 },
  ]);

  const playSfx = (type: 'chip' | 'deal' | 'win' | 'tick') => {
    if (isMuted) return;
    try {
      if (type === 'chip') sound.playChipBet();
      else if (type === 'tick') sound.playTimerTick();
      else if (type === 'deal') sound.playDealCard();
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
            handleStartDealing();
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

  const handleStartDealing = () => {
    setPhase('DEALING');
    setIsDragonRevealed(false);
    setIsTigerRevealed(false);
    playSfx('deal');

    const nextDragon = getRandomCard();
    const nextTiger = getRandomCard();
    setDragonCard(nextDragon);
    setTigerCard(nextTiger);

    // Flip Dragon card after 1s
    setTimeout(() => {
      setIsDragonRevealed(true);
      playSfx('deal');
    }, 1000);

    // Flip Tiger card after 2s
    setTimeout(() => {
      setIsTigerRevealed(true);
      playSfx('deal');
    }, 2000);

    // Resolve outcome after 2.8s
    setTimeout(() => {
      let resultSpot: BetSpot;
      if (nextDragon.value > nextTiger.value) {
        resultSpot = 'DRAGON';
      } else if (nextTiger.value > nextDragon.value) {
        resultSpot = 'TIGER';
      } else {
        resultSpot = 'TIE';
      }

      handleShowdownResult(nextDragon, nextTiger, resultSpot);
    }, 2900);
  };

  const handleShowdownResult = (
    finalDragon: CardData, 
    finalTiger: CardData, 
    resultSpot: BetSpot
  ) => {
    setPhase('RESULT');
    setWinningSpot(resultSpot);

    const betOnSpot = userBets[resultSpot] || 0;
    let multiplier = 2; // Dragon and Tiger payout is 1:1 (2x return)
    if (resultSpot === 'TIE') {
      multiplier = 9; // Tie pays 8:1 (9x return)
    }

    const winAmount = betOnSpot * multiplier;
    setLastWinAmount(winAmount);

    if (winAmount > 0) {
      updateBalance(winAmount);
      playSfx('win');
    }

    setShowResultBanner(true);

    const newRecord: RoundRecord = {
      id: Date.now(),
      dragonCard: finalDragon,
      tigerCard: finalTiger,
      winner: resultSpot,
      winAmount,
      timestamp: Date.now(),
    };

    setHistory((prev) => [newRecord, ...prev].slice(0, 20));
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
    setIsDragonRevealed(false);
    setIsTigerRevealed(false);
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
    updateBalance(-totalRepeat);
    setUserBets({ ...previousBets });
    playSfx('chip');
  };

  const totalCurrentBets = Object.values(userBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);

  // Card component
  const renderCard = (card: CardData, isRevealed: boolean, sideName: string, sideTheme: 'dragon' | 'tiger') => {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
          sideTheme === 'dragon' ? 'text-cyan-300' : 'text-amber-400'
        }`}>
          {sideTheme === 'dragon' ? '🐉 ' : '🐯 '}
          {sideName}
        </span>

        <div className={`relative w-20 h-28 xs:w-24 xs:h-34 sm:w-28 sm:h-40 rounded-2xl border-2 transition-all duration-500 shadow-2xl flex items-center justify-center select-none ${
          isRevealed
            ? 'bg-white text-slate-900 border-amber-300'
            : sideTheme === 'dragon'
            ? 'bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 border-cyan-500/50'
            : 'bg-gradient-to-br from-red-900 via-amber-950 to-slate-950 border-amber-500/50'
        }`}>
          {isRevealed ? (
            <div className={`w-full h-full p-2 flex flex-col justify-between ${card.isRed ? 'text-red-600' : 'text-slate-900'}`}>
              <div className="flex flex-col items-start leading-none">
                <span className="font-mono font-black text-base sm:text-xl">{card.rank}</span>
                <span className="text-sm sm:text-base">{card.suit}</span>
              </div>
              
              <div className="self-center font-black text-3xl sm:text-4xl">
                {card.suit}
              </div>

              <div className="flex flex-col items-end leading-none rotate-180">
                <span className="font-mono font-black text-base sm:text-xl">{card.rank}</span>
                <span className="text-sm sm:text-base">{card.suit}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-yellow-400/40 bg-yellow-400/10 flex items-center justify-center text-xl sm:text-2xl animate-pulse">
                {sideTheme === 'dragon' ? '🐉' : '🐯'}
              </div>
              <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">
                {phase === 'DEALING' ? (isRTL ? 'مغلقة' : 'Dealing') : 'Royal Card'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-full min-h-screen bg-[#090b14] text-white flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-16 sm:pb-4 relative overflow-x-hidden font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Arena Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-[#070913] to-[#04050a] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-30 w-full bg-[#0d1020]/95 backdrop-blur-xl border-b border-amber-500/20 px-3 sm:px-6 py-2.5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 text-xs font-bold"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            <span className="hidden xs:inline">{isRTL ? 'اللوبي' : 'Lobby'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-red-500 to-indigo-600 p-0.5 shadow flex items-center justify-center text-white font-black">
              <Swords className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h1 className="font-serif font-black text-sm sm:text-base text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-rose-400 leading-tight">
                {isRTL ? 'التنين المقاتل (Dragon Tiger)' : 'Dragon Tiger Fight'}
              </h1>
              <span className="text-[9px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {isRTL ? 'مبارزة الورق الأسطورية السريعة' : 'Legendary 2-Card Clash'}
              </span>
            </div>
          </div>
        </div>

        {/* Real Balance & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-xl bg-slate-900 border border-amber-500/40 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400" />
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
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={() => setShowRules(true)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
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

      {/* MAIN BATTLE ARENA */}
      <main className="flex-1 flex flex-col items-center justify-between px-2 sm:px-4 py-2 z-10 max-w-4xl mx-auto w-full">
        
        {/* CARD DEALING BATTLE SHOWDOWN */}
        <div className="w-full relative py-2 sm:py-4 flex flex-col items-center justify-center">
          
          {/* Phase & Countdown Badge */}
          <div className="mb-2 sm:mb-3 flex items-center gap-2">
            <div className={`px-4 py-1.5 rounded-full border shadow-xl flex items-center gap-2 ${
              phase === 'BETTING'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : phase === 'DEALING'
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 animate-pulse'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}>
              <span className="text-xs font-black tracking-wider">
                {phase === 'BETTING' 
                  ? (isRTL ? `وقت الرهان (${timeLeft} ثوانٍ)` : `PLACE BETS (${timeLeft}s)`)
                  : phase === 'DEALING'
                  ? (isRTL ? 'كشف بطاقات النزال...' : 'REVEALING CARDS...')
                  : (isRTL ? 'إعلان الفائز!' : 'SHOWDOWN WINNER!')}
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

          {/* Duel Table: Dragon vs Tiger */}
          <div className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border-2 border-amber-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.7)] p-4 sm:p-6 flex items-center justify-around">
            
            {/* Dragon Wing */}
            <div className="flex flex-col items-center">
              {renderCard(dragonCard, isDragonRevealed, isRTL ? 'التنين' : 'DRAGON', 'dragon')}
            </div>

            {/* VS Emblem in center */}
            <div className="flex flex-col items-center gap-1 mx-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-red-600 via-amber-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg animate-pulse">
                <span className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center font-black text-xs sm:text-sm text-yellow-300 font-serif">
                  VS
                </span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">
                {isRTL ? 'مواجهة' : 'Duel'}
              </span>
            </div>

            {/* Tiger Wing */}
            <div className="flex flex-col items-center">
              {renderCard(tigerCard, isTigerRevealed, isRTL ? 'النمر' : 'TIGER', 'tiger')}
            </div>
          </div>
        </div>

        {/* 3 BETTING SPOTS: DRAGON | TIE | TIGER */}
        <div className="w-full grid grid-cols-3 gap-2 sm:gap-4 my-2 sm:my-4">
          
          {/* DRAGON SPOT */}
          <button
            onClick={() => placeBet('DRAGON')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'DRAGON'
                ? 'bg-gradient-to-b from-cyan-600/80 via-blue-900/90 to-slate-950 border-yellow-400 ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-pulse'
                : 'bg-gradient-to-b from-cyan-950/60 via-slate-900/80 to-slate-950/90 border-cyan-500/40 hover:border-cyan-400 hover:shadow-lg'
            }`}
          >
            <div className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-cyan-600 text-white font-mono font-black text-[9px] sm:text-xs shadow border border-cyan-300">
              1:1 {isRTL ? 'مضاعف' : 'PAY'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black text-2xl sm:text-3xl mt-1">
              🐉
            </div>

            <div className="text-center my-1">
              <h3 className="font-serif font-black text-sm sm:text-lg text-cyan-200">
                {isRTL ? 'التنين' : 'DRAGON'}
              </h3>
              <p className="text-[9px] sm:text-[10px] font-mono text-cyan-300/80">
                {isRTL ? 'البطاقة الأعلى تفوز' : 'Higher card wins'}
              </p>
            </div>

            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['DRAGON'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-cyan-950/80 text-cyan-300/60 border border-cyan-900'
            }`}>
              {(userBets['DRAGON'] || 0) > 0 ? `+${userBets['DRAGON']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>

          {/* TIE SPOT (8:1 PAYOUT) */}
          <button
            onClick={() => placeBet('TIE')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'TIE'
                ? 'bg-gradient-to-b from-emerald-600/90 via-emerald-800/90 to-slate-950 border-yellow-300 ring-4 ring-yellow-400 shadow-[0_0_35px_rgba(250,204,21,0.9)] animate-bounce'
                : 'bg-gradient-to-b from-emerald-950/70 via-slate-900 to-slate-950 border-emerald-500/50 hover:border-emerald-400 hover:shadow-lg'
            }`}
          >
            <div className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-mono font-black text-[9px] sm:text-xs shadow border border-white animate-pulse">
              8:1 {isRTL ? 'التعادل الأسطوري' : 'SUPER TIE'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-black text-2xl sm:text-3xl mt-1">
              🤝
            </div>

            <div className="text-center my-1">
              <h3 className="font-serif font-black text-sm sm:text-lg text-emerald-300">
                {isRTL ? 'تعادل (TIE)' : 'TIE'}
              </h3>
              <p className="text-[9px] sm:text-[10px] font-mono text-emerald-300/80">
                {isRTL ? 'نفس قيمة الرتبة' : 'Same card rank'}
              </p>
            </div>

            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['TIE'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-emerald-950/80 text-emerald-300/60 border border-emerald-900'
            }`}>
              {(userBets['TIE'] || 0) > 0 ? `+${userBets['TIE']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>

          {/* TIGER SPOT */}
          <button
            onClick={() => placeBet('TIGER')}
            disabled={phase !== 'BETTING'}
            className={`relative rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-between border-2 transition-all cursor-pointer select-none active:scale-95 ${
              winningSpot === 'TIGER'
                ? 'bg-gradient-to-b from-amber-600/80 via-orange-900/90 to-slate-950 border-yellow-400 ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.6)] animate-pulse'
                : 'bg-gradient-to-b from-amber-950/60 via-slate-900/80 to-slate-950/90 border-amber-500/40 hover:border-amber-400 hover:shadow-lg'
            }`}
          >
            <div className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-amber-600 text-white font-mono font-black text-[9px] sm:text-xs shadow border border-amber-300">
              1:1 {isRTL ? 'مضاعف' : 'PAY'}
            </div>

            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-black text-2xl sm:text-3xl mt-1">
              🐯
            </div>

            <div className="text-center my-1">
              <h3 className="font-serif font-black text-sm sm:text-lg text-amber-200">
                {isRTL ? 'النمر' : 'TIGER'}
              </h3>
              <p className="text-[9px] sm:text-[10px] font-mono text-amber-300/80">
                {isRTL ? 'البطاقة الأعلى تفوز' : 'Higher card wins'}
              </p>
            </div>

            <div className={`mt-1 w-full py-1 rounded-xl text-center font-mono font-black text-xs ${
              (userBets['TIGER'] || 0) > 0
                ? 'bg-yellow-400 text-slate-950 shadow border border-white'
                : 'bg-amber-950/80 text-amber-300/60 border border-amber-900'
            }`}>
              {(userBets['TIGER'] || 0) > 0 ? `+${userBets['TIGER']}` : (isRTL ? 'انقر للرهان' : 'Tap to Bet')}
            </div>
          </button>
        </div>

        {/* ROAD MAP & RECENT OUTCOMES */}
        <div className="w-full bg-slate-950/80 rounded-2xl p-2.5 border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shadow-inner">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-amber-300">
            <HistoryIcon className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{isRTL ? 'تاريخ المعارك:' : 'Roadmap:'}</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {history.slice(0, 12).map((h) => (
              <div
                key={h.id}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex flex-col items-center justify-center text-[10px] font-mono font-black shrink-0 border shadow ${
                  h.winner === 'DRAGON'
                    ? 'bg-cyan-600 text-white border-cyan-400'
                    : h.winner === 'TIGER'
                    ? 'bg-amber-500 text-slate-950 border-yellow-200'
                    : 'bg-emerald-600 text-white border-emerald-400'
                }`}
                title={`${h.winner} (Dragon: ${h.dragonCard.rank}${h.dragonCard.suit} vs Tiger: ${h.tigerCard.rank}${h.tigerCard.suit})`}
              >
                <span>{h.winner === 'DRAGON' ? 'D' : h.winner === 'TIGER' ? 'T' : 'X'}</span>
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
              className="px-2.5 py-1 rounded-xl bg-indigo-900/80 hover:bg-indigo-800 text-[10px] font-bold text-indigo-200 border border-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isRTL ? 'تكرار' : 'Repeat'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM CHIPS SELECTOR BAR */}
        <div className="w-full mt-3 pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
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
                      ? 'bg-gradient-to-tr from-cyan-700 to-blue-500 text-white border-2 border-cyan-300'
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
              {lastWinAmount > 0 ? '🏆' : '⚔️'}
            </div>

            <h3 className="font-serif font-black text-xl text-yellow-300">
              {lastWinAmount > 0
                ? (isRTL ? 'مبروك! فوز مستحق' : 'CONGRATULATIONS!')
                : (isRTL ? 'انتهت الجولة' : 'ROUND FINISHED')}
            </h3>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 w-full font-mono">
              <div className="text-xs text-slate-300">
                {isRTL ? 'الفائز بالجولة:' : 'Winning Side:'} <strong className="text-yellow-400">{winningSpot === 'DRAGON' ? '🐉 DRAGON' : winningSpot === 'TIGER' ? '🐯 TIGER' : '🤝 TIE'}</strong>
              </div>
              <div className="text-sm font-black text-white mt-1">
                Dragon ({dragonCard.rank}{dragonCard.suit}) vs Tiger ({tigerCard.rank}{tigerCard.suit})
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
                <Swords className="w-5 h-5 text-amber-400" />
                <span>{isRTL ? 'قواعد لعبة التنين المقاتل (Dragon Tiger)' : 'Dragon Tiger Rules'}</span>
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="p-1 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-500/30">
                <strong className="text-cyan-300 block mb-1">🐉 {isRTL ? 'رهان التنين (DRAGON):' : 'DRAGON Bet:'}</strong>
                <p>{isRTL ? 'يفوز إذا كانت بطاقة التنين أعلى رتبة من بطاقة النمر. نسبة الربح 1:1 (مضاعف 2X).' : 'Wins if Dragon card is higher than Tiger card. Payout is 1:1 (2X total).'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/30">
                <strong className="text-amber-300 block mb-1">🐯 {isRTL ? 'رهان النمر (TIGER):' : 'TIGER Bet:'}</strong>
                <p>{isRTL ? 'يفوز إذا كانت بطاقة النمر أعلى رتبة من بطاقة التنين. نسبة الربح 1:1 (مضاعف 2X).' : 'Wins if Tiger card is higher than Dragon card. Payout is 1:1 (2X total).'}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/30">
                <strong className="text-emerald-400 block mb-1">🤝 {isRTL ? 'رهان التعادل (TIE):' : 'TIE Bet:'}</strong>
                <p>{isRTL ? 'يفوز إذا تساوت رتبة بطاقتي التنين والنمر. الجائزة الكبرى 8:1 (مضاعف 9X).' : 'Wins if Dragon and Tiger cards have the exact same rank. Big payout 8:1 (9X total).'}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/40 text-[11px] text-slate-400">
                {isRTL ? 'ترتيب البطاقات من الأضعف للأقوى: A (1) ثم 2، 3، 4 ... وصولاً إلى K (13) الملك.' : 'Card hierarchy from lowest to highest: A (1), 2, 3 ... J (11), Q (12), K (13).'}
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
