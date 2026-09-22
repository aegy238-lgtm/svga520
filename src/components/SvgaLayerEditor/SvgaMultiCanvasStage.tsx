import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, Pause, Maximize2, Minimize2, Download, Copy, Trash2, 
  Plus, Layers, Sparkles, Film, Image as ImageIcon, Volume2, 
  VolumeX, Check, LayoutGrid, Columns, Grid2X2, ArrowRightLeft,
  Eye, Sliders, ExternalLink, RefreshCw, Upload, RotateCcw,
  StepBack, StepForward, Focus, Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectSession } from './types';
import { renderSingleProjectFrameDirect } from './svgaProjectRenderer';
import { FadeConfig, CropConfig, CropFeather, getCombinedCssMaskStyle, isTransparencyActive } from './transparencyEngine';

interface SvgaMultiCanvasStageProps {
  projects: ProjectSession[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onFocusProjectSingleView: (id: string) => void;
  onCloseProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onOpenFiles: () => void;
  onOpenMp4Import: () => void;
  onBatchExport: () => void;
  onExportSingleProject: (project: ProjectSession) => void;
  onMergeProjectIntoActive?: (sourceProjId: string) => void;
  onMergeAllProjectsIntoSingleCanvas?: () => void;
  isMasterPlaying: boolean;
  onToggleMasterPlay: () => void;
  masterCurrentFrame: number;
  onFilesDrop?: (files: File[]) => void;
  activeFadeConfig?: FadeConfig;
  activeCropConfig?: CropConfig;
  activeCropFeather?: CropFeather;
}

export const SvgaMultiCanvasStage: React.FC<SvgaMultiCanvasStageProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onFocusProjectSingleView,
  onCloseProject,
  onDuplicateProject,
  onRenameProject,
  onOpenFiles,
  onOpenMp4Import,
  onBatchExport,
  onExportSingleProject,
  onMergeProjectIntoActive,
  onMergeAllProjectsIntoSingleCanvas,
  isMasterPlaying,
  onToggleMasterPlay,
  masterCurrentFrame,
  onFilesDrop,
  activeFadeConfig,
  activeCropConfig,
  activeCropFeather
}) => {
  const [layoutMode, setLayoutMode] = useState<'row' | 'grid' | 'auto'>('auto');
  const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Playback focus mode: 'active_only' (Only active project plays, others pause/time-freeze) or 'all' (Play all synchronized)
  const [playbackFocusMode, setPlaybackFocusMode] = useState<'active_only' | 'all'>('active_only');

  // Local frame map for projects playback and interactive timeline scrubbing
  const [frameMap, setFrameMap] = useState<Record<string, number>>({});
  const [individualPlayingMap, setIndividualPlayingMap] = useState<Record<string, boolean>>({});

  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const frameMapRef = useRef<Record<string, number>>({});
  frameMapRef.current = frameMap;

  // Redraw trigger counter when async assets finish loading
  const [, setForceRenderCounter] = useState(0);
  const triggerCanvasRedraw = useCallback(() => {
    setForceRenderCounter(c => c + 1);
  }, []);

  // Update starting frames when projects list changes
  useEffect(() => {
    setFrameMap(prev => {
      const next = { ...prev };
      projects.forEach(p => {
        if (next[p.id] === undefined) {
          next[p.id] = p.id === activeProjectId ? (masterCurrentFrame || 0) : 0;
        }
      });
      return next;
    });
  }, [projects, activeProjectId, masterCurrentFrame]);

  // Main high-precision animation playback loop
  useEffect(() => {
    if (projects.length === 0) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      let hasAnyPlaying = false;
      const updatedFrames: Record<string, number> = { ...frameMapRef.current };

      projects.forEach(p => {
        const isSelfPlaying = individualPlayingMap[p.id];
        // Determine if this specific project should advance frames
        let shouldPlay = false;
        if (isSelfPlaying !== undefined) {
          shouldPlay = isSelfPlaying;
        } else if (isMasterPlaying) {
          if (playbackFocusMode === 'active_only') {
            shouldPlay = p.id === activeProjectId;
          } else {
            shouldPlay = true;
          }
        }

        if (shouldPlay) {
          hasAnyPlaying = true;
          const fps = Math.max(1, p.project.fps || 30);
          const total = Math.max(1, p.project.totalFrames || 1);
          const currentF = frameMapRef.current[p.id] ?? 0;
          const framesAdvance = deltaSec * fps;
          const nextF = (currentF + framesAdvance) % total;
          updatedFrames[p.id] = nextF;
        }
      });

      if (hasAnyPlaying) {
        setFrameMap(updatedFrames);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isMasterPlaying, playbackFocusMode, activeProjectId, projects, individualPlayingMap]);

  // Sync video elements playback according to playbackFocusMode and individual playing state
  useEffect(() => {
    projects.forEach(p => {
      const video = videoRefs.current[p.id];
      if (!video) return;

      const isSelfPlaying = individualPlayingMap[p.id];
      let shouldPlay = false;
      if (isSelfPlaying !== undefined) {
        shouldPlay = isSelfPlaying;
      } else if (isMasterPlaying) {
        if (playbackFocusMode === 'active_only') {
          shouldPlay = p.id === activeProjectId;
        } else {
          shouldPlay = true;
        }
      }

      if (shouldPlay) {
        if (video.paused) {
          video.play().catch(() => {});
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }
    });
  }, [isMasterPlaying, playbackFocusMode, activeProjectId, projects, individualPlayingMap]);

  // Render current frame instantly for each SVGA project canvas using direct renderer (<1ms per frame, 0 stutter)
  useEffect(() => {
    projects.forEach(p => {
      if (p.fileType === 'mp4' && p.videoUrl) return; // Native video handles rendering via CSS mask

      const canvas = canvasRefs.current[p.id];
      if (!canvas) return;

      const currentRawF = frameMap[p.id] ?? 0;
      const f = Math.floor(currentRawF);
      const isCardActive = p.id === activeProjectId;
      const effFade = isCardActive && activeFadeConfig ? activeFadeConfig : p.fadeConfig;
      const effCrop = isCardActive && activeCropConfig ? activeCropConfig : p.cropConfig;
      const effFeather = isCardActive && activeCropFeather ? activeCropFeather : p.cropFeather;

      renderSingleProjectFrameDirect(
        canvas,
        p.project,
        p.layers,
        f,
        {
          fadeConfig: effFade,
          cropConfig: effCrop,
          cropFeather: effFeather,
          bgColor: p.bgColor,
          onImageLoaded: triggerCanvasRedraw
        }
      );
    });
  }, [projects, frameMap, triggerCanvasRedraw, activeProjectId, activeFadeConfig, activeCropConfig, activeCropFeather]);

  // Individual project frame scrub handler
  const handleSeekProjectFrame = (proj: ProjectSession, frameIndex: number, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    const total = Math.max(1, proj.project.totalFrames || 1);
    const clamped = Math.max(0, Math.min(total - 1, Math.round(frameIndex)));

    setFrameMap(prev => ({ ...prev, [proj.id]: clamped }));

    // If it's a video, seek native video element
    const video = videoRefs.current[proj.id];
    if (video && video.duration > 0) {
      video.currentTime = (clamped / total) * video.duration;
    }
  };

  // Step single frame backwards or forwards
  const handleStepProjectFrame = (proj: ProjectSession, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const total = Math.max(1, proj.project.totalFrames || 1);
    const current = Math.floor(frameMap[proj.id] ?? 0);
    const nextF = (current + delta + total) % total;
    handleSeekProjectFrame(proj, nextF);
  };

  // Toggle play/pause for an individual project (وقفة زمنية / استئناف)
  const handleToggleProjectPlay = (proj: ProjectSession, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlyPlaying = individualPlayingMap[proj.id] !== undefined
      ? individualPlayingMap[proj.id]
      : (isMasterPlaying && (playbackFocusMode === 'all' || proj.id === activeProjectId));

    setIndividualPlayingMap(prev => ({
      ...prev,
      [proj.id]: !isCurrentlyPlaying
    }));

    // If activating, also select as active project
    if (!isCurrentlyPlaying && proj.id !== activeProjectId) {
      onSelectProject(proj.id);
    }
  };

  // Audio Mute/Unmute
  const toggleMute = (projId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMutedMap(prev => {
      const newVal = !prev[projId];
      const video = videoRefs.current[projId];
      if (video) video.muted = newVal;
      return { ...prev, [projId]: newVal };
    });
  };

  // Restart project from frame 0
  const handleRestartProject = (proj: ProjectSession, e: React.MouseEvent) => {
    e.stopPropagation();
    handleSeekProjectFrame(proj, 0);
  };

  // Restart all projects from frame 0
  const handleRestartAll = () => {
    projects.forEach(p => {
      handleSeekProjectFrame(p, 0);
    });
  };

  const handleStartRename = (proj: ProjectSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(proj.id);
    setEditingName(proj.name || proj.project.fileName);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameProject(id, editingName.trim());
    }
    setEditingId(null);
  };

  // Layout Grid Class Helper
  const getGridClasses = () => {
    if (layoutMode === 'row') {
      return 'flex flex-row overflow-x-auto gap-4 p-4 pb-6 min-h-full items-center justify-start';
    }
    if (layoutMode === 'grid') {
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4 gap-4 p-4 min-h-full items-stretch';
    }
    // Auto layout
    if (projects.length === 1) {
      return 'flex items-center justify-center p-4 min-h-full';
    }
    if (projects.length === 2) {
      return 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-full items-stretch';
    }
    if (projects.length === 3) {
      return 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 min-h-full items-stretch';
    }
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 min-h-full items-stretch';
  };

  return (
    <div 
      className="flex-1 h-full w-full flex flex-col bg-[#070b14] overflow-hidden relative select-none"
      dir="rtl"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
        if (droppedFiles.length > 0 && onFilesDrop) {
          onFilesDrop(droppedFiles);
        }
      }}
    >
      {/* Stage Top Control Bar */}
      <div className="bg-[#0b1020]/95 border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-md z-10">
        {/* Left: View Mode Indicator & Layout Switchers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold shadow-sm">
            <LayoutGrid size={14} className="text-indigo-400" />
            <span>عرض ومقارنة المشاريع والفيديوهات ({projects.length})</span>
          </div>

          {/* Layout Mode Buttons */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={() => setLayoutMode('auto')}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                layoutMode === 'auto' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="توزيع تلقائي متناسق"
            >
              تلقائي
            </button>
            <button
              onClick={() => setLayoutMode('row')}
              className={`p-1 rounded-lg transition-all ${
                layoutMode === 'row' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="عرض أفقي جنباً إلى جنب (Scroll Row)"
            >
              <Columns size={13} />
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1 rounded-lg transition-all ${
                layoutMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="عرض شبكي (Grid)"
            >
              <Grid2X2 size={13} />
            </button>
          </div>
        </div>

        {/* Center: Playback Focus Mode & Synchronized Controls */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 p-1 rounded-2xl">
          {/* Mode Switcher: Solo Focus (Active Only) vs Play All */}
          <div className="flex items-center bg-white/5 rounded-xl p-0.5 border border-white/5">
            <button
              onClick={() => setPlaybackFocusMode('active_only')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                playbackFocusMode === 'active_only'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عند النقر على أي مشروع، يعمل هو فقط وتتوقف بقية المشاريع وقفة زمنية عند إطارها الحالي"
            >
              <Focus size={12} className="text-indigo-300" />
              <span>تشغيل المحدد فقط (عزل ووقفة زمنية)</span>
            </button>

            <button
              onClick={() => setPlaybackFocusMode('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                playbackFocusMode === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="تشغيل جميع المشاريع والفيديوهات متزامنة معاً"
            >
              <Radio size={12} className="text-emerald-300" />
              <span>تشغيل الكل معاً</span>
            </button>
          </div>

          {/* Master Play/Pause */}
          <button
            onClick={onToggleMasterPlay}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
              isMasterPlaying 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
            }`}
            title="تشغيل أو إيقاف العرض الرئيسي"
          >
            {isMasterPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isMasterPlaying ? 'وقفة زمنية ⏸️' : 'تشغيل ▶️'}</span>
          </button>

          {/* Restart All to Frame 0 */}
          <button
            onClick={handleRestartAll}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            title="إعادة تشغيل جميع المشاريع والفيديوهات من البداية (إطار 0)"
          >
            <RotateCcw size={12} />
            <span>إعادة للبداية</span>
          </button>
        </div>

        {/* Right: Quick Stage Actions */}
        <div className="flex items-center gap-2">
          {/* Merge All Into Single Stage as Layers */}
          {projects.length > 1 && onMergeAllProjectsIntoSingleCanvas && (
            <button
              onClick={onMergeAllProjectsIntoSingleCanvas}
              className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/50 hover:to-pink-600/50 text-purple-200 hover:text-white border border-purple-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105"
              title="دمج كل هذه المشاريع والفيديوهات كطبقات داخل شاشة واحدة موحدة"
            >
              <Sparkles size={13} className="text-purple-300" />
              <span>دمج الكل في كانفاس واحد كطبقات</span>
            </button>
          )}

          {/* Quick Import MP4 Button */}
          <button
            onClick={onOpenMp4Import}
            className="flex items-center gap-1 px-3 py-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 hover:text-white border border-pink-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105"
            title="استدعاء ورفع فيديوهات MP4 إضافية"
          >
            <Film size={13} className="text-pink-400" />
            <span>+ استدعاء فيديو MP4</span>
          </button>

          {/* Add Files Button */}
          <button
            onClick={onOpenFiles}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105"
            title="فتح ملفات SVGA أو صور إضافية على الشاشة"
          >
            <Plus size={13} className="text-indigo-400" />
            <span>+ فتح ملفات</span>
          </button>

          {/* Batch Export Button */}
          <button
            onClick={onBatchExport}
            className="flex items-center gap-1 px-3.5 py-1 text-xs font-black text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 rounded-xl border border-emerald-400/40 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer hover:scale-105"
            title="تصدير كافة المشاريع المعروضة دفعة واحدة"
          >
            <Download size={13} />
            <span>تصدير جماعي ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Screen Stage Area */}
      <div className={`flex-1 overflow-auto ${getGridClasses()}`}>
        {projects.map((proj, idx) => {
          const isActive = proj.id === activeProjectId;
          const isVideo = proj.fileType === 'mp4';
          const isImg = proj.fileType === 'image';
          const width = proj.project.width || 750;
          const height = proj.project.height || 1334;
          const totalFrames = Math.max(1, proj.project.totalFrames || 1);
          const fps = proj.project.fps || 30;
          const totalLayers = proj.layers.length;
          const isMuted = mutedMap[proj.id] ?? true;

          const currentRawFrame = frameMap[proj.id] ?? 0;
          const currentFrame = Math.floor(currentRawFrame);
          const currentTimeSec = fps > 0 ? (currentFrame / fps).toFixed(2) : '0.00';
          const totalTimeSec = fps > 0 ? (totalFrames / fps).toFixed(2) : '0.00';

          // Determine live effective transparency, edge fade, shape crop and feather for this card
          const isCardActive = proj.id === activeProjectId;
          const effectiveFade = isCardActive && activeFadeConfig ? activeFadeConfig : proj.fadeConfig;
          const effectiveCrop = isCardActive && activeCropConfig ? activeCropConfig : proj.cropConfig;
          const effectiveFeather = isCardActive && activeCropFeather ? activeCropFeather : proj.cropFeather;
          const isTransActive = isTransparencyActive(effectiveFade, effectiveCrop);
          const maskStyle = getCombinedCssMaskStyle(effectiveFade, effectiveCrop, effectiveFeather);

          // Determine if this card is playing
          const isProjectPlaying = individualPlayingMap[proj.id] !== undefined
            ? individualPlayingMap[proj.id]
            : (isMasterPlaying && (playbackFocusMode === 'all' || isActive));

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`group relative flex flex-col bg-[#0b0f1d] rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer shadow-xl ${
                layoutMode === 'row' ? 'min-w-[340px] max-w-[420px] h-[calc(100%-1rem)]' : 'min-h-[420px]'
              } ${
                isActive
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-900/40'
                  : 'border-white/10 hover:border-indigo-400/40 hover:bg-[#0e1426]'
              }`}
            >
              {/* Card Header */}
              <div className={`px-3 py-2 flex items-center justify-between gap-2 border-b transition-colors ${
                isActive ? 'bg-indigo-950/70 border-indigo-500/40' : 'bg-black/40 border-white/10'
              }`}>
                {/* Project Badge & Title */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-300'
                  }`}>
                    {idx + 1}
                  </span>

                  {/* Type Badge */}
                  {isVideo ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30 shrink-0">
                      <Film size={11} /> فيديو MP4
                    </span>
                  ) : isImg ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                      <ImageIcon size={11} /> صورة
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                      <Layers size={11} /> SVGA 2.0
                    </span>
                  )}

                  {/* Transparency & Crop Badge */}
                  {isTransActive && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30 shrink-0">
                      <Sliders size={10} className="text-cyan-400" />
                      شفافية وقص
                    </span>
                  )}

                  {/* Title / Inline Rename */}
                  {editingId === proj.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(proj.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="bg-black/80 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white outline-none w-28 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(proj.id)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <span
                      onDoubleClick={(e) => handleStartRename(proj, e)}
                      className="text-xs font-bold text-white truncate max-w-[140px]"
                      title="انقر نقراً مزدوجاً لإعادة التسمية"
                    >
                      {proj.name}
                    </span>
                  )}
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Active Indicator Pin */}
                  {isActive && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 animate-in fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      المشروع النشط للتعديل
                    </span>
                  )}

                  {/* Single View Focus Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusProjectSingleView(proj.id);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-white/10 transition-colors"
                    title="تكبير وتعديل في الكانفاس الكامل (Focus Single Canvas)"
                  >
                    <Maximize2 size={13} />
                  </button>

                  {/* Duplicate */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateProject(proj.id);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-300 rounded hover:bg-white/10 transition-colors"
                    title="نسخ وتكرار المشروع"
                  >
                    <Copy size={13} />
                  </button>

                  {/* Close */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseProject(proj.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-white/10 transition-colors"
                    title="إغلاق المشروع"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Screen Viewport Stage */}
              <div 
                className="flex-1 relative flex items-center justify-center p-3 overflow-hidden bg-black/50 min-h-[220px]"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
                    linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), 
                    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)
                  `,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                }}
              >
                {/* Render MP4 Native Video or SVGA Canvas with real-time mask and crop */}
                {isVideo && proj.videoUrl ? (
                  <div 
                    className="relative max-w-full max-h-full flex items-center justify-center transition-all duration-75 overflow-hidden"
                    style={maskStyle}
                  >
                    <video
                      ref={el => { videoRefs.current[proj.id] = el; }}
                      src={proj.videoUrl}
                      playsInline
                      muted={isMuted}
                      loop
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      style={{
                        width: 'auto',
                        height: 'auto'
                      }}
                    />
                    {/* Audio Mute/Unmute Overlay Button */}
                    <button
                      onClick={(e) => toggleMute(proj.id, e)}
                      className="absolute bottom-2 left-2 p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white border border-white/20 shadow-md backdrop-blur-sm transition-transform hover:scale-110 z-10"
                      title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                    >
                      {isMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                    </button>
                  </div>
                ) : (
                  <div 
                    className="relative max-w-full max-h-full flex items-center justify-center transition-all duration-75 overflow-hidden"
                    style={maskStyle}
                  >
                    <canvas
                      ref={el => { canvasRefs.current[proj.id] = el; }}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform"
                      style={{
                        width: 'auto',
                        height: 'auto'
                      }}
                    />
                  </div>
                )}

                {/* Subtle Hover Selection Overlay if not active */}
                {!isActive && (
                  <div className="absolute inset-0 bg-indigo-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-black/85 border border-indigo-500/60 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-sm">
                      انقر لتشغيل هذا المشروع وتعديله (وقفة زمنية للمشاريع الأخرى)
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Mini Timeline & Pause Control (وقفة زمنية وتحكم دقيق في الإطارات) */}
              <div 
                className="px-3 py-2 bg-[#080d1a] border-t border-white/10 flex flex-col gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Timeline Slider Track */}
                <div className="flex items-center gap-2">
                  {/* Play / Pause Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleProjectPlay(proj, e)}
                    className={`p-1.5 rounded-lg text-white font-bold transition-all shadow-sm ${
                      isProjectPlaying
                        ? 'bg-amber-500 hover:bg-amber-600 text-black'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                    title={isProjectPlaying ? 'وقفة زمنية (إيقاف مؤقت)' : 'تشغيل المشروع'}
                  >
                    {isProjectPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>

                  {/* Step Backward Frame */}
                  <button
                    type="button"
                    onClick={(e) => handleStepProjectFrame(proj, -1, e)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="فريم سابق (-1)"
                  >
                    <StepBack size={12} />
                  </button>

                  {/* Interactive Frame Range Scrubber Slider */}
                  <div className="flex-1 flex items-center relative">
                    <input
                      type="range"
                      min={0}
                      max={totalFrames - 1}
                      value={currentFrame}
                      onChange={(e) => handleSeekProjectFrame(proj, Number(e.target.value), e)}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                    />
                  </div>

                  {/* Step Forward Frame */}
                  <button
                    type="button"
                    onClick={(e) => handleStepProjectFrame(proj, 1, e)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="فريم تالي (+1)"
                  >
                    <StepForward size={12} />
                  </button>

                  {/* Reset to 0 */}
                  <button
                    type="button"
                    onClick={(e) => handleRestartProject(proj, e)}
                    className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-white/10 transition-colors"
                    title="إعادة للفريم 0"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>

                {/* Timeline Info Bar */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">
                      إطار {currentFrame} / {totalFrames - 1}
                    </span>
                    <span>•</span>
                    <span className="text-indigo-300 font-semibold">
                      {currentTimeSec}s / {totalTimeSec}s
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span>{width}×{height}</span>
                    <span>•</span>
                    <span>{totalLayers} طبقة</span>
                  </div>
                </div>
              </div>

              {/* Card Bottom Actions Bar */}
              <div className="px-3 py-1.5 bg-black/60 border-t border-white/5 flex items-center justify-between gap-2 text-slate-400 text-xs">
                {/* Status text */}
                <span className="text-[10px] text-slate-400">
                  {isProjectPlaying ? '🟢 قيد التشغيل' : '⏸️ وقفة زمنية'}
                </span>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* Merge into active project if not active */}
                  {onMergeProjectIntoActive && !isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMergeProjectIntoActive(proj.id);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 px-2 py-0.5 rounded-lg border border-purple-500/30 transition-all hover:scale-105"
                      title="دمج هذا المشروع/الفيديو كطبقة داخل المشروع النشط"
                    >
                      <Layers size={10} /> دمج كطبقة
                    </button>
                  )}

                  {/* Single Export */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportSingleProject(proj);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 px-2 py-0.5 rounded-lg border border-indigo-500/30 transition-all hover:scale-105"
                    title="تصدير هذا المشروع منفرداً"
                  >
                    <Download size={10} /> تصدير
                  </button>

                  {/* Focus Fullscreen Edit */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusProjectSingleView(proj.id);
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-0.5 rounded-lg transition-all hover:scale-105"
                    title="تكبير والتحكم الفردي في كل طبقة وحركاتها"
                  >
                    <Sliders size={10} /> تعديل مفصل
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag & Drop Full Overlay Banner */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-indigo-950/80 border-2 border-dashed border-indigo-400 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/30 border border-indigo-400 flex items-center justify-center text-indigo-300 mb-4 animate-bounce">
              <Upload size={32} />
            </div>
            <h3 className="text-xl font-black text-white mb-2">أفلت الملفات لعرضها فوراً هنا على الشاشة!</h3>
            <p className="text-xs text-indigo-200 max-w-md">
              يدعم رفع فيديوهات MP4 متعددة، ملفات SVGA، والصور المتحركة لعرضها جنباً إلى جنب في شاشات مستقلة وتصديرها معاً دفعة واحدة
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
