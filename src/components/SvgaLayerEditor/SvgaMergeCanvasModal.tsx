import React, { useState, useMemo, useCallback } from 'react';
import { 
  Layers, 
  Maximize2, 
  Move, 
  AlignCenter, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  X, 
  Sparkles,
  Sliders,
  Expand,
  Minimize,
  Eye,
  CheckSquare
} from 'lucide-react';
import { EditableLayer, SVGAProjectData } from './types';
import { getSelectedLayersBounds, transformSelectedLayers } from './svgaMultiSelectEngine';

interface SvgaMergeCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: SVGAProjectData;
  layers: EditableLayer[];
  onMergeAllLayers: () => Promise<void>;
  onUngroupLayers?: (layerId: string) => void;
  onBulkTransform: (deltas: {
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
  onSelectAllLayers: (allSelected: boolean) => void;
  isMergingLayers: boolean;
  selectedLayerIds: string[];
  setSuccessToast: (msg: string) => void;
}

export const SvgaMergeCanvasModal: React.FC<SvgaMergeCanvasModalProps> = ({
  isOpen,
  onClose,
  project,
  layers,
  onMergeAllLayers,
  onUngroupLayers,
  onBulkTransform,
  onSelectAllLayers,
  isMergingLayers,
  selectedLayerIds,
  setSuccessToast
}) => {
  const [stepSize, setStepSize] = useState<number>(10);
  const [currentScalePercent, setCurrentScalePercent] = useState<number>(100);

  // Identify if layers are already merged
  const isAlreadyMerged = useMemo(() => {
    return layers.length === 1 && Boolean(layers[0].isMerged || (layers[0].mergedLayers && layers[0].mergedLayers.length > 0));
  }, [layers]);

  const mergedMasterLayer = useMemo(() => {
    return layers.find(l => l.isMerged || (l.mergedLayers && l.mergedLayers.length > 0)) || null;
  }, [layers]);

  // Calculate collective bounds for all layers
  const allIds = useMemo(() => layers.map(l => l.id), [layers]);
  const collectiveBounds = useMemo(() => {
    return getSelectedLayersBounds(layers, allIds);
  }, [layers, allIds]);

  // Execute unified merge
  const handleExecuteMerge = async () => {
    try {
      await onMergeAllLayers();
      setSuccessToast('تم دمج كافة الطبقات بنجاح في طبقة رئيسية موحدة يمكنك تحريكها بحرية!');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Quick alignment & fit inside project canvas
  const handleFitToCanvas = useCallback(() => {
    if (!collectiveBounds || collectiveBounds.width <= 0 || collectiveBounds.height <= 0) return;
    const canvasW = project.width || 500;
    const canvasH = project.height || 500;

    // Calculate maximum scale to fit with safe 5% margin
    const targetW = canvasW * 0.95;
    const targetH = canvasH * 0.95;
    const scaleFactor = Math.min(targetW / collectiveBounds.width, targetH / collectiveBounds.height);

    // Apply scale multiplier and center simultaneously
    onBulkTransform({
      scaleMultiplier: Number(scaleFactor.toFixed(4)),
      alignToCanvas: 'centerAll',
      canvasWidth: canvasW,
      canvasHeight: canvasH
    });

    onSelectAllLayers(true);
    setSuccessToast(`تمت ملاءمة وتوسيط الملف بدقة داخل مقاس المشروع (${canvasW}×${canvasH} بكسل)`);
  }, [collectiveBounds, project.width, project.height, onBulkTransform, onSelectAllLayers, setSuccessToast]);

  const handleCenterToCanvas = useCallback(() => {
    onBulkTransform({
      alignToCanvas: 'centerAll',
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
    onSelectAllLayers(true);
    setSuccessToast('تم توسيط الملف في منتصف مقاس المشروع');
  }, [project.width, project.height, onBulkTransform, onSelectAllLayers, setSuccessToast]);

  const handleAlignBottom = useCallback(() => {
    onBulkTransform({
      alignToCanvas: 'bottom',
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
    onSelectAllLayers(true);
    setSuccessToast('تمت محاذاة الملف لأسفل مقاس المشروع (مثالي للتطبيقات وهدايا اللايف)');
  }, [project.width, project.height, onBulkTransform, onSelectAllLayers, setSuccessToast]);

  const handleAlignTop = useCallback(() => {
    onBulkTransform({
      alignToCanvas: 'top',
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
    onSelectAllLayers(true);
    setSuccessToast('تمت محاذاة الملف لأعلى مقاس المشروع');
  }, [project.width, project.height, onBulkTransform, onSelectAllLayers, setSuccessToast]);

  const handleFillCanvas = useCallback(() => {
    if (!collectiveBounds) return;
    const scaleX = (project.width || 500) / Math.max(1, collectiveBounds.width);
    const scaleY = (project.height || 500) / Math.max(1, collectiveBounds.height);

    onBulkTransform({
      scaleMultiplierX: Number(scaleX.toFixed(4)),
      scaleMultiplierY: Number(scaleY.toFixed(4)),
      alignToCanvas: 'centerAll',
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
    onSelectAllLayers(true);
    setSuccessToast('تم ملء كامل أبعاد المشروع بالملف');
  }, [collectiveBounds, project.width, project.height, onBulkTransform, onSelectAllLayers, setSuccessToast]);

  // Nudge movement
  const handleNudge = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    let dx = 0;
    let dy = 0;
    if (dir === 'up') dy = -stepSize;
    if (dir === 'down') dy = stepSize;
    if (dir === 'left') dx = -stepSize;
    if (dir === 'right') dx = stepSize;

    onBulkTransform({
      dx,
      dy,
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
  }, [stepSize, onBulkTransform, project.width, project.height]);

  // Scale delta
  const handleScaleStep = useCallback((multiplier: number) => {
    onBulkTransform({
      scaleMultiplier: multiplier,
      canvasWidth: project.width || 500,
      canvasHeight: project.height || 500
    });
    setCurrentScalePercent(prev => Math.round(prev * multiplier));
  }, [onBulkTransform, project.width, project.height]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div 
        id="svga-merge-canvas-modal"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Layers size={20} className="text-purple-200" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                استوديو دمج وتحريك الطبقات وتحديد مقاس المشروع
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-normal border border-purple-500/30">
                  تحكم موحد
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                دمج كافة الطبقات أو تحريكها جماعياً بعد الشفافية وتحديدها بدقة داخل مقاس المشروع
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status & Project Dimensions Banner */}
          <div className="bg-slate-950/80 border border-purple-500/20 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[11px] text-slate-400 block">مقاس المشروع (الكانفاس)</span>
                <span className="text-sm font-black text-indigo-300 font-mono">
                  {project.width} × {project.height} px
                </span>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div>
                <span className="text-[11px] text-slate-400 block">إجمالي الطبقات</span>
                <span className="text-sm font-black text-white font-mono">
                  {layers.length} {layers.length === 1 ? 'طبقة' : 'طبقات'}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-800" />
              <div>
                <span className="text-[11px] text-slate-400 block">أبعاد الملف الحالية</span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {collectiveBounds ? `${Math.round(collectiveBounds.width)} × ${Math.round(collectiveBounds.height)} px` : 'غير محدد'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onSelectAllLayers(true);
                setSuccessToast('تم تحديد كافة الطبقات ليظهر محدد الأبعاد الموحد على الكانفاس');
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <CheckSquare size={14} className="text-purple-400" />
              <span>تحديد كل الطبقات على الكانفاس</span>
            </button>
          </div>

          {/* Section 1: Master Merge Action */}
          <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="font-bold text-white text-xs">1. دمج كافة الطبقات في طبقة واحدة موحدة (Master Layer)</h3>
              </div>
              {isAlreadyMerged && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Check size={12} />
                  مدمجة بالفعل
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              يدمج جميع فريمات الفيديو أو أنيميشن الـ SVGA والطبقات الشفافة في طبقة رئيسية واحدة، لتتمكن من سحبها بالماوس في أي مكان وتكبيرها وتصغيرها كملف واحد متكامل دون انفصال الطبقات.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExecuteMerge}
                disabled={isMergingLayers || (layers.length < 2 && isAlreadyMerged)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer transition-all disabled:opacity-50"
              >
                <Layers size={15} />
                <span>{isMergingLayers ? 'جاري الدمج...' : isAlreadyMerged ? 'إعادة دمج الطبقات كحزمة موحدة' : 'دمج جميع الطبقات الآن في Layer واحد'}</span>
              </button>

              {isAlreadyMerged && mergedMasterLayer && onUngroupLayers && (
                <button
                  onClick={() => onUngroupLayers(mergedMasterLayer.id)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 font-bold rounded-xl text-xs border border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <RotateCcw size={13} />
                  <span>فك الدمج واستعادة الطبقات المنفصلة</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Quick Project Canvas Fitting & Alignment */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Maximize2 size={16} className="text-indigo-400" />
              <h3 className="font-bold text-white text-xs">2. تحديد وملاءمة الملف داخل مقاس المشروع بنقرة واحدة</h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              يضبط حجم الملف وموضعه تلقائياً ليناسب إطار المشروع بالكامل أو يستقر في المنتصف أو الأسفل بدقة:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={handleFitToCanvas}
                className="p-3 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-200 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group"
                title="ملاءمة كاملة للمقاس مع توسيط آمن"
              >
                <Maximize2 size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>ملاءمة وتوسيط كامل</span>
                <span className="text-[9px] text-slate-400 font-normal">Fit to Canvas</span>
              </button>

              <button
                onClick={handleCenterToCanvas}
                className="p-3 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group"
                title="توسيط الملف في منتصف الشاشة بالضبط"
              >
                <AlignCenter size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
                <span>توسيط في المنتصف</span>
                <span className="text-[9px] text-slate-400 font-normal">Center Exactly</span>
              </button>

              <button
                onClick={handleAlignBottom}
                className="p-3 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group"
                title="محاذاة لأسفل الشاشة (تطبيقات البث وهدايا اللايف)"
              >
                <ArrowDown size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>محاذاة لأسفل المقاس</span>
                <span className="text-[9px] text-slate-400 font-normal">Align Bottom</span>
              </button>

              <button
                onClick={handleFillCanvas}
                className="p-3 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/40 text-amber-200 hover:text-white rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all group"
                title="ملء وتمديد لكامل أبعاد المشروع"
              >
                <Expand size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span>ملء كامل الشاشة</span>
                <span className="text-[9px] text-slate-400 font-normal">Fill Canvas</span>
              </button>
            </div>
          </div>

          {/* Section 3: Fine Interactive Pan & Scale Controls */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Move size={16} className="text-amber-400" />
                <h3 className="font-bold text-white text-xs">3. تحريك دقيق وتكبير/تصغير للملف بالكامل</h3>
              </div>

              {/* Step size selector */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs">
                <span className="text-[10px] text-slate-400">الخطوة:</span>
                {[1, 10, 50].map(sz => (
                  <button
                    key={sz}
                    onClick={() => setStepSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-all ${
                      stepSize === sz ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz}px
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* D-Pad Pan Controller */}
              <div className="flex flex-col items-center justify-center bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 mb-2">أزرار التحريك المباشر في الكانفاس</span>
                <div className="grid grid-cols-3 gap-1.5 w-32">
                  <div />
                  <button
                    onClick={() => handleNudge('up')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all"
                    title="تحريك لأعلى"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <div />

                  <button
                    onClick={() => handleNudge('right')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all"
                    title="تحريك لليمين"
                  >
                    <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={handleCenterToCanvas}
                    className="p-2 bg-purple-900/40 hover:bg-purple-600 active:bg-purple-700 text-purple-200 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all"
                    title="توسيط"
                  >
                    <AlignCenter size={14} />
                  </button>
                  <button
                    onClick={() => handleNudge('left')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all"
                    title="تحريك لليسار"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div />
                  <button
                    onClick={() => handleNudge('down')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all"
                    title="تحريك لأسفل"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <div />
                </div>
              </div>

              {/* Scale Zoom In / Zoom Out Controls */}
              <div className="flex flex-col gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400">التحكم في مقياس وحجم الملف</span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScaleStep(0.9)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    title="تصغير بنسبة 10%"
                  >
                    <Minimize size={14} />
                    <span>تصغير (-10%)</span>
                  </button>
                  <button
                    onClick={() => handleScaleStep(1.1)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 active:bg-purple-600 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                    title="تكبير بنسبة 10%"
                  >
                    <Expand size={14} />
                    <span>تكبير (+10%)</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>المقياس السريع:</span>
                  <div className="flex items-center gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          if (!collectiveBounds) return;
                          const ratio = s / (currentScalePercent / 100);
                          handleScaleStep(ratio);
                        }}
                        className="px-1.5 py-0.5 bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white rounded text-[10px] font-mono cursor-pointer transition-all"
                      >
                        {Math.round(s * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Eye size={14} className="text-purple-400" />
            <span>يمكنك أيضاً سحب الملف بالماوس مباشرة على شاشة الكانفاس في أي وقت.</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 cursor-pointer transition-all"
          >
            تطبيق ومتابعة العمل
          </button>
        </div>
      </div>
    </div>
  );
};
