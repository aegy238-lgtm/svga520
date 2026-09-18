import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Clock,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Settings,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  UploadCloud,
  Trash2,
  Sliders,
  Archive,
  Info,
  Film,
  Video,
  Check,
  Zap,
} from 'lucide-react';
import {
  VideoMeta,
  VideoSpeedSettings,
  BatchItemStatus,
  extractVideoMetadata,
  processVideoSpeedInBrowser,
  createBatchResultsZip,
  formatFileSize,
} from '../utils/videoDurationEngine';

interface VideoDurationSpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFiles?: File[];
  currentDuration?: number;
  onApplyToConverter?: (targetDuration: number, speedMultiplier: number) => void;
}

export const VideoDurationSpeedModal: React.FC<VideoDurationSpeedModalProps> = ({
  isOpen,
  onClose,
  initialFiles = [],
  currentDuration = 10,
  onApplyToConverter,
}) => {
  // Batch Queue State
  const [items, setItems] = useState<BatchItemStatus[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Global Settings vs Independent Duration
  const [applyToAll, setApplyToAll] = useState<boolean>(true);
  const [globalTargetDuration, setGlobalTargetDuration] = useState<number>(
    currentDuration > 0 ? currentDuration : 10
  );

  // Export Settings
  const [settings, setSettings] = useState<VideoSpeedSettings>({
    targetDuration: currentDuration > 0 ? currentDuration : 10,
    exportFps: 30,
    qualityBitrateMbps: 8,
    resolutionScale: 1.0,
    format: 'mp4',
    preserveAudio: true,
    muteAudio: false,
  });

  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);

  // Video Preview State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Processing state
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const abortControllerRef = useRef<boolean>(false);

  const activeItem = items[selectedIndex] || null;

  // Initialize items when modal opens or initialFiles change
  useEffect(() => {
    if (!isOpen) return;

    if (initialFiles.length > 0 && items.length === 0) {
      loadFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  const loadFiles = async (files: File[]) => {
    const newItems: BatchItemStatus[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `${file.name}-${file.size}-${Date.now()}-${i}`;
      newItems.push({
        id,
        file,
        meta: null,
        targetDuration: globalTargetDuration,
        status: 'pending',
        progress: 0,
        currentFrame: 0,
        totalFrames: 0,
      });
    }

    setItems((prev) => [...prev, ...newItems]);

    // Extract metadata asynchronously
    newItems.forEach(async (item) => {
      try {
        const meta = await extractVideoMetadata(item.file);
        setItems((current) =>
          current.map((it) => (it.id === item.id ? { ...it, meta } : it))
        );
      } catch (err) {
        console.warn('Metadata extraction error for', item.file.name, err);
      }
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('video/') || f.name.match(/\.(mp4|webm|mov|mkv|avi)$/i)
      );
      if (validFiles.length > 0) {
        loadFiles(validFiles);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFiles(Array.from(e.target.files));
    }
  };

  // Selected item metrics
  const origDuration = activeItem?.meta?.duration || 20;
  const currentTargetDuration = applyToAll
    ? globalTargetDuration
    : activeItem?.targetDuration || globalTargetDuration;

  const speedMultiplier = useMemo(() => {
    if (!currentTargetDuration || currentTargetDuration <= 0) return 1;
    return Math.max(0.01, origDuration / currentTargetDuration);
  }, [origDuration, currentTargetDuration]);

  // Sync playbackRate with speedMultiplier
  useEffect(() => {
    if (videoRef.current) {
      // HTMLVideoElement standard playbackRate clamps between 0.0625 and 16 in most browsers
      const clampedRate = Math.min(16, Math.max(0.0625, speedMultiplier));
      videoRef.current.playbackRate = clampedRate;
    }
  }, [speedMultiplier, selectedIndex]);

  // Video Preview Handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback prevented:', err);
      });
    }
  };

  const restartVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Target Duration changes
  const handleDurationChange = (val: number) => {
    const sanitized = Math.max(0.1, val);
    if (applyToAll) {
      setGlobalTargetDuration(sanitized);
      setItems((prev) =>
        prev.map((it) => ({ ...it, targetDuration: sanitized }))
      );
    } else if (activeItem) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === activeItem.id ? { ...it, targetDuration: sanitized } : it
        )
      );
    }
  };

  // Quick preset buttons
  const quickPresets = [2, 5, 10, 15, 30];

  // Process a single item
  const processSingleItem = async (
    item: BatchItemStatus
  ): Promise<{ success: boolean; resultBlob?: Blob; resultUrl?: string; resultFileName?: string; error?: string }> => {
    const itemTargetDur = applyToAll ? globalTargetDuration : item.targetDuration;
    const currentSettings: VideoSpeedSettings = {
      ...settings,
      targetDuration: itemTargetDur,
    };

    try {
      const result = await processVideoSpeedInBrowser(
        item.file,
        currentSettings,
        (progress, frame, total) => {
          setItems((current) =>
            current.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    progress,
                    currentFrame: frame,
                    totalFrames: total,
                  }
                : it
            )
          );
        }
      );

      const url = URL.createObjectURL(result.blob);
      return {
        success: true,
        resultBlob: result.blob,
        resultUrl: url,
        resultFileName: result.fileName,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'فشل في معالجة الفيديو',
      };
    }
  };

  // Process all pending/failed items in Queue
  const runBatchProcessing = async (onlyFailed: boolean = false) => {
    if (items.length === 0 || isProcessingBatch) return;

    setIsProcessingBatch(true);
    abortControllerRef.current = false;

    const targets = items.filter((it) =>
      onlyFailed ? it.status === 'failed' : it.status !== 'completed'
    );

    let completedCount = items.filter((it) => it.status === 'completed').length;
    const totalToProcess = targets.length;

    for (let i = 0; i < targets.length; i++) {
      if (abortControllerRef.current) break;

      const item = targets[i];

      setItems((current) =>
        current.map((it) =>
          it.id === item.id
            ? { ...it, status: 'processing', progress: 0, error: undefined }
            : it
        )
      );

      const res = await processSingleItem(item);

      if (res.success) {
        completedCount++;
        setItems((current) =>
          current.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'completed',
                  progress: 100,
                  resultBlob: res.resultBlob,
                  resultUrl: res.resultUrl,
                  resultFileName: res.resultFileName,
                  outputDuration: applyToAll ? globalTargetDuration : item.targetDuration,
                  speedMultiplier: (item.meta?.duration || 20) / (applyToAll ? globalTargetDuration : item.targetDuration),
                }
              : it
          )
        );
      } else {
        setItems((current) =>
          current.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'failed',
                  error: res.error,
                  progress: 0,
                }
              : it
          )
        );
      }

      setOverallProgress(Math.round(((i + 1) / totalToProcess) * 100));
    }

    setIsProcessingBatch(false);
  };

  // Download all completed as ZIP
  const handleDownloadAllZip = async () => {
    const completedItems = items.filter((it) => it.status === 'completed' && it.resultBlob);
    if (completedItems.length === 0) return;

    try {
      const zipBlob = await createBatchResultsZip(completedItems);
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `videos_duration_compressed_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      alert('حدث خطأ أثناء تجميع ملف ZIP');
    }
  };

  const handleApplyToMainConverter = () => {
    if (onApplyToConverter) {
      onApplyToConverter(currentTargetDuration, speedMultiplier);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl p-3 md:p-6 overflow-y-auto"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-6xl bg-slate-950 border border-amber-500/30 rounded-[2.5rem] shadow-2xl shadow-amber-500/10 flex flex-col max-h-[92vh] overflow-hidden text-right"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <FastForward className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-black text-base md:text-lg">
                    التحكم في مدة الفيديو بالسرعة بدون قص أي مشهد
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Zero-Crop Speed Fit
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  تغيير المدة الإجمالية للفيديو عبر تسريع/إبطاء العرض بالكامل مع الحفاظ على كافة المشاهد، الإطارات، والصوت
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                  showSettingsDrawer
                    ? 'bg-amber-500 text-white border-amber-400 shadow-glow-amber'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">إعدادات التصدير</span>
              </button>

              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-slate-400 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Top Critical Rule Notice */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs leading-relaxed text-amber-200">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-amber-300 ml-1">قاعدة تقنية أساسية:</span>
                المدة المطلوبة لا تعني قص الفيديو على الإطلاق. يتم ضغط كامل محتوى الفيديو من الثانية الأولى حتى الأخيرة
                بحيث تظهر كافة الرسوم والحركات بدون حذف أي جزء منها، وذلك بحساب معامل السرعة تلقائياً.
              </div>
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (Video Preview & Controls) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Active Video Player Preview */}
                <div className="relative aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center group shadow-inner">
                  {activeItem ? (
                    <>
                      <video
                        ref={videoRef}
                        src={URL.createObjectURL(activeItem.file)}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setIsPlaying(false)}
                        muted={isMuted}
                        playsInline
                        className="w-full h-full object-contain"
                      />

                      {/* Speed Watermark Badge */}
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-xs font-black text-white flex items-center gap-1.5 shadow-lg">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        السرعة: {speedMultiplier.toFixed(2)}×
                      </div>

                      {/* Video Player Overlay Controls */}
                      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-2 opacity-95 group-hover:opacity-100 transition-opacity">
                        <input
                          type="range"
                          min="0"
                          max={origDuration}
                          step="0.05"
                          value={currentTime}
                          onChange={handleSeek}
                          className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="flex items-center justify-between text-xs text-white">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={togglePlay}
                              className="p-2 rounded-lg bg-white/10 hover:bg-amber-500 hover:text-white transition-colors"
                            >
                              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                            </button>
                            <button
                              onClick={restartVideo}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                              title="إعادة للبداية"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setIsMuted(!isMuted)}
                              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                              title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                            >
                              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                            <span className="font-mono text-[11px] text-slate-300">
                              {currentTime.toFixed(1)}s / {origDuration.toFixed(1)}s
                            </span>
                          </div>

                          <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <span>معاينة بالسرعة الحقيقية:</span>
                            <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                              {speedMultiplier.toFixed(2)}×
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Film className="w-12 h-12 mb-2 text-slate-600 animate-pulse" />
                      <p className="text-sm font-bold">لا يوجد فيديو محدد حالياً</p>
                      <p className="text-xs text-slate-600 mt-1">قم برفع فيديو من القائمة الجانبية للبدء</p>
                    </div>
                  )}
                </div>

                {/* Section 1: Video Information Display (Requirement 1) */}
                {activeItem && (
                  <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-sky-400" />
                        بيانات ومعلومات الفيديو
                      </span>
                      <span className="text-xs font-bold text-white max-w-[240px] truncate" title={activeItem.file.name}>
                        «{activeItem.file.name}»
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">المدة الأصلية</div>
                        <div className="text-sm font-black text-amber-400 mt-0.5">
                          {origDuration.toFixed(2)} ثانية
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">المدة النهائية</div>
                        <div className="text-sm font-black text-emerald-400 mt-0.5">
                          {currentTargetDuration.toFixed(2)} ثانية
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">حجم الملف</div>
                        <div className="text-xs font-black text-slate-200 mt-0.5">
                          {activeItem.meta?.sizeFormatted || formatFileSize(activeItem.file.size)}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-[10px] text-slate-400 font-bold">الدقة / الأبعاد</div>
                        <div className="text-xs font-black text-slate-200 mt-0.5">
                          {activeItem.meta ? `${activeItem.meta.width}×${activeItem.meta.height}` : 'جاري الفحص...'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4 & Section 10: Comparison Bar */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold">المدة الأصلية</div>
                      <div className="text-base font-black text-white font-mono">{origDuration.toFixed(2)}s</div>
                    </div>
                    <div className="text-slate-600 font-black">←</div>
                    <div>
                      <div className="text-[10px] text-amber-400 font-bold">المدة المطلوبة</div>
                      <div className="text-base font-black text-amber-400 font-mono">{currentTargetDuration.toFixed(2)}s</div>
                    </div>
                  </div>

                  <div className="text-left bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/30">
                    <div className="text-[10px] text-amber-300 font-bold">السرعة المحسوبة</div>
                    <div className="text-lg font-black text-amber-400 font-mono">
                      {speedMultiplier.toFixed(2)}×
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Duration Input, Presets & Batch Queue */}
              <div className="lg:col-span-5 space-y-5">
                {/* Section 2: Target Duration Input Box */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      المدة المطلوبة
                    </label>

                    {/* Batch Scope Switch (Section 7 & 10) */}
                    {items.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-[10px]">
                        <button
                          onClick={() => setApplyToAll(true)}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                            applyToAll ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          مدة موحدة للجميع
                        </button>
                        <button
                          onClick={() => setApplyToAll(false)}
                          className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                            !applyToAll ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          مدة مستقلة لكل فيديو
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Main Input Field */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0.1"
                        max="300"
                        step="0.1"
                        value={currentTargetDuration}
                        onChange={(e) => handleDurationChange(parseFloat(e.target.value) || 1)}
                        className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-2xl px-4 py-3.5 text-center text-xl font-black text-white outline-none transition-all shadow-inner font-mono"
                        placeholder="10.0"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        ثانية
                      </span>
                    </div>

                    <button
                      onClick={togglePlay}
                      className="px-4 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 fill-white" />}
                      <span>معاينة</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons (Section 2) */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-slate-400 font-bold">مدد سريعة جاهزة:</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {quickPresets.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => handleDurationChange(preset)}
                          className={`py-2 rounded-xl text-xs font-black transition-all border ${
                            Math.abs(currentTargetDuration - preset) < 0.05
                              ? 'bg-amber-500 text-white border-amber-400 shadow-glow-amber scale-105'
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {preset}s {preset === 10 ? '🎯' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Range Slider */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>0.5s</span>
                      <span>سلايدر التحكم الدقيق</span>
                      <span>{Math.max(30, Math.ceil(origDuration))}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max={Math.max(30, Math.ceil(origDuration))}
                      step="0.5"
                      value={currentTargetDuration}
                      onChange={(e) => handleDurationChange(parseFloat(e.target.value) || 1)}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* Technical Limit Warning (Section 6) */}
                  {speedMultiplier > 30 && (
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-[11px] text-orange-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-orange-400" />
                      <span>
                        تنبيه سرعة فائقة ({speedMultiplier.toFixed(1)}×): سيتم الحفاظ على كل المشاهد مع استخلاص عينات
                        إطارات متوازنة لتجنب بطء المتصفح.
                      </span>
                    </div>
                  )}
                </div>

                {/* Section 7: Batch Queue List */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-black text-white">قائمة الفيديوهات المرفوعة ({items.length})</span>
                    </div>

                    <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-black flex items-center gap-1.5 transition-all">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>إضافة فيديوهات</span>
                      <input
                        type="file"
                        multiple
                        accept="video/*,.mp4,.webm,.mov"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Drag-drop or list */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="max-h-48 overflow-y-auto space-y-2 pr-1"
                  >
                    {items.map((item, idx) => {
                      const itemSpeed = (item.meta?.duration || 20) / (applyToAll ? globalTargetDuration : item.targetDuration);
                      const isSelected = idx === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedIndex(idx)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/5">
                              {item.status === 'processing' ? (
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                              ) : item.status === 'completed' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : item.status === 'failed' ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              ) : (
                                <Film className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="truncate text-right">
                              <div className="text-xs font-bold truncate max-w-[150px]">{item.file.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                <span>{item.meta ? `${item.meta.duration.toFixed(1)}s` : '...'}</span>
                                <span>←</span>
                                <span className="text-amber-300 font-bold">
                                  {(applyToAll ? globalTargetDuration : item.targetDuration).toFixed(1)}s
                                </span>
                                <span>({itemSpeed.toFixed(1)}×)</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === 'processing' && (
                              <span className="text-[10px] font-mono text-amber-400 font-bold">
                                {item.progress}%
                              </span>
                            )}

                            {item.status === 'completed' && item.resultUrl && (
                              <a
                                href={item.resultUrl}
                                download={item.resultFileName || 'video.mp4'}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                                title="تحميل الفيديو الناتج"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItems((prev) => prev.filter((_, i) => i !== idx));
                                if (selectedIndex >= idx && selectedIndex > 0) {
                                  setSelectedIndex((s) => s - 1);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {items.length === 0 && (
                      <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-slate-500 text-xs">
                        قم بسحب وإفلات الفيديوهات هنا أو انقر على «إضافة فيديوهات»
                      </div>
                    )}
                  </div>

                  {/* Batch Actions & Retry */}
                  {items.length > 0 && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
                      {items.some((it) => it.status === 'failed') && (
                        <button
                          onClick={() => runBatchProcessing(true)}
                          disabled={isProcessingBatch}
                          className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold border border-red-500/30 flex items-center gap-1.5 transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          إعادة معالجة الفاشل فقط
                        </button>
                      )}

                      {items.some((it) => it.status === 'completed') && (
                        <button
                          onClick={handleDownloadAllZip}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-all mr-auto"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          تنزيل الكل (ZIP)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Export Settings Drawer (Section 9) */}
            <AnimatePresence>
              {showSettingsDrawer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
                    <h4 className="text-white font-black text-xs uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      إعدادات جودة وضبط التصدير
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      {/* Format */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold block">صيغة التصدير</label>
                        <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                          {(['mp4', 'webm', 'svga'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              onClick={() => setSettings((s) => ({ ...s, format: fmt }))}
                              className={`flex-1 py-1.5 rounded-lg font-black uppercase text-[11px] transition-all ${
                                settings.format === fmt
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {fmt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* FPS */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold block">معدل الإطارات (FPS)</label>
                        <select
                          value={settings.exportFps}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, exportFps: parseInt(e.target.value) || 30 }))
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
                        >
                          <option value="15">15 FPS (خفيف للحزم)</option>
                          <option value="24">24 FPS (سينمائي)</option>
                          <option value="30">30 FPS (الافتراضي المتوازن)</option>
                          <option value="60">60 FPS (سلاسة فائقة)</option>
                        </select>
                      </div>

                      {/* Bitrate */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold block">جودة البت ريت (Bitrate)</label>
                        <select
                          value={settings.qualityBitrateMbps}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              qualityBitrateMbps: parseFloat(e.target.value) || 8,
                            }))
                          }
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none"
                        >
                          <option value="4">4 Mbps (مضغوط وحجم صغير)</option>
                          <option value="8">8 Mbps (جودة قياسية متوازنة)</option>
                          <option value="16">16 Mbps (جودة فائقة Ultra HD)</option>
                        </select>
                      </div>

                      {/* Audio behavior */}
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-bold block">معالجة الصوت</label>
                        <button
                          onClick={() => setSettings((s) => ({ ...s, muteAudio: !s.muteAudio }))}
                          className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between font-bold transition-all ${
                            !settings.muteAudio
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-red-500/10 border-red-500/30 text-red-300'
                          }`}
                        >
                          <span>{settings.muteAudio ? 'الصوت مكتوم' : 'تسريع الصوت بالتزامن'}</span>
                          {settings.muteAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 md:p-6 border-t border-white/10 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              {onApplyToConverter && (
                <button
                  onClick={handleApplyToMainConverter}
                  className="px-5 py-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-black transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>تطبيق هذه المدة على المحول الرئيسي ({currentTargetDuration.toFixed(1)}s)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-colors"
              >
                إغلاق
              </button>

              <button
                onClick={() => runBatchProcessing(false)}
                disabled={isProcessingBatch || items.length === 0}
                className={`px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                  isProcessingBatch || items.length === 0
                    ? 'bg-amber-500/40 text-white/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-xl shadow-amber-500/25 active:scale-98'
                }`}
              >
                {isProcessingBatch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري معالجة الفيديوهات محلياً ({overallProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <FastForward className="w-4 h-4" />
                    <span>
                      {items.length > 1
                        ? `بدء معالجة الدفعة (${items.length} فيديوهات)`
                        : 'تصدير الفيديو بالسرعة الجديدة'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
