import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Volume2, VolumeX, HelpCircle, Trophy, Wifi, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// --- Configuration ---
const BOARD_ITEMS = [
  { id: 'strawberry', icon: '🍓', multiplier: 5, label: 'مرة 5', gridPos: 0 },
  { id: 'banana', icon: '🍌', multiplier: 5, label: 'مرة 5', gridPos: 1 },
  { id: 'watermelon', icon: '🍉', multiplier: 5, label: 'مرة 5', gridPos: 2 },
  { id: 'cherry', icon: '🍒', multiplier: 40, label: 'مرة 40', gridPos: 3 },
  { id: 'center_timer', isTimer: true, gridPos: 4 },
  { id: 'grapes', icon: '🍇', multiplier: 5, label: 'مرة 5', gridPos: 5 },
  { id: 'orange', icon: '🍊', multiplier: 20, label: 'مرة 20', gridPos: 6 },
  { id: 'plum', icon: '🫐', multiplier: 10, label: 'مرة 10', gridPos: 7 },
  { id: 'lemon', icon: '🍋', multiplier: 10, label: 'مرة 10', gridPos: 8 },
];

const SPIN_PATH = [0, 1, 2, 5, 8, 7, 6, 3];

const CHIPS = [
  { value: 1000, color: 'from-green-500 to-green-700', border: 'border-green-300' },
  { value: 5000, color: 'from-blue-500 to-blue-700', border: 'border-blue-300' },
  { value: 10000, color: 'from-orange-500 to-orange-700', border: 'border-orange-300' },
  { value: 50000, color: 'from-purple-500 to-purple-700', border: 'border-purple-300' },
];

const LEADERBOARD_DATA = [
  { id: 1, name: 'أحمد', score: 5420000 },
  { id: 2, name: 'سارة', score: 4150000 },
  { id: 3, name: 'محمد', score: 3890000 },
  { id: 4, name: 'عمر', score: 2100000 },
  { id: 5, name: 'نورة', score: 1500000 },
  { id: 6, name: 'خالد', score: 950000 },
  { id: 7, name: 'مريم', score: 820000 },
];

