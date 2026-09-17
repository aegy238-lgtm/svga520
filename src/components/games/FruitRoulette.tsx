import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const ITEMS = [
  { id: 'apple', icon: '🍎', color: 'bg-red-500', multiplier: 2 },
  { id: 'watermelon', icon: '🍉', color: 'bg-green-500', multiplier: 2 },
  { id: 'seven', icon: '7️⃣', color: 'bg-yellow-500', multiplier: 8 },
  { id: 'grape', icon: '🍇', color: 'bg-purple-500', multiplier: 2 },
  { id: 'lemon', icon: '🍋', color: 'bg-yellow-400', multiplier: 2 },
  { id: 'cherry', icon: '🍒', color: 'bg-red-600', multiplier: 2 },
];

export default function FruitRoulette() {
  const { user } = useAuth();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [bet, setBet] = useState(100);
  const [selectedItem, setSelectedItem] = useState('apple');
  const [rotation, setRotation] = useState(0);
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
    // Deduct bet
    await updateDoc(userRef, { diamonds: userDiamonds - bet });

    setSpinning(true);
    setResult(null);

    // Fetch win ratio from settings
    const settingsDoc = await getDoc(doc(db, 'settings', 'games_config'));
    const winRatio = settingsDoc.data()?.fruitWinRatio ?? 30; // 30% chance to win

    const isWin = Math.random() * 100 < winRatio;
    
    let winningItem;
    if (isWin) {
      winningItem = ITEMS.find(i => i.id === selectedItem)!;
    } else {
      const others = ITEMS.filter(i => i.id !== selectedItem);
      winningItem = others[Math.floor(Math.random() * others.length)];
    }

    // Calculate rotation
    const itemIndex = ITEMS.indexOf(winningItem);
    const segmentAngle = 360 / ITEMS.length;
    // Add 5 full rotations + the angle to the winning item
    const targetRotation = rotation + (360 * 5) - (itemIndex * segmentAngle);
    
    setRotation(targetRotation);

    setTimeout(async () => {
      setSpinning(false);
      setResult(winningItem);

      if (isWin) {
        const winAmount = bet * winningItem.multiplier;
        const latestUserDoc = await getDoc(userRef);
        const currentDiamonds = latestUserDoc.data()?.diamonds || 0;
        await updateDoc(userRef, { diamonds: currentDiamonds + winAmount });
      }
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-white bg-gray-950 relative overflow-y-auto custom-scrollbar">
      <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/casino/800/600')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80"></div>
      
      {/* Balance Display */}
      <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-yellow-500/30 flex items-center gap-2 shadow-lg">
        <span className="text-yellow-400 font-black text-sm">{userDiamonds.toLocaleString()}</span>
        <span className="text-xs">💎</span>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-6 sm:mb-8">
          {/* Pointer */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-8 bg-yellow-400 z-20 shadow-lg" style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}></div>
          
          {/* Wheel */}
          <div 
            className="w-full h-full rounded-full border-4 sm:border-8 border-yellow-500 relative transition-transform duration-[3000ms] ease-out bg-indigo-900 shadow-[0_0_30px_rgba(234,179,8,0.3)]"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {ITEMS.map((item, idx) => {
              const angle = idx * (360 / ITEMS.length);
              return (
                <div 
                  key={item.id}
                  className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom h-1/2 flex items-start justify-center pt-2 sm:pt-4 text-2xl sm:text-4xl"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <span style={{ transform: `rotate(${-angle}deg)` }}>{item.icon}</span>
                </div>
              );
            })}
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 sm:w-12 sm:h-12 bg-yellow-500 rounded-full border-2 sm:border-4 border-yellow-700 z-10"></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 w-full">
          {ITEMS.map(item => (
            <button 
              key={item.id}
              onClick={() => setSelectedItem(item.id)}
              disabled={spinning}
              className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex flex-col items-center gap-1 sm:gap-2 transition-all ${selectedItem === item.id ? 'border-yellow-400 bg-yellow-400/20 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-gray-600 bg-gray-800/80 hover:bg-gray-700'}`}
            >
              <span className="text-xl sm:text-3xl">{item.icon}</span>
              <span className="text-[10px] sm:text-sm font-bold text-yellow-400">x{item.multiplier}</span>
            </button>
          ))}
        </div>

        <div className="w-full space-y-3 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4 bg-black/50 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/10 w-full justify-center">
            <span className="text-gray-400 text-xs sm:text-sm">الرهان:</span>
            <button onClick={() => setBet(Math.max(10, bet - 10))} disabled={spinning} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-700 rounded-lg font-bold hover:bg-gray-600">-</button>
            <input 
              type="number" 
              value={bet} 
              onChange={(e) => setBet(Math.max(10, parseInt(e.target.value) || 10))} 
              disabled={spinning}
              className="w-20 sm:w-28 bg-transparent text-lg sm:text-2xl font-bold text-center text-yellow-400 outline-none border-b-2 border-yellow-500/50 focus:border-yellow-400"
            />
            <button onClick={() => setBet(bet + 10)} disabled={spinning} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-700 rounded-lg font-bold hover:bg-gray-600">+</button>
          </div>

          <div className="flex justify-center gap-2 overflow-x-auto hide-scrollbar py-1">
            {[10, 100, 500, 1000, 5000].map(amount => (
              <button
                key={amount}
                onClick={() => setBet(amount)}
                disabled={spinning}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${bet === amount ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
              >
                {amount}
              </button>
            ))}
            <button
              onClick={() => setBet(userDiamonds)}
              disabled={spinning}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${bet === userDiamonds ? 'bg-red-500 text-white border-red-400' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
            >
              الكل
            </button>
          </div>
        </div>

        <button 
          onClick={handleSpin} 
          disabled={spinning}
          className="w-full py-3 sm:py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 text-black"
        >
          {spinning ? 'جاري الدوران...' : 'العب الآن'}
        </button>

        {result && !spinning && (
          <div className="mt-4 sm:mt-6 text-xl sm:text-2xl font-black animate-bounce text-center">
            {result.id === selectedItem ? (
              <span className="text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">لقد فزت بـ {bet * result.multiplier} 💎!</span>
            ) : (
              <span className="text-red-400">حظ أوفر في المرة القادمة</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
