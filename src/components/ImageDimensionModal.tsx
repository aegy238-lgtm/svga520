import React, { useState, useEffect } from 'react';
import { 
  X, Check, Sparkles, Layers, Film, Maximize2, 
  Lock, Unlock, RefreshCw, Image as ImageIcon, ArrowRight 
} from 'lucide-react';

export interface ImageDimensionsResult {
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  mode: 'original' | 'custom' | 'preset';
  presetLabel?: string;
}

interface ImageDimensionModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (result: ImageDimensionsResult) => void;
}

const PRESET_SIZES = [
  { label: 'الأصلي (بدون تعديل)', width: 0, height: 0, isOriginal: true },
  { label: '512 × 512 (ملصق / استيكر)', width: 512, height: 512 },
  { label: '750 × 1334 (شاشة هاتف قياسية)', width: 750, height: 1334 },
  { label: '1080 × 1920 (ستوري وريلز HD)', width: 1080, height: 1920 },
  { label: '1080 × 1080 (منشور مربع)', width: 1080, height: 1080 },
  { label: '750 × 750 (مربع متوسط)', width: 750, height: 750 },
  { label: '1200 × 630 (بانر ويب وميديا)', width: 1200, height: 630 },
  { label: '300 × 300 (أيقونة / رمز)', width: 300, height: 300 },
];

