import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Volume2, VolumeX, HelpCircle, Trophy, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Configuration ---
const BOARD_ITEMS = [
  { id: 'strawberry', icon: '🍓', multiplier: 5, label: 'مرة 5', gridPos: 0 },
  { id: 'banana', icon: '🍌', multiplier: 5, label: 'مرة 5', gridPos: 1 },
  { id: 'watermelon', icon: '🍉', multiplier: 5, label: 'مرة 5', gridPos: 2 },
  { id: 'cherry', icon: '🍒', multiplier: 40, label: 'مرة 40', gridPos: 3 },
  { id: 'center_timer', isTimer: true, gridPos: 4 },
  { id: 'grapes', icon: '🍇', multiplier: 5, label: 'مرة 5', gridPos: 5 },
  { id: 'orange', icon: '🍊', multiplier: 20, label: 'مرة 20', gridPos: 6 },
  { id: 'plum', icon: '🫐', multiplier: 10, label: 'مرة 10', gridPos: 7 }, // Using blueberry as plum approximation
  { id: 'lemon', icon: '🍋', multiplier: 10, label: 'مرة 10', gridPos: 8 },
];

// The path the light takes around the edge (clockwise starting top-left)
const SPIN_PATH = [0, 1, 2, 5, 8, 7, 6, 3];

