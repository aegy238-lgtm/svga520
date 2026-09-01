import React, { useState, useEffect } from 'react';
import { X, Gamepad2, Rocket, Cherry, Zap, Cat, Coins } from 'lucide-react';
import FruitRoulette from './FruitRoulette';
import ZeusSlots from './ZeusSlots';
import RocketCrash from './RocketCrash';
import LuckyCatGame from './LuckyCatGame';
import JackpotFruits from './JackpotFruits';
import { registerBackHandler, unregisterBackHandler } from '../../hooks/useBackButton';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function GameCenterModal({ onClose }: { onClose: () => void }) {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [gameImages, setGameImages] = useState<any>({});

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'games_config'));
      if (docSnap.exists()) {
        setGameImages(docSnap.data());
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (activeGame) {
        setActiveGame(null);
        return true;
      }
      onClose();
      return true;
    };
    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [activeGame, onClose]);

  return (
    <div className={`fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center ${activeGame ? 'p-0' : 'p-0 sm:p-4'}`}>
      <div className={`bg-gray-900 w-full ${activeGame ? 'max-w-full h-full rounded-none border-none' : 'max-w-4xl h-full sm:h-[85vh] sm:rounded-3xl border-x sm:border'} border-gray-700 flex flex-col overflow-hidden relative transition-all duration-300`}>
        
        {!activeGame && (
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-2 text-white">
              <Gamepad2 className="text-purple-400" />
              <h2 className="font-bold text-lg">مركز الألعاب</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 bg-gray-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${activeGame ? 'p-0' : 'p-4 sm:p-10'} bg-gray-950/50`}>
          {!activeGame ? (
            <div className="grid grid-cols-3 gap-3 sm:gap-8 justify-items-center max-w-6xl mx-auto">
              <GameCard 
                title="جاكبوت الفواكه" 
                icon={<Coins size={56} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />}
                borderColor="border-yellow-500/40 hover:border-yellow-400"
                shadowColor="hover:shadow-[0_0_30px_rgba(234,179,8,0.3)]"
                glowColor="from-yellow-600 to-red-600"
                image={gameImages.jackpotFruitsImage}
                onClick={() => setActiveGame('jackpotfruits')}
              />
              <GameCard 
                title="القط المحظوظ" 
                icon={<Cat size={56} className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />}
                borderColor="border-purple-500/40 hover:border-purple-400"
                shadowColor="hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                glowColor="from-purple-600 to-pink-600"
                image={gameImages.luckyCatImage}
                onClick={() => setActiveGame('luckycat')}
              />
              <GameCard 
                title="عجلة الفواكه" 
                icon={<Cherry size={56} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />}
                borderColor="border-red-500/40 hover:border-red-400"
                shadowColor="hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                glowColor="from-red-600 to-orange-600"
                image={gameImages.fruitImage}
                onClick={() => setActiveGame('fruit')}
              />
              <GameCard 
                title="سلوتس زيوس" 
                icon={<Zap size={56} className="text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)]" />}
                borderColor="border-yellow-400/40 hover:border-yellow-300"
                shadowColor="hover:shadow-[0_0_30px_rgba(253,224,71,0.3)]"
                glowColor="from-yellow-400 to-amber-600"
                image={gameImages.zeusImage}
                onClick={() => setActiveGame('zeus')}
              />
              <GameCard 
                title="الصاروخ (Crash)" 
                icon={<Rocket size={56} className="text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />}
                borderColor="border-blue-500/40 hover:border-blue-400"
                shadowColor="hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                glowColor="from-blue-600 to-cyan-600"
                image={gameImages.rocketImage}
                onClick={() => setActiveGame('rocket')}
              />
            </div>
          ) : (
            <div className="h-full w-full relative">
              <button 
                onClick={() => setActiveGame(null)} 
                className="absolute top-4 left-4 z-[100] text-white flex items-center justify-center w-10 h-10 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-md border border-white/10 transition-colors shadow-lg"
              >
                <X size={24} />
              </button>
              <div className="w-full h-full">
                {activeGame === 'jackpotfruits' && <JackpotFruits />}
                {activeGame === 'luckycat' && <LuckyCatGame />}
                {activeGame === 'fruit' && <FruitRoulette />}
                {activeGame === 'zeus' && <ZeusSlots />}
                {activeGame === 'rocket' && <RocketCrash />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GameCard({ title, icon, borderColor, shadowColor, glowColor, image, onClick }: any) {
  return (
    <div 
      onClick={onClick} 
      className={`relative group cursor-pointer rounded-2xl sm:rounded-[2rem] overflow-hidden w-full max-w-[300px] aspect-square border-2 ${borderColor} shadow-lg ${shadowColor} transition-all duration-500 hover:-translate-y-2 bg-gray-900 mx-auto`}
    >
      {/* Background Image */}
      {image ? (
        <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${glowColor} opacity-10 group-hover:opacity-20 transition-opacity duration-500`}></div>
      )}

      {/* Gradient Overlay for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-500"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent opacity-80 h-1/2 mt-auto"></div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full p-2 sm:p-6 pb-4 sm:pb-8">
        {!image && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 sm:p-6 rounded-2xl sm:rounded-3xl bg-gray-800/40 backdrop-blur-xl border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
            <div className="scale-50 sm:scale-100 origin-center">{icon}</div>
          </div>
        )}
        
        <h3 className="text-white font-black text-xs sm:text-2xl tracking-wide drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] text-center z-20 transform group-hover:-translate-y-1 sm:group-hover:-translate-y-2 transition-transform duration-500 leading-tight">
          {title}
        </h3>
        
        <div className="absolute bottom-1 sm:bottom-3 opacity-0 group-hover:opacity-100 transform translate-y-2 sm:translate-y-4 group-hover:translate-y-0 transition-all duration-500 z-20 hidden sm:block">
           <span className="text-sm font-bold text-white/90 uppercase tracking-widest bg-black/50 px-4 py-1 rounded-full backdrop-blur-md border border-white/20">العب الآن</span>
        </div>
      </div>
      
      {/* Inner Glow */}
      <div className={`absolute inset-0 rounded-2xl sm:rounded-[2rem] border border-white/5 pointer-events-none`}></div>
    </div>
  );
}
