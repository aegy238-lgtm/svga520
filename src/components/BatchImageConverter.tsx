import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, X, Image as ImageIcon, CheckCircle2, AlertCircle, 
  Play, Pause, Download, Settings2, Trash2, RefreshCw, FolderUp,
  FileImage, Layers, Link as LinkIcon, Unlink, ArrowLeftRight,
  Maximize2, Minimize2, Sparkles, Check, Sliders, Shield
} from 'lucide-react';
import JSZip from 'jszip';
import UPNG from 'upng-js';

type ConversionStatus = 'pending' | 'processing' | 'done' | 'error' | 'paused';

interface QueuedImage {
  id: string;
  file: File;
  status: ConversionStatus;
  progress: number;
  originalWidth?: number;
  originalHeight?: number;
  newWidth?: number;
  newHeight?: number;
  resultBlob?: Blob;
  error?: string;
}

interface BatchImageConverterProps {
  onClose: () => void;
}

export const BatchImageConverter: React.FC<BatchImageConverterProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Format & Quality Settings
  const [targetFormat, setTargetFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [quality, setQuality] = useState<number>(80);
  const [autoStart, setAutoStart] = useState<boolean>(true);
  
  // Dimensions & Resizing Settings
  const [resizeEnabled, setResizeEnabled] = useState<boolean>(false);
  const [resizeType, setResizeType] = useState<'custom' | 'scale'>('custom');
  const [customWidth, setCustomWidth] = useState<number>(512);
  const [customHeight, setCustomHeight] = useState<number>(512);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [aspectRatioValue, setAspectRatioValue] = useState<number>(1); // width / height
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [resizeMode, setResizeMode] = useState<'contain' | 'exact' | 'cover' | 'pad' | 'maxBounds'>('contain');
  const [bgColor, setBgColor] = useState<string>('#FFFFFF');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const queueRef = useRef<QueuedImage[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Dimension presets
  const presets = [
    { label: '512×512 (أيقونات / SVGA)', w: 512, h: 512 },
    { label: '1080×1080 (إنستغرام / مربع)', w: 1080, h: 1080 },
    { label: '750×1334 (شاشة هاتف HD)', w: 750, h: 1334 },
    { label: '1080×1920 (ستوري و فل HD)', w: 1080, h: 1920 },
    { label: '1920×1080 (شاشة أفقية 16:9)', w: 1920, h: 1080 },
    { label: '256×256 (صور مصغرة)', w: 256, h: 256 },
    { label: '128×128 (أيقونات صغيرة)', w: 128, h: 128 },
  ];

  const handleWidthChange = (val: number) => {
    const w = Math.max(1, Math.min(10000, val || 1));
    setCustomWidth(w);
    if (maintainAspectRatio && aspectRatioValue > 0) {
      setCustomHeight(Math.max(1, Math.round(w / aspectRatioValue)));
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(1, Math.min(10000, val || 1));
    setCustomHeight(h);
    if (maintainAspectRatio && aspectRatioValue > 0) {
      setCustomWidth(Math.max(1, Math.round(h * aspectRatioValue)));
    }
  };

  const handleSwapDimensions = () => {
    const tempW = customWidth;
    setCustomWidth(customHeight);
    setCustomHeight(tempW);
    if (tempW > 0) {
      setAspectRatioValue(customHeight / tempW);
    }
  };

  const applyPreset = (w: number, h: number) => {
    setCustomWidth(w);
    setCustomHeight(h);
    setAspectRatioValue(w / h);
    setResizeEnabled(true);
    setResizeType('custom');
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    const newItems: QueuedImage[] = Array.from(files)
      .filter(file => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name))
      .map(file => ({
        id: Math.random().toString(36).substring(7) + Date.now(),
        file,
        status: 'pending',
        progress: 0
      }));
    
    if (newItems.length === 0) return;

    setQueue(prev => {
      const next = [...prev, ...newItems];
      queueRef.current = next;
      return next;
    });

    if (autoStart && !processingRef.current) {
      setTimeout(() => {
        startProcessing();
      }, 100);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setQueue([]);
  };

  const processImage = async (item: QueuedImage): Promise<{
    blob?: Blob;
    error?: string;
    originalWidth?: number;
    originalHeight?: number;
    newWidth?: number;
    newHeight?: number;
  }> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(item.file);
      const img = new Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const origW = img.naturalWidth || img.width || 500;
          const origH = img.naturalHeight || img.height || 500;

          let drawX = 0;
          let drawY = 0;
          let drawW = origW;
          let drawH = origH;
          let canvasW = origW;
          let canvasH = origH;

          // Compute dimensions according to selected resizing strategy
          if (resizeEnabled) {
            if (resizeType === 'scale') {
              const factor = Math.max(0.01, scalePercent / 100);
              canvasW = Math.max(1, Math.round(origW * factor));
              canvasH = Math.max(1, Math.round(origH * factor));
              drawW = canvasW;
              drawH = canvasH;
            } else if (resizeType === 'custom') {
              const targetW = Math.max(1, customWidth || 512);
              const targetH = Math.max(1, customHeight || 512);

              if (resizeMode === 'exact') {
                // Exact hard stretch
                canvasW = targetW;
                canvasH = targetH;
                drawW = targetW;
                drawH = targetH;
              } else if (resizeMode === 'contain') {
                // Contain without padding (canvas fits proportional image)
                const ratio = Math.min(targetW / origW, targetH / origH);
                canvasW = Math.max(1, Math.round(origW * ratio));
                canvasH = Math.max(1, Math.round(origH * ratio));
                drawW = canvasW;
                drawH = canvasH;
              } else if (resizeMode === 'cover') {
                // Cover and crop to exact target frame
                canvasW = targetW;
                canvasH = targetH;
                const ratio = Math.max(targetW / origW, targetH / origH);
                drawW = Math.round(origW * ratio);
                drawH = Math.round(origH * ratio);
                drawX = Math.round((targetW - drawW) / 2);
                drawY = Math.round((targetH - drawH) / 2);
              } else if (resizeMode === 'pad') {
                // Pad to exact target size with background color
                canvasW = targetW;
                canvasH = targetH;
                const ratio = Math.min(targetW / origW, targetH / origH);
                drawW = Math.round(origW * ratio);
                drawH = Math.round(origH * ratio);
                drawX = Math.round((targetW - drawW) / 2);
                drawY = Math.round((targetH - drawH) / 2);
              } else if (resizeMode === 'maxBounds') {
                // Max bounding box: only shrink if larger
                if (origW > targetW || origH > targetH) {
                  const ratio = Math.min(targetW / origW, targetH / origH);
                  canvasW = Math.max(1, Math.round(origW * ratio));
                  canvasH = Math.max(1, Math.round(origH * ratio));
                  drawW = canvasW;
                  drawH = canvasH;
                }
              }
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = canvasW;
          canvas.height = canvasH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error("تعذر إنشاء بيئة الرسم Canvas");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Background fill for JPEG or padded transparent images
          if (targetFormat === 'image/jpeg' || (resizeMode === 'pad' && bgColor !== 'transparent')) {
            ctx.fillStyle = targetFormat === 'image/jpeg' && bgColor === 'transparent' ? '#FFFFFF' : bgColor;
            ctx.fillRect(0, 0, canvasW, canvasH);
          }

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Advanced Lossy PNG Compression via UPNG color palette quantization
          if (targetFormat === 'image/png' && quality < 100) {
            try {
              const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
              const quantLevels = Math.max(16, Math.min(256, Math.round(256 * (quality / 100))));
              const pngArrayBuffer = UPNG.encode([imgData.data.buffer], canvasW, canvasH, quantLevels);
              const compressedBlob = new Blob([pngArrayBuffer], { type: 'image/png' });
              resolve({
                blob: compressedBlob,
                originalWidth: origW,
                originalHeight: origH,
                newWidth: canvasW,
                newHeight: canvasH
              });
              return;
            } catch (upngErr) {
              console.warn('UPNG lossy compression fallback to native:', upngErr);
            }
          }

          // Native canvas compression (WebP / JPEG / Lossless PNG)
          canvas.toBlob((blob) => {
            if (blob) {
              resolve({
                blob,
                originalWidth: origW,
                originalHeight: origH,
                newWidth: canvasW,
                newHeight: canvasH
              });
            } else {
              resolve({ error: "فشل ضغط وتحويل الصورة" });
            }
          }, targetFormat, quality / 100);

        } catch (e: any) {
          resolve({ error: e.message || 'حدث خطأ أثناء معالجة الصورة' });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ error: "فشل قراءة ملف الصورة" });
      };

      img.src = url;
    });
  };

  const processNext = async () => {
    if (!processingRef.current || pausedRef.current) return;

    const pendingIndex = queueRef.current.findIndex(q => q.status === 'pending');
    
    if (pendingIndex === -1) {
      const isAllDone = queueRef.current.every(q => q.status !== 'processing' && q.status !== 'pending');
      if (isAllDone) {
        setIsProcessing(false);
        processingRef.current = false;
      }
      return;
    }

    const item = queueRef.current[pendingIndex];
    queueRef.current[pendingIndex] = { ...item, status: 'processing', progress: 50 };
    setQueue([...queueRef.current]);

    const result = await processImage(item);

    const updatedIndex = queueRef.current.findIndex(q => q.id === item.id);
    if (updatedIndex !== -1) {
      queueRef.current[updatedIndex] = {
        ...queueRef.current[updatedIndex],
        status: result.error ? 'error' : 'done',
        progress: 100,
        resultBlob: result.blob,
        originalWidth: result.originalWidth,
        originalHeight: result.originalHeight,
        newWidth: result.newWidth,
        newHeight: result.newHeight,
        error: result.error
      };
      setQueue([...queueRef.current]);
    }

    processNext();
  };

  const startProcessing = async () => {
    if (queueRef.current.filter(q => q.status === 'pending').length === 0) return;
    
    setIsProcessing(true);
    setIsPaused(false);
    pausedRef.current = false;
    processingRef.current = true;

    const concurrency = 4; // Process 4 images concurrently for peak browser responsiveness

    for (let i = 0; i < concurrency; i++) {
      processNext();
    }
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      pausedRef.current = false;
      startProcessing();
    } else {
      setIsPaused(true);
      pausedRef.current = true;
    }
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    setIsPaused(false);
    processingRef.current = false;
    pausedRef.current = false;
    
    setQueue(prev => prev.map(item => item.status === 'processing' ? { ...item, status: 'pending', progress: 0 } : item));
  };

  const downloadAll = async () => {
    const doneItems = queue.filter(q => q.status === 'done' && q.resultBlob);
    if (doneItems.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("Converted_Images");
    
    const ext = targetFormat === 'image/jpeg' ? 'jpg' : targetFormat === 'image/png' ? 'png' : 'webp';

    doneItems.forEach((item) => {
      const originalName = item.file.name.replace(/\.[^/.]+$/, "");
      folder?.file(`${originalName}_converted.${ext}`, item.resultBlob!);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `Converted_Images_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadSingle = (item: QueuedImage) => {
    if (!item.resultBlob) return;
    const ext = targetFormat === 'image/jpeg' ? 'jpg' : targetFormat === 'image/png' ? 'png' : 'webp';
    const originalName = item.file.name.replace(/\.[^/.]+$/, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(item.resultBlob);
    link.download = `${originalName}_converted.${ext}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const stats = {
    total: queue.length,
    done: queue.filter(q => q.status === 'done').length,
    pending: queue.filter(q => q.status === 'pending').length,
    error: queue.filter(q => q.status === 'error').length,
    processing: queue.filter(q => q.status === 'processing').length,
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 font-sans select-none" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[#0b0f19] w-full max-w-7xl h-[92vh] rounded-[2rem] border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">المحول الجماعي للصور</h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                  تحكم كامل بالمقاس والضغط
                </span>
              </div>
              <p className="text-slate-400 text-xs font-semibold tracking-wider">UNLIMITED BATCH IMAGE CONVERTER & COMPRESSOR</p>
            </div>
          </div>
          <button 
            onClick={() => { stopProcessing(); onClose(); }}
            className="w-10 h-10 bg-white/5 hover:bg-white/15 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          
          {/* Sidebar Settings */}
          <div className="w-full md:w-96 border-b md:border-b-0 md:border-l border-white/10 bg-slate-950/70 p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <h3 className="text-white font-black text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-400" />
                  <span>إعدادات التحويل والضغط</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">خيارات متقدمة</span>
              </div>
              
              {/* Output Format Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">صيغة الإخراج</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'image/jpeg', label: 'JPG' },
                    { id: 'image/png', label: 'PNG' },
                    { id: 'image/webp', label: 'WebP' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setTargetFormat(fmt.id as any)}
                      disabled={isProcessing}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        targetFormat === fmt.id 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/30' 
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality & Compression Slider */}
              <div className="space-y-2 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span>نسبة الجودة والضغط</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                      {quality >= 90 ? 'أعلى دقة' : quality >= 65 ? 'ضغط متوازن' : 'أقصى ضغط'}
                    </span>
                  </label>
                  <span className="text-indigo-400 font-black text-xs font-mono">{quality}%</span>
                </div>
                <input 
                  type="range" min="5" max="100" value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>أصغر حجم (5%)</span>
                  <span>متوازن (80%)</span>
                  <span>أعلى جودة (100%)</span>
                </div>
              </div>

              {/* Auto Start Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div>
                  <label className="text-xs font-bold text-slate-300 block">تحويل تلقائي فوري</label>
                  <p className="text-[10px] text-slate-500">يبدأ المعالجة فور إضافة الصور</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setAutoStart(!autoStart)}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${autoStart ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoStart ? 'right-6' : 'right-1'}`} />
                </button>
              </div>

              {/* Resize & Dimensions Main Section */}
              <div className="space-y-3 pt-4 border-t border-white/10 bg-indigo-950/20 -mx-5 px-5 py-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>التحكم في المقاس والأبعاد</span>
                    </label>
                    <p className="text-[10px] text-slate-400">تغيير وتثبيت العرض والطول لجميع الصور</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setResizeEnabled(!resizeEnabled)}
                    disabled={isProcessing}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${resizeEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${resizeEnabled ? 'right-6' : 'right-1'}`} />
                  </button>
                </div>

                {/* Resize Controls Container */}
                {resizeEnabled && (
                  <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2">
                    
                    {/* Mode Selector: Custom vs Percentage */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setResizeType('custom')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          resizeType === 'custom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        أبعاد بالبكسل (W × H)
                      </button>
                      <button
                        type="button"
                        onClick={() => setResizeType('scale')}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          resizeType === 'scale' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        نسبة مئوية (%)
                      </button>
                    </div>

                    {resizeType === 'custom' ? (
                      <>
                        {/* Width & Height Inputs with Lock & Swap */}
                        <div className="grid grid-cols-5 gap-2 items-center">
                          {/* Width */}
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">العرض (Width)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="1" 
                                max="10000"
                                value={customWidth}
                                onChange={(e) => handleWidthChange(parseInt(e.target.value))}
                                disabled={isProcessing}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                              />
                              <span className="absolute left-2.5 top-2.5 text-[10px] text-slate-500 font-mono">px</span>
                            </div>
                          </div>

                          {/* Lock / Swap controls */}
                          <div className="col-span-1 flex flex-col items-center justify-center gap-1 pt-4">
                            <button
                              type="button"
                              onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                              title={maintainAspectRatio ? 'نسبة الأبعاد مقفلة' : 'نسبة الأبعاد حرة'}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                maintainAspectRatio 
                                  ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' 
                                  : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {maintainAspectRatio ? <LinkIcon className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={handleSwapDimensions}
                              title="تبديل العرض والارتفاع"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Height */}
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">الطول (Height)</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                min="1" 
                                max="10000"
                                value={customHeight}
                                onChange={(e) => handleHeightChange(parseInt(e.target.value))}
                                disabled={isProcessing}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                              />
                              <span className="absolute left-2.5 top-2.5 text-[10px] text-slate-500 font-mono">px</span>
                            </div>
                          </div>
                        </div>

                        {/* Fitting Mode Strategy */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-slate-400 block">طريقة ملاءمة وتثبيت الأبعاد:</label>
                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                            {[
                              { id: 'contain', label: 'تناسب واحتواء' },
                              { id: 'cover', label: 'ملء وقص' },
                              { id: 'exact', label: 'تثبيت وتمدد' },
                              { id: 'pad', label: 'إطار مع خلفية' },
                              { id: 'maxBounds', label: 'أقصى حد فقط' }
                            ].map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setResizeMode(m.id as any)}
                                className={`py-1.5 px-2 rounded-lg font-bold border transition-all truncate ${
                                  resizeMode === m.id 
                                    ? 'bg-indigo-600 border-indigo-400 text-white shadow' 
                                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Quick Presets Grid */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-slate-400 block">مقاسات سريعة وشائعة:</label>
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto custom-scrollbar">
                            {presets.map((p, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => applyPreset(p.w, p.h)}
                                className="text-[9px] px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-mono transition-all"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Scale Percentage Slider */
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">نسبة تغيير الحجم:</label>
                          <span className="text-indigo-400 font-black text-xs font-mono">{scalePercent}%</span>
                        </div>
                        <input 
                          type="range" min="10" max="200" step="5" value={scalePercent}
                          onChange={(e) => setScalePercent(parseInt(e.target.value))}
                          disabled={isProcessing}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="grid grid-cols-4 gap-1">
                          {[25, 50, 75, 100].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setScalePercent(s)}
                              className={`py-1 rounded text-[10px] font-mono font-bold ${
                                scalePercent === s ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                              }`}
                            >
                              {s}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>

            {/* Processing Stats Card */}
            <div className="mt-auto space-y-3 pt-2">
              <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 rounded-2xl p-4 shadow-lg">
                <h4 className="text-indigo-300 font-bold text-xs mb-2 flex items-center justify-between">
                  <span>إحصائيات المعالجة</span>
                  <span className="text-[10px] font-mono text-slate-400">{stats.done} / {stats.total}</span>
                </h4>
                <ul className="space-y-1.5 text-[11px] text-slate-300 font-mono">
                  <li className="flex justify-between"><span>إجمالي الصور:</span> <span className="text-white font-bold">{stats.total}</span></li>
                  <li className="flex justify-between"><span>اكتمل بنجاح:</span> <span className="text-emerald-400 font-bold">{stats.done}</span></li>
                  <li className="flex justify-between"><span>قيد الانتظار:</span> <span className="text-amber-400 font-bold">{stats.pending}</span></li>
                  <li className="flex justify-between"><span>أخطاء:</span> <span className="text-red-400 font-bold">{stats.error}</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-slate-950/40 relative">
            
            {/* Top Action Toolbar */}
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <FileImage className="w-4 h-4" />
                  <span>إضافة صور</span>
                </button>
                <button 
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-white/10 cursor-pointer disabled:opacity-50"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>إضافة مجلد كامل</span>
                </button>
                <input 
                  type="file" ref={fileInputRef} multiple accept="image/*" className="hidden"
                  onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                />
                <input 
                  type="file" ref={folderInputRef} 
                  {...{ webkitdirectory: "", directory: "" } as any} 
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                />
              </div>
              
              <div className="flex items-center gap-2">
                {stats.total > 0 && !isProcessing && stats.done < stats.total && (
                  <button 
                    onClick={startProcessing}
                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>بدء التحويل والضغط</span>
                  </button>
                )}
                {isProcessing && (
                  <button 
                    onClick={togglePause}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-amber-500/30 cursor-pointer"
                  >
                    {isPaused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
                    <span>{isPaused ? 'استكمال' : 'إيقاف مؤقت'}</span>
                  </button>
                )}
                {stats.done > 0 && !isProcessing && (
                  <button 
                    onClick={downloadAll}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الكل مضغوطاً (ZIP)</span>
                  </button>
                )}
                <button 
                  onClick={clearQueue}
                  disabled={isProcessing || queue.length === 0}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>مسح</span>
                </button>
              </div>
            </div>

            {/* Queue List Area */}
            <div 
              className={`flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar ${
                isDragging ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-400 m-4 rounded-3xl' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {queue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 pointer-events-none py-12">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-3xl flex items-center justify-center mb-5 shadow-2xl shadow-indigo-500/10 animate-bounce">
                    <Upload className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">اسحب وأفلت الصور هنا للتحويل والضغط</h3>
                  <p className="text-xs text-slate-400 max-w-md text-center leading-relaxed">
                    يدعم جميع صيغ الصور ومجلدات كاملة مع تحكم كامل بأبعاد العرض والطول ونسبة الضغط
                  </p>
                  <div className="flex gap-2 mt-5">
                    <span className="text-[11px] text-indigo-300 font-bold bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full">
                      ضغط حقيقي وفوري
                    </span>
                    <span className="text-[11px] text-purple-300 font-bold bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-full">
                      تثبيت المقاس بدقة
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {queue.map((item) => {
                    const originalSize = item.file.size;
                    const newSize = item.resultBlob?.size;
                    const savingsPercent = (originalSize && newSize) 
                      ? Math.round(((originalSize - newSize) / originalSize) * 100) 
                      : 0;

                    return (
                      <div 
                        key={item.id} 
                        className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-4 hover:bg-slate-900/90 transition-all hover:border-indigo-500/40"
                      >
                        {/* Thumbnail preview */}
                        <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10 shadow-inner">
                          {item.resultBlob ? (
                            <img src={URL.createObjectURL(item.resultBlob)} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-500" />
                          )}
                        </div>
                        
                        {/* Meta info & Progress */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-white text-sm font-bold truncate max-w-xs sm:max-w-md" dir="ltr">
                              {item.file.name}
                            </h4>
                            
                            {/* Size & Savings badges */}
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-slate-400">{formatSize(originalSize)}</span>
                              {newSize && (
                                <>
                                  <span className="text-slate-600">➔</span>
                                  <span className="text-emerald-400 font-bold">{formatSize(newSize)}</span>
                                  {savingsPercent > 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                                      وفر {savingsPercent}%
                                    </span>
                                  )}
                                  {savingsPercent < 0 && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                                      +{Math.abs(savingsPercent)}%
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Dimensions display */}
                          {item.originalWidth && item.newWidth && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>المقاس: {item.originalWidth}×{item.originalHeight}</span>
                              <span className="text-slate-600">➔</span>
                              <span className="text-indigo-300 font-bold">{item.newWidth}×{item.newHeight} px</span>
                            </div>
                          )}

                          {/* Progress bar */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  item.status === 'done' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 
                                  item.status === 'error' ? 'bg-red-500' : 
                                  'bg-gradient-to-r from-indigo-500 to-purple-500'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold w-16 text-left">
                              {item.status === 'pending' && <span className="text-slate-500">انتظار</span>}
                              {item.status === 'processing' && <span className="text-indigo-400 animate-pulse">معالجة...</span>}
                              {item.status === 'done' && <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> تم</span>}
                              {item.status === 'error' && <span className="text-red-400">فشل</span>}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.status === 'done' && (
                            <button 
                              onClick={() => downloadSingle(item)}
                              className="p-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-xl transition-all cursor-pointer border border-emerald-500/30"
                              title="تحميل الصورة المحولة والمضغوطة"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          {!isProcessing && (
                            <button 
                              onClick={() => removeFile(item.id)}
                              className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer"
                              title="حذف من القائمة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Total Progress */}
            {stats.total > 0 && (
              <div className="p-4 border-t border-white/10 bg-slate-900/70 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">التقدم الإجمالي للدفعة</span>
                  <span className="text-xs font-black text-indigo-400 font-mono">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