const CHIPS = [
  { value: 1000, color: 'from-green-500 to-green-700', border: 'border-green-300' },
  { value: 5000, color: 'from-blue-500 to-blue-700', border: 'border-blue-300' },
  { value: 10000, color: 'from-orange-500 to-orange-700', border: 'border-orange-300' },
  { value: 50000, color: 'from-purple-500 to-purple-700', border: 'border-purple-300' },
];

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<'betting' | 'spinning' | 'showing_result'>('betting');
  const [timeLeft, setTimeLeft] = useState(15);
  const [activeCombo, setActiveCombo] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1); // Index in BOARD_ITEMS
  const [history, setHistory] = useState<string[]>(['🍇', '🍓', '🍌', '🍌', '🍌', '🍉', '🍌']);
  const [balance, setBalance] = useState(1000000);
  const [todayWin, setTodayWin] = useState(0);
  const [selectedChip, setSelectedChip] = useState<number>(1000);
  const [placedBets, setPlacedBets] = useState<Record<number, number>>({}); // gridPos -> amount
  const [winNotification, setWinNotification] = useState<{icon: string, amount: number, bet: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [jackpotPool, setJackpotPool] = useState(37120918);
  
  // Data fetched from Server
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [recentWinners, setRecentWinners] = useState<any[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Fetch initial data from server
    fetch('/api/leaderboard').then(res => res.json()).then(setLeaderboardData).catch(console.error);
    fetch('/api/recent-winners').then(res => res.json()).then(setRecentWinners).catch(console.error);
  }, []);

  // --- Audio Helpers ---
  const playSound = (frequency: number, type: OscillatorType, duration: number, vol: number) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const playBetSound = () => playSound(800, 'sine', 0.1, 0.1);
  const playTickSound = () => playSound(400, 'square', 0.05, 0.02);
  const playWinSound = () => {
    playSound(400, 'sine', 0.1, 0.1);
    setTimeout(() => playSound(600, 'sine', 0.2, 0.1), 100);
    setTimeout(() => playSound(800, 'sine', 0.3, 0.1), 200);
  };
  const playLoseSound = () => {
    playSound(300, 'sawtooth', 0.3, 0.1);
    setTimeout(() => playSound(200, 'sawtooth', 0.4, 0.1), 200);
  };

  // --- Game Loop Logic ---
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'betting') {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('spinning');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'spinning') {
      let currentPathIndex = 0;
      let speed = 50;
      let spins = 0;
      // Randomize where it stops (minimum 3 full circles + random extra)
      const targetSpins = (SPIN_PATH.length * 3) + Math.floor(Math.random() * SPIN_PATH.length);

      const spinTick = () => {
        playTickSound();
        setActiveIndex(SPIN_PATH[currentPathIndex]);
        currentPathIndex = (currentPathIndex + 1) % SPIN_PATH.length;
        spins++;

        if (spins < targetSpins) {
          // Decelerate in the last 10 steps
          if (spins > targetSpins - 10) {
            speed += 40;
          }
          setTimeout(spinTick, speed);
        } else {
          // Spin finished
          setGameState('showing_result');
          const winningGridPos = SPIN_PATH[(currentPathIndex - 1 + SPIN_PATH.length) % SPIN_PATH.length];
          const winningItem = BOARD_ITEMS.find(item => item.gridPos === winningGridPos);
          
          if (winningItem && !winningItem.isTimer) {
            // Determine Combo
            const possibleCombos = ['x2', '+3', '+1', null, null]; // 3/5 chance for a combo
            const hitCombo = possibleCombos[Math.floor(Math.random() * possibleCombos.length)];
            setActiveCombo(hitCombo);

            // Update history
            setHistory(prev => {
              const newHist = [winningItem.icon, ...prev];
              if (newHist.length > 8) newHist.pop();
              return newHist;
            });

            // Calculate winnings
            const betOnWinner = placedBets[winningGridPos] || 0;
            if (betOnWinner > 0) {
              let winAmount = betOnWinner * winningItem.multiplier;
              if (hitCombo === 'x2') winAmount *= 2;
              else if (hitCombo === '+3') winAmount += betOnWinner * 3;
              else if (hitCombo === '+1') winAmount += betOnWinner * 1;

              setBalance(prev => prev + winAmount);
              setTodayWin(prev => prev + winAmount);
              setJackpotPool(prev => Math.max(0, prev - winAmount));
              setWinNotification({ icon: winningItem.icon, amount: winAmount, bet: betOnWinner });
              playWinSound();

              // Record game to server
              fetch('/api/record-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: 'Prestige', betAmount: betOnWinner, winAmount: winAmount })
              }).catch(console.error);
            } else {
              if (Object.keys(placedBets).length > 0) {
                playLoseSound();
              }
            }
          }
        }
      };

      setTimeout(spinTick, speed);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'showing_result') {
      const notifTimer = setTimeout(() => {
        setWinNotification(null);
      }, 5000); // Hide notification after 5 seconds for the complex modal

      const timer = setTimeout(() => {
        setGameState('betting');
        setTimeLeft(15);
        setActiveIndex(-1);
        setActiveCombo(null);
        setPlacedBets({}); // Clear bets for next round
      }, 7000); // Show result for 7 seconds to accommodate the beautiful popup
      
      return () => {
        clearTimeout(notifTimer);
        clearTimeout(timer);
      };
    }
  }, [gameState]);

  // --- Handlers ---
  const handlePlaceBet = (gridPos: number) => {
    if (gameState !== 'betting') return;
    
    if (balance < selectedChip) {
      setErrorMsg("رصيدك لا يكفي للرهان!");
      setTimeout(() => setErrorMsg(null), 2000);
      return;
    }

    playBetSound();
    setBalance(prev => prev - selectedChip);
    setJackpotPool(prev => prev + selectedChip);
    setPlacedBets(prev => ({
      ...prev,
      [gridPos]: (prev[gridPos] || 0) + selectedChip
    }));
  };

  // --- Render Helpers ---
  const renderGridItem = (item: typeof BOARD_ITEMS[0]) => {
    if (item.isTimer) {
      return (
        <div key={item.id} className="flex items-center justify-center bg-purple-950 rounded-xl border-2 border-purple-800 shadow-inner">
          <div className="text-4xl sm:text-5xl font-mono font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
            {gameState === 'betting' ? timeLeft.toString().padStart(2, '0') : '--'}
          </div>
        </div>
      );
    }

    const isActive = activeIndex === item.gridPos;
    const betAmount = placedBets[item.gridPos] || 0;

    return (
      <div 
        key={item.id} 
        onClick={() => handlePlaceBet(item.gridPos)}
        className={`relative flex flex-col items-center justify-center rounded-xl transition-all duration-100 cursor-pointer
          ${isActive 
            ? 'bg-blue-600/40 border-4 border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.9)] z-10 scale-105' 
            : 'bg-[#5a1818] border-2 border-[#8a2828] hover:bg-[#6a1c1c]'
          }
        `}
        style={{ aspectRatio: '1/1' }}
      >
        <div className="text-4xl sm:text-5xl drop-shadow-lg mb-1">{item.icon}</div>
        <div className="text-pink-200 text-xs sm:text-sm font-bold tracking-wider">{item.label}</div>
        
        {/* Bet Indicator */}
        {betAmount > 0 && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-white shadow-lg z-20">
            {(betAmount / 1000)}K
          </div>
        )}

        {/* Hand Cursor Simulation for active item (like in screenshot) */}
        {isActive && gameState === 'showing_result' && (
          <div className="absolute -bottom-4 right-0 text-4xl animate-bounce z-30 drop-shadow-xl">
            👇
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#2a0a4a] text-white font-sans overflow-y-auto flex justify-center custom-scrollbar" dir="rtl">
      {/* Main Game Container - Constrained width for mobile feel */}
      <div className="w-full max-w-md bg-gradient-to-b from-[#3a1060] via-[#2a0a4a] to-[#1a0530] relative shadow-2xl flex flex-col min-h-[100dvh]">
        
        {/* Win Notification Overlay */}
        <AnimatePresence>
          {winNotification && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            >
              <div className="bg-[#1c013b] border-4 border-[#fbbf24] rounded-2xl w-[95%] max-w-sm mx-auto overflow-hidden relative shadow-[0_0_50px_rgba(251,191,36,0.3)]">
                
                {/* Title */}
                <h2 className="text-center font-bold text-[#fbbf24] text-4xl mt-6 drop-shadow-md pb-0">حظ سعيد</h2>
                <p className="text-center text-white text-lg mt-1 mb-8">مبروك للفائزين التالية</p>

                {/* 3 Winners Grid */}
                <div className="flex justify-center items-end gap-2 px-2 mb-6">
                  {recentWinners.map((winner) => {
                    const isCenter = winner.rank === 1;
                    return (
                      <div key={winner.rank} className={`flex flex-col items-center ${isCenter ? 'w-1/3 -mt-6' : 'w-1/3'}`}>
                        <div className="relative">
                          <span className={`absolute ${isCenter ? '-top-10' : '-top-7'} left-1/2 -translate-x-1/2 ${isCenter ? 'text-5xl' : 'text-3xl'}`}>👑</span>
                          <span className={`absolute ${isCenter ? '-top-6' : '-top-4'} left-1/2 -translate-x-1/2 text-white font-bold z-10 text-sm`}>{winner.rank}</span>
                          <img 
                            className={`${isCenter ? 'w-24 h-24 border-4 border-[#fbbf24]' : 'w-16 h-16 border-2'} ${winner.rank === 2 ? 'border-gray-200' : 'border-orange-400'} rounded-full object-cover`} 
                            src={winner.avatar} 
                            alt={winner.name} 
                          />
                        </div>
                        
                        <div className={`${isCenter ? 'bg-[#fbbf24] text-black shadow-lg text-sm w-[110%]' : winner.rank === 2 ? 'bg-gray-200 text-gray-900 text-xs w-full' : 'bg-orange-400 text-white text-xs w-full'} font-bold px-1 py-1 -mt-3 relative z-10 rounded text-center truncate`}>
                          {winner.name}
                        </div>
                        
                        <div className="text-white text-[11px] sm:text-xs mt-2 w-full flex justify-between px-1 font-bold">
                          <span>رهان</span> 
                          <span>{winner.bet.toLocaleString()}</span>
                        </div>
                        <div className="text-[#fbbf24] text-[11px] sm:text-xs w-full flex justify-between px-1 mt-1 font-bold">
                          <span>يفوز</span> 
                          <span>{(winner.win >= 100000 ? (winner.win/1000).toFixed(1)+'K' : winner.win.toLocaleString())}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Current User Row */}
                <div className="bg-[#2c0957] mx-2 mb-2 p-2 rounded-xl flex items-center justify-between border border-[#441188]">
                  <div className="flex items-center gap-2">
                    <img className="w-10 h-10 rounded-full border border-gray-500" src="https://api.dicebear.com/7.x/avataaars/svg?seed=You&backgroundColor=black" alt="You" />
                    <span className="text-white font-bold text-sm">أنت (Prestige)</span>
                  </div>
                  <div className="flex flex-col gap-1 w-32 border-l border-gray-700 pl-2">
                    <div className="flex justify-between bg-[#190433] px-2 py-0.5 rounded text-xs text-white">
                      <span>رهان</span> 
                      <span>{winNotification.bet.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-[#190433] px-2 py-0.5 rounded text-xs text-[#fbbf24]">
                      <span>يفوز</span> 
                      <span>{winNotification.amount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Floating Big Win Icon Overlay in background (subtle) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none">
                  <span className="text-9xl">{winNotification.icon}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message Overlay */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-lg border-2 border-red-400 whitespace-nowrap"
            >
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaderboard Overlay */}
        <AnimatePresence>
          {showLeaderboard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                className="bg-gradient-to-b from-[#3a1060] to-[#1a0530] border-2 border-yellow-400 rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_30px_rgba(250,204,21,0.3)] flex flex-col max-h-[80vh]"
              >
                <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 p-4 text-center relative shrink-0">
                  <h2 className="text-2xl font-black text-purple-950 drop-shadow-sm">🏆 قائمة المتصدرين</h2>
                  <button 
                    onClick={() => setShowLeaderboard(false)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-900 rounded-full flex items-center justify-center text-white font-bold border-2 border-purple-950 hover:bg-red-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                  {leaderboardData.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between bg-purple-900/50 p-2 sm:p-3 rounded-xl border border-purple-500/30">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold shadow-inner text-xs sm:text-base ${
                          index === 0 ? 'bg-yellow-400 text-black border-2 border-yellow-200' : 
                          index === 1 ? 'bg-gray-300 text-black border-2 border-gray-100' : 
                          index === 2 ? 'bg-amber-600 text-white border-2 border-amber-400' : 
                          'bg-purple-800 text-white border border-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                        <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full bg-black/30 border border-white/20 hidden sm:block" />
                        <span className="font-bold text-base sm:text-lg">{player.name}</span>
                      </div>
                      <div className="text-yellow-400 font-bold bg-black/30 px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm whitespace-nowrap">
                        {player.score.toLocaleString()} 🪙
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Top Bar --- */}
        <div className="flex justify-between items-start p-3 z-10">
          <div className="flex flex-col gap-2">
            <button className="w-10 h-10 bg-indigo-600/80 rounded-full flex items-center justify-center border-2 border-indigo-400 shadow-lg">
              <ArrowRight className="w-6 h-6 text-white" />
            </button>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 bg-indigo-600/80 rounded-full flex items-center justify-center border-2 border-indigo-400 shadow-lg"
            >
              {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-green-400 text-sm font-bold bg-black/30 px-2 py-1 rounded-full">
                <Wifi className="w-4 h-4" /> 467ms
              </div>
              <button className="w-10 h-10 bg-indigo-600/80 rounded-full flex items-center justify-center border-2 border-indigo-400 shadow-lg">
                <HelpCircle className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="flex flex-col items-center cursor-pointer group" onClick={() => setShowLeaderboard(true)}>
              <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-md group-hover:scale-110 transition-transform" />
              <span className="text-red-500 font-bold text-sm bg-black/40 px-2 rounded-full mt-1">03:27</span>
            </div>
          </div>
        </div>

        {/* Absolute positioned "دائري: 2247" */}
        <div className="absolute top-4 right-16 text-indigo-200 text-sm font-bold">
          دائري: 2247
        </div>

        {/* --- Header Section --- */}
        <div className="flex flex-col items-center -mt-4 sm:-mt-8 z-10">
          {/* Jackpot Logo */}
          <h1 className="text-5xl sm:text-6xl font-black italic tracking-tighter mb-2" 
              style={{
                background: 'linear-gradient(to bottom, #ffeb3b, #ff9800, #f44336)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0px 4px 2px rgba(0,0,0,0.8)) drop-shadow(0px 0px 10px rgba(255,0,0,0.5))',
                WebkitTextStroke: '1px #b71c1c'
              }}>
            JACKPOT
          </h1>

          {/* Big Number Display */}
          <div className="relative">
            {/* Red Ribbon Background effect */}
            <div className="absolute -inset-4 bg-red-600 rounded-full blur-md opacity-50 -z-10"></div>
            <div className="bg-purple-900 border-4 border-yellow-400 rounded-xl px-4 sm:px-6 py-1 shadow-[0_0_15px_rgba(250,204,21,0.5)]">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-widest drop-shadow-md">
                {jackpotPool.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Bonus Slots */}
          <div className="flex gap-2 mt-3 bg-yellow-400/20 p-1.5 rounded-lg border border-yellow-500/50">
            {['x2', '+3', '+1'].map((bonus, i) => {
              const isActive = activeCombo === bonus;
              return (
                <div key={i} className={`rounded font-bold px-3 py-1 shadow-inner border-b-2 transition-all duration-300 ${
                  isActive 
                    ? 'bg-green-500 text-white border-green-700 scale-110 shadow-[0_0_15px_rgba(34,197,94,0.8)]' 
                    : 'bg-white text-purple-900 border-gray-300'
                }`}>
                  {bonus}
                </div>
              );
            })}
          </div>
        </div>

        {/* --- Main Game Board --- */}
        <div className="mx-2 sm:mx-4 mt-4 sm:mt-6 relative">
          {/* Marquee Lights Border Effect */}
          <div className="absolute -inset-2 bg-yellow-400 rounded-2xl opacity-20 blur-sm animate-pulse"></div>
          
          <div className="bg-[#e53935] p-2 rounded-2xl border-4 border-yellow-400 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative z-10">
            {/* Inner Dark Red Area */}
            <div className="bg-[#b71c1c] p-2 rounded-xl border-2 border-[#c62828] shadow-inner">
              
              {/* 3x3 Grid */}
              <div className="grid grid-cols-3 gap-2">
                {BOARD_ITEMS.map(renderGridItem)}
              </div>

            </div>

            {/* History Bar */}
            <div className="mt-3 bg-[#8e0000] rounded-full flex items-center px-3 py-1.5 border border-[#ff5252]">
              <span className="text-yellow-400 font-bold text-sm ml-2 whitespace-nowrap">نتائج</span>
              <div className="flex gap-1 overflow-hidden">
                {history.map((fruit, i) => (
                  <div key={i} className="relative">
                    <span className="text-lg">{fruit}</span>
                    {i === 0 && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] bg-yellow-400 text-black px-1 rounded-full font-bold">NEW</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Spacer to push controls to bottom */}
        <div className="flex-grow"></div>

        {/* --- Bottom Controls --- */}
        <div className="bg-gradient-to-t from-purple-900 to-transparent pt-2 pb-4 sm:pt-4 sm:pb-6 px-2 sm:px-4 z-10">
          
          {/* Chips */}
          <div className="flex justify-between items-end mb-4 sm:mb-6 px-1 sm:px-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setSelectedChip(chip.value)}
                className={`relative rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center font-bold text-white shadow-xl transition-transform text-xs sm:text-base
                  bg-gradient-to-br ${chip.color} border-4 ${chip.border}
                  ${selectedChip === chip.value ? '-translate-y-4 scale-110 shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : 'hover:-translate-y-1'}
                `}
              >
                {/* Inner dashed ring to look like a casino chip */}
                <div className="absolute inset-1 border-2 border-dashed border-white/30 rounded-full pointer-events-none"></div>
                {chip.value}
              </button>
            ))}
          </div>

          {/* Bottom Stats Bar */}
          <div className="flex justify-between gap-2">
            {/* My Balance */}
            <div className="flex-1 bg-indigo-900/80 rounded-full border border-indigo-400 p-1 flex items-center justify-between">
              <div className="bg-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold">
                A
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-indigo-200">ملكي</span>
                <span className="font-bold text-sm">{balance}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-300" />
            </div>

            {/* Today's Win */}
            <div className="flex-1 bg-indigo-900/80 rounded-full border border-indigo-400 p-1 flex items-center justify-between">
              <div className="bg-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold">
                A
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-indigo-200">انتصار اليوم</span>
                <span className="font-bold text-sm">{todayWin}</span>
              </div>
            </div>

            {/* Auto Button */}
            <button className="bg-gradient-to-b from-purple-400 to-purple-600 rounded-full border-2 border-purple-300 px-6 py-2 shadow-lg hover:brightness-110 transition-all">
              <span className="font-bold text-white drop-shadow-md">تلقائي</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
