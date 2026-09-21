import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Gift, Copy, Check, Stars, Sparkles, X } from 'lucide-react';

export default function WelcomeOverlay() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<'welcome' | 'gift' | 'reveal'>('welcome');
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const { welcomeGiftEnabled, welcomeGiftDiscount, promoCodes, siteName } = useStore();
  const codeGeneratedRef = useRef(false);

  useEffect(() => {
    // Small delay to ensure DB settings are loaded
    const timer = setTimeout(() => {
      const giftClaimed = localStorage.getItem('welcome_gift_v3_claimed');
      if (welcomeGiftEnabled && giftClaimed !== 'true') {
        setShow(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [welcomeGiftEnabled]);

  const generateRandomCode = async () => {
    if (codeGeneratedRef.current) return;
    codeGeneratedRef.current = true;

    // Generate a random 4-character suffix
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 4; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Pattern: GIFT-[PERCENTAGE]-[SUFFIX]
    const code = `GIFT-${welcomeGiftDiscount || 10}-${suffix}`;
    setGeneratedCode(code);
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleComplete = () => {
    setShow(false);
    localStorage.setItem('welcome_gift_v3_claimed', 'true');
  };

  const handleDismiss = () => {
    setShow(false);
  };

  const openGift = () => {
    generateRandomCode();
    setStep('reveal');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm overflow-hidden p-4"
        >
          {/* Close Button - More subtle */}
          <button 
            onClick={handleDismiss}
            className="absolute top-6 right-6 z-50 p-2 bg-white/80 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all shadow-lg border border-slate-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Background Decorative Elements - Even more subtle */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              animate={{ 
                scale: [0.8, 1, 0.8],
                opacity: [0.05, 0.1, 0.05],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute w-[300px] h-[300px] bg-indigo-500 rounded-full blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>
          
          <div className="relative text-center max-w-sm w-full">
            <AnimatePresence mode="wait">
              {step === 'welcome' && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -10 }}
                  className="bg-white p-6 rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-4"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-lg flex items-center justify-center"
                  >
                    <Gift className="w-8 h-8 text-white" />
                  </motion.div>

                  <div className="space-y-1">
                    <p className="text-indigo-500 font-bold tracking-widest uppercase text-[10px] font-arabic">
                      هدية خاصة لـك
                    </p>
                    <h1 className="text-xl font-black text-slate-900">
                      {siteName}
                    </h1>
                  </div>

                  {welcomeGiftEnabled ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setStep('gift')}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 font-arabic"
                    >
                      افتح الهدية
                      <Gift className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <button
                      onClick={handleComplete}
                      className="w-full bg-slate-100 text-slate-900 py-3 rounded-xl font-black text-sm font-arabic"
                    >
                        دخول الموقع
                    </button>
                  )}
                </motion.div>
              )}

              {step === 'gift' && (
                <motion.div
                    key="gift"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    className="flex flex-col items-center gap-4"
                >
                    <motion.div
                        animate={{ 
                            rotate: [0, -5, 5, -5, 5, 0],
                            y: [0, -3, 0]
                        }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.3 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-indigo-500/10 blur-[30px]" />
                        <motion.div 
                            onClick={openGift}
                            className="cursor-pointer"
                        >
                            <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[1.5rem] shadow-2xl flex items-center justify-center relative p-6">
                                <Gift className="w-full h-full text-white" />
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-full bg-white/20" />
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-full bg-white/20" />
                            </div>
                        </motion.div>
                    </motion.div>
                    <p className="text-indigo-600 font-arabic font-black text-xs bg-white px-4 py-1.5 rounded-full shadow-md border border-slate-100 animate-bounce">
                        افتح الآن! 🎁
                    </p>
                </motion.div>
              )}

              {step === 'reveal' && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-6 rounded-[2rem] shadow-2xl border border-slate-100 relative"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    
                    <h2 className="text-xl font-black text-slate-900 mb-0.5">مبارك! 🎉</h2>
                    <p className="text-slate-500 text-[10px] mb-4 font-arabic">كود خصم حصري لك</p>

                    <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
                        <div className="text-2xl font-black text-slate-900 tracking-widest mb-3">
                            {generatedCode}
                        </div>
                        <button 
                            onClick={handleCopy}
                            className="w-full bg-white border border-slate-200 text-slate-900 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                        >
                            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-indigo-500" />}
                            {copied ? 'تم النسخ' : 'نسخ الكود'}
                        </button>
                    </div>

                    <button 
                      onClick={handleComplete}
                      className="w-full bg-indigo-600 text-white py-3 rounded-lg font-black text-sm transition-all shadow-md shadow-indigo-600/10 hover:bg-indigo-700 active:scale-[0.98] font-arabic"
                    >
                      تسوق الآن
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Confetti-like elements on reveal */}
          {step === 'reveal' && (
              <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{ 
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0.5],
                            x: (Math.random() - 0.5) * 800,
                            y: (Math.random() - 0.5) * 800,
                            rotate: Math.random() * 360
                        }}
                        transition={{ duration: 2, delay: 0.5 + Math.random() * 1 }}
                        className="absolute left-1/2 top-1/2 w-4 h-4 bg-indigo-500 rounded-sm"
                        style={{ backgroundColor: ['#6366f1', '#a855f7', '#fbbf24', '#f472b6'][Math.floor(Math.random() * 4)] }}
                      />
                  ))}
              </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
