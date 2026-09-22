import React, { useState } from 'react';
import { ShineEffectConfig, ShineApplyScope, ShineStyle, ShineDirection, ShineVectorPoint } from './types';
import { 
  Sparkles, RotateCcw, Sliders, Check, Compass, 
  ArrowRightLeft, Layers, CheckSquare, Zap, Eye,
  Activity, Move, ChevronRight, Crosshair, Target, Download
} from 'lucide-react';

interface SvgaShinePanelProps {
  layerName: string;
  shineConfig?: ShineEffectConfig;
  onUpdateShineConfig: (config: Partial<ShineEffectConfig>, targetScope?: ShineApplyScope) => void;
  onResetShine?: () => void;
  selectedLayersCount?: number;
  totalLayersCount?: number;
  onApplyToAll?: (config: ShineEffectConfig) => void;
  onApplyToSelected?: (config: ShineEffectConfig) => void;
  onRemoveFromAll?: () => void;
  projectWidth?: number;
  projectHeight?: number;
  layerBounds?: { x: number; y: number; width: number; height: number };
  onCreateShineLayer?: () => void;
  onExportShineLayerOnly?: () => void;
  isSeparateLayer?: boolean;
  shinePointStep?: 'idle' | 'place-start' | 'place-end';
  onStartPickPoints?: () => void;
  onCancelPickPoints?: () => void;
}

const COLOR_PRESETS = [
  { name: 'أبيض', value: '255, 255, 255', hex: '#ffffff' },
  { name: 'ذهبي', value: '255, 215, 0', hex: '#ffd700' },
  { name: 'أزرق', value: '56, 189, 248', hex: '#38bdf8' },
  { name: 'وردي', value: '244, 114, 182', hex: '#f472b6' },
  { name: 'أخضر', value: '52, 211, 153', hex: '#34d399' },
  { name: 'بنفسجي', value: '192, 132, 252', hex: '#c084fc' }
];

const SHINE_STYLES: Array<{ id: ShineStyle; label: string; desc: string; icon: string }> = [
  { id: 'soft', label: 'شريط مفرد', desc: 'حزمة ضوئية كلاسيكية ناعمة الحواف', icon: '🌟' },
  { id: 'double', label: 'شريط مزدوج', desc: 'شعاعان متوازيان لمظهر سينمائي فاخر', icon: '⚡' },
  { id: 'glow', label: 'توهج ناعم', desc: 'انتشار ضوئي شامل وعميق الثبات', icon: '✨' },
  { id: 'sharp', label: 'وميض حاد', desc: 'خط ليزري قاطع ونقي الحواف', icon: '💎' },
  { id: 'star', label: 'نجمة متوهجة', desc: 'شعاع مسحوب ببريق نجمي ساطع من المركز', icon: '⭐' }
];

