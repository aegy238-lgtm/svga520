import React, { useState } from 'react';
import { 
  Upload, 
  FolderUp, 
  Lock, 
  ShieldCheck, 
  SquareCheck, 
  Trash2, 
  Gift, 
  FileText, 
  Download, 
  Video, 
  Film, 
  Loader2, 
  CheckSquare, 
  Square, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Layers,
  Sliders,
  Check
} from 'lucide-react';

export interface SvgaActionDockProps {
  itemsCount: number;
  selectedCount: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  preventDuplicates: boolean;
  onToggleDeduplication: () => void;
  includePdfCatalog: boolean;
  onToggleIncludePdfCatalog: () => void;
  isZipping: boolean;
  isExporting: boolean;
  isPdfAllInOneExporting: boolean;
  exportProgress: number;
  pdfAllInOneProgress: number;
  vapBatchProgress?: { isOpen: boolean; overallPercent: number } | null;
  onDownloadGiftBundles: () => void;
  onDownloadAllSvgaInOnePdf: () => void;
  onDownloadAllCombined: () => void;
  onDownloadAllSvga: () => void;
  onExportAllVapToMp4: () => void;
  onExportIndividualVideos: () => void;
  onExportGrid: () => void;
  onUploadFiles: () => void;
  onUploadFolders: () => void;
  onExtractFromPdf: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export const SvgaActionDock: React.FC<SvgaActionDockProps> = ({
  itemsCount,
  selectedCount,
  allSelected,
  onSelectAll,
  onClearAll,
  preventDuplicates,
  onToggleDeduplication,
  includePdfCatalog,
  onToggleIncludePdfCatalog,
  isZipping,
  isExporting,
  isPdfAllInOneExporting,
  exportProgress,
  pdfAllInOneProgress,
  vapBatchProgress,
  onDownloadGiftBundles,
  onDownloadAllSvgaInOnePdf,
  onDownloadAllCombined,
  onDownloadAllSvga,
  onExportAllVapToMp4,
  onExportIndividualVideos,
  onExportGrid,
  onUploadFiles,
  onUploadFolders,
  onExtractFromPdf,
  isCollapsed: controlledCollapsed,
  onToggleCollapse
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    const next = !isCollapsed;
    setInternalCollapsed(next);
    if (onToggleCollapse) onToggleCollapse(next);
  };

  const isBusy = isZipping || isExporting || isPdfAllInOneExporting || !!vapBatchProgress?.isOpen;

  return (
    <aside 
      className={`fixed top-24 right-3 sm:right-5 bottom-5 z-40 flex flex-col transition-all duration-300 select-none ${
        isCollapsed ? 'w-16' : 'w-[295px] xl:w-[320px]'
      }`}
      style={{ direction: 'rtl' }}
      aria-label="لوحة التحكم السريعة لملفات SVGA"
    >
      {/* Outer Glow & Glassmorphism Box */}
      <div className="relative flex flex-col h-full bg-slate-950/90 backdrop-blur-2xl border border-white/15 rounded-[2.2rem] shadow-[0_20px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden">
        
        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-400 opacity-80" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-white/[0.03] flex-shrink-0">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 flex-shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xs font-black text-white tracking-wide truncate flex items-center gap-1.5">
                    <span>لوحة العمليات</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 truncate">
                    {itemsCount > 0 ? `${itemsCount} ملف بالمعاينة` : 'بانتظار إضافة ملفات'}
                  </span>
                </div>
              </div>

              {/* Collapse Button */}
              <button
                type="button"
                onClick={handleToggle}
                className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 hover:scale-105"
                title="تصغير اللوحة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleToggle}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-indigo-600/30 hover:scale-110"
                title="توسيع لوحة العمليات"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Body Content */}
        {!isCollapsed ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3.5">
            
            {/* Section 1: Upload & Import */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Upload className="w-3 h-3 text-indigo-400" />
                  <span>الرفع والاستيراد</span>
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500">SVGA / VAP / PDF</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {/* Upload Files */}
                <button
                  type="button"
                  onClick={onUploadFiles}
                  className="col-span-2 group relative overflow-hidden px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl shadow-md shadow-indigo-600/25 font-black text-xs transition-all flex items-center justify-between border border-indigo-400/40 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="رفع ملفات SVGA, VAP, PAG, MP4, ZIP من جهازك"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                    <span>رفع ملفات</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono uppercase tracking-wider">
                    متعدد
                  </span>
                </button>

                {/* Upload Folders */}
                <button
                  type="button"
                  onClick={onUploadFolders}
                  className="px-2.5 py-2 bg-white/5 hover:bg-fuchsia-600/20 text-slate-200 hover:text-white rounded-xl border border-white/10 hover:border-fuchsia-500/40 font-black text-[11px] transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="رفع مجلد كامل بما يحتويه من ملفات"
                >
                  <FolderUp className="w-3.5 h-3.5 text-fuchsia-400" />
                  <span>رفع مجلدات</span>
                </button>

                {/* Extract from PDF */}
                <button
                  type="button"
                  onClick={onExtractFromPdf}
                  className="px-2.5 py-2 bg-gradient-to-r from-amber-600/30 to-rose-600/30 hover:from-amber-600/50 hover:to-rose-600/50 text-amber-200 hover:text-white rounded-xl border border-amber-500/40 font-black text-[11px] transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="استخراج وفك ملفات SVGA من ملفات PDF"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-300" />
                  <span>فك من PDF</span>
                </button>
              </div>
            </div>

            {/* Section 2: Deduplication & Selection */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>الحماية والتحديد</span>
                </span>
                {itemsCount > 0 && (
                  <span className="text-[9px] font-bold text-slate-400">
                    {selectedCount} من {itemsCount} محدد
                  </span>
                )}
              </div>

              {/* Deduplication Card Button */}
              <button
                type="button"
                onClick={onToggleDeduplication}
                className={`w-full p-2.5 rounded-2xl font-black text-xs transition-all flex items-center justify-between shadow-lg border cursor-pointer select-none hover:scale-[1.01] active:scale-[0.99] ${
                  preventDuplicates
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-yellow-200 shadow-yellow-400/30 ring-2 ring-yellow-400/30'
                    : 'bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
                }`}
                title="فحص فوري ومنع تكرار الملفات تلقائياً"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${preventDuplicates ? 'bg-slate-950/20' : 'bg-yellow-400/20'}`}>
                    <ShieldCheck className={`w-4 h-4 ${preventDuplicates ? 'text-slate-950 stroke-[2.5]' : 'text-yellow-400'}`} />
                  </div>
                  <span className="text-right">
                    {preventDuplicates ? 'منع التكرار: مفعّل ✓' : 'منع تكرار الملفات'}
                  </span>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  preventDuplicates ? 'bg-slate-950 border-slate-950 text-yellow-400' : 'border-yellow-400/50 bg-black/20'
                }`}>
                  {preventDuplicates ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Square className="w-3 h-3 opacity-30" />}
                </div>
              </button>

              {/* Select All & Clear All Row */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onSelectAll}
                  disabled={itemsCount === 0}
                  className="px-2.5 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-indigo-300 hover:text-white rounded-xl border border-white/10 font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  <SquareCheck className="w-3.5 h-3.5" />
                  <span>{allSelected && itemsCount > 0 ? 'إلغاء التحديد' : 'تحديد الكل'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={itemsCount === 0}
                  className="px-2.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 text-rose-400 hover:text-rose-300 rounded-xl border border-rose-500/20 font-black text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                  title="مسح جميع الملفات المرفوعة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح الكل</span>
                </button>
              </div>
            </div>

            {/* Section 3: Bundles & PDF Packages */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-rose-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Gift className="w-3 h-3 text-rose-400" />
                  <span>حزم الهدايا والـ PDF</span>
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500">تنزيل مجمع</span>
              </div>

              {/* Download Gift Bundles (ZIP) */}
              <button
                type="button"
                onClick={onDownloadGiftBundles}
                disabled={isBusy || itemsCount === 0}
                className="w-full relative overflow-hidden group px-3.5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl shadow-lg shadow-red-600/30 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 border border-red-400/40 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                title="تنزيل حزم الهدايا (الملف + أحلى صورة للهدية) في ملف ZIP مضغوط"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="leading-tight">
                      {isZipping ? `جاري التحضير ${exportProgress}%` : 'تنزيل حزم الهدايا'}
                    </span>
                    <span className="text-[9px] text-red-200/90 font-normal">الملف + أحلى صورة</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono font-black uppercase tracking-wider">
                  ZIP
                </span>
              </button>

              {/* Include Unified PDF Catalog Toggle */}
              <div
                onClick={onToggleIncludePdfCatalog}
                className={`flex items-center justify-between p-2 px-3 rounded-xl border transition-all cursor-pointer select-none ${
                  includePdfCatalog
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 shadow-md shadow-rose-500/10'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                }`}
                title="تضمين كتالوج PDF موحد لصور الهدايا داخل ملف الـ ZIP"
              >
                <div className="flex items-center gap-2">
                  <FileText className={`w-3.5 h-3.5 ${includePdfCatalog ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold">تضمين كتالوج PDF موحد</span>
                </div>
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                  includePdfCatalog ? 'bg-rose-500 border-rose-400 text-white' : 'border-white/20 bg-black/20'
                }`}>
                  {includePdfCatalog && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>

              {/* All in One PDF Export */}
              <button
                type="button"
                onClick={onDownloadAllSvgaInOnePdf}
                disabled={isBusy || itemsCount === 0}
                className="w-full relative overflow-hidden group px-3.5 py-2.5 bg-gradient-to-r from-amber-600 via-rose-600 to-pink-600 hover:from-amber-500 hover:via-rose-500 hover:to-pink-500 text-white rounded-2xl shadow-lg shadow-rose-600/20 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 border border-rose-400/40 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                title="تنزيل جميع ملفات SVGA في ملف PDF واحد مجمع، يحتوي على كل ملف مع صورته المعاينة وبياناته"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    {isPdfAllInOneExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="leading-tight">
                      {isPdfAllInOneExporting ? `جاري التحضير ${pdfAllInOneProgress}%` : 'ملف PDF واحد موحد'}
                    </span>
                    <span className="text-[9px] text-amber-200/90 font-normal">جميع ملفات SVGA مدمجة</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono font-black uppercase tracking-wider text-amber-200">
                  PDF
                </span>
              </button>

              {/* Download All Files (ZIP) */}
              <button
                type="button"
                onClick={onDownloadAllSvga}
                disabled={isBusy || itemsCount === 0}
                className="w-full px-3 py-2 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded-xl border border-blue-500/40 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                title="تنزيل كل الملفات المرفوعة مع صورها في ملف مضغوط ZIP"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>تنزيل كل الملفات (ZIP)</span>
                </div>
                <span className="text-[10px] opacity-70">أصلية</span>
              </button>

              {/* Combined Bundle Button (All Files + Images + PDF) */}
              <button
                type="button"
                onClick={onDownloadAllCombined}
                disabled={isBusy || itemsCount === 0}
                className="w-full px-3 py-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white rounded-xl border border-emerald-500/40 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                title="تنزيل الكل (الملفات + الصور + كتالوج PDF) في حزمة واحدة"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تنزيل الكل الشامل</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-bold">
                  شامل
                </span>
              </button>
            </div>

            {/* Section 4: Video & Motion Studio */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest flex items-center gap-1.5">
                  <Video className="w-3 h-3 text-violet-400" />
                  <span>استوديو وتصدير الفيديو</span>
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500">MP4 / VAP</span>
              </div>

              {/* VAP to MP4 Fast */}
              <button
                type="button"
                onClick={onExportAllVapToMp4}
                disabled={isBusy || itemsCount === 0}
                className="w-full relative overflow-hidden group px-3.5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl shadow-md shadow-violet-600/25 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 border border-violet-400/40 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                title="تصدير سريع لجميع ملفات VAP إلى فيديو MP4 عالي الجودة مع الصوت والشفافية"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    {vapBatchProgress?.isOpen ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Video className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="leading-tight">
                      {vapBatchProgress?.isOpen ? `VAP (${vapBatchProgress.overallPercent}%)` : 'VAP → MP4 بالصوت'}
                    </span>
                    <span className="text-[9px] text-violet-200/90 font-normal">فائق السرعة</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono font-black uppercase tracking-wider">
                  MP4
                </span>
              </button>

              {/* Export Individual Videos (ZIP) */}
              <button
                type="button"
                onClick={onExportIndividualVideos}
                disabled={isBusy || itemsCount === 0}
                className="w-full px-3 py-2 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl border border-purple-500/40 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                title="تصدير كل ملف فيديو MP4 منفصل وتنزيلهم في ZIP"
              >
                <div className="flex items-center gap-2">
                  <Film className="w-3.5 h-3.5 text-purple-300" />
                  <span>فيديو منفصل لكل ملف (ZIP)</span>
                </div>
                <span className="text-[10px] opacity-70">فردي</span>
              </button>

              {/* Export Grid Video */}
              <button
                type="button"
                onClick={onExportGrid}
                disabled={isBusy || itemsCount === 0}
                className="w-full px-3 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-xl border border-red-500/40 font-black text-xs transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-red-900/20"
                title="تسجيل جميع العناصر المحددة في فيديو واحد كشبكة متزامنة بدقة عالية"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span>تسجيل فيديو مجمع (شاشة موحدة)</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold">
                  Live
                </span>
              </button>
            </div>

          </div>
        ) : (
          /* Collapsed Mini Rail */
          <div className="flex-1 flex flex-col items-center justify-start py-3 gap-2 overflow-y-auto no-scrollbar">
            {/* Upload Files icon */}
            <button
              type="button"
              onClick={onUploadFiles}
              className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-110"
              title="رفع ملفات"
            >
              <Upload className="w-4 h-4" />
            </button>

            {/* Folder Upload icon */}
            <button
              type="button"
              onClick={onUploadFolders}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-fuchsia-600/30 text-fuchsia-400 flex items-center justify-center transition-all border border-white/10 cursor-pointer hover:scale-110"
              title="رفع مجلدات"
            >
              <FolderUp className="w-4 h-4" />
            </button>

            {/* Extract PDF icon */}
            <button
              type="button"
              onClick={onExtractFromPdf}
              className="w-10 h-10 rounded-2xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 flex items-center justify-center transition-all border border-amber-500/30 cursor-pointer hover:scale-110"
              title="فك واستخراج من PDF"
            >
              <Lock className="w-4 h-4" />
            </button>

            <div className="w-6 h-px bg-white/10 my-1" />

            {/* Deduplication icon */}
            <button
              type="button"
              onClick={onToggleDeduplication}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
                preventDuplicates ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/40 ring-2 ring-yellow-400/50' : 'bg-white/5 text-yellow-400 border border-white/10'
              }`}
              title={preventDuplicates ? 'منع التكرار: مفعّل' : 'تفعيل منع التكرار'}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Select All */}
            <button
              type="button"
              onClick={onSelectAll}
              disabled={itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/15 text-indigo-300 flex items-center justify-center transition-all border border-white/10 cursor-pointer disabled:opacity-30 hover:scale-110"
              title="تحديد الكل / إلغاء التحديد"
            >
              <SquareCheck className="w-4 h-4" />
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={onClearAll}
              disabled={itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-all border border-rose-500/20 cursor-pointer disabled:opacity-30 hover:scale-110"
              title="مسح الكل"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="w-6 h-px bg-white/10 my-1" />

            {/* Gift Bundles */}
            <button
              type="button"
              onClick={onDownloadGiftBundles}
              disabled={isBusy || itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-30 hover:scale-110"
              title="تنزيل حزم الهدايا ZIP"
            >
              {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            </button>

            {/* PDF One File */}
            <button
              type="button"
              onClick={onDownloadAllSvgaInOnePdf}
              disabled={isBusy || itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-pink-600 hover:from-amber-500 hover:to-pink-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-30 hover:scale-110"
              title="تنزيل في ملف PDF واحد"
            >
              {isPdfAllInOneExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </button>

            {/* Download all files */}
            <button
              type="button"
              onClick={onDownloadAllSvga}
              disabled={isBusy || itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-30 hover:scale-110"
              title="تنزيل كل الملفات ZIP"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* VAP to MP4 */}
            <button
              type="button"
              onClick={onExportAllVapToMp4}
              disabled={isBusy || itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-30 hover:scale-110"
              title="VAP إلى MP4"
            >
              <Video className="w-4 h-4" />
            </button>

            {/* Export Grid */}
            <button
              type="button"
              onClick={onExportGrid}
              disabled={isBusy || itemsCount === 0}
              className="w-10 h-10 rounded-2xl bg-slate-900 border border-red-500/50 text-red-400 flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-30 hover:scale-110"
              title="تسجيل فيديو مجمع"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            </button>
          </div>
        )}

        {/* Footer Info / Status Strip */}
        {!isCollapsed && (
          <div className="p-2.5 px-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>لوحة ثابتة لا تتحرك</span>
            </span>
            <span className="text-[9px] font-mono text-slate-500">v2.5 High-Speed</span>
          </div>
        )}
      </div>
    </aside>
  );
};
