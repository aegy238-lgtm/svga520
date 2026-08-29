import React, { useRef, useState } from 'react';
import { EditableLayer, SVGAProjectData } from './types';
import { 
  Sliders, Link, Unlink, RotateCcw, 
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  AlignLeft, AlignRight, AlignCenter, ArrowUp, ArrowDown,
  Upload, Image as ImageIcon, Sparkles, RefreshCw, Eye,
  Film, FlipHorizontal, FlipVertical, Clock, Lock, Unlock,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair,
  Layers, Box, Trash2, Maximize2, Move, Package, CheckSquare,
  ZoomIn, ZoomOut, Scaling, SlidersHorizontal, ArrowLeftRight,
  RotateCw, Target, CheckCheck, Minimize2
} from 'lucide-react';

interface SvgaPropertiesPanelProps {
  project: SVGAProjectData;
  layer: EditableLayer | null;
  selectedLayers?: EditableLayer[];
  selectedLayerIds?: string[];
  currentFrame: number;
  onUpdateTransform: (transform: Partial<EditableLayer['transform']>) => void;
  onBulkTransform?: (deltas: { 
    dx?: number; 
    dy?: number; 
    scaleMultiplier?: number; 
    scaleMultiplierX?: number; 
    scaleMultiplierY?: number; 
    flipHorizontally?: boolean; 
    flipVertically?: boolean; 
    rotationDelta?: number; 
    setRotation?: number; 
    opacityDelta?: number; 
    setOpacity?: number; 
    alignToCanvas?: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'centerAll';
    canvasWidth?: number;
    canvasHeight?: number;
  }) => void;
  onToggleAspectLock: () => void;
  onReplaceAsset: (file: File) => void;
  onResetTransform: () => void;
  onUpdateFrameRange?: (startFrame: number, endFrame: number) => void;
  // Merged Group / Bundle Operations
  onTransformGroup?: (groupId: string, deltas: { dx?: number; dy?: number; scaleMultiplier?: number; rotationDelta?: number; opacityDelta?: number; setOpacity?: number }) => void;
  onUngroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupLock?: (groupId: string) => void;
  onToggleGroupVisibility?: (groupId: string) => void;
  groupLayersCount?: number;
}

