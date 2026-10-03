import React, { useState } from 'react';
import { 
  Pipette, Check, X, RotateCcw, Sliders, Shield, Sparkles, 
  Layers, Film, Eye, Trash2, Plus, Info, Zap, Brush, Lasso, Square, Circle,
  Eraser, Scissors, Wand2, Paintbrush
} from 'lucide-react';
import { ChromaTargetColor, SmartChromaOptions, identifyColorType, PenMaskStroke } from './svgaSmartChromaEngine';

export type ChromaPenSubMode = 'picker' | 'pen-mask' | 'mask-draw';
export type PenMaskToolType = 'brush' | 'lasso' | 'rect' | 'circle';

interface SvgaChromaPenStudioProps {
  isActive: boolean;
  activeColor: ChromaTargetColor | null;
  targetColors: ChromaTargetColor[];
  onAddTargetColor: (color: ChromaTargetColor) => void;
  onRemoveTargetColor: (index: number) => void;
  onClearTargetColors: () => void;
  tolerance: number;
  onToleranceChange: (val: number) => void;
  smoothness: number;
  onSmoothnessChange: (val: number) => void;
  despill: number;
  onDespillChange: (val: number) => void;
  scope: 'all' | 'selected' | 'current';
  onScopeChange: (scope: 'all' | 'selected' | 'current') => void;
  onApplyChroma: () => Promise<void>;
  onUndoChroma?: () => void;
  canUndo?: boolean;
  isProcessing: boolean;
  processingProgress: number;
  processingStatus: string;
  onClose: () => void;

  // New Freehand Pen & Shading Transparency Mask Props
  subMode?: ChromaPenSubMode;
  onSubModeChange?: (mode: ChromaPenSubMode) => void;
  penTool?: PenMaskToolType;
  onPenToolChange?: (tool: PenMaskToolType) => void;
  maskMode?: 'erase' | 'keep';
  onMaskModeChange?: (mode: 'erase' | 'keep') => void;
  brushSize?: number;
  onBrushSizeChange?: (size: number) => void;
  penFeather?: number;
  onPenFeatherChange?: (feather: number) => void;
  penOpacity?: number;
  onPenOpacityChange?: (opacity: number) => void;
  pendingStrokesCount?: number;
  onApplyPenMask?: () => Promise<void>;
  onClearStrokes?: () => void;
}

