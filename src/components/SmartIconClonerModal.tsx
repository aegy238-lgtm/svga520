import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Copy, Check, Download, Layers, Sparkles, Sliders, Palette, 
  ArrowRight, RefreshCw, Eye, Hash, ShieldCheck, ChevronRight, CheckCircle2,
  FileSpreadsheet, FileCode
} from 'lucide-react';
import JSZip from 'jszip';
import { DetectedElement } from '../utils/smartImageSegmentation';
import { 
  IconLabelConfig, 
  DEFAULT_LABEL_CONFIG,
  CloneDistributionRule,
  ClonedIconItem,
  generateClonedIconsSequence,
  renderClonedIconCanvas,
  generateTextListForCopy,
  GRADIENT_PRESETS,
  GradientPresetKey
} from '../utils/smartIconLabelingEngine';

interface SmartIconClonerModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: DetectedElement[];
  originalImage: HTMLImageElement | null;
  baseLabelConfig: IconLabelConfig;
  onApplyClonedElements?: (clonedItems: ClonedIconItem[]) => void;
}

export const SmartIconClonerModal: React.FC<SmartIconClonerModalProps> = ({
  isOpen,
  onClose,
  elements,
  originalImage,
  baseLabelConfig,
  onApplyClonedElements
}) => {
  // State
  const [targetCount, setTargetCount] = useState<number>(200);
  const [startNumber, setStartNumber] = useState<number>(0);
  const [step, setStep] = useState<number>(1);
  const [paddingDigits, setPaddingDigits] = useState<number>(0);
  const [distributionMode, setDistributionMode] = useState<'tier_block' | 'cyclic' | 'single'>('tier_block');
  const [batchSize, setBatchSize] = useState<number>(20); // Switch icon every 20 numbers
  const [selectedSingleIndex, setSelectedSingleIndex] = useState<number>(0);

  // Custom Tier Rules
  const [tierRules, setTierRules] = useState<CloneDistributionRule[]>([]);
  
  // Copying feedback
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Preview Pagination / Filtering
  const [activeTab, setActiveTab] = useState<'preview' | 'rules' | 'export'>('preview');
  const [previewPage, setPreviewPage] = useState<number>(0);
  const pageSize = 40;

  // Generate Rules whenever elements, targetCount, distributionMode, or batchSize changes
  useEffect(() => {
    if (elements.length === 0) return;

    if (distributionMode === 'tier_block') {
      const rules: CloneDistributionRule[] = [];
      const numTiers = Math.ceil(targetCount / batchSize);
      const gradientKeys: GradientPresetKey[] = ['gold', 'silver', 'platinum', 'ruby', 'emerald', 'royal_blue', 'cyber_neon', 'fire'];

      for (let t = 0; t < numTiers; t++) {
        const fromNum = startNumber + t * batchSize;
        const toNum = Math.min(startNumber + (t + 1) * batchSize - 1, startNumber + targetCount - 1);
        const sourceIdx = t % elements.length;
        const gradKey = gradientKeys[t % gradientKeys.length];

        rules.push({
          id: `rule-${t}`,
          sourceElementIndex: sourceIdx,
          fromNumber: fromNum,
          toNumber: toNum,
          gradientPreset: gradKey,
          hueShift: 0,
          brightness: 100,
          contrast: 100
        });
      }
      setTierRules(rules);
    } else if (distributionMode === 'single') {
      setTierRules([{
        id: 'rule-single',
        sourceElementIndex: Math.min(selectedSingleIndex, elements.length - 1),
        fromNumber: startNumber,
        toNumber: startNumber + targetCount - 1,
        gradientPreset: baseLabelConfig.gradientPreset
      }]);
    } else {
      setTierRules([]);
    }
  }, [elements, targetCount, startNumber, distributionMode, batchSize, selectedSingleIndex, baseLabelConfig.gradientPreset]);

  // Compute Items
  const clonedItems = useMemo<ClonedIconItem[]>(() => {
    if (elements.length === 0) return [];
    return generateClonedIconsSequence(
      elements,
      targetCount,
      startNumber,
      step,
      { ...baseLabelConfig, paddingDigits, startNumber },
      distributionMode === 'cyclic' ? undefined : tierRules
    );
  }, [elements, targetCount, startNumber, step, baseLabelConfig, paddingDigits, distributionMode, tierRules]);

  // Handle Copy to Clipboard
  const handleCopyText = async (format: 'numbers_only' | 'filenames' | 'comma_separated' | 'json') => {
    const text = generateTextListForCopy(clonedItems, format);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 3000);
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  // Handle ZIP Export
  const handleExportZip = async () => {
    if (!originalImage || clonedItems.length === 0) return;

    setIsExportingZip(true);
    setExportProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder(`Icons_Sequence_${targetCount}`);

      // Render canvases in chunks
      const tempCanvas = document.createElement('canvas');

      for (let i = 0; i < clonedItems.length; i++) {
        const item = clonedItems[i];
        renderClonedIconCanvas(originalImage, item, baseLabelConfig, tempCanvas);

        const dataUrl = tempCanvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        folder?.file(item.filename, base64Data, { base64: true });

        if (i % 10 === 0 || i === clonedItems.length - 1) {
          setExportProgress(Math.round(((i + 1) / clonedItems.length) * 100));
          await new Promise(r => setTimeout(r, 0)); // yield loop
        }
      }

      // Add text manifest file
      const manifestContent = generateTextListForCopy(clonedItems, 'filenames');
      folder?.file('manifest.txt', manifestContent);

      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setExportProgress(Math.round(metadata.percent));
      });

      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Icons_Cloned_${targetCount}_Items.zip`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('ZIP export error:', e);
    } finally {
      setIsExportingZip(false);
      setExportProgress(0);
    }
  };

  if (!isOpen) return null;

  const currentTiers = distributionMode === 'tier_block' ? tierRules : [];
  const paginatedItems = clonedItems.slice(previewPage * pageSize, (previewPage + 1) * pageSize);
  const totalPages = Math.ceil(clonedItems.length / pageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        id="icon-cloner-modal"
        className="bg-[#0b1222] border border-white/15 rounded-3xl w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col shadow-2xl overflow-hidden text-white"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                نظام مضاعفة وتوليد الأيقونات الذكي
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                  {targetCount} أيقونة
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                توليد ومضاعفة أشكال الأيقونات تلقائياً مع ترقيم متسلسل من 0 وتدرجات ألوان حسب المستويات.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left / Primary Sidebar: Configuration */}
          <div className="w-80 md:w-96 border-l border-white/10 bg-[#090e1a]/95 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-5 space-y-6">
            
            {/* Section 1: Target Count & Numbering */}
            <div className="space-y-4">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-cyan-400" />
                العدد الإجمالي المطلوب والترقيم
              </span>

              {/* Target Count Presets */}
              <div className="space-y-2">
                <label className="text-[11px] text-slate-400 flex justify-between">
                  <span>العدد المستهدف (Target Count):</span>
                  <span className="font-mono text-cyan-300 font-bold">{targetCount} أيقونة</span>
                </label>
                
                <div className="grid grid-cols-4 gap-1.5">
                  {[50, 100, 200, 500].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setTargetCount(cnt)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        targetCount === cnt
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 border border-cyan-400'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">تخصيص:</span>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={targetCount}
                    onChange={e => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:border-cyan-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              {/* Start Number & Padding */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">يبدأ من الرقم:</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
                    <input
                      type="number"
                      value={startNumber}
                      onChange={e => setStartNumber(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-transparent text-xs font-mono font-bold text-white focus:outline-none text-center"
                    />
                  </div>
                  <span className="text-[10px] text-emerald-400">الافتراضي: 0</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">أصفار البادئة (Pad):</label>
                  <select
                    value={paddingDigits}
                    onChange={e => setPaddingDigits(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value={0} className="bg-[#0b1222]">بدون (0, 1, 2...)</option>
                    <option value={2} className="bg-[#0b1222]">خانة ثنائية (00, 01...)</option>
                    <option value={3} className="bg-[#0b1222]">خانة ثلاثية (000, 001...)</option>
                    <option value={4} className="bg-[#0b1222]">خانة رباعية (0000...)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Distribution Strategy */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                طريقة توزيع ونسخ الأشكال المكتشفة
              </span>

              <div className="space-y-2">
                {[
                  {
                    id: 'tier_block',
                    title: 'توزيع بنطاقات ومستويات (مثال: كل 20 رقم شكل)',
                    desc: 'يقوم بتبديل شكل الأيقونة ولون التدرج كل عدد محدد من الأرقام'
                  },
                  {
                    id: 'cyclic',
                    title: 'تناوب دوري متتالي (1, 2, 3, 1, 2, 3...)',
                    desc: 'تكرار الأشكال بالتسلسل الدائري المستمر'
                  },
                  {
                    id: 'single',
                    title: 'تكرار شكل واحد فقط لكافة الأرقام',
                    desc: 'نسخ أيقونة واحدة محددة لجميع الأرقام الـ ' + targetCount
                  }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setDistributionMode(mode.id as any)}
                    className={`w-full p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                      distributionMode === mode.id
                        ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{mode.title}</span>
                      {distributionMode === mode.id && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{mode.desc}</p>
                  </button>
                ))}
              </div>

              {/* Tier Size Slider if tier_block mode */}
              {distributionMode === 'tier_block' && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">تبديل الشكل كل:</span>
                    <span className="font-mono text-cyan-300 font-bold">{batchSize} أيقونة</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[10, 20, 25, 50].map(sz => (
                      <button
                        key={sz}
                        onClick={() => setBatchSize(sz)}
                        className={`py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                          batchSize === sz
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={batchSize}
                    onChange={e => setBatchSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400">
                    عدد المستويات المحسوبة: {Math.ceil(targetCount / batchSize)} مستوى
                  </p>
                </div>
              )}

              {/* Single shape selector */}
              {distributionMode === 'single' && elements.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400">اختر الشكل المراد نسخه:</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {elements.map((el, idx) => (
                      <button
                        key={el.id}
                        onClick={() => setSelectedSingleIndex(idx)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedSingleIndex === idx
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                        }`}
                      >
                        <span className="text-xs font-mono font-bold">الشكل #{idx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Copy Text & Names Functions */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Copy className="w-4 h-4 text-emerald-400" />
                نسخ قائمة الأرقام والأسماء (Clipboard)
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                انسخ جميع النصوص أو أرقام الأيقونات الـ {clonedItems.length} بنقرة واحدة لاستخدامها في الألعاب أو التطبيقات:
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopyText('numbers_only')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'numbers_only' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>قائمة الأرقام</span>
                </button>
                <button
                  onClick={() => handleCopyText('filenames')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'filenames' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>أسماء الملفات</span>
                </button>
                <button
                  onClick={() => handleCopyText('comma_separated')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'comma_separated' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>مفصولة بفواصل</span>
                </button>
                <button
                  onClick={() => handleCopyText('json')}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5 text-amber-400" />}
                  <span>مصفوفة JSON</span>
                </button>
              </div>

              {copiedFormat && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>تم نسخ {clonedItems.length} نص بنجاح للحافظة!</span>
                </div>
              )}
            </div>

            {/* Section 4: Export ZIP Button */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleExportZip}
                disabled={isExportingZip || clonedItems.length === 0}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExportingZip ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>جاري التصدير ({exportProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-black" />
                    <span>تصدير حزمة الـ {targetCount} أيقونة (ZIP)</span>
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Right Main Content: Interactive Preview Grid & Tiers */}
          <div className="flex-1 flex flex-col bg-[#0b1222] overflow-hidden">
            
            {/* Top Toolbar in Content */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">
                  معاينة الأيقونات المولدة:
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/20">
                  {clonedItems.length} عنصر
                </span>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    صفحة {previewPage + 1} من {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                      disabled={previewPage === 0}
                      className="p-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold disabled:opacity-30 cursor-pointer"
                    >
                      السابق
                    </button>
                    <button
                      onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={previewPage >= totalPages - 1}
                      className="p-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold disabled:opacity-30 cursor-pointer"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable Preview Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
                {paginatedItems.map((item) => (
                  <ClonedIconCard
                    key={item.index}
                    item={item}
                    originalImage={originalImage}
                    baseConfig={baseLabelConfig}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Status & Info Bar */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>الترقيم يبدأ من <strong>{startNumber}</strong> ويصل إلى <strong>{startNumber + targetCount - 1}</strong> بتسلسل فوري 100%.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onApplyClonedElements) {
                      onApplyClonedElements(clonedItems);
                    }
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تطبيق وإغلاق</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

interface ClonedIconCardProps {
  item: ClonedIconItem;
  originalImage: HTMLImageElement | null;
  baseConfig: IconLabelConfig;
}

const ClonedIconCard: React.FC<ClonedIconCardProps> = ({ item, originalImage, baseConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!originalImage || !canvasRef.current) return;
    renderClonedIconCanvas(originalImage, item, baseConfig, canvasRef.current);
  }, [originalImage, item, baseConfig]);

  return (
    <div className="flex flex-col items-center p-2 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/50 hover:bg-white/[0.06] transition-all group">
      <div className="w-full aspect-square flex items-center justify-center p-1 relative overflow-hidden rounded-xl bg-black/40">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain drop-shadow-md"
        />
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono font-bold text-slate-300">
          #{item.targetNumber}
        </div>
      </div>
      <div className="w-full mt-2 text-center">
        <span className="text-[11px] font-mono font-bold text-white block truncate">
          {item.computedLabel}
        </span>
        <span className="text-[9px] text-slate-400 font-mono block truncate">
          {item.filename}
        </span>
      </div>
    </div>
  );
};
