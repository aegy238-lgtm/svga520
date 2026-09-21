import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Settings,
  Trophy,
  History,
  ChevronRight,
  VolumeX,
  Volume2,
  HelpCircle,
  X,
  Sparkles,
  Coins,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { sound } from '../lib/audio';

interface HappyCakeGameProps {
  onBack: () => void;
  balance: number;
  userId: string;
  userName: string;
  updateBalance: (amount: number) => void;
  language: string;
}

type GamePhase = 'BETTING' | 'SPINNING' | 'RESULT';

interface TileInfo {
  id: number;
  name: string;
  nameAr: string;
  multiplier: number;
  icon: string;
  badge: string;
  badgeColor: string;
  isHot?: boolean;
  type: 'veg' | 'meat' | 'special';
}

const TILES: TileInfo[] = [
  { id: 0, name: 'Bread', nameAr: 'خبز', multiplier: 45, icon: '🍞', badge: 'x45', badgeColor: 'bg-amber-600', isHot: true, type: 'special' },
  { id: 1, name: 'Fish', nameAr: 'سمك', multiplier: 25, icon: '🐟', badge: 'x25', badgeColor: 'bg-orange-500', type: 'meat' },
  { id: 2, name: 'Apple', nameAr: 'تفاح', multiplier: 15, icon: '🍎', badge: 'x15', badgeColor: 'bg-rose-500', type: 'veg' },
  { id: 3, name: 'Meat', nameAr: 'لحم', multiplier: 10, icon: '🥩', badge: 'x10', badgeColor: 'bg-pink-500', type: 'meat' },
  { id: 4, name: 'Eggplant', nameAr: 'باذنجان', multiplier: 5, icon: '🍆', badge: 'x5', badgeColor: 'bg-teal-500', type: 'veg' },
  { id: 5, name: 'Cabbage', nameAr: 'خس', multiplier: 5, icon: '🥬', badge: 'x5', badgeColor: 'bg-teal-500', type: 'veg' },
  { id: 6, name: 'Pumpkin', nameAr: 'قرع', multiplier: 5, icon: '🎃', badge: 'x5', badgeColor: 'bg-teal-500', type: 'veg' },
  { id: 7, name: 'Watermelon', nameAr: 'بطيخ', multiplier: 5, icon: '🍉', badge: 'x5', badgeColor: 'bg-teal-500', type: 'veg' },
];

const BET_AMOUNTS = [50, 500, 2000, 10000];

