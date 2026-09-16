import React from 'react';
import { X, BookOpen, Utensils, Salad, Pizza } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RuleModal: React.FC<RuleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-[390px] max-h-[85vh] bg-gradient-to-b from-[#881337] via-[#701a75] to-[#4a044e] rounded-3xl p-5 border-2 border-amber-400 shadow-2xl flex flex-col text-amber-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-rose-400/40">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg font-black text-amber-100">Rule</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rules Content exactly matching video screenshot */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs text-rose-100 leading-relaxed hide-scrollbar">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                1
              </span>
              <p>Choose your bet amount and select the food to bet.</p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                2
              </span>
              <p>
                There are seconds for betting each round, the result will be announced instantly
                afterwards.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                3
              </span>
              <p>
                If the result announced matches the food you have selected, you will coin rewards
                relative to the respective odds:
                <br />
                <span className="text-amber-300 font-bold">
                  🍗 Roast Chicken: x45 (Hot) | 🐟 Fish: x25 | 🥩 Steak: x15 | 🌭 Sausage: x10 |
                  🥬 Bok Choy: x5 | 🎃 Pumpkin: x5 | 🍆 Eggplant: x5 | 🍉 Watermelon: x5
                </span>
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                4
              </span>
              <p>
                The official prize pool will increase as more users participate in game, there will be
                a chance for "PIZZA" or "SALAD" reward as prize pool reaches a certain amount.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-400 text-emerald-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                5
              </span>
              <div className="space-y-1">
                <p className="font-bold text-emerald-200">
                  If "SALAD" was announced, then all vegetables will be rewarded!
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-300">
                  <Salad className="w-4 h-4" /> (Bok Choy, Pumpkin, Eggplant, Watermelon)
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-orange-400 text-orange-950 font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                6
              </span>
              <div className="space-y-1">
                <p className="font-bold text-orange-200">
                  If "PIZZA" was announced, then all meats will be rewarded!
                </p>
                <div className="flex items-center gap-1 text-[11px] text-orange-300">
                  <Pizza className="w-4 h-4" /> (Roast Chicken, Fish, Steak, Sausage)
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 font-black py-2 rounded-xl shadow-md border-2 border-amber-300 cursor-pointer text-sm"
          >
            Understood
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
