import React, { useState } from 'react';
import { 
  FadeConfig, 
  CropConfig, 
  CropFeather, 
  CropShape,
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
  ArrowRight,
  Square,
  Circle,
  RectangleHorizontal,
  Diamond,
  Film,
  Smartphone,
  Disc,
  Shapes
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

type PresetKey = 
  | 'cinematic' 
  | 'horizontal' 
  | 'vignette' 
  | 'softFrame'
  | 'squareBalanced'
  | 'squareSharp'
  | 'squareDeepFade'
  | 'squareRounded'
  | 'circleCenter'
  | 'circleDeepFocus'
  | 'ellipseFocus'
  | 'ellipseVertical'
  | 'roundedRect'
  | 'capsuleVertical'
  | 'capsuleHorizontal'
  | 'squircleCard'
  | 'diamondSoft'
  | 'cinematicWidescreen'
  | 'verticalStory';

export const SvgaTransparencyPanel: React.FC<SvgaTransparencyPanelProps> = ({
  fadeConfig,
  cropConfig,
  cropFeather,
  onUpdateFadeConfig,
  onUpdateCropConfig,
  onUpdateCropFeather,
  onResetTransparency
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'square' | 'circle' | 'rounded' | 'cinematic'>('all');
  const isActive = isTransparencyActive(fadeConfig, cropConfig);
  const currentShape: CropShape = cropConfig.shape || 'rect';

  const applyPreset = (preset: PresetKey) => {
    // 1. Original 4 presets (strictly preserved)
    if (preset === 'cinematic') {
      onUpdateFadeConfig({ top: 12, bottom: 15, left: 0, right: 0 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0, shape: 'rect' });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'horizontal') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 15, right: 15 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0, shape: 'rect' });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'vignette') {
      onUpdateFadeConfig({ top: 10, bottom: 10, left: 10, right: 10 });
      onUpdateCropConfig({ top: 0, bottom: 0, left: 0, right: 0, shape: 'rect' });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'softFrame') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 4, bottom: 4, left: 4, right: 4, shape: 'rect' });
      onUpdateCropFeather({ top: 8, bottom: 8, left: 8, right: 8 });
    }
    // 2. Square Shapes (الأشكال المربعة)
    else if (preset === 'squareBalanced') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 12, bottom: 12, left: 12, right: 12, shape: 'square' });
      onUpdateCropFeather({ top: 6, bottom: 6, left: 6, right: 6 });
    } else if (preset === 'squareSharp') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 10, bottom: 10, left: 10, right: 10, shape: 'square' });
      onUpdateCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
    } else if (preset === 'squareDeepFade') {
      onUpdateFadeConfig({ top: 8, bottom: 8, left: 8, right: 8 });
      onUpdateCropConfig({ top: 10, bottom: 10, left: 10, right: 10, shape: 'square' });
      onUpdateCropFeather({ top: 18, bottom: 18, left: 18, right: 18 });
    } else if (preset === 'squareRounded') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 10, bottom: 10, left: 10, right: 10, shape: 'rounded-rect', cornerRadius: 30 });
      onUpdateCropFeather({ top: 8, bottom: 8, left: 8, right: 8 });
    }
    // 3. Circular & Oval Shapes (الأشكال الدائرية والبيضاوية)
    else if (preset === 'circleCenter') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 8, bottom: 8, left: 8, right: 8, shape: 'circle' });
      onUpdateCropFeather({ top: 12, bottom: 12, left: 12, right: 12 });
    } else if (preset === 'circleDeepFocus') {
      onUpdateFadeConfig({ top: 10, bottom: 10, left: 10, right: 10 });
      onUpdateCropConfig({ top: 5, bottom: 5, left: 5, right: 5, shape: 'circle' });
      onUpdateCropFeather({ top: 25, bottom: 25, left: 25, right: 25 });
    } else if (preset === 'ellipseFocus') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 8, bottom: 8, left: 5, right: 5, shape: 'ellipse' });
      onUpdateCropFeather({ top: 14, bottom: 14, left: 14, right: 14 });
    } else if (preset === 'ellipseVertical') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 4, bottom: 4, left: 12, right: 12, shape: 'ellipse' });
      onUpdateCropFeather({ top: 12, bottom: 12, left: 12, right: 12 });
    }
    // 4. Rounded Rectangle & Capsule Shapes (الأشكال الدائرية المستطيلة والكبسولة)
    else if (preset === 'roundedRect') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 6, bottom: 6, left: 6, right: 6, shape: 'rounded-rect', cornerRadius: 25 });
      onUpdateCropFeather({ top: 8, bottom: 8, left: 8, right: 8 });
    } else if (preset === 'capsuleVertical') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 4, bottom: 4, left: 15, right: 15, shape: 'capsule' });
      onUpdateCropFeather({ top: 10, bottom: 10, left: 10, right: 10 });
    } else if (preset === 'capsuleHorizontal') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 18, bottom: 18, left: 5, right: 5, shape: 'capsule' });
      onUpdateCropFeather({ top: 10, bottom: 10, left: 10, right: 10 });
    } else if (preset === 'squircleCard') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 6, bottom: 6, left: 6, right: 6, shape: 'rounded-rect', cornerRadius: 45 });
      onUpdateCropFeather({ top: 12, bottom: 12, left: 12, right: 12 });
    }
    // 5. Additional Special & Cinematic Shapes (أشكال سينمائية ومميزة)
    else if (preset === 'diamondSoft') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 8, bottom: 8, left: 8, right: 8, shape: 'diamond' });
      onUpdateCropFeather({ top: 14, bottom: 14, left: 14, right: 14 });
    } else if (preset === 'cinematicWidescreen') {
      onUpdateFadeConfig({ top: 5, bottom: 5, left: 0, right: 0 });
      onUpdateCropConfig({ top: 22, bottom: 22, left: 0, right: 0, shape: 'rect' });
      onUpdateCropFeather({ top: 6, bottom: 6, left: 0, right: 0 });
    } else if (preset === 'verticalStory') {
      onUpdateFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
      onUpdateCropConfig({ top: 2, bottom: 2, left: 12, right: 12, shape: 'rounded-rect', cornerRadius: 20 });
      onUpdateCropFeather({ top: 6, bottom: 6, left: 6, right: 6 });
    }
  };

  const handleSelectShape = (shape: CropShape) => {
    onUpdateCropConfig({
      ...cropConfig,
      shape,
      // If turning on a shape for the first time without any crop, set default comfortable margins
      top: cropConfig.top === 0 && shape !== 'rect' ? 6 : cropConfig.top,
      bottom: cropConfig.bottom === 0 && shape !== 'rect' ? 6 : cropConfig.bottom,
      left: cropConfig.left === 0 && shape !== 'rect' ? 6 : cropConfig.left,
      right: cropConfig.right === 0 && shape !== 'rect' ? 6 : cropConfig.right,
    });
  };

  const presetsList = [
    // Originals
    { id: 'cinematic', label: 'تلاشي سينمائي عمودي', category: 'cinematic', icon: Film },
    { id: 'horizontal', label: 'تلاشي أفقي جانبي', category: 'cinematic', icon: Sliders },
    { id: 'vignette', label: 'إطار ناعم 4 اتجاهات', category: 'cinematic', icon: Sparkles },
    { id: 'softFrame', label: 'قص متدرج ناعم', category: 'cinematic', icon: Crop },
    
    // Square Shapes
    { id: 'squareBalanced', label: 'مربع متوازن 1:1', category: 'square', icon: Square },
    { id: 'squareRounded', label: 'مربع زوايا مستديرة', category: 'square', icon: Square },
    { id: 'squareDeepFade', label: 'مربع بتدرج عميق', category: 'square', icon: Square },
    { id: 'squareSharp', label: 'مربع كلاسيكي حاد', category: 'square', icon: Square },

    // Circular & Oval Shapes
    { id: 'circleCenter', label: 'دائرة مركزية ناعمة', category: 'circle', icon: Circle },
    { id: 'circleDeepFocus', label: 'بؤرة دائرية عميقة', category: 'circle', icon: Disc },
    { id: 'ellipseFocus', label: 'شكل بيضاوي أفقي', category: 'circle', icon: Circle },
    { id: 'ellipseVertical', label: 'شكل بيضاوي عمودي', category: 'circle', icon: Circle },

    // Rounded Rectangle & Capsule Shapes
    { id: 'roundedRect', label: 'مستطيل بحواف دائرية', category: 'rounded', icon: RectangleHorizontal },
    { id: 'capsuleVertical', label: 'كبسولة عمودية دائرية', category: 'rounded', icon: Smartphone },
    { id: 'capsuleHorizontal', label: 'كبسولة أفقية دائرية', category: 'rounded', icon: RectangleHorizontal },
    { id: 'squircleCard', label: 'بطاقة فائقة النعومة', category: 'rounded', icon: RectangleHorizontal },

    // Cinematic & Specials
    { id: 'diamondSoft', label: 'شكل ألماسي متدرج', category: 'cinematic', icon: Diamond },
    { id: 'cinematicWidescreen', label: 'شاشة سينمائية 16:9', category: 'cinematic', icon: Film },
    { id: 'verticalStory', label: 'إطار ستوري عمودي', category: 'cinematic', icon: Smartphone },
  ];

  const filteredPresets = selectedCategory === 'all' 
    ? presetsList 
    : presetsList.filter(p => p.category === selectedCategory);

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
          {currentShape !== 'rect' && (
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} />
              {currentShape === 'square' && 'شكل مربع'}
              {currentShape === 'circle' && 'شكل دائري'}
              {currentShape === 'ellipse' && 'شكل بيضاوي'}
              {currentShape === 'rounded-rect' && 'مستطيل دائري'}
              {currentShape === 'capsule' && 'شكل كبسولة'}
              {currentShape === 'diamond' && 'شكل ألماسي'}
            </span>
          )}
        </div>

        {/* Shape Selector Bar */}
        <div className="space-y-1.5 bg-black/25 p-2 rounded-xl border border-white/5">
          <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <Shapes size={11} className="text-emerald-400" />
            <span>نمط الشكل الهندسي (Geometric Shape):</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => handleSelectShape('rect')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'rect'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص مستطيل قياسي"
            >
              <RectangleHorizontal size={11} />
              <span>مستطيل</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('square')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'square'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص مربع متناسق 1:1"
            >
              <Square size={11} />
              <span>مربع</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('circle')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'circle'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص دائري بؤري ناعم"
            >
              <Circle size={11} />
              <span>دائري</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('ellipse')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'ellipse'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص بيضاوي متناسق"
            >
              <Disc size={11} />
              <span>بيضاوي</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('rounded-rect')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'rounded-rect'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="مستطيل بحواف دائرية قابلة للتحكم"
            >
              <RectangleHorizontal size={11} />
              <span>مستطيل دائري</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('capsule')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'capsule'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص على شكل كبسولة بيضاوية"
            >
              <Smartphone size={11} />
              <span>كبسولة</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectShape('diamond')}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                currentShape === 'diamond'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-transparent'
              }`}
              title="قص على شكل ألماسي / معين"
            >
              <Diamond size={11} />
              <span>ألماسي</span>
            </button>
          </div>

          {/* Corner Radius Slider (Shown when rounded-rect is active) */}
          {currentShape === 'rounded-rect' && (
            <div className="pt-1.5 border-t border-white/5 mt-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium">استدارة الزوايا (Corner Radius)</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {cropConfig.cornerRadius ?? 25}%
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={cropConfig.cornerRadius ?? 25}
                onChange={(e) => onUpdateCropConfig({ ...cropConfig, cornerRadius: parseInt(e.target.value) || 25 })}
                className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer mt-1"
              />
            </div>
          )}
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

      {/* Quick Presets and Reset Bar with Categories */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-400" /> 
            <span className="text-slate-200 font-bold">تأثيرات وأشكال جاهزة:</span>
            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono">
              {presetsList.length} شكل
            </span>
          </span>
          <button
            onClick={onResetTransparency}
            disabled={!isActive}
            className="text-slate-400 hover:text-red-400 disabled:opacity-40 flex items-center gap-1 transition-colors cursor-pointer"
            title="إعادة تعيين كافة قيم الشفافية والقص والنمط الهندسي"
          >
            <RotateCcw size={10} />
            <span>إعادة تعيين</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[9.5px]">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            الكل ({presetsList.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('square')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'square'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            أشكال مربعة ⬛
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('circle')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'circle'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            أشكال دائرية ⚪
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('rounded')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'rounded'
                ? 'bg-fuchsia-500 text-slate-950 font-bold shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            أشكال دائرية مستطيلة 🔲
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('cinematic')}
            className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'cinematic'
                ? 'bg-indigo-500 text-white font-bold shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            سينمائي وتلاشي 🎬
          </button>
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
          {filteredPresets.map((preset) => {
            const IconComponent = preset.icon;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id as PresetKey)}
                className="py-1.5 px-2 bg-white/5 hover:bg-cyan-900/30 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/30 rounded-xl text-[10px] font-medium transition-all text-right flex items-center justify-between gap-1.5 cursor-pointer group"
                title={preset.label}
              >
                <span className="truncate">{preset.label}</span>
                <IconComponent size={11} className="text-slate-400 group-hover:text-cyan-400 shrink-0" />
              </button>
            );
          })}
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
