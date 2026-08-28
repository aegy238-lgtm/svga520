import { Settings, ShieldCheck, LogOut, Edit3 } from 'lucide-react';
import { motion } from 'motion/react';

export function ProfileHeader() {
  return (
    <div className="relative pt-6">
      {/* Top Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.9 }} className="p-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
            <Settings size={20} className="text-gray-300" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} className="p-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
            <ShieldCheck size={20} className="text-emerald-400" />
          </motion.button>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} className="p-2.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl hover:bg-red-500/30 transition-colors">
          <LogOut size={20} />
        </motion.button>
      </div>

      {/* User Info */}
      <div className="flex flex-col items-center text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
           <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 mt-2">
             <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-2 border-[#05060f] overflow-hidden">
               <img src="https://i.pravatar.cc/150?img=60" alt="User" className="w-full h-full object-cover" />
             </div>
           </div>
           <button className="absolute bottom-1 right-1 p-2 bg-indigo-500 rounded-full border-4 border-[#05060f] hover:bg-indigo-400 transition-colors">
             <Edit3 size={14} className="text-white" />
           </button>
        </motion.div>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          ســـالـم المطيري
          <span className="bg-purple-900/40 text-purple-300 text-[10px] px-2 py-1 rounded-full flex items-center border border-purple-500/30">
            <ShieldCheck size={12} className="ml-1" /> موثق
          </span>
        </h2>
        <p className="text-slate-400 text-xs mt-1 mb-3 font-normal tracking-wide flex items-center gap-1 justify-center">
          ID: <span className="text-slate-300">98457231</span>
        </p>

        <div className="flex items-center gap-2 text-[13px] text-slate-300 mb-6">
          <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1">🇸🇦 السعودية</span>
          <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">26 عاماً</span>
          <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700 flex text-blue-400 items-center justify-center text-sm leading-none">♂</span>
        </div>

        {/* Stats */}
        <div className="w-full grid grid-cols-3 gap-3 mb-2">
           <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-3 flex flex-col items-center">
             <span className="text-lg font-bold text-white">45.2K</span>
             <span className="text-[11px] text-slate-400 mt-0.5">الزوار</span>
           </div>
           <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-3 flex flex-col items-center">
             <span className="text-lg font-bold text-white">12.8K</span>
             <span className="text-[11px] text-slate-400 mt-0.5">المتابعون</span>
           </div>
           <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-3 flex flex-col items-center">
             <span className="text-lg font-bold text-white">160</span>
             <span className="text-[11px] text-slate-400 mt-0.5">أتابع</span>
           </div>
        </div>
      </div>
    </div>
  )
}
