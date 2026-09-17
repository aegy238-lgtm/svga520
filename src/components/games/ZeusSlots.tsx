import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const SYMBOLS = ['💎', '👑', '💍', '⚡', '🏺', '🦁'];

export default function ZeusSlots() {
  const { user } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [grid, setGrid] = useState<string[][]>(Array(4).fill(Array(5).fill('💎')));
  const [bet, setBet] = useState(100);
  const [winAmount, setWinAmount] = useState(0);
  const [userDiamonds, setUserDiamonds] = useState(0);

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

  const handleSpin = async () => {
    if (spinning || !user) return;
    
    if (userDiamonds < bet) {
      alert('رصيد الألماس غير كافٍ');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { diamonds: userDiamonds - bet });
    setSpinning(true);
    setWinAmount(0);

    // Fetch win ratio
    const settingsDoc = await getDoc(doc(db, 'settings', 'games_config'));
    const winRatio = settingsDoc.data()?.zeusWinRatio ?? 20;

    const isWin = Math.random() * 100 < winRatio;

    // Simulate spinning
    let spinCount = 0;
    const interval = setInterval(() => {
      const newGrid = Array(4).fill(0).map(() => 
        Array(5).fill(0).map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
      );
      setGrid(newGrid);
      spinCount++;
      
      if (spinCount > 20) {
        clearInterval(interval);
        setSpinning(false);
        
        if (isWin) {
          // Force a win (e.g., 5 symbols match in a row)
          const winGrid = [...newGrid];
          const winSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          winGrid[1] = Array(5).fill(winSymbol);
          setGrid(winGrid);
          
          const won = bet * 5;
          setWinAmount(won);
          const latestUserDoc = getDoc(userRef);
          latestUserDoc.then(d => {
            const current = d.data()?.diamonds || 0;
            updateDoc(userRef, { diamonds: current + won });
          });
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-2 sm:p-4 text-white bg-gray-950 relative overflow-y-auto custom-scrollbar">
      <div className="bg-[url('https://picsum.photos/seed/zeus/800/600')] bg-cover bg-center absolute inset-0 opacity-20"></div>
      <div className="bg-black/60 absolute inset-0"></div>
      
      {/* Balance Display */}
      <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-yellow-500/30 flex items-center gap-2 shadow-lg">
        <span className="text-yellow-400 font-black text-sm">{userDiamonds.toLocaleString()}</span>
        <span className="text-xs">💎</span>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        <div className="text-3xl sm:text-5xl mb-4 sm:mb-8 font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] tracking-wider">
          ZEUS SLOTS
        </div>

        <div className="bg-gradient-to-b from-yellow-900/90 to-yellow-800/90 p-1.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 sm:border-4 border-yellow-500 mb-6 sm:mb-8 w-full shadow-[0_0_40px_rgba(250,204,21,0.3)]">
          <div className="grid grid-rows-4 gap-1 sm:gap-2">
            {grid.map((row, i) => (
              <div key={i} className="grid grid-cols-5 gap-1 sm:gap-2">
                {row.map((symbol, j) => (
                  <div key={j} className="bg-gradient-to-b from-black/80 to-black/60 rounded-lg sm:rounded-xl aspect-square flex items-center justify-center text-xl sm:text-4xl border border-yellow-500/30 shadow-inner">
                    <span className={spinning ? 'animate-pulse blur-[1px]' : ''}>{symbol}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between w-full bg-black/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-yellow-500/50 shadow-2xl gap-4 sm:gap-0">
          <div className="flex flex-col items-center bg-gray-900 p-2 sm:p-3 rounded-xl border border-gray-700 w-full sm:w-auto">
            <span className="text-gray-400 text-[10px] sm:text-xs mb-1 uppercase tracking-wider">الرهان</span>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full font-bold hover:bg-gray-600">-</button>
              <input 
                type="number" 
                value={bet} 
                onChange={(e) => setBet(Math.max(10, parseInt(e.target.value) || 10))} 
                disabled={spinning}
                className="w-16 sm:w-20 bg-transparent text-xl sm:text-2xl font-black text-center text-white outline-none border-b-2 border-yellow-500/50 focus:border-yellow-400"
              />
              <button onClick={() => setBet(bet + 10)} disabled={spinning} className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full font-bold hover:bg-gray-600">+</button>
            </div>
            <div className="flex gap-1 overflow-x-auto hide-scrollbar py-1">
              {[10, 100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setBet(amount)}
                  disabled={spinning}
                  className={`px-2 py-1 rounded-lg text-[8px] font-black transition-all border ${bet === amount ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
                >
                  {amount}
                </button>
              ))}
              <button
                onClick={() => setBet(userDiamonds)}
                disabled={spinning}
                className={`px-2 py-1 rounded-lg text-[8px] font-black transition-all border ${bet === userDiamonds ? 'bg-red-500 text-white border-red-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
              >
                الكل
              </button>
            </div>
          </div>

          <button 
            onClick={handleSpin}
            disabled={spinning}
            className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 border-4 border-yellow-200 text-black font-black text-xl sm:text-2xl shadow-[0_0_40px_rgba(250,204,21,0.6)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
          >
            SPIN
          </button>

          <div className="flex flex-col items-center bg-gray-900 p-2 sm:p-3 rounded-xl border border-gray-700 min-w-[100px] sm:min-w-[120px] w-full sm:w-auto">
            <span className="text-gray-400 text-[10px] sm:text-xs mb-1 uppercase tracking-wider">الفوز</span>
            <span className={`font-black text-xl sm:text-2xl ${winAmount > 0 ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'text-yellow-400'}`}>
              {winAmount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

