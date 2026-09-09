import React, { useState, useMemo, useCallback } from 'react';
import { 
  Film, ArrowLeft, Search, Filter, Trash2, Download, 
  CheckSquare, Square, RefreshCw, LayoutGrid, List, 
  Archive, ShieldCheck, Sparkles, FolderUp, Check, X, ArrowRightLeft,
  HelpCircle
} from 'lucide-react';
import { AnimationItem, ExportFormat, SupportedFormat } from './types';
import { UploadZone } from './UploadZone';
import { AnimationCard } from './AnimationCard';
import { AnimationPreviewModal } from './AnimationPreviewModal';
import { BatchExportModal } from './BatchExportModal';
import { UnifiedVideoModal } from './UnifiedVideoModal';
import { UniversalConvertModal } from './UniversalConvertModal';
import { DeduplicationAlert } from './DeduplicationAlert';
import { FeatureInfoModal } from './FeatureInfoModal';
import { parseAnimationFile } from './utils/formatParsers';
import { checkDuplicate, deduplicateItems } from './utils/hashUtils';
import { exportItem, downloadBlob } from './utils/exportEngine';

interface AnimationManagerProps {
  onBack: () => void;
}

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';

const MANAGER_INFO_MD = `
# مدير ومحول ملفات الأنيميشن الاحترافي

هذه الأداة الشاملة تتيح لك إدارة، معاينة، وتحويل جميع صيغ الأنيميشن المعقدة والمتقدمة بسهولة تامة.

## الميزات الأساسية:
* **الرفع الذكي:** قم بسحب وإفلات عشرات الملفات دفعة واحدة. يدعم النظام صيغ: GIF, WebP, APNG, PNG Sequences, Lottie, DotLottie, SVGA, و PAG.
* **التحليل التلقائي:** يتم فحص كل ملف تلقائياً لاستخراج الأبعاد (العرض × الطول)، عدد الإطارات (Frames)، ومعدل الإطارات (FPS)، والمدة الزمنية.
* **منع التكرار ذكياً:** يقوم النظام بتحليل بصمة الملفات لمنع رفع نفس الملف مرتين وتوفير المساحة.
* **المعاينة الحية:** اضغط على أي ملف لفتح نافذة المعاينة المتقدمة، حيث يمكنك تشغيل/إيقاف الأنيميشن، التحكم بسرعة العرض، والتنقل بين الإطارات بدقة.
* **البحث والفلترة:** ابحث عن الملفات بالاسم، أو قم بتصفيتها حسب الصيغة، مع إمكانية فرزها (الأحدث، الأقدم، الأكبر حجماً، إلخ).

## الإجراءات المجمعة (Batch Operations):
يمكنك تحديد عدة ملفات أو جميع الملفات لتطبيق الإجراءات التالية:
* **محول الصيغ الشامل:** تحويل جميع الملفات المحددة إلى صيغة موحدة (مثل تحويل كل شيء إلى SVGA أو MP4)، مع التحكم بمستوى الضغط وجودة الاستخراج.
* **إنشاء فيديو MP4 موحد (دمج):** دمج جميع الملفات المحددة في فيديو MP4 واحد، مع خيارات لعرضها بالتسلسل أو في شبكة متجاورة، وإضافة لون أو صورة خلفية.
* **تصدير (ZIP):** ضغط الملفات المحددة وتنزيلها كملف ZIP واحد.

## التعامل مع الصيغ المتقدمة:
* **SVGA & PAG:** يدعم النظام فك تشفير وعرض هذه الملفات المعقدة مباشرة في المتصفح باستخدام محركات متقدمة (WebAssembly و Canvas)، مما يسمح بضغطها وتحويلها دون فقدان جودة المتجهات (Vectors) عند الحاجة.
`;