export const SvgaChromaPenStudio: React.FC<SvgaChromaPenStudioProps> = ({
  isActive,
  activeColor,
  targetColors,
  onAddTargetColor,
  onRemoveTargetColor,
  onClearTargetColors,
  tolerance,
  onToleranceChange,
  smoothness,
  onSmoothnessChange,
  despill,
  onDespillChange,
  scope,
  onScopeChange,
  onApplyChroma,
  onUndoChroma,
  canUndo = false,
  isProcessing,
  processingProgress,
  processingStatus,
  onClose,
  subMode: propSubMode,
  onSubModeChange,
  penTool: propPenTool,
  onPenToolChange,
  maskMode: propMaskMode,
  onMaskModeChange,
  brushSize: propBrushSize,
  onBrushSizeChange,
  penFeather: propPenFeather,
  onPenFeatherChange,
  penOpacity: propPenOpacity,
  onPenOpacityChange,
  pendingStrokesCount = 0,
  onApplyPenMask,
  onClearStrokes
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [internalSubMode, setInternalSubMode] = useState<ChromaPenSubMode>(propSubMode || 'pen-mask');
  const [internalPenTool, setInternalPenTool] = useState<PenMaskToolType>(propPenTool || 'brush');
  const [internalMaskMode, setInternalMaskMode] = useState<'erase' | 'keep'>(propMaskMode || 'erase');
  const [internalBrushSize, setInternalBrushSize] = useState<number>(propBrushSize || 30);
  const [internalPenFeather, setInternalPenFeather] = useState<number>(propPenFeather || 8);
  const [internalPenOpacity, setInternalPenOpacity] = useState<number>(propPenOpacity || 100);

  // Sync with prop when prop changes
  React.useEffect(() => {
    if (propSubMode) setInternalSubMode(propSubMode);
  }, [propSubMode]);

  const activeSubMode = propSubMode || internalSubMode;
  const isPenMaskActive = activeSubMode === 'pen-mask' || activeSubMode === 'mask-draw';
  const activePenTool = propPenTool || internalPenTool;
  const activeMaskMode = propMaskMode || internalMaskMode;
  const activeBrushSize = propBrushSize ?? internalBrushSize;
  const activePenFeather = propPenFeather ?? internalPenFeather;
  const activePenOpacity = propPenOpacity ?? internalPenOpacity;

  const handleSwitchSubMode = (mode: ChromaPenSubMode) => {
    setInternalSubMode(mode);
    onSubModeChange?.(mode);
  };

  const handleSwitchPenTool = (tool: PenMaskToolType) => {
    setInternalPenTool(tool);
    onPenToolChange?.(tool);
  };

  const handleSwitchMaskMode = (mode: 'erase' | 'keep') => {
    setInternalMaskMode(mode);
    onMaskModeChange?.(mode);
  };

  const handleChangeBrushSize = (val: number) => {
    setInternalBrushSize(val);
    onBrushSizeChange?.(val);
  };

  const handleChangePenFeather = (val: number) => {
    setInternalPenFeather(val);
    onPenFeatherChange?.(val);
  };

  const handleChangePenOpacity = (val: number) => {
    setInternalPenOpacity(val);
    onPenOpacityChange?.(val);
  };

  if (!isActive) return null;

  return (
    <div 
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-slate-950/95 backdrop-blur-2xl border border-emerald-500/40 rounded-3xl shadow-2xl shadow-emerald-950/60 p-4 text-white text-right animate-in fade-in slide-in-from-bottom-5 duration-200 ring-1 ring-emerald-400/20"
      dir="rtl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar with Mode Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white animate-pulse shrink-0">
            {!isPenMaskActive ? <Pipette size={18} /> : <Paintbrush size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-wide">
                {!isPenMaskActive ? 'قلم إزالة الكروما بالألوان' : 'قلم التظليل والتحديد الحر للشفافية'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                وضع نشط ⚡
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {!isPenMaskActive
                ? 'انقر على أي لون في الكانفاس لحذفه فورياً'
                : 'ارسم وظلل المنطقة بالماوس/القلم لتفريغ الشفافية بدقة متناهية'}
            </p>
          </div>
        </div>

        {/* Sub-mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl border border-white/15">
          <button
            type="button"
            onClick={() => handleSwitchSubMode('picker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !isPenMaskActive
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Pipette size={14} />
            <span>سحب الكروما</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchSubMode('pen-mask')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isPenMaskActive
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush size={14} />
            <span>قلم التظليل والتفريغ ✏️</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all"
            title={isExpanded ? 'تصغير اللوحة' : 'توسيع الإعدادات'}
          >
            <Sliders size={15} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-white text-xs transition-all cursor-pointer"
            title="إغلاق القلم"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* MODE 1: COLOR PICKER MODE */}
      {!isPenMaskActive && (
        <>
          {/* Target Color Swatches & Status */}
          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-300">اللون المستهدف:</span>
              {targetColors.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold animate-pulse">
                  <Pipette size={14} className="text-amber-400" />
                  <span>انقر بالماوس على أي لون داخل الكانفاس لتحديده</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {targetColors.map((col, idx) => {
                    const info = identifyColorType(col.r, col.g, col.b);
                    return (
                      <div 
                        key={idx}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/15 shadow-sm"
                      >
                        <span 
                          className="w-4 h-4 rounded-full border border-white/40 shadow-inner"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span className="font-mono text-xs text-white font-bold">{col.hex}</span>
                        <span className="text-[10px] text-emerald-300 font-medium hidden sm:inline">
                          ({info.label.split(' ')[0]})
                        </span>
                        <button
                          onClick={() => onRemoveTargetColor(idx)}
                          className="p-0.5 hover:bg-white/20 rounded-md text-slate-400 hover:text-rose-400 transition-colors"
                          title="حذف هذا اللون"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                  {targetColors.length > 0 && (
                    <button
                      onClick={onClearTargetColors}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-[10px] font-bold transition-colors"
                      title="مسح كافة العينات"
                    >
                      مسح الكل
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Live Hovered Color Badge */}
            {activeColor && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs">
                <span className="text-slate-400 text-[11px]">تحت القلم الآن:</span>
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-white/40"
                  style={{ backgroundColor: activeColor.hex }}
                />
                <span className="font-mono text-emerald-300 font-bold text-[11px]">{activeColor.hex}</span>
              </div>
            )}
          </div>

          {/* Sliders & Scope Settings */}
          {isExpanded && (
            <div className="pt-2 pb-3 border-t border-white/10 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">حساسية التحديد (Tolerance):</span>
                    <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                      {tolerance}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={100}
                    value={tolerance}
                    onChange={(e) => onToleranceChange(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>تحديد دقيق</span>
                    <span>تحديد واسع</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">تنعيم الحواف (Smoothness):</span>
                    <span className="font-mono font-black text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                      {smoothness}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={smoothness}
                    onChange={(e) => onSmoothnessChange(Number(e.target.value))}
                    className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>حافة حادة</span>
                    <span>تدرج ناعم</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">كبح بقايا اللون (Despill):</span>
                    <span className="font-mono font-black text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                      {despill}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={despill}
                    onChange={(e) => onDespillChange(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>بدون كبح</span>
                    <span>تنظيف كامل للحواف</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODE 2: FREEHAND PEN & BRUSH TRANSPARENCY MASK */}
      {isPenMaskActive && (
        <div className="py-2.5 space-y-3">
          {/* Tool Shape & Mask Action Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Drawing Tool */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => handleSwitchPenTool('brush')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePenTool === 'brush' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="فرشاة تظليل حرة"
              >
                <Brush size={14} />
                <span>فرشاة تظليل</span>
              </button>
              <button
                onClick={() => handleSwitchPenTool('lasso')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePenTool === 'lasso' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="حبل تحديد مضلع حر"
              >
                <Lasso size={14} />
                <span>لاسو حر</span>
              </button>
              <button
                onClick={() => handleSwitchPenTool('rect')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePenTool === 'rect' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="تظليل مستطيل"
              >
                <Square size={13} />
                <span>مستطيل</span>
              </button>
              <button
                onClick={() => handleSwitchPenTool('circle')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePenTool === 'circle' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="تظليل دائري"
              >
                <Circle size={13} />
                <span>دائري</span>
              </button>
            </div>

            {/* Mask Mode: Erase vs Keep */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-white/10">
              <button
                onClick={() => handleSwitchMaskMode('erase')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMaskMode === 'erase' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eraser size={14} />
                <span>تفريغ المنطقة (شفافة)</span>
              </button>
              <button
                onClick={() => handleSwitchMaskMode('keep')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMaskMode === 'keep' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scissors size={14} />
                <span>عزل وإبقاء المنطقة</span>
              </button>
            </div>
          </div>

          {/* Sliders Grid for Brush Size, Feather, Opacity */}
          {isExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">حجم القلم (Brush Size):</span>
                  <span className="font-mono font-black text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                    {activeBrushSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={120}
                  value={activeBrushSize}
                  onChange={(e) => handleChangeBrushSize(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">تدرج الحواف (Feather):</span>
                  <span className="font-mono font-black text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                    {activePenFeather}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={activePenFeather}
                  onChange={(e) => handleChangePenFeather(Number(e.target.value))}
                  className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">نسبة التظليل (Opacity):</span>
                  <span className="font-mono font-black text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded-md text-[11px]">
                    {activePenOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={activePenOpacity}
                  onChange={(e) => handleChangePenOpacity(Number(e.target.value))}
                  className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scope Selector */}
      {isExpanded && (
        <div className="flex items-center justify-between pt-2 border-t border-white/10 flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-300">نطاق تطبيق الشفافية:</span>
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => onScopeChange('all')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                scope === 'all'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film size={12} />
              <span>كافة إطارات الفيديو (المشروع)</span>
            </button>
            <button
              onClick={() => onScopeChange('selected')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                scope === 'selected'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={12} />
              <span>الطبقة المحددة فقط</span>
            </button>
            <button
              onClick={() => onScopeChange('current')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                scope === 'current'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye size={12} />
              <span>الإطار الحالي فقط</span>
            </button>
          </div>
        </div>
      )}

      {/* Processing Progress Bar */}
      {isProcessing && (
        <div className="py-2 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>{processingStatus || 'جاري معالجة وتطبيق الشفافية...'}</span>
            <span>{processingProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-150 rounded-full"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Actions Bar */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {canUndo && onUndoChroma && (
            <button
              onClick={onUndoChroma}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="تراجع عن التعديل واسترجاع الإطارات السابقة"
            >
              <RotateCcw size={13} />
              <span>تراجع (Undo)</span>
            </button>
          )}

          {isPenMaskActive && pendingStrokesCount > 0 && onClearStrokes && (
            <button
              onClick={onClearStrokes}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 size={13} />
              <span>مسح التحديد ({pendingStrokesCount})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء / خروج
          </button>

          {!isPenMaskActive ? (
            <button
              onClick={onApplyChroma}
              disabled={targetColors.length === 0 || isProcessing}
              className="flex items-center gap-2 px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-black transition-all shadow-lg shadow-emerald-500/30 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap size={14} className={isProcessing ? 'animate-spin' : ''} />
              <span>{isProcessing ? 'جاري الحذف الذكي...' : '⚡ تطبيق وحذف اللون واحترافية النتيجة'}</span>
            </button>
          ) : (
            <button
              onClick={onApplyPenMask}
              disabled={pendingStrokesCount === 0 || isProcessing}
              className="flex items-center gap-2 px-5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white text-xs font-black transition-all shadow-lg shadow-teal-500/30 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              <span>{isProcessing ? 'جاري تطبيق الشفافية...' : `✨ تطبيق تظليل الشفافية (${pendingStrokesCount} تحديد)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

