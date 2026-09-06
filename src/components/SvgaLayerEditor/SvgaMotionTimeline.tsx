import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditableLayer, LayerKeyframe, MotionTracksConfig, SVGAAudioTrack } from './types';
import { 
  Play, Pause, SkipBack, SkipForward, RotateCcw, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronRight as ChevronRightIcon,
  Plus, Diamond, Sliders, Trash2, Eye, Move, Maximize2, Minimize2, RotateCw, 
  Sun, Clock, Film, Sparkles, SlidersHorizontal, Settings2, MoreVertical, ZoomIn, ZoomOut, Copy, ClipboardPaste, Music,
  Layers, Palette, GripVertical, Check, Lock, Unlock
} from 'lucide-react';
import { KeyframeEasingPanel } from './KeyframeEasingPanel';
import { 
  getLayerAnimatedTransform, 
  upsertKeyframe, 
  deleteKeyframe, 
  moveKeyframe 
} from './motionEngine';

interface SvgaMotionTimelineProps {
  totalFrames: number;
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  isLoop: boolean;
  selectedLayer: EditableLayer | null;
  layers: EditableLayer[];
  projectAudios?: SVGAAudioTrack[];
  onOpenAudioStudio?: () => void;
  onSelectLayer: (id: string) => void;
  onTogglePlay: () => void;
  onStepFrame: (delta: number) => void;
  onSeekFrame: (frame: number) => void;
  onToggleLoop: () => void;
  onUpdateLayerTransform: (layerId: string, transform: Partial<EditableLayer['transform']>) => void;
  onUpdateLayerKeyframes: (layerId: string, keyframes: LayerKeyframe[]) => void;
  onUpdateProjectDuration?: (seconds: number) => void;
  onUpdateLayerTimeRange?: (layerId: string, inFrame: number, outFrame: number, trackColor?: string, commit?: boolean) => void;
}

