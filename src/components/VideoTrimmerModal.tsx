import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Scissors,
  Zap,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Layers,
  Sparkles,
  Sliders,
  Check,
  X,
  Eye,
  Info,
  Film,
  Gauge,
  FastForward,
  Timer,
  ArrowRight,
  Move,
  Grid,
} from "lucide-react";

export interface TimingSettings {
  mode: "full" | "trim" | "fit_duration" | "speed_multiplier" | "segment_speed";
  startTime: number;
  endTime: number;
  targetDuration: number;
  speedMultiplier: number;
  segmentStart: number;
  segmentEnd: number;
  segmentSpeedMultiplier: number;
}

export const DEFAULT_TIMING_SETTINGS: TimingSettings = {
  mode: "full",
  startTime: 0,
  endTime: 0,
  targetDuration: 10,
  speedMultiplier: 1.0,
  segmentStart: 0,
  segmentEnd: 0,
  segmentSpeedMultiplier: 2.0,
};

export function calculateOutputDuration(
  duration: number,
  settings: TimingSettings,
): number {
  if (!duration || duration <= 0) return 0;

  if (settings.mode === "full") {
    return duration;
  }
  if (settings.mode === "trim") {
    return Math.max(0.05, (settings.endTime || duration) - (settings.startTime || 0));
  }
  if (settings.mode === "fit_duration") {
    return Math.max(0.1, settings.targetDuration || 10);
  }
  if (settings.mode === "speed_multiplier") {
    const end = settings.endTime > settings.startTime ? settings.endTime : duration;
    const start = settings.startTime || 0;
    const sourceRange = Math.max(0.05, end - start);
    return Math.max(0.1, sourceRange / Math.max(0.1, settings.speedMultiplier || 1));
  }
  if (settings.mode === "segment_speed") {
    const segStart = Math.min(settings.segmentStart, duration);
    const segEnd = Math.min(Math.max(settings.segmentEnd, segStart + 0.05), duration);
    const mult = Math.max(0.1, settings.segmentSpeedMultiplier || 2);
    const part1 = segStart;
    const part2 = (segEnd - segStart) / mult;
    const part3 = Math.max(0, duration - segEnd);
    return Math.max(0.1, part1 + part2 + part3);
  }
  return duration;
}

export function getTimeForFrame(
  i: number,
  totalFrames: number,
  duration: number,
  settings: TimingSettings,
): number {
  if (totalFrames <= 1) return settings.startTime || 0;

  if (settings.mode === "full") {
    return Math.min(duration, Math.max(0, (i / (totalFrames - 1)) * duration));
  }

  if (settings.mode === "trim") {
    const start = settings.startTime || 0;
    const end = settings.endTime > start ? settings.endTime : duration;
    const range = Math.max(0.01, end - start);
    return Math.min(end, Math.max(start, start + (i / (totalFrames - 1)) * range));
  }

  if (settings.mode === "fit_duration") {
    const start = settings.startTime || 0;
    const end = settings.endTime > start ? settings.endTime : duration;
    const range = Math.max(0.01, end - start);
    const progress = i / (totalFrames - 1);
    return Math.min(end, Math.max(start, start + progress * range));
  }

  if (settings.mode === "speed_multiplier") {
    const start = settings.startTime || 0;
    const end = settings.endTime > start ? settings.endTime : duration;
    const range = Math.max(0.01, end - start);
    const progress = i / (totalFrames - 1);
    return Math.min(end, Math.max(start, start + progress * range));
  }

  if (settings.mode === "segment_speed") {
    const segStart = Math.min(settings.segmentStart, duration);
    const segEnd = Math.min(Math.max(settings.segmentEnd, segStart + 0.05), duration);
    const mult = Math.max(0.1, settings.segmentSpeedMultiplier || 2);

    const part1Dur = segStart;
    const part2Dur = (segEnd - segStart) / mult;
    const part3Dur = Math.max(0, duration - segEnd);
    const totalOutDur = part1Dur + part2Dur + part3Dur;

    const outTime = (i / (totalFrames - 1)) * totalOutDur;
    if (outTime < part1Dur) {
      return Math.min(duration, Math.max(0, outTime));
    } else if (outTime < part1Dur + part2Dur) {
      const segProgress = (outTime - part1Dur) / Math.max(0.001, part2Dur);
      return Math.min(
        duration,
        Math.max(0, segStart + segProgress * (segEnd - segStart)),
      );
    } else {
      const postTime = outTime - (part1Dur + part2Dur);
      return Math.min(duration, Math.max(0, segEnd + postTime));
    }
  }

  return (i / totalFrames) * duration;
}

