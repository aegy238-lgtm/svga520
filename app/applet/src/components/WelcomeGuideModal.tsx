import React from 'react';
import { BookOpen, Sparkles, ArrowLeft } from 'lucide-react';

interface Props {
  onOpenGuide: () => void;
  onSkip: () => void;
}

export const WelcomeGuideModal: React.FC<Props> = ({ onOpenGuide, onSkip }) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#07090E]/95 backdrop-blur-2xl p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative w-full max-w-lg bg-[#0E1017] rounded-[2.5rem] border border-white/10 shadow-2xl p-8 sm:p-10 flex flex-col items-center text-center overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-b from-indigo-500/20 to-transparent blur-3xl pointer-events-none" />
        
        <div className="relative w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center border border-indigo-500/30 mb-8 shadow-2xl shadow-indigo-500/20">
          <BookOpen className="w-12 h-12 text-indigo-400" />
          <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center border-4 border-[#0E1017]">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">
          مرحباً بك في <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">دليل الاستخدام</span>
        </h1>
        
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8">
          لقد أضفنا دليلاً احترافياً شاملاً يشرح لك جميع وظائف وأدوات الموقع خطوة بخطوة، مع دعم اللغتين العربية والإنجليزية، لتتمكن من احتراف استخدام المنصة بسهولة.
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={onOpenGuide}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 group"
          >
            <BookOpen className="w-5 h-5" />
            <span>استعراض جميع الميزات</span>
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={onSkip}
            className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 font-bold transition-all flex items-center justify-center gap-2"
          >
            <span>تخطي الدليل</span>
            <span className="text-[10px] uppercase text-slate-500 ml-1">(Skip Guide)</span>
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-500 font-medium">
          يمكنك دائماً العودة للدليل عبر زر "دليل الاستخدام" الموجود في أعلى الصفحة.
        </p>
      </div>
    </div>
  );
};
