import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  RotateCcw, 
  Image as ImageIcon, 
  Settings, 
  Maximize,
  Sparkles,
  Zap,
  Check,
  X,
  Droplets,
  Sun,
  Contrast,
  Palette,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { enhanceImageCanvas } from '../utils/imageEnhance';
import { useAccessControl } from '../hooks/useAccessControl';

interface ImageEnhancerProps {
  onCancel: () => void;
  currentUser: any;
  onSubscriptionRequired?: () => void;
}

export const ImageEnhancer: React.FC<ImageEnhancerProps> = ({ onCancel, currentUser, onSubscriptionRequired }) => {
  const { checkAccess } = useAccessControl();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  // Settings
  const [settings, setSettings] = useState({
    scale: 2, // 1, 2, 4
    sharpen: 0.5, // 0 to 1
    contrast: 1.1, // 1 to 2
    saturation: 1.1, // 1 to 2
    brightness: 1.05, // 1 to 2
    denoise: 0.2 // 0 to 1
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setPreviewUrl(event.target?.result as string);
        setResultUrl(null); // reset
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = useCallback(async () => {
    if (!image) return;
    
    // Quick preview mode (Scale 1 for UI responsiveness)
    try {
      const quickPreview = enhanceImageCanvas(image, 1, {
        sharpen: settings.sharpen,
        contrast: settings.contrast,
        saturation: settings.saturation,
        brightness: settings.brightness,
        denoise: settings.denoise
      });
      setPreviewUrl(quickPreview);
    } catch (e) {
      console.error(e);
    }
  }, [image, settings]);

  // Debounced processing for sliders
  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(() => {
      processImage();
    });
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [processImage]);

  const handleExport = async () => {
    if (!image) return;

    const { allowed } = await checkAccess('Image Enhancer Export');
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    setProcessProgress(0);
    
    // Use timeout to allow UI to show processing state before heavy blocking sync operation
    setTimeout(() => {
      try {
        setProcessProgress(30);
        // Do heavy upscaling
        const hdResult = enhanceImageCanvas(image, settings.scale, {
          sharpen: settings.sharpen,
          contrast: settings.contrast,
          saturation: settings.saturation,
          brightness: settings.brightness,
          denoise: settings.denoise
        });
        
        setProcessProgress(80);
        
        const link = document.createElement('a');
        link.download = `HD_Enhanced_${Date.now()}.png`;
        link.href = hdResult;
        link.click();
        
        setResultUrl(hdResult);
        setProcessProgress(100);
      } catch (err) {
        console.error("Enhancement Error", err);
        alert("حدث خطأ أثناء معالجة الصورة. يرجى تجربة دقة أقل.");
      } finally {
        setIsProcessing(false);
        setTimeout(() => setProcessProgress(0), 1000);
      }
    }, 100);
  };

  const reset = () => {
    setSettings({
      scale: 2,
      sharpen: 0.5,
      contrast: 1.1,
      saturation: 1.1,
      brightness: 1.05,
      denoise: 0.2
    });
  };

  const presetAIEnhance = () => {
    setSettings({
      scale: 2,
      sharpen: 0.8,
      contrast: 1.15,
      saturation: 1.2,
      brightness: 1.08,
      denoise: 0.4
    });
  };
  
  const presetFaceRestore = () => {
    setSettings({
      scale: 2,
      sharpen: 0.3,
      contrast: 1.05,
      saturation: 1.1,
      brightness: 1.1,
      denoise: 0.6
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
            <Sparkles className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              رافع جودة الصور <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full tracking-widest">AI HD+</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">تحسين، إزالة التشويش، ورفع الدقة باحترافية</p>
          </div>
        </div>
        <button 
          onClick={onCancel}
          className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="lg:col-span-4 space-y-6">
          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-[2rem] border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/10 transition-all group"
            >
              <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                <Upload className="w-8 h-8 text-blue-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-white">اضغط لرفع صورة</p>
                <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, WEBP</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right duration-500">
              
              {/* Presets */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={presetAIEnhance}
                  className="py-3 rounded-2xl bg-blue-600 border border-blue-500/50 text-white hover:bg-blue-500 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-blue-500/20"
                >
                  <Zap className="w-4 h-4" />
                  تحسين ذكي 
                </button>
                <button 
                  onClick={presetFaceRestore}
                  className="py-3 rounded-2xl bg-fuchsia-600/20 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-600/30 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase"
                >
                  <Sparkles className="w-4 h-4" />
                  تنعيم وتصفية
                </button>
              </div>

              {/* Adjustments */}
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-6">
                
                {/* Resolution Scale */}
                <div className="space-y-3 pb-4 border-b border-white/10">
                  <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Maximize className="w-3 h-3 text-cyan-400" />
                    مضاعفة الدقة (Upscale)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 4].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSettings(p => ({ ...p, scale: s }))}
                        className={`py-2 rounded-xl border text-[11px] font-black transition-all ${
                          settings.scale === s 
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                            : 'bg-black/50 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-emerald-400" />توضيح التفاصيل (Sharpen)</span>
                      <span>{Math.round(settings.sharpen * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={settings.sharpen} 
                      onChange={(e) => setSettings(p => ({ ...p, sharpen: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-emerald-500" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1.5"><Droplets className="w-3 h-3 text-blue-400" />إزالة التشويش (Denoise)</span>
                      <span>{Math.round(settings.denoise * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={settings.denoise} 
                      onChange={(e) => setSettings(p => ({ ...p, denoise: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-blue-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1.5"><Contrast className="w-3 h-3 text-purple-400" />التباين (Contrast)</span>
                      <span>{Math.round((settings.contrast - 1) * 100)}%</span>
                    </div>
                    <input type="range" min="1" max="2" step="0.05" value={settings.contrast} 
                      onChange={(e) => setSettings(p => ({ ...p, contrast: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-purple-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1.5"><Palette className="w-3 h-3 text-pink-400" />تشبع الألوان (Saturation)</span>
                      <span>{Math.round((settings.saturation - 1) * 100)}%</span>
                    </div>
                    <input type="range" min="1" max="2" step="0.05" value={settings.saturation} 
                      onChange={(e) => setSettings(p => ({ ...p, saturation: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-pink-500" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1.5"><Sun className="w-3 h-3 text-amber-400" />الإضاءة (Brightness)</span>
                      <span>{Math.round((settings.brightness - 1) * 100)}%</span>
                    </div>
                    <input type="range" min="0.5" max="1.5" step="0.05" value={settings.brightness} 
                      onChange={(e) => setSettings(p => ({ ...p, brightness: parseFloat(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none accent-amber-500" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={reset}
                  className="py-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase"
                >
                  <RotateCcw className="w-4 h-4" />
                  إعادة تعيين
                </button>
                <button 
                  onClick={() => setImage(null)}
                  className="py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase"
                >
                  <X className="w-4 h-4" />
                  حذف الصورة
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview Area */}
        <div className="lg:col-span-8">
          <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-6 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-[500px]">
            {/* Checkerboard */}
            <div className="absolute inset-0 -z-10 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 0)', backgroundSize: '30px 30px' }} />
            
            {image ? (
              <>
                <div 
                  className="relative max-w-full max-h-[500px] flex items-center justify-center cursor-pointer group"
                  onMouseDown={() => setShowOriginal(true)}
                  onMouseUp={() => setShowOriginal(false)}
                  onMouseLeave={() => setShowOriginal(false)}
                  onTouchStart={() => setShowOriginal(true)}
                  onTouchEnd={() => setShowOriginal(false)}
                >
                  <img 
                    src={showOriginal ? image.src : (previewUrl || image.src)} 
                    alt="Preview" 
                    className="max-w-full max-h-[500px] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-opacity duration-200" 
                  />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-bold text-white flex items-center gap-2">
                    {showOriginal ? 'الصورة الأصلية' : 'الصورة المحسّنة (معاينة)'}
                  </div>
                  
                  {/* Hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-xs font-bold border border-white/20">
                      اضغط مطولاً للمقارنة
                    </span>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="mt-6 flex items-center gap-4 text-[10px] font-mono text-slate-400 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                  <p>الأصلية: {image.width}x{image.height}</p>
                  <div className="w-1 h-1 bg-slate-600 rounded-full" />
                  <p className="text-blue-400">الناتج: {image.width * settings.scale}x{image.height * settings.scale}</p>
                </div>
                
                {/* Export Button */}
                <div className="mt-8 flex gap-4 w-full max-w-md">
                  <button 
                    onClick={handleExport}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_10px_30px_rgba(37,99,235,0.3)] font-black text-sm uppercase tracking-widest disabled:opacity-50 relative overflow-hidden"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                        <span className="relative z-10">جاري المعالجة {processProgress}%...</span>
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-white/20 z-0 transition-all duration-300" 
                          style={{ width: `${processProgress}%` }} 
                        />
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        معالجة وتحميل HD
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-blue-500/20">
                  <Sparkles className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-slate-500 text-sm font-medium">ارفع صورة لبدء التحسين</p>
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 font-bold">
                  <Check className="w-3 h-3 text-emerald-500" /> يعتمد على معالجة محلية سريعة
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
