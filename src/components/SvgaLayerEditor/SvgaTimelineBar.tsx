import React, { useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, RotateCcw, 
  ChevronLeft, ChevronRight, Zap, Film, Clock
} from 'lucide-react';
import { EditableLayer } from './types';

interface SvgaTimelineBarProps {
  totalFrames: number;
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  isLoop: boolean;
  selectedLayer: EditableLayer | null;
  onTogglePlay: () => void;
  onStepFrame: (delta: number) => void;
  onSeekFrame: (frame: number) => void;
  onToggleLoop: () => void;
}

export const SvgaTimelineBar: React.FC<SvgaTimelineBarProps> = ({
  totalFrames,
  currentFrame,
  fps,
  isPlaying,
  isLoop,
  selectedLayer,
  onTogglePlay,
  onStepFrame,
  onSeekFrame,
  onToggleLoop
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const durationSec = fps > 0 ? (totalFrames / fps).toFixed(2) : '0.00';
  const currentTimeSec = fps > 0 ? (currentFrame / fps).toFixed(2) : '0.00';
  const progressPct = totalFrames > 0 ? (currentFrame / (totalFrames - 1 || 1)) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || totalFrames <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetFrame = Math.round(pct * (totalFrames - 1));
    onSeekFrame(targetFrame);
  };

  return (
    <div className="h-20 bg-[#070b14] border-t border-white/10 flex flex-col justify-between px-6 py-2 select-none shrink-0" dir="ltr">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Left Playback Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSeekFrame(0)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="إلى البداية (Start)"
          >
            <SkipBack size={14} />
          </button>
          
          <button
            onClick={() => onStepFrame(-1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="فريم للخلف (Step Prev)"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
            title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل الحركة'}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>

          <button
            onClick={() => onStepFrame(1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="فريم للأمام (Step Next)"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => onSeekFrame(totalFrames - 1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="إلى النهاية (End)"
          >
            <SkipForward size={14} />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <button
            onClick={onToggleLoop}
            className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
              isLoop
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
            title={isLoop ? 'تكرار مفعل' : 'تكرار معطل'}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Center: Selected Layer Keyframe Summary */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          {selectedLayer ? (
            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-xl border border-white/10">
              <Film size={12} className="text-indigo-400" />
              <span className="text-white font-bold truncate max-w-[160px]">{selectedLayer.name}</span>
              <span className="text-slate-600">|</span>
              <span>Span: F{selectedLayer.keyframeSummary.startFrame} - F{selectedLayer.keyframeSummary.endFrame}</span>
            </div>
          ) : (
            <span className="text-slate-500 text-[11px]">حدد طبقة لمعاينة مسار الحركة</span>
          )}
        </div>

        {/* Right Time & FPS Counter */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 text-slate-400">
            <Clock size={12} className="text-indigo-400" />
            <span className="text-white font-bold">{currentTimeSec}s</span>
            <span>/ {durationSec}s</span>
          </div>

          <div className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg text-slate-300">
            <span className="text-indigo-400 font-bold">{currentFrame + 1}</span>
            <span className="text-slate-500"> / {totalFrames} F</span>
          </div>

          <span className="text-[10px] text-slate-500 uppercase font-bold">{fps} FPS</span>
        </div>
      </div>

      {/* Timeline Scrub Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-4 bg-slate-900/90 rounded-lg border border-white/10 cursor-pointer overflow-hidden group mb-1 flex items-center"
      >
        {/* Layer Active Span Highlight */}
        {selectedLayer && (
          <div
            className="absolute top-0 bottom-0 bg-indigo-500/20 border-x border-indigo-400/40 pointer-events-none"
            style={{
              left: `${(selectedLayer.keyframeSummary.startFrame / (totalFrames - 1 || 1)) * 100}%`,
              width: `${((selectedLayer.keyframeSummary.endFrame - selectedLayer.keyframeSummary.startFrame + 1) / (totalFrames - 1 || 1)) * 100}%`
            }}
          />
        )}

        {/* Progress Fill */}
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75"
          style={{ width: `${progressPct}%` }}
        />

        {/* Playhead Pin */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-white rounded shadow-md -translate-x-1/2 border border-indigo-600 transition-all duration-75"
          style={{ left: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};
