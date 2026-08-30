import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Rocket } from 'lucide-react';

export default function RocketCrash() {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'crashed'>('idle');
  const [multiplier, setMultiplier] = useState(1.00);
  const [bet, setBet] = useState(100);
  const [crashPoint, setCrashPoint] = useState(0);
  const [winAmount, setWinAmount] = useState(0);
  const [userDiamonds, setUserDiamonds] = useState(0);
  
  const timerRef = useRef<any>(null);

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

  const startGame = async () => {
    if (!user) return;
    
    if (userDiamonds < bet) {
      alert('رصيد الألماس غير كافٍ');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { diamonds: userDiamonds - bet });

    // Fetch config
    const settingsDoc = await getDoc(doc(db, 'settings', 'games_config'));
    const maxCrash = settingsDoc.data()?.rocketMaxCrash ?? 5; // e.g., 5x max
    
    // Generate crash point (weighted towards lower numbers)
    const random = Math.random();
    const point = 1 + (maxCrash - 1) * Math.pow(random, 2); 
    setCrashPoint(point);
    
    setGameState('playing');
    setMultiplier(1.00);
    setWinAmount(0);

    let currentMult = 1.00;
    timerRef.current = setInterval(() => {
      currentMult += 0.01;
      setMultiplier(currentMult);
      
      if (currentMult >= point) {
        clearInterval(timerRef.current);
        setGameState('crashed');
      }
    }, 50);
  };

  const cashOut = async () => {
    if (gameState !== 'playing' || !user) return;
    
    clearInterval(timerRef.current);
    setGameState('idle');
    
    const won = Math.floor(bet * multiplier);
    setWinAmount(won);
    
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const diamonds = userDoc.data()?.diamonds || 0;
    
    await updateDoc(userRef, { diamonds: diamonds + won });
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-2 sm:p-4 text-white bg-gradient-to-b from-indigo-950 via-purple-900 to-indigo-900 relative overflow-y-auto custom-scrollbar">
      {/* Balance Display */}
      <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-yellow-500/30 flex items-center gap-2 shadow-lg">
        <span className="text-yellow-400 font-black text-sm">{userDiamonds.toLocaleString()}</span>
        <span className="text-xs">💎</span>
      </div>

      <div className="flex-1 w-full relative flex items-center justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-black/40 shadow-inner mb-4 sm:mb-6">
        {/* Stars background */}
        <div className="absolute inset-0 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
        
        {/* Graph axes */}
        <div className="absolute bottom-0 left-0 w-full h-full border-l-2 border-b-2 border-white/20 m-4 sm:m-8 pointer-events-none"></div>
        
        {/* Rocket and Trail */}
        <div 
          className="absolute transition-all duration-75 ease-linear z-20"
          style={{
            bottom: `calc(${Math.min(80, (multiplier - 1) * 20)}% + 1rem)`,
            left: `calc(${Math.min(80, (multiplier - 1) * 20)}% + 1rem)`,
            transform: `rotate(45deg)`
          }}
        >
          <div className="relative">
            <Rocket size={40} className={`${gameState === 'crashed' ? 'text-gray-600' : 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,1)]'} sm:w-20 sm:h-20`} />
            {gameState === 'playing' && (
              <div className="absolute -bottom-4 sm:-bottom-8 left-1/2 -translate-x-1/2 w-2 sm:w-4 h-8 sm:h-16 bg-gradient-to-t from-transparent via-yellow-500 to-orange-500 blur-md animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Multiplier Display */}
        <div className="absolute top-1/4 text-center z-30 px-4">
          <div className={`text-5xl sm:text-7xl font-black tracking-tighter ${gameState === 'crashed' ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.5)]'}`}>
            {multiplier.toFixed(2)}x
          </div>
          {gameState === 'crashed' && (
            <div className="text-xl sm:text-3xl text-red-500 font-black mt-2 sm:mt-4 uppercase tracking-widest bg-red-500/20 px-4 sm:px-6 py-1 sm:py-2 rounded-xl border border-red-500/50">CRASHED!</div>
          )}
          {winAmount > 0 && (
            <div className="text-lg sm:text-2xl text-green-400 font-bold mt-2 sm:mt-4 bg-green-500/20 px-4 sm:px-6 py-1 sm:py-2 rounded-xl border border-green-500/50">فزت بـ {winAmount} 💎</div>
          )}
        </div>
      </div>

      <div className="w-full max-w-md bg-gray-900/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4 sm:mb-6 bg-black/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl">
          <div className="flex flex-col w-full">
            <span className="text-gray-400 text-xs sm:text-sm mb-1 sm:mb-2 text-center font-bold">مبلغ الرهان</span>
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3">
              <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={gameState === 'playing'} className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-700 hover:bg-gray-600 rounded-lg sm:rounded-xl font-black text-xl sm:text-2xl transition-colors">-</button>
              <input 
                type="number" 
                value={bet} 
                onChange={(e) => setBet(Math.max(10, parseInt(e.target.value) || 10))} 
                disabled={gameState === 'playing'}
                className="w-24 sm:w-32 bg-transparent text-2xl sm:text-3xl font-black text-center text-yellow-400 outline-none border-b-2 border-yellow-500/50 focus:border-yellow-400"
              />
              <button onClick={() => setBet(bet + 10)} disabled={gameState === 'playing'} className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-700 hover:bg-gray-600 rounded-lg sm:rounded-xl font-black text-xl sm:text-2xl transition-colors">+</button>
            </div>
            
            <div className="flex justify-center gap-2 overflow-x-auto hide-scrollbar py-1">
              {[10, 100, 500, 1000, 5000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setBet(amount)}
                  disabled={gameState === 'playing'}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${bet === amount ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
                >
                  {amount}
                </button>
              ))}
              <button
                onClick={() => setBet(userDiamonds)}
                disabled={gameState === 'playing'}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${bet === userDiamonds ? 'bg-red-500 text-white border-red-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
              >
                الكل
              </button>
            </div>
          </div>
        </div>

        {gameState === 'playing' ? (
          <button 
            onClick={cashOut}
            className="w-full py-4 sm:py-5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-2xl sm:text-3xl rounded-xl sm:rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all transform active:scale-95"
          >
            سحب ({(bet * multiplier).toFixed(0)})
          </button>
        ) : (
          <button 
            onClick={startGame}
            className="w-full py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-2xl sm:text-3xl rounded-xl sm:rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all transform active:scale-95"
          >
            بدء اللعبة
          </button>
        )}
      </div>
    </div>
  );
}