export const ImageDimensionModal: React.FC<ImageDimensionModalProps> = ({
  isOpen,
  file,
  onClose,
  onConfirm
}) => {
  const [originalWidth, setOriginalWidth] = useState<number>(750);
  const [originalHeight, setOriginalHeight] = useState<number>(750);
  const [customWidth, setCustomWidth] = useState<number>(750);
  const [customHeight, setCustomHeight] = useState<number>(750);
  const [mode, setMode] = useState<'original' | 'custom' | 'preset'>('original');
  const [selectedPreset, setSelectedPreset] = useState<string>('original');
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Extract natural image dimensions
  useEffect(() => {
    if (!file) return;

    setIsLoading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      const w = img.naturalWidth || 750;
      const h = img.naturalHeight || 750;
      setOriginalWidth(w);
      setOriginalHeight(h);
      setCustomWidth(w);
      setCustomHeight(h);
      setMode('original');
      setSelectedPreset('original');
      setIsLoading(false);
    };
    img.onerror = () => {
      setOriginalWidth(750);
      setOriginalHeight(750);
      setCustomWidth(750);
      setCustomHeight(750);
      setIsLoading(false);
    };

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!isOpen || !file) return null;

  const aspectRatio = originalWidth && originalHeight ? originalWidth / originalHeight : 1;

  const handleWidthChange = (val: number) => {
    setCustomWidth(val);
    setMode('custom');
    setSelectedPreset('custom');
    if (lockAspectRatio && aspectRatio > 0) {
      setCustomHeight(Math.round(val / aspectRatio));
    }
  };

  const handleHeightChange = (val: number) => {
    setCustomHeight(val);
    setMode('custom');
    setSelectedPreset('custom');
    if (lockAspectRatio && aspectRatio > 0) {
      setCustomWidth(Math.round(val * aspectRatio));
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_SIZES[0]) => {
    if (preset.isOriginal) {
      setMode('original');
      setSelectedPreset('original');
      setCustomWidth(originalWidth);
      setCustomHeight(originalHeight);
    } else {
      setMode('preset');
      setSelectedPreset(`${preset.width}x${preset.height}`);
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
    }
  };

  const handleConfirmOriginal = () => {
    onConfirm({
      width: originalWidth,
      height: originalHeight,
      originalWidth,
      originalHeight,
      mode: 'original'
    });
  };

  const handleConfirmCurrent = () => {
    const finalW = mode === 'original' ? originalWidth : Math.max(16, customWidth);
    const finalH = mode === 'original' ? originalHeight : Math.max(16, customHeight);
    onConfirm({
      width: finalW,
      height: finalH,
      originalWidth,
      originalHeight,
      mode,
      presetLabel: selectedPreset
    });
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-[#0b101f] border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col my-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">تحديد مقاسات الصورة المستوردة</h3>
              <p className="text-xs text-slate-400 font-medium">اختر رفع الصورة بمقاساتها الأساسية أو تخصيص الأبعاد المطلوبة</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* File details banner & thumbnail */}
          <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            {previewUrl && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 flex items-center justify-center p-1 relative">
                <img 
                  src={previewUrl} 
                  alt={file.name} 
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 text-center sm:text-start">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="font-bold text-sm text-white truncate max-w-[280px]">{file.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-400">
                <span>المقاس الأساسي الأصلي للصورة:</span>
                <strong className="text-amber-300 font-mono font-bold dir-ltr">
                  {originalWidth} × {originalHeight} px
                </strong>
                <span className="text-slate-500">|</span>
                <span>النسبة:</span>
                <span className="font-mono text-slate-300">
                  {aspectRatio >= 1 ? `${aspectRatio.toFixed(2)} : 1` : `1 : ${(1 / (aspectRatio || 1)).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Option 1: Fast Keep Original Dimensions (المقاس الأساسي) */}
          <div 
            onClick={() => {
              setMode('original');
              setSelectedPreset('original');
              setCustomWidth(originalWidth);
              setCustomHeight(originalHeight);
            }}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              mode === 'original'
                ? 'bg-amber-500/10 border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                mode === 'original' ? 'border-amber-400 bg-amber-500' : 'border-slate-500'
              }`}>
                {mode === 'original' && <Check className="w-3 h-3 text-black stroke-[3]" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">الرفع بالمقاسات الأساسية للأصل (الأبعاد الأصلية 100%)</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    موصى به
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  فتح الصورة في استوديو التصميم بنفس أبعادها الطبيعية ({originalWidth} × {originalHeight} بكسل) بدقة متناهية وبدون أي قص أو تشويه.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmOriginal();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs transition-all shadow-md shrink-0 cursor-pointer"
            >
              استيراد فوري بالأصل
            </button>
          </div>

          {/* Option 2: Custom or Standard Preset Sizes */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-white">أو تحديد المقاس المطلوب (Custom & Presets)</span>
              </div>
              <button
                type="button"
                onClick={() => setLockAspectRatio(!lockAspectRatio)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                  lockAspectRatio 
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40' 
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
                title={lockAspectRatio ? 'قفل النسبة والتناسب مفعّل' : 'قفل النسبة والتناسب معطل'}
              >
                {lockAspectRatio ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{lockAspectRatio ? 'قفل النسبة' : 'نسبة حرة'}</span>
              </button>
            </div>

            {/* Manual Dimensions Input */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  العرض (Width) بالبكسل:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="16"
                    max="8000"
                    value={mode === 'original' ? originalWidth : customWidth}
                    onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">px</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الارتفاع (Height) بالبكسل:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="16"
                    max="8000"
                    value={mode === 'original' ? originalHeight : customHeight}
                    onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">px</span>
                </div>
              </div>
            </div>

            {/* Quick Presets Grid */}
            <div>
              <span className="block text-xs font-bold text-slate-400 mb-2">قوالب مقاسات سريعة وشائعة:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_SIZES.map((preset, idx) => {
                  const isCurrent = preset.isOriginal 
                    ? mode === 'original' 
                    : (customWidth === preset.width && customHeight === preset.height && mode !== 'original');

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-start cursor-pointer flex flex-col gap-0.5 ${
                        isCurrent
                          ? 'bg-indigo-600/25 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{preset.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono dir-ltr text-end">
                        {preset.isOriginal ? `${originalWidth}×${originalHeight}` : `${preset.width}×${preset.height}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-white/10 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmOriginal}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-white/10 transition-all cursor-pointer"
            >
              استيراد بالمقاس الأساسي ({originalWidth}×{originalHeight})
            </button>

            <button
              type="button"
              onClick={handleConfirmCurrent}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>تأكيد والمتابعة</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
