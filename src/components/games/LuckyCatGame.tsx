import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Crown, Trophy, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ITEMS = [
  { id: 'chicken', icon: '🐔', name: 'دجاجة', multiplier: 45, color: 'bg-orange-500' },
  { id: 'tomato', icon: '🍅', name: 'طماطم', multiplier: 5, color: 'bg-red-500' },
  { id: 'sheep', icon: '🐑', name: 'خروف', multiplier: 15, color: 'bg-gray-400' },
  { id: 'pepper', icon: '🫑', name: 'فلفل', multiplier: 5, color: 'bg-green-500' },
  { id: 'fish', icon: '🐟', name: 'سمكة', multiplier: 25, color: 'bg-blue-500' },
  { id: 'carrot', icon: '🥕', name: 'جزر', multiplier: 5, color: 'bg-orange-400' },
  { id: 'shrimp', icon: '🦐', name: 'جمبري', multiplier: 10, color: 'bg-rose-400' },
  { id: 'corn', icon: '🌽', name: 'ذرة', multiplier: 5, color: 'bg-yellow-500' },
];

const BET_AMOUNTS = [500, 5000, 50000, 100000, 500000];

const CYCLE_DURATION = 30000; // 30 seconds total
const BETTING_DURATION = 16000; // 16 seconds betting
const SPINNING_DURATION = 9000; // 9 seconds spinning
const RESULT_DURATION = 5000; // 5 seconds result

