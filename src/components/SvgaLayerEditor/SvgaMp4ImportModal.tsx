import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Film,
  Video,
  Play,
  Pause,
  Clock,
  Zap,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Layers,
  Check,
  Loader2,
  ArrowRight,
  Maximize2,
  Plus,
  Trash2,
  Settings2,
  FileCheck,
  Lock,
  Unlock
} from 'lucide-react';
import { SVGAProjectData, EditableLayer, SVGAAudioTrack } from './types';
import {
  probeMp4Video,
  convertMp4ToSvgaProject,
  importMp4AsLayerIntoProject,
  Mp4ProbeResult
} from './mp4SvgaEngine';

interface SvgaMp4ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: File[];
  hasExistingProject?: boolean;
  existingProject?: SVGAProjectData | null;
  onImportAsProject: (project: SVGAProjectData, layers: EditableLayer[], file?: File) => void;
  onImportMultipleProjects?: (items: { project: SVGAProjectData; layers: EditableLayer[]; file?: File; videoUrl?: string }[]) => void;
  onImportAsLayer?: (layer: EditableLayer, audios: SVGAAudioTrack[]) => void;
  onImportMultipleLayers?: (layers: EditableLayer[], audios: SVGAAudioTrack[]) => void;
}

export const SvgaMp4ImportModal: React.FC<SvgaMp4ImportModalProps> = ({
  isOpen,
  onClose,
  initialFiles = [],
  hasExistingProject = false,
  existingProject = null,
  onImportAsProject,
  onImportMultipleProjects,
  onImportAsLayer,
  onImportMultipleLayers
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [probes, setProbes] = useState<Record<string, Mp4ProbeResult>>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);

  // Import Mode: 'new_project' vs 'add_layer'
  const [importMode, setImportMode] = useState<'new_project' | 'add_layer'>(
    hasExistingProject ? 'add_layer' : 'new_project'
  );

  // Settings - Defaulted to user's requested 750 × 1334 and original video duration
  const [fps, setFps] = useState<number>(15);
  const [durationMode, setDurationMode] = useState<'original' | 'custom'>('original');
  const [durationStrategy, setDurationStrategy] = useState<'crop_start' | 'compress_full'>('crop_start');
  const [customDuration, setCustomDuration] = useState<number>(18.0);
  const [customWidth, setCustomWidth] = useState<number>(750);
  const [customHeight, setCustomHeight] = useState<number>(1334);
  const [widthStr, setWidthStr] = useState<string>('750');
  const [heightStr, setHeightStr] = useState<string>('1334');
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(false);
  const [qualityMode, setQualityMode] = useState<'fast' | 'high'>('fast');
  const [maxFramesLimit, setMaxFramesLimit] = useState<number>(0);
  const [preserveAudio, setPreserveAudio] = useState<boolean>(true);

  // Video Preview State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Conversion Progress State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load initial files
  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setProbes({});
      setIsProcessing(false);
      setProgressPercent(0);
      setErrorMsg(null);
      return;
    }

    if (initialFiles.length > 0) {
      setFiles(initialFiles);
      setSelectedIndex(0);
      loadMetadataForFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  // Read metadata for files
  const loadMetadataForFiles = async (fileList: File[]) => {
    setIsLoadingMetadata(true);
    const newProbes: Record<string, Mp4ProbeResult> = {};

    for (const f of fileList) {
      try {
        const probe = await probeMp4Video(f);
        newProbes[f.name] = probe;
      } catch (err) {
        console.warn(`Failed probing metadata for ${f.name}:`, err);
      }
    }

    setProbes(prev => ({ ...prev, ...newProbes }));
    setIsLoadingMetadata(false);

    if (fileList.length > 0 && newProbes[fileList[0].name]) {
      const p = newProbes[fileList[0].name];
      setDurationMode('original');
      setCustomDuration(parseFloat(p.duration.toFixed(1)));
      setMaxFramesLimit(0);
    }
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      const combined = [...files, ...added];
      setFiles(combined);
      loadMetadataForFiles(added);
    }
    if (e.target) e.target.value = '';
  };

  const activeFile = files[selectedIndex] || null;
  const activeProbe = activeFile ? probes[activeFile.name] : null;

  // Sync duration with active video's original duration
  useEffect(() => {
    if (activeProbe) {
      setCustomDuration(parseFloat(activeProbe.duration.toFixed(1)));
    }
  }, [selectedIndex, activeProbe?.duration]);

  // Complete user freedom: changing width only changes width unless user explicitly locked ratio
  const handleWidthChange = (valStr: string) => {
    setWidthStr(valStr);
    const newW = parseInt(valStr, 10);
    if (!isNaN(newW) && newW > 0) {
      setCustomWidth(newW);
      if (lockAspectRatio && activeProbe && activeProbe.width > 0 && activeProbe.height > 0) {
        const ratio = activeProbe.width / activeProbe.height;
        const newH = Math.max(32, Math.round(newW / ratio));
        setCustomHeight(newH);
        setHeightStr(String(newH));
      }
    }
  };

  // Complete user freedom: changing height only changes height unless user explicitly locked ratio
  const handleHeightChange = (valStr: string) => {
    setHeightStr(valStr);
    const newH = parseInt(valStr, 10);
    if (!isNaN(newH) && newH > 0) {
      setCustomHeight(newH);
      if (lockAspectRatio && activeProbe && activeProbe.width > 0 && activeProbe.height > 0) {
        const ratio = activeProbe.width / activeProbe.height;
        const newW = Math.max(32, Math.round(newH * ratio));
        setCustomWidth(newW);
        setWidthStr(String(newW));
      }
    }
  };

  const setDimensions = (w: number, h: number) => {
    setCustomWidth(w);
    setCustomHeight(h);
    setWidthStr(String(w));
    setHeightStr(String(h));
  };

  const stepDimension = (dim: 'w' | 'h', delta: number) => {
    if (dim === 'w') {
      const nextW = Math.max(32, Math.min(3840, customWidth + delta));
      handleWidthChange(String(nextW));
    } else {
      const nextH = Math.max(32, Math.min(3840, customHeight + delta));
      handleHeightChange(String(nextH));
    }
  };

  const stepDuration = (delta: number) => {
    setDurationMode('custom');
    setCustomDuration(prev => {
      const maxSec = activeProbe ? Math.max(60, Math.ceil(activeProbe.duration * 1.5)) : 60;
      const next = Math.max(0.2, Math.min(maxSec, parseFloat((prev + delta).toFixed(1))));
      return next;
    });
  };

  const setOriginalDurationMode = () => {
    setDurationMode('original');
    if (activeProbe) {
      setCustomDuration(parseFloat(activeProbe.duration.toFixed(1)));
    }
    setMaxFramesLimit(0);
  };

  const setQuickDuration = (seconds: number, targetFps = 15) => {
    setDurationMode('custom');
    setCustomDuration(seconds);
    setFps(targetFps);
    setMaxFramesLimit(0);
  };

  const applyTurboSpeedPreset = () => {
    setFps(15);
    setDurationMode('custom');
    setCustomDuration(2.0);
    setMaxFramesLimit(30);
    setQualityMode('fast');
  };

  // Active file duration
  const activeDuration = activeProbe?.duration || 5;
  const targetDurationSeconds = durationMode === 'custom' ? customDuration : activeDuration;
  let estimatedFrames = Math.max(1, Math.round(targetDurationSeconds * fps));
  if (maxFramesLimit > 0 && estimatedFrames > maxFramesLimit) {
    estimatedFrames = maxFramesLimit;
  }

  // Toggle Video Playback
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Convert/Import Execution
  const handleExecuteImport = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setProgressPercent(5);
    setProgressPhase('بدء تهيئة استدعاء وتحويل الفيديوهات...');

    try {
      if (importMode === 'add_layer' && hasExistingProject && existingProject) {
        // Add as video layer(s) into current project
        const allNewLayers: EditableLayer[] = [];
        const allAddedAudios: SVGAAudioTrack[] = [];

        for (let i = 0; i < files.length; i++) {
          const currentFile = files[i];
          const fileProbe = probes[currentFile.name] || await probeMp4Video(currentFile).catch(() => null);

          const conversionOptions = {
            fps,
            targetDuration: durationMode === 'custom' ? customDuration : (fileProbe ? fileProbe.duration : undefined),
            durationStrategy,
            targetWidth: customWidth > 0 ? customWidth : undefined,
            targetHeight: customHeight > 0 ? customHeight : undefined,
            quality: qualityMode,
            maxFrames: maxFramesLimit > 0 ? maxFramesLimit : undefined,
            preserveAudio,
            onProgress: (phase: string, percent: number) => {
              const overallPercent = Math.round(((i + percent / 100) / files.length) * 100);
              setProgressPhase(`[${i + 1}/${files.length}] ${currentFile.name}: ${phase}`);
              setProgressPercent(overallPercent);
            }
          };

          const { newLayer, addedAudios } = await importMp4AsLayerIntoProject(
            currentFile,
            existingProject,
            conversionOptions
          );
          allNewLayers.push(newLayer);
          allAddedAudios.push(...addedAudios);
        }

        setIsProcessing(false);
        if (onImportMultipleLayers && allNewLayers.length > 1) {
          onImportMultipleLayers(allNewLayers, allAddedAudios);
        } else if (allNewLayers.length > 0) {
          if (onImportMultipleLayers) {
            onImportMultipleLayers(allNewLayers, allAddedAudios);
          } else if (onImportAsLayer) {
            onImportAsLayer(allNewLayers[0], allAddedAudios);
          }
        }
        onClose();
      } else {
        // Create full SVGA project(s)
        const results: { project: SVGAProjectData; layers: EditableLayer[]; file?: File; videoUrl?: string }[] = [];

        for (let i = 0; i < files.length; i++) {
          const currentFile = files[i];
          const fileProbe = probes[currentFile.name] || await probeMp4Video(currentFile).catch(() => null);

          const conversionOptions = {
            fps,
            targetDuration: durationMode === 'custom' ? customDuration : (fileProbe ? fileProbe.duration : undefined),
            durationStrategy,
            targetWidth: customWidth > 0 ? customWidth : undefined,
            targetHeight: customHeight > 0 ? customHeight : undefined,
            quality: qualityMode,
            maxFrames: maxFramesLimit > 0 ? maxFramesLimit : undefined,
            preserveAudio,
            onProgress: (phase: string, percent: number) => {
              const overallPercent = Math.round(((i + percent / 100) / files.length) * 100);
              setProgressPhase(`[${i + 1}/${files.length}] ${currentFile.name}: ${phase}`);
              setProgressPercent(overallPercent);
            }
          };

          const { project, layers } = await convertMp4ToSvgaProject(
            currentFile,
            conversionOptions
          );
          const videoUrl = URL.createObjectURL(currentFile);
          results.push({ project, layers, file: currentFile, videoUrl });
        }

        setIsProcessing(false);
        if (results.length > 1 && onImportMultipleProjects) {
          onImportMultipleProjects(results);
        } else if (results.length > 0) {
          if (onImportMultipleProjects) {
            onImportMultipleProjects(results);
          } else {
            onImportAsProject(results[0].project, results[0].layers, results[0].file);
          }
        }
        onClose();
      }
    } catch (err: any) {
      console.error('MP4 import error:', err);
      setIsProcessing(false);
      setErrorMsg(err?.message || 'حدث خطأ أثناء استدعاء وتحويل الفيديوهات. يرجى المحاولة مرة أخرى.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none text-right font-sans" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl bg-[#0c1220] border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <Film size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  استدعاء فيديو MP4 والتحكم به كملف SVGA
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                    معالجة فائقة السرعة
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  تحويل ملف MP4 إلى مشروع SVGA قابل للتحريك، تغيير الأبعاد، المؤثرات، والتصدير لأي صيغة متاحة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>

          {/* Hidden File Input for Batch Addition */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={handleAddMoreFiles}
          />

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* If no files loaded yet, show Dropzone / Upload button */}
            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/30 rounded-3xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
                  <Film size={32} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">اختر أو اسحب ملفات فيديو MP4 هنا</h3>
                  <p className="text-xs text-slate-400">يدعم رفع ملف واحد أو عدة ملفات فيديو في نفس الوقت (Batch Upload)</p>
                </div>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 transition-transform active:scale-95"
                >
                  استعراض من الجهاز (MP4)
                </button>
              </div>
            ) : (
              <>
                {/* Batch File Switcher (If multiple files chosen) */}
                {files.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10">
                    <span className="text-xs font-bold text-slate-400 shrink-0">الفيديوهات المختارة ({files.length}):</span>
                    {files.map((f, idx) => (
                      <div
                        key={`${f.name}_${idx}`}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                          selectedIndex === idx
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedIndex(idx)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 cursor-pointer outline-none"
                        >
                          <Video size={13} />
                          <span className="max-w-[130px] truncate">{f.name}</span>
                        </button>
                        {!isProcessing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updated = files.filter((_, i) => i !== idx);
                              setFiles(updated);
                              if (selectedIndex >= updated.length) {
                                setSelectedIndex(Math.max(0, updated.length - 1));
                              }
                            }}
                            className="p-0.5 rounded hover:bg-white/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="حذف هذا الفيديو من القائمة"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1 shrink-0 border border-indigo-500/20 cursor-pointer"
                      title="إضافة فيديو آخر"
                    >
                      <Plus size={13} />
                      <span>إضافة</span>
                    </button>
                  </div>
                )}

                {/* Import Mode Selector (If project already open) */}
                {hasExistingProject && (
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900/80 border border-white/10 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setImportMode('add_layer')}
                      className={`p-3 rounded-xl text-right transition-all cursor-pointer flex items-center gap-3 ${
                        importMode === 'add_layer'
                          ? 'bg-gradient-to-l from-indigo-600 to-purple-600 text-white shadow-lg'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Layers size={16} />
                      </div>
                      <div>
                        <span className="block font-bold text-xs">دمج كطبقة فيديو في المشروع الحالي</span>
                        <span className="block text-[10px] opacity-75">إضافة الفيديو كطبقة أنيميشن فوق/تحت الطبقات الحالية</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('new_project')}
                      className={`p-3 rounded-xl text-right transition-all cursor-pointer flex items-center gap-3 ${
                        importMode === 'new_project'
                          ? 'bg-gradient-to-l from-indigo-600 to-purple-600 text-white shadow-lg'
                          : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                        <Film size={16} />
                      </div>
                      <div>
                        <span className="block font-bold text-xs">فتح كمشروع SVGA رئيسي جديد</span>
                        <span className="block text-[10px] opacity-75">تهيئة مشروع مستقل بمقاسات ومعدل إطارات الفيديو</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Video Preview & Video Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Column: Video Preview Player */}
                  <div className="md:col-span-5 flex flex-col gap-3">
                    <div className="relative aspect-[9/16] max-h-[300px] w-full mx-auto bg-black rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-lg group">
                      {activeFile && (
                        <video
                          ref={videoRef}
                          src={URL.createObjectURL(activeFile)}
                          className="w-full h-full object-contain"
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onEnded={() => setIsPlaying(false)}
                          muted={isMuted}
                          playsInline
                        />
                      )}

                      {/* Play/Pause Overlay Button */}
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 cursor-pointer opacity-80 group-hover:opacity-100"
                      >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} className="mr-0.5" />}
                      </button>

                      {/* Sound Toggle */}
                      <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs border border-white/10 transition-colors"
                        title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                      >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>

                    {/* Quick Stats Pills */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                        <span className="block text-[10px] text-slate-400">الأبعاد الأصلية</span>
                        <span className="block text-xs font-black text-indigo-300">
                          {activeProbe ? `${activeProbe.width} × ${activeProbe.height}` : '...'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={setOriginalDurationMode}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          durationMode === 'original'
                            ? 'bg-amber-500/20 border-amber-400/60 ring-1 ring-amber-400/40 shadow-sm'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-amber-400/30'
                        }`}
                        title="انقر لاعتماد المدة الأصلية للفيديو كاملة"
                      >
                        <span className="block text-[10px] text-slate-400">المدة الأصلية (انقر للاختيار)</span>
                        <span className="block text-xs font-black text-amber-300">
                          {activeProbe ? `${activeProbe.duration.toFixed(1)} ثانية` : '...'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Settings & Configuration */}
                  <div className="md:col-span-7 space-y-3.5">
                    {/* Turbo Mode / 1-Second Import CTA */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-purple-500/20 border border-amber-500/40 flex items-center justify-between shadow-lg shadow-amber-500/10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center">
                          <Zap size={18} className="animate-pulse text-amber-400" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-amber-300 block">وضع الاستيراد الفائق (في ثانية واحدة) ⚡</span>
                          <span className="text-[10px] text-slate-300 block">معالجة فورية خفيفة بدون أي تأخير تفتح المشروع في ثانية واحدة</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={applyTurboSpeedPreset}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md cursor-pointer transition-transform transform active:scale-95 whitespace-nowrap"
                      >
                        تطبيق السرعة الفائقة ⚡
                      </button>
                    </div>

                    {/* Numeric Dimensions & Resolution Control */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Maximize2 size={14} className="text-indigo-400" />
                          التحكم الرقمي في مقاس وأبعاد الكانفاس (Width × Height):
                        </span>
                        <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/30">
                          {customWidth} × {customHeight} px
                        </span>
                      </div>

                      {/* Direct Numeric Inputs with Steppers */}
                      <div className="grid grid-cols-5 gap-2 items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                        <div className="col-span-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-400 block font-medium">العرض (Width px):</label>
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => stepDimension('w', -100)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="إنقاص 100 بكسل"
                              >
                                -100
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('w', -10)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="إنقاص 10 بكسل"
                              >
                                -10
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('w', 10)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="زيادة 10 بكسل"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('w', 100)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="زيادة 100 بكسل"
                              >
                                +100
                              </button>
                            </div>
                          </div>
                          <input
                            type="number"
                            min="32"
                            max="3840"
                            value={widthStr}
                            onChange={(e) => handleWidthChange(e.target.value)}
                            onBlur={() => {
                              const num = parseInt(widthStr, 10);
                              if (isNaN(num) || num < 16) {
                                setWidthStr(String(customWidth || 750));
                              }
                            }}
                            className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-400 focus:bg-white/15"
                            placeholder="750"
                          />
                        </div>

                        {/* Aspect Ratio Lock Button */}
                        <div className="col-span-1 flex flex-col items-center justify-center pt-3">
                          <button
                            type="button"
                            onClick={() => setLockAspectRatio(!lockAspectRatio)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              lockAspectRatio
                                ? 'bg-indigo-600/40 border-indigo-400 text-indigo-300 shadow-sm'
                                : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                            }`}
                            title={lockAspectRatio ? 'نسبة الأبعاد مقفلة (تناسب تلقائي)' : 'نسبة الأبعاد حرة تماماً'}
                          >
                            {lockAspectRatio ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                          <span className="text-[9px] text-slate-400 mt-0.5">{lockAspectRatio ? 'مقفل' : 'حر 🔓'}</span>
                        </div>

                        <div className="col-span-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-400 block font-medium">الارتفاع (Height px):</label>
                            <div className="flex gap-0.5">
                              <button
                                type="button"
                                onClick={() => stepDimension('h', -100)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="إنقاص 100 بكسل"
                              >
                                -100
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('h', -10)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="إنقاص 10 بكسل"
                              >
                                -10
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('h', 10)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="زيادة 10 بكسل"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDimension('h', 100)}
                                className="px-1 py-0.5 text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer"
                                title="زيادة 100 بكسل"
                              >
                                +100
                              </button>
                            </div>
                          </div>
                          <input
                            type="number"
                            min="32"
                            max="3840"
                            value={heightStr}
                            onChange={(e) => handleHeightChange(e.target.value)}
                            onBlur={() => {
                              const num = parseInt(heightStr, 10);
                              if (isNaN(num) || num < 16) {
                                setHeightStr(String(customHeight || 1334));
                              }
                            }}
                            className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-400 focus:bg-white/15"
                            placeholder="1334"
                          />
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between px-1">
                        <span>تحكم حر كامل: يمكنك كتابة أي أرقام تفضلها بدون أي إجبار.</span>
                        <button
                          type="button"
                          onClick={() => setDimensions(750, 1334)}
                          className="text-indigo-300 hover:text-white font-bold underline cursor-pointer text-[10px]"
                        >
                          تطبيق 750×1334 فوراً
                        </button>
                      </div>

                      {/* Quick Resolution Presets */}
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {[
                          { label: '★ 750×1334 (المختار)', w: 750, h: 1334 },
                          { label: 'الأصلي', w: activeProbe?.width || 750, h: activeProbe?.height || 1334 },
                          { label: '1080×1920', w: 1080, h: 1920 },
                          { label: '1080×1080', w: 1080, h: 1080 },
                          { label: '1280×720', w: 1280, h: 720 },
                          { label: '750×750', w: 750, h: 750 },
                          { label: '500×500', w: 500, h: 500 },
                          { label: 'مخفف 50%', w: Math.round((activeProbe?.width || 750) * 0.5), h: Math.round((activeProbe?.height || 1334) * 0.5) },
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDimensions(preset.w, preset.h)}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                              customWidth === preset.w && customHeight === preset.h
                                ? 'bg-indigo-600/40 border-indigo-400 text-white shadow-sm ring-1 ring-indigo-400'
                                : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration / Zero-Crop Speed Setting */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Clock size={14} className="text-amber-400" />
                          مدة الفيديو وسرعة الحركة:
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={setOriginalDurationMode}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              durationMode === 'original'
                                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/40'
                                : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                            }`}
                          >
                            <span>المدة الأصلية كاملة</span>
                            <span className="font-mono bg-amber-400/20 px-1 py-0.2 rounded text-amber-300">
                              {activeProbe ? `${activeProbe.duration.toFixed(1)}ث` : '...'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDurationMode('custom')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              durationMode === 'custom'
                                ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-400/40'
                                : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                            }`}
                          >
                            تخصيص مدة أخرى (رقمياً)
                          </button>
                        </div>
                      </div>

                      {/* When Original Duration Mode is Selected */}
                      {durationMode === 'original' && (
                        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-transparent border border-amber-400/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span className="text-xs font-bold text-amber-200">
                                المدة الأساسية المعتمدة للفيديو: {activeProbe ? `${activeProbe.duration.toFixed(1)} ثانية` : '...'}
                              </span>
                            </div>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                              كامل الفيديو 1:1
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-relaxed">
                            سيتم استدعاء الفيديو بالكامل من بدايته إلى نهايته بنفس سرعته الطبيعية الأصلية وبدون أي اقتطاع.
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <span className="text-[10px] text-slate-400">أو اضغط لاختيار مدة سريعة مختصرة:</span>
                            <div className="flex gap-1">
                              {[
                                { label: '1ث ⚡', sec: 1.0 },
                                { label: '2ث ⚡', sec: 2.0 },
                                { label: '3ث', sec: 3.0 },
                                { label: '5ث', sec: 5.0 },
                                { label: '10ث', sec: 10.0 },
                              ].map((chip, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setQuickDuration(chip.sec)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-amber-400/20 text-slate-300 hover:text-amber-200 border border-white/10 transition-colors cursor-pointer"
                                >
                                  {chip.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* When Custom Duration Mode is Selected */}
                      {durationMode === 'custom' && (
                        <div className="space-y-2.5 pt-1 bg-black/30 p-3 rounded-xl border border-white/5">
                          {/* Quick Preset Duration Chips */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">خيارات سريعة للمدة:</span>
                            <button
                              type="button"
                              onClick={setOriginalDurationMode}
                              className="text-[10px] text-amber-300 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                            >
                              الرجوع للأصلية ({activeProbe ? `${activeProbe.duration.toFixed(1)}ث` : '...'})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {[
                              { label: `الأصلية (${activeProbe ? `${activeProbe.duration.toFixed(0)}ث` : '...'}) ★`, sec: activeProbe ? parseFloat(activeProbe.duration.toFixed(1)) : 5.0 },
                              { label: '1 ثانية ⚡', sec: 1.0 },
                              { label: '2 ثانية ⚡', sec: 2.0 },
                              { label: '3 ثواني', sec: 3.0 },
                              { label: '5 ثواني', sec: 5.0 },
                              { label: '10 ثواني', sec: 10.0 },
                            ].map((chip, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setQuickDuration(chip.sec)}
                                className={`py-1 px-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                                  Math.abs(customDuration - chip.sec) < 0.15
                                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-sm ring-1 ring-amber-400'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>

                          {/* Numeric Duration Input with Steppers */}
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-slate-300 text-[11px] font-medium">حدد المدة المطلوبة رقمياً:</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => stepDuration(-1)}
                                className="px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer font-bold"
                                title="إنقاص ثانية واحدة"
                              >
                                -1ث
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDuration(-0.5)}
                                className="px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer font-bold"
                                title="إنقاص نصف ثانية"
                              >
                                -0.5ث
                              </button>
                              <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-md px-1.5 py-0.5">
                                <input
                                  type="number"
                                  min="0.2"
                                  max={activeProbe ? Math.max(120, Math.ceil(activeProbe.duration * 2)) : 120}
                                  step="0.1"
                                  value={customDuration}
                                  onChange={(e) => setCustomDuration(Math.max(0.2, parseFloat(e.target.value) || 1))}
                                  className="w-14 text-xs text-amber-300 font-mono font-bold text-center focus:outline-none bg-transparent"
                                />
                                <span className="text-slate-400 text-xs font-mono">ث</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => stepDuration(0.5)}
                                className="px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer font-bold"
                                title="زيادة نصف ثانية"
                              >
                                +0.5ث
                              </button>
                              <button
                                type="button"
                                onClick={() => stepDuration(1)}
                                className="px-1.5 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 text-slate-300 rounded cursor-pointer font-bold"
                                title="زيادة ثانية واحدة"
                              >
                                +1ث
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Range Slider scaling up to video length */}
                          <input
                            type="range"
                            min="0.2"
                            max={activeProbe ? Math.max(30, Math.ceil(activeProbe.duration)) : 30}
                            step="0.1"
                            value={customDuration}
                            onChange={(e) => setCustomDuration(parseFloat(e.target.value))}
                            className="w-full accent-amber-400 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>0.2 ثانية (سريع)</span>
                            <span>{customDuration.toFixed(1)} ثانية مختارة</span>
                            <span>الأصلية: {activeProbe ? `${activeProbe.duration.toFixed(1)}ث` : '30ث'}</span>
                          </div>

                          {/* Strategy selector: Crop Start (Natural speed, Instant) vs Compress Full */}
                          <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => setDurationStrategy('crop_start')}
                              className={`p-2 rounded-xl border text-right transition-all cursor-pointer ${
                                durationStrategy === 'crop_start'
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-[11px] font-bold flex items-center justify-between">
                                <span>قص البداية (0 إلى {customDuration}ث)</span>
                                <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded font-bold">سرعة طبيعية ⚡</span>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                                يبدأ فوراً من اللقطة الأولى بسرعة حركة 1:1 الطبيعية وبدون تسريع.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDurationStrategy('compress_full')}
                              className={`p-2 rounded-xl border text-right transition-all cursor-pointer ${
                                durationStrategy === 'compress_full'
                                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 ring-1 ring-indigo-400/50'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-[11px] font-bold flex items-center justify-between">
                                <span>تسريع وضغط كامل الفيديو</span>
                                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 rounded font-bold">ضغط</span>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                                ضغط كل ثواني الفيديو الأصلية ({activeProbe ? `${activeProbe.duration.toFixed(1)}ث` : '...'}) في {customDuration}ث.
                              </p>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Speed Engine & Frame Rate & Limit */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* FPS Control */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white block">معدل FPS:</span>
                          <span className="text-[10px] font-mono text-purple-300 font-bold">{fps} fps</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[12, 15, 24, 30].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => setFps(rate)}
                              className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                                fps === rate
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'bg-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              {rate}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Max Frames Cap */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white block">حد الإطارات:</span>
                          <span className="text-[10px] font-mono text-amber-300 font-bold">
                            {maxFramesLimit > 0 ? `${maxFramesLimit} إطار` : 'الكل'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: '30⚡', val: 30 },
                            { label: '45⚡', val: 45 },
                            { label: '90', val: 90 },
                            { label: 'الكل', val: 0 }
                          ].map((item, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setMaxFramesLimit(item.val)}
                              className={`py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                                maxFramesLimit === item.val
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'bg-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Speed & Format Toggle and Audio */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Quality/Speed Toggle */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                        <span className="text-xs font-bold text-white block">محرك وسرعة المعالجة:</span>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setQualityMode('fast')}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                              qualityMode === 'fast'
                                ? 'bg-emerald-600/40 border border-emerald-400 text-emerald-200'
                                : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            ⚡ فائق السرعة
                          </button>
                          <button
                            type="button"
                            onClick={() => setQualityMode('high')}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                              qualityMode === 'high'
                                ? 'bg-indigo-600/40 border border-indigo-400 text-indigo-200'
                                : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white'
                            }`}
                          >
                            💎 PNG كامل
                          </button>
                        </div>
                      </div>

                      {/* Audio Toggle */}
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-white block">الصوت الأصلي:</span>
                          <span className="text-[10px] text-slate-400 block">استخراج كـ MP3 ID3</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preserveAudio}
                            onChange={(e) => setPreserveAudio(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>

                    {/* Summary Card */}
                    <div className="p-2.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Zap size={13} className="text-amber-400" />
                        المدة وإجمالي الإطارات في SVGA:
                      </span>
                      <span className="font-mono font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center gap-1.5 text-[11px]">
                        <span className="text-amber-300 font-black">{targetDurationSeconds.toFixed(1)}ثانية</span>
                        <span className="text-slate-500">•</span>
                        <span>{estimatedFrames} إطار @ {fps}fps</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-emerald-300">
                          {durationMode === 'original' ? 'المدة الأصلية كاملة' : (durationStrategy === 'crop_start' ? 'قص البداية 1:1' : 'تسريع وضغط')}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Error Message if any */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-bold text-center">
                {errorMsg}
              </div>
            )}

            {/* Processing Progress Bar */}
            {isProcessing && (
              <div className="p-4 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-400" />
                    {progressPhase || 'جاري استدعاء ومعالجة الفيديو...'}
                  </span>
                  <span className="font-mono font-black text-indigo-300">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-200 shadow-lg shadow-indigo-500/50"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
            >
              إلغاء
            </button>

            {files.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || !activeFile}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>
                      {files.length > 1
                        ? `جاري تحويل الفيديوهات (${files.length})...`
                        : 'جاري الاستدعاء والتحويل...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} className="text-indigo-200" />
                    <span>
                      {importMode === 'add_layer'
                        ? (files.length > 1
                            ? `دمج كافة الفيديوهات (${files.length}) كطبقات في المشروع`
                            : 'دمج الفيديو في المشروع الآن')
                        : (files.length > 1
                            ? `استدعاء وتحويل كافة الفيديوهات (${files.length}) إلى SVGA`
                            : 'استدعاء وبدء التحرير في محرر SVGA')
                      }
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
