import React from 'react';
import { 
  FadeConfig, 
  CropConfig, 
  CropFeather, 
  DEFAULT_FADE_CONFIG, 
  DEFAULT_CROP_CONFIG, 
  DEFAULT_CROP_FEATHER,
  isTransparencyActive
} from './transparencyEngine';
import { 
  Sliders, 
  Crop, 
  RotateCcw, 
  Sparkles, 
  Eye, 
  Check, 
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface SvgaTransparencyPanelProps {
  fadeConfig: FadeConfig;
  cropConfig: CropConfig;
  cropFeather: CropFeather;
  onUpdateFadeConfig: (config: FadeConfig) => void;
  onUpdateCropConfig: (config: CropConfig) => void;
  onUpdateCropFeather: (feather: CropFeather) => void;
  onResetTransparency: () => void;
}

export const SvgaTransparencyPanel: React.FC<SvgaTransparencyPanelProps> = ({
  fadeConfig,
  cropConfig,
  cropFeather,
  onUpdateFadeConfig,
  onUpdateCropConfig,
  onUpdateCropFeather,
  onResetTransparency
}) => {
  const isActive = isTransparencyActive(fadeConfig, cropConfig);

  const applyPreset = (preset: 'cinematic' | 'horizontal' | 'vignette' | 'softFrame') => {
    if (preset === 'cinematic') {
      onUpdateFadeConfig({ top: 12, bottom: 15, left: 0, right: 0 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'horizontal') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 15, right: 15 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'vignette') {
      onUpdateFadeConfig({ top: 10, bottom: 10, left: 10, right: 10 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'softFrame') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 4, bottom: 4, left: 4, right: 4 });
      onUpdateCropFeather({ top: 8, bottom: 8, left: 8, right: 8 });
    }
  };

  return (
    <div className="space-y-3.5 select-none" dir="rtl">
      {/* 1. تدرج الشفافية (EDGE FADE) */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders size={13} />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">
              تدرج الشفافية (EDGE FADE)
            </span>
          </div>
          {isActive && (
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              مُفعل
            </span>
          )}
        </div>

        {/* 4 Direction Sliders for Edge Fade */}
        <div className="grid grid-cols-2 gap-3">
          {/* Top */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowUp size={11} className="text-cyan-400" /> أعلى (TOP)
              </span>
              <span className="text-cyan-400 font-mono font-bold text-[11px]">
                {fadeConfig.top}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeConfig.top}
              onChange={(e) => onUpdateFadeConfig({ ...fadeConfig, top: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
          </div>

          {/* Bottom */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowDown size={11} className="text-cyan-400" /> أسفل (BOTTOM)
              </span>
              <span className="text-cyan-400 font-mono font-bold text-[11px]">
                {fadeConfig.bottom}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeConfig.bottom}
              onChange={(e) => onUpdateFadeConfig({ ...fadeConfig, bottom: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
          </div>

          {/* Left */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowRight size={11} className="text-cyan-400" /> يسار (LEFT)
              </span>
              <span className="text-cyan-400 font-mono font-bold text-[11px]">
                {fadeConfig.left}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeConfig.left}
              onChange={(e) => onUpdateFadeConfig({ ...fadeConfig, left: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
          </div>

          {/* Right */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowLeft size={11} className="text-cyan-400" /> يمين (RIGHT)
              </span>
              <span className="text-cyan-400 font-mono font-bold text-[11px]">
                {fadeConfig.right}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={fadeConfig.right}
              onChange={(e) => onUpdateFadeConfig({ ...fadeConfig, right: parseInt(e.target.value) || 0 })}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer transition-all"
            />
          </div>
        </div>
      </div>

      {/* 2. قص الحواف المتقدم (ADVANCED EDGE CROP) */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Crop size={13} />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">
              قص الحواف المتقدم (ADVANCED EDGE CROP)
            </span>
          </div>
        </div>

        {/* 4 Direction Cards for Crop & Feather */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Top */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="text-[11px] font-bold text-slate-200 border-b border-white/5 pb-1 flex items-center gap-1">
              <ArrowUp size={11} className="text-emerald-400" /> أعلى (TOP)
            </div>
            {/* Crop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">القص (Crop)</span>
                <span className="text-emerald-400 font-mono font-bold">{cropConfig.top}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropConfig.top}
                onChange={(e) => onUpdateCropConfig({ ...cropConfig, top: parseInt(e.target.value) || 0 })}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            {/* Feather */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">النعومة (Feather)</span>
                <span className="text-fuchsia-400 font-mono font-bold">{cropFeather.top}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropFeather.top}
                onChange={(e) => onUpdateCropFeather({ ...cropFeather, top: parseInt(e.target.value) || 0 })}
                className="w-full accent-fuchsia-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Card 2: Bottom */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="text-[11px] font-bold text-slate-200 border-b border-white/5 pb-1 flex items-center gap-1">
              <ArrowDown size={11} className="text-emerald-400" /> أسفل (BOTTOM)
            </div>
            {/* Crop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">القص (Crop)</span>
                <span className="text-emerald-400 font-mono font-bold">{cropConfig.bottom}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropConfig.bottom}
                onChange={(e) => onUpdateCropConfig({ ...cropConfig, bottom: parseInt(e.target.value) || 0 })}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            {/* Feather */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">النعومة (Feather)</span>
                <span className="text-fuchsia-400 font-mono font-bold">{cropFeather.bottom}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropFeather.bottom}
                onChange={(e) => onUpdateCropFeather({ ...cropFeather, bottom: parseInt(e.target.value) || 0 })}
                className="w-full accent-fuchsia-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Card 3: Left */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="text-[11px] font-bold text-slate-200 border-b border-white/5 pb-1 flex items-center gap-1">
              <ArrowRight size={11} className="text-emerald-400" /> يسار (LEFT)
            </div>
            {/* Crop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">القص (Crop)</span>
                <span className="text-emerald-400 font-mono font-bold">{cropConfig.left}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropConfig.left}
                onChange={(e) => onUpdateCropConfig({ ...cropConfig, left: parseInt(e.target.value) || 0 })}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            {/* Feather */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">النعومة (Feather)</span>
                <span className="text-fuchsia-400 font-mono font-bold">{cropFeather.left}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropFeather.left}
                onChange={(e) => onUpdateCropFeather({ ...cropFeather, left: parseInt(e.target.value) || 0 })}
                className="w-full accent-fuchsia-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Card 4: Right */}
          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-2">
            <div className="text-[11px] font-bold text-slate-200 border-b border-white/5 pb-1 flex items-center gap-1">
              <ArrowLeft size={11} className="text-emerald-400" /> يمين (RIGHT)
            </div>
            {/* Crop */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">القص (Crop)</span>
                <span className="text-emerald-400 font-mono font-bold">{cropConfig.right}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropConfig.right}
                onChange={(e) => onUpdateCropConfig({ ...cropConfig, right: parseInt(e.target.value) || 0 })}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            {/* Feather */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">النعومة (Feather)</span>
                <span className="text-fuchsia-400 font-mono font-bold">{cropFeather.right}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={cropFeather.right}
                onChange={(e) => onUpdateCropFeather({ ...cropFeather, right: parseInt(e.target.value) || 0 })}
                className="w-full accent-fuchsia-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Presets and Reset Bar */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles size={11} className="text-amber-400" /> تأثيرات جاهزة:
          </span>
          <button
            onClick={onResetTransparency}
            disabled={!isActive}
            className="text-slate-400 hover:text-red-400 disabled:opacity-40 flex items-center gap-1 transition-colors cursor-pointer"
            title="إعادة تعيين كافة قيم الشفافية والقص"
          >
            <RotateCcw size={10} />
            <span>إعادة تعيين</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => applyPreset('cinematic')}
            className="py-1 px-2 bg-white/5 hover:bg-cyan-900/30 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 rounded-xl text-[10px] font-medium transition-all text-center cursor-pointer"
          >
            تلاشي سينمائي عمودي
          </button>
          <button
            onClick={() => applyPreset('horizontal')}
            className="py-1 px-2 bg-white/5 hover:bg-cyan-900/30 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 rounded-xl text-[10px] font-medium transition-all text-center cursor-pointer"
          >
            تلاشي أفقي جانبي
          </button>
          <button
            onClick={() => applyPreset('vignette')}
            className="py-1 px-2 bg-white/5 hover:bg-cyan-900/30 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 rounded-xl text-[10px] font-medium transition-all text-center cursor-pointer"
          >
            إطار ناعم 4 اتجاهات
          </button>
          <button
            onClick={() => applyPreset('softFrame')}
            className="py-1 px-2 bg-white/5 hover:bg-emerald-900/30 text-slate-300 hover:text-emerald-300 border border-white/5 hover:border-emerald-500/30 rounded-xl text-[10px] font-medium transition-all text-center cursor-pointer"
          >
            قص متدرج ناعم
          </button>
        </div>
      </div>

      {/* Background Immunity & Live Gift Note */}
      <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-2.5 text-[11px] text-indigo-200/90 flex items-start gap-2">
        <span className="text-sm">🛡️</span>
        <div className="leading-relaxed">
          <span className="font-bold text-indigo-300">معاينة واقعية للهدية:</span>
          <span className="text-slate-300"> عند رفع صورة خلفية من الشريط العلوي، تظل الصورة كاملة وثابتة دون قص، ويتم تطبيق التدرج والقص على طبقات الهدية فقط.</span>
        </div>
      </div>
    </div>
  );
};
