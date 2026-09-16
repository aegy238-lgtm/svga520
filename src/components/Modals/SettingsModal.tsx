import React from 'react';
import { X, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  onToggleSound: (enabled: boolean) => void;
  onResetBalance: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMuted,
  onToggleSound,
  onResetBalance,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-[340px] bg-gradient-to-b from-[#b45309] to-[#78350f] rounded-3xl p-5 border-2 border-amber-300 shadow-2xl flex flex-col text-amber-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-600/50">
            <h2 className="text-lg font-black text-amber-100">Settings</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-amber-200 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-5 space-y-4">
            {/* Sound Toggle (Matching video frame 00:27) */}
            <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-amber-700/40">
              <div className="flex items-center gap-2">
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-rose-300" />
                ) : (
                  <Volume2 className="w-5 h-5 text-amber-300" />
                )}
                <span className="text-sm font-bold text-amber-100">Sound</span>
              </div>

              <div className="flex items-center bg-black/40 rounded-xl p-1 border border-amber-600/50">
                <button
                  type="button"
                  onClick={() => onToggleSound(true)}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                    !isMuted
                      ? 'bg-emerald-500 text-white shadow'
                      : 'text-amber-200/60 hover:text-white'
                  }`}
                >
                  On
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSound(false)}
                  className={`px-3 py-1 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                    isMuted
                      ? 'bg-rose-500 text-white shadow'
                      : 'text-amber-200/60 hover:text-white'
                  }`}
                >
                  Off
                </button>
              </div>
            </div>

            {/* Reset / Top Up Quick Action */}
            <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-amber-700/40">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-bold text-amber-100">Reset 50K Coins</span>
              </div>
              <button
                type="button"
                onClick={onResetBalance}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-black rounded-xl shadow cursor-pointer transition-transform active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black py-2 rounded-xl shadow border border-amber-200 cursor-pointer text-xs uppercase"
          >
            Done
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
