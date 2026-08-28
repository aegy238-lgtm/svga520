import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditableLayer, LayerKeyframe, MotionTracksConfig } from './types';
import { 
  Play, Pause, SkipBack, SkipForward, RotateCcw, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronRight as ChevronRightIcon,
  Plus, Diamond, Sliders, Trash2, Eye, Move, Maximize2, Minimize2, RotateCw, 
  Sun, Clock, Film, Sparkles, SlidersHorizontal, Settings2, MoreVertical, ZoomIn, ZoomOut, Copy, ClipboardPaste
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
  onSelectLayer: (id: string) => void;
  onTogglePlay: () => void;
  onStepFrame: (delta: number) => void;
  onSeekFrame: (frame: number) => void;
  onToggleLoop: () => void;
  onUpdateLayerTransform: (layerId: string, transform: Partial<EditableLayer['transform']>) => void;
  onUpdateLayerKeyframes: (layerId: string, keyframes: LayerKeyframe[]) => void;
  onUpdateProjectDuration?: (seconds: number) => void;
}

export const SvgaMotionTimeline: React.FC<SvgaMotionTimelineProps> = ({
  totalFrames,
  currentFrame,
  fps,
  isPlaying,
  isLoop,
  selectedLayer,
  layers,
  onSelectLayer,
  onTogglePlay,
  onStepFrame,
  onSeekFrame,
  onToggleLoop,
  onUpdateLayerTransform,
  onUpdateLayerKeyframes,
  onUpdateProjectDuration
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

  // Add Keyframe for specific property or all
  const handleAddKeyframe = (type: 'all' | 'position' | 'scale' | 'rotation' | 'opacity') => {
    if (!selectedLayer) return;
    const cur = currentAnimatedTransform || selectedLayer.transform;

    let partial: Partial<EditableLayer['transform']> = {};
    if (type === 'all' || type === 'position') {
      partial.x = cur.x;
      partial.y = cur.y;
    }
    if (type === 'all' || type === 'scale') {
      partial.scaleX = cur.scaleX;
      partial.scaleY = cur.scaleY;
    }
    if (type === 'all' || type === 'rotation') {
      partial.rotation = cur.rotation;
    }
    if (type === 'all' || type === 'opacity') {
      partial.opacity = cur.opacity;
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
          {/* Top ruler header placeholder */}
          <div className="h-7 border-b border-white/10 px-3 flex items-center justify-between text-[11px] font-bold text-slate-400 bg-black/30">
            <span>الطبقات والمسارات (Tracks)</span>
            {selectedLayer && (
              <span className="text-[10px] text-indigo-400 font-mono">F0 → F{totalFrames - 1}</span>
            )}
          </div>

          {selectedLayer ? (
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

                  {/* Track 3: Scale (ScaleX, ScaleY) */}
                  {motionConfig.showScale && (
                    <div className="h-[88px] p-3 border-b border-white/5 flex flex-col justify-between bg-slate-900/20 text-slate-300">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-slate-400 flex items-center gap-1.5 pl-4">
                          <Maximize2 size={11} className="text-emerald-400" />
                          <span>Scale</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-slate-500">SX:</span>
                          <input
                            type="number"
                            value={Math.round((currentAnimatedTransform?.scaleX || 1) * 100)}
                            onChange={(e) => handleLivePropChange('scaleX', (parseFloat(e.target.value) || 100) / 100)}
                            className="w-10 bg-black/40 border border-white/10 rounded px-1 text-center text-white"
                          />
                          <span className="text-slate-500">%</span>
                          <button
                            onClick={() => handleAddKeyframe('scale')}
                            className="p-1 hover:text-emerald-300 text-slate-500"
                            title="إضافة فريم تكبير"
                          >
                            <Diamond size={11} />
                          </button>
                        </div>
                      </div>

                      <input
                        type="range"
                        min="10"
                        max="300"
                        value={Math.round(Math.abs(currentAnimatedTransform?.scaleX || 1) * 100)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) / 100;
                          handleLivePropChange('scaleX', val);
                          handleLivePropChange('scaleY', val);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer h-1.5 mt-1"
                      />

                      <div className="flex items-center justify-between gap-1 w-full mt-1.5">
                        {[50, 75, 100, 150, 200].map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              handleLivePropChange('scaleX', p / 100);
                              handleLivePropChange('scaleY', p / 100);
                            }}
                            className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors ${
                              Math.round(Math.abs(currentAnimatedTransform?.scaleX || 1) * 100) === p
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-white/5 hover:bg-white/10 text-slate-400'
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
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

            {selectedLayer && (
              <div className="flex-1 flex flex-col">
                {/* 1. Main Layer Timeline Span Bar */}
                <div className="h-9 border-b border-indigo-500/10 relative flex items-center bg-slate-900/10">
                  {/* Layer Span Rectangle */}
                  <div
                    className="absolute h-5 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 rounded-lg pointer-events-none"
                    style={{
                      left: `${(selectedLayer.keyframeSummary.startFrame / (totalFrames - 1 || 1)) * 100}%`,
                      width: `${((selectedLayer.keyframeSummary.endFrame - selectedLayer.keyframeSummary.startFrame + 1) / (totalFrames - 1 || 1)) * 100}%`
                    }}
                  />
                </div>

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

                    {/* Track 3: Scale Keyframes */}
                    {motionConfig.showScale && (
                      <div 
                        className="h-[88px] border-b border-white/5 relative flex items-start pt-[14px] bg-slate-900/10 hover:bg-white/5 transition-colors cursor-crosshair"
                        onDoubleClick={(e) => {
                          handleTimelineRulerClick(e as any);
                          handleAddKeyframe('scale');
                        }}
                      >
                        {selectedLayer.keyframes?.filter(k => k.scaleX !== undefined || k.scaleY !== undefined).map((kf) => {
                          const pct = (kf.frame / (totalFrames - 1 || 1)) * 100;
                          const isSelected = selectedKeyframeId === kf.id;
                          return (
                            <div
                              key={kf.id}
                              onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                              className={`absolute -translate-x-1/2 cursor-pointer z-30 transition-transform ${
                                isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                              }`}
                              style={{ left: `${pct}%`, top: '14px' }}
                              title={`Scale Keyframe: F${kf.frame}`}
                            >
                              <div className={`w-3 h-3 rotate-45 rounded-xs shadow-md border ${
                                isSelected ? 'bg-emerald-400 border-white' : 'bg-emerald-600 border-emerald-300'
                              }`} />
                            </div>
                          );
                        })}
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