export const SvgaPropertiesPanel: React.FC<SvgaPropertiesPanelProps> = ({
  project,
  layer,
  selectedLayers = [],
  selectedLayerIds = [],
  currentFrame,
  onUpdateTransform,
  onBulkTransform,
  onToggleAspectLock,
  onReplaceAsset,
  onResetTransform,
  onUpdateFrameRange,
  onTransformGroup,
  onUngroup,
  onDeleteGroup,
  onToggleGroupLock,
  onToggleGroupVisibility,
  groupLayersCount = 0
}) => {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [panelNudgeStep, setPanelNudgeStep] = useState<number>(1);
  const [groupNudgeStep, setGroupNudgeStep] = useState<number>(5);
  const [bulkNudgeStep, setBulkNudgeStep] = useState<number>(10);
  const [bulkScaleSlider, setBulkScaleSlider] = useState<number>(100);

  const isMultiSelected = selectedLayerIds.length > 1;

  // Multi-Selection Bulk Transformation View
  if (isMultiSelected && onBulkTransform) {
    // Calculate Collective Bounding Box Info
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedLayers.forEach(l => {
      minX = Math.min(minX, l.transform.x);
      minY = Math.min(minY, l.transform.y);
      maxX = Math.max(maxX, l.transform.x + (l.transform.width || 10));
      maxY = Math.max(maxY, l.transform.y + (l.transform.height || 10));
    });

    const collectiveWidth = minX !== Infinity ? Math.round(maxX - minX) : 0;
    const collectiveHeight = minY !== Infinity ? Math.round(maxY - minY) : 0;
    const collectiveCenterX = minX !== Infinity ? Math.round(minX + collectiveWidth / 2) : 0;
    const collectiveCenterY = minY !== Infinity ? Math.round(minY + collectiveHeight / 2) : 0;

    return (
      <div className="flex flex-col h-full bg-[#070b14] border-l border-white/10 overflow-y-auto custom-scrollbar p-3.5 space-y-3.5 select-none" dir="rtl">
        {/* Header & Quick Summary */}
        <div className="bg-gradient-to-br from-amber-950/80 via-slate-900/90 to-purple-950/80 border border-amber-500/40 rounded-2xl p-3.5 space-y-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/25 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-md">
                <CheckCheck size={17} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">التحكم الجماعي الشامل</span>
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                    {selectedLayerIds.length} طبقات
                  </span>
                </div>
                <p className="text-[10px] text-amber-200/80 mt-0.5">
                  تكبير، تصغير، إزاحة ومحاذاة احترافية للكتلة بالكامل
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onBulkTransform({ alignToCanvas: 'centerAll', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
              className="p-1.5 bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1 text-[10px] font-bold"
              title="توسيط كافة الطبقات المحددة في منتصف مساحة العمل تماماً"
            >
              <Target size={13} />
              <span>توسيط</span>
            </button>
          </div>

          {/* Collective Dimension Metrics */}
          <div className="grid grid-cols-2 gap-2 text-[10px] bg-black/40 border border-white/10 rounded-xl p-2 font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">الأبعاد الإجمالية:</span>
              <span className="text-amber-300 font-bold">{collectiveWidth} × {collectiveHeight}px</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">المركز (X, Y):</span>
              <span className="text-indigo-300 font-bold">{collectiveCenterX}, {collectiveCenterY}px</span>
            </div>
          </div>
        </div>

        {/* 1. Scale & Resizing Master Hub */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <Scaling size={15} className="text-amber-400" />
              <span>التكبير والتصغير المتناسق</span>
            </span>
            <span className="text-[9px] font-mono text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded-md">حول المركز المشترك</span>
          </div>

          {/* Precision Scale Steppers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span>خطوات التكبير والتصغير السريعة:</span>
            </div>

            <div className="grid grid-cols-6 gap-1" dir="ltr">
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 0.90 })}
                className="py-1.5 bg-red-500/15 hover:bg-red-500 text-red-200 hover:text-white border border-red-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تصغير بنسبة 10%"
              >
                -10%
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 0.95 })}
                className="py-1.5 bg-red-500/15 hover:bg-red-500 text-red-200 hover:text-white border border-red-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تصغير بنسبة 5%"
              >
                -5%
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 0.99 })}
                className="py-1.5 bg-red-500/15 hover:bg-red-500 text-red-200 hover:text-white border border-red-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تصغير دقيق بنسبة 1%"
              >
                -1%
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 1.01 })}
                className="py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-200 hover:text-white border border-emerald-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تكبير دقيق بنسبة 1%"
              >
                +1%
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 1.05 })}
                className="py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-200 hover:text-white border border-emerald-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تكبير بنسبة 5%"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ scaleMultiplier: 1.10 })}
                className="py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-200 hover:text-white border border-emerald-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                title="تكبير بنسبة 10%"
              >
                +10%
              </button>
            </div>
          </div>

          {/* Quick Percentage Presets */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-300 block">نسب التحجيم المباشرة:</span>
            <div className="grid grid-cols-4 gap-1.5" dir="ltr">
              {[
                { label: '25%', factor: 0.25 },
                { label: '50%', factor: 0.50 },
                { label: '75%', factor: 0.75 },
                { label: '100%', factor: 1.00 },
                { label: '125%', factor: 1.25 },
                { label: '150%', factor: 1.50 },
                { label: '175%', factor: 1.75 },
                { label: '200%', factor: 2.00 }
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onBulkTransform({ scaleMultiplier: p.factor })}
                  className="py-1.5 bg-white/5 hover:bg-amber-600 hover:text-white text-slate-200 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center border border-white/10"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Independent Axis Scaling & Mirroring */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <span className="text-[11px] font-bold text-slate-300 block">التحجيم المخصص للمحاور والعكس:</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-blue-300 block text-center">المحور الأفقي (العرض X)</span>
                <div className="flex items-center gap-1" dir="ltr">
                  <button
                    type="button"
                    onClick={() => onBulkTransform({ scaleMultiplierX: 0.9 })}
                    className="flex-1 py-1 bg-blue-500/20 hover:bg-blue-600 text-blue-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                    title="تصغير العرض فقط 10%"
                  >
                    -10%
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkTransform({ scaleMultiplierX: 1.1 })}
                    className="flex-1 py-1 bg-blue-500/20 hover:bg-blue-600 text-blue-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                    title="تكبير العرض فقط 10%"
                  >
                    +10%
                  </button>
                </div>
              </div>

              <div className="bg-white/5 p-2 rounded-xl border border-white/5 space-y-1.5">
                <span className="text-[10px] font-bold text-purple-300 block text-center">المحور الرأسي (الارتفاع Y)</span>
                <div className="flex items-center gap-1" dir="ltr">
                  <button
                    type="button"
                    onClick={() => onBulkTransform({ scaleMultiplierY: 0.9 })}
                    className="flex-1 py-1 bg-purple-500/20 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                    title="تصغير الارتفاع فقط 10%"
                  >
                    -10%
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkTransform({ scaleMultiplierY: 1.1 })}
                    className="flex-1 py-1 bg-purple-500/20 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                    title="تكبير الارتفاع فقط 10%"
                  >
                    +10%
                  </button>
                </div>
              </div>
            </div>

            {/* Flip / Mirror Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onBulkTransform({ flipHorizontally: true })}
                className="py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                title="عكس كافة الطبقات المحددة أفقياً حول مركز الكتلة"
              >
                <FlipHorizontal size={14} />
                <span>عكس أفقي ↔</span>
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ flipVertically: true })}
                className="py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                title="عكس كافة الطبقات المحددة رأسياً حول مركز الكتلة"
              >
                <FlipVertical size={14} />
                <span>عكس رأسي ↕</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Position, Nudge & Alignment Master Hub */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
              <Move size={15} className="text-indigo-400" />
              <span>التحريك والإزاحة والمحاذاة</span>
            </span>
            <div className="flex items-center gap-1" dir="ltr">
              {[1, 5, 10, 25, 50].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBulkNudgeStep(s)}
                  className={`px-1.5 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all cursor-pointer ${
                    bulkNudgeStep === s ? 'bg-indigo-500 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          {/* Quick Move Left / Right (X-Axis) Stepper Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <ArrowLeftRight size={13} className="text-blue-400" />
                <span>إزاحة سريعة يمين ويسار (محور X):</span>
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1" dir="ltr">
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: -50 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليسار 50px"
              >
                « -50
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: -10 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليسار 10px"
              >
                ‹ -10
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: -1 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليسار 1px (دقيق)"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: 1 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليمين 1px (دقيق)"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: 10 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليمين 10px"
              >
                +10 ›
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dx: 50 })}
                className="py-1.5 bg-blue-500/15 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك لليمين 50px"
              >
                +50 »
              </button>
            </div>
          </div>

          {/* Quick Move Up / Down (Y-Axis) Stepper Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <ArrowUp size={13} className="text-purple-400" />
                <span>إزاحة سريعة أعلى وأسفل (محور Y):</span>
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1" dir="ltr">
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: -50 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأعلى 50px"
              >
                « -50
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: -10 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأعلى 10px"
              >
                ‹ -10
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: -1 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأعلى 1px (دقيق)"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: 1 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأسفل 1px (دقيق)"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: 10 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأسفل 10px"
              >
                +10 ›
              </button>
              <button
                type="button"
                onClick={() => onBulkTransform({ dy: 50 })}
                className="py-1.5 bg-purple-500/15 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/25 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="تحريك للأسفل 50px"
              >
                +50 »
              </button>
            </div>
          </div>

          {/* D-Pad Controller & Canvas Smart Alignment */}
          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-3 items-center">
            {/* D-Pad */}
            <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 mb-1.5">أسهم التوجيه ({bulkNudgeStep}px)</span>
              <div className="grid grid-cols-3 gap-1.5 w-32" dir="ltr">
                <div />
                <button
                  type="button"
                  onClick={() => onBulkTransform({ dy: -bulkNudgeStep })}
                  className="p-2 bg-white/10 hover:bg-indigo-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/10"
                  title={`تحريك للأعلى ${bulkNudgeStep}px`}
                >
                  <ChevronUp size={16} />
                </button>
                <div />

                <button
                  type="button"
                  onClick={() => onBulkTransform({ dx: -bulkNudgeStep })}
                  className="p-2 bg-white/10 hover:bg-indigo-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/10"
                  title={`تحريك لليسار ${bulkNudgeStep}px`}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'centerAll', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="flex items-center justify-center text-amber-400 hover:text-white bg-amber-500/20 hover:bg-amber-500 rounded-xl transition-all cursor-pointer active:scale-95"
                  title="توسيط تام في منتصف الكانفاس"
                >
                  <Crosshair size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ dx: bulkNudgeStep })}
                  className="p-2 bg-white/10 hover:bg-indigo-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/10"
                  title={`تحريك لليمين ${bulkNudgeStep}px`}
                >
                  <ChevronRight size={16} />
                </button>

                <div />
                <button
                  type="button"
                  onClick={() => onBulkTransform({ dy: bulkNudgeStep })}
                  className="p-2 bg-white/10 hover:bg-indigo-600 text-white rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/10"
                  title={`تحريك للأسفل ${bulkNudgeStep}px`}
                >
                  <ChevronDown size={16} />
                </button>
                <div />
              </div>
            </div>

            {/* Smart Canvas Alignments */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block text-center">محاذاة في الكانفاس</span>
              
              {/* Horizontal Alignments */}
              <div className="grid grid-cols-3 gap-1" dir="ltr">
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'left', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="محاذاة لأقصى يسار الكانفاس"
                >
                  <AlignLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'centerX', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="توسيط أفقي في منتصف الكانفاس"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'right', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="محاذاة لأقصى يمين الكانفاس"
                >
                  <AlignRight size={13} />
                </button>
              </div>

              {/* Vertical Alignments */}
              <div className="grid grid-cols-3 gap-1" dir="ltr">
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'top', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="محاذاة لأعلى الكانفاس"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'centerY', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="توسيط رأسي في منتصف الكانفاس"
                >
                  <AlignVerticalDistributeCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onBulkTransform({ alignToCanvas: 'bottom', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                  className="py-1.5 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center border border-white/5 flex items-center justify-center"
                  title="محاذاة لأسفل الكانفاس"
                >
                  <ArrowDown size={13} />
                </button>
              </div>

              {/* Center All Shortcut */}
              <button
                type="button"
                onClick={() => onBulkTransform({ alignToCanvas: 'centerAll', canvasWidth: project?.width || 500, canvasHeight: project?.height || 500 })}
                className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-bold transition-all cursor-pointer active:scale-95 text-center"
                title="توسيط كامل في المنتصف"
              >
                توسيط كامل في الكانفاس
              </button>
            </div>
          </div>
        </div>

        {/* 3. Collective Rotation & Opacity Hub */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                <RotateCw size={15} className="text-purple-400" />
                <span>التدوير الجماعي حول المركز</span>
              </span>
              <button
                type="button"
                onClick={() => onBulkTransform({ setRotation: 0 })}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                title="إعادة زاوية الدوران للوضع الأصلي 0 درجة"
              >
                إعادة ضبط (0°)
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1" dir="ltr">
              {[
                { label: '-90°', val: -90 },
                { label: '-45°', val: -45 },
                { label: '-15°', val: -15 },
                { label: '-5°', val: -5 },
                { label: '+5°', val: 5 },
                { label: '+15°', val: 15 },
                { label: '+45°', val: 45 },
                { label: '+90°', val: 90 }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onBulkTransform({ rotationDelta: item.val })}
                  className="py-1.5 bg-white/5 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center border border-white/10"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collective Opacity */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <span className="text-[11px] font-bold text-slate-300 block">الشفافية الجماعية الموحدة:</span>
            <div className="grid grid-cols-5 gap-1.5" dir="ltr">
              {[100, 75, 50, 25, 0].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => onBulkTransform({ setOpacity: op })}
                  className="py-1 bg-white/5 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center border border-white/10"
                >
                  {op}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Layer Items Quick Peek */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>الطبقات المحددة ({selectedLayerIds.length}):</span>
            <span className="text-[9px] text-slate-400">تأثير فوري متزامن</span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {selectedLayers.map(l => (
              <div key={l.id} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all">
                <span className="text-white truncate font-bold">{l.name}</span>
                <span className="text-[9px] font-mono text-amber-300/80 bg-black/40 px-1.5 py-0.5 rounded-md">
                  {Math.round(l.transform.width)}×{Math.round(l.transform.height)}px
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#070b14] border-l border-white/10 text-slate-500 select-none" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <Sliders size={20} />
        </div>
        <h4 className="text-white font-bold text-xs mb-1">لوحة الخصائص (Properties)</h4>
        <p className="text-[11px] text-slate-400 max-w-[200px]">
          حدد أي طبقة من الكانفاس أو قائمة الطبقات لتعديل موضعها وحجمها وخصائصها، أو حدد عدة طبقات للتحكم الجماعي
        </p>
      </div>
    );
  }

  const { transform, aspectRatioLocked, keyframeSummary } = layer;

  // Handle Quick Alignments
  const handleAlign = (type: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    const pw = project?.width || 500;
    const ph = project?.height || 500;
    const lw = transform.width;
    const lh = transform.height;

    switch (type) {
      case 'left':
        onUpdateTransform({ x: 0 });
        break;
      case 'centerX':
        onUpdateTransform({ x: Math.round((pw - lw) / 2) });
        break;
      case 'right':
        onUpdateTransform({ x: pw - lw });
        break;
      case 'top':
        onUpdateTransform({ y: 0 });
        break;
      case 'centerY':
        onUpdateTransform({ y: Math.round((ph - lh) / 2) });
        break;
      case 'bottom':
        onUpdateTransform({ y: ph - lh });
        break;
    }
  };

  const handleWidthChange = (val: number) => {
    const w = Math.max(5, val);
    const initW = Math.max(1, layer.initialBounds.width);
    const initH = Math.max(1, layer.initialBounds.height);
    const signX = transform.scaleX < 0 ? -1 : 1;
    const signY = transform.scaleY < 0 ? -1 : 1;

    if (aspectRatioLocked && transform.width > 0) {
      const ratio = transform.height / transform.width;
      const newH = Math.round(w * ratio);
      onUpdateTransform({
        width: w,
        height: newH,
        scaleX: parseFloat(((w / initW) * signX).toFixed(3)),
        scaleY: parseFloat(((newH / initH) * signY).toFixed(3))
      });
    } else {
      onUpdateTransform({
        width: w,
        scaleX: parseFloat(((w / initW) * signX).toFixed(3))
      });
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(5, val);
    const initW = Math.max(1, layer.initialBounds.width);
    const initH = Math.max(1, layer.initialBounds.height);
    const signX = transform.scaleX < 0 ? -1 : 1;
    const signY = transform.scaleY < 0 ? -1 : 1;

    if (aspectRatioLocked && transform.height > 0) {
      const ratio = transform.width / transform.height;
      const newW = Math.round(h * ratio);
      onUpdateTransform({
        height: h,
        width: newW,
        scaleY: parseFloat(((h / initH) * signY).toFixed(3)),
        scaleX: parseFloat(((newW / initW) * signX).toFixed(3))
      });
    } else {
      onUpdateTransform({
        height: h,
        scaleY: parseFloat(((h / initH) * signY).toFixed(3))
      });
    }
  };

  const handleFlipH = () => {
    onUpdateTransform({ scaleX: transform.scaleX * -1 });
  };

  const handleFlipV = () => {
    onUpdateTransform({ scaleY: transform.scaleY * -1 });
  };

  return (
    <div className="flex flex-col h-full bg-[#070b14] border-l border-white/10 overflow-y-auto custom-scrollbar p-4 space-y-4 select-none" dir="rtl">
      <input
        type="file"
        ref={replaceInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplaceAsset(f);
        }}
      />

      {/* Merged SVGA Bundle Controller Card if layer belongs to a merged SVGA group */}
      {layer.groupId && onTransformGroup && (
        <div className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 rounded-2xl p-3.5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center">
                <Package size={13} />
              </div>
              <div>
                <span className="text-[11px] font-black text-white block">حزمة SVGA المدمجة</span>
                <span className="text-[9px] text-indigo-300 font-mono">
                  {layer.groupName || 'ملف مدمج'} • {groupLayersCount} طبقات
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onToggleGroupLock && (
                <button
                  onClick={() => onToggleGroupLock(layer.groupId!)}
                  className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="قفل/فتح كامل الحزمة"
                >
                  <Lock size={12} />
                </button>
              )}
              {onToggleGroupVisibility && (
                <button
                  onClick={() => onToggleGroupVisibility(layer.groupId!)}
                  className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="إخفاء/إظهار كامل الحزمة"
                >
                  <Eye size={12} />
                </button>
              )}
              {onDeleteGroup && (
                <button
                  onClick={() => onDeleteGroup(layer.groupId!)}
                  className="p-1 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer"
                  title="حذف الحزمة المدمجة بالكامل"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Group Scale Presets & Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-200">تحجيم وتكبير الحزمة بالكامل:</span>
              <span className="text-[9px] font-mono text-indigo-400 font-bold">تكبير نسبي موحد</span>
            </div>

            <div className="grid grid-cols-5 gap-1" dir="ltr">
              {[0.5, 0.75, 1.0, 1.25, 1.5].map((scaleFactor) => (
                <button
                  key={scaleFactor}
                  onClick={() => onTransformGroup(layer.groupId!, { scaleMultiplier: scaleFactor })}
                  className="py-1 bg-white/10 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 text-center"
                  title={`تغيير الحجم بمقدار ${scaleFactor * 100}%`}
                >
                  {scaleFactor === 1 ? '100%' : `${scaleFactor * 100}%`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => onTransformGroup(layer.groupId!, { scaleMultiplier: 0.9 })}
                className="flex-1 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                title="تصغير الحزمة بنسبة 10%"
              >
                تصغير -10%
              </button>
              <button
                onClick={() => onTransformGroup(layer.groupId!, { scaleMultiplier: 1.1 })}
                className="flex-1 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                title="تكبير الحزمة بنسبة 10%"
              >
                تكبير +10%
              </button>
            </div>
          </div>

          {/* Group Collective Move D-Pad */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-200">تحريك الحزمة معاً (X, Y):</span>
              <div className="flex items-center gap-1" dir="ltr">
                {[1, 5, 10, 25].map(s => (
                  <button
                    key={s}
                    onClick={() => setGroupNudgeStep(s)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                      groupNudgeStep === s ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center pt-1" dir="ltr">
              <div className="grid grid-cols-3 gap-1 w-32">
                <div />
                <button
                  onClick={() => onTransformGroup(layer.groupId!, { dy: -groupNudgeStep })}
                  className="p-1.5 bg-white/10 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                  title="تحريك الحزمة للأعلى"
                >
                  <ChevronUp size={13} />
                </button>
                <div />

                <button
                  onClick={() => onTransformGroup(layer.groupId!, { dx: -groupNudgeStep })}
                  className="p-1.5 bg-white/10 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                  title="تحريك الحزمة لليسار"
                >
                  <ChevronLeft size={13} />
                </button>
                <div className="flex items-center justify-center text-indigo-400 text-[10px]">
                  <Move size={12} />
                </div>
                <button
                  onClick={() => onTransformGroup(layer.groupId!, { dx: groupNudgeStep })}
                  className="p-1.5 bg-white/10 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                  title="تحريك الحزمة لليمين"
                >
                  <ChevronRight size={13} />
                </button>

                <div />
                <button
                  onClick={() => onTransformGroup(layer.groupId!, { dy: groupNudgeStep })}
                  className="p-1.5 bg-white/10 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                  title="تحريك الحزمة للأسفل"
                >
                  <ChevronDown size={13} />
                </button>
                <div />
              </div>
            </div>
          </div>

          {/* Group Collective Rotate & Ungroup */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => onTransformGroup(layer.groupId!, { rotationDelta: -15 })}
              className="flex-1 py-1 bg-white/10 hover:bg-purple-600 text-white rounded-lg text-[10px] font-mono transition-all cursor-pointer"
              title="تدوير الحزمة -15°"
            >
              -15° تدوير
            </button>
            <button
              onClick={() => onTransformGroup(layer.groupId!, { rotationDelta: 15 })}
              className="flex-1 py-1 bg-white/10 hover:bg-purple-600 text-white rounded-lg text-[10px] font-mono transition-all cursor-pointer"
              title="تدوير الحزمة +15°"
            >
              +15° تدوير
            </button>
            {onUngroup && (
              <button
                onClick={() => onUngroup(layer.groupId!)}
                className="py-1 px-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                title="فك ارتباط الحزمة لتصبح طبقات عادية"
              >
                فك التجميع
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 border flex items-center justify-center">
            <Sliders size={14} />
          </div>
          <div>
            <h3 className="text-white font-bold text-xs">خصائص الطبقة</h3>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{layer.name}</p>
          </div>
        </div>

        <button
          onClick={onResetTransform}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title="إعادة تعيين للموضع الأصلي"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Layer Thumbnail & Asset Replace */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          {layer.thumbnailUrl ? (
            <img src={layer.thumbnailUrl} alt={layer.name} className="w-full h-full object-contain p-1" />
          ) : (
            <ImageIcon size={20} className="text-slate-500" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-white truncate">{layer.name}</span>
          <button
            onClick={() => replaceInputRef.current?.click()}
            className="w-full py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload size={11} /> استبدال الصورة (Replace)
          </button>
        </div>
      </div>

      {/* Alignment Tools */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 block">المحاذاة السريعة (Alignment)</span>
        <div className="grid grid-cols-6 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button onClick={() => handleAlign('left')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة لليسار">
            <AlignLeft size={13} />
          </button>
          <button onClick={() => handleAlign('centerX')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة أفقية للمنتصف">
            <AlignHorizontalDistributeCenter size={13} />
          </button>
          <button onClick={() => handleAlign('right')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة لليمين">
            <AlignRight size={13} />
          </button>
          <button onClick={() => handleAlign('top')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة للأعلى">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => handleAlign('centerY')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة رأسية للمنتصف">
            <AlignVerticalDistributeCenter size={13} />
          </button>
          <button onClick={() => handleAlign('bottom')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة للأسفل">
            <ArrowDown size={13} />
          </button>
        </div>
      </div>

      {/* Position (X, Y) with Precision Nudge D-Pad */}
      <div className="space-y-2 bg-slate-900/40 p-2.5 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-300">الموضع والتحريك المجهري</span>
          <div className="flex items-center gap-1" dir="ltr">
            {[0.1, 1, 5, 10].map(s => (
              <button
                key={s}
                onClick={() => setPanelNudgeStep(s)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  panelNudgeStep === s ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
                title={`مقدار التحريك ${s} بكسل`}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">X</span>
            <input
              type="number"
              step="any"
              value={Number(transform.x.toFixed(1))}
              onChange={(e) => onUpdateTransform({ x: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">Y</span>
            <input
              type="number"
              step="any"
              value={Number(transform.y.toFixed(1))}
              onChange={(e) => onUpdateTransform({ y: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>
        </div>

        {/* Directional Nudge D-Pad */}
        <div className="flex items-center justify-center pt-1" dir="ltr">
          <div className="grid grid-cols-3 gap-1 w-32">
            <div />
            <button
              onClick={() => onUpdateTransform({ y: Number((transform.y - panelNudgeStep).toFixed(2)) })}
              className="p-1.5 bg-white/5 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/5"
              title="تحريك لأعلى"
            >
              <ChevronUp size={14} />
            </button>
            <div />

            <button
              onClick={() => onUpdateTransform({ x: Number((transform.x - panelNudgeStep).toFixed(2)) })}
              className="p-1.5 bg-white/5 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/5"
              title="تحريك لليسار"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex items-center justify-center text-slate-500 text-[10px]">
              <Crosshair size={12} className="text-indigo-400" />
            </div>
            <button
              onClick={() => onUpdateTransform({ x: Number((transform.x + panelNudgeStep).toFixed(2)) })}
              className="p-1.5 bg-white/5 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/5"
              title="تحريك لليمين"
            >
              <ChevronRight size={14} />
            </button>

            <div />
            <button
              onClick={() => onUpdateTransform({ y: Number((transform.y + panelNudgeStep).toFixed(2)) })}
              className="p-1.5 bg-white/5 hover:bg-indigo-600 text-white rounded-lg transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95 border border-white/5"
              title="تحريك لأسفل"
            >
              <ChevronDown size={14} />
            </button>
            <div />
          </div>
        </div>
      </div>

      {/* Dimensions (W, H) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">الأبعاد (Dimensions)</span>
          <button
            onClick={onToggleAspectLock}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
              aspectRatioLocked
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            {aspectRatioLocked ? <Link size={10} /> : <Unlink size={10} />}
            <span>{aspectRatioLocked ? 'نسبة ثابتة' : 'نسبة حرة'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">W</span>
            <input
              type="number"
              value={Math.round(transform.width)}
              onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 0)}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">H</span>
            <input
              type="number"
              value={Math.round(transform.height)}
              onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 0)}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>
        </div>
      </div>

      {/* Scale X & Scale Y with Flip buttons */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">مقياس التكبير والانعكاس</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleFlipH}
              className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded border border-white/10"
              title="انعكاس أفقي (Flip H)"
            >
              <FlipHorizontal size={12} />
            </button>
            <button
              onClick={handleFlipV}
              className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded border border-white/10"
              title="انعكاس رأسي (Flip V)"
            >
              <FlipVertical size={12} />
            </button>
            <span className="text-[10px] font-mono text-indigo-400 font-bold mr-1">
              {Math.round(Math.abs(transform.scaleX) * 100)}%
            </span>
          </div>
        </div>

        <input
          type="range"
          min="10"
          max="300"
          value={Math.round(Math.abs(transform.scaleX) * 100)}
          onChange={(e) => {
            const sc = parseFloat(e.target.value) / 100;
            const signX = transform.scaleX < 0 ? -1 : 1;
            const signY = transform.scaleY < 0 ? -1 : 1;
            const initW = Math.max(1, layer.initialBounds.width);
            const initH = Math.max(1, layer.initialBounds.height);
            onUpdateTransform({
              scaleX: sc * signX,
              scaleY: sc * signY,
              width: Math.round(initW * sc),
              height: Math.round(initH * sc)
            });
          }}
          className="w-full accent-indigo-500 cursor-pointer"
        />

        <div className="flex gap-1 pt-1">
          {[50, 75, 100, 150, 200].map(p => {
            const sc = p / 100;
            const initW = Math.max(1, layer.initialBounds.width);
            const initH = Math.max(1, layer.initialBounds.height);
            return (
              <button
                key={p}
                onClick={() => onUpdateTransform({
                  scaleX: sc * (transform.scaleX < 0 ? -1 : 1),
                  scaleY: sc * (transform.scaleY < 0 ? -1 : 1),
                  width: Math.round(initW * sc),
                  height: Math.round(initH * sc)
                })}
                className={`flex-1 py-1 rounded-lg text-[9px] font-mono transition-colors ${
                  Math.round(Math.abs(transform.scaleX) * 100) === p
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400'
                }`}
              >
                {p}%
              </button>
            );
          })}
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">زاوية التدوير (Rotation)</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={Math.round(transform.rotation)}
              onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) || 0 })}
              className="w-14 bg-slate-900 border border-white/10 rounded-lg px-2 py-0.5 text-center text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] font-mono text-slate-500">°</span>
          </div>
        </div>

        <input
          type="range"
          min="-180"
          max="180"
          value={Math.round(transform.rotation)}
          onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) })}
          className="w-full accent-purple-500 cursor-pointer"
        />

        <div className="grid grid-cols-4 gap-1">
          {[0, 90, 180, -90].map(deg => (
            <button
              key={deg}
              onClick={() => onUpdateTransform({ rotation: deg })}
              className={`py-1 rounded-lg text-[9px] font-mono transition-colors ${
                Math.round(transform.rotation) === deg
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400'
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">الشفافية (Opacity)</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(transform.opacity)}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(transform.opacity)}
          onChange={(e) => onUpdateTransform({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />
      </div>

      {/* Timeline Active Frame Range Controls */}
      {onUpdateFrameRange && (
        <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-400" />
              <span>نطاق ظهور الطبقة في الفريمات</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">
              F{keyframeSummary.startFrame} → F{keyframeSummary.endFrame}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">فريم البداية:</label>
              <input
                type="number"
                min="0"
                max={(project?.totalFrames || 1) - 1}
                value={keyframeSummary.startFrame}
                onChange={(e) => {
                  const s = Math.max(0, Math.min((project?.totalFrames || 1) - 1, parseInt(e.target.value) || 0));
                  onUpdateFrameRange(s, Math.max(s, keyframeSummary.endFrame));
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-white font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">فريم النهاية:</label>
              <input
                type="number"
                min="0"
                max={(project?.totalFrames || 1) - 1}
                value={keyframeSummary.endFrame}
                onChange={(e) => {
                  const end = Math.max(keyframeSummary.startFrame, Math.min((project?.totalFrames || 1) - 1, parseInt(e.target.value) || 0));
                  onUpdateFrameRange(keyframeSummary.startFrame, end);
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-white font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Timeline Presets */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => onUpdateFrameRange(0, (project?.totalFrames || 1) - 1)}
              className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 rounded-lg font-bold border border-white/5"
            >
              كامل الحركة (0→{(project?.totalFrames || 1) - 1})
            </button>
            <button
              onClick={() => onUpdateFrameRange(currentFrame, currentFrame)}
              className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 rounded-lg font-bold border border-white/5"
            >
              الفريم الحالي (F{currentFrame})
            </button>
          </div>
        </div>
      )}

      {/* SVGA 2.0 Entity Inspection Card */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 space-y-2 text-[10px] font-mono">
        <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-1.5 font-bold">
          <span>بيانات الطبقة في SVGA 2.0:</span>
          <span className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">Protobuf</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-slate-300">
          <div>
            <span className="text-slate-500 block text-[9px]">Image Key:</span>
            <span className="text-white truncate block">{layer.imageKey}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Active Span:</span>
            <span className="text-indigo-300">F{keyframeSummary.startFrame} → F{keyframeSummary.endFrame}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Frames Count:</span>
            <span className="text-white">{layer.framesCount} F</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Matte Mask:</span>
            <span className={layer.matteKey ? 'text-amber-400 font-bold' : 'text-slate-500'}>
              {layer.matteKey || 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