export default function LuckyCatGame() {
  const { user } = useAuth();
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [selectedBetAmount, setSelectedBetAmount] = useState(500);
  
  const [gameState, setGameState] = useState<'betting' | 'spinning' | 'result'>('betting');
  const [timeLeft, setTimeLeft] = useState(0);
  const [resultItem, setResultItem] = useState<any>(null);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const [jackpot, setJackpot] = useState(6854652);
  const [roundNumber, setRoundNumber] = useState(326469);

  const betsRef = useRef(bets);
  useEffect(() => { betsRef.current = bets; }, [bets]);

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserDiamonds(doc.data().diamonds || 0);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    // Generate initial fake history
    const initialHistory = Array(10).fill(0).map(() => ITEMS[Math.floor(Math.random() * ITEMS.length)]);
    setHistory(initialHistory);
  }, []);

  useEffect(() => {
    let animationFrame: number;

    const updateGameLoop = async () => {
      const now = Date.now();
      const cycleStart = Math.floor(now / CYCLE_DURATION) * CYCLE_DURATION;
      const elapsed = now - cycleStart;

      if (elapsed < BETTING_DURATION) {
        if (gameState !== 'betting') {
          setGameState('betting');
          setResultItem(null);
          setWinAmount(0);
          setBets({}); // Clear bets for new round
          setRoundNumber(prev => prev + 1);
        }
        setTimeLeft(Math.ceil((BETTING_DURATION - elapsed) / 1000));
      } else if (elapsed < BETTING_DURATION + SPINNING_DURATION) {
        if (gameState === 'betting') {
          setGameState('spinning');
          setTimeLeft(0);
          await processSpinResult(cycleStart);
        }
      } else {
        if (gameState === 'spinning') {
          setGameState('result');
          // Add to history if not already added for this cycle
          setHistory(prev => {
            if (resultItem && prev[0]?.id !== resultItem.id) {
              return [resultItem, ...prev].slice(0, 10);
            }
            return prev;
          });
        }
      }

      animationFrame = requestAnimationFrame(updateGameLoop);
    };

    animationFrame = requestAnimationFrame(updateGameLoop);
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, resultItem]);

  const processSpinResult = async (cycleStart: number) => {
    let winningItem;
    const currentBets = betsRef.current as Record<string, number>;
    const totalBet = Object.values(currentBets || {}).reduce((a, b) => a + b, 0);

    if (totalBet > 0 && user) {
      // Fetch win ratio
      const settingsDoc = await getDoc(doc(db, 'settings', 'games_config'));
      const winRatio = settingsDoc.data()?.luckyCatWinRatio ?? 30;

      const isWin = Math.random() * 100 < winRatio;
      
      const betItems = Object.keys(currentBets);
      const nonBetItems = ITEMS.filter(i => !betItems.includes(i.id));

      if (isWin && betItems.length > 0) {
        // Pick a random bet item
        const winningId = betItems[Math.floor(Math.random() * betItems.length)];
        winningItem = ITEMS.find(i => i.id === winningId)!;
      } else {
        // Pick a random non-bet item, or any if all were bet on
        if (nonBetItems.length > 0) {
          winningItem = nonBetItems[Math.floor(Math.random() * nonBetItems.length)];
        } else {
          winningItem = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        }
      }

      // Calculate winnings
      if (currentBets[winningItem.id]) {
        const won = currentBets[winningItem.id] * winningItem.multiplier;
        setWinAmount(won);
        const userRef = doc(db, 'users', user.uid);
        const latestUserDoc = await getDoc(userRef);
        const currentDiamonds = latestUserDoc.data()?.diamonds || 0;
        await updateDoc(userRef, { diamonds: currentDiamonds + won });
      }
    } else {
      // Deterministic random if no bets
      const seed = cycleStart;
      const random = ((seed * 9301 + 49297) % 233280) / 233280;
      winningItem = ITEMS[Math.floor(random * ITEMS.length)];
    }

    setResultItem(winningItem);

    // Calculate rotation
    const itemIndex = ITEMS.indexOf(winningItem);
    const segmentAngle = 360 / ITEMS.length;
    // Add 5 full rotations + the angle to the winning item
    // The wheel items are arranged in a circle. Let's assume index 0 is at top (0 deg).
    const targetRotation = rotation + (360 * 5) - (itemIndex * segmentAngle);
    setRotation(targetRotation);
  };

  const handlePlaceBet = async (itemId: string) => {
    if (gameState !== 'betting' || !user) return;
    if (userDiamonds < selectedBetAmount) {
      alert('رصيد الألماس غير كافٍ');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { diamonds: userDiamonds - selectedBetAmount });

    setBets(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + selectedBetAmount
    }));
    setJackpot(prev => prev + Math.floor(selectedBetAmount * 0.1));
  };

  // Wheel arrangement
  const getWheelItemStyle = (index: number) => {
    const angle = (index * 360) / ITEMS.length;
    const radius = 120; // Distance from center
    const x = Math.sin((angle * Math.PI) / 180) * radius;
    const y = -Math.cos((angle * Math.PI) / 180) * radius;
    return {
      transform: `translate(${x}px, ${y}px)`,
    };
  };

  return (
    <div className="flex flex-col h-full bg-[#1a0b2e] text-white relative overflow-y-auto custom-scrollbar font-sans" dir="rtl">
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/50 to-[#1a0b2e]"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-4">
        <div className="flex items-center gap-2 bg-black/40 rounded-full px-3 py-1 border border-white/10">
          <span className="text-yellow-400 font-bold">{userDiamonds.toLocaleString()}</span>
          <span>💎</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 drop-shadow-md">
            القط المحظوظ
          </h1>
          <p className="text-xs text-purple-300">الجولة: {roundNumber}</p>
        </div>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      {/* Jackpot */}
      <div className="relative z-10 flex justify-center mt-2">
        <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 p-[2px] rounded-xl shadow-[0_0_15px_rgba(234,179,8,0.5)]">
          <div className="bg-black/80 px-6 py-2 rounded-xl flex flex-col items-center">
            <span className="text-yellow-400 font-black text-sm tracking-widest">JACKPOT</span>
            <span className="text-white font-bold text-xl tracking-widest">{jackpot.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-[350px]">
        
        {/* Wheel */}
        <div className="relative w-[300px] h-[300px] flex items-center justify-center">
          {/* Center Cat & Timer */}
          <div className="absolute z-30 w-24 h-24 bg-gradient-to-b from-purple-500 to-indigo-600 rounded-full flex flex-col items-center justify-center border-4 border-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.6)]">
            <div className="text-3xl mb-1">🐱</div>
            {gameState === 'betting' ? (
              <div className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                وقت المراهنة {timeLeft}s
              </div>
            ) : gameState === 'spinning' ? (
              <div className="text-yellow-400 text-xs font-bold animate-pulse">جاري السحب...</div>
            ) : (
              <div className="text-green-400 text-xs font-bold">النتيجة!</div>
            )}
          </div>

          {/* Rotating Items */}
          <div 
            className="absolute inset-0 transition-transform duration-[9000ms] ease-[cubic-bezier(0.25,0.1,0.15,1)]"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {ITEMS.map((item, index) => (
              <div 
                key={item.id}
                className="absolute top-1/2 left-1/2 w-16 h-16 -ml-8 -mt-8 flex flex-col items-center justify-center"
                style={getWheelItemStyle(index)}
              >
                <div className={`w-14 h-14 rounded-2xl ${item.color} border-2 border-white/50 shadow-lg flex items-center justify-center relative overflow-hidden`} style={{ transform: `rotate(${-rotation}deg)` }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent"></div>
                  <span className="text-3xl relative z-10">{item.icon}</span>
                  <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] font-bold px-1 rounded-tl-md z-20">
                    x{item.multiplier}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Selection Pointer (Top) */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L22 20H2L12 2Z" transform="rotate(180 12 12)" />
            </svg>
          </div>
        </div>

        {/* Win Announcement */}
        <AnimatePresence>
          {gameState === 'result' && winAmount > 0 && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute z-50 bg-black/80 border-2 border-yellow-400 rounded-2xl p-4 flex flex-col items-center shadow-[0_0_30px_rgba(234,179,8,0.5)]"
            >
              <span className="text-yellow-400 font-bold text-lg mb-1">لقد فزت!</span>
              <span className="text-white font-black text-2xl">+{winAmount.toLocaleString()} 💎</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History */}
      <div className="relative z-10 bg-black/40 p-2 flex items-center gap-2 overflow-x-auto border-y border-white/10">
        <div className="flex items-center gap-1 text-yellow-500 font-bold text-xs whitespace-nowrap px-2">
          <History size={14} /> النتائج:
        </div>
        {history.map((item, i) => (
          <div key={i} className={`w-8 h-8 shrink-0 rounded-lg ${item.color} flex items-center justify-center text-lg border border-white/20`}>
            {item.icon}
          </div>
        ))}
      </div>

      {/* Betting Area */}
      <div className="relative z-10 bg-indigo-950/80 p-4 rounded-t-3xl border-t border-purple-500/30">
        {/* Bet Amounts */}
        <div className="flex justify-between gap-2 mb-4 overflow-x-auto pb-2">
          {BET_AMOUNTS.map(amount => (
            <button
              key={amount}
              onClick={() => setSelectedBetAmount(amount)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedBetAmount === amount 
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)] scale-110' 
                  : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {amount >= 1000 ? `${amount/1000}k` : amount}
            </button>
          ))}
        </div>

        {/* Bet Items Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handlePlaceBet(item.id)}
              disabled={gameState !== 'betting'}
              className={`relative flex flex-col items-center p-2 rounded-xl border-2 transition-all ${
                gameState === 'betting' ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-80 cursor-not-allowed'
              } ${bets[item.id] ? 'border-yellow-400 bg-white/10' : 'border-transparent bg-black/40'}`}
            >
              <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center text-xl mb-1 shadow-inner`}>
                {item.icon}
              </div>
              <span className="text-[10px] text-gray-300 font-bold">x{item.multiplier}</span>
              
              {/* User's Bet on this item */}
              {bets[item.id] && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-md">
                  {bets[item.id] >= 1000 ? `${bets[item.id]/1000}k` : bets[item.id]}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Top Players (Simulated) */}
        <div className="flex items-center gap-2 bg-black/50 rounded-xl p-2 border border-white/5">
          <div className="text-yellow-500 font-bold text-xs flex flex-col items-center px-2 border-l border-white/10">
            <Trophy size={16} />
            <span>TOP 5</span>
          </div>
          <div className="flex flex-1 justify-around">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="relative">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=player${i}`} className="w-8 h-8 rounded-full bg-gray-800 border border-gray-600" alt="Player" />
                {i === 1 && <Crown size={12} className="absolute -top-2 -right-1 text-yellow-400 drop-shadow-md" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