export const AnimationManager: React.FC<AnimationManagerProps> = ({ onBack }) => {
  const [items, setItems] = useState<AnimationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals state
  const [inspectingItem, setInspectingItem] = useState<AnimationItem | null>(null);
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [isUnifiedVideoOpen, setIsUnifiedVideoOpen] = useState(false);
  const [isUniversalConvertOpen, setIsUniversalConvertOpen] = useState(false);
  const [isManagerInfoOpen, setIsManagerInfoOpen] = useState(false);
  const [preventDuplicates, setPreventDuplicates] = useState(false);

  // Effect to clean up duplicates when toggle is turned on
  React.useEffect(() => {
    if (preventDuplicates) {
      setItems(prev => {
        const unique = deduplicateItems(prev);
        const removedCount = prev.length - unique.length;
        
        if (removedCount > 0) {
          // Find names of removed items for the alert
          const uniqueHashes = new Set(unique.map(i => i.contentHash));
          const removedNames = prev
            .filter(i => !uniqueHashes.has(i.contentHash))
            .map(i => i.file.name)
            // fallback if we just have multiple of the same hash
            .concat(prev.filter((item, index, self) => 
              index !== self.findIndex(t => t.contentHash === item.contentHash)
            ).map(i => i.file.name));

          // deduplicate the names array itself just in case
          const uniqueRemovedNames = Array.from(new Set(removedNames)).slice(0, 5);

          setDuplicatesDetected({
            count: removedCount,
            names: uniqueRemovedNames.length > 0 ? uniqueRemovedNames : ['ملفات مكررة تم تنظيفها']
          });
        }
        
        return unique;
      });
    }
  }, [preventDuplicates]);

  // Duplicate alert state
  const [duplicatesDetected, setDuplicatesDetected] = useState<{
    count: number;
    names: string[];
  }>({ count: 0, names: [] });

  // Handle file uploads with Deduplication Check
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const duplicateNames: string[] = [];
    const validNewFiles: File[] = [];

    // Pre-check for duplicates
    for (const file of files) {
      // Calculate hash & check against current items state
      try {
        const parsed = await parseAnimationFile(file);
        setItems(prevItems => {
          if (preventDuplicates) {
            const dupCheck = checkDuplicate(parsed.contentHash, prevItems);
            if (dupCheck.isDuplicate) {
              duplicateNames.push(file.name);
              return prevItems; // Do not insert duplicate
            }
          }
          return [parsed, ...prevItems];
        });
      } catch (e) {
        console.error('Failed to parse file:', file.name, e);
      }
    }

    if (duplicateNames.length > 0 && preventDuplicates) {
      setDuplicatesDetected({
        count: duplicateNames.length,
        names: duplicateNames
      });
    }

    setIsProcessing(false);
  }, [preventDuplicates]);

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }, [items, selectedIds.size]);

  // Item deletion
  const handleDeleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Batch delete selected
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} ملف محدد؟`)) {
      setItems(prev => prev.filter(item => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
    }
  }, [selectedIds]);

  // Rename item
  const handleRenameItem = useCallback((id: string, newName: string) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, name: newName } : item))
    );
  }, []);

  // Single Quick Export
  const handleQuickExport = useCallback(
    async (item: AnimationItem, format: ExportFormat, options?: any) => {
      try {
        const { blob, filename } = await exportItem(item, format, options);
        downloadBlob(blob, filename);
      } catch (err: any) {
        alert(err?.message || 'فشل في تصدير الملف.');
      }
    },
    []
  );

  // Filter and Sort Items
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter by format
    if (formatFilter !== 'all') {
      result = result.filter(item => item.format === formatFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        item =>
          item.name.toLowerCase().includes(query) ||
          item.originalName.toLowerCase().includes(query) ||
          item.format.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'size_desc':
          return b.size - a.size;
        case 'size_asc':
          return a.size - b.size;
        case 'date_asc':
          return a.createdAt - b.createdAt;
        case 'date_desc':
        default:
          return b.createdAt - a.createdAt;
      }
    });

    return result;
  }, [items, formatFilter, searchQuery, sortBy]);

  const selectedItemsList = useMemo(() => {
    return items.filter(item => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const totalSizeFormatted = useMemo(() => {
    const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
    return totalBytes > 1024 * 1024
      ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalBytes / 1024).toFixed(1)} KB`;
  }, [items]);

  return (
    <div className="w-full flex justify-center pb-24 pt-4 px-4 sm:px-8 font-sans" dir="rtl">
      <div className="max-w-[1600px] w-full flex flex-col gap-8">
        {/* Top Header Navigation */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#0d1322] via-[#0b101c] to-[#070a12] border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer group"
              title="العودة للرئيسية"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Film className="w-6 h-6" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 font-arabic flex items-center gap-2">
                  مدير ومحول ملفات الأنيميشن الاحترافي
                  <button
                    onClick={() => setIsManagerInfoOpen(true)}
                    className="p-1 rounded-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 transition-all ml-2"
                    title="معلومات النظام"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 font-arabic">
                رفع، معاينة حية، إدارة، فحص عدم التكرار، وتصدير بصيغ (GIF, WebP, APNG, PNG, Lottie, DotLottie, MP4)
              </p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* High-Visibility Yellow Deduplication Toggle */}
            <button
              type="button"
              onClick={() => setPreventDuplicates(!preventDuplicates)}
              className={`px-4 py-2 rounded-2xl font-black text-xs font-arabic flex items-center gap-2 border shadow-xl transition-all cursor-pointer ${
                preventDuplicates 
                  ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-yellow-200 shadow-yellow-400/40 ring-2 ring-yellow-400/50' 
                  : 'bg-yellow-400/20 hover:bg-yellow-400 hover:text-slate-950 text-yellow-300 border-yellow-400/60 shadow-yellow-400/20'
              }`}
              title="فحص وحذف الملفات المكررة ومنع تكرار الرفع"
            >
              {preventDuplicates ? (
                <CheckSquare className="w-4 h-4 text-slate-950 stroke-[3]" />
              ) : (
                <Square className="w-4 h-4 text-yellow-300" />
              )}
              <ShieldCheck className="w-4 h-4" />
              <span>{preventDuplicates ? 'منع التكرار: مفعّل (نسخة واحدة فقط)' : 'منع التكرار'}</span>
            </button>

            <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-arabic flex items-center gap-2">
              <span className="text-gray-400">إجمالي الملفات:</span>
              <span className="text-cyan-400 font-bold font-mono">{items.length}</span>
            </div>

            <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs font-arabic flex items-center gap-2">
              <span className="text-gray-400">الحجم الكلي:</span>
              <span className="text-emerald-400 font-bold font-mono">{totalSizeFormatted}</span>
            </div>

            {selectedIds.size > 0 && (
              <div className="px-4 py-2 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-xs font-arabic flex items-center gap-2 animate-pulse">
                <span className="text-cyan-300 font-bold">المحدد للتصدير:</span>
                <span className="text-white font-bold font-mono">{selectedIds.size}</span>
              </div>
            )}
          </div>
        </div>

        {/* Deduplication Alert Notification */}
        {duplicatesDetected.count > 0 && (
          <DeduplicationAlert
            duplicateCount={duplicatesDetected.count}
            duplicateNames={duplicatesDetected.names}
            onDismiss={() => setDuplicatesDetected({ count: 0, names: [] })}
          />
        )}

        {/* Upload Zone */}
        <UploadZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

        {/* Controls Toolbar: Search, Filters, Selection, Sorting, Export */}
        {items.length > 0 && (
          <div className="flex flex-col gap-4 p-5 rounded-3xl bg-[#0a0f1d]/90 border border-white/10 shadow-xl backdrop-blur-md">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث سريع باسم الملف أو الصيغة..."
                  className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-arabic transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Format Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'gif', label: 'GIF' },
                  { id: 'webp', label: 'WebP' },
                  { id: 'apng', label: 'APNG' },
                  { id: 'png', label: 'PNG' },
                  { id: 'lottie', label: 'Lottie' },
                  { id: 'dotlottie', label: 'DotLottie' }
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFormatFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      formatFilter === chip.id
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-bold'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}

                <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>

                <button
                  type="button"
                  onClick={() => setPreventDuplicates(!preventDuplicates)}
                  className={`flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-xl transition-all border shadow-lg cursor-pointer ${
                    preventDuplicates 
                      ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 border-yellow-200 shadow-yellow-400/40 ring-2 ring-yellow-400/50' 
                      : 'bg-yellow-400/20 hover:bg-yellow-400 hover:text-slate-950 text-yellow-300 border-yellow-400/50 shadow-yellow-400/20'
                  }`}
                  title="فحص وحذف الملفات المكررة ذكياً، ومنع تكرار الرفع لأي صيغة"
                >
                  {preventDuplicates ? (
                    <CheckSquare className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-yellow-400" />
                  )}
                  <span>{preventDuplicates ? 'منع التكرار: مفعّل' : 'منع وحذف التكرار'}</span>
                </button>
              </div>

              {/* Sort & View Mode */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-[#070b14] border border-white/10 text-xs text-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400 font-arabic"
                >
                  <option value="date_desc">الأحدث إضافة</option>
                  <option value="date_asc">الأقدم إضافة</option>
                  <option value="name_asc">الاسم (أ - ي)</option>
                  <option value="name_desc">الاسم (ي - أ)</option>
                  <option value="size_desc">الحجم (الأكبر)</option>
                  <option value="size_asc">الحجم (الأصغر)</option>
                </select>

                <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="عرض شبكي"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="عرض مضغوط"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Selection & Batch Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 font-arabic">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition-colors"
                >
                  {selectedIds.size === items.length && items.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500" />
                  )}
                  <span>
                    {selectedIds.size === items.length && items.length > 0
                      ? 'إلغاء تحديد الكل'
                      : 'تحديد جميع الملفات'}
                  </span>
                </button>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف المحدد ({selectedIds.size})</span>
                  </button>
                )}
              </div>

              {/* Action Buttons: Unified MP4 Video, Universal Converter, Batch ZIP */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Unified MP4 Video Button */}
                <button
                  type="button"
                  onClick={() => setIsUnifiedVideoOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-red-500 via-pink-600 to-purple-600 hover:from-red-400 hover:to-pink-500 text-white font-black text-xs shadow-lg shadow-pink-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="دمج كافة الحركات في فيديو MP4 واحد متصل مع ضبط مدة كل حركة"
                >
                  <Film className="w-4 h-4" />
                  <span>إنشاء فيديو MP4 موحد {selectedIds.size > 0 ? `(${selectedIds.size})` : `(الكل: ${items.length})`}</span>
                </button>

                {/* Universal Format Converter (including SVGA) */}
                <button
                  type="button"
                  onClick={() => setIsUniversalConvertOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-600 hover:from-indigo-400 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تحويل أي صيغة إلى SVGA أو MP4 أو GIF أو WebP أو APNG"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>محول الصيغ الشامل (SVGA / MP4 / GIF...)</span>
                </button>

                {/* Batch Export ZIP Button */}
                <button
                  type="button"
                  onClick={() => setIsBatchExportOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تصدير وتحزيم الملفات داخل أرشيف ZIP منظم"
                >
                  <Archive className="w-4 h-4" />
                  <span>تصدير ZIP {selectedIds.size > 0 ? `(${selectedIds.size})` : `(${items.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Grid / List Display */}
        {filteredAndSortedItems.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6'
                : 'flex flex-col gap-3'
            }
          >
            {filteredAndSortedItems.map((item) => (
              <AnimationCard
                key={item.id}
                item={item}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={handleToggleSelect}
                onDelete={handleDeleteItem}
                onRename={handleRenameItem}
                onInspect={(itm) => setInspectingItem(itm)}
                onQuickExport={handleQuickExport}
              />
            ))}
          </div>
        ) : items.length > 0 ? (
          /* Empty search result */
          <div className="flex flex-col items-center justify-center p-12 rounded-3xl bg-[#0a0f1d]/50 border border-white/10 text-center font-arabic">
            <Search className="w-12 h-12 text-gray-500 mb-3" />
            <h4 className="text-lg font-bold text-white mb-1">لا توجد ملفات مطابقة للبحث</h4>
            <p className="text-xs text-gray-400">
              جرب تغيير كلمة البحث أو إعادة تعيين الفلترة لإظهار جميع الملفات.
            </p>
          </div>
        ) : null}

        {/* Single Item Full Inspector Modal */}
        {inspectingItem && (
          <AnimationPreviewModal
            item={inspectingItem}
            onClose={() => setInspectingItem(null)}
            onExport={handleQuickExport}
          />
        )}

        {/* Batch Export ZIP Modal */}
        {isBatchExportOpen && (
          <BatchExportModal
            selectedItems={selectedIds.size > 0 ? selectedItemsList : items}
            onClose={() => setIsBatchExportOpen(false)}
          />
        )}

        {/* Unified Video Creation Modal */}
        {isUnifiedVideoOpen && (
          <UnifiedVideoModal
            items={selectedIds.size > 0 ? selectedItemsList : items}
            onClose={() => setIsUnifiedVideoOpen(false)}
          />
        )}

        {/* Universal Cross-Format Converter Modal */}
        {isUniversalConvertOpen && (
          <UniversalConvertModal
            selectedItems={selectedItemsList}
            allItems={items}
            onClose={() => setIsUniversalConvertOpen(false)}
          />
        )}

        <FeatureInfoModal
          isOpen={isManagerInfoOpen}
          onClose={() => setIsManagerInfoOpen(false)}
          title="معلومات مدير الأنيميشن"
          description={MANAGER_INFO_MD}
        />
      </div>
    </div>
  );
};
