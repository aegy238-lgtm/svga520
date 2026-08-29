import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Video, Play, Pause, RotateCcw, Download, Scissors, 
  Sliders, Layers, Eye, Check, Shield, Zap, ChevronLeft, 
  ChevronRight, RefreshCw, ZoomIn, Palette, Crosshair, AlertCircle,
  FileVideo, ArrowRight, Wand2, UserCheck, Sparkle, Film
} from 'lucide-react';
import { 
  AISegmentationSettings, 
  DEFAULT_SEGMENTATION_SETTINGS, 
  getSelfieSegmenter, 
  processFrameWithAI,
  exportToSvga,
  exportToVap,
  exportToPngZip,
  exportToGreenScreenMp4
} from '../utils/aiVideoSegmentation';
import { UserRecord } from '../types';
import { logActivity } from '../utils/logger';

interface AIVideoMattingStudioProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onSubscriptionRequired?: () => void;
  initialVideoFile?: File | null;
}

export const AIVideoMattingStudio: React.FC<AIVideoMattingStudioProps> = ({
  currentUser,
  onCancel,
  onSubscriptionRequired,
  initialVideoFile
}) => {
  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(initialVideoFile || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [videoWidth, setVideoWidth] = useState<number>(1280);
  const [videoHeight, setVideoHeight] = useState<number>(720);
  const [fps, setFps] = useState<number>(30);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // AI & Filter Settings
  const [settings, setSettings] = useState<AISegmentationSettings>(DEFAULT_SEGMENTATION_SETTINGS);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'refine' | 'despill' | 'roi' | 'export'>('refine');

  // ROI dragging state
  const [isDraggingRoi, setIsDraggingRoi] = useState<boolean>(false);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Export State
  const [exportFormat, setExportFormat] = useState<'vap' | 'svga' | 'webm' | 'chroma' | 'png_zip'>('vap');
  const [exportFps, setExportFps] = useState<number>(30);
  const [exportScale, setExportScale] = useState<number>(1.0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportPhase, setExportPhase] = useState<string>('');
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const segmenterRef = useRef<any>(null);
  const prevAlphaMaskRef = useRef<Uint8ClampedArray | null>(null);
  const isProcessingFrameRef = useRef<boolean>(false);

  // Initialize MediaPipe AI Segmenter
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsAiLoading(true);
        const segmenter = await getSelfieSegmenter(settings.modelAccuracy === 'general' ? 1 : 0);
        if (isMounted) {
          segmenterRef.current = segmenter;
          setIsAiLoading(false);
        }
      } catch (err: any) {
        console.error('AI Segmenter Load Error:', err);
        if (isMounted) {
          setAiError('فشل تحميل محرك الذكاء الاصطناعي، يرجى التأكد من اتصال الإنترنت.');
          setIsAiLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [settings.modelAccuracy]);

  // Video URL Management
  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [videoFile]);

  // Handle Video Metadata Loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    setVideoWidth(w);
    setVideoHeight(h);
    setDuration(v.duration || 0);
    setTrimStart(0);
    setTrimEnd(v.duration || 0);

    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
    }

    renderCurrentFrame();
  };

  // Render a single frame with AI segmentation
  const renderCurrentFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !segmenterRef.current) return;
    if (isProcessingFrameRef.current) return;

    isProcessingFrameRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const res = await processFrameWithAI(
        video,
        segmenterRef.current,
        canvas,
        settings,
        prevAlphaMaskRef.current
      );

      prevAlphaMaskRef.current = res.alphaMask;
    } catch (err) {
      // Frame skipped
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [settings]);

  // Live Render Loop during Playback
  useEffect(() => {
    let active = true;

    const loop = async () => {
      if (!active) return;
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        setCurrentTime(videoRef.current.currentTime);
        
        // Loop within trim range
        if (trimEnd > 0 && videoRef.current.currentTime >= trimEnd) {
          videoRef.current.currentTime = trimStart;
        }

        await renderCurrentFrame();
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(loop);
    }

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, renderCurrentFrame, trimStart, trimEnd]);

  // Toggle Play / Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Seek video
  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, time));
    setCurrentTime(videoRef.current.currentTime);
    renderCurrentFrame();
  };

  // Step Frame
  const stepFrame = (forward: boolean) => {
    if (!videoRef.current) return;
    const delta = (1 / fps) * (forward ? 1 : -1);
    handleSeek(videoRef.current.currentTime + delta);
  };

  // Presets Application
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'ultra_clean':
        setSettings(prev => ({
          ...prev,
          edgeErosion: 3,
          edgeFeather: 2,
          alphaThreshold: 50,
          alphaContrast: 1.6,
          despillEnabled: true,
          despillAmount: 75,
          temporalSmoothing: 40,
        }));
        break;
      case 'crisp_cutout':
        setSettings(prev => ({
          ...prev,
          edgeErosion: 4,
          edgeFeather: 1,
          alphaThreshold: 55,
          alphaContrast: 2.0,
          despillEnabled: true,
          despillAmount: 85,
          temporalSmoothing: 30,
        }));
        break;
      case 'soft_hair':
        setSettings(prev => ({
          ...prev,
          edgeErosion: 1,
          edgeFeather: 6,
          alphaThreshold: 40,
          alphaContrast: 1.2,
          despillEnabled: true,
          despillAmount: 60,
          temporalSmoothing: 45,
        }));
        break;
      case 'chroma_master':
        setSettings(prev => ({
          ...prev,
          hybridChromaEnabled: true,
          chromaColor: '#00FF00',
          chromaTolerance: 35,
          chromaSmoothness: 12,
          despillEnabled: true,
          despillColor: 'green',
          despillAmount: 95,
          edgeErosion: 2,
          edgeFeather: 3,
        }));
        break;
    }
    setTimeout(() => renderCurrentFrame(), 50);
  };

  // Export Pipeline
  const handleExport = async () => {
    if (!videoRef.current || !segmenterRef.current) return;

    if (currentUser) {
      logActivity(currentUser, 'feature_usage', `Used AI Video Matting Studio to export ${exportFormat.toUpperCase()}`);
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportPhase('جاري استخراج ومعالجة إطارات الفيديو بالذكاء الاصطناعي...');

    try {
      const video = videoRef.current;
      const origCurrentTime = video.currentTime;
      const wasPlaying = !video.paused;
      if (wasPlaying) video.pause();

      const start = trimStart;
      const end = trimEnd > start ? trimEnd : duration;
      const segmentDuration = end - start;
      const totalFrames = Math.max(1, Math.floor(segmentDuration * exportFps));

      const targetWidth = Math.round(videoWidth * exportScale);
      const targetHeight = Math.round(videoHeight * exportScale);

      const framesCanvasList: HTMLCanvasElement[] = [];
      let prevMask: Uint8ClampedArray | null = null;

      // Extract & Segment each frame
      for (let i = 0; i < totalFrames; i++) {
        const time = start + (i / exportFps);
        video.currentTime = time;

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = targetWidth;
        frameCanvas.height = targetHeight;

        const res = await processFrameWithAI(
          video,
          segmenterRef.current,
          frameCanvas,
          settings,
          prevMask
        );
        prevMask = res.alphaMask;
        framesCanvasList.push(frameCanvas);

        setExportProgress(Math.round(((i + 1) / totalFrames) * 70));
        setExportPhase(`جاري معالجة الإطار ${i + 1} من ${totalFrames} بالذكاء الاصطناعي...`);
      }

      setExportPhase(`جاري ترميز وتصدير ملف ${exportFormat.toUpperCase()} النهائي...`);

      let finalBlob: Blob | null = null;

      if (exportFormat === 'svga') {
        finalBlob = await exportToSvga(framesCanvasList, exportFps, targetWidth, targetHeight, (p) => {
          setExportProgress(70 + Math.round(p * 0.3));
        });
      } else if (exportFormat === 'vap') {
        finalBlob = await exportToVap(framesCanvasList, exportFps, targetWidth, targetHeight, (p) => {
          setExportProgress(70 + Math.round(p * 0.3));
        });
      } else if (exportFormat === 'chroma') {
        finalBlob = await exportToGreenScreenMp4(framesCanvasList, exportFps, targetWidth, targetHeight, (p) => {
          setExportProgress(70 + Math.round(p * 0.3));
        });
      } else if (exportFormat === 'png_zip') {
        finalBlob = await exportToPngZip(framesCanvasList, (p) => {
          setExportProgress(70 + Math.round(p * 0.3));
        });
      } else if (exportFormat === 'webm') {
        // Fallback or WebM stream
        finalBlob = await exportToGreenScreenMp4(framesCanvasList, exportFps, targetWidth, targetHeight);
      }

      if (finalBlob) {
        setExportedBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setExportedUrl(url);
      }

      // Restore original time
      video.currentTime = origCurrentTime;
      setExportPhase('تم إتمام التصدير بنجاح! 🎉');
      setExportProgress(100);
    } catch (err: any) {
      console.error('Export Error:', err);
      alert(`حدث خطأ أثناء التصدير: ${err.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Download Exported File
  const handleDownload = () => {
    if (!exportedBlob) return;
    const url = exportedUrl || URL.createObjectURL(exportedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    let ext = 'mp4';
    if (exportFormat === 'svga') ext = 'svga';
    else if (exportFormat === 'png_zip') ext = 'zip';
    else if (exportFormat === 'webm') ext = 'webm';

    a.download = `AI_Smart_Matting_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Load Demo Video
  const loadDemo = (type: 'speaker' | 'dance') => {
    const demoUrls: Record<string, string> = {
      speaker: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      dance: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    };
    setVideoUrl(demoUrls[type]);
    setVideoFile(null);
  };

  return (
    <div className="w-full min-h-screen text-slate-100 font-sans pb-24" dir="rtl">
      {/* Hidden Video Source */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          crossOrigin="anonymous"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          className="hidden"
        />
      )}

      {/* Top Navigation Header */}
      <div className="max-w-[1600px] mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 mb-8 backdrop-blur-xl bg-slate-900/40 rounded-3xl p-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-slate-400 hover:text-white flex items-center gap-2 group"
          >
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span className="text-sm font-semibold">العودة للرئيسية</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-300">
                AI Smart Video Matting Studio
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                تحديد وقص الأشخاص والأجسام داخل الفيديو بالذكاء الاصطناعي مع إزالة الحواف والبرومة
              </p>
            </div>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 ml-2">الإعدادات السريعة:</span>
          <button
            onClick={() => applyPreset('ultra_clean')}
            className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Sparkle className="w-3.5 h-3.5" />
            أقصى دقة ونظافة
          </button>
          <button
            onClick={() => applyPreset('crisp_cutout')}
            className="px-3.5 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Scissors className="w-3.5 h-3.5" />
            قص حاد بدون أي زوائد
          </button>
          <button
            onClick={() => applyPreset('soft_hair')}
            className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <UserCheck className="w-3.5 h-3.5" />
            نعومة وتفاصيل الشعر
          </button>
          <button
            onClick={() => applyPreset('chroma_master')}
            className="px-3.5 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            إزالة كروما متقدمة
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4">
        {/* Upload State / Empty State */}
        {!videoUrl ? (
          <div className="w-full bg-slate-900/60 border-2 border-dashed border-cyan-500/30 rounded-[2.5rem] p-12 text-center backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-70 animate-pulse"></div>
            
            <div className="max-w-xl mx-auto flex flex-col items-center gap-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10 group-hover:scale-110 transition-transform">
                <FileVideo className="w-12 h-12" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white mb-2">
                  اختر أو اسحب مقطع الفيديو هنا لبدء القص والتفريغ الذكي
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  يدعم صيغ MP4, WebM, MOV. يقوم النظام بتتبع وتحديد حركة الشخص بدقة متناهية وإزالة الحواف والبرومة تلقائياً.
                </p>
              </div>

              <label className="cursor-pointer px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/30 transition-all flex items-center gap-3 active:scale-95">
                <FileVideo className="w-5 h-5" />
                <span>رفع فيديو من الجهاز</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setVideoFile(e.target.files[0]);
                    }
                  }}
                />
              </label>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-4">
                <span>أو جرب مقطع تجريبي:</span>
                <button
                  onClick={() => loadDemo('speaker')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-semibold transition-all"
                >
                  فيديو متحدث 🎥
                </button>
                <button
                  onClick={() => loadDemo('dance')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-semibold transition-all"
                >
                  فيديو حركة 🏃
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Interactive Studio */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left/Main Column: Video Canvas Viewport & Controls (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Canvas Viewport Box */}
              <div 
                ref={previewContainerRef}
                className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-[#090d16] flex items-center justify-center select-none"
              >
                {/* Viewport Backgrounds */}
                {settings.viewMode === 'transparent' && (
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-70 bg-slate-950" />
                )}
                {settings.viewMode === 'chroma' && (
                  <div className="absolute inset-0 bg-[#00FF00]" />
                )}
                {settings.viewMode === 'black' && (
                  <div className="absolute inset-0 bg-[#000000]" />
                )}
                {settings.viewMode === 'white' && (
                  <div className="absolute inset-0 bg-[#FFFFFF]" />
                )}
                {settings.viewMode === 'mask' && (
                  <div className="absolute inset-0 bg-[#000000]" />
                )}
                {settings.viewMode === 'custom' && (
                  <div 
                    className="absolute inset-0 transition-colors"
                    style={{ backgroundColor: settings.customBgColor }}
                  />
                )}

                {/* Primary AI Render Canvas */}
                <canvas
                  ref={canvasRef}
                  className="relative z-10 max-w-full max-h-full object-contain pointer-events-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
                />

                {/* Split Comparison Slider (if viewMode === 'split') */}
                {settings.viewMode === 'split' && videoRef.current && (
                  <div 
                    className="absolute inset-0 z-20 overflow-hidden pointer-events-none"
                    style={{ clipPath: `inset(0 0 0 ${settings.splitPosition}%)` }}
                  >
                    <video
                      src={videoUrl || undefined}
                      className="w-full h-full object-contain"
                      style={{
                        transform: `translate(${currentTime ? 0 : 0})`,
                      }}
                      ref={(el) => {
                        if (el && videoRef.current) {
                          el.currentTime = videoRef.current.currentTime;
                        }
                      }}
                      muted
                      playsInline
                    />
                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-300 border border-white/10">
                      الفيديو الأصلي
                    </div>
                  </div>
                )}

                {/* Loading Indicator */}
                {isAiLoading && (
                  <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                    <p className="text-sm font-bold text-cyan-200">جاري تهيئة نموذج الذكاء الاصطناعي فائق الدقة...</p>
                  </div>
                )}

                {/* Viewport Floating Bar */}
                <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-xl">
                  <button
                    onClick={() => setSettings(s => ({ ...s, viewMode: 'transparent' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.viewMode === 'transparent' ? 'bg-cyan-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏁 شفاف
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, viewMode: 'chroma' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.viewMode === 'chroma' ? 'bg-green-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🟢 كروما
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, viewMode: 'black' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.viewMode === 'black' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⬛ داكن
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, viewMode: 'white' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.viewMode === 'white' ? 'bg-slate-200 text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⬜ ناصع
                  </button>
                  <button
                    onClick={() => setSettings(s => ({ ...s, viewMode: 'split' }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      settings.viewMode === 'split' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌓 مقارنة
                  </button>
                </div>
              </div>

              {/* Video Playback & Timeline Controls */}
              <div className="w-full bg-slate-900/60 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-xl flex flex-col gap-4">
                
                {/* Timeline Range Scrubber */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                    <span className="text-cyan-400 font-mono">{currentTime.toFixed(2)} ثانية</span>
                    <div className="flex items-center gap-3">
                      <span>بداية الاقتصاص: {trimStart.toFixed(2)}s</span>
                      <span>نهاية الاقتصاص: {(trimEnd || duration).toFixed(2)}s</span>
                    </div>
                    <span className="font-mono">{duration.toFixed(2)} ثانية</span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.033}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                  />
                </div>

                {/* Playback Buttons Bar */}
                <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => stepFrame(false)}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-300 hover:text-white transition-all"
                      title="إطار للخلف"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={togglePlay}
                      className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                      <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل المعاينة'}</span>
                    </button>

                    <button
                      onClick={() => stepFrame(true)}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-300 hover:text-white transition-all"
                      title="إطار للأمام"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleSeek(0)}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-300 hover:text-white transition-all"
                      title="إعادة للبداية"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="cursor-pointer px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-semibold transition-all">
                      <span>تغيير الفيديو</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setVideoFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: AI Precision Sliders & Export Station (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Tabs Switcher */}
              <div className="flex items-center p-1 bg-slate-900/60 border border-white/10 rounded-2xl backdrop-blur-xl">
                <button
                  onClick={() => setActiveTab('refine')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'refine' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>دقة الحواف</span>
                </button>
                <button
                  onClick={() => setActiveTab('despill')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'despill' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>إزالة البرومة</span>
                </button>
                <button
                  onClick={() => setActiveTab('export')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'export' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>التصدير</span>
                </button>
              </div>

              {/* TAB 1: EDGE REFINE & EROSION */}
              {activeTab === 'refine' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-5">
                  <h3 className="text-sm font-black text-cyan-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    معالجة ونقاء الحواف (Edge Anti-Fringe)
                  </h3>

                  {/* Edge Erosion (شيل الحواف الزائدة) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">تقليص الحواف وإزالة الهالات الزائدة (Erosion)</span>
                      <span className="font-mono text-cyan-400 font-bold">{settings.edgeErosion} px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={1}
                      value={settings.edgeErosion}
                      onChange={(e) => {
                        setSettings(s => ({ ...s, edgeErosion: parseInt(e.target.value) }));
                        setTimeout(renderCurrentFrame, 10);
                      }}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <p className="text-[11px] text-slate-400 leading-tight">
                      يقوم بقص بكسلات الحافة الخارجية للتخلص تماماً من بقايا الخلفية أو الخطوط الخضراء.
                    </p>
                  </div>

                  {/* Edge Feathering (نعومة الحواف) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">نعومة الحواف وتفاصيل الشعر (Feathering)</span>
                      <span className="font-mono text-cyan-400 font-bold">{settings.edgeFeather} px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={1}
                      value={settings.edgeFeather}
                      onChange={(e) => {
                        setSettings(s => ({ ...s, edgeFeather: parseInt(e.target.value) }));
                        setTimeout(renderCurrentFrame, 10);
                      }}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <p className="text-[11px] text-slate-400 leading-tight">
                      يمنح حواف الجسم والشعر تدريجاً ناعماً وطبيعياً بدون أي تقطيع حاد.
                    </p>
                  </div>

                  {/* Alpha Threshold */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">حساسية وثقة الذكاء الاصطناعي (Threshold)</span>
                      <span className="font-mono text-cyan-400 font-bold">{settings.alphaThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={1}
                      value={settings.alphaThreshold}
                      onChange={(e) => {
                        setSettings(s => ({ ...s, alphaThreshold: parseInt(e.target.value) }));
                        setTimeout(renderCurrentFrame, 10);
                      }}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* Temporal Smoothing (تثبيت القناع ومنع الاهتزاز) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">تثبيت حركة القناع ومنع الوميض (Anti-Jitter)</span>
                      <span className="font-mono text-cyan-400 font-bold">{settings.temporalSmoothing}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={70}
                      step={5}
                      value={settings.temporalSmoothing}
                      onChange={(e) => {
                        setSettings(s => ({ ...s, temporalSmoothing: parseInt(e.target.value) }));
                      }}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: DE-SPILL & HYBRID CHROMA */}
              {activeTab === 'despill' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-5">
                  <h3 className="text-sm font-black text-cyan-300 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    إزالة انعكاسات البرومة واللون (De-Spill)
                  </h3>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                    <span className="text-xs font-bold text-slate-200">تفعيل فلتر إزالة الانعكاس</span>
                    <input
                      type="checkbox"
                      checked={settings.despillEnabled}
                      onChange={(e) => {
                        setSettings(s => ({ ...s, despillEnabled: e.target.checked }));
                        setTimeout(renderCurrentFrame, 10);
                      }}
                      className="w-5 h-5 rounded accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {settings.despillEnabled && (
                    <>
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-bold text-slate-300">نوع انعكاس الإضاءة المراد إزالته:</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSettings(s => ({ ...s, despillColor: 'green' }));
                              setTimeout(renderCurrentFrame, 10);
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              settings.despillColor === 'green' ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-white/5 border-white/10 text-slate-400'
                            }`}
                          >
                            🟢 كروما خضراء (Green)
                          </button>
                          <button
                            onClick={() => {
                              setSettings(s => ({ ...s, despillColor: 'blue' }));
                              setTimeout(renderCurrentFrame, 10);
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                              settings.despillColor === 'blue' ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400'
                            }`}
                          >
                            🔵 كروما زرقاء (Blue)
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-200">قوة كتم الانعكاس (Suppression Amount)</span>
                          <span className="font-mono text-cyan-400 font-bold">{settings.despillAmount}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={settings.despillAmount}
                          onChange={(e) => {
                            setSettings(s => ({ ...s, despillAmount: parseInt(e.target.value) }));
                            setTimeout(renderCurrentFrame, 10);
                          }}
                          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </>
                  )}

                  {/* Hybrid Chroma Key Mode */}
                  <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">دمج كروما هجينة (AI + Color Key)</span>
                      <input
                        type="checkbox"
                        checked={settings.hybridChromaEnabled}
                        onChange={(e) => {
                          setSettings(s => ({ ...s, hybridChromaEnabled: e.target.checked }));
                          setTimeout(renderCurrentFrame, 10);
                        }}
                        className="w-5 h-5 rounded accent-purple-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      يجمع بين الذكاء الاصطناعي وتفريغ درجات اللون الأخضر للحصول على حواف فائقة النقاء.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: EXPORT STATION */}
              {activeTab === 'export' && (
                <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-5">
                  <h3 className="text-sm font-black text-cyan-300 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    محطة التصدير والمعالجة الفائقة
                  </h3>

                  {/* Format Selector */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-300">صيغة التصدير المطلوبة:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setExportFormat('vap')}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                          exportFormat === 'vap' ? 'bg-cyan-500/20 border-cyan-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-black text-cyan-300">VAP (MP4)</span>
                        <span className="text-[10px] text-slate-400">للبث والتطبيقات الحية</span>
                      </button>

                      <button
                        onClick={() => setExportFormat('svga')}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                          exportFormat === 'svga' ? 'bg-purple-500/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-black text-purple-300">SVGA متحرك</span>
                        <span className="text-[10px] text-slate-400">شفافية أنيميشن كاملة</span>
                      </button>

                      <button
                        onClick={() => setExportFormat('chroma')}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                          exportFormat === 'chroma' ? 'bg-green-500/20 border-green-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-black text-green-300">كروما خضراء MP4</span>
                        <span className="text-[10px] text-slate-400">نقية لبرامج المونتاج</span>
                      </button>

                      <button
                        onClick={() => setExportFormat('png_zip')}
                        className={`p-3 rounded-2xl border text-right transition-all flex flex-col gap-1 ${
                          exportFormat === 'png_zip' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-black text-amber-300">إطارات PNG (ZIP)</span>
                        <span className="text-[10px] text-slate-400">تسلسل صور مفرغة</span>
                      </button>
                    </div>
                  </div>

                  {/* FPS and Scale */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-300">معدل الإطارات (FPS):</span>
                      <select
                        value={exportFps}
                        onChange={(e) => setExportFps(parseInt(e.target.value))}
                        className="bg-slate-800 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                      >
                        <option value={24}>24 FPS (سينمائي)</option>
                        <option value={30}>30 FPS (قياسي)</option>
                        <option value={60}>60 FPS (فائق السلاسة)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold text-slate-300">حجم ودقة الإخراج:</span>
                      <select
                        value={exportScale}
                        onChange={(e) => setExportScale(parseFloat(e.target.value))}
                        className="bg-slate-800 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                      >
                        <option value={1.0}>100% الدقة الأصلية</option>
                        <option value={0.75}>75% جودة متوسطة</option>
                        <option value={0.5}>50% ضغط سريع</option>
                      </select>
                    </div>
                  </div>

                  {/* Export Button & Progress */}
                  {!isExporting ? (
                    <div className="flex flex-col gap-3 pt-2">
                      <button
                        onClick={handleExport}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Wand2 className="w-5 h-5" />
                        <span>بدء التصدير الذكي الآن</span>
                      </button>

                      {exportedBlob && (
                        <button
                          onClick={handleDownload}
                          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 animate-bounce"
                        >
                          <Download className="w-4 h-4" />
                          <span>تحميل الملف النهائي الجاهز</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-cyan-300">{exportPhase}</span>
                        <span className="text-white font-mono">{exportProgress}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