interface VideoTrimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoFile?: File | null;
  initialDuration: number;
  initialSettings: TimingSettings;
  fps?: number;
  onApply: (settings: TimingSettings) => void;
}

export const VideoTrimmerModal: React.FC<VideoTrimmerModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoFile,
  initialDuration,
  initialSettings,
  fps = 30,
  onApply,
}) => {
  const [settings, setSettings] = useState<TimingSettings>(() => {
    return {
      ...DEFAULT_TIMING_SETTINGS,
      ...initialSettings,
      endTime: initialSettings.endTime > 0 ? initialSettings.endTime : initialDuration,
      targetDuration: initialSettings.targetDuration || 10,
      segmentEnd: initialSettings.segmentEnd > 0 ? initialSettings.segmentEnd : initialDuration,
    };
  });

  const [duration, setDuration] = useState<number>(initialDuration || 0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverThumbnail, setHoverThumbnail] = useState<string | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Inspector & Magnifier Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showCheckerboard, setShowCheckerboard] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const hoverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize duration and settings
  useEffect(() => {
    if (initialDuration > 0) {
      setDuration(initialDuration);
      setSettings((prev) => ({
        ...prev,
        endTime: prev.endTime > 0 ? prev.endTime : initialDuration,
        segmentEnd: prev.segmentEnd > 0 ? prev.segmentEnd : initialDuration,
      }));
    }
  }, [initialDuration]);

  // Extract High-Density Filmstrip Thumbnails
  useEffect(() => {
    if (!isOpen || !videoUrl || duration <= 0) return;

    let isCancelled = false;
    const generateThumbnails = async () => {
      setIsGeneratingThumbs(true);
      const count = 16;
      const vid = document.createElement("video");
      vid.src = videoUrl;
      vid.crossOrigin = "anonymous";
      vid.muted = true;
      vid.playsInline = true;

      await new Promise((resolve) => {
        vid.onloadeddata = resolve;
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setIsGeneratingThumbs(false);
        return;
      }

      const aspectRatio = (vid.videoWidth || 16) / (vid.videoHeight || 9);
      canvas.height = 72;
      canvas.width = Math.floor(72 * aspectRatio);

      const thumbs: string[] = [];
      const step = duration / count;

      for (let i = 0; i < count; i++) {
        if (isCancelled) break;
        vid.currentTime = Math.min(duration, i * step + step / 2);
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            vid.removeEventListener("seeked", onSeeked);
            resolve();
          };
          vid.addEventListener("seeked", onSeeked);
          setTimeout(resolve, 300);
        });
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL("image/jpeg", 0.6));
      }

      if (!isCancelled) {
        setThumbnails(thumbs);
      }
      setIsGeneratingThumbs(false);
    };

    generateThumbnails();

    return () => {
      isCancelled = true;
      setIsGeneratingThumbs(false);
    };
  }, [isOpen, videoUrl, duration]);

  // Handle Playback Loop and Boundaries
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set playback rate according to mode for live preview simulation
    let effectiveRate = 1.0;
    if (settings.mode === "fit_duration" && settings.targetDuration > 0 && duration > 0) {
      const sourceRange = Math.max(0.1, settings.endTime - settings.startTime);
      effectiveRate = Math.min(8, Math.max(0.25, sourceRange / settings.targetDuration));
    } else if (settings.mode === "speed_multiplier") {
      effectiveRate = Math.min(8, Math.max(0.25, settings.speedMultiplier));
    }

    try {
      video.playbackRate = effectiveRate;
    } catch {
      video.playbackRate = 1.0;
    }

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      const start = settings.mode === "full" ? 0 : settings.startTime;
      const end = settings.mode === "full" ? duration : settings.endTime;

      if (video.currentTime >= end) {
        video.currentTime = start;
        if (!video.loop) {
          video.play().catch(() => {});
        }
      } else if (video.currentTime < start) {
        video.currentTime = start;
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [settings, duration]);

  // Toggle Play / Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const start = settings.mode === "full" ? 0 : settings.startTime;
      const end = settings.mode === "full" ? duration : settings.endTime;
      if (video.currentTime >= end || video.currentTime < start) {
        video.currentTime = start;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Frame Step Seekers
  const stepFrames = (frames: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const frameDuration = 1 / fps;
    const newTime = Math.max(0, Math.min(duration, video.currentTime + frames * frameDuration));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const stepSeconds = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const setInPointToCurrent = () => {
    setSettings((prev) => ({
      ...prev,
      startTime: Math.min(currentTime, prev.endTime - 0.1),
      mode: prev.mode === "full" ? "trim" : prev.mode,
    }));
  };

  const setOutPointToCurrent = () => {
    setSettings((prev) => ({
      ...prev,
      endTime: Math.max(currentTime, prev.startTime + 0.1),
      mode: prev.mode === "full" ? "trim" : prev.mode,
    }));
  };

  // Pan / Zoom Controls
  const handleZoomChange = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.min(4, prev + delta));
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDraggingPan(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (!isDraggingPan || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUpPan = () => {
    setIsDraggingPan(false);
  };

  // Timeline Scrubbing & Hover
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pos * duration;
    setHoverTime(time);
    setHoverPosition(pos * 100);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  // Calculated Output Stats
  const outputDuration = calculateOutputDuration(duration, settings);
  const totalFramesCount = Math.max(1, Math.round(outputDuration * fps));
  const currentFrameNum = Math.floor(currentTime * fps) + 1;
  const totalSourceFrames = Math.max(1, Math.round(duration * fps));

  // Calculated Speedup Factor
  const effectiveSourceDur =
    settings.mode === "trim"
      ? settings.endTime - settings.startTime
      : duration;
  const speedFactor = effectiveSourceDur / (outputDuration || 1);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-200"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl shadow-black/80"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base">
                  استوديو القص وتسريع الفيديو الاحترافي
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                  PRO RETIMING
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                تحكم بالسرعة دون قص الفيديو، مع فحص دقيق لكل إطار ورسمة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two Columns on large screens */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5">
            <button
              onClick={() => setSettings((s) => ({ ...s, mode: "fit_duration" }))}
              className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all text-center ${
                settings.mode === "fit_duration"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20 font-black"
                  : "text-slate-400 hover:text-white hover:bg-white/5 font-bold"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <Zap className="w-4 h-4" />
                <span>تسريع كامل المدة (بدون قص)</span>
              </div>
              <span className="text-[10px] opacity-80">
                تسريع الفيديو ليصل لـ {settings.targetDuration}s بالكامل
              </span>
            </button>

            <button
              onClick={() => setSettings((s) => ({ ...s, mode: "trim" }))}
              className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all text-center ${
                settings.mode === "trim"
                  ? "bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20 font-black"
                  : "text-slate-400 hover:text-white hover:bg-white/5 font-bold"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <Scissors className="w-4 h-4" />
                <span>قص يدوي (تحديد مقطع)</span>
              </div>
              <span className="text-[10px] opacity-80">
                قص من البداية إلى النهاية
              </span>
            </button>

            <button
              onClick={() => setSettings((s) => ({ ...s, mode: "speed_multiplier" }))}
              className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all text-center ${
                settings.mode === "speed_multiplier"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-black"
                  : "text-slate-400 hover:text-white hover:bg-white/5 font-bold"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <Gauge className="w-4 h-4" />
                <span>مضاعف السرعة (Speed X)</span>
              </div>
              <span className="text-[10px] opacity-80">
                مضاعفة سرعة الحركة ({settings.speedMultiplier}x)
              </span>
            </button>

            <button
              onClick={() => setSettings((s) => ({ ...s, mode: "full" }))}
              className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all text-center ${
                settings.mode === "full"
                  ? "bg-white/15 text-white border border-white/20 font-black shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-white/5 font-bold"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <Film className="w-4 h-4" />
                <span>المدة الأصلية كاملة</span>
              </div>
              <span className="text-[10px] opacity-80">
                السرعة الطبيعية ({duration.toFixed(2)}s)
              </span>
            </button>
          </div>

          {/* Mode Configuration Banner */}
          {settings.mode === "fit_duration" && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <FastForward className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm">
                    ميزة تسريع الفيديو كاملاً دون قص أي رسمة
                  </h4>
                  <p className="text-slate-300 text-xs mt-0.5">
                    حدد المدة المستهدفة بالثواني (مثلاً 10 ثواني). سيتم تسريع كافة الحركات والرسومات لتعرض كاملة في هذه المدة.
                  </p>
                </div>
              </div>

              {/* Target Duration Selector & Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {[3, 5, 10, 15, 20].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setSettings((s) => ({ ...s, targetDuration: sec }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      settings.targetDuration === sec
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105"
                        : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {sec}s {sec === 10 ? "🎯" : ""}
                  </button>
                ))}

                <div className="flex items-center gap-1 bg-black/40 px-3 py-1 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-xs font-bold">مخصص:</span>
                  <input
                    type="number"
                    min="0.5"
                    max={duration || 120}
                    step="0.5"
                    value={settings.targetDuration}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        targetDuration: Math.max(0.5, parseFloat(e.target.value) || 1),
                      }))
                    }
                    className="w-16 bg-transparent text-amber-400 font-black text-center text-xs outline-none"
                  />
                  <span className="text-slate-400 text-xs">ثانية</span>
                </div>
              </div>
            </div>
          )}

          {settings.mode === "speed_multiplier" && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm">
                    تغيير مضاعف سرعة الفيديو (Time Multiplier)
                  </h4>
                  <p className="text-slate-300 text-xs mt-0.5">
                    اختر مضاعف السرعة لتسريع أو إبطاء الفيديو بالكامل.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[0.5, 0.75, 1.25, 1.5, 2.0, 3.0, 4.0].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => setSettings((s) => ({ ...s, speedMultiplier: mult }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      settings.speedMultiplier === mult
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105"
                        : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Inspection Canvas & Video Area */}
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex flex-col items-center">
            {/* Top Toolbar overlay on Video */}
            <div className="w-full px-4 py-2.5 bg-slate-950/80 border-b border-white/10 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1.5 text-xs text-white font-mono">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>{currentTime.toFixed(3)}s</span>
                  <span className="text-slate-500">/ {duration.toFixed(3)}s</span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    إطار: {currentFrameNum} / {totalSourceFrames}
                  </span>
                </div>
              </div>

              {/* Drawing Inspector Tools (Zoom, Checkerboard, Grid) */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowCheckerboard(!showCheckerboard)}
                  title="خلفية الشفافية (Checkerboard)"
                  className={`p-1.5 rounded-lg text-xs transition-all flex items-center gap-1 ${
                    showCheckerboard
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden sm:inline">خلفية شفافة</span>
                </button>

                <button
                  onClick={() => setShowGrid(!showGrid)}
                  title="شبكة الرسم"
                  className={`p-1.5 rounded-lg text-xs transition-all flex items-center gap-1 ${
                    showGrid
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden sm:inline">شبكة المحاذاة</span>
                </button>

                <div className="h-4 w-px bg-white/10 mx-1" />

                <button
                  onClick={() => handleZoomChange(-0.5)}
                  disabled={zoomLevel <= 1}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-sky-400 w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => handleZoomChange(0.5)}
                  disabled={zoomLevel >= 4}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                {zoomLevel > 1 && (
                  <button
                    onClick={() => {
                      setZoomLevel(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold"
                  >
                    إعادة ضبط
                  </button>
                )}
              </div>
            </div>

            {/* Video Viewport Container */}
            <div
              className={`relative w-full aspect-video max-h-[380px] overflow-hidden flex items-center justify-center select-none ${
                showCheckerboard ? "bg-checkered" : "bg-black"
              } ${zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
              onMouseDown={handleMouseDownPan}
              onMouseMove={handleMouseMovePan}
              onMouseUp={handleMouseUpPan}
              onMouseLeave={handleMouseUpPan}
            >
              {/* Optional Pixel Grid Overlay */}
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-10 opacity-20"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
              )}

              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain transition-transform duration-75"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                }}
                playsInline
                muted
              />

              {zoomLevel > 1 && (
                <div className="absolute bottom-3 left-3 z-10 px-2 py-1 rounded-lg bg-black/70 text-slate-300 text-[10px] font-bold flex items-center gap-1 pointer-events-none backdrop-blur-sm">
                  <Move className="w-3 h-3 text-sky-400" />
                  اسحب بالفأرة للتنقل داخل الرسمة
                </div>
              )}
            </div>

            {/* Precision Frame-by-Frame Stepper Controller Bar */}
            <div className="w-full px-4 py-3 bg-slate-950/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 z-20">
              {/* In/Out Setters */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={setInPointToCurrent}
                  className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs font-black transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>[ تحديد البداية</span>
                  <span className="font-mono text-[10px]">
                    ({settings.startTime.toFixed(2)}s)
                  </span>
                </button>
                <button
                  onClick={setOutPointToCurrent}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-black transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>تحديد النهاية ]</span>
                  <span className="font-mono text-[10px]">
                    ({settings.endTime.toFixed(2)}s)
                  </span>
                </button>
              </div>

              {/* Central Frame Steppers */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-2xl border border-white/5">
                <button
                  onClick={() => stepSeconds(-1)}
                  title="-1 ثانية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-mono font-bold"
                >
                  -1s
                </button>
                <button
                  onClick={() => stepSeconds(-0.1)}
                  title="-0.1 ثانية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-mono font-bold"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => stepFrames(-1)}
                  title="إطار للخلف (-1 Frame)"
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>-1 إطار</span>
                </button>

                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 active:scale-95 transition-all mx-1"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-white mr-0.5" />
                  )}
                </button>

                <button
                  onClick={() => stepFrames(1)}
                  title="إطار للأمام (+1 Frame)"
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1"
                >
                  <span>+1 إطار</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => stepSeconds(0.1)}
                  title="+0.1 ثانية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-mono font-bold"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => stepSeconds(1)}
                  title="+1 ثانية"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs font-mono font-bold"
                >
                  +1s
                </button>
              </div>

              {/* Quick Reset Time */}
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1.5"
                title="إعادة للبداية"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">البداية</span>
              </button>
            </div>
          </div>

          {/* Interactive Multi-Track Visual Timeline */}
          <div className="space-y-2 bg-slate-950/60 p-4 rounded-3xl border border-white/5">
            <div className="flex items-center justify-between text-xs font-black text-slate-400">
              <span className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-sky-400" />
                شريط التايم لاين والمشاهد المصورة (Filmstrip)
              </span>
              <span className="font-mono text-slate-500">
                0.00s ───── {duration.toFixed(2)}s
              </span>
            </div>

            <div
              ref={timelineRef}
              onClick={handleTimelineClick}
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={handleTimelineMouseLeave}
              className="relative w-full h-20 bg-slate-950 rounded-2xl overflow-hidden border-2 border-white/10 cursor-pointer select-none group"
              dir="ltr"
            >
              {/* Filmstrip Thumbnails Track */}
              {thumbnails.length > 0 ? (
                <div className="absolute inset-0 flex w-full h-full pointer-events-none opacity-80">
                  {thumbnails.map((thumb, idx) => (
                    <div
                      key={idx}
                      className="h-full flex-1 bg-cover bg-center border-r border-white/10 last:border-r-0"
                      style={{ backgroundImage: `url(${thumb})` }}
                    />
                  ))}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-30 bg-slate-900">
                  {isGeneratingThumbs ? (
                    <span className="text-white text-xs font-black animate-pulse px-3 py-1 bg-black/60 rounded-xl">
                      جاري استخراج تفاصيل الرسومات والمشاهد...
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs">شريط التايم لاين</span>
                  )}
                </div>
              )}

              {/* Shaded out areas for Trim Mode */}
              {settings.mode === "trim" && (
                <>
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-black/85 backdrop-blur-sm pointer-events-none z-10"
                    style={{
                      width: `${(settings.startTime / (duration || 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 right-0 bg-black/85 backdrop-blur-sm pointer-events-none z-10"
                    style={{
                      width: `${Math.max(0, 100 - (settings.endTime / (duration || 1)) * 100)}%`,
                    }}
                  />

                  {/* Active Selected Range Box */}
                  <div
                    className="absolute top-0 bottom-0 bg-sky-500/25 border-y-2 border-sky-400 pointer-events-none z-10"
                    style={{
                      left: `${(settings.startTime / (duration || 1)) * 100}%`,
                      width: `${Math.max(0, ((settings.endTime - settings.startTime) / (duration || 1)) * 100)}%`,
                    }}
                  >
                    {/* Left Trim Handle */}
                    <div className="absolute top-0 bottom-0 left-0 w-3 bg-sky-400 flex items-center justify-center -translate-x-1/2 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.8)]">
                      <div className="w-0.5 h-6 bg-slate-950 rounded-full" />
                    </div>
                    {/* Right Trim Handle */}
                    <div className="absolute top-0 bottom-0 right-0 w-3 bg-sky-400 flex items-center justify-center translate-x-1/2 rounded-full shadow-[0_0_12px_rgba(56,189,248,0.8)]">
                      <div className="w-0.5 h-6 bg-slate-950 rounded-full" />
                    </div>
                  </div>
                </>
              )}

              {/* Full Video Speed Indicator Glow */}
              {settings.mode === "fit_duration" && (
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/20 border-2 border-amber-400/80 pointer-events-none z-10 flex items-center justify-center">
                  <span className="px-3 py-1 rounded-xl bg-black/70 text-amber-300 font-black text-xs border border-amber-500/40 shadow-lg backdrop-blur-sm">
                    ⚡ تسريع الفيديو كاملاً دون قص ({speedFactor.toFixed(2)}x) ليصل إلى {settings.targetDuration}s
                  </span>
                </div>
              )}

              {settings.mode === "speed_multiplier" && (
                <div className="absolute inset-0 bg-emerald-500/15 border-2 border-emerald-400/80 pointer-events-none z-10 flex items-center justify-center">
                  <span className="px-3 py-1 rounded-xl bg-black/70 text-emerald-300 font-black text-xs border border-emerald-500/40 shadow-lg backdrop-blur-sm">
                    🚀 مضاعف السرعة: {settings.speedMultiplier}x (المدة الناتجة: {outputDuration.toFixed(2)}s)
                  </span>
                </div>
              )}

              {/* Current Playhead Scrubber */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white z-20 pointer-events-none shadow-[0_0_10px_white]"
                style={{
                  left: `${(currentTime / (duration || 1)) * 100}%`,
                }}
              >
                <div className="absolute top-0 -left-2 w-5 h-3 bg-white rounded-b-md shadow-md flex items-center justify-center">
                  <div className="w-1 h-1 bg-slate-900 rounded-full" />
                </div>
              </div>

              {/* Hover Position Line & Tooltip Preview */}
              {hoverTime !== null && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-amber-400 z-30 pointer-events-none"
                  style={{ left: `${hoverPosition}%` }}
                >
                  <div className="absolute -top-7 -left-8 px-2 py-0.5 rounded bg-black/90 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30 whitespace-nowrap shadow-md">
                    {hoverTime.toFixed(2)}s
                  </div>
                </div>
              )}

              {/* Invisible native sliders for Trim handles in Trim mode */}
              {settings.mode === "trim" && (
                <>
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.01"
                    value={settings.startTime}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        startTime: Math.min(parseFloat(e.target.value), s.endTime - 0.1),
                      }))
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-20 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-20 z-20"
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.01"
                    value={settings.endTime}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        endTime: Math.max(parseFloat(e.target.value), s.startTime + 0.1),
                      }))
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-20 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-20 z-30"
                  />
                </>
              )}
            </div>

            {/* Timeline Seconds Ticks */}
            <div className="flex justify-between items-center text-[10px] text-slate-500 px-1 font-mono">
              <span>0.00s</span>
              <span>{(duration * 0.25).toFixed(2)}s</span>
              <span>{(duration * 0.5).toFixed(2)}s</span>
              <span>{(duration * 0.75).toFixed(2)}s</span>
              <span>{duration.toFixed(2)}s</span>
            </div>
          </div>

          {/* Detailed Output Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                مدة الفيديو الأصلي
              </span>
              <div className="text-xl font-black text-white mt-1">
                {duration.toFixed(2)}{" "}
                <span className="text-xs text-slate-400 font-normal">ثانية</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">
                {totalSourceFrames} إطار أصلي
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col justify-between">
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                المدة الناتجة عند التصدير
              </span>
              <div className="text-xl font-black text-amber-400 mt-1">
                {outputDuration.toFixed(2)}{" "}
                <span className="text-xs text-amber-300/80 font-normal">ثانية</span>
              </div>
              <span className="text-[10px] text-amber-300/70 mt-1">
                {totalFramesCount} إطار نهائي ({fps} FPS)
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col justify-between">
              <span className="text-[10px] text-sky-300 font-bold uppercase tracking-wider">
                معامل السرعة المحسوب
              </span>
              <div className="text-xl font-black text-sky-400 mt-1">
                {speedFactor.toFixed(2)}x
              </div>
              <span className="text-[10px] text-sky-300/70 mt-1">
                {settings.mode === "fit_duration"
                  ? "تسريع الفيديو كاملاً دون قص"
                  : settings.mode === "trim"
                    ? "قص المقطع المحدد فقط"
                    : "بالسرعة المضبوطة"}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-white/10 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              {settings.mode === "fit_duration"
                ? `سيتم إنتاج فيديو كامل بمدة ${settings.targetDuration} ثوانٍ بالضبط بدون قص أي جزء من الرسوم.`
                : settings.mode === "trim"
                  ? `سيتم تصدير المقطع من ${settings.startTime.toFixed(2)}s إلى ${settings.endTime.toFixed(2)}s.`
                  : `سيتم تصدير الفيديو بالسرعة المضبوطة (${outputDuration.toFixed(2)}s).`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={() => {
                onApply(settings);
                onClose();
              }}
              className="flex-1 sm:flex-initial px-8 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>تأكيد الإعدادات وحفظها</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
