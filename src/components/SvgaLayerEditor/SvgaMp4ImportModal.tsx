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
  Unlock,
  Scissors,
  Crop,
  FastForward,
} from 'lucide-react';
import { trackUploadedFile } from '../../services/centralUploadService';
import { SVGAProjectData, EditableLayer, SVGAAudioTrack } from './types';
import {
  VideoTrimmerModal,
  TimingSettings,
  DEFAULT_TIMING_SETTINGS
} from '../VideoTrimmerModal';
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
  const [durationMode, setDurationMode] = useState<'original' | 'custom' | 'trim'>('original');
  const [durationStrategy, setDurationStrategy] = useState<'crop_start' | 'compress_full'>('crop_start');
  const [customDuration, setCustomDuration] = useState<number>(18.0);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [cropTop, setCropTop] = useState<number>(0);
  const [cropBottom, setCropBottom] = useState<number>(0);
  const [symmetricCrop, setSymmetricCrop] = useState<boolean>(true);
  const [showTrimmerStudio, setShowTrimmerStudio] = useState<boolean>(false);
  const [customWidth, setCustomWidth] = useState<number>(750);
  const [customHeight, setCustomHeight] = useState<number>(1334);
  const [widthStr, setWidthStr] = useState<string>('750');
  const [heightStr, setHeightStr] = useState<string>('1334');
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(false);
  const [qualityMode, setQualityMode] = useState<'fast' | 'high'>('fast');
  const [maxFramesLimit, setMaxFramesLimit] = useState<number>(0);
  const [preserveAudio, setPreserveAudio] = useState<boolean>(true);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'quick' | 'crop' | 'advanced'>('quick');
  const [showCustomResolutionInputs, setShowCustomResolutionInputs] = useState<boolean>(false);

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

          // Track uploaded file automatically in background
          trackUploadedFile(currentFile, 'svga_mp4_import_layer');

          const conversionOptions = {
            fps,
            targetDuration: durationMode === 'custom' ? customDuration : (fileProbe ? fileProbe.duration : undefined),
            durationStrategy,
            targetWidth: customWidth > 0 ? customWidth : undefined,
            targetHeight: customHeight > 0 ? customHeight : undefined,
            quality: qualityMode,
            maxFrames: maxFramesLimit > 0 ? maxFramesLimit : undefined,
            preserveAudio,
            trimStart: durationMode === 'trim' ? trimStart : undefined,
            trimEnd: durationMode === 'trim' && trimEnd > trimStart ? trimEnd : undefined,
            isManualTrim: durationMode === 'trim',
            cropTop: cropTop > 0 ? (fileProbe ? Math.round((fileProbe.height * cropTop) / 100) : cropTop) : undefined,
            cropBottom: cropBottom > 0 ? (fileProbe ? Math.round((fileProbe.height * cropBottom) / 100) : cropBottom) : undefined,
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

          // Track uploaded file automatically in background
          trackUploadedFile(currentFile, 'svga_mp4_import_project');

          const conversionOptions = {
            fps,
            targetDuration: durationMode === 'custom' ? customDuration : (fileProbe ? fileProbe.duration : undefined),
            durationStrategy,
            targetWidth: customWidth > 0 ? customWidth : undefined,
            targetHeight: customHeight > 0 ? customHeight : undefined,
            quality: qualityMode,
            maxFrames: maxFramesLimit > 0 ? maxFramesLimit : undefined,
            preserveAudio,
            trimStart: durationMode === 'trim' ? trimStart : undefined,
            trimEnd: durationMode === 'trim' && trimEnd > trimStart ? trimEnd : undefined,
            isManualTrim: durationMode === 'trim',
            cropTop: cropTop > 0 ? (fileProbe ? Math.round((fileProbe.height * cropTop) / 100) : cropTop) : undefined,
            cropBottom: cropBottom > 0 ? (fileProbe ? Math.round((fileProbe.height * cropBottom) / 100) : cropBottom) : undefined,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none text-right font-sans" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl bg-[#0c1220] border border-indigo-500/30 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
                <Film size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-lg font-black text-white flex items-center gap-2 truncate">
                  استدعاء فيديو MP4 والتحكم به كملف SVGA
                  <span className="hidden xs:inline-block text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                    معالجة فائقة السرعة
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate hidden xs:block">
                  تحويل ملف MP4 إلى مشروع SVGA قابل للتحريك، تغيير الأبعاد، المؤثرات، والتصدير لأي صيغة متاحة
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40 shrink-0"
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
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
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

                      {/* Crop Top Overlay Curtain */}
                      {cropTop > 0 && (
                        <div 
                          className="absolute top-0 left-0 right-0 bg-rose-950/75 border-b-2 border-rose-500/90 pointer-events-none z-10 flex items-center justify-center transition-all shadow-[0_4px_12px_rgba(244,63,94,0.3)]"
                          style={{ height: `${cropTop}%` }}
                        >
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black shadow-md border border-rose-400/40">
                            ✂️ قص {cropTop}% من الأعلى
                          </span>
                        </div>
                      )}

                      {/* Crop Bottom Overlay Curtain */}
                      {cropBottom > 0 && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-rose-950/75 border-t-2 border-rose-500/90 pointer-events-none z-10 flex items-center justify-center transition-all shadow-[0_-4px_12px_rgba(244,63,94,0.3)]"
                          style={{ height: `${cropBottom}%` }}
                        >
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black shadow-md border border-rose-400/40">
                            ✂️ قص {cropBottom}% من الأسفل
                          </span>
                        </div>
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
                  <div className="md:col-span-7 flex flex-col gap-3">
                    {/* ----------------- SETTINGS TABS (APPLE / STUDIO STYLE) ----------------- */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-900/90 border border-white/10 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setActiveSettingsTab('quick')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          activeSettingsTab === 'quick'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Zap size={14} className={activeSettingsTab === 'quick' ? 'text-amber-300' : 'text-slate-400'} />
                        <span>إعداد سريع وذكي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSettingsTab('crop')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer relative ${
                          activeSettingsTab === 'crop'
                            ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Crop size={14} className={activeSettingsTab === 'crop' ? 'text-white' : 'text-slate-400'} />
                        <span>القص والحواف</span>
                        {(cropTop > 0 || cropBottom > 0 || durationMode === 'trim') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSettingsTab('advanced')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          activeSettingsTab === 'advanced'
                            ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md border border-white/15'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sliders size={14} className={activeSettingsTab === 'advanced' ? 'text-purple-300' : 'text-slate-400'} />
                        <span>المتقدم و FPS</span>
                      </button>
                    </div>

                    {/* ----------------- TAB 1: QUICK & SMART ----------------- */}
                    {activeSettingsTab === 'quick' && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        {/* One-Click Turbo Preset CTA Banner */}
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md shadow-amber-500/5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                              <Zap size={16} className="animate-pulse" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-black text-amber-300 block truncate">الاستيراد الفائق (في ثانية واحدة) ⚡</span>
                              <span className="text-[10px] text-slate-300 block truncate">إعداد خفيف (15fps @ 2ث) لفتح المشروع فوراً بدون أي بطء</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={applyTurboSpeedPreset}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md cursor-pointer transition-transform active:scale-95 shrink-0"
                          >
                            تطبيق الآن ⚡
                          </button>
                        </div>

                        {/* Canvas Dimensions & Resolution */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Maximize2 size={13} className="text-indigo-400" />
                              مقاس وأبعاد الكانفاس (Resolution):
                            </span>
                            <span className="text-[11px] font-mono font-black text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-500/30">
                              {customWidth} × {customHeight} px
                            </span>
                          </div>

                          {/* Preset Chips */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {[
                              { label: '750 × 1334 (الموصى به) ★', w: 750, h: 1334 },
                              { label: `الأصلي (${activeProbe ? `${activeProbe.width}×${activeProbe.height}` : '...'})`, w: activeProbe?.width || 750, h: activeProbe?.height || 1334 },
                              { label: '1080 × 1920 (رأسي HD)', w: 1080, h: 1920 },
                              { label: '1080 × 1080 (مربع)', w: 1080, h: 1080 },
                              { label: '1280 × 720 (أفقي HD)', w: 1280, h: 720 },
                              { label: 'مخفف 50% (خفيف)', w: Math.round((activeProbe?.width || 750) * 0.5), h: Math.round((activeProbe?.height || 1334) * 0.5) },
                            ].map((preset, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setDimensions(preset.w, preset.h)}
                                className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer text-center truncate ${
                                  customWidth === preset.w && customHeight === preset.h
                                    ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm ring-1 ring-indigo-400/50'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          {/* Expandable Manual Custom Inputs */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setShowCustomResolutionInputs(!showCustomResolutionInputs)}
                              className="text-[11px] text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <span>{showCustomResolutionInputs ? '▲ إخفاء التخصيص اليدوي' : '▼ كتابة مقاس مخصص يدوياً بالبكسل'}</span>
                            </button>

                            {showCustomResolutionInputs && (
                              <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 animate-in fade-in">
                                <div className="flex-1 space-y-1">
                                  <label className="text-[10px] text-slate-400 block font-medium">العرض (Width px):</label>
                                  <input
                                    type="number"
                                    min="32"
                                    max="3840"
                                    value={widthStr}
                                    onChange={(e) => handleWidthChange(e.target.value)}
                                    onBlur={() => {
                                      const num = parseInt(widthStr, 10);
                                      if (isNaN(num) || num < 16) setWidthStr(String(customWidth || 750));
                                    }}
                                    className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-400"
                                    placeholder="750"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setLockAspectRatio(!lockAspectRatio)}
                                  className={`p-2 rounded-xl border transition-colors cursor-pointer mt-4 shrink-0 ${
                                    lockAspectRatio
                                      ? 'bg-indigo-600/40 border-indigo-400 text-indigo-300'
                                      : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                                  }`}
                                  title={lockAspectRatio ? 'نسبة الأبعاد مقفلة (تناسب تلقائي)' : 'نسبة الأبعاد حرة'}
                                >
                                  {lockAspectRatio ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>

                                <div className="flex-1 space-y-1">
                                  <label className="text-[10px] text-slate-400 block font-medium">الارتفاع (Height px):</label>
                                  <input
                                    type="number"
                                    min="32"
                                    max="3840"
                                    value={heightStr}
                                    onChange={(e) => handleHeightChange(e.target.value)}
                                    onBlur={() => {
                                      const num = parseInt(heightStr, 10);
                                      if (isNaN(num) || num < 16) setHeightStr(String(customHeight || 1334));
                                    }}
                                    className="w-full bg-white/10 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-400"
                                    placeholder="1334"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Video Duration & Playback Speed */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Clock size={13} className="text-amber-400" />
                              مدة الفيديو وسرعة الحركة:
                            </span>
                            <span className="text-[11px] font-mono font-black text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
                              {targetDurationSeconds.toFixed(1)} ثانية
                            </span>
                          </div>

                          {/* 3 Main Choice Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Option 1: Full Original */}
                            <button
                              type="button"
                              onClick={setOriginalDurationMode}
                              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                                durationMode === 'original'
                                  ? 'bg-amber-500/20 border-amber-400/80 text-white shadow-sm ring-1 ring-amber-400/40'
                                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-xs font-bold text-amber-300">المدة الأصلية كاملة</span>
                                <span className="text-[10px] font-mono font-black bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded">
                                  {activeProbe ? `${activeProbe.duration.toFixed(1)}ث` : '...'}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 leading-tight">حركة طبيعية 1:1 بدون أي تسريع</span>
                            </button>

                            {/* Option 2: 2.0s Turbo */}
                            <button
                              type="button"
                              onClick={() => setQuickDuration(2.0, 15)}
                              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                                durationMode === 'custom' && Math.abs(customDuration - 2.0) < 0.1
                                  ? 'bg-amber-500/20 border-amber-400/80 text-white shadow-sm ring-1 ring-amber-400/40'
                                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-xs font-bold text-amber-300">تسريع فائق (2.0ث) ⚡</span>
                                <span className="text-[10px] font-mono font-black bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded">
                                  2.0ث
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 leading-tight">سريع وخفيف جداً للمشاريع</span>
                            </button>

                            {/* Option 3: Custom Duration */}
                            <button
                              type="button"
                              onClick={() => setDurationMode('custom')}
                              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                                durationMode === 'custom' && Math.abs(customDuration - 2.0) >= 0.1
                                  ? 'bg-indigo-500/20 border-indigo-400/80 text-white shadow-sm ring-1 ring-indigo-400/40'
                                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-xs font-bold text-indigo-300">تخصيص مدة</span>
                                <span className="text-[10px] font-mono font-black bg-indigo-400/20 text-indigo-200 px-1.5 py-0.5 rounded">
                                  {customDuration.toFixed(1)}ث
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 leading-tight">تحديد عدد الثواني يدوياً</span>
                            </button>
                          </div>

                          {/* If Custom Duration is Active */}
                          {durationMode === 'custom' && (
                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2 mt-1 animate-in fade-in">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-300 font-bold">شريط ضبط الثواني:</span>
                                <span className="text-xs font-mono font-black text-amber-300">{customDuration.toFixed(1)} ثانية</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max={activeProbe ? Math.max(15, Math.ceil(activeProbe.duration)) : 15}
                                step="0.1"
                                value={customDuration}
                                onChange={(e) => setCustomDuration(parseFloat(e.target.value))}
                                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                              />
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] text-slate-500 font-mono">0.5ث (أقصى سرعة)</span>
                                <div className="flex gap-1">
                                  {[1.0, 3.0, 5.0, 10.0].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => setQuickDuration(s)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                        Math.abs(customDuration - s) < 0.1
                                          ? 'bg-amber-400 text-slate-950 border-amber-400'
                                          : 'bg-white/5 text-slate-400 border-white/5 hover:text-white'
                                      }`}
                                    >
                                      {s}ث
                                    </button>
                                  ))}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{activeProbe ? `${activeProbe.duration.toFixed(0)}ث` : '15ث'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Toggles: Audio & Processing Engine */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Audio Toggle */}
                          <div 
                            onClick={() => setPreserveAudio(!preserveAudio)}
                            className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {preserveAudio ? (
                                <Volume2 size={16} className="text-emerald-400" />
                              ) : (
                                <VolumeX size={16} className="text-slate-500" />
                              )}
                              <div>
                                <span className="text-xs font-bold text-white block">الصوت الأصلي</span>
                                <span className="text-[10px] text-slate-400 block">{preserveAudio ? 'استخراج كـ MP3 ID3' : 'بدون صوت (مكتوم)'}</span>
                              </div>
                            </div>
                            <div className={`w-8 h-4 rounded-full transition-colors relative ${preserveAudio ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                              <div className={`w-3 h-3 rounded-full bg-white transition-transform absolute top-0.5 ${preserveAudio ? 'right-4' : 'right-1'}`} />
                            </div>
                          </div>

                          {/* Quality Engine Toggle */}
                          <div 
                            onClick={() => setQualityMode(qualityMode === 'fast' ? 'high' : 'fast')}
                            className="p-3 rounded-2xl bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Zap size={16} className={qualityMode === 'fast' ? 'text-amber-400' : 'text-indigo-400'} />
                              <div>
                                <span className="text-xs font-bold text-white block">محرك المعالجة</span>
                                <span className="text-[10px] text-slate-400 block">{qualityMode === 'fast' ? '⚡ فائق السرعة' : '💎 جودة PNG كاملة'}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                              تغيير
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----------------- TAB 2: CROP & TRIM ----------------- */}
                    {activeSettingsTab === 'crop' && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Top & Bottom Cropping Studio */}
                        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-3 shadow-md shadow-rose-500/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                                <Crop size={14} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white block">قص وحذف أجزاء الفيديو (أعلى وأسفل):</span>
                                <span className="text-[10px] text-rose-300/80 block">إزالة الشعارات والحواف السوداء غير المرغوبة بدقة</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSymmetricCrop(!symmetricCrop)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  symmetricCrop ? 'bg-rose-500 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                                }`}
                              >
                                {symmetricCrop ? <Lock size={11} /> : <Unlock size={11} />}
                                <span>{symmetricCrop ? 'متماثل' : 'حر'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => { setCropTop(0); setCropBottom(0); }}
                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] border border-white/10 cursor-pointer"
                              >
                                إعادة ضبط (0%)
                              </button>
                            </div>
                          </div>

                          {/* Quick Presets */}
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-400 shrink-0">قص سريع:</span>
                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                              {[
                                { label: '0% (بدون)', val: 0 },
                                { label: '5% حواف', val: 5 },
                                { label: '10% شريط', val: 10 },
                                { label: '15% متوازن', val: 15 },
                                { label: '20% سينمائي', val: 20 },
                              ].map((p) => (
                                <button
                                  key={p.val}
                                  type="button"
                                  onClick={() => { setCropTop(p.val); setCropBottom(p.val); }}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                                    cropTop === p.val && cropBottom === p.val
                                      ? 'bg-rose-500 text-white shadow-sm'
                                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Sliders Grid */}
                          <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-rose-300 font-bold">✂️ قص من الأعلى:</span>
                                <span className="font-mono font-bold text-white bg-rose-500/20 px-1.5 py-0.5 rounded">
                                  {cropTop}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="45"
                                step="1"
                                value={cropTop}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setCropTop(val);
                                  if (symmetricCrop) setCropBottom(val);
                                }}
                                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-rose-300 font-bold">✂️ قص من الأسفل:</span>
                                <span className="font-mono font-bold text-white bg-rose-500/20 px-1.5 py-0.5 rounded">
                                  {cropBottom}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="45"
                                step="1"
                                value={cropBottom}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setCropBottom(val);
                                  if (symmetricCrop) setCropTop(val);
                                }}
                                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Video Trimmer Section (قص زمني يدوي) */}
                        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/25 space-y-3 shadow-md shadow-sky-500/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                                <Scissors size={14} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-white block">قص المقطع الزمني (Trim):</span>
                                <span className="text-[10px] text-sky-300/80 block">تحديد جزء معين فقط من الفيديو لاستدعائه</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDurationMode('trim');
                                if (trimEnd <= 0 && activeProbe) setTrimEnd(activeProbe.duration);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                durationMode === 'trim'
                                  ? 'bg-sky-500 text-white shadow-sm'
                                  : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
                              }`}
                            >
                              {durationMode === 'trim' ? 'مفعّل ✓' : 'تفعيل القص الزمني'}
                            </button>
                          </div>

                          {durationMode === 'trim' && (
                            <div className="grid grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl border border-white/5 animate-in fade-in">
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-400 font-bold">بداية المقطع:</span>
                                  <button
                                    type="button"
                                    onClick={() => setTrimStart(currentTime)}
                                    className="text-[9px] text-sky-300 hover:underline cursor-pointer"
                                  >
                                    [ ضبط {currentTime.toFixed(1)}ث
                                  </button>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max={trimEnd > 0 ? trimEnd : (activeProbe?.duration || 60)}
                                  step="0.1"
                                  value={trimStart}
                                  onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                                  className="w-full bg-white/10 border border-white/15 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center outline-none focus:border-sky-400"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-slate-400 font-bold">نهاية المقطع:</span>
                                  <button
                                    type="button"
                                    onClick={() => setTrimEnd(currentTime)}
                                    className="text-[9px] text-indigo-300 hover:underline cursor-pointer"
                                  >
                                    ضبط {currentTime.toFixed(1)}ث ]
                                  </button>
                                </div>
                                <input
                                  type="number"
                                  min={trimStart}
                                  max={activeProbe?.duration || 120}
                                  step="0.1"
                                  value={trimEnd || (activeProbe?.duration || 0)}
                                  onChange={(e) => setTrimEnd(Math.max(trimStart + 0.1, parseFloat(e.target.value) || (activeProbe?.duration || 0)))}
                                  className="w-full bg-white/10 border border-white/15 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center outline-none focus:border-indigo-400"
                                />
                              </div>
                            </div>
                          )}

                          {/* Button to Launch Full Visual Studio */}
                          <button
                            type="button"
                            onClick={() => setShowTrimmerStudio(true)}
                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600/20 via-indigo-600/20 to-purple-600/20 hover:from-sky-600/30 hover:to-purple-600/30 border border-sky-400/30 text-white text-xs font-black flex items-center justify-between transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 text-sky-200">
                              <Scissors size={13} />
                              استوديو التايم لاين والمقص الاحترافي المصور (PRO RETIMING)
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold">
                              فتح الاستوديو ⚡
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ----------------- TAB 3: ADVANCED & FPS ----------------- */}
                    {activeSettingsTab === 'advanced' && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* FPS Selector */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white block">معدل الإطارات في الثانية (FPS):</span>
                            <span className="text-[11px] font-mono font-black text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-500/30">
                              {fps} FPS
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: '12 fps (خفيف)', val: 12 },
                              { label: '15 fps (الموصى به) ★', val: 15 },
                              { label: '24 fps (سينمائي)', val: 24 },
                              { label: '30 fps (سلس)', val: 30 },
                            ].map((item) => (
                              <button
                                key={item.val}
                                type="button"
                                onClick={() => setFps(item.val)}
                                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                                  fps === item.val
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                                    : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Max Frames Limit */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white block">حد الإطارات الأقصى (Max Frames Limit):</span>
                            <span className="text-[11px] font-mono font-black text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-500/30">
                              {maxFramesLimit > 0 ? `${maxFramesLimit} إطار` : 'كافة الإطارات'}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: '30 إطار ⚡', val: 30 },
                              { label: '45 إطار', val: 45 },
                              { label: '90 إطار', val: 90 },
                              { label: 'الكل (بلا حد)', val: 0 },
                            ].map((item, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setMaxFramesLimit(item.val)}
                                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                                  maxFramesLimit === item.val
                                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400'
                                    : 'bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Duration Strategy */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2">
                          <span className="text-xs font-bold text-white block">طريقة معالجة مدة الفيديو المختصرة:</span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setDurationStrategy('crop_start')}
                              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                durationStrategy === 'crop_start'
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-[11px] font-bold flex items-center justify-between mb-1">
                                <span>قص البداية (Natural 1:1)</span>
                                <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 rounded font-bold">طبيعي ⚡</span>
                              </div>
                              <p className="text-[9px] text-slate-400 leading-tight">
                                يبدأ فوراً من اللقطة الأولى بسرعة 1:1 الطبيعية وبدون تسريع حركة.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDurationStrategy('compress_full')}
                              className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                                durationStrategy === 'compress_full'
                                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 ring-1 ring-indigo-400/50'
                                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="text-[11px] font-bold flex items-center justify-between mb-1">
                                <span>تسريع وضغط كامل الفيديو</span>
                                <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1 rounded font-bold">ضغط</span>
                              </div>
                              <p className="text-[9px] text-slate-400 leading-tight">
                                ضغط كل ثواني الفيديو الأصلية كاملة داخل المدة المحددة.
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Persistent Live Export Summary Card */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 border border-indigo-500/30 text-xs text-indigo-200 flex flex-wrap items-center justify-between gap-2 shadow-lg">
                      <span className="flex items-center gap-1.5 font-bold text-white">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>الناتج المعتمد لـ SVGA:</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          {customWidth} × {customHeight} px
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          {targetDurationSeconds.toFixed(1)} ثانية
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                          {estimatedFrames} إطار @ {fps}fps
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          {preserveAudio ? '🔊 مع الصوت' : '🔇 مكتوم'}
                        </span>
                      </div>
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
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-slate-900/90 gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 sm:px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              إلغاء
            </button>

            {files.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || !activeFile}
                className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
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

      {/* Standalone Video Trimmer & Top/Bottom Cropper Studio Modal */}
      {activeFile && showTrimmerStudio && (
        <VideoTrimmerModal
          isOpen={showTrimmerStudio}
          onClose={() => setShowTrimmerStudio(false)}
          videoUrl={URL.createObjectURL(activeFile)}
          videoFile={activeFile}
          initialDuration={activeProbe?.duration || 10}
          initialSettings={{
            mode: durationMode === 'trim' ? 'trim' : durationMode === 'custom' ? 'fit_duration' : (cropTop > 0 || cropBottom > 0) ? 'crop_spatial' : 'full',
            startTime: trimStart,
            endTime: trimEnd > 0 ? trimEnd : (activeProbe?.duration || 10),
            targetDuration: customDuration,
            speedMultiplier: 1.0,
            segmentStart: 0,
            segmentEnd: activeProbe?.duration || 10,
            segmentSpeedMultiplier: 2.0,
            cropTop: cropTop || 0,
            cropBottom: cropBottom || 0,
          }}
          fps={fps}
          onApply={(applied) => {
            if (applied.mode === 'trim') {
              setDurationMode('trim');
              setTrimStart(applied.startTime);
              setTrimEnd(applied.endTime);
            } else if (applied.mode === 'fit_duration') {
              setDurationMode('custom');
              setCustomDuration(applied.targetDuration);
            } else if (applied.mode === 'full') {
              setDurationMode('original');
            }
            if (applied.cropTop !== undefined) setCropTop(applied.cropTop);
            if (applied.cropBottom !== undefined) setCropBottom(applied.cropBottom);
          }}
        />
      )}
    </AnimatePresence>
  );
};