export const SvgaMotionTimeline: React.FC<SvgaMotionTimelineProps> = ({
  totalFrames,
  currentFrame,
  fps,
  isPlaying,
  isLoop,
  selectedLayer,
  layers,
  projectAudios = [],
  onOpenAudioStudio,
  onSelectLayer,
  onTogglePlay,
  onStepFrame,
  onSeekFrame,
  onToggleLoop,
  onUpdateLayerTransform,
  onUpdateLayerKeyframes,
  onUpdateProjectDuration,
  onUpdateLayerTimeRange
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);

  // Timeline Zoom & Scroll state
  const [timelineZoom, setTimelineZoom] = useState<number>(1); // 1 = 100%
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState<boolean>(false);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const [clipboardKeyframes, setClipboardKeyframes] = useState<LayerKeyframe[]>([]);

  // Timeline View Mode: 'all' (Multi-Track) or 'selected' (Single Layer Curves)
  const [timelineViewMode, setTimelineViewMode] = useState<'all' | 'selected'>('all');
  const [showColorPickerForLayer, setShowColorPickerForLayer] = useState<string | null>(null);

  // Active Trimming State for Left / Right duration handles or moving the whole span
  const [activeTrim, setActiveTrim] = useState<{
    layerId: string;
    handle: 'start' | 'end' | 'move';
    initialIn: number;
    initialOut: number;
    startMouseX: number;
    currentIn: number;
    currentOut: number;
  } | null>(null);

  // Available Track Accent Colors (Red is default for added/merged assets)
  const TRACK_COLORS = [
    { label: 'أحمر مدمج (الافتراضي)', value: '#ef4444' },
    { label: 'ياقوتي وردي', value: '#f43f5e' },
    { label: 'كهرماني ذهبي', value: '#f59e0b' },
    { label: 'أخضر زمردي', value: '#10b981' },
    { label: 'أزرق سماوي', value: '#06b6d4' },
    { label: 'بنفسجي ملكي', value: '#8b5cf6' },
    { label: 'نيلي كلاسيكي', value: '#6366f1' },
  ];

  // Expanded track configuration for selected layer
  const motionConfig: MotionTracksConfig = selectedLayer?.motionTracksConfig || {
    showTransform: true,
    showPosition: true,
    showScale: true,
    showRotation: true,
    showOpacity: true
  };

  const isMotionExpanded = selectedLayer?.isMotionExpanded !== false;

  // Active transform calculated from keyframes or base at current frame
  const currentAnimatedTransform = selectedLayer 
    ? getLayerAnimatedTransform(selectedLayer, currentFrame)
    : null;

  const durationSec = fps > 0 ? (totalFrames / fps).toFixed(2) : '0.00';
  const currentTimeSec = fps > 0 ? (currentFrame / fps).toFixed(2) : '0.00';

  // Toggle Motion Expanded
  const handleToggleExpand = () => {
    if (!selectedLayer) return;
    const newExpanded = !isMotionExpanded;
    const updated = {
      ...selectedLayer,
      isMotionExpanded: newExpanded
    };
    onUpdateLayerKeyframes(selectedLayer.id, selectedLayer.keyframes || []);
  };

  // Toggle Track Visibility
  const handleToggleTrackConfig = (trackKey: keyof MotionTracksConfig) => {
    if (!selectedLayer) return;
    const currentCfg = selectedLayer.motionTracksConfig || {
      showTransform: true,
      showPosition: true,
      showScale: true,
      showRotation: true,
      showOpacity: true
    };
    const newCfg = { ...currentCfg, [trackKey]: !currentCfg[trackKey] };
    selectedLayer.motionTracksConfig = newCfg;
    onUpdateLayerKeyframes(selectedLayer.id, selectedLayer.keyframes || []);
  };

  const [scaleAspectLocked, setScaleAspectLocked] = useState<boolean>(true);

  // Dedicated Scale Keyframes collection & helpers
  const scaleKeyframes = (selectedLayer?.keyframes || []).filter(k => k.scaleX !== undefined || k.scaleY !== undefined);
  const currentScaleKf = scaleKeyframes.find(k => k.frame === currentFrame);

  const handleJumpPrevScaleKf = () => {
    const prior = scaleKeyframes.filter(k => k.frame < currentFrame);
    if (prior.length > 0) {
      const target = prior[prior.length - 1];
      onSeekFrame(target.frame);
      setSelectedKeyframeId(target.id);
    }
  };

  const handleJumpNextScaleKf = () => {
    const nexts = scaleKeyframes.filter(k => k.frame > currentFrame);
    if (nexts.length > 0) {
      const target = nexts[0];
      onSeekFrame(target.frame);
      setSelectedKeyframeId(target.id);
    }
  };

  // Add Keyframe for specific property or all with support for explicit customValues
  const handleAddKeyframe = (
    type: 'all' | 'position' | 'scale' | 'rotation' | 'opacity',
    customValues?: Partial<EditableLayer['transform']>
  ) => {
    if (!selectedLayer) return;
    const cur = currentAnimatedTransform || selectedLayer.transform;

    let partial: Partial<EditableLayer['transform']> = {};
    if (type === 'all' || type === 'position') {
      partial.x = customValues?.x !== undefined ? customValues.x : cur.x;
      partial.y = customValues?.y !== undefined ? customValues.y : cur.y;
    }
    if (type === 'all' || type === 'scale') {
      partial.scaleX = customValues?.scaleX !== undefined ? customValues.scaleX : cur.scaleX;
      partial.scaleY = customValues?.scaleY !== undefined ? customValues.scaleY : cur.scaleY;
    }
    if (type === 'all' || type === 'rotation') {
      partial.rotation = customValues?.rotation !== undefined ? customValues.rotation : cur.rotation;
    }
    if (type === 'all' || type === 'opacity') {
      partial.opacity = customValues?.opacity !== undefined ? customValues.opacity : cur.opacity;
    }

    const updatedKeyframes = upsertKeyframe(selectedLayer, currentFrame, partial);
    onUpdateLayerKeyframes(selectedLayer.id, updatedKeyframes);

    const added = updatedKeyframes.find(k => k.frame === currentFrame);
    if (added) setSelectedKeyframeId(added.id);
    setShowAddMenu(false);
  };

  // Delete Selected Keyframe
  const handleDeleteKeyframe = (keyframeId: string) => {
    if (!selectedLayer) return;
    const updated = deleteKeyframe(selectedLayer, keyframeId);
    onUpdateLayerKeyframes(selectedLayer.id, updated);
    if (selectedKeyframeId === keyframeId) setSelectedKeyframeId(null);
  };

  const handleCopyAllKeyframes = () => {
    if (!selectedLayer || !selectedLayer.keyframes || selectedLayer.keyframes.length === 0) {
      alert("لا توجد فريمات حركة لنسخها في هذه الطبقة.");
      return;
    }
    // Deep copy and sort by frame
    const copied = JSON.parse(JSON.stringify(selectedLayer.keyframes)).sort((a: any, b: any) => a.frame - b.frame);
    setClipboardKeyframes(copied);
    alert(`تم نسخ ${copied.length} فريم حركة بنجاح.`);
  };

  const handlePasteKeyframes = () => {
    if (!selectedLayer) return;
    if (clipboardKeyframes.length === 0) {
      alert("لا يوجد فريمات منسوخة. قم بنسخ حركة أولاً.");
      return;
    }
    
    // The first frame of the copied keyframes acts as the base offset (0 relative)
    const baseFrame = clipboardKeyframes[0].frame;
    const newKeyframes: LayerKeyframe[] = clipboardKeyframes.map(kf => ({
      ...kf,
      id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      frame: Math.min(totalFrames - 1, Math.max(0, currentFrame + (kf.frame - baseFrame)))
    }));

    // Merge new keyframes with existing (replace if exists at same frame)
    let updatedList = [...(selectedLayer.keyframes || [])];
    newKeyframes.forEach(nkf => {
      const existingIdx = updatedList.findIndex(k => k.frame === nkf.frame);
      if (existingIdx >= 0) {
        updatedList[existingIdx] = nkf;
      } else {
        updatedList.push(nkf);
      }
    });

    updatedList.sort((a, b) => a.frame - b.frame);
    onUpdateLayerKeyframes(selectedLayer.id, updatedList);
    alert(`تم لصق الحركة بدءاً من الفريم ${currentFrame}.`);
  };

  // Update specific keyframe attributes
  const handleUpdateKeyframeDetails = (updatedProps: Partial<LayerKeyframe>) => {
    if (!selectedLayer || !selectedKeyframeId || !selectedLayer.keyframes) return;
    const updatedList = selectedLayer.keyframes.map(k => {
      if (k.id === selectedKeyframeId) {
        return { ...k, ...updatedProps };
      }
      return k;
    });
    onUpdateLayerKeyframes(selectedLayer.id, updatedList);
  };

  // Ruler & Timeline Click / Drag Scrubber
  const handleTimelineRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current || totalFrames <= 0) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetFrame = Math.round(pct * (totalFrames - 1));
    onSeekFrame(targetFrame);
  };

  // Dragging Playhead
  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!rulerRef.current || totalFrames <= 0) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const moveX = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, moveX / rect.width));
      const targetFrame = Math.round(pct * (totalFrames - 1));
      onSeekFrame(targetFrame);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Keyframe Diamond Drag handler
  const handleKeyframeMouseDown = (e: React.MouseEvent, keyframeId: string) => {
    e.stopPropagation();
    setSelectedKeyframeId(keyframeId);
    setDraggingKeyframeId(keyframeId);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!rulerRef.current || !selectedLayer || totalFrames <= 0) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const moveX = moveEvent.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, moveX / rect.width));
      const targetFrame = Math.round(pct * (totalFrames - 1));

      const movedList = moveKeyframe(selectedLayer, keyframeId, targetFrame);
      onUpdateLayerKeyframes(selectedLayer.id, movedList);
      onSeekFrame(targetFrame);
    };

    const onMouseUp = () => {
      setDraggingKeyframeId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Direct numeric editing for current frame properties
  const handleLivePropChange = (prop: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity', val: number) => {
    if (!selectedLayer) return;
    
    // Update layer base transform
    onUpdateLayerTransform(selectedLayer.id, { [prop]: val });

    // If layer has keyframes, or if keyframe exists at current frame, update it
    if (selectedLayer.keyframes && selectedLayer.keyframes.length > 0) {
      const updated = upsertKeyframe(selectedLayer, currentFrame, { [prop]: val });
      onUpdateLayerKeyframes(selectedLayer.id, updated);
    }
  };

  // Generate Ruler Tick Marks (every 0.5s or every 5/10 frames)
  const renderRulerTicks = () => {
    if (totalFrames <= 0) return null;
    const ticks = [];
    const step = Math.max(1, Math.round(fps / 2)); // Every ~0.5s

    for (let f = 0; f < totalFrames; f += step) {
      const pct = (f / (totalFrames - 1 || 1)) * 100;
      const sec = fps > 0 ? (f / fps).toFixed(1) : '0';
      ticks.push(
        <div 
          key={f} 
          className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none -translate-x-1/2"
          style={{ left: `${pct}%` }}
        >
          <div className="flex items-center gap-1">
            <div className="h-3 w-px bg-white/20" />
            <span className="text-[9px] font-mono text-slate-400 font-bold select-none">{sec}s</span>
          </div>
          <div className="h-2 w-px bg-white/10" />
        </div>
      );
    }
    return ticks;
  };

  // Start dragging a duration trim handle ('start' / 'end') or the whole span ('move')
  const startTrim = (
    e: React.MouseEvent,
    layerId: string,
    handle: 'start' | 'end' | 'move',
    initialIn: number,
    initialOut: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectLayer(layerId);
    setActiveTrim({
      layerId,
      handle,
      initialIn,
      initialOut,
      startMouseX: e.clientX,
      currentIn: initialIn,
      currentOut: initialOut
    });
  };

  // Mouse drag listener for trimming in/out frames
  useEffect(() => {
    if (!activeTrim) return;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!rulerRef.current || totalFrames <= 0) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      if (trackWidth <= 0) return;

      const deltaX = moveEvent.clientX - activeTrim.startMouseX;
      const deltaFrames = Math.round((deltaX / trackWidth) * (totalFrames - 1));

      let newIn = activeTrim.initialIn;
      let newOut = activeTrim.initialOut;

      if (activeTrim.handle === 'start') {
        newIn = Math.max(0, Math.min(activeTrim.initialOut - 1, activeTrim.initialIn + deltaFrames));
      } else if (activeTrim.handle === 'end') {
        newOut = Math.max(activeTrim.initialIn + 1, Math.min(totalFrames - 1, activeTrim.initialOut + deltaFrames));
      } else if (activeTrim.handle === 'move') {
        const span = activeTrim.initialOut - activeTrim.initialIn;
        newIn = Math.max(0, Math.min(totalFrames - 1 - span, activeTrim.initialIn + deltaFrames));
        newOut = newIn + span;
      }

      setActiveTrim(prev => prev ? { ...prev, currentIn: newIn, currentOut: newOut } : null);
      onUpdateLayerTimeRange?.(activeTrim.layerId, newIn, newOut, undefined, false);
    };

    const onMouseUp = () => {
      if (activeTrim) {
        onUpdateLayerTimeRange?.(activeTrim.layerId, activeTrim.currentIn, activeTrim.currentOut, undefined, true);
      }
      setActiveTrim(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeTrim, totalFrames, onUpdateLayerTimeRange]);

  // Render visual time bar with draggable handles for inFrame/outFrame duration
  const renderSpanBar = (layer: EditableLayer, isSelected: boolean = false, rowHeightClass: string = 'h-9') => {
    const isThisTrimming = activeTrim?.layerId === layer.id;
    const inFrame = isThisTrimming 
      ? activeTrim.currentIn 
      : (layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0));
    const outFrame = isThisTrimming 
      ? activeTrim.currentOut 
      : (layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (totalFrames - 1)));

    // Track color (default red #ef4444 for newly merged/added asset or layer)
    const trackColor = layer.trackColor || (layer.groupId ? '#ef4444' : '#ef4444');

    const leftPct = totalFrames > 1 ? (inFrame / (totalFrames - 1)) * 100 : 0;
    const widthPct = totalFrames > 1 ? Math.max(1.5, ((outFrame - inFrame + 1) / (totalFrames - 1)) * 100) : 100;
    const rightPct = Math.max(0, 100 - (leftPct + widthPct));

    const inSec = fps > 0 ? (inFrame / fps).toFixed(2) : '0.00';
    const outSec = fps > 0 ? (outFrame / fps).toFixed(2) : '0.00';
    const durSec = fps > 0 ? ((outFrame - inFrame + 1) / fps).toFixed(2) : '0.00';

    return (
      <div 
        key={layer.id}
        className={`${rowHeightClass} border-b border-white/5 relative flex items-center bg-slate-900/20 group select-none overflow-hidden transition-colors ${
          isSelected ? 'bg-indigo-950/20' : 'hover:bg-white/[0.02]'
        }`}
        onClick={() => onSelectLayer(layer.id)}
      >
        {/* Inactive time overlay before inFrame (Darkened hatched pattern) */}
        {leftPct > 0 && (
          <div 
            className="absolute top-0 bottom-0 left-0 bg-black/60 pointer-events-none z-10 border-r border-white/10"
            style={{ width: `${leftPct}%` }}
          >
            <div className="w-full h-full opacity-30 bg-[repeating-linear-gradient(45deg,#000_0,#000_3px,transparent_3px,transparent_6px)]" />
          </div>
        )}

        {/* Inactive time overlay after outFrame (Darkened hatched pattern) */}
        {rightPct > 0 && (
          <div 
            className="absolute top-0 bottom-0 right-0 bg-black/60 pointer-events-none z-10 border-l border-white/10"
            style={{ width: `${rightPct}%` }}
          >
            <div className="w-full h-full opacity-30 bg-[repeating-linear-gradient(45deg,#000_0,#000_3px,transparent_3px,transparent_6px)]" />
          </div>
        )}

        {/* The Draggable Red Duration Bar (الشريط الأحمر لتحديد وقت الظهور) */}
        <div
          className={`absolute h-6 rounded-md transition-all flex items-center justify-between z-20 shadow-md border ${
            isThisTrimming 
              ? 'ring-2 ring-white shadow-xl scale-[1.01] brightness-110 cursor-grabbing' 
              : 'cursor-grab hover:brightness-105 active:cursor-grabbing'
          }`}
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            backgroundColor: trackColor,
            borderColor: isSelected ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.35)',
            boxShadow: `0 4px 12px ${trackColor}40`
          }}
          onMouseDown={(e) => startTrim(e, layer.id, 'move', inFrame, outFrame)}
          title={`شريط مدة الظهور (سحب لتحريك التوقيت بالكامل) | من: ${inSec}s (F${inFrame}) إلى: ${outSec}s (F${outFrame})`}
        >
          {/* Left Handle (Trim In-Frame / شد من الشمال لليمين) */}
          <div
            onMouseDown={(e) => startTrim(e, layer.id, 'start', inFrame, outFrame)}
            className="w-3.5 h-full rounded-l-md bg-white hover:bg-white text-slate-800 flex items-center justify-center cursor-ew-resize shrink-0 transition-transform hover:scale-105 shadow-md z-30"
            title={`شد من الشمال لليمين لضبط بداية الظهور: ${inSec}s (F${inFrame})`}
          >
            <div className="flex flex-col gap-0.5 pointer-events-none">
              <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
              <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
            </div>
          </div>

          {/* Center Info Label */}
          <div className="flex-1 px-1.5 flex items-center justify-center gap-1.5 overflow-hidden pointer-events-none text-white font-mono text-[10px] font-black drop-shadow select-none">
            <span className="truncate">
              {inSec}s → {outSec}s ({durSec}s)
            </span>
          </div>

          {/* Right Handle (Trim Out-Frame / شد من اليمين للشمال) */}
          <div
            onMouseDown={(e) => startTrim(e, layer.id, 'end', inFrame, outFrame)}
            className="w-3.5 h-full rounded-r-md bg-white hover:bg-white text-slate-800 flex items-center justify-center cursor-ew-resize shrink-0 transition-transform hover:scale-105 shadow-md z-30"
            title={`شد من اليمين لضبط نهاية الظهور: ${outSec}s (F${outFrame})`}
          >
            <div className="flex flex-col gap-0.5 pointer-events-none">
              <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
              <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
            </div>
          </div>
        </div>

        {/* Live Trimming Floating HUD Tooltip */}
        {isThisTrimming && (
          <div 
            className="absolute -top-7 z-40 bg-slate-900 border border-white/20 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xl flex items-center gap-1 pointer-events-none -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${leftPct + widthPct / 2}%` }}
          >
            <span className="text-red-400 font-sans">⏱️ ظهور:</span>
            <span>{inSec}s (F{inFrame})</span>
            <span className="text-slate-400">→</span>
            <span>{outSec}s (F{outFrame})</span>
            <span className="text-amber-400 font-sans">| مدة: {durSec}s</span>
          </div>
        )}
      </div>
    );
  };

  const selectedKeyframe = selectedLayer?.keyframes?.find(k => k.id === selectedKeyframeId) || null;
  const playheadPct = totalFrames > 0 ? (currentFrame / (totalFrames - 1 || 1)) * 100 : 0;

  return (
    <div className="bg-[#070b14] border-t border-white/10 flex flex-col select-none relative shadow-2xl z-20" dir="ltr">
      {/* 1. TOP PLAYBACK & TIME CONTROL BAR */}
      <div className="h-11 px-4 border-b border-white/10 bg-slate-900/60 flex items-center justify-between gap-4">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeekFrame(0)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="إلى البداية (F0)"
          >
            <SkipBack size={15} />
          </button>
          
          <button
            onClick={() => onStepFrame(-1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="فريم للخلف (Prev Frame)"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            onClick={onTogglePlay}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 cursor-pointer font-black text-xs"
            title={isPlaying ? 'إيقاف مؤقت (Space)' : 'تشغيل الحركة (Space)'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-white" />}
            <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
          </button>

          <button
            onClick={() => onStepFrame(1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="فريم للأمام (Next Frame)"
          >
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => onSeekFrame(totalFrames - 1)}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="إلى النهاية (End Frame)"
          >
            <SkipForward size={15} />
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Loop Toggle */}
          <button
            onClick={onToggleLoop}
            className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
              isLoop
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                : 'bg-white/5 text-slate-500 border-white/10'
            }`}
            title={isLoop ? 'تكرار الحركة مفعل (Looping ON)' : 'تكرار الحركة معطل'}
          >
            <RotateCcw size={13} />
          </button>

          {onOpenAudioStudio && (
            <button
              onClick={onOpenAudioStudio}
              className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center gap-1.5 font-bold ${
                projectAudios.length > 0
                  ? 'bg-purple-600/30 text-purple-200 border-purple-500/40 hover:bg-purple-600/50'
                  : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
              }`}
              title="استوديو قص وإضافة المسارات الصوتية للمشروع"
            >
              <Music size={13} className="text-purple-400" />
              <span className="text-[10px] hidden sm:inline">
                {projectAudios.length > 0 ? `الصوت (${projectAudios.length})` : 'إضافة صوت'}
              </span>
            </button>
          )}
        </div>

        {/* Center: Active Layer Banner & Keyframe Shortcut */}
        <div className="flex items-center gap-3">
          {selectedLayer ? (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-indigo-500/30 shadow-inner">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-white font-bold text-xs truncate max-w-[200px]">{selectedLayer.name}</span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-indigo-300 font-mono">
                {selectedLayer.keyframes?.length || 0} Keyframes
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-sans">حدد طبقة للتحكم في مفاتيح التحريك (Keyframes)</span>
          )}
        </div>

        {/* Right: Time, Frame Counters & FPS */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {/* Time Display */}
          <div className="flex items-center gap-1 text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Clock size={12} className="text-indigo-400" />
            <span className="text-white font-bold">{currentTimeSec}s</span>
            <span className="px-1">/</span>
            <input
              type="number"
              min={0.1}
              max={60}
              step={0.1}
              value={durationSec}
              onChange={(e) => onUpdateProjectDuration && onUpdateProjectDuration(parseFloat(e.target.value) || 2)}
              className="w-12 bg-transparent text-slate-300 outline-none hover:bg-white/10 focus:bg-white/10 focus:text-white rounded px-1 transition-colors"
              title="مدة المشروع بالثواني"
            />
            <span>s</span>
          </div>

          {/* Frame Counter with direct input */}
          <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 text-slate-300">
            <span className="text-[10px] text-slate-500">FRAME</span>
            <input
              type="number"
              min={0}
              max={totalFrames - 1}
              value={currentFrame}
              onChange={(e) => onSeekFrame(Math.max(0, Math.min(totalFrames - 1, parseInt(e.target.value) || 0)))}
              className="w-10 bg-slate-900 border border-indigo-500/50 rounded px-1 text-center text-xs text-indigo-400 font-bold outline-none"
            />
            <span className="text-slate-500">/ {totalFrames - 1}</span>
          </div>

          <span className="text-[11px] font-bold text-slate-500 px-2 py-0.5 bg-black/40 rounded border border-white/5">
            {fps} FPS
          </span>

          {/* Timeline Zoom & Collapse Controls */}
          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <button
              onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.25))}
              className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              title="تصغير عرض المسارات (Zoom Out Tracks)"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[10px] font-mono text-slate-400 font-bold min-w-[28px] text-center">
              {Math.round(timelineZoom * 100)}%
            </span>
            <button
              onClick={() => setTimelineZoom(Math.min(3, timelineZoom + 0.25))}
              className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              title="تكبير عرض المسارات (Zoom In Tracks)"
            >
              <ZoomIn size={13} />
            </button>

            <div className="h-4 w-px bg-white/10 mx-0.5" />

            <button
              onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
              className={`p-1.5 rounded-lg border text-xs transition-all flex items-center gap-1 font-bold cursor-pointer ${
                isTimelineCollapsed 
                  ? 'bg-indigo-600/40 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/60' 
                  : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
              }`}
              title={isTimelineCollapsed ? "توسيع الخط الزمني للتحريك (Expand Timeline)" : "تصغير/طي الخط الزمني (Minimize Timeline)"}
            >
              {isTimelineCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span className="text-[10px] hidden sm:inline">{isTimelineCollapsed ? 'توسيع' : 'تصغير'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED MOTION TRACKS CONTAINER OR MINI SCRUBBER */}
      {!isTimelineCollapsed ? (
        <div className="flex h-56 relative overflow-hidden">
        {/* LEFT COLUMN: TRACK HEADERS & CONTROLS (WIDTH: 310px) */}
        <div className="w-[310px] bg-slate-950/95 border-r border-white/10 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          {/* Top ruler header with View Mode toggle */}
          <div className="h-7 border-b border-white/10 px-2 flex items-center justify-between text-[11px] font-bold text-slate-400 bg-black/30">
            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
              <button
                onClick={() => setTimelineViewMode('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  timelineViewMode === 'all'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض جميع المسارات (Multi-Track) لتحديد مدة ظهور الملف المضاف بالشريط الأحمر"
              >
                <Layers size={11} />
                <span>كافة المسارات</span>
              </button>
              <button
                onClick={() => setTimelineViewMode('selected')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  timelineViewMode === 'selected'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="عرض مسارات التحريك التفصيلية للطبقة المحددة"
              >
                <SlidersHorizontal size={11} />
                <span>الطبقة المحددة</span>
              </button>
            </div>
            {selectedLayer && (
              <span className="text-[10px] text-indigo-400 font-mono">F{currentFrame}</span>
            )}
          </div>

          {timelineViewMode === 'all' ? (
            /* Multi-Track Layers List */
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar divide-y divide-white/5">
              {layers.map((layer) => {
                const isSelected = selectedLayer?.id === layer.id;
                const inF = layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0);
                const outF = layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (totalFrames - 1));
                const trackCol = layer.trackColor || '#ef4444';
                const isColorOpen = showColorPickerForLayer === layer.id;

                return (
                  <div
                    key={layer.id}
                    onClick={() => onSelectLayer(layer.id)}
                    className={`h-9 px-2.5 flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-950/40' : 'bg-slate-950/40 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {/* Track Color swatch / popup */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPickerForLayer(isColorOpen ? null : layer.id);
                          }}
                          className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm shrink-0 hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: trackCol }}
                          title="تغيير لون شريط المسار في الخط الزمني"
                        />
                        {isColorOpen && (
                          <div 
                            className="absolute left-0 top-full mt-1 bg-slate-900 border border-white/20 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1 w-44"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] font-bold text-slate-300 mb-1 px-1">لون شريط المسار:</div>
                            {TRACK_COLORS.map(c => (
                              <button
                                key={c.value}
                                onClick={() => {
                                  onUpdateLayerTimeRange?.(layer.id, inF, outF, c.value, true);
                                  setShowColorPickerForLayer(null);
                                }}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 text-[11px] text-white transition-colors text-right"
                              >
                                <span className="w-3 h-3 rounded-full shrink-0 border border-white/30" style={{ backgroundColor: c.value }} />
                                <span className="flex-1 truncate">{c.label}</span>
                                {trackCol === c.value && <Check size={12} className="text-emerald-400 shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-5 h-5 rounded bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {layer.thumbnailUrl ? (
                          <img src={layer.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Film size={11} className="text-slate-400" />
                        )}
                      </div>

                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`} title={layer.name}>
                        {layer.name}
                      </span>
                    </div>

                    {/* Quick In/Out bounds buttons & badge */}
                    <div className="flex items-center gap-1 shrink-0 font-mono text-[9px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIn = Math.min(outF - 1, currentFrame);
                          onUpdateLayerTimeRange?.(layer.id, newIn, outF, undefined, true);
                        }}
                        className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white border border-white/10"
                        title={`ضبط بداية الظهور عند الفريم الحالي (F${currentFrame})`}
                      >
                        [In]
                      </button>
                      <span className="text-red-400 font-semibold" title={`من فريم ${inF} إلى فريم ${outF}`}>
                        F{inF}→{outF}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newOut = Math.max(inF + 1, currentFrame);
                          onUpdateLayerTimeRange?.(layer.id, inF, newOut, undefined, true);
                        }}
                        className="px-1 py-0.5 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white border border-white/10"
                        title={`ضبط نهاية الظهور عند الفريم الحالي (F${currentFrame})`}
                      >
                        [Out]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : selectedLayer ? (
            <div className="flex-1 flex flex-col">
              {/* Main Selected Layer Row */}
              <div className="h-9 px-2.5 bg-indigo-950/30 border-b border-indigo-500/20 flex items-center justify-between group">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button 
                    onClick={handleToggleExpand}
                    className="p-1 hover:text-white text-indigo-400 transition-colors"
                  >
                    {isMotionExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
                  </button>

                  {/* Thumbnail / Type Icon */}
                  <div className="w-5 h-5 rounded bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    {selectedLayer.thumbnailUrl ? (
                      <img src={selectedLayer.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Film size={11} className="text-indigo-400" />
                    )}
                  </div>

                  <span className="font-black text-xs text-white truncate" title={selectedLayer.name}>
                    {selectedLayer.name}
                  </span>
                </div>

                {/* Layer Keyframe "+" Dropdown Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    className="p-1 hover:bg-white/15 text-indigo-300 hover:text-white rounded-md transition-colors flex items-center gap-0.5 text-[10px] font-bold bg-indigo-600/30 border border-indigo-500/30"
                    title="إضافة حركة / فريم رئيسي (Add Motion / Keyframe)"
                  >
                    <Plus size={12} />
                    <span>تحريك</span>
                  </button>

                  {/* Motion Action Menu */}
                  {showAddMenu && (
                    <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-white/15 rounded-xl shadow-2xl p-1.5 z-50 text-right space-y-1 backdrop-blur-xl" dir="rtl">
                      <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase border-b border-white/5">
                        إضافة فريم تحريك (Add Keyframe):
                      </div>
                      
                      <button
                        onClick={() => handleAddKeyframe('all')}
                        className="w-full px-2.5 py-1.5 hover:bg-white/10 text-white rounded-lg text-xs flex items-center justify-between transition-colors font-bold"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={12} className="text-amber-400" />
                          <span>تحريك شامل (Transform كامل)</span>
                        </span>
                        <Diamond size={11} className="text-indigo-400 fill-indigo-400" />
                      </button>

                      <button
                        onClick={() => handleAddKeyframe('position')}
                        className="w-full px-2.5 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Move size={12} className="text-indigo-400" />
                          <span>فريم موضع (Position X, Y)</span>
                        </span>
                        <Diamond size={11} className="text-indigo-400 fill-indigo-400" />
                      </button>

                      <button
                        onClick={() => handleAddKeyframe('scale')}
                        className="w-full px-2.5 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Maximize2 size={12} className="text-emerald-400" />
                          <span>فريم تكبير (Scale X, Y)</span>
                        </span>
                        <Diamond size={11} className="text-emerald-400 fill-emerald-400" />
                      </button>

                      <button
                        onClick={() => handleAddKeyframe('rotation')}
                        className="w-full px-2.5 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <RotateCw size={12} className="text-purple-400" />
                          <span>فريم تدوير (Rotation Deg)</span>
                        </span>
                        <Diamond size={11} className="text-purple-400 fill-purple-400" />
                      </button>

                      <button
                        onClick={() => handleAddKeyframe('opacity')}
                        className="w-full px-2.5 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sun size={12} className="text-amber-400" />
                          <span>فريم شفافية (Opacity %)</span>
                        </span>
                        <Diamond size={11} className="text-amber-400 fill-amber-400" />
                      </button>

                      <div className="border-t border-white/10 pt-1 mt-1">
                        <div className="px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                          إظهار / إخفاء المسارات:
                        </div>
                        <button
                          onClick={() => handleToggleTrackConfig('showPosition')}
                          className="w-full px-2.5 py-1 hover:bg-white/10 text-slate-300 rounded text-[11px] flex items-center justify-between"
                        >
                          <span>مسار الموضع (Position)</span>
                          {motionConfig.showPosition ? <Eye size={11} className="text-indigo-400" /> : <Eye size={11} className="text-slate-600" />}
                        </button>
                        <button
                          onClick={() => handleToggleTrackConfig('showScale')}
                          className="w-full px-2.5 py-1 hover:bg-white/10 text-slate-300 rounded text-[11px] flex items-center justify-between"
                        >
                          <span>مسار الحجم (Scale)</span>
                          {motionConfig.showScale ? <Eye size={11} className="text-emerald-400" /> : <Eye size={11} className="text-slate-600" />}
                        </button>
                        <button
                          onClick={() => handleToggleTrackConfig('showRotation')}
                          className="w-full px-2.5 py-1 hover:bg-white/10 text-slate-300 rounded text-[11px] flex items-center justify-between"
                        >
                          <span>مسار التدوير (Rotation)</span>
                          {motionConfig.showRotation ? <Eye size={11} className="text-purple-400" /> : <Eye size={11} className="text-slate-600" />}
                        </button>
                        <button
                          onClick={() => handleToggleTrackConfig('showOpacity')}
                          className="w-full px-2.5 py-1 hover:bg-white/10 text-slate-300 rounded text-[11px] flex items-center justify-between"
                        >
                          <span>مسار الشفافية (Opacity)</span>
                          {motionConfig.showOpacity ? <Eye size={11} className="text-amber-400" /> : <Eye size={11} className="text-slate-600" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Tracks (Position, Scale, Rotation, Opacity) */}
              {isMotionExpanded && (
                <div className="flex flex-col text-[11px] font-mono">
                  {/* Track 1: Transform (Main) */}
                  <div className="h-8 px-3 border-b border-white/5 flex items-center justify-between bg-slate-900/40 text-slate-300">
                    <span className="font-bold text-slate-400 flex items-center gap-1.5 pl-4">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>Transform</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyAllKeyframes}
                        className="p-1 hover:text-indigo-300 text-slate-500"
                        title="نسخ جميع فريمات الحركة للطبقة"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={handlePasteKeyframes}
                        className={`p-1 ${clipboardKeyframes.length > 0 ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-700 cursor-not-allowed'}`}
                        title="لصق فريمات الحركة بدءاً من الفريم الحالي"
                        disabled={clipboardKeyframes.length === 0}
                      >
                        <ClipboardPaste size={11} />
                      </button>
                      <div className="h-3 w-px bg-white/10 mx-1"></div>
                      <button
                        onClick={() => handleAddKeyframe('all')}
                        className="p-1 hover:text-indigo-300 text-slate-500"
                        title="إضافة فريم تحويل رئيسي"
                      >
                        <Diamond size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Track 2: Position (X, Y) */}
                  {motionConfig.showPosition && (
                    <div className="h-8 px-3 border-b border-white/5 flex items-center justify-between bg-slate-900/20 text-slate-300">
                      <span className="font-semibold text-slate-400 flex items-center gap-1.5 pl-4">
                        <Move size={11} className="text-indigo-400" />
                        <span>Position</span>
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-500">X:</span>
                        <input
                          type="number"
                          value={Math.round(currentAnimatedTransform?.x || 0)}
                          onChange={(e) => handleLivePropChange('x', parseFloat(e.target.value) || 0)}
                          className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-white"
                        />
                        <span className="text-slate-500">Y:</span>
                        <input
                          type="number"
                          value={Math.round(currentAnimatedTransform?.y || 0)}
                          onChange={(e) => handleLivePropChange('y', parseFloat(e.target.value) || 0)}
                          className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-white"
                        />
                        <button
                          onClick={() => handleAddKeyframe('position')}
                          className="p-1 hover:text-indigo-300 text-slate-500"
                          title="إضافة فريم موضع"
                        >
                          <Diamond size={11} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Track 3: Scale (تكبير وتصغير) with dedicated keyframe points and controls */}
                  {motionConfig.showScale && (
                    <div className="h-[128px] p-2.5 border-b border-white/5 flex flex-col justify-between bg-emerald-950/10 text-slate-300">
                      {/* Header Row: Title, Keyframe Counter, Navigation, Add/Delete Keyframe */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 pl-2">
                          <Maximize2 size={13} className="text-emerald-400 shrink-0" />
                          <span className="font-bold text-xs text-white">تكبير وتصغير (Scale)</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            {scaleKeyframes.length} نقطة
                          </span>
                        </div>

                        {/* Keyframe Jump & Add/Remove Action */}
                        <div className="flex items-center gap-1">
                          {scaleKeyframes.length > 0 && (
                            <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                              <button
                                type="button"
                                onClick={handleJumpPrevScaleKf}
                                disabled={!scaleKeyframes.some(k => k.frame < currentFrame)}
                                className="p-1 hover:text-emerald-300 disabled:opacity-30 disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                                title="الانتقال إلى نقطة التكبير السابقة"
                              >
                                <ChevronRight size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={handleJumpNextScaleKf}
                                disabled={!scaleKeyframes.some(k => k.frame > currentFrame)}
                                className="p-1 hover:text-emerald-300 disabled:opacity-30 disabled:hover:text-slate-500 text-slate-400 cursor-pointer"
                                title="الانتقال إلى نقطة التكبير التالية"
                              >
                                <ChevronLeft size={12} />
                              </button>
                            </div>
                          )}

                          {currentScaleKf ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteKeyframe(currentScaleKf.id)}
                              className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                              title="حذف نقطة تحريك التكبير في هذا الفريم"
                            >
                              <Diamond size={10} className="fill-red-400 text-red-400" />
                              <span>نقطة بـ F{currentFrame} (حذف)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddKeyframe('scale')}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-600/30 border border-emerald-400/50 active:scale-95"
                              title="إضافة نقطة تحريك تكبير/تصغير في الفريم الحالي"
                            >
                              <Diamond size={10} className="fill-white text-white" />
                              <span>+ نقطة تكبير (F{currentFrame})</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inputs & Aspect Lock & Slider */}
                      <div className="space-y-1 mt-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">عرض:</span>
                            <input
                              type="number"
                              value={Math.round((currentAnimatedTransform?.scaleX || 1) * 100)}
                              onChange={(e) => {
                                const val = (parseFloat(e.target.value) || 100) / 100;
                                handleLivePropChange('scaleX', val);
                                if (scaleAspectLocked) handleLivePropChange('scaleY', val);
                              }}
                              className="w-11 bg-black/60 border border-white/10 rounded px-1 text-center text-white font-mono text-[11px]"
                            />
                            <span className="text-slate-500">%</span>

                            <button
                              type="button"
                              onClick={() => setScaleAspectLocked(!scaleAspectLocked)}
                              className={`p-1 rounded transition-colors ${
                                scaleAspectLocked ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-500 hover:text-slate-300'
                              }`}
                              title={scaleAspectLocked ? 'تناسب الأبعاد مقفل (متساوي)' : 'تناسب الأبعاد حر'}
                            >
                              {scaleAspectLocked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>

                            <span className="text-slate-400 font-bold">ارتفاع:</span>
                            <input
                              type="number"
                              value={Math.round((currentAnimatedTransform?.scaleY !== undefined ? currentAnimatedTransform.scaleY : 1) * 100)}
                              onChange={(e) => {
                                const val = (parseFloat(e.target.value) || 0) / 100;
                                handleLivePropChange('scaleY', Math.max(0, val));
                                if (scaleAspectLocked) handleLivePropChange('scaleX', Math.max(0, val));
                              }}
                              className="w-11 bg-black/60 border border-white/10 rounded px-1 text-center text-white font-mono text-[11px]"
                            />
                            <span className="text-slate-500">%</span>
                          </div>

                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {Math.round(Math.abs(currentAnimatedTransform?.scaleX !== undefined ? currentAnimatedTransform.scaleX : 1) * 100)}%
                          </span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="350"
                          value={Math.round(Math.abs(currentAnimatedTransform?.scaleX !== undefined ? currentAnimatedTransform.scaleX : 1) * 100)}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0) / 100;
                            handleLivePropChange('scaleX', val);
                            if (scaleAspectLocked) handleLivePropChange('scaleY', val);
                          }}
                          className="w-full accent-emerald-500 cursor-pointer h-1.5"
                        />
                      </div>

                      {/* Quick Presets with direct keyframe recording */}
                      <div className="flex items-center gap-1 w-full mt-1">
                        {[0, 25, 50, 75, 100, 150, 200, 300].map(p => {
                          const isCurrent = Math.round(Math.abs(currentAnimatedTransform?.scaleX !== undefined ? currentAnimatedTransform.scaleX : 1) * 100) === p;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                const sc = p / 100;
                                handleLivePropChange('scaleX', sc);
                                handleLivePropChange('scaleY', sc);
                                handleAddKeyframe('scale', { scaleX: sc, scaleY: sc });
                              }}
                              className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-all active:scale-95 cursor-pointer ${
                                isCurrent
                                  ? 'bg-emerald-600 text-white font-black shadow-sm'
                                  : 'bg-white/5 hover:bg-emerald-500/20 text-slate-300 border border-white/5'
                              }`}
                              title={`تعيين الحجم إلى ${p}% وتسجيل نقطة تحريك في الفريم الحالي`}
                            >
                              {p}%
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Track 4: Rotation */}
                  {motionConfig.showRotation && (
                    <div className="h-8 px-3 border-b border-white/5 flex items-center justify-between bg-slate-900/20 text-slate-300">
                      <span className="font-semibold text-slate-400 flex items-center gap-1.5 pl-4">
                        <RotateCw size={11} className="text-purple-400" />
                        <span>Rotation</span>
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <input
                          type="number"
                          value={Math.round(currentAnimatedTransform?.rotation || 0)}
                          onChange={(e) => handleLivePropChange('rotation', parseFloat(e.target.value) || 0)}
                          className="w-11 bg-black/40 border border-white/10 rounded px-1 text-center text-white"
                        />
                        <span className="text-slate-500">°</span>
                        <button
                          onClick={() => handleAddKeyframe('rotation')}
                          className="p-1 hover:text-purple-300 text-slate-500"
                          title="إضافة فريم تدوير"
                        >
                          <Diamond size={11} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Track 5: Opacity */}
                  {motionConfig.showOpacity && (
                    <div className="h-8 px-3 border-b border-white/5 flex items-center justify-between bg-slate-900/20 text-slate-300">
                      <span className="font-semibold text-slate-400 flex items-center gap-1.5 pl-4">
                        <Sun size={11} className="text-amber-400" />
                        <span>Opacity</span>
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Math.round(currentAnimatedTransform?.opacity !== undefined ? currentAnimatedTransform.opacity : 100)}
                          onChange={(e) => handleLivePropChange('opacity', Math.max(0, Math.min(100, parseFloat(e.target.value) || 100)))}
                          className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-white"
                        />
                        <span className="text-slate-500">%</span>
                        <button
                          onClick={() => handleAddKeyframe('opacity')}
                          className="p-1 hover:text-amber-300 text-slate-500"
                          title="إضافة فريم شفافية"
                        >
                          <Diamond size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-slate-600 text-xs flex flex-col items-center justify-center flex-1 gap-2">
              <Film size={20} className="text-slate-700" />
              <span>حدد أي طبقة لفتح مسارات التحريك الخاصة بها</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TIMELINE RULER & KEYFRAME DIAMOND TRACKS */}
        <div 
          ref={timelineTracksRef}
          className="flex-1 bg-[#050811] flex flex-col overflow-x-auto relative custom-scrollbar"
        >
          {/* Top Time Ruler Bar */}
          <div
            ref={rulerRef}
            onClick={handleTimelineRulerClick}
            className="h-7 border-b border-white/10 bg-slate-950/80 relative cursor-pointer flex items-center shrink-0 overflow-hidden"
          >
            {/* Ruler Time/Frame Ticks */}
            {renderRulerTicks()}

            {/* Playhead Marker Pin at Ruler */}
            <div
              className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex flex-col items-center z-30 cursor-ew-resize"
              style={{ left: `${playheadPct}%` }}
              onMouseDown={handleScrubberMouseDown}
            >
              <div className="w-3 h-3 bg-indigo-500 rotate-45 rounded-xs shadow-md border border-white" />
              <div className="w-0.5 flex-1 bg-indigo-500" />
            </div>
          </div>

          {/* Keyframe Tracks Body */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {/* Playhead vertical line through all tracks */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-indigo-500/80 z-20 pointer-events-none shadow-lg shadow-indigo-500"
              style={{ left: `${playheadPct}%` }}
            />

            {timelineViewMode === 'all' ? (
              /* Multi-Track view with individual draggable bars for every layer */
              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                {layers.map((layer) => (
                  renderSpanBar(layer, selectedLayer?.id === layer.id, 'h-9')
                ))}
              </div>
            ) : selectedLayer ? (
              <div className="flex-1 flex flex-col">
                {/* 1. Main Layer Timeline Span Bar (Draggable In/Out bounds & entire span) */}
                {renderSpanBar(selectedLayer, true, 'h-9')}

                {/* Expanded Tracks Keyframe Diamonds */}
                {isMotionExpanded && (
                  <div className="flex flex-col">
                    {/* Track 1: Transform Keyframes */}
                    <div 
                      className="h-8 border-b border-white/5 relative flex items-center bg-slate-900/30 hover:bg-white/5 transition-colors cursor-crosshair"
                      onDoubleClick={(e) => {
                        handleTimelineRulerClick(e as any);
                        handleAddKeyframe('all');
                      }}
                    >
                      {/* Render Diamonds for all keyframes */}
                      {selectedLayer.keyframes?.map((kf) => {
                        const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                        const isSelected = selectedKeyframeId === kf.id;
                        return (
                          <div
                            key={kf.id}
                            onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                            className={`absolute -translate-x-1/2 cursor-pointer z-30 transition-transform ${
                              isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                            }`}
                            style={{ left: `${pct}%` }}
                            title={`Transform Keyframe: F${kf.frame} (${(kf.frame / fps).toFixed(2)}s)`}
                          >
                            <div className={`w-3.5 h-3.5 rotate-45 rounded-xs shadow-md border ${
                              isSelected 
                                ? 'bg-amber-400 border-white ring-2 ring-amber-400/50' 
                                : 'bg-indigo-500 border-indigo-200'
                            }`} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Track 2: Position Keyframes */}
                    {motionConfig.showPosition && (
                      <div 
                        className="h-8 border-b border-white/5 relative flex items-center bg-slate-900/10 hover:bg-white/5 transition-colors cursor-crosshair"
                        onDoubleClick={(e) => {
                          handleTimelineRulerClick(e as any);
                          handleAddKeyframe('position');
                        }}
                      >
                        {selectedLayer.keyframes?.filter(k => k.x !== undefined || k.y !== undefined).map((kf) => {
                          const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                          const isSelected = selectedKeyframeId === kf.id;
                          return (
                            <div
                              key={kf.id}
                              onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                              className={`absolute -translate-x-1/2 cursor-pointer z-30 transition-transform ${
                                isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                              }`}
                              style={{ left: `${pct}%` }}
                              title={`Position Keyframe: F${kf.frame} (X: ${Math.round(kf.x || 0)}, Y: ${Math.round(kf.y || 0)})`}
                            >
                              <div className={`w-3 h-3 rotate-45 rounded-xs shadow-md border ${
                                isSelected ? 'bg-indigo-400 border-white' : 'bg-indigo-600 border-indigo-300'
                              }`} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Track 3: Scale Keyframes Track */}
                    {motionConfig.showScale && (
                      <div 
                        className="h-[128px] border-b border-white/5 relative flex items-center bg-slate-900/15 hover:bg-white/5 transition-colors cursor-crosshair overflow-hidden"
                        onDoubleClick={(e) => {
                          handleTimelineRulerClick(e as any);
                          handleAddKeyframe('scale');
                        }}
                        title="انقر نقراً مزدوجاً لإضافة نقطة تحريك تكبير/تصغير في هذا الفريم"
                      >
                        {/* Background guide line */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/5 pointer-events-none" />
                        
                        {/* Connecting animation trajectory line between scale points */}
                        {scaleKeyframes.length >= 2 && (
                          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-30" preserveAspectRatio="none">
                            <polyline
                              points={scaleKeyframes.map(k => {
                                const pct = (k.frame / (totalFrames - 1 || 1)) * 100;
                                const sc = Math.min(3.5, Math.max(0, Math.abs(k.scaleX !== undefined ? k.scaleX : 1)));
                                const y = 95 - (sc / 3.5) * 70;
                                return `${pct}%,${y}`;
                              }).join(' ')}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              strokeDasharray="4 3"
                            />
                          </svg>
                        )}

                        {/* Scale Keyframe Nodes */}
                        {scaleKeyframes.map((kf) => {
                          const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                          const isSelected = selectedKeyframeId === kf.id;
                          const isAtPlayhead = kf.frame === currentFrame;
                          const scVal = Math.round(Math.abs(kf.scaleX !== undefined ? kf.scaleX : 1) * 100);

                          return (
                            <div
                              key={kf.id}
                              onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSeekFrame(kf.frame);
                                setSelectedKeyframeId(kf.id);
                              }}
                              className={`absolute -translate-x-1/2 cursor-pointer z-30 flex flex-col items-center group/kf transition-transform ${
                                isSelected || isAtPlayhead ? 'scale-125 z-40' : 'hover:scale-115'
                              }`}
                              style={{ left: `${pct}%`, top: '22px' }}
                              title={`نقطة تحريك تكبير: فريم ${kf.frame} (${(kf.frame / fps).toFixed(2)} ث) | الحجم: ${scVal}%`}
                            >
                              {/* Diamond Node */}
                              <div className={`w-4 h-4 rotate-45 rounded-xs shadow-lg transition-all flex items-center justify-center border ${
                                isSelected 
                                  ? 'bg-emerald-400 border-white ring-2 ring-emerald-400/60 shadow-emerald-500/50' 
                                  : isAtPlayhead
                                  ? 'bg-emerald-500 border-white shadow-emerald-500/40'
                                  : 'bg-emerald-600 border-emerald-300/80 hover:bg-emerald-500'
                              }`}>
                                <div className="w-1.5 h-1.5 bg-white/70 rounded-full pointer-events-none" />
                              </div>

                              {/* Scale Label pill underneath */}
                              <div className={`mt-1.5 px-1 py-0.2 rounded text-[9px] font-mono font-black tracking-tight whitespace-nowrap shadow-sm border transition-all ${
                                isSelected || isAtPlayhead
                                  ? 'bg-emerald-950 text-emerald-200 border-emerald-400'
                                  : 'bg-black/70 text-slate-300 border-white/10 group-hover/kf:text-emerald-300 group-hover/kf:border-emerald-500/50'
                              }`}>
                                {scVal}%
                              </div>

                              {/* Quick Delete on hover */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteKeyframe(kf.id);
                                }}
                                className="opacity-0 group-hover/kf:opacity-100 p-0.5 mt-0.5 bg-red-600 hover:bg-red-500 text-white rounded-full transition-opacity cursor-pointer shadow-md"
                                title="حذف نقطة التكبير هذه"
                              >
                                <Trash2 size={9} />
                              </button>
                            </div>
                          );
                        })}

                        {scaleKeyframes.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] text-slate-500 font-bold">
                            + انقر نقراً مزدوجاً في أي مكان هنا لإضافة نقطة تحريك تكبير
                          </div>
                        )}
                      </div>
                    )}

                    {/* Track 4: Rotation Keyframes */}
                    {motionConfig.showRotation && (
                      <div 
                        className="h-8 border-b border-white/5 relative flex items-center bg-slate-900/10 hover:bg-white/5 transition-colors cursor-crosshair"
                        onDoubleClick={(e) => {
                          handleTimelineRulerClick(e as any);
                          handleAddKeyframe('rotation');
                        }}
                      >
                        {selectedLayer.keyframes?.filter(k => k.rotation !== undefined).map((kf) => {
                          const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                          const isSelected = selectedKeyframeId === kf.id;
                          return (
                            <div
                              key={kf.id}
                              onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                              className={`absolute -translate-x-1/2 cursor-pointer z-30 transition-transform ${
                                isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                              }`}
                              style={{ left: `${pct}%` }}
                              title={`Rotation Keyframe: F${kf.frame} (${Math.round(kf.rotation || 0)}°)`}
                            >
                              <div className={`w-3 h-3 rotate-45 rounded-xs shadow-md border ${
                                isSelected ? 'bg-purple-400 border-white' : 'bg-purple-600 border-purple-300'
                              }`} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Track 5: Opacity Keyframes */}
                    {motionConfig.showOpacity && (
                      <div 
                        className="h-8 border-b border-white/5 relative flex items-center bg-slate-900/10 hover:bg-white/5 transition-colors cursor-crosshair"
                        onDoubleClick={(e) => {
                          handleTimelineRulerClick(e as any);
                          handleAddKeyframe('opacity');
                        }}
                      >
                        {selectedLayer.keyframes?.filter(k => k.opacity !== undefined).map((kf) => {
                          const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                          const isSelected = selectedKeyframeId === kf.id;
                          return (
                            <div
                              key={kf.id}
                              onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                              className={`absolute -translate-x-1/2 cursor-pointer z-30 transition-transform ${
                                isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                              }`}
                              style={{ left: `${pct}%` }}
                              title={`Opacity Keyframe: F${kf.frame} (${Math.round(kf.opacity || 100)}%)`}
                            >
                              <div className={`w-3 h-3 rotate-45 rounded-xs shadow-md border ${
                                isSelected ? 'bg-amber-400 border-white' : 'bg-amber-600 border-amber-300'
                              }`} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5 p-6">
                <span>حدد طبقة من القائمة لعرض مسارها أو اختر "كافة المسارات" في الأعلى</span>
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        /* Mini Scrubber Track when collapsed */
        <div 
          className="h-3 bg-slate-950 hover:bg-slate-900 border-t border-white/5 transition-all cursor-pointer relative px-4 flex items-center"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeekFrame(Math.round(pct * (totalFrames - 1)));
          }}
        >
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all"
              style={{ width: `${playheadPct}%` }}
            />
          </div>
          <div 
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-indigo-600 shadow-md shadow-indigo-500 pointer-events-none"
            style={{ left: `${playheadPct}%` }}
          />
        </div>
      )}

      {/* 3. FLOATING KEYFRAME BEZIER & EASING INSPECTOR MODAL */}
      {selectedKeyframe && (
        <div className="absolute right-6 bottom-24 z-50 w-96 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <KeyframeEasingPanel
            keyframe={selectedKeyframe}
            totalFrames={totalFrames}
            fps={fps}
            onUpdateKeyframe={handleUpdateKeyframeDetails}
            onDeleteKeyframe={handleDeleteKeyframe}
            onClose={() => setSelectedKeyframeId(null)}
          />
        </div>
      )}
    </div>
  );
};