export const HappyCakeGame: React.FC<HappyCakeGameProps> = ({
  onBack,
  balance,
  userId,
  userName,
  updateBalance,
  language,
}) => {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<GamePhase>('BETTING');
  const [timeLeft, setTimeLeft] = useState<number>(6);
  const [selectedBet, setSelectedBet] = useState<number>(500);
  const [userBets, setUserBets] = useState<{ [tileIndex: number]: number }>({});
  const [winningTile, setWinningTile] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [indicatorAngle, setIndicatorAngle] = useState(0);
  const [roundNumber, setRoundNumber] = useState(334);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [betFeedback, setBetFeedback] = useState<string | null>(null);

  const isRTL = language === 'ar';

  // Sound helper that respects local mute state
  const playSfx = (type: 'chip' | 'spin' | 'win' | 'tick') => {
    if (isMuted) return;
    try {
      if (type === 'chip') sound.playChipBet();
      else if (type === 'tick') sound.playTimerTick();
      else if (type === 'spin') sound.playDealCard();
      else if (type === 'win') sound.playWinFanfare();
    } catch {
      // Audio context might be restricted before interaction
    }
  };

  // Seed initial history
  useEffect(() => {
    setHistory([
      { id: 1, winningTile: 6, winAmount: 0, multiplier: 5 },
      { id: 2, winningTile: 4, winAmount: 0, multiplier: 5 },
      { id: 3, winningTile: 7, winAmount: 0, multiplier: 5 },
      { id: 4, winningTile: 1, winAmount: 0, multiplier: 25 },
      { id: 5, winningTile: 5, winAmount: 0, multiplier: 5 },
      { id: 6, winningTile: 2, winAmount: 0, multiplier: 15 },
      { id: 7, winningTile: 0, winAmount: 0, multiplier: 45 },
      { id: 8, winningTile: 3, winAmount: 0, multiplier: 10 },
    ]);
  }, []);

  // Game Loop
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (phase === 'BETTING') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSpin();
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

  const handleSpin = () => {
    setPhase('SPINNING');
    playSfx('spin');

    // Pick random outcome
    const resultIndex = Math.floor(Math.random() * TILES.length);
    setWinningTile(resultIndex);

    // Indicator rotation: wheel is static, golden indicator sweeps around the fruits
    setIndicatorAngle((prev) => {
      const extraSpins = 5 * 360; // 5 full turns
      const currentMod = ((prev % 360) + 360) % 360;
      const targetOffset = resultIndex * 45; // 0=Apple, 45=Steak, 90=Eggplant...
      let delta = targetOffset - currentMod;
      if (delta <= 0) delta += 360;
      return prev + extraSpins + delta;
    });

    // Rapid audio ticks simulating selector sweeping across fruit pegs
    let tickCount = 0;
    const maxTicks = 26;
    const tickInterval = setInterval(() => {
      tickCount++;
      if (tickCount <= maxTicks) {
        playSfx('tick');
      } else {
        clearInterval(tickInterval);
      }
    }, 160);

    setTimeout(() => {
      clearInterval(tickInterval);
      handleResult(resultIndex);
    }, 5200);
  };

  const handleResult = (resultIndex: number) => {
    setPhase('RESULT');
    const winningTileObj = TILES[resultIndex];
    const multiplier = winningTileObj.multiplier;
    const betOnTile = userBets[resultIndex] || 0;
    const totalBet = Object.values(userBets).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    const winAmount = betOnTile * multiplier;

    setLastWinAmount(winAmount);

    if (winAmount > 0) {
      updateBalance(winAmount);
      playSfx('win');
    }

    const roundData = {
      id: Date.now(),
      winningTile: resultIndex,
      multiplier,
      totalBet,
      winAmount,
    };

    setHistory((prev) => [roundData, ...prev].slice(0, 15));
    setShowResult(true);

    setTimeout(() => {
      setShowResult(false);
      resetRound();
    }, 4500);
  };

  const resetRound = () => {
    setPhase('BETTING');
    setTimeLeft(6);
    setWinningTile(null);
    setUserBets({});
    setRoundNumber((prev) => prev + 1);
  };

  const placeBet = (tileIndex: number) => {
    if (phase !== 'BETTING') return;
    if (balance < selectedBet) {
      setBetFeedback(isRTL ? 'الرصيد غير كافٍ!' : 'Insufficient balance!');
      setTimeout(() => setBetFeedback(null), 1800);
      return;
    }

    playSfx('chip');
    updateBalance(-selectedBet);
    setUserBets((prev) => ({
      ...prev,
      [tileIndex]: (prev[tileIndex] || 0) + selectedBet,
    }));
  };

  const placeSaladBet = () => {
    // Bets on all 5 vegetables: Apple, Eggplant, Cabbage, Pumpkin, Watermelon
    const vegTiles = [2, 4, 5, 6, 7];
    const totalRequired = selectedBet * vegTiles.length;
    if (phase !== 'BETTING') return;
    if (balance < totalRequired) {
      setBetFeedback(isRTL ? 'الرصيد غير كافٍ للمجموعة!' : 'Insufficient balance for combo!');
      setTimeout(() => setBetFeedback(null), 1800);
      return;
    }
    playSfx('chip');
    vegTiles.forEach((tileId) => {
      updateBalance(-selectedBet);
      setUserBets((prev) => ({
        ...prev,
        [tileId]: (prev[tileId] || 0) + selectedBet,
      }));
    });
  };

  const placePizzaBet = () => {
    // Bets on all meats/proteins: Fish, Meat, Bread
    const meatTiles = [0, 1, 3];
    const totalRequired = selectedBet * meatTiles.length;
    if (phase !== 'BETTING') return;
    if (balance < totalRequired) {
      setBetFeedback(isRTL ? 'الرصيد غير كافٍ للمجموعة!' : 'Insufficient balance for combo!');
      setTimeout(() => setBetFeedback(null), 1800);
      return;
    }
    playSfx('chip');
    meatTiles.forEach((tileId) => {
      updateBalance(-selectedBet);
      setUserBets((prev) => ({
        ...prev,
        [tileId]: (prev[tileId] || 0) + selectedBet,
      }));
    });
  };

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full bg-gradient-to-b from-[#2eb9a8] via-[#3bcbb9] to-[#25a999] flex flex-col justify-between font-sans relative overflow-x-hidden overflow-y-auto select-none"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Decorative Cartoon Clouds */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
        <svg className="absolute top-12 -left-8 w-36 xs:w-48 h-24 fill-white" viewBox="0 0 100 60">
          <path d="M 20 40 A 15 15 0 0 1 50 25 A 20 20 0 0 1 85 35 A 15 15 0 0 1 80 60 L 20 60 Z" />
        </svg>
        <svg className="absolute top-20 -right-6 w-44 xs:w-56 h-28 fill-white" viewBox="0 0 100 60">
          <path d="M 20 40 A 15 15 0 0 1 50 25 A 20 20 0 0 1 85 35 A 15 15 0 0 1 80 60 L 20 60 Z" />
        </svg>
        <svg className="absolute top-[45%] -left-12 w-48 h-28 fill-white" viewBox="0 0 100 60">
          <path d="M 20 40 A 15 15 0 0 1 50 25 A 20 20 0 0 1 85 35 A 15 15 0 0 1 80 60 L 20 60 Z" />
        </svg>
      </div>

      {/* Floating Bet Toast */}
      {betFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-red-600/90 text-white font-bold text-xs shadow-2xl border border-white/40 animate-fadeIn flex items-center gap-2">
          <span>⚠️</span>
          <span>{betFeedback}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="w-full flex items-center justify-between p-2.5 xs:p-4 z-20 relative max-w-xl mx-auto">
        <button
          id="btn-cake-back"
          onClick={onBack}
          className="w-9 h-9 xs:w-10 xs:h-10 rounded-full bg-[#1b8c82] hover:bg-[#15756d] flex items-center justify-center text-white active:scale-95 transition-all shadow-md cursor-pointer"
          title={isRTL ? 'رجوع' : 'Back'}
        >
          <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
        </button>

        <div className="bg-[#1b8c82]/95 backdrop-blur-sm rounded-full py-1 xs:py-1.5 px-3 xs:px-5 text-white font-black text-xs xs:text-sm shadow-md border border-[#35bcaf] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
          <span>{isRTL ? `جولة اليوم: #${roundNumber}` : `Today Round: #${roundNumber}`}</span>
        </div>

        <div className="flex items-center gap-1.5 xs:gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-9 h-9 xs:w-10 xs:h-10 rounded-full bg-[#1b8c82] hover:bg-[#15756d] flex items-center justify-center text-white active:scale-95 shadow-md cursor-pointer transition-all"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 xs:w-5 xs:h-5 text-rose-300" /> : <Volume2 className="w-4 h-4 xs:w-5 xs:h-5 text-emerald-300" />}
          </button>
          <button
            onClick={() => setShowRules(true)}
            className="w-9 h-9 xs:w-10 xs:h-10 rounded-full bg-[#1b8c82] hover:bg-[#15756d] flex items-center justify-center text-white active:scale-95 shadow-md cursor-pointer transition-all"
            title={isRTL ? 'القواعد' : 'Rules'}
          >
            <HelpCircle className="w-4 h-4 xs:w-5 xs:h-5" />
          </button>
        </div>
      </header>

      {/* MAIN GAME CONTAINER (Responsive flex for both portrait and landscape) */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-1 z-10 w-full max-w-xl mx-auto">
        {/* WHEEL CONTAINER */}
        <div className="relative w-[280px] h-[280px] xs:w-[320px] xs:h-[320px] sm:w-[380px] sm:h-[380px] max-w-[90vw] aspect-square mx-auto shrink-0 z-10 select-none">
          {/* Static Wheel Background & Spokes */}
          <div className="absolute inset-0">
            {/* Wheel Outer Wooden Rim (STATIC) */}
            <div className="absolute inset-1 xs:inset-2 rounded-full border-[8px] xs:border-[10px] sm:border-[12px] border-[#92400e] shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.4)] pointer-events-none" />
            <div className="absolute inset-[2.8rem] xs:inset-[3.4rem] sm:inset-[4.2rem] rounded-full border-[3px] xs:border-[4px] border-[#b45309] pointer-events-none opacity-80" />

            {/* Wooden Spokes (STATIC) */}
            {[0, 45, 90, 135].map((deg) => (
              <div
                key={deg}
                className="absolute top-1/2 left-0 w-full h-1 xs:h-1.5 bg-[#92400e] -translate-y-1/2"
                style={{ transform: `translateY(-50%) rotate(${deg}deg)` }}
              />
            ))}

            {/* ROTATING SELECTOR INDICATOR - Sweeps across all fruits and selects the winner */}
            <div
              className="absolute inset-0 pointer-events-none z-35 flex items-center justify-center transition-transform duration-[5000ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
              style={{ transform: `rotate(${indicatorAngle}deg)` }}
            >
              {/* Pointer Head at top radius (matching Tile 0 at 12 o'clock, radius 41%) */}
              <div className="absolute top-[3%] left-1/2 -translate-x-1/2 flex flex-col items-center">
                {/* Illuminated Target Halo */}
                <div className="w-13 h-13 xs:w-15 xs:h-15 sm:w-17 sm:h-17 rounded-full border-3 xs:border-4 border-yellow-300 bg-yellow-400/25 shadow-[0_0_25px_rgba(250,204,21,0.9),inset_0_0_15px_rgba(250,204,21,0.7)] animate-pulse flex items-center justify-center">
                  <div className="w-2.5 h-2.5 xs:w-3 xs:h-3 rounded-full bg-yellow-200 shadow-[0_0_12px_#fef08a]" />
                </div>
                {/* High-visibility Golden Arrowhead pointing outwards at the fruit */}
                <div className="w-0 h-0 border-l-[9px] xs:border-l-[11px] border-l-transparent border-r-[9px] xs:border-r-[11px] border-r-transparent border-b-[14px] xs:border-b-[18px] border-b-yellow-400 filter drop-shadow-[0_2px_8px_rgba(234,179,8,0.9)] -mt-1 rotate-180" />
              </div>

              {/* Glowing Laser Tracer from Center Hub to Fruit */}
              <div className="absolute top-[16%] bottom-1/2 left-1/2 -translate-x-1/2 w-1 xs:w-1.5 bg-gradient-to-t from-yellow-500/20 via-yellow-400 to-yellow-300 shadow-[0_0_14px_rgba(250,204,21,0.85)]" />
            </div>

            {/* Wheel Tiles (STATIC, upright, completely stationary) */}
            {TILES.map((tile, i) => {
              const angle = (i * 45 - 90) * (Math.PI / 180);
              const radius = 41; // radius percentage
              const top = 50 + radius * Math.sin(angle);
              const left = 50 + radius * Math.cos(angle);
              const hasBet = (userBets[tile.id] || 0) > 0;
              const isWin = winningTile === tile.id && (phase === 'RESULT' || showResult);

              return (
                <div
                  key={tile.id}
                  className="absolute flex items-center justify-center z-30"
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <button
                    onClick={() => placeBet(tile.id)}
                    disabled={phase !== 'BETTING'}
                    className={`w-11 h-11 xs:w-13 xs:h-13 sm:w-15 sm:h-15 bg-white rounded-full border-2 xs:border-3 flex flex-col items-center justify-center text-xl xs:text-2xl sm:text-3xl shadow-lg cursor-pointer transition-all active:scale-90 ${
                      isWin
                        ? 'border-yellow-400 bg-yellow-100 scale-110 ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.9)] animate-bounce'
                        : hasBet
                        ? 'border-emerald-500 bg-emerald-50 scale-105'
                        : 'border-amber-200 hover:scale-105'
                    }`}
                  >
                    <span>{tile.icon}</span>
                  </button>

                  {/* Multiplier Badge */}
                  <div
                    className={`absolute -top-2 px-1 xs:px-1.5 py-0.2 rounded-full text-white text-[8px] xs:text-[9px] sm:text-[10px] font-black shadow-md whitespace-nowrap pointer-events-none ${tile.badgeColor}`}
                  >
                    {tile.badge}
                  </div>

                  {tile.isHot && (
                    <div className="absolute -top-6 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[7px] xs:text-[8px] font-black shadow-md flex items-center gap-0.5 whitespace-nowrap pointer-events-none animate-pulse">
                      🔥 HOT
                    </div>
                  )}

                  {/* Bet Amount Tag */}
                  {hasBet && (
                    <div className="absolute -bottom-4 bg-amber-900 text-yellow-300 font-mono text-[8px] xs:text-[9px] font-black rounded-full px-1.5 py-0.2 shadow border border-yellow-400 whitespace-nowrap pointer-events-none">
                      +{userBets[tile.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Central Timer Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85px] h-[85px] xs:w-[100px] xs:h-[100px] sm:w-[124px] sm:h-[124px] bg-gradient-to-b from-white via-amber-50 to-orange-100 rounded-full border-3 xs:border-4 border-orange-400 z-40 flex flex-col items-center justify-center shadow-2xl">
            <span className="text-[8px] xs:text-[9px] sm:text-[10px] font-black text-orange-600 tracking-wider uppercase">
              {phase === 'BETTING' ? (isRTL ? 'وقت الرهان' : 'SELECT TIME') : phase === 'SPINNING' ? (isRTL ? 'تدوير...' : 'SPINNING') : (isRTL ? 'النتيجة' : 'WINNER')}
            </span>
            <span
              className={`text-2xl xs:text-3xl sm:text-4xl font-black text-orange-600 leading-none my-0.5 font-mono ${
                phase === 'BETTING' && timeLeft <= 3 ? 'text-red-600 animate-ping' : ''
              }`}
            >
              {phase === 'BETTING' ? `${timeLeft}s` : phase === 'SPINNING' ? '🎲' : TILES[winningTile || 0]?.icon}
            </span>
            <div className="flex gap-1 text-[9px] xs:text-[10px]">
              <span>🍉</span>
              <span>🥩</span>
              <span>🥬</span>
            </div>
          </div>
        </div>

        {/* COMBO BUTTONS: SALAD (ALL VEGS) & PIZZA (ALL MEATS) */}
        <div className="flex justify-center gap-2 xs:gap-3 mt-6 xs:mt-8 px-2 z-10 w-full max-w-md mx-auto">
          <button
            onClick={placeSaladBet}
            disabled={phase !== 'BETTING'}
            className="flex-1 bg-white/95 hover:bg-white rounded-2xl py-1.5 xs:py-2 px-2.5 shadow-md flex items-center justify-center gap-2 border-b-4 border-emerald-300 active:border-b-0 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="bg-emerald-100 rounded-full w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center text-base xs:text-lg shrink-0">
              🥗
            </div>
            <div className="flex flex-col text-left rtl:text-right leading-tight">
              <span className="text-emerald-700 font-black text-xs xs:text-sm">{isRTL ? 'سلطة (خضار)' : 'SALAD'}</span>
              <span className="text-emerald-600 font-bold text-[8px] xs:text-[9px]">
                {isRTL ? 'كل الخضار تفوز (5x)' : 'All Vegs Win (5x)'}
              </span>
            </div>
          </button>

          <button
            onClick={placePizzaBet}
            disabled={phase !== 'BETTING'}
            className="flex-1 bg-white/95 hover:bg-white rounded-2xl py-1.5 xs:py-2 px-2.5 shadow-md flex items-center justify-center gap-2 border-b-4 border-orange-300 active:border-b-0 active:translate-y-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="bg-orange-100 rounded-full w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center text-base xs:text-lg shrink-0">
              🍕
            </div>
            <div className="flex flex-col text-left rtl:text-right leading-tight">
              <span className="text-orange-700 font-black text-xs xs:text-sm">{isRTL ? 'بيتزا (لحوم)' : 'PIZZA'}</span>
              <span className="text-orange-600 font-bold text-[8px] xs:text-[9px]">
                {isRTL ? 'كل اللحوم والأسماك (10x-45x)' : 'All Meats & Bread'}
              </span>
            </div>
          </button>
        </div>

        {/* USER VIP CARD & HISTORY BUTTON */}
        <div className="flex justify-center gap-2 xs:gap-3 mt-2.5 px-2 z-10 w-full max-w-md mx-auto">
          {/* User Balance Chip Card */}
          <div className="flex-[3] bg-gradient-to-r from-[#ffe082] to-[#ffd54f] rounded-xl xs:rounded-2xl p-2 flex items-center justify-between border-2 border-yellow-400 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-full bg-yellow-400 border border-yellow-500 flex items-center justify-center text-yellow-800 shadow-inner shrink-0">
                <Trophy className="w-4 h-4 xs:w-4.5 xs:h-4.5" />
              </div>
              <div className="flex flex-col text-left rtl:text-right leading-tight">
                <span className="text-amber-950 font-black text-[10px] xs:text-[11px] truncate max-w-[120px]">
                  {userName || 'VIP Player'} 🔥
                </span>
                <span className="text-amber-900 font-black text-[11px] xs:text-xs tracking-wide flex items-center gap-1">
                  <span>💎</span>
                  <span>{balance.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          {/* History Button */}
          <button
            onClick={() => setShowHistory(true)}
            className="flex-[2] bg-gradient-to-r from-[#ffe082] to-[#ffd54f] hover:brightness-105 rounded-xl xs:rounded-2xl p-2 flex items-center justify-between border-2 border-yellow-400 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-full border border-amber-500/20 flex items-center justify-center text-amber-900 shrink-0">
                <History className="w-4 h-4 xs:w-4.5 xs:h-4.5" />
              </div>
              <span className="text-amber-950 font-black text-[11px] xs:text-[12px]">
                {isRTL ? 'السجل' : 'History'}
              </span>
            </div>
            <ChevronRight className={`w-4 h-4 text-amber-800 shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* RESULTS RIBBON */}
        <div className="flex items-center gap-1.5 xs:gap-2 mt-2 px-2 z-10 w-full max-w-md mx-auto overflow-hidden">
          <span className="text-[#0a524a] font-black text-xs xs:text-sm whitespace-nowrap">
            {isRTL ? 'النتائج:' : 'Results:'}
          </span>
          <div className="flex gap-1.5 bg-[#1b8c82]/40 rounded-full p-1 xs:p-1.5 overflow-x-auto flex-1 no-scrollbar border border-white/20">
            {history.map((h, i) => (
              <div
                key={i}
                className="w-6 h-6 xs:w-7 xs:h-7 rounded-full bg-white flex items-center justify-center shadow shrink-0 text-sm xs:text-base border border-amber-100"
                title={`${TILES[h.winningTile]?.name} (x${h.multiplier})`}
              >
                {TILES[h.winningTile]?.icon}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM BETTING CONTROLS BAR */}
      <div className="bg-[#fef9e7] mt-2 rounded-t-3xl p-3 xs:p-4 shadow-[0_-5px_25px_rgba(0,0,0,0.15)] z-20 relative w-full max-w-md mx-auto border-t-2 border-white">
        <div className="flex justify-between gap-2 xs:gap-2.5">
          {BET_AMOUNTS.map((amt) => {
            const isSelected = selectedBet === amt;
            return (
              <button
                key={amt}
                id={`btn-cake-bet-${amt}`}
                onClick={() => {
                  setSelectedBet(amt);
                  playSfx('chip');
                }}
                className={`flex-1 flex flex-col items-center justify-center rounded-2xl py-2 xs:py-2.5 border-b-4 transition-all active:translate-y-1 active:border-b-0 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-yellow-100 to-yellow-200 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-102'
                    : 'bg-white border-amber-200/80 hover:bg-amber-50'
                }`}
              >
                <div className="text-blue-500 text-sm xs:text-base mb-0.5 drop-shadow-sm">💎</div>
                <span
                  className={`font-mono font-black text-xs xs:text-sm sm:text-base ${
                    isSelected ? 'text-amber-950' : 'text-slate-700'
                  }`}
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </span>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 relative shadow-2xl border border-amber-300">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-black text-base xs:text-lg text-amber-900 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600" />
              <span>{isRTL ? 'سجل جولات الكعكة' : 'Round History'}</span>
            </h3>

            <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {history.map((record, i) => {
                const tile = TILES[record.winningTile];
                return (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{tile?.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-slate-800">
                          {isRTL ? tile?.nameAr : tile?.name}
                        </span>
                        <span className="text-[10px] text-amber-700 font-mono font-bold">
                          {tile?.badge}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span
                        className={`font-mono font-black text-xs ${
                          record.winAmount > 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {record.winAmount > 0 ? `+${record.winAmount.toLocaleString()}` : '0'} 💎
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 relative shadow-2xl border border-amber-300">
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 rtl:right-auto rtl:left-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-black text-base xs:text-lg text-amber-900 mb-3 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              <span>{isRTL ? 'قواعد عجلة الكعكة (Happy Cake)' : 'Happy Cake Game Rules'}</span>
            </h3>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto text-xs text-slate-700">
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">
                  {isRTL ? '1. كيفية اللعب' : '1. How to Play'}
                </span>
                <p>
                  {isRTL
                    ? 'اختر قيمة الجواهر، ثم انقر على العنصر الذي تتوقع أن تقف عنده العجلة قبل انتهاء عداد الوقت (6 ثوانٍ).'
                    : 'Select your gem stake and click the food tile you predict the wheel will stop on before the 6s countdown ends.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="font-bold text-emerald-900 block mb-1">
                  {isRTL ? '2. رهانات الكومبو (Salad & Pizza)' : '2. Combo Bets'}
                </span>
                <p>
                  {isRTL
                    ? 'زر السلطة يراهن على جميع الخضروات الـ 5 دفعة واحدة (مضاعف 5x). زر البيتزا يراهن على الأسماك واللحوم والخبز (مضاعفات من 10x إلى 45x).'
                    : 'Salad bets on all 5 vegetables at once (5x payout). Pizza bets on all meats and bread (10x to 45x payout).'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                <span className="font-bold text-purple-900 block mb-1">
                  {isRTL ? '3. المضاعفات الملكية' : '3. Multipliers'}
                </span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] mt-1">
                  <span>🍞 Bread: 45x</span>
                  <span>🐟 Fish: 25x</span>
                  <span>🍎 Apple: 15x</span>
                  <span>🥩 Meat: 10x</span>
                  <span>🍆 Vegs: 5x</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESULT CELEBRATION MODAL */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-bounceIn text-slate-900 relative border-2 border-yellow-400">
            <h2 className="text-xl font-black text-amber-600 mb-2 text-center flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-yellow-400 animate-spin" />
              <span>{isRTL ? 'العنصر الرابح!' : 'ROUND WINNER!'}</span>
            </h2>

            <div className="w-24 h-24 bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-full border-4 border-yellow-400 shadow-xl flex items-center justify-center text-5xl mb-3 relative z-10 animate-bounce">
              {TILES[winningTile || 0]?.icon}
            </div>

            <div className="text-center font-bold text-sm text-slate-800 mb-2">
              {isRTL ? TILES[winningTile || 0]?.nameAr : TILES[winningTile || 0]?.name}{' '}
              <span className="text-amber-600 font-mono font-black">({TILES[winningTile || 0]?.badge})</span>
            </div>

            <div className="w-full bg-amber-50 rounded-2xl p-3 flex flex-col gap-1 mb-4 border border-amber-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-600">{isRTL ? 'أرباحك' : 'You Won'}</span>
                <span className="font-mono font-black text-base text-emerald-600">
                  +{lastWinAmount.toLocaleString()} 💎
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowResult(false)}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:brightness-110 text-white font-black text-sm rounded-2xl shadow-[0_4px_0_#0f766e] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            >
              {isRTL ? 'متابعة اللعب' : 'AWESOME'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounceIn {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
        .animate-bounceIn { animation: bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
};
