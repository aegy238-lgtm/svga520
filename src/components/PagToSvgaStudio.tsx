import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Download, Play, Pause, RefreshCw, X, Box, 
  Settings2, Layers, CheckCircle2, Film, AlertTriangle, FileArchive, Share2, Sparkles, ShieldCheck, Gauge
} from 'lucide-react';
import { 
  parseAnimationFile, convertPagToSvga, compressSvgaFile, PagMetadata, getPAG, 
  estimateOutputSize, calculateQualityForTarget, formatBytes 
} from '../utils/pagEngine';
import SVGAPlayer from './RawSvgaPlayer';

interface PagToSvgaStudioProps {
  onClose: () => void;
  initialFile?: File | null;
}

export const PagToSvgaStudio: React.FC<PagToSvgaStudioProps> = ({ onClose, initialFile }) => {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [metadata, setMetadata] = useState<PagMetadata | null>(null);
  const [svgaMovie, setSvgaMovie] = useState<any | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  
  // Player State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pagPlayerRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Conversion Settings
  const [targetFps, setTargetFps] = useState<number>(30);
  const [compressionQuality, setCompressionQuality] = useState<number>(75);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [convertFormat, setConvertFormat] = useState<string>('PAG -> SVGA');
  
  // Conversion Execution State
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Result Modal
  const [resultModal, setResultModal] = useState<{
    svgaUrl: string;
    svgaSize: number;
    filename: string;
    elapsedSec: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Replaced SVGA Images State
  const [replacedImages, setReplacedImages] = useState<Record<string, string>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({});
  const [replacedColors, setReplacedColors] = useState<Record<string, string>>({});

  // Auto load initial file
  useEffect(() => {
    if (initialFile) {
      loadAnimationFile(initialFile);
    }
  }, [initialFile]);

  // Read Animation file (.pag or .svga)
  const loadAnimationFile = async (f: File) => {
    try {
      setIsLoadingFile(true);
      setFile(f);
      setReplacedImages({});
      setUploadedImages({});
      setReplacedColors({});
      const buf = await f.arrayBuffer();
      setBuffer(buf);

      const { metadata: meta, svgaMovie: movie } = await parseAnimationFile(f);
      setMetadata(meta);
      setSvgaMovie(movie || null);
      setTargetFps(Math.round(meta.fps));
      setTrimStart(0);
      setTrimEnd(meta.durationSeconds);

      if (meta.fileType === 'SVGA') {
        setConvertFormat('SVGA -> SVGA (Deep Re-compression)');
      } else {
        setConvertFormat('PAG -> SVGA');
      }

      setIsLoadingFile(false);
    } catch (err: any) {
      console.error(err);
      alert('تعذر قراءة ملف الأنيميشن: ' + (err.message || err));
      setIsLoadingFile(false);
    }
  };

  // Live estimated compressed size
  const estimatedOutput = useMemo(() => {
    if (!metadata || !file) return null;
    return estimateOutputSize({
      originalSize: file.size,
      totalFrames: metadata.totalFrames,
      origFps: metadata.fps,
      targetFps,
      quality: compressionQuality,
      width: metadata.width,
      height: metadata.height,
      fileType: metadata.fileType
    });
  }, [metadata, file, targetFps, compressionQuality]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Render preview canvas using libpag (if PAG file)
  useEffect(() => {
    if (!buffer || !metadata || metadata.fileType !== 'PAG' || !canvasRef.current) return;

    let isCancelled = false;
    let player: any = null;
    let surface: any = null;

    const setupPlayer = async () => {
      try {
        const PAG = await getPAG();
        if (isCancelled) return;

        const blob = file ? file : new Blob([buffer]);
        const pagFile = await PAG.PAGFile.load(await blob.arrayBuffer());
        if (isCancelled || !pagFile) return;

        // Apply replaced images to the preview pagFile!
        if (replacedImages && Object.keys(replacedImages).length > 0) {
          for (const [key, base64] of Object.entries(replacedImages)) {
            if (key.startsWith('PAG_Image_')) {
              const index = parseInt(key.replace('PAG_Image_', ''), 10);
              if (!isNaN(index)) {
                try {
                  const img = new Image();
                  img.src = base64 as string;
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                  });
                  const pagImage = PAG.PAGImage.fromSource(img);
                  pagFile.replaceImage(index, pagImage);
                } catch (e) {
                  console.warn('Failed to apply preview image replacement', key, e);
                }
              }
            }
          }
        }

        player = await PAG.PAGPlayer.create();
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!canvas.id) {
          canvas.id = 'pag-preview-canvas-static';
        }

        canvas.width = metaWidth(metadata);
        canvas.height = metaHeight(metadata);

        player.setComposition(pagFile);
        surface = PAG.PAGSurface.fromCanvas('#' + canvas.id);
        if (surface) {
          surface.updateSize();
        }
        player.setSurface(surface);
        player.setVideoEnabled(true);
        player.setProgress(0);
        await player.flush();
        pagPlayerRef.current = player;

        let startTime = performance.now();
        const durationSec = metadata.durationSeconds;

        const renderLoop = () => {
          if (isCancelled || !pagPlayerRef.current) return;
          const elapsed = (performance.now() - startTime) / 1000;
          const currentProgress = (elapsed % durationSec) / durationSec;
          setCurrentTime(parseFloat((elapsed % durationSec).toFixed(2)));

          pagPlayerRef.current.setProgress(currentProgress);
          pagPlayerRef.current.flush().then(() => {
            if (!isCancelled && isPlayingRef.current) {
              animFrameRef.current = requestAnimationFrame(renderLoop);
            }
          });
        };

        if (isPlayingRef.current) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
        }
      } catch (e) {
        console.error('Failed to setup PAG player', e);
      }
    };

    setupPlayer();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (player) {
        try { player.destroy?.(); } catch (e) {}
      }
      if (surface) {
        try { surface.destroy?.(); } catch (e) {}
      }
      pagPlayerRef.current = null;
    };
  }, [buffer, metadata, file, replacedImages]);

  const metaWidth = (meta: PagMetadata) => meta.width || 600;
  const metaHeight = (meta: PagMetadata) => meta.height || 200;

  const handleStartConversion = async () => {
    if (!buffer || !metadata || !file) return;

    setIsConverting(true);
    setProgress(0);
    setLogs([]);
    const startMs = Date.now();

    try {
      let svgaBlob: Blob;
      let svgaSize: number;
      let outputExt = '.svga';

      if (convertFormat === 'SVGA -> SVGA (Deep Re-compression)') {
        const res = await compressSvgaFile(file, {
          targetFps,
          compressionQuality,
          replacedImages,
          replacedColors,
          onProgress: (pct, msg) => {
            setProgress(pct);
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`]);
          }
        });
        svgaBlob = res.svgaBlob;
        svgaSize = res.svgaSize;
        outputExt = '.svga';
      } else {
        const res = await convertPagToSvga(file || buffer, {
          targetFps,
          compressionQuality,
          startTime: trimStart,
          endTime: trimEnd,
          replacedImages,
          replacedColors,
          onProgress: (pct, msg) => {
            setProgress(pct);
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`]);
          }
        });
        svgaBlob = res.svgaBlob;
        svgaSize = res.svgaSize;
        outputExt = '.svga';
      }

      const elapsedSec = Math.round((Date.now() - startMs) / 1000);
      const url = URL.createObjectURL(svgaBlob);
      const outputName = file.name.replace(/\.[^/.]+$/, "") + "_Converted" + outputExt;

      setResultModal({
        svgaUrl: url,
        svgaSize,
        filename: outputName,
        elapsedSec: Math.max(1, elapsedSec)
      });
    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء معالجة الملف: " + err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleImageReplace = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setUploadedImages(prev => ({ ...prev, [key]: base64 }));
        setReplacedImages(prev => ({
          ...prev,
          [key]: base64
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageDelete = (key: string) => {
    // 1x1 transparent PNG base64
    const transparentBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    setUploadedImages(prev => ({ ...prev, [key]: transparentBase64 }));
    setReplacedImages(prev => ({
      ...prev,
      [key]: transparentBase64
    }));
  };

  const handleImageDownload = (key: string, base64: string) => {
    const a = document.createElement('a');
    a.href = base64;
    a.download = `${key}.png`;
    a.click();
  };

  const applyTint = async (originalBase64: string, colorHex: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(originalBase64);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        if (colorHex && colorHex !== '#00000000') {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = colorHex + '80'; // 50% opacity overlay
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(originalBase64);
      img.src = originalBase64;
    });
  };

  const handleImageTint = async (key: string, colorHex: string) => {
    const base = uploadedImages[key] || metadata?.images?.[key];
    if (!base) return;
    const tinted = await applyTint(base, colorHex);
    setReplacedImages(prev => ({ ...prev, [key]: tinted }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090e]/95 backdrop-blur-xl p-2 sm:p-6 font-arabic text-white overflow-y-auto" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#0b0f17] w-full max-w-6xl min-h-[90vh] rounded-[2.5rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden relative"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 px-8 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg shadow-sky-500/20">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                محول ومضغط ملفات PAG & SVGA الاحترافي
              </h2>
              <p className="text-slate-400 text-xs font-bold mt-0.5">
                Full Precision Resolution Preserving Engine (100% Dimensions Guarantee)
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Main Workspace Left / Center */}
          <div className="flex-1 flex flex-col bg-[#06080e] relative p-6 overflow-y-auto">
            
            {/* Tags Ribbon */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {['PAG -> SVGA', 'SVGA -> SVGA', 'تثبيت الأبعاد 100%', 'توقع الحجم المباشر', 'ضغط إجهادي عالي'].map(tag => (
                <span 
                  key={tag} 
                  className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all ${
                    tag.includes('تثبيت') || tag.includes('توقع')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.2)]' 
                      : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            {!file ? (
              /* Dropzone */
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) loadAnimationFile(e.dataTransfer.files[0]);
                  }}
                  className="w-full max-w-xl p-12 rounded-[2rem] border-2 border-dashed border-sky-500/30 hover:border-sky-500/80 bg-sky-500/5 hover:bg-sky-500/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                >
                  <div className="w-20 h-20 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform shadow-xl shadow-sky-500/20">
                    <Upload className="w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">اختر أو اسحب ملف PAG أو SVGA</h3>
                  <p className="text-slate-400 text-sm mb-4">يدعم المعاينة الفورية، الضغط الشديد بدون تغيير الأبعاد، وتحديد الحجم المستهدف</p>
                  <span className="px-6 py-2.5 bg-sky-500 text-white rounded-xl text-xs font-black shadow-lg shadow-sky-500/30">
                    تصفح الملفات (.PAG / .SVGA)
                  </span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".pag,.svga" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && loadAnimationFile(e.target.files[0])} 
                />
              </div>
            ) : (
              /* Animation Preview Player */
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-2xl bg-black/60 rounded-3xl p-4 border border-white/10 shadow-2xl flex flex-col items-center relative group">
                  
                  {/* Resolution Lock Badge */}
                  <div className="absolute top-6 right-6 z-20 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    الأبعاد أصلية 100% ({metadata?.width} x {metadata?.height}px)
                  </div>

                  <div className="w-full aspect-video max-h-[380px] flex items-center justify-center overflow-hidden rounded-2xl relative bg-[#030407]"
                       style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
                    
                    {isLoadingFile ? (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                        <span className="text-sm font-bold text-slate-300">جاري تحميل وتحليل الملف...</span>
                      </div>
                    ) : metadata?.fileType === 'SVGA' && buffer ? (
                      <SVGAPlayer 
                        data={URL.createObjectURL(new Blob([buffer]))} 
                        replacedImages={replacedImages}
                        replacedColors={replacedColors}
                        className="max-w-full max-h-full object-contain drop-shadow-2xl" 
                      />
                    ) : (
                      <canvas id="pag-studio-preview-canvas" ref={canvasRef} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                    )}
                  </div>

                  {/* Player Controls Bar */}
                  {metadata && (
                    <div className="w-full mt-4 flex items-center gap-4 bg-white/5 p-3 px-5 rounded-2xl border border-white/5">
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-10 h-10 bg-sky-500 hover:bg-sky-400 rounded-xl flex items-center justify-center text-white transition-all shadow-md shadow-sky-500/20"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                      </button>

                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-sky-400">{currentTime}s</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sky-400 transition-all duration-100" 
                            style={{ width: `${(currentTime / (metadata.durationSeconds || 1)) * 100}%` }} 
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-400">{metadata.durationSeconds}s</span>
                      </div>

                      <button 
                        onClick={() => { setFile(null); setBuffer(null); setMetadata(null); }}
                        className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl text-xs font-bold transition-colors"
                      >
                        تغيير الملف
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Estimated Size Output Box */}
                {estimatedOutput && (
                  <div className="w-full max-w-2xl mt-4 bg-gradient-to-r from-sky-950/60 via-indigo-950/60 to-purple-950/60 p-4 rounded-2xl border border-sky-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center border border-sky-400/30">
                        <Gauge className="w-5 h-5 text-sky-300" />
                      </div>
                      <div>
                        <span className="text-xs text-slate-300 font-bold block">توقع الحجم الناتج المباشر (Estimated Size)</span>
                        <span className="text-xs text-slate-400">الحجم الأصلي: <strong className="text-white font-mono">{formatBytes(file.size)}</strong></span>
                      </div>
                    </div>
                    
                    <div className="text-left dir-ltr">
                      <div className="text-xl font-black text-emerald-400 font-mono tracking-tight">
                        ~{estimatedOutput.formatted}
                      </div>
                      <span className="text-[10px] text-emerald-300/80 font-bold">
                        توفير متوقع: {Math.max(0, Math.round((1 - estimatedOutput.bytes / file.size) * 100))}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Conversion Logs */}
                {isConverting && (
                  <div className="w-full max-w-2xl mt-4 bg-slate-950 p-4 rounded-2xl border border-sky-500/30 text-right">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-sky-400 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        سجل العمليات المباشر (Processing Log)
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="max-h-28 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1 dir-ltr text-left custom-scrollbar">
                      {logs.map((log, idx) => (
                        <div key={idx} className="text-slate-300">{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar - Controls & Custom Target Size */}
          {metadata && file && (
            <div className="w-full lg:w-96 bg-[#090d14] border-r border-white/10 p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar">
              
              <div className="space-y-6">
                
                {/* Animation Info */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
                  <h3 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    تفاصيل الملف الأصلي
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-500 text-[10px] block">النوع</span>
                      <span className="font-bold text-white font-mono">{metadata.fileType}</span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-500 text-[10px] block">الأبعاد (ثابتة)</span>
                      <span className="font-bold text-emerald-400 font-mono">{metadata.width} x {metadata.height}</span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-500 text-[10px] block">الحجم الحالي</span>
                      <span className="font-bold text-white font-mono">{formatBytes(file.size)}</span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-500 text-[10px] block">الإطارات / FPS</span>
                      <span className="font-bold text-sky-300 font-mono">{metadata.fps} FPS</span>
                    </div>
                  </div>
                </div>

                {/* Compression Controls */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    إعدادات الضغط وجودة الصورة
                  </h3>

                  {/* Sequence FPS */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">معدل الإطارات (FPS)</span>
                      <span className="text-sky-400 font-mono">{targetFps} FPS</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="60" 
                      value={targetFps} 
                      onChange={(e) => setTargetFps(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  {/* Format Mode */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-300 block">نمط التحويل</span>
                    <select 
                      value={convertFormat} 
                      onChange={(e) => setConvertFormat(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
                    >
                      <option value="PAG -> SVGA">PAG -&gt; SVGA 2.0 (تحويل PAG إلى SVGA)</option>
                      <option value="SVGA -> SVGA (Deep Re-compression)">SVGA -&gt; SVGA (إعادة ضغط طبقات SVGA)</option>
                    </select>
                  </div>

                  {/* Compression Quality */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">درجة الضغط (Compression Level)</span>
                      <span className="text-emerald-400 font-mono">{compressionQuality}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={compressionQuality} 
                      onChange={(e) => {
                        setCompressionQuality(Number(e.target.value));
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold pt-1">
                      <span>أقصى ضغط (0%)</span>
                      <span>أعلى جودة (100%)</span>
                    </div>
                  </div>
                </div>

                {/* Image Layers Edit */}
                {metadata.images && Object.keys(metadata.images).length > 0 && (
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        تغيير الطبقات والصور
                      </h3>
                      <button
                        onClick={() => {
                          Object.entries(metadata.images!).forEach(([key, base64]) => {
                            handleImageDownload(key, replacedImages[key] || base64);
                          });
                        }}
                        className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> تنزيل الكل
                      </button>
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {Object.entries(metadata.images).map(([key, base64]) => (
                        <div key={key} className="bg-black/30 p-2 rounded-xl border border-white/5 flex items-center justify-between gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                            <img src={replacedImages[key] || base64} alt={key} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 truncate text-[10px] text-slate-300 font-mono" title={key}>
                            {key}
                          </div>
                          <div className="flex-shrink-0 relative flex gap-1">
                            <div className="relative">
                              <input
                                type="color"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleImageTint(key, e.target.value)}
                                title="تلوين الطبقة (شفاف)"
                              />
                              <button className="bg-fuchsia-500/20 text-fuchsia-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-fuchsia-500/30 hover:bg-fuchsia-500/30 transition-colors pointer-events-none">
                                تلوين
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleImageReplace(key, e)}
                              />
                              <button className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-sky-500/30 hover:bg-sky-500/30 transition-colors pointer-events-none">
                                تغيير
                              </button>
                            </div>
                            <button 
                              onClick={() => handleImageDownload(key, replacedImages[key] || base64)}
                              className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                            >
                              تنزيل
                            </button>
                            <button 
                              onClick={() => handleImageDelete(key)}
                              className="bg-red-500/20 text-red-400 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SVGA Color Palette Edit */}
                {metadata.fileType === 'SVGA' && metadata.colors && metadata.colors.length > 0 && (
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-4">
                    <h3 className="text-xs font-black uppercase text-pink-400 tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      تغيير الألوان (Vectors)
                    </h3>
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {metadata.colors.map(hex => (
                        <div key={hex} className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg group">
                          <div className="absolute inset-0 z-0" style={{ backgroundColor: replacedColors[hex] || hex }}></div>
                          <input
                            type="color"
                            value={replacedColors[hex] || hex}
                            onChange={(e) => setReplacedColors(prev => ({ ...prev, [hex]: e.target.value }))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            title="انقر لتغيير اللون"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Start Conversion Button */}
              <button 
                onClick={handleStartConversion}
                disabled={isConverting}
                className="w-full py-4 mt-6 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white font-black rounded-2xl shadow-xl shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>جاري الضغط والتحويل...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>بدء الضغط والتحويل (Start Conversion)</span>
                  </>
                )}
              </button>

            </div>
          )}

        </div>
      </motion.div>

      {/* Result Summary Modal */}
      <AnimatePresence>
        {resultModal && metadata && file && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0f1420] w-full max-w-3xl rounded-[2rem] border border-white/10 p-6 sm:p-8 shadow-2xl text-right font-arabic"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">نتيجة ضغط وتحويل الأنيميشن</h3>
                    <p className="text-xs text-emerald-400 font-bold">تم الضغط بنجاح مع الحفاظ الكامل على المقاسات الأصلية</p>
                  </div>
                </div>
                <button onClick={() => setResultModal(null)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Grid Comparison */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-xs">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">النمط</span>
                  <span className="font-bold text-white font-mono">{convertFormat}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">المقاس الأكاديمي (ثابت)</span>
                  <span className="font-bold text-emerald-400 font-mono">{metadata.width} x {metadata.height}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">مقارنة الحجم</span>
                  <span className="font-bold text-sky-400 font-mono">{formatBytes(file.size)} -&gt; {formatBytes(resultModal.svgaSize)}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">المدة الزمانية</span>
                  <span className="font-bold text-emerald-400 font-mono">{metadata.durationSeconds}s</span>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">معدل الإطارات (FPS)</span>
                  <span className="font-bold text-white font-mono">{targetFps} FPS</span>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <span className="text-slate-400 text-[10px] block mb-1">نسبة التوفير في المساحة</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {Math.max(0, Math.round((1 - resultModal.svgaSize / file.size) * 100))}%
                  </span>
                </div>
              </div>

              {/* Converted SVGA Live Preview */}
              <div className="mb-6 bg-black/60 rounded-2xl p-4 border border-white/10 flex items-center justify-center h-48 relative overflow-hidden">
                <SVGAPlayer data={resultModal.svgaUrl} className="max-w-full max-h-full object-contain" />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                <button 
                  onClick={() => setResultModal(null)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة المعالجة
                </button>

                <div className="flex items-center gap-3">
                  <a 
                    href={resultModal.svgaUrl} 
                    download={resultModal.filename}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    تحميل الملف المضغوط ({formatBytes(resultModal.svgaSize)})
                  </a>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