export default function JackpotFruits() {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<'betting' | 'spinning' | 'showing_result'>('betting');
  const [timeLeft, setTimeLeft] = useState(15);
  const [activeCombo, setActiveCombo] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [history, setHistory] = useState<string[]>(['🍇', '🍓', '🍌', '🍌', '🍌', '🍉', '🍌']);
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [todayWin, setTodayWin] = useState(0);
  const [selectedChip, setSelectedChip] = useState<number>(1000);
  const [placedBets, setPlacedBets] = useState<Record<number, number>>({});
  const [winNotification, setWinNotification] = useState<{icon: string, amount: number} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [jackpotPool, setJackpotPool] = useState(37120918);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [winRatio, setWinRatio] = useState(30);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserDiamonds(doc.data().diamonds || 0);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'games_config'));
      if (docSnap.exists()) {
        setWinRatio(docSnap.data().jackpotFruitsWinRatio ?? 30);
      }
    };
    fetchConfig();
  }, []);

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
      
      const isWin = Math.random() * 100 < winRatio;
      const betPositions = Object.keys(placedBets).map(Number);
      let targetGridPos = SPIN_PATH[0];

      if (betPositions.length > 0) {
        if (isWin) {
          targetGridPos = betPositions[Math.floor(Math.random() * betPositions.length)];
        } else {
          const nonBetPositions = SPIN_PATH.filter(pos => !betPositions.includes(pos));
          if (nonBetPositions.length > 0) {
            targetGridPos = nonBetPositions[Math.floor(Math.random() * nonBetPositions.length)];
          } else {
            targetGridPos = SPIN_PATH[Math.floor(Math.random() * SPIN_PATH.length)];
          }
        }
      } else {
        targetGridPos = SPIN_PATH[Math.floor(Math.random() * SPIN_PATH.length)];
      }

      const targetPathIndex = SPIN_PATH.indexOf(targetGridPos);
      const targetSpins = (SPIN_PATH.length * 3) + targetPathIndex;

      const spinTick = async () => {
        playTickSound();
        setActiveIndex(SPIN_PATH[currentPathIndex]);
        currentPathIndex = (currentPathIndex + 1) % SPIN_PATH.length;
        spins++;

        if (spins <= targetSpins) {
          if (spins > targetSpins - 10) {
            speed += 40;
          }
          setTimeout(spinTick, speed);
        } else {
          setGameState('showing_result');
          const winningGridPos = SPIN_PATH[(currentPathIndex - 1 + SPIN_PATH.length) % SPIN_PATH.length];
          const winningItem = BOARD_ITEMS.find(item => item.gridPos === winningGridPos);
          
          if (winningItem && !winningItem.isTimer) {
            const possibleCombos = ['x2', '+3', '+1', null, null];
            const hitCombo = possibleCombos[Math.floor(Math.random() * possibleCombos.length)];
            setActiveCombo(hitCombo);

            setHistory(prev => {
              const newHist = [winningItem.icon, ...prev];
              if (newHist.length > 8) newHist.pop();
              return newHist;
            });

            const betOnWinner = placedBets[winningGridPos] || 0;
            if (betOnWinner > 0 && user) {
              let winAmount = betOnWinner * winningItem.multiplier;
              if (hitCombo === 'x2') winAmount *= 2;
              else if (hitCombo === '+3') winAmount += betOnWinner * 3;
              else if (hitCombo === '+1') winAmount += betOnWinner * 1;

              const userRef = doc(db, 'users', user.uid);
              const latestUserDoc = await getDoc(userRef);
              const currentDiamonds = latestUserDoc.data()?.diamonds || 0;
              await updateDoc(userRef, { diamonds: currentDiamonds + winAmount });

              setTodayWin(prev => prev + winAmount);
              setJackpotPool(prev => Math.max(0, prev - winAmount));
              setWinNotification({ icon: winningItem.icon, amount: winAmount });
              playWinSound();
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
      }, 2000);

      const timer = setTimeout(() => {
        setGameState('betting');
        setTimeLeft(15);
        setActiveIndex(-1);
        setActiveCombo(null);
        setPlacedBets({});
      }, 4000);
      
      return () => {
        clearTimeout(notifTimer);
        clearTimeout(timer);
      };
    }
  }, [gameState]);

  const handlePlaceBet = async (gridPos: number) => {
    if (gameState !== 'betting' || !user) return;
    
    if (userDiamonds < selectedChip) {
      setErrorMsg("رصيدك لا يكفي للرهان!");
      setTimeout(() => setErrorMsg(null), 2000);
      return;
    }

    playBetSound();
    
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { diamonds: userDiamonds - selectedChip });

    setJackpotPool(prev => prev + selectedChip);
    setPlacedBets(prev => ({
      ...prev,
      [gridPos]: (prev[gridPos] || 0) + selectedChip
    }));
  };

  const renderGridItem = (item: typeof BOARD_ITEMS[0]) => {
    if (item.isTimer) {
      return (
        <div key={item.id} className="flex items-center justify-center bg-purple-950 rounded-xl border-2 border-purple-800 shadow-inner">
          <div className="text-5xl font-mono font-bold text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
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
        <div className="text-5xl drop-shadow-lg mb-1">{item.icon}</div>
        <div className="text-pink-200 text-sm font-bold tracking-wider">{item.label}</div>
        
        {betAmount > 0 && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-white shadow-lg z-20">
            {(betAmount / 1000)}K
          </div>
        )}

        {isActive && gameState === 'showing_result' && (
          <div className="absolute -bottom-4 right-0 text-4xl animate-bounce z-30 drop-shadow-xl">
            👇
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-[#2a0a4a] text-white font-sans overflow-y-auto flex justify-center custom-scrollbar" dir="rtl">
      <div className="w-full max-w-2xl bg-gradient-to-b from-[#3a1060] via-[#2a0a4a] to-[#1a0530] relative shadow-2xl flex flex-col min-h-full">
        
        <AnimatePresence>
          {winNotification && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm"
            >
              <div className="bg-gradient-to-b from-yellow-500 to-yellow-700 border-4 border-yellow-300 rounded-3xl p-8 flex flex-col items-center shadow-[0_0_50px_rgba(250,204,21,0.8)]">
                <span className="text-8xl drop-shadow-2xl mb-4 animate-bounce">{winNotification.icon}</span>
                <span className="text-white font-black text-5xl drop-shadow-lg" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.5)' }}>
                  +{winNotification.amount.toLocaleString()}
                </span>
                <span className="text-yellow-100 font-bold text-2xl mt-2 drop-shadow-md">مبروك الفوز!</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  {LEADERBOARD_DATA.map((player, index) => (
                    <div key={player.id} className="flex items-center justify-between bg-purple-900/50 p-3 rounded-xl border border-purple-500/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-inner ${
                          index === 0 ? 'bg-yellow-400 text-black border-2 border-yellow-200' : 
                          index === 1 ? 'bg-gray-300 text-black border-2 border-gray-100' : 
                          index === 2 ? 'bg-amber-600 text-white border-2 border-amber-400' : 
                          'bg-purple-800 text-white border border-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-bold text-lg">{player.name}</span>
                      </div>
                      <div className="text-yellow-400 font-bold bg-black/30 px-3 py-1 rounded-full text-sm">
                        {player.score.toLocaleString()} 🪙
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-start p-3 z-10">
          <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex flex-col items-center cursor-pointer group" onClick={() => setShowLeaderboard(true)}>
              <Trophy className="w-8 h-8 text-yellow-400 drop-shadow-md group-hover:scale-110 transition-transform" />
              <span className="text-red-500 font-bold text-sm bg-black/40 px-2 rounded-full mt-1">03:27</span>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-16 text-indigo-200 text-sm font-bold">
          دائري: 2247
        </div>

        <div className="flex flex-col items-center -mt-8 z-10">
          <h1 className="text-6xl font-black italic tracking-tighter mb-2" 
              style={{
                background: 'linear-gradient(to bottom, #ffeb3b, #ff9800, #f44336)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0px 4px 2px rgba(0,0,0,0.8)) drop-shadow(0px 0px 10px rgba(255,0,0,0.5))',
                WebkitTextStroke: '1px #b71c1c'
              }}>
            JACKPOT
          </h1>

          <div className="relative">
            <div className="absolute -inset-4 bg-red-600 rounded-full blur-md opacity-50 -z-10"></div>
            <div className="bg-purple-900 border-4 border-yellow-400 rounded-xl px-6 py-1 shadow-[0_0_15px_rgba(250,204,21,0.5)]">
              <span className="text-3xl font-bold text-white tracking-widest drop-shadow-md">
                {jackpotPool.toLocaleString()}
              </span>
            </div>
          </div>

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

        <div className="mx-4 mt-6 relative">
          <div className="absolute -inset-2 bg-yellow-400 rounded-2xl opacity-20 blur-sm animate-pulse"></div>
          
          <div className="bg-[#e53935] p-2 rounded-2xl border-4 border-yellow-400 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative z-10">
            <div className="bg-[#b71c1c] p-2 rounded-xl border-2 border-[#c62828] shadow-inner">
              <div className="grid grid-cols-3 gap-2">
                {BOARD_ITEMS.map(renderGridItem)}
              </div>
            </div>

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

        <div className="flex-grow"></div>

        <div className="bg-gradient-to-t from-purple-900 to-transparent pt-4 pb-6 px-4 z-10">
          <div className="flex justify-between items-end mb-6 px-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setSelectedChip(chip.value)}
                className={`relative rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center font-bold text-white shadow-xl transition-transform text-xs sm:text-base
                  bg-gradient-to-br ${chip.color} border-4 ${chip.border}
                  ${selectedChip === chip.value ? '-translate-y-4 scale-110 shadow-[0_10px_20px_rgba(0,0,0,0.5)]' : 'hover:-translate-y-1'}
                `}
              >
                <div className="absolute inset-1 border-2 border-dashed border-white/30 rounded-full pointer-events-none"></div>
                {chip.value >= 1000 ? `${chip.value/1000}K` : chip.value}
              </button>
            ))}
          </div>

          <div className="flex justify-between gap-2">
            <div className="flex-1 bg-indigo-900/80 rounded-full border border-indigo-400 p-1 flex items-center justify-between">
              <div className="bg-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold">
                💎
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-indigo-200">رصيدي</span>
                <span className="font-bold text-sm">{userDiamonds.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex-1 bg-indigo-900/80 rounded-full border border-indigo-400 p-1 flex items-center justify-between">
              <div className="bg-yellow-500 rounded-full w-6 h-6 flex items-center justify-center text-black text-xs font-bold">
                🏆
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-indigo-200">انتصار اليوم</span>
                <span className="font-bold text-sm">{todayWin.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
