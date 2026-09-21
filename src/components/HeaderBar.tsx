import React from 'react';
import { 
  Coins, 
  Plus, 
  Volume2, 
  VolumeX, 
  History, 
  Shield, 
  HelpCircle, 
  RotateCw,
  Sparkles
} from 'lucide-react';

interface HeaderBarProps {
  balance: number;
  userName: string;
  userAvatar: string;
  roundNumber: number;
  tableName: string;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenRecharge: () => void;
  onOpenHistory: () => void;
  onOpenAdmin: () => void;
  onOpenRules: () => void;
  onReconnect: () => void;
  isConnected: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  balance,
  userName,
  userAvatar,
  roundNumber,
  tableName,
  isMuted,
  onToggleSound,
  onOpenRecharge,
  onOpenHistory,
  onOpenAdmin,
  onOpenRules,
  onReconnect,
  isConnected,
}) => {
  return (
    <header className="relative z-20 w-full px-3 sm:px-6 py-2.5 flex items-center justify-between border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md select-none">
      {/* Left: User Balance & Recharge */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Balance Display with (+) button matching video */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-sm">
            <Coins className="w-3.5 h-3.5" />
          </div>
          <span className="font-black text-xs sm:text-sm font-mono text-amber-300">
            {balance.toLocaleString()}
          </span>
          <button
            id="btn-header-recharge"
            onClick={onOpenRecharge}
            className="w-5 h-5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-black transition-transform active:scale-95 shadow"
            title="Recharge Coins"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>

        {/* User Avatar Mini */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/60 border border-slate-800">
          <img
            src={userAvatar}
            alt={userName}
            className="w-6 h-6 rounded-full object-cover border border-cyan-400/60"
            referrerPolicy="no-referrer"
          />
          <span className="text-xs font-bold text-slate-200 max-w-[80px] truncate">
            {userName}
          </span>
        </div>
      </div>

      {/* Center: Table & Round Info */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs sm:text-sm font-black tracking-wide text-white uppercase drop-shadow">
            {tableName}
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            R#{roundNumber}
          </span>
        </div>
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
          <span>{isConnected ? 'Real-Time Connected' : 'Reconnecting...'}</span>
        </div>
      </div>

      {/* Right: Controls & Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Game History button (with NEW pill matching the video frame 0) */}
        <button
          id="btn-header-history"
          onClick={onOpenHistory}
          className="relative px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-400/50 text-cyan-300 flex items-center gap-1.5 text-xs font-bold transition-all shadow-md active:scale-95"
          title="Game History"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">History</span>
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase shadow">
            NEW
          </span>
        </button>

        {/* Sound toggle */}
        <button
          id="btn-toggle-sound"
          onClick={onToggleSound}
          className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all active:scale-95"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Rules help modal */}
        <button
          id="btn-open-rules"
          onClick={onOpenRules}
          className="p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all active:scale-95"
          title="Card Game Rules"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Admin Dashboard */}
        <button
          id="btn-open-admin"
          onClick={onOpenAdmin}
          className="px-2.5 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1 text-xs font-bold transition-all active:scale-95"
          title="Admin Control Dashboard"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Admin</span>
        </button>

        {/* Reconnect */}
        {!isConnected && (
          <button
            onClick={onReconnect}
            className="p-2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40"
            title="Reconnect"
          >
            <RotateCw className="w-4 h-4 animate-spin" />
          </button>
        )}
      </div>
    </header>
  );
};
