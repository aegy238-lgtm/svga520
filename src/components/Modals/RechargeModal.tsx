import React, { useState } from 'react';
import { X, Gift, CheckCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiamonds: number;
  onAddDiamonds: (amount: number) => void;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  currentDiamonds,
  onAddDiamonds,
}) => {
  const [activeTab, setActiveTab] = useState<'recharge' | 'exchange'>('recharge');
  const [claimedGift, setClaimedGift] = useState(false);

  if (!isOpen) return null;

  const packages = [
    { coins: 8000, price: '$1.0', bonus: 0 },
    { coins: 40000, price: '$5.0', bonus: 500, popular: true },
    { coins: 100000, price: '$10.0', bonus: 2500 },
    { coins: 500000, price: '$45.0', bonus: 20000 },
  ];

  const handleClaimFreeGift = () => {
    onAddDiamonds(50000);
    setClaimedGift(true);
    setTimeout(() => setClaimedGift(false), 2500);
  };

  const handleSelectPackage = (coins: number, bonus: number) => {
    onAddDiamonds(coins + bonus);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-[380px] max-h-[85vh] bg-gradient-to-b from-[#6b21a8] via-[#581c87] to-[#3b0764] rounded-3xl p-4 border-2 border-purple-400 shadow-2xl flex flex-col text-white overflow-hidden"
        >
          {/* Header Tabs */}
          <div className="flex items-center justify-between pb-3 border-b border-purple-400/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('recharge')}
                className={`px-3 py-1 text-sm font-black rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'recharge'
                    ? 'bg-amber-400 text-amber-950 shadow'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                Recharge
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exchange')}
                className={`px-3 py-1 text-sm font-black rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'exchange'
                    ? 'bg-amber-400 text-amber-950 shadow'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                Exchange
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-purple-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Balance Banner */}
          <div className="my-3 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 rounded-2xl p-3 text-amber-950 shadow-lg flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-900">My Gold Coins / Diamonds</div>
              <div className="text-2xl font-black flex items-center gap-1.5 mt-0.5">
                <span>💎</span>
                <span>{currentDiamonds.toLocaleString()}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaimFreeGift}
              disabled={claimedGift}
              className="bg-purple-900 hover:bg-purple-800 text-amber-200 px-3 py-1.5 rounded-xl text-xs font-black shadow-md flex items-center gap-1 cursor-pointer transition-transform active:scale-95 disabled:opacity-75"
            >
              {claimedGift ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  +50K Added!
                </>
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5 text-amber-300" />
                  Free 50K Gift
                </>
              )}
            </button>
          </div>

          {/* Payment Method Bar */}
          <div className="text-xs text-purple-200/90 font-bold mb-1 flex items-center justify-between">
            <span>Select Recharge Package:</span>
            <span className="text-[10px] bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/30">
              Demo Instant Credit
            </span>
          </div>

          {/* Packages List */}
          <div className="flex-1 overflow-y-auto space-y-2 py-1 hide-scrollbar">
            {packages.map((pkg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPackage(pkg.coins, pkg.bonus)}
                className="w-full bg-white/10 hover:bg-white/15 border border-purple-300/40 rounded-2xl p-3 flex items-center justify-between shadow-md transition-all active:scale-98 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 flex items-center justify-center text-amber-950 shadow">
                    💎
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-black text-white group-hover:text-amber-300">
                      {pkg.coins.toLocaleString()} Coins
                    </span>
                    {pkg.bonus > 0 && (
                      <span className="text-[10px] font-extrabold text-amber-300 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> +{pkg.bonus} Bonus!
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-amber-400 group-hover:bg-amber-300 text-amber-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-md">
                  {pkg.price}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3 text-center text-[10px] text-purple-300/80">
            Instant credit is provided for testing & gameplay enjoyment!
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
