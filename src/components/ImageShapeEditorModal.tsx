import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Check, 
  Circle, 
  Square, 
  Sparkles, 
  Sliders, 
  Layers, 
  RotateCcw, 
  Eye, 
  Download, 
  Maximize2,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';
import { Language } from '../types';

export interface ImageShapeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  lang: Language;
  onApply: (processedDataUrl: string) => void;
}

export type ImageShape = 'circle' | 'rounded' | 'square';

export const ImageShapeEditorModal: React.FC<ImageShapeEditorModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  lang,
  onApply
}) => {
  const [shape, setShape] = useState<ImageShape>('circle');
  const [cornerRadius, setCornerRadius] = useState<number>(24); // in px or %
  const [feather, setFeather] = useState<number>(0); // 0 to 50px soft edge fade
  const [zoom, setZoom] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [previewBg, setPreviewBg] = useState<'dark' | 'checker' | 'black' | 'white'>('dark');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Load Image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Re-render canvas on changes
  useEffect(() => {
    if (imageObjRef.current) {
      renderCanvas();
    }
  }, [shape, cornerRadius, feather, zoom, offsetX, offsetY, previewBg]);

  const renderCanvas = (targetCanvas?: HTMLCanvasElement, exportSize = 512): string => {
    const canvas = targetCanvas || canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return '';

    const size = exportSize;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, size, size);

    // Save state for clipping
    ctx.save();

    // 1. Define clipping shape
    ctx.beginPath();
    if (shape === 'circle') {
      const radius = size / 2;
      ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      const r = (cornerRadius / 100) * (size / 2);
      ctx.roundRect(0, 0, size, size, Math.max(4, r));
    } else {
      ctx.rect(0, 0, size, size);
    }
    ctx.closePath();
    ctx.clip();

    // 2. Draw Image with zoom and pan
    const imgAspect = img.width / img.height;
    let drawW = size * zoom;
    let drawH = size * zoom;
    if (imgAspect > 1) {
      drawW = size * imgAspect * zoom;
    } else {
      drawH = (size / imgAspect) * zoom;
    }

    const drawX = (size - drawW) / 2 + offsetX;
    const drawY = (size - drawH) / 2 + offsetY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // 3. Apply Edge Feather / Soft Fade Transparency
    if (feather > 0) {
      ctx.globalCompositeOperation = 'destination-in';
      const featherGrad = ctx.createRadialGradient(
        size / 2,
        size / 2,
        Math.max(0, size / 2 - (feather * size) / 100),
        size / 2,
        size / 2,
        size / 2
      );
      featherGrad.addColorStop(0, 'rgba(0,0,0,1)');
      featherGrad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
      featherGrad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = featherGrad;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.restore();

    return canvas.toDataURL('image/png');
  };

  const handleApply = () => {
    setIsProcessing(true);
    try {
      const offscreen = document.createElement('canvas');
      const finalDataUrl = renderCanvas(offscreen, 600);
      if (finalDataUrl) {
        onApply(finalDataUrl);
        onClose();
      }
    } catch (e) {
      console.error('Error generating processed image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - offsetX, y: e.clientY - offsetY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setOffsetX(e.clientX - dragStartRef.current.x);
    setOffsetY(e.clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl rounded-3xl bg-[#0f131d] border border-slate-700 shadow-2xl p-5 sm:p-7 overflow-hidden text-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'تشكيل وتعديل صورة الغلاف (قص دائري / حواف ناعمة)' : 'Image Shape & Edge Editor'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' ? 'اختر الشكل (دائري / حواف دائرية / مربع) وتحكم في شفافية وتلاشي الحواف بدقة' : 'Crop into circle, rounded corners, or square with soft feathered edges'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          {/* Canvas Live Preview */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div 
              className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-dashed border-cyan-500/40 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing shadow-2xl select-none ${
                previewBg === 'checker' ? 'bg-[linear-gradient(45deg,#1e2433_25%,transparent_25%),linear-gradient(-45deg,#1e2433_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e2433_75%),linear-gradient(-45deg,transparent_75%,#1e2433_75%)] bg-[size:16px_16px] bg-[#0c1017]' :
                previewBg === 'black' ? 'bg-black' :
                previewBg === 'white' ? 'bg-white' : 'bg-[#090c12]'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain pointer-events-none drop-shadow-2xl"
              />

              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] text-slate-300 pointer-events-none flex items-center gap-1">
                <Move className="w-3 h-3 text-cyan-400" />
                <span>{lang === 'ar' ? 'اسحب للتحريك' : 'Drag to reposition'}</span>
              </div>
            </div>

            {/* Preview Backdrop Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-1.5">{lang === 'ar' ? 'الخلفية:' : 'BG:'}</span>
              {(['dark', 'checker', 'black', 'white'] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setPreviewBg(bg)}
                  className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                    previewBg === bg
                      ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {bg === 'dark' ? (lang === 'ar' ? 'داكن' : 'Dark') :
                   bg === 'checker' ? (lang === 'ar' ? 'شفاف' : 'Checker') :
                   bg === 'black' ? (lang === 'ar' ? 'أسود' : 'Black') :
                   (lang === 'ar' ? 'أبيض' : 'White')}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            {/* 1. Shape Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-2">
                {lang === 'ar' ? '1. اختر شكل الصورة المطلوب:' : '1. Select Shape:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShape('circle')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                    shape === 'circle'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Circle className="w-5 h-5 text-cyan-400" />
                  <span>{lang === 'ar' ? 'دائري (Circle)' : 'Circle'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShape('rounded')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                    shape === 'rounded'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="w-5 h-5 rounded-md border-2 border-cyan-400" />
                  <span>{lang === 'ar' ? 'حواف دائرية' : 'Rounded'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShape('square')}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                    shape === 'square'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Square className="w-5 h-5 text-cyan-400" />
                  <span>{lang === 'ar' ? 'مربع أصلي' : 'Square'}</span>
                </button>
              </div>
            </div>

            {/* Corner Radius Slider (If Rounded) */}
            {shape === 'rounded' && (
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>{lang === 'ar' ? 'درجة استدارة الحواف:' : 'Corner Radius:'}</span>
                  <span className="font-mono text-cyan-400">{cornerRadius}%</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="50"
                  value={cornerRadius}
                  onChange={(e) => setCornerRadius(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            )}

            {/* 2. Edge Feather & Transparency (شفافية وتلاشي الحواف) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1 text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'شفافية وتلاشي الحواف (Feather Edge):' : 'Edge Feather & Fade:'}</span>
                </span>
                <span className="font-mono text-emerald-400">{feather}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="45"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <p className="text-[10px] text-slate-400">
                {lang === 'ar'
                  ? 'يمنح أطراف الصورة تدرجاً شفافاً ناعماً يمتزج بشكل جذاب داخل المتجر'
                  : 'Softens and blends outer edges smoothly with background'}
              </p>
            </div>

            {/* 3. Zoom & Pan Controls */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>{lang === 'ar' ? 'تكبير وتصغير (Zoom):' : 'Zoom:'}</span>
                <span className="font-mono text-cyan-400">{zoom.toFixed(1)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setShape('circle');
                setCornerRadius(24);
                setFeather(0);
                setZoom(1);
                setOffsetX(0);
                setOffsetY(0);
              }}
              className="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إعادة ضبط الأبعاد' : 'Reset Controls'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={isProcessing}
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>{lang === 'ar' ? 'تطبيق وحفظ الصورة في المتجر' : 'Apply & Save Image'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
