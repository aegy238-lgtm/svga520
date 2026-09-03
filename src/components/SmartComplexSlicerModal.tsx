import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, 
  Layers, 
  Grid3X3, 
  Crown, 
  GitCommit, 
  X, 
  Check, 
  Sparkles, 
  HelpCircle,
  Maximize2
} from 'lucide-react';
import { DetectedElement } from '../utils/smartImageSegmentation';
import { 
  DecomposeMode, 
  decomposeSymmetricCrest, 
  decomposeBottlenecks, 
  decomposeSmartGrid 
} from '../utils/complexImageSlicer';

interface SmartComplexSlicerModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: HTMLImageElement | null;
  targetElement: DetectedElement | null;
  allElements: DetectedElement[];
  onApplyParts: (newParts: DetectedElement[], replaceOriginalId?: string) => void;
  onSelectKnifeTool: () => void;
  onOpenHelp: (topic: string) => void;
}

export const SmartComplexSlicerModal: React.FC<SmartComplexSlicerModalProps> = ({
  isOpen,
  onClose,
  originalImage,
  targetElement,
  allElements,
  onApplyParts,
  onSelectKnifeTool,
  onOpenHelp
}) => {
  const [selectedMode, setSelectedMode] = useState<DecomposeMode>('crest_symmetric');
  const [gridConfig, setGridConfig] = useState<{ cols: number; rows: number }>({ cols: 2, rows: 2 });
  const [replaceOriginal, setReplaceOriginal] = useState<boolean>(true);
  const [previewParts, setPreviewParts] = useState<DetectedElement[]>([]);
  const [hasPreviewed, setHasPreviewed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  // If no targetElement is specifically selected, apply to whole image or first element
  const boundingBox = targetElement || {
    x: 0,
    y: 0,
    width: originalImage?.naturalWidth || 800,
    height: originalImage?.naturalHeight || 800,
    index: 1,
    label: 'الصورة_الكاملة',
    id: 'whole_image'
  };

  // Run decomposition preview
  const handleGeneratePreview = () => {
    if (!originalImage) return;
    setIsProcessing(true);

    try {
      let parts: DetectedElement[] = [];
      const nextIdx = allElements.length + 1;

      if (selectedMode === 'crest_symmetric') {
        parts = decomposeSymmetricCrest(originalImage, boundingBox, nextIdx);
      } else if (selectedMode === 'bottleneck_valleys') {
        parts = decomposeBottlenecks(originalImage, boundingBox, nextIdx);
      } else if (selectedMode === 'smart_grid_2x2') {
        parts = decomposeSmartGrid(originalImage, boundingBox, 2, 2, nextIdx);
      } else if (selectedMode === 'smart_grid_3x2') {
        parts = decomposeSmartGrid(originalImage, boundingBox, 3, 2, nextIdx);
      } else if (selectedMode === 'smart_grid_3x3') {
        parts = decomposeSmartGrid(originalImage, boundingBox, gridConfig.cols, gridConfig.rows, nextIdx);
      }

      setPreviewParts(parts);
      setHasPreviewed(true);
    } catch (err) {
      console.error('Complex slice error:', err);
      alert('حدث خطأ أثناء تفكيك الصورة المعقدة');
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply parts to canvas
  const handleConfirmApply = () => {
    if (previewParts.length === 0) {
      alert('يرجى أولاً معاينة التفكيك والتحقق من الأجزاء الناتجة');
      return;
    }

    onApplyParts(previewParts, replaceOriginal && targetElement ? targetElement.id : undefined);
    onClose();
  };

  const handleActivateKnife = () => {
    onClose();
    onSelectKnifeTool();
  };

  const MODES_LIST: {
    id: DecomposeMode;
    title: string;
    badge: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }[] = [
    {
      id: 'crest_symmetric',
      title: 'التفكيك التماثلي للأطر والشارات والرتب',
      badge: 'موصى به للأطر مثل Top 1',
      desc: 'يفكك الشارات والأطر المعقدة إلى 5 أجزاء رئيسية: التاج العلوي، الجناح الأيمن، الجناح الأيسر، الإطار المركزي، والشريط السفلي مع تشذيب الشفافية.',
      icon: Crown,
      accent: 'from-amber-500 to-yellow-600'
    },
    {
      id: 'bottleneck_valleys',
      title: 'كسر نقاط التضيّق والوصلات الرفيعة',
      badge: 'للعناصر المتلامسة',
      desc: 'خوارزمية ذكية تكتشف "الأعناق" الضيقة والمناطق المتصلة برباط رفيع وتفصلها تلقائياً عند أضيق نقطة التقاء.',
      icon: GitCommit,
      accent: 'from-cyan-500 to-blue-600'
    },
    {
      id: 'smart_grid_2x2',
      title: 'تقسيم شبكي متوازن 2×2 (4 أرباع)',
      badge: 'تشذيب تلقائي',
      desc: 'يقسم العنصر المعقد إلى 4 أرباع متساوية مع تشذيب تلقائي (Auto-trim) لحواف كل ربع لحذف الفراغات والشفافية الزائدة.',
      icon: Grid3X3,
      accent: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'smart_grid_3x2',
      title: 'تقسيم شبكي ممتد 3 أعمدة × 2 صفوف',
      badge: 'للتصاميم العريضة',
      desc: 'يقسم الصورة إلى 6 خلايا مع تنظيف تلقائي للشفافية، مثالي للأشرطة الممتدة أو الأيقونات المستطيلة ذات الأجنحة.',
      icon: Layers,
      accent: 'from-indigo-500 to-purple-600'
    },
    {
      id: 'smart_grid_3x3',
      title: 'تقسيم شبكي دقيق 3×3 (9 أجزاء)',
      badge: 'عالي الدقة',
      desc: 'يقسم التصميم إلى 9 قطاعات مع التخلص الفوري من القطاعات الفارغة تماماً واحتفاظ الأجزاء الحقيقية فقط.',
      icon: Sparkles,
      accent: 'from-rose-500 to-pink-600'
    }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="bg-[#0b1222] border border-white/10 rounded-3xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 p-[2px]">
                <div className="w-full h-full bg-[#0b1222] rounded-2xl flex items-center justify-center">
                  <Scissors className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    أمر قص وتفكيك الصور المعقدة المتداخلة
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenHelp('complexSlice')}
                    className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] flex items-center justify-center border border-amber-500/40 hover:bg-amber-500/40 transition-colors cursor-pointer"
                    title="شرح ميزة تفكيك الصور المعقدة"
                  >
                    ?
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {targetElement 
                    ? `تفكيك العنصر المحدد رقم ${targetElement.index} (${targetElement.width}×${targetElement.height} px) إلى عناصره المنفصلة`
                    : 'فصل الصورة المعقدة إلى عناصرها الأصلية بدون تداخل'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-right">
            {/* Quick Slicer Knife Option Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">هل تفضل القص اليدوي السريع لخط التداخل؟</h4>
                  <p className="text-[11px] text-slate-300">
                    يمكنك استخدام "سكين القطع الذكي" في الكانفاس لرسم خط قطع مباشر يفصل أي جزء متداخل فوراً.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleActivateKnife}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-md"
              >
                تفعيل سكين القطع ✂️
              </button>
            </div>

            {/* Choose Decomposition Algorithm */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2.5">
                اختر أسلوب التفكيك والقص الذكي المناسب لطبيعة الصورة:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {MODES_LIST.map((mode) => {
                  const Icon = mode.icon;
                  const isSelected = selectedMode === mode.id;

                  return (
                    <div
                      key={mode.id}
                      onClick={() => {
                        setSelectedMode(mode.id);
                        setHasPreviewed(false);
                        setPreviewParts([]);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${mode.accent} p-[1px]`}>
                              <div className="w-full h-full bg-[#0b1222] rounded-lg flex items-center justify-center">
                                <Icon className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                            <span className="text-xs font-bold text-white">{mode.title}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isSelected ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {mode.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed pr-9">
                          {mode.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Options Strip */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={replaceOriginal}
                  onChange={(e) => setReplaceOriginal(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span>استبدال العنصر المتداخل الأصلي بالأجزاء المقصوصة المنفصلة</span>
              </label>

              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isProcessing ? 'جاري التحليل والتفكيك...' : 'معاينة التفكيك الآن'}
              </button>
            </div>

            {/* Preview Results Grid */}
            {hasPreviewed && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <h4 className="text-xs font-bold text-white">
                      الأجزاء المستخرجة الناتجة: ({previewParts.length} عنصر مفصول)
                    </h4>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    جاهز للإضافة والتثبيت في الكانفاس
                  </span>
                </div>

                {previewParts.length === 0 ? (
                  <p className="text-xs text-rose-400 py-3 text-center">
                    لم يتم العثور على أجزاء كافية بهذا الوضع. جرب وضعاً آخر مثل "التقسيم الشبكي" أو استخدم "سكين القطع".
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
                    {previewParts.map((part, pIdx) => (
                      <div
                        key={part.id}
                        className="p-2.5 rounded-xl bg-[#111a2e] border border-white/10 flex flex-col items-center text-center group hover:border-amber-400/50 transition-colors"
                      >
                        <div className="w-full aspect-square bg-[#080d18] rounded-lg mb-2 flex items-center justify-center p-1 border border-white/5 overflow-hidden">
                          {originalImage && (
                            <img
                              src={originalImage.src}
                              alt={part.label}
                              className="max-w-full max-h-full object-contain pointer-events-none"
                              style={{
                                transform: `scale(${Math.min(1, 60 / Math.max(part.width, part.height))})`
                              }}
                            />
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-white truncate max-w-full">
                          {part.label}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {part.width} × {part.height} px
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={previewParts.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                تطبيق واعتماد {previewParts.length} عنصر في الكانفاس
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