export const SvgaShinePanel: React.FC<SvgaShinePanelProps> = ({
  layerName,
  shineConfig,
  onUpdateShineConfig,
  onResetShine,
  selectedLayersCount = 1,
  totalLayersCount = 1,
  onApplyToAll,
  onApplyToSelected,
  onRemoveFromAll,
  projectWidth = 750,
  projectHeight = 1334,
  layerBounds,
  onCreateShineLayer,
  onExportShineLayerOnly,
  isSeparateLayer,
  shinePointStep = 'idle',
  onStartPickPoints,
  onCancelPickPoints
}) => {
  const isEnabled = shineConfig?.enabled ?? false;
  const applyScope: ShineApplyScope = shineConfig?.applyScope ?? (selectedLayersCount > 1 ? 'selected' : 'single');
  const exportMode: 'merge' | 'separate' = shineConfig?.exportMode ?? (isSeparateLayer ? 'separate' : 'merge');
  const beamWidth = shineConfig?.beamWidth ?? 60;
  const angleDeg = shineConfig?.angleDeg ?? 90;
  const opacity = Math.round((shineConfig?.opacity ?? 0.85) * 100);
  const featherSides = Math.round((shineConfig?.featherSides ?? 0.85) * 100);
  const featherTopBottom = Math.round((shineConfig?.featherTopBottom ?? 0.7) * 100);
  const maskToAlpha = shineConfig?.maskToAlpha ?? true;
  const color = shineConfig?.color ?? '255, 255, 255';
  const keyStart = Math.round((shineConfig?.keyframeStart ?? 0.0) * 100);
  const keyEnd = Math.round((shineConfig?.keyframeEnd ?? 1.0) * 100);
  const durationSeconds = shineConfig?.durationSeconds ?? 2.0;
  const repeatInterval = shineConfig?.repeatInterval ?? 0.5;
  const speedMultiplier = shineConfig?.speedMultiplier ?? 1.0;
  const style: ShineStyle = shineConfig?.style ?? 'soft';
  const direction: ShineDirection = shineConfig?.direction ?? 'forward';
  const editPathOnCanvas = shineConfig?.editPathOnCanvas ?? true;

  // Derive start/end points or default to layer center
  const defaultStart: ShineVectorPoint = {
    x: layerBounds ? Math.round(layerBounds.x + layerBounds.width / 2) : Math.round(projectWidth / 2),
    y: layerBounds ? Math.max(0, Math.round(layerBounds.y - 40)) : 100
  };
  const defaultEnd: ShineVectorPoint = {
    x: layerBounds ? Math.round(layerBounds.x + layerBounds.width / 2) : Math.round(projectWidth / 2),
    y: layerBounds ? Math.round(layerBounds.y + layerBounds.height + 40) : Math.round(projectHeight - 100)
  };

  const startPoint = shineConfig?.startPoint || defaultStart;
  const endPoint = shineConfig?.endPoint || defaultEnd;

  // Calculate live path angle and length
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const pathLength = Math.round(Math.hypot(dx, dy));
  const computedAngle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

  const handleToggle = () => {
    onUpdateShineConfig({ 
      enabled: !isEnabled,
      startPoint: startPoint,
      endPoint: endPoint,
      editPathOnCanvas: true
    }, applyScope);
  };

  const handleScopeChange = (newScope: ShineApplyScope) => {
    onUpdateShineConfig({ applyScope: newScope }, newScope);
  };

  // Helper to reverse vector direction
  const handleReverseVector = () => {
    onUpdateShineConfig({
      startPoint: { ...endPoint },
      endPoint: { ...startPoint }
    }, applyScope);
  };

  // Helper to fit vector to current layer
  const handleFitToLayer = () => {
    if (!layerBounds) return;
    const padding = Math.max(30, Math.round(beamWidth));
    onUpdateShineConfig({
      startPoint: {
        x: Math.round(layerBounds.x + layerBounds.width / 2),
        y: Math.round(Math.max(0, layerBounds.y - padding))
      },
      endPoint: {
        x: Math.round(layerBounds.x + layerBounds.width / 2),
        y: Math.round(layerBounds.y + layerBounds.height + padding)
      },
      angleDeg: 90
    }, applyScope);
  };

  // Helper to set full canvas diagonal vector
  const handleFullCanvasDiagonal = () => {
    onUpdateShineConfig({
      startPoint: { x: 50, y: 50 },
      endPoint: { x: projectWidth - 50, y: projectHeight - 50 },
      angleDeg: 45
    }, applyScope);
  };

  return (
    <div className="space-y-3.5 select-none" dir="rtl">
      {/* Primary Header Card with Master Toggle */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-amber-950/40 border border-amber-500/30 rounded-2xl p-3.5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
              <Sparkles size={17} className={isEnabled ? 'animate-pulse text-amber-300' : 'text-slate-400'} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>تحريك لمعة الطبقات (Shine Effect)</span>
                {isEnabled && (
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-full">
                    مفعلة
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-amber-200/80 line-clamp-1">
                تأثير ضوء متحرك انسيابي قابل للتحكم بالمسار والنقاط
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isEnabled
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 font-black'
                : 'bg-white/10 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-slate-950 animate-ping' : 'bg-slate-500'}`} />
            <span>{isEnabled ? 'مفعلة ✓' : 'معطلة'}</span>
          </button>
        </div>

        {/* Target Scope Selection Bar (طبقة واحدة / عدة طبقات / جميع الطبقات) */}
        <div className="pt-2 border-t border-amber-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
              <Layers size={13} className="text-amber-400" />
              <span>نطاق تطبيق اللمعان:</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">
              {applyScope === 'single' ? 'طبقة واحدة' : applyScope === 'selected' ? `${selectedLayersCount} طبقة محددة` : `كل الطبقات (${totalLayersCount})`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            {/* 1. Single Layer */}
            <button
              type="button"
              onClick={() => handleScopeChange('single')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                applyScope === 'single'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="تطبيق على الطبقة المحددة الحالية فقط"
            >
              <span>طبقة واحدة</span>
              <span className="text-[8px] opacity-80 truncate max-w-[80px]">
                {layerName || 'المحددة'}
              </span>
            </button>

            {/* 2. Multiple / Selected Layers */}
            <button
              type="button"
              onClick={() => handleScopeChange('selected')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                applyScope === 'selected'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="تطبيق على الطبقات المحددة حالياً في القائمة"
            >
              <span>عدة طبقات</span>
              <span className="text-[8px] opacity-80 font-mono">
                ({selectedLayersCount}) محددة
              </span>
            </button>

            {/* 3. All Layers */}
            <button
              type="button"
              onClick={() => handleScopeChange('all')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                applyScope === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="تطبيق اللمعان على جميع الطبقات الموجودة في المشروع"
            >
              <span>جميع الطبقات</span>
              <span className="text-[8px] opacity-80 font-mono">
                ({totalLayersCount}) طبقة
              </span>
            </button>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            {onApplyToAll && (
              <button
                type="button"
                onClick={() => {
                  const currentFullConfig: ShineEffectConfig = {
                    enabled: true,
                    applyScope: 'all',
                    beamWidth,
                    angleDeg,
                    opacity: opacity / 100,
                    featherSides: featherSides / 100,
                    featherTopBottom: featherTopBottom / 100,
                    maskToAlpha,
                    color,
                    keyframeStart: keyStart / 100,
                    keyframeEnd: keyEnd / 100,
                    durationSeconds,
                    repeatInterval,
                    speedMultiplier,
                    style,
                    direction,
                    startPoint,
                    endPoint,
                    editPathOnCanvas
                  };
                  onApplyToAll(currentFullConfig);
                }}
                className="flex-1 py-1 px-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1"
                title="نسخ نفس إعدادات اللمعة وتطبيقها على جميع طبقات المشروع دفعة واحدة"
              >
                <CheckSquare size={11} />
                <span>تطبيق على الكل</span>
              </button>
            )}

            {selectedLayersCount > 1 && onApplyToSelected && (
              <button
                type="button"
                onClick={() => {
                  const currentFullConfig: ShineEffectConfig = {
                    enabled: true,
                    applyScope: 'selected',
                    beamWidth,
                    angleDeg,
                    opacity: opacity / 100,
                    featherSides: featherSides / 100,
                    featherTopBottom: featherTopBottom / 100,
                    maskToAlpha,
                    color,
                    keyframeStart: keyStart / 100,
                    keyframeEnd: keyEnd / 100,
                    durationSeconds,
                    repeatInterval,
                    speedMultiplier,
                    style,
                    direction,
                    startPoint,
                    endPoint,
                    editPathOnCanvas
                  };
                  onApplyToSelected(currentFullConfig);
                }}
                className="flex-1 py-1 px-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1"
                title="تطبيق على الطبقات المحددة فقط"
              >
                <Layers size={11} />
                <span>تطبيق على المحددة ({selectedLayersCount})</span>
              </button>
            )}

            {onRemoveFromAll && (
              <button
                type="button"
                onClick={onRemoveFromAll}
                className="py-1 px-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-[10px] font-bold rounded-lg transition-all text-center cursor-pointer"
                title="إلغاء اللمعة من جميع الطبقات"
              >
                إلغاء من الكل
              </button>
            )}
          </div>
        </div>
      </div>

      {isEnabled && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {/* SECTION: Canvas Interactive Vector Path (مسار اللمعان على الكانفاس) */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3.5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Compass size={14} className="animate-spin-slow" />
                </div>
                <div>
                  <span className="text-xs font-black text-cyan-300 block">مسار اللمعان على الكانفاس (Vector Path)</span>
                  <span className="text-[10px] text-slate-400">حدد خط سير اللمعان بالسحب المباشر على الشاشة</span>
                </div>
              </div>

              {/* Canvas Overlay Toggle */}
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ editPathOnCanvas: !editPathOnCanvas }, applyScope)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                  editPathOnCanvas
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
                title="إظهار أو إخفاء مقابض المسار على الكانفاس"
              >
                <Eye size={11} />
                <span>{editPathOnCanvas ? 'المقابض ظاهرة' : 'إخفاء المقابض'}</span>
              </button>
            </div>

            {/* Interactive Canvas Point Picker Button */}
            {onStartPickPoints && (
              <div className="space-y-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (shinePointStep !== 'idle') {
                      onCancelPickPoints?.();
                    } else {
                      onStartPickPoints?.();
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg text-xs ${
                    shinePointStep !== 'idle'
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/40 ring-2 ring-emerald-300 animate-pulse font-black'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-900/40'
                  }`}
                >
                  <Crosshair size={15} className={shinePointStep !== 'idle' ? 'animate-spin' : ''} />
                  <span>
                    {shinePointStep === 'place-start'
                      ? '📌 الخطوة 1: انقر على الكانفاس لتحديد نقطة البداية (Start)...'
                      : shinePointStep === 'place-end'
                      ? '🎯 الخطوة 2: انقر على الكانفاس لتحديد نقطة النهاية (End)...'
                      : 'تحديد نقطتي البداية والنهاية بالنقر على الكانفاس 🎯'}
                  </span>
                </button>
                {shinePointStep !== 'idle' && (
                  <div className="flex items-center justify-between px-2 text-[10px] text-emerald-300 font-bold">
                    <span>انقر على أي نقطة على الشاشة لتثبيت موضع اللمعة</span>
                    <button
                      type="button"
                      onClick={onCancelPickPoints}
                      className="text-rose-400 hover:text-rose-200 underline cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Path Coordinates & Metrics Display */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-2 rounded-xl border border-white/10 font-mono text-[11px]">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-emerald-400 font-bold">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>البداية (S):</span>
                  </span>
                  <span>{Math.round(startPoint.x)}, {Math.round(startPoint.y)}</span>
                </div>
                <div className="flex gap-1 text-[10px]">
                  <input
                    type="number"
                    value={Math.round(startPoint.x)}
                    onChange={(e) => onUpdateShineConfig({
                      startPoint: { ...startPoint, x: Number(e.target.value) }
                    }, applyScope)}
                    className="w-1/2 bg-slate-800 border border-white/10 rounded px-1 text-center text-white"
                    placeholder="X"
                  />
                  <input
                    type="number"
                    value={Math.round(startPoint.y)}
                    onChange={(e) => onUpdateShineConfig({
                      startPoint: { ...startPoint, y: Number(e.target.value) }
                    }, applyScope)}
                    className="w-1/2 bg-slate-800 border border-white/10 rounded px-1 text-center text-white"
                    placeholder="Y"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-purple-400 font-bold">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>النهاية (E):</span>
                  </span>
                  <span>{Math.round(endPoint.x)}, {Math.round(endPoint.y)}</span>
                </div>
                <div className="flex gap-1 text-[10px]">
                  <input
                    type="number"
                    value={Math.round(endPoint.x)}
                    onChange={(e) => onUpdateShineConfig({
                      endPoint: { ...endPoint, x: Number(e.target.value) }
                    }, applyScope)}
                    className="w-1/2 bg-slate-800 border border-white/10 rounded px-1 text-center text-white"
                    placeholder="X"
                  />
                  <input
                    type="number"
                    value={Math.round(endPoint.y)}
                    onChange={(e) => onUpdateShineConfig({
                      endPoint: { ...endPoint, y: Number(e.target.value) }
                    }, applyScope)}
                    className="w-1/2 bg-slate-800 border border-white/10 rounded px-1 text-center text-white"
                    placeholder="Y"
                  />
                </div>
              </div>
            </div>

            {/* Trajectory Info Bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5">
              <span>الزاوية المحسوبة: <span className="text-cyan-400 font-mono">{computedAngle}°</span></span>
              <span>طول المسار: <span className="text-amber-400 font-mono">{pathLength}px</span></span>
            </div>

            {/* Quick Presets on Layer Bounds */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300">سحب وتثبيت سريع بين الجوانب (Edge to Edge):</span>
                <button
                  type="button"
                  onClick={handleReverseVector}
                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded text-[9px] font-bold cursor-pointer"
                  title="عكس نقطة البداية والنهاية"
                >
                  عكس الاتجاه (S ⇄ E)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {/* 1. Left to Right */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x - 40), y: Math.round(bounds.y + bounds.height / 2) },
                      endPoint: { x: Math.round(bounds.x + bounds.width + 40), y: Math.round(bounds.y + bounds.height / 2) },
                      angleDeg: 0
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>من الجنب اليسار لليمين ➔</span>
                  <span className="text-[9px] text-emerald-400/70">أفقي</span>
                </button>

                {/* 2. Right to Left */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x + bounds.width + 40), y: Math.round(bounds.y + bounds.height / 2) },
                      endPoint: { x: Math.round(bounds.x - 40), y: Math.round(bounds.y + bounds.height / 2) },
                      angleDeg: 180
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>من الجنب اليمين لليسار ⬅</span>
                  <span className="text-[9px] text-emerald-400/70">أفقي عكسي</span>
                </button>

                {/* 3. Top to Bottom */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y - 40) },
                      endPoint: { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height + 40) },
                      angleDeg: 90
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>من الجنب العلوي للسفلي ⬇</span>
                  <span className="text-[9px] text-emerald-400/70">رأسي</span>
                </button>

                {/* 4. Bottom to Top */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height + 40) },
                      endPoint: { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y - 40) },
                      angleDeg: 270
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>من الجنب السفلي للعلوي ⬆</span>
                  <span className="text-[9px] text-emerald-400/70">رأسي عكسي</span>
                </button>

                {/* 5. Diagonal Top-Left to Bottom-Right */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x - 30), y: Math.round(bounds.y - 30) },
                      endPoint: { x: Math.round(bounds.x + bounds.width + 30), y: Math.round(bounds.y + bounds.height + 30) },
                      angleDeg: 45
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>قطري من أوله لآخره ↘</span>
                  <span className="text-[9px] text-emerald-400/70">قطري</span>
                </button>

                {/* 6. Diagonal Bottom-Right to Top-Left */}
                <button
                  type="button"
                  onClick={() => {
                    const bounds = layerBounds || { x: 50, y: 50, width: projectWidth - 100, height: projectHeight - 100 };
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(bounds.x + bounds.width + 30), y: Math.round(bounds.y + bounds.height + 30) },
                      endPoint: { x: Math.round(bounds.x - 30), y: Math.round(bounds.y - 30) },
                      angleDeg: 225
                    }, applyScope);
                  }}
                  className="py-1.5 px-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl font-bold flex items-center justify-between cursor-pointer"
                >
                  <span>قطري من آخره لأوله ↖</span>
                  <span className="text-[9px] text-emerald-400/70">قطري عكسي</span>
                </button>
              </div>
            </div>

            {/* Vector Transformation Tools */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-300">نقل وتحويل مسار الحركة:</span>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    const midX = (startPoint.x + endPoint.x) / 2;
                    const midY = (startPoint.y + endPoint.y) / 2;
                    const cX = projectWidth / 2;
                    const cY = projectHeight / 2;
                    const oppX = 2 * cX - midX;
                    const oppY = 2 * cY - midY;
                    const diffX = oppX - midX;
                    const diffY = oppY - midY;
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(startPoint.x + diffX), y: Math.round(startPoint.y + diffY) },
                      endPoint: { x: Math.round(endPoint.x + diffX), y: Math.round(endPoint.y + diffY) }
                    }, applyScope);
                  }}
                  className="py-1.5 px-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold rounded-xl text-center cursor-pointer"
                  title="نقل اللمعة إلى النصف المقابل من التصميم مع الحفاظ على نفس المسار والسرعة"
                >
                  نقل للمقابلة ⇄
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cX = layerBounds ? (layerBounds.x + layerBounds.width / 2) : (projectWidth / 2);
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(2 * cX - startPoint.x), y: Math.round(startPoint.y) },
                      endPoint: { x: Math.round(2 * cX - endPoint.x), y: Math.round(endPoint.y) }
                    }, applyScope);
                  }}
                  className="py-1.5 px-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-xl text-center cursor-pointer"
                  title="قلب مسار اللمعة أفقياً"
                >
                  قلب أفقي ↔
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cY = layerBounds ? (layerBounds.y + layerBounds.height / 2) : (projectHeight / 2);
                    onUpdateShineConfig({
                      startPoint: { x: Math.round(startPoint.x), y: Math.round(2 * cY - startPoint.y) },
                      endPoint: { x: Math.round(endPoint.x), y: Math.round(2 * cY - endPoint.y) }
                    }, applyScope);
                  }}
                  className="py-1.5 px-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold rounded-xl text-center cursor-pointer"
                  title="قلب مسار اللمعة رأسياً"
                >
                  قلب رأسي ↕
                </button>
              </div>
            </div>

            {/* Quick Vector Adjustments & Actions */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleReverseVector}
                className="py-1.5 px-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="عكس اتجاه بداية ونهاية المسار"
              >
                <ArrowRightLeft size={11} className="text-cyan-400" />
                <span>عكس التدفق ⟲</span>
              </button>

              <button
                type="button"
                onClick={handleFitToLayer}
                className="py-1.5 px-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="محاذاة المسار على أبعاد الطبقة الحالية"
              >
                <Move size={11} className="text-amber-400" />
                <span>توسيط بالطبقة</span>
              </button>

              <button
                type="button"
                onClick={handleFullCanvasDiagonal}
                className="py-1.5 px-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="مسار قطري لكامل الكانفاس"
              >
                <Zap size={11} className="text-purple-400" />
                <span>كامل الشاشة</span>
              </button>
            </div>
          </div>

          {/* SECTION: Shine Layer Architecture (نظام طبقة اللمعة وحفظها) */}
          <div className="bg-gradient-to-br from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 rounded-2xl p-3.5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Layers size={14} />
                </div>
                <div>
                  <span className="text-xs font-black text-white block">إدارة طبقة وحفظ اللمعان (Shine Layer)</span>
                  <span className="text-[10px] text-purple-200/80">خيارات حفظ اللمعة كطبقة مستقلة أو دمجها بالتصميم</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ exportMode: 'separate', isSeparateLayer: true }, applyScope)}
                className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                  shineConfig?.exportMode !== 'merge'
                    ? 'border-purple-400 bg-purple-500/20 shadow-md ring-1 ring-purple-400'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300">طبقة مستقلة (Separate Layer)</span>
                  {shineConfig?.exportMode !== 'merge' && <Check size={12} className="text-purple-300" />}
                </div>
                <span className="text-[9px] text-slate-400 leading-tight">
                  حفظ اللمعة كـ Layer مستقلة في التايم لاين قابلة للتحريك والتعديل
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateShineConfig({ exportMode: 'merge', isSeparateLayer: false }, applyScope)}
                className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                  shineConfig?.exportMode === 'merge'
                    ? 'border-purple-400 bg-purple-500/20 shadow-md ring-1 ring-purple-400'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">دمج اللمعة (Merge Shine)</span>
                  {shineConfig?.exportMode === 'merge' && <Check size={12} className="text-indigo-300" />}
                </div>
                <span className="text-[9px] text-slate-400 leading-tight">
                  دمج التأثير مباشرة مع حركة ومحتوى التصميم عند التصدير
                </span>
              </button>
            </div>

            {/* Shine Layer Actions */}
            <div className="flex items-center gap-2 pt-1">
              {onCreateShineLayer && (
                <button
                  type="button"
                  onClick={onCreateShineLayer}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>إنشاء طبقة لمعة جديدة (+)</span>
                </button>
              )}

              {onExportShineLayerOnly && (
                <button
                  type="button"
                  onClick={onExportShineLayerOnly}
                  className="flex-1 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="تصدير Layer اللمعة وحدها بصيغة SVGA شفافة"
                >
                  <Zap size={13} className="text-amber-400" />
                  <span>تصدير طبقة اللمعة وحدها</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION: Shine Style Profile (شكل ونوع اللمعان) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
            <span className="text-xs font-black text-amber-300 block">نمط وشكل اللمعان (Shine Style):</span>
            
            <div className="grid grid-cols-2 gap-2">
              {SHINE_STYLES.map((st) => {
                const isSelected = style === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onUpdateShineConfig({ style: st.id }, applyScope)}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-md ring-1 ring-amber-400/50'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm">{st.icon}</span>
                      <span className={`text-[11px] font-black ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                        {st.label}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 line-clamp-1 leading-tight">
                      {st.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION: Direction, Timing & Speed (اتجاه الحركة وسرعة التكرار) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
            <span className="text-xs font-black text-indigo-300 block">حركة وتكرار اللمعان:</span>

            {/* Movement Direction Mode */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-300">اتجاه الحركة:</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'forward', label: 'للأمام (S→E)' },
                  { id: 'reverse', label: 'عكسي (E→S)' },
                  { id: 'pingpong', label: 'ذهاب وإياب' }
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onUpdateShineConfig({ direction: d.id as ShineDirection }, applyScope)}
                    className={`py-1.5 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                      direction === d.id
                        ? 'bg-indigo-500 text-white font-black border-indigo-400 shadow-sm'
                        : 'bg-white/5 text-slate-300 hover:text-white border-white/10'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration & Repeat Pause Interval */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Duration Seconds */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>مدة الحركة:</span>
                  <span className="font-mono text-indigo-400">{durationSeconds}s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={6.0}
                  step={0.1}
                  value={durationSeconds}
                  onChange={(e) => onUpdateShineConfig({ durationSeconds: Number(e.target.value) }, applyScope)}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Repeat Interval Pause */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>استراحة التكرار:</span>
                  <span className="font-mono text-indigo-400">{repeatInterval}s</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={4.0}
                  step={0.1}
                  value={repeatInterval}
                  onChange={(e) => onUpdateShineConfig({ repeatInterval: Number(e.target.value) }, applyScope)}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Speed Multiplier Quick Buttons */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-slate-300">مضاعف السرعة:</span>
              <div className="flex gap-1">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUpdateShineConfig({ speedMultiplier: s }, applyScope)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-lg border transition-all cursor-pointer ${
                      speedMultiplier === s
                        ? 'bg-indigo-600 text-white font-bold border-indigo-400'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION: Color & Beam Width (لون وعرض شريط اللمعة) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
            <span className="text-xs font-black text-amber-300 block">لون وحجم شريط اللمعة:</span>
            
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_PRESETS.map((p) => {
                const isSelected = color === p.value || color === p.hex;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdateShineConfig({ color: p.value }, applyScope)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-sm ring-1 ring-amber-400'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    title={p.name}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white/30 shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: p.hex }}
                    >
                      {isSelected && <Check size={10} className={p.value === '255, 255, 255' ? 'text-black' : 'text-white'} />}
                    </div>
                    <span className="text-[8px] font-bold text-slate-300 text-center truncate w-full">{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-slate-300">لون مخصص:</span>
              <input
                type="color"
                value={color.startsWith('#') ? color : '#ffffff'}
                onChange={(e) => onUpdateShineConfig({ color: e.target.value }, applyScope)}
                className="w-7 h-7 rounded-lg bg-transparent border border-white/20 cursor-pointer"
                title="اختر لوناً مخصصاً"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => onUpdateShineConfig({ color: e.target.value }, applyScope)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono text-white text-left"
                placeholder="255, 255, 255 or #ffffff"
              />
            </div>

            {/* Beam Width & Opacity */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* Beam Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>عرض الشريط (px):</span>
                  <span className="font-mono text-amber-400">{beamWidth}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={beamWidth}
                  onChange={(e) => onUpdateShineConfig({ beamWidth: Number(e.target.value) }, applyScope)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>السطوع والشفافية:</span>
                  <span className="font-mono text-amber-400">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={opacity}
                  onChange={(e) => onUpdateShineConfig({ opacity: Number(e.target.value) / 100 }, applyScope)}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SECTION: Feathering & Alpha Masking (النعومة والقص) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
            <span className="text-xs font-black text-cyan-300 block">نعومة وتلاشي الحواف (Feathering):</span>

            <div className="grid grid-cols-2 gap-3">
              {/* Side Feathering */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>تلاشي الجوانب:</span>
                  <span className="font-mono text-cyan-400">{featherSides}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={featherSides}
                  onChange={(e) => onUpdateShineConfig({ featherSides: Number(e.target.value) / 100 }, applyScope)}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Top/Bottom Feathering */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>تلاشي الأطراف:</span>
                  <span className="font-mono text-cyan-400">{featherTopBottom}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={featherTopBottom}
                  onChange={(e) => onUpdateShineConfig({ featherTopBottom: Number(e.target.value) / 100 }, applyScope)}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Mask to Alpha Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-xs font-bold text-slate-200 block">قصر اللمعة على حدود الصورة فقط</span>
                <span className="text-[10px] text-slate-400">حجب اللمعة عن الفراغ الشفاف المحيط بالطبقة</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ maskToAlpha: !maskToAlpha }, applyScope)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  maskToAlpha ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    maskToAlpha ? 'translate-x-0' : '-translate-x-5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* SECTION: Keyframes Range (نطاق الكي فريمز) */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
            <span className="text-xs font-black text-purple-300 block">نطاق الحركة الزمني (Keyframes):</span>

            <div className="grid grid-cols-2 gap-3">
              {/* Start Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>نقطة البداية:</span>
                  <span className="font-mono text-purple-400">{keyStart}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={keyStart}
                  onChange={(e) => onUpdateShineConfig({ keyframeStart: Number(e.target.value) / 100 }, applyScope)}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* End Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>نقطة النهاية:</span>
                  <span className="font-mono text-purple-400">{keyEnd}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={keyEnd}
                  onChange={(e) => onUpdateShineConfig({ keyframeEnd: Number(e.target.value) / 100 }, applyScope)}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SECTION: SVGA Export & Persistence Architecture (طريقة الحفظ والتصدير داخل SVGA) */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Sparkles size={14} className="text-emerald-300" />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-300 block">نظام الحفظ والتصدير داخل SVGA</span>
                <span className="text-[10px] text-slate-400">اختر طريقة حفظ اللمعة داخل ملف SVGA لضمان ثباتها</span>
              </div>
            </div>

            {/* Mode Selection Cards */}
            <div className="space-y-2">
              {/* Option 1: Merge with Base Layer (Bake to Frames) */}
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ exportMode: 'merge' }, applyScope)}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  exportMode === 'merge'
                    ? 'bg-emerald-950/60 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      exportMode === 'merge' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-500'
                    }`}>
                      {exportMode === 'merge' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                    <span className="text-xs font-black text-white">تسلسل صور مدمجة (Merge with Base Layer)</span>
                  </div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold">
                    موصى به للموبايل
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed pr-5">
                  دمج مباشر داخل إطارات وصور الطبقة. يضمن ظهور اللمعة بدقة 100% في جميع مشغلات SVGA وأجهزة الموبايل (iOS و Android) بدون أي تشويه أو اعتماد على دعم الأقنعة.
                </p>
              </button>

              {/* Option 2: Separate Shine Layer Sprite */}
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ exportMode: 'separate' }, applyScope)}
                className={`w-full p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  exportMode === 'separate'
                    ? 'bg-purple-950/60 border-purple-400 shadow-md ring-1 ring-purple-400'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      exportMode === 'separate' ? 'border-purple-400 bg-purple-500' : 'border-slate-500'
                    }`}>
                      {exportMode === 'separate' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                    <span className="text-xs font-black text-white">طبقة مستقلة داخل SVGA (Separate Sprite Layer)</span>
                  </div>
                  <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-bold">
                    حجم ملف أصغر
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed pr-5">
                  حفظ اللمعة كطبقة شعاع مستقلة مع قناع ألفا (Alpha Matte) يتحرك على طول المسار. يحافظ على صورة واحدة للطبقة الأصلية.
                </p>
              </button>
            </div>

            {/* Standalone Export Button */}
            {onExportShineLayerOnly && (
              <div className="pt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={onExportShineLayerOnly}
                  className="w-full py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 rounded-xl text-xs font-bold text-cyan-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Download size={13} />
                  <span>تصدير طبقة اللمعة وحدها بصيغة SVGA شفافة</span>
                </button>
              </div>
            )}
          </div>

          {/* Reset Action */}
          {onResetShine && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={onResetShine}
                className="text-[11px] text-amber-400 hover:text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-amber-500/20"
              >
                <RotateCcw size={12} />
                <span>إعادة ضبط إعدادات اللمعة الافتراضية</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
