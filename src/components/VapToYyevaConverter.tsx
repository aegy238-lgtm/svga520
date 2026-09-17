import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Upload,
  Layers,
  Settings2,
  Film,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sliders,
  Maximize2,
  RefreshCw,
  Clock,
  ArrowRight,
  ArrowLeft,
  FileCode,
  Check,
  X,
  FileVideo,
  Eye,
  Info
} from 'lucide-react';
import {
  analyzeVapVideo,
  convertVapToYYEVA,
  VapAnalysisResult,
  YyevaConversionOutput
} from '../utils/vapToYyevaEngine';
import { WebGLVapRenderer } from '../utils/vapEngine';

interface VapToYyevaConverterProps {
  initialFile?: File | null;
  onBack?: () => void;
}

export const VapToYyevaConverter: React.FC<VapToYyevaConverterProps> = ({
  initialFile = null,
  onBack
}) => {
  // File & Analysis State
  const [file, setFile] = useState<File | null>(initialFile);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VapAnalysisResult | null>(null);

  // Settings State
  const [alphaSourcePosition, setAlphaSourcePosition] = useState<
    'left' | 'right' | 'top' | 'bottom' | 'auto'
  >('auto');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [customBitrate, setCustomBitrate] = useState<number | ''>('');
  const [targetFps, setTargetFps] = useState<number | ''>('');
  const [includeYyeaBox, setIncludeYyeaBox] = useState(true);
  const [includeVapcBox, setIncludeVapcBox] = useState(true);
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);

  // Preview Player State
  const [previewMode, setPreviewMode] = useState<'yyeva' | 'transparent' | 'source'>('yyeva');
  const [bgPattern, setBgPattern] = useState<'checker' | 'black' | 'white' | 'darkblue'>('checker');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Processing & Output State
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [conversionResult, setConversionResult] = useState<YyevaConversionOutput | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const webglRendererRef = useRef<WebGLVapRenderer | null>(null);
  const cancelSignalRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Handle incoming or selected file
  const handleFile = useCallback(async (selectedFile: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (resultVideoUrl) URL.revokeObjectURL(resultVideoUrl);

    setFile(selectedFile);
    const newUrl = URL.createObjectURL(selectedFile);
    setVideoUrl(newUrl);
    setConversionResult(null);
    setResultVideoUrl(null);
    setConversionError(null);
    setIsAnalyzing(true);

    try {
      const res = await analyzeVapVideo(selectedFile);
      setAnalysis(res);
      setAlphaSourcePosition(res.detectedAlphaPosition);
      setTargetFps(res.fps);
      setDuration(res.duration);
    } catch (err: any) {
      console.error('Failed to analyze VAP:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoUrl, resultVideoUrl]);

  useEffect(() => {
    if (initialFile) {
      handleFile(initialFile);
    }
  }, [initialFile, handleFile]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (resultVideoUrl) URL.revokeObjectURL(resultVideoUrl);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [videoUrl, resultVideoUrl]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };

  // Video Loaded
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  // Render preview frame on canvas
  const renderPreviewFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(renderPreviewFrame);
      return;
    }

    const rawW = video.videoWidth || 1500;
    const rawH = video.videoHeight || 1334;

    const singleW = analysis ? analysis.singleWidth : Math.floor(rawW / 2);
    const singleH = analysis ? analysis.singleHeight : rawH;

    // Calculate source crop rects
    let srcAlpha = analysis ? analysis.sourceAlphaRect : [0, 0, singleW, singleH];
    let srcRgb = analysis ? analysis.sourceRgbRect : [singleW, 0, singleW, singleH];

    if (alphaSourcePosition === 'left') {
      srcAlpha = [0, 0, singleW, singleH];
      srcRgb = [singleW, 0, singleW, singleH];
    } else if (alphaSourcePosition === 'right') {
      srcRgb = [0, 0, singleW, singleH];
      srcAlpha = [singleW, 0, singleW, singleH];
    } else if (alphaSourcePosition === 'top') {
      srcAlpha = [0, 0, rawW, Math.floor(rawH / 2)];
      srcRgb = [0, Math.floor(rawH / 2), rawW, Math.floor(rawH / 2)];
    } else if (alphaSourcePosition === 'bottom') {
      srcRgb = [0, 0, rawW, Math.floor(rawH / 2)];
      srcAlpha = [0, Math.floor(rawH / 2), rawW, Math.floor(rawH / 2)];
    }

    if (previewMode === 'transparent') {
      // Composited transparent view using WebGL
      if (canvas.width !== singleW || canvas.height !== singleH) {
        canvas.width = singleW;
        canvas.height = singleH;
      }

      if (!webglRendererRef.current || webglRendererRef.current.canvas.width !== singleW) {
        try {
          webglRendererRef.current = new WebGLVapRenderer(singleW, singleH);
        } catch (e) {
          console.warn('WebGL init error:', e);
        }
      }

      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        ctx2d.clearRect(0, 0, singleW, singleH);
        if (webglRendererRef.current) {
          const glCanvas = webglRendererRef.current.render(video, srcRgb, srcAlpha, 10, true);
          ctx2d.drawImage(glCanvas, 0, 0, singleW, singleH);
        }
      }
    } else if (previewMode === 'yyeva') {
      // YYEVA Side-by-Side preview: RGB on Left [0, 0, w, h], Alpha on Right [w, 0, w, h]
      const targetW = singleW * 2;
      const targetH = singleH;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetW, targetH);

        // 1. Draw RGB on LEFT
        ctx.drawImage(video, srcRgb[0], srcRgb[1], srcRgb[2], srcRgb[3], 0, 0, singleW, singleH);

        // 2. Draw Alpha on RIGHT
        ctx.drawImage(video, srcAlpha[0], srcAlpha[1], srcAlpha[2], srcAlpha[3], singleW, 0, singleW, singleH);

        // Optional dividing line
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(singleW, 0);
        ctx.lineTo(singleW, targetH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      // Raw Source Video
      if (canvas.width !== rawW || canvas.height !== rawH) {
        canvas.width = rawW;
        canvas.height = rawH;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, rawW, rawH);
      }
    }

    if (isPlaying) {
      setCurrentTime(video.currentTime);
      animationFrameRef.current = requestAnimationFrame(renderPreviewFrame);
    }
  }, [analysis, alphaSourcePosition, previewMode, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(renderPreviewFrame);
    } else {
      renderPreviewFrame();
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, renderPreviewFrame]);

  // Video playback toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      renderPreviewFrame();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !isMuted;
      setIsMuted(next);
      videoRef.current.muted = next;
    }
  };

  // Run Conversion
  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    setProgress(0);
    setProgressStatus('بدء عملية تحويل VAP إلى YYEVA...');
    setConversionError(null);
    setConversionResult(null);
    cancelSignalRef.current = { cancelled: false };

    try {
      const result = await convertVapToYYEVA(file, file.name, {
        alphaSourcePosition,
        quality,
        customBitrate: typeof customBitrate === 'number' ? customBitrate : undefined,
        fps: typeof targetFps === 'number' ? targetFps : undefined,
        includeYyeaBox,
        includeVapcBox,
        preserveAudio,
        customAudioFile,
        onProgress: (pct, msg) => {
          setProgress(pct);
          setProgressStatus(msg);
        },
        cancelSignal: cancelSignalRef.current
      });

      setConversionResult(result);
      const url = URL.createObjectURL(result.blob);
      setResultVideoUrl(url);
    } catch (err: any) {
      if (err?.message === 'USER_CANCELLED') {
        setProgressStatus('تم إلغاء عملية التحويل بناءً على طلبك');
      } else {
        console.error('YYEVA Conversion error:', err);
        setConversionError(err?.message || 'حدث خطأ أثناء معالجة وتحويل الملف');
      }
    } finally {
      setIsConverting(false);
    }
  };

  // Download converted YYEVA file
  const downloadConvertedFile = () => {
    if (!conversionResult) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(conversionResult.blob);
    a.download = conversionResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download companion JSON config
  const downloadJsonConfig = () => {
    if (!conversionResult) return;
    const jsonStr = JSON.stringify(conversionResult.configJson, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = conversionResult.fileName.replace(/\.mp4$/i, '_config.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 font-sans pb-24 text-white" dir="rtl">
      {/* Hidden processing video */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="hidden"
          playsInline
          muted={isMuted}
          onLoadedMetadata={handleVideoLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 sm:p-8 bg-gradient-to-r from-[#0d1220] via-[#09152b] to-[#0d1220] border border-sky-500/20 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-br from-amber-400/20 via-sky-500/30 to-indigo-600/30 border border-sky-400/30 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Zap className="w-8 h-8 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  نظام تحويل VAP إلى YYEVA
                </h1>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300">
                  VAP ⇄ YYEVA PRO
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 border border-sky-500/30 text-sky-400">
                  معالجة سحابية ومحلية 100%
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium leading-relaxed">
                تحويل حقيقي عكسي لملفات Tencent VAP إلى صيغة YYEVA المعتمدة مع إعادة ترتيب قنوات RGB
                والألفا ودمج ميتاداتا yyea & vapc
              </p>
            </div>
          </div>

          {onBack && (
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              الرجوع
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left is Uploader & Controls, Right is Interactive Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: File Input & Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* File Upload Box */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative overflow-hidden p-6 sm:p-8 rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer text-center ${
              file
                ? 'border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10'
                : 'border-white/15 hover:border-sky-400/50 bg-slate-950/40 hover:bg-slate-900/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".vap,video/mp4,video/*"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center gap-3 relative z-10">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                  file
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                    : 'bg-white/5 text-slate-400 border border-white/10'
                }`}
              >
                {file ? <Film className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
              </div>

              <div>
                <h3 className="text-base font-black text-white">
                  {file ? file.name : 'اسحب ملف VAP أو MP4 هنا أو اضغط للاختيار'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {file
                    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • جاهز للتحويل لـ YYEVA`
                    : 'يدعم ملفات .vap وملفات MP4 الشفافة ومقاطع Alpha+RGB'}
                </p>
              </div>

              {isAnalyzing && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  جاري فحص ميتاداتا وقنوات الملف...
                </div>
              )}
            </div>
          </div>

          {/* VAP Source Analysis Report */}
          {analysis && (
            <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  تحليل بنية ملف VAP المدخل:
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                      analysis.hasVapc
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {analysis.hasVapc ? 'vapc box مكتشف' : 'فيديو بدون ميتاداتا'}
                  </span>
                  {analysis.hasYyea && (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      yyea box مكتشف
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الأبعاد الحقيقية (Single)</span>
                  <span className="text-white font-black text-sm">
                    {analysis.singleWidth} × {analysis.singleHeight} px
                  </span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">أبعاد الفيديو المزدوج</span>
                  <span className="text-sky-400 font-black text-sm">
                    {analysis.rawWidth} × {analysis.rawHeight} px
                  </span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">معدل الإطارات (FPS)</span>
                  <span className="text-white font-black text-sm">{analysis.fps} FPS</span>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">إجمالي الإطارات والمدة</span>
                  <span className="text-white font-black text-sm">
                    {analysis.totalFrames} إطار ({analysis.duration.toFixed(1)} ثانية)
                  </span>
                </div>
              </div>

              {/* Channel Diagram Comparison */}
              <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/10 space-y-3">
                <span className="text-[11px] font-bold text-slate-300 block">
                  مخطط تحويل وإعادة ترتيب القنوات:
                </span>
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-black">
                  <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 text-red-300 flex flex-col items-center">
                    <span className="text-[9px] text-slate-400">ملف VAP المدخل</span>
                    <span className="mt-1">
                      {analysis.detectedAlphaPosition === 'left' ? 'يسار: ألفا | يمين: RGB' : 'RGB يمين | ألفا يسار'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-300 flex flex-col items-center">
                    <span className="text-[9px] text-slate-400">ملف YYEVA الناتج</span>
                    <span className="mt-1">يسار: RGB | يمين: ألفا (معتمد)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conversion Settings Form */}
          <div className="bg-slate-950/40 p-6 rounded-[2.5rem] border border-white/5 space-y-5">
            <h4 className="text-white font-black text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-sky-400" />
              إعدادات التحويل المتقدمة لـ YYEVA:
            </h4>

            {/* Alpha Source Position Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-2">
                موضع قناة الشفافية (Alpha Mask) في ملف VAP الأصلي:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'left', label: 'اليسار (الافتراضي لـ VAP)' },
                  { id: 'right', label: 'اليمين' },
                  { id: 'top', label: 'الأعلى' },
                  { id: 'bottom', label: 'الأسفل' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAlphaSourcePosition(p.id as any)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      alphaSourcePosition === p.id
                        ? 'bg-sky-500 border-sky-400 text-white shadow-glow-sky'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality & Bitrate */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-2">
                  جودة التشفير (H.264):
                </label>
                <div className="flex gap-1.5">
                  {(['high', 'medium', 'low'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                        quality === q
                          ? 'bg-sky-500 border-sky-400 text-white'
                          : 'bg-white/5 border-white/5 text-slate-400'
                      }`}
                    >
                      {q === 'high' ? 'عالية' : q === 'medium' ? 'متوسطة' : 'خفيفة'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-2">
                  معدل البت المخصص (Mbps):
                </label>
                <input
                  type="number"
                  placeholder="تلقائي (8 Mbps)"
                  value={customBitrate}
                  onChange={(e) =>
                    setCustomBitrate(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={includeYyeaBox}
                  onChange={(e) => setIncludeYyeaBox(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-sky-500 focus:ring-0 w-4 h-4"
                />
                <span>تضمين صندوق yyea box المعتمد (YY Live & YYEVA Player)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={includeVapcBox}
                  onChange={(e) => setIncludeVapcBox(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-sky-500 focus:ring-0 w-4 h-4"
                />
                <span>تضمين صندوق vapc box للتوافق المزدوج مع محركات VAP</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={preserveAudio}
                  onChange={(e) => setPreserveAudio(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-sky-500 focus:ring-0 w-4 h-4"
                />
                <span>استخراج ودمج المسار الصوتي الأصلي في ملف YYEVA</span>
              </label>
            </div>

            {/* Execute Button */}
            <button
              disabled={!file || isConverting}
              onClick={handleConvert}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl transition-all ${
                !file || isConverting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isConverting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري تحويل VAP إلى YYEVA ({progress}%)...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-amber-300" />
                  <span>بدء تحويل VAP → YYEVA الآن</span>
                </>
              )}
            </button>

            {/* Real-time Progress Bar */}
            {isConverting && (
              <div className="space-y-2 pt-2 animate-fade-in">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-sky-400">{progressStatus}</span>
                  <span className="text-white">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <motion.div
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <div className="text-left">
                  <button
                    onClick={() => {
                      cancelSignalRef.current.cancelled = true;
                    }}
                    className="text-[10px] text-red-400 hover:underline font-bold"
                  >
                    إلغاء التحويل
                  </button>
                </div>
              </div>
            )}

            {conversionError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-300 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{conversionError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Player & Conversion Results (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Preview Screen */}
          <div className="bg-slate-950/40 p-6 sm:p-8 rounded-[2.5rem] border border-white/5 space-y-6">
            {/* View Mode Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/10">
                <button
                  onClick={() => setPreviewMode('yyeva')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'yyeva'
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  معاينة YYEVA الناتجة
                </button>
                <button
                  onClick={() => setPreviewMode('transparent')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'transparent'
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الشفافية الحقيقية (Alpha)
                </button>
                <button
                  onClick={() => setPreviewMode('source')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    previewMode === 'source'
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  فيديو VAP الأصلي
                </button>
              </div>

              {/* Background Selector for Transparent Mode */}
              {previewMode === 'transparent' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-bold">الخلفية:</span>
                  {(['checker', 'black', 'white', 'darkblue'] as const).map((bg) => (
                    <button
                      key={bg}
                      onClick={() => setBgPattern(bg)}
                      className={`w-6 h-6 rounded-lg border transition-all ${
                        bgPattern === bg ? 'border-sky-400 scale-110' : 'border-white/20 opacity-60'
                      } ${
                        bg === 'checker'
                          ? 'bg-[repeating-conic-gradient(#334155_0%_25%,#1e293b_0%_50%)] bg-[length:8px_8px]'
                          : bg === 'black'
                          ? 'bg-black'
                          : bg === 'white'
                          ? 'bg-white'
                          : 'bg-[#0f172a]'
                      }`}
                      title={bg}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Canvas Stage */}
            <div
              className={`relative w-full aspect-video rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner ${
                previewMode === 'transparent' && bgPattern === 'checker'
                  ? 'bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:16px_16px]'
                  : previewMode === 'transparent' && bgPattern === 'black'
                  ? 'bg-black'
                  : previewMode === 'transparent' && bgPattern === 'white'
                  ? 'bg-white'
                  : 'bg-slate-900'
              }`}
            >
              {file ? (
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center p-8 flex flex-col items-center gap-3">
                  <FileVideo className="w-12 h-12 text-slate-600" />
                  <span className="text-sm font-bold text-slate-400">
                    يرجى رفع ملف VAP لمعاينة إطارات YYEVA وقنوات الشفافية
                  </span>
                </div>
              )}

              {/* Mode Overlay Badge */}
              {file && (
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-300">
                  {previewMode === 'yyeva'
                    ? 'وضع YYEVA: RGB يسار | ألفا يمين'
                    : previewMode === 'transparent'
                    ? 'وضع الشفافية المركب'
                    : 'وضع VAP الأصلي'}
                </div>
              )}
            </div>

            {/* Player Controls Bar */}
            {file && (
              <div className="space-y-4 pt-2">
                {/* Timeline Seek Bar */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono font-bold text-slate-400 min-w-[55px]">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.01"
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="text-[10px] font-mono font-bold text-slate-400 min-w-[55px]">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 transition-transform active:scale-95"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>

                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = 0;
                          setCurrentTime(0);
                          renderPreviewFrame();
                        }
                      }}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                      title="إعادة التشغيل من البداية"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 accent-sky-400 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Frame Counter Display */}
                  {analysis && (
                    <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[11px] font-mono font-bold text-slate-300">
                      الإطار: {Math.floor(currentTime * analysis.fps)} / {analysis.totalFrames}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Result Card (When Conversion Completed) */}
          {conversionResult && (
            <div className="bg-gradient-to-br from-emerald-500/10 via-slate-950/60 to-[#0d1220] p-6 sm:p-8 rounded-[2.5rem] border border-emerald-500/30 space-y-6 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">تم تحويل ملف VAP إلى YYEVA بنجاح!</h3>
                    <p className="text-xs text-emerald-300 mt-0.5">
                      الملف جاهز للاستخدام الفوري في YY Live و YYEVA Web & Mobile SDK
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  READY
                </span>
              </div>

              {/* Conversion Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الحجم الأصلي</span>
                  <span className="text-white font-black text-sm">
                    {(conversionResult.originalSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الحجم المحول (YYEVA)</span>
                  <span className="text-emerald-400 font-black text-sm">
                    {(conversionResult.convertedSize / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الدقة والأبعاد</span>
                  <span className="text-sky-400 font-black text-sm">
                    {conversionResult.totalWidth} × {conversionResult.totalHeight} px
                  </span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-slate-400 block text-[10px]">الإطارات والسرعة</span>
                  <span className="text-white font-black text-sm">
                    {conversionResult.totalFrames} إطار @ {conversionResult.fps} FPS
                  </span>
                </div>
              </div>

              {/* Download Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={downloadConvertedFile}
                  className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 transition-transform active:scale-98"
                >
                  <Download className="w-5 h-5" />
                  <span>تحميل ملف YYEVA المحول ({conversionResult.fileName})</span>
                </button>

                <button
                  onClick={downloadJsonConfig}
                  className="py-4 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  title="تحميل ملف التكوين JSON المرافق"
                >
                  <FileCode className="w-4 h-4 text-sky-400" />
                  <span>تحميل JSON Config</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
