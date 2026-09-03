import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  X, 
  Download, 
  Check, 
  Layers, 
  Grid, 
  Sun, 
  Moon, 
  CheckSquare, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { DetectedElement } from '../utils/smartImageSegmentation';
import { generatePdfCatalog, PdfCatalogOptions } from '../utils/pdfCatalogGenerator';

interface SmartCropperPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: HTMLImageElement | null;
  elements: DetectedElement[];
  selectedCount: number;
  imageFileName?: string;
  onOpenHelp: (topicId: any) => void;
}

export const SmartCropperPdfModal: React.FC<SmartCropperPdfModalProps> = ({
  isOpen,
  onClose,
  originalImage,
  elements,
  selectedCount,
  imageFileName = 'Smart_Crops',
  onOpenHelp
}) => {
  // Modal State
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [itemsPerPage, setItemsPerPage] = useState<12 | 20 | 30>(20);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [customTitle, setCustomTitle] = useState<string>('دليل وفهرس العناصر المقصوصة');
  
  // Export Progress State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const targetItems = scope === 'selected' 
    ? elements.filter(e => e.selected) 
    : elements;

  const totalPages = Math.ceil(targetItems.length / itemsPerPage);

  const handleStartExport = async () => {
    if (!originalImage) {
      alert('لم يتم تحميل الصورة الأصلية بعد');
      return;
    }
    if (targetItems.length === 0) {
      alert('لا توجد عناصر مختارة لتصديرها في ملف الـ PDF');
      return;
    }

    setIsGenerating(true);
    setProgressPercent(0);
    setProgressStatus('جاري تهيئة محرك توليد الـ PDF عالي الدقة...');

    try {
      const pdfBlob = await generatePdfCatalog(originalImage, targetItems, {
        documentTitle: customTitle.trim() || 'دليل وفهرس العناصر المقصوصة',
        fileName: `${imageFileName.replace(/\.[^/.]+$/, '')}_Catalog_${targetItems.length}_items.pdf`,
        itemsPerPage,
        showDimensions,
        theme,
        onProgress: (pct, msg) => {
          setProgressPercent(pct);
          setProgressStatus(msg);
        }
      });

      // Trigger browser download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${imageFileName.replace(/\.[^/.]+$/, '')}_Sequential_Catalog_${targetItems.length}_items.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setProgressPercent(100);
      setProgressStatus('تم تجهيز وتحميل ملف الـ PDF بنجاح!');
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert(err?.message || 'حدث خطأ أثناء إنشاء ملف الـ PDF');
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0b1222] border border-white/10 rounded-3xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-600 p-[2px]">
                <div className="w-full h-full bg-[#0b1222] rounded-2xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-rose-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    تصدير كتالوج PDF احترافي
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenHelp('exportPdf')}
                    className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] flex items-center justify-center border border-cyan-500/40 hover:bg-cyan-500/40 transition-colors cursor-pointer"
                    title="شرح ميزة تصدير الـ PDF"
                  >
                    ?
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  حفظ العناصر بنفس الترتيب التسلسلي من 1 إلى {targetItems.length} بوضوح فائق وبدون أرقام وهمية
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isGenerating}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            
            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="text-xs font-black text-white flex items-center justify-between">
                <span>نطاق العناصر المراد تصديرها:</span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {targetItems.length} عنصر
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                    scope === 'all'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>كافة العناصر المكتشفة</span>
                    {scope === 'all' && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {elements.length} عنصر بالترتيب من 1 إلى {elements.length}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  disabled={selectedCount === 0}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                    scope === 'selected'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : selectedCount === 0
                      ? 'bg-white/[0.01] border-white/5 text-slate-600 cursor-not-allowed'
                      : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>العناصر المحددة فقط</span>
                    {scope === 'selected' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">
                    {selectedCount} عنصر محدد
                  </div>
                </button>
              </div>
            </div>

            {/* Grid Layout Configuration */}
            <div className="space-y-2">
              <label className="text-xs font-black text-white flex items-center justify-between">
                <span>تنسيق الصفحة وعدد العناصر:</span>
                <span className="text-[11px] font-mono text-slate-400">
                  {totalPages > 0 ? `${totalPages} صفحة (A4)` : '0'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { count: 12, label: '12 عنصراً', sub: '3×4 حجم كبير للشارات' },
                  { count: 20, label: '20 عنصراً', sub: '4×5 مقاس قياسي مثالي' },
                  { count: 30, label: '30 عنصراً', sub: '5×6 مكثف للشيتات الكبيرة' }
                ].map(opt => (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setItemsPerPage(opt.count as any)}
                    className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      itemsPerPage === opt.count
                        ? 'bg-cyan-600/20 border-cyan-500 text-white'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Document Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-white">
                عنوان الكتالوج / المستند:
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="مثال: دليل الشارات والأيقونات"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Visual Options: Theme & Dimensions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Theme */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">مظهر الصفحات:</label>
                <div className="flex bg-white/5 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>فاتح (ناصع للطباعة)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      theme === 'dark' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-cyan-300" />
                    <span>ليلي (داكن)</span>
                  </button>
                </div>
              </div>

              {/* Show Dimensions */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300">بيانات المقاسات:</label>
                <button
                  type="button"
                  onClick={() => setShowDimensions(!showDimensions)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    showDimensions
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <span>إظهار أبعاد البكسل (px)</span>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                    showDimensions ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-white/20'
                  }`}>
                    {showDimensions && <Check className="w-3 h-3" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Quality and Guarantee Notice */}
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-white">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>نظام الترقيم الاحترافي الصارم (1 إلى {targetItems.length})</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                يتم فرز العناصر من أعلى اليسار إلى أسفل اليمين وفق نظام القراءة، ويُطبع رقم تسلسلي بارز فوق كل جزء (1، 2، 3...) بدون أي أرقام وهمية أو مكررة لضمان ترتيب مثالي.
              </p>
            </div>

            {/* Live Progress Bar when generating */}
            {isGenerating && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">{progressStatus}</span>
                  <span className="font-bold text-cyan-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 via-indigo-500 to-cyan-400 transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleStartExport}
              disabled={isGenerating || targetItems.length === 0}
              className="flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-600 via-indigo-600 to-teal-600 hover:from-rose-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <span>بدء إنشاء وتحميل ملف الـ PDF ({targetItems.length} عنصر)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
