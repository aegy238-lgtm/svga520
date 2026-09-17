import React from 'react';
import { ArrowLeft, HelpCircle, Volume2, VolumeX, Settings } from 'lucide-react';

interface TopBarProps {
  roundNumber: number;
  isMuted: boolean;
  onToggleMusic: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  onBackToLobby?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roundNumber,
  isMuted,
  onToggleMusic,
  onOpenRules,
  onOpenSettings,
  onBackToLobby,
}) => {
  return (
    <div className="w-full max-w-[390px] mx-auto px-3 pt-2 pb-1 flex items-center justify-between select-none relative z-30">
      {/* Left: Back circular button */}
      <button
        type="button"
        onClick={onBackToLobby}
        className="w-9 h-9 rounded-full bg-teal-700/80 hover:bg-teal-600/90 border-2 border-teal-300/60 shadow-md text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
        title="Back"
      >
        <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Center: Today Round Pill */}
      <div className="bg-emerald-950/40 backdrop-blur-xs border border-emerald-300/40 rounded-full px-3.5 py-1 shadow-md flex items-center gap-1.5">
        <span className="text-xs font-bold text-amber-200">Today Round:</span>
        <span className="text-sm font-black text-white tracking-wider">
          {roundNumber}
        </span>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Music Button */}
        <button
          type="button"
          onClick={onToggleMusic}
          className={`w-9 h-9 rounded-full border-2 shadow-md flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
            isMuted
              ? 'bg-rose-800/80 border-rose-300 text-rose-200'
              : 'bg-teal-700/80 hover:bg-teal-600 border-teal-300/60 text-white'
          }`}
          title={isMuted ? 'Sound Muted' : 'Sound On'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Rules Question Mark Button */}
        <button
          type="button"
          onClick={onOpenRules}
          className="w-9 h-9 rounded-full bg-teal-700/80 hover:bg-teal-600/90 border-2 border-teal-300/60 shadow-md text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
          title="Game Rules"
        >
          <HelpCircle className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full bg-teal-700/80 hover:bg-teal-600/90 border-2 border-teal-300/60 shadow-md text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4 stroke-[2]" />
        </button>
      </div>
    </div>
  );
};
