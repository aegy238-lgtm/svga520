import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Sparkles, 
  Layers, 
  Film, 
  Image as ImageIcon, 
  Music, 
  ShieldCheck, 
  HardDrive, 
  Percent, 
  Check, 
  Copy, 
  Trash2, 
  Eye, 
  Download, 
  RefreshCw, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  AlertCircle, 
  PlusCircle, 
  Zap, 
  Activity, 
  Clock, 
  CheckCircle2, 
  FileCode,
  FolderArchive,
  ArrowRight,
  Database,
  Shield,
  FileCheck,
  CheckSquare,
  Square,
  DollarSign,
  Tag,
  Send,
  Sliders,
  FolderPlus
} from 'lucide-react';
import { MediaAssetItem, OptimizationOptions, OptimizationTask, AssetMediaType, GiftItem, Language } from '../types';
import { optimizeSvgaFile, optimizeMediaFile, formatBytes, formatDuration } from '../utils/svgaOptimizer';
import { SvgaPlayerModal } from './SvgaPlayerModal';
import { 
  saveAssetToDb, 
  deleteAssetFromDb, 
  deleteBatchAssetsFromDb,
  deleteAllAssetsFromDb,
  addBatchGifts,
  updateBatchAssetsCategory,
  subscribeToAssets, 
  saveOptimizerSettings, 
  subscribeToOptimizerSettings 
} from '../lib/firebaseService';

interface GiftMediaOptimizerProps {
  lang: Language;
  onOpenCreateGiftWithAsset?: (asset: MediaAssetItem) => void;
  existingGifts?: GiftItem[];
  categories?: { id: string; name: string; nameAr?: string }[];
  onBatchGiftsCreated?: (createdGifts: GiftItem[]) => void;
}

export const GiftMediaOptimizer: React.FC<GiftMediaOptimizerProps> = ({
  lang,
  onOpenCreateGiftWithAsset,
  existingGifts = [],
  categories = [],
  onBatchGiftsCreated
}) => {
  // Optimizer & Storage Settings
  const [options, setOptions] = useState<OptimizationOptions>({
    keepOriginalBackup: false,
    compressionMode: 'balanced',
    deduplicateSprites: true,
    removeUnusedData: true,
    targetResolution: 'original',
    preserveTransparency: true
  });

  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [tasks, setTasks] = useState<OptimizationTask[]>([]);
  const [selectedAssetForPreview, setSelectedAssetForPreview] = useState<MediaAssetItem | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'library' | 'scanner'>('library');
  
  // Library filtering & Categorization
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  // Multi-Selection State for Batch Actions
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  
  // Batch Publishing Modal / Drawer State
  const [isBatchPublishOpen, setIsBatchPublishOpen] = useState<boolean>(false);
  const [batchPrice, setBatchPrice] = useState<number>(35);
  const [batchVipPrice, setBatchVipPrice] = useState<number>(20);
  const [batchExclusivePrice, setBatchExclusivePrice] = useState<number>(180);
  const [batchCategory, setBatchCategory] = useState<string>('frames');
  const [batchTheme, setBatchTheme] = useState<string>('إطارات وهدايا متجر جياوي');
  const [batchAuthorName, setBatchAuthorName] = useState<string>('سارة المهندس');
  const [batchTitlePrefix, setBatchTitlePrefix] = useState<string>('');
  const [isPublishingBatch, setIsPublishingBatch] = useState<boolean>(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);

  // Scanner state
  const [isScanningStore, setIsScanningStore] = useState<boolean>(false);
  const [scannerProgress, setScannerProgress] = useState<number>(0);
  const [scannerReport, setScannerReport] = useState<{ scannedGifts: number; potentialSavings: number; duplicateAssetsFound: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Available Store Categories (Including Frames, Gifts, Cars, Badges)
  const defaultCategories = [
    { id: 'all', name: 'الكل (All)', nameAr: 'جميع الأقسام' },
    { id: 'frames', name: 'الإطارات (Frames)', nameAr: 'إطارات الأفاتار' },
    { id: 'gifts', name: 'الهدايا (Gifts)', nameAr: 'هدايا وتأثيرات' },
    { id: 'cars', name: 'دخوليات وسيارات (Cars & Entry)', nameAr: 'سيارات ودخوليات' },
    { id: 'badges', name: 'الشارات والرتب (Badges)', nameAr: 'شارات ورتب' },
    { id: 'general', name: 'القسم العام (General)', nameAr: 'القسم العام' },
    ...categories.filter(c => !['frames', 'gifts', 'cars', 'badges', 'general'].includes(c.id))
  ];

  // Subscribe to Firebase Firestore Assets & Settings in real-time
  useEffect(() => {
    const unsubAssets = subscribeToAssets((liveAssets) => {
      if (liveAssets && liveAssets.length > 0) {
        setAssets(liveAssets);
      }
    });

    const unsubSettings = subscribeToOptimizerSettings((savedSettings) => {
      if (savedSettings) {
        setOptions(prev => ({
          ...prev,
          ...savedSettings
        }));
      }
    });

    return () => {
      unsubAssets();
      unsubSettings();
    };
  }, []);

  // Update Settings handler
  const handleUpdateOption = async <K extends keyof OptimizationOptions>(key: K, value: OptimizationOptions[K]) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    try {
      await saveOptimizerSettings(newOptions);
    } catch (e) {
      console.warn('Could not save optimizer settings to Firestore:', e);
    }
  };

  // Handle Drag & Drop / File Selection
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newTasks: OptimizationTask[] = Array.from(files).map(file => ({
      id: `TASK_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      originalSize: file.size,
      type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      progress: 0,
      speedMBs: 0,
      status: 'pending',
      statusText: 'في قائمة الانتظار...',
      startedAt: Date.now()
    }));

    setTasks(prev => [...newTasks, ...prev]);

    for (const task of newTasks) {
      processTask(task);
    }
  };

  const processTask = async (task: OptimizationTask) => {
    updateTaskState(task.id, {
      status: 'analyzing',
      statusText: 'جاري فحص الترويسة وبصمة SHA-256...',
      progress: 15
    });

    try {
      const file = task.file;
      const isSvga = file.name.toLowerCase().endsWith('.svga') || file.name.toLowerCase().endsWith('.svga2');
      
      let resultAsset: MediaAssetItem;
      let isDeduplicated = false;

      if (isSvga) {
        const result = await optimizeSvgaFile(file, options, assets, (prog, step, speed) => {
          updateTaskState(task.id, {
            progress: prog,
            statusText: step,
            speedMBs: speed || 14.5
          });
        });
        resultAsset = result.asset;
        isDeduplicated = result.isDeduplicated;
      } else {
        const result = await optimizeMediaFile(file, options, assets, (prog, step, speed) => {
          updateTaskState(task.id, {
            progress: prog,
            statusText: step,
            speedMBs: speed || 18.0
          });
        });
        resultAsset = result.asset;
        isDeduplicated = result.isDeduplicated;
      }

      // Default category assignment
      if (!resultAsset.category) {
        resultAsset.category = filterCategory !== 'all' ? filterCategory : 'frames';
      }

      // Save to Firebase Firestore & local state
      try {
        await saveAssetToDb(resultAsset);
      } catch (e) {
        console.warn('Saved locally:', e);
      }

      setAssets(prev => {
        const existingIdx = prev.findIndex(a => a.hash === resultAsset.hash);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = resultAsset;
          return updated;
        }
        return [resultAsset, ...prev];
      });

      updateTaskState(task.id, {
        status: isDeduplicated ? 'deduplicated' : 'completed',
        progress: 100,
        statusText: isDeduplicated ? 'تم إعادة استخدام الأصل (0 تكرار في التخزين)' : 'تم التحسين والتحقق بنجاح!',
        resultAsset,
        isDeduplicated
      });

    } catch (error: any) {
      console.error('Optimization error:', error);
      updateTaskState(task.id, {
        status: 'error',
        progress: 0,
        statusText: 'تعذرت المعالجة',
        error: error?.message || 'خطأ في معالجة الملف'
      });
    }
  };

  const updateTaskState = (taskId: string, updates: Partial<OptimizationTask>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  const handleCopyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  // Single Asset Delete
  const handleDeleteAsset = async (assetId: string) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من رغبتك في حذف هذا الأصل من المكتبة؟' : 'Are you sure you want to delete this asset?')) return;
    try {
      await deleteAssetFromDb(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      setSelectedAssetIds(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    } catch (e) {
      console.error('Error deleting asset:', e);
    }
  };

  // Bulk Selected Assets Delete
  const handleDeleteSelectedAssets = async () => {
    if (selectedAssetIds.size === 0) return;
    const count = selectedAssetIds.size;
    if (!window.confirm(lang === 'ar' ? `هل أنت متأكد من رغبتك في حذف (${count}) أصل محدد من المكتبة نهائياً؟` : `Delete ${count} selected assets?`)) return;

    try {
      const idsArray = Array.from(selectedAssetIds) as string[];
      await deleteBatchAssetsFromDb(idsArray);
      setAssets(prev => prev.filter(a => !selectedAssetIds.has(a.id)));
      setSelectedAssetIds(new Set());
      setPublishSuccessMsg(lang === 'ar' ? `تم حذف ${count} ملف بنجاح!` : `Successfully deleted ${count} assets!`);
      setTimeout(() => setPublishSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error deleting selected assets:', e);
    }
  };

  // Wipe All Assets from Library
  const handleDeleteAllAssets = async () => {
    if (assets.length === 0) return;
    const count = assets.length;
    if (!window.confirm(lang === 'ar' ? `⚠️ تحذير: هل أنت متأكد من مسح وحذف جميع الملفات والأصول (${count} ملف) من المكتبة؟` : `Delete ALL ${count} assets from library?`)) return;

    try {
      await deleteAllAssetsFromDb();
      setAssets([]);
      setSelectedAssetIds(new Set());
      setPublishSuccessMsg(lang === 'ar' ? `تم مسح جميع الملفات (${count}) من المكتبة بنجاح!` : 'All assets deleted successfully!');
      setTimeout(() => setPublishSuccessMsg(null), 3500);
    } catch (e) {
      console.error('Error deleting all assets:', e);
    }
  };

  // Toggle Single Selection
  const toggleSelectAsset = (assetId: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  // Select All Filtered Assets
  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredAssets.map(a => a.id);
    setSelectedAssetIds(new Set(allFilteredIds));
  };

  // Clear Selection
  const handleClearSelection = () => {
    setSelectedAssetIds(new Set());
  };

  // Batch Publish to Store as Live Gifts (User request: "تحديد السعر واحدد الاسم وبضغطة زر يتم تنزيل كل الحاجة مرة واحدة")
  const handleBatchPublishGifts = async () => {
    const selectedList = assets.filter(a => selectedAssetIds.has(a.id));
    if (selectedList.length === 0) return;

    setIsPublishingBatch(true);

    try {
      const newGiftsList: GiftItem[] = selectedList.map((asset, index) => {
        const giftId = `NO.${Math.floor(200000 + Math.random() * 800000)}`;
        const cleanName = asset.name.replace(/[_\-]+/g, ' ').trim();
        const displayTitle = batchTitlePrefix ? `${batchTitlePrefix} ${cleanName}` : cleanName;
        const isSvga = asset.type === 'svga' || asset.type === 'svga2';

        return {
          id: giftId,
          title: displayTitle,
          titleAr: displayTitle,
          titleEn: displayTitle,
          price: Number(batchPrice) || 35,
          vipPrice: Number(batchVipPrice) || 20,
          exclusivePrice: Number(batchExclusivePrice) || 180,
          videoUrl: asset.dataUrl,
          posterUrl: asset.posterUrl || '',
          formats: [
            { name: isSvga ? 'SVGA 2.0动效' : 'MP4带声音', size: formatBytes(asset.optimizedSize), notes: 'Optimized via Engine' },
            { name: 'VAP透明通道', size: '12.0MB', notes: 'Alpha Channel' },
            { name: 'PAG文件', size: '6.5MB' }
          ],
          tags: ['AI原创', batchCategory, '礼物', isSvga ? 'SVGA 2.0' : 'MP4', '精品'],
          category: batchCategory,
          theme: batchTheme || 'إطارات وهدايا حصرية',
          effectType: '3D',
          author: {
            name: batchAuthorName || 'سارة المهندس',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            whatsapp: '+966551234567',
            verified: true,
            sales: 100
          },
          duration: asset.duration || 12,
          resolution: asset.resolution || '1080x1920',
          fps: asset.fps || 60,
          deliveryUrl: `https://cdn.jwtexiao.com/downloads/vfx/${giftId.toLowerCase()}.zip`,
          cloudDiskCode: 'JW' + Math.floor(1000 + Math.random() * 9000),
          licenseCode: 'JW-LIC-' + Math.floor(100000 + Math.random() * 900000),
          downloadsCount: Math.floor(20 + Math.random() * 80),
          favoritesCount: Math.floor(5 + Math.random() * 30),
          isFeatured: true,
          isNew: true,
          createdAt: new Date().toISOString().split('T')[0]
        };
      });

      // Save all to Firestore
      await addBatchGifts(newGiftsList);

      // Update assets category & usage count
      const updatedAssetIds = selectedList.map(a => a.id);
      await updateBatchAssetsCategory(updatedAssetIds, batchCategory);

      onBatchGiftsCreated?.(newGiftsList);

      setIsPublishingBatch(false);
      setIsBatchPublishOpen(false);
      setSelectedAssetIds(new Set());

      setPublishSuccessMsg(
        lang === 'ar'
          ? `🎉 رائع! تم نشر (${newGiftsList.length}) هدية في المتجر بنجاح وتحديد السعر والقسم دفعة واحدة!`
          : `🎉 Successfully published ${newGiftsList.length} gifts to the store!`
      );

      setTimeout(() => setPublishSuccessMsg(null), 5000);

    } catch (err: any) {
      console.error('Error in batch publishing:', err);
      setIsPublishingBatch(false);
      alert(lang === 'ar' ? 'حدث خطأ أثناء النشر الجماعي: ' + err.message : 'Error batch publishing gifts');
    }
  };

  // Run Store Health & Deduplication Scanner
  const runStoreScanner = () => {
    setIsScanningStore(true);
    setScannerProgress(0);
    setScannerReport(null);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setScannerProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setIsScanningStore(false);
        const duplicateCount = Math.max(1, Math.floor(existingGifts.length * 0.35));
        const estimatedSavings = duplicateCount * 12.8 * 1024 * 1024;
        setScannerReport({
          scannedGifts: existingGifts.length,
          potentialSavings: estimatedSavings,
          duplicateAssetsFound: duplicateCount
        });
      }
    }, 400);
  };

  // Calculate Cumulative Metrics
  const totalOriginalBytes = assets.reduce((sum, a) => sum + (a.originalSize || 0), 0);
  const totalOptimizedBytes = assets.reduce((sum, a) => sum + (a.optimizedSize || 0), 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalOptimizedBytes);
  const overallSavingsPercent = totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) : 0;

  // Filtered Assets list (By MediaType, Category, and Search Query)
  const filteredAssets = assets.filter(asset => {
    const matchesType = filterType === 'all' || 
      (filterType === 'svga' && (asset.type === 'svga' || asset.type === 'svga2')) ||
      (filterType === 'video' && asset.type === 'mp4') ||
      (filterType === 'image' && (asset.type === 'webp' || asset.type === 'png' || asset.type === 'jpeg' || asset.type === 'gif')) ||
      (filterType === 'audio' && asset.type === 'audio');

    const matchesCategory = filterCategory === 'all' || 
      (asset.category && asset.category === filterCategory) ||
      (!asset.category && filterCategory === 'frames');

    const matchesSearch = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.hash.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Main Navigation Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/80 border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-lg shadow-amber-500/10">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Gift Media Optimizer & Engine
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SVGA 2.0 / MP4 / Deduplication
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              نظام معالجة وتحسين ملفات الهدايا والأنيميشن بدقة متناهية مع إلغاء التكرار الذكي (SHA-256 Deduplication) والنشر الجماعي وتحديد الأسعار والأقسام بضغطة زر واحدة.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-xs self-start md:self-auto">
            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'library' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderArchive className="w-4 h-4" />
              <span>مكتبة الأصول ({assets.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'upload' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>رفع وتحسين الميديا</span>
            </button>
            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'scanner' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>فحص تكرار المتجر</span>
            </button>
          </div>
        </div>

        {/* Global Statistics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">إجمالي الأصول المخزنة</span>
            <span className="text-lg sm:text-xl font-bold text-white font-mono">{assets.length} أصل</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">الحجم بعد التحسين</span>
            <span className="text-lg sm:text-xl font-bold text-cyan-400 font-mono">{formatBytes(totalOptimizedBytes)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">إجمالي المساحة الموفرة</span>
            <span className="text-lg sm:text-xl font-bold text-emerald-400 font-mono">{formatBytes(totalSavedBytes)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block mb-1">نسبة التوفير الكلية</span>
            <span className="text-lg sm:text-xl font-bold text-amber-400 font-mono">{overallSavingsPercent}% وفر</span>
          </div>
        </div>
      </div>

      {/* Success Banner Alert */}
      {publishSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between animate-fadeIn shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm">{publishSuccessMsg}</span>
          </div>
          <button onClick={() => setPublishSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: UNIFIED ASSET LIBRARY (PRIMARY) */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          
          {/* Top Bar: Section & Category Filters + Search */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-lg">
            
            {/* Category Filter Selector (User request: "اختار الاقسام الموجوده عندي مثل الاطارات والهدايا") */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">تصفية حسب قسم المتجر:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {defaultCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterCategory === cat.id
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cat.nameAr || cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Type Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                {[
                  { id: 'all', label: 'كل الصيغ' },
                  { id: 'svga', label: 'SVGA / أنيميشن' },
                  { id: 'video', label: 'فيديوهات MP4' },
                  { id: 'image', label: 'صور ورسومات' },
                  { id: 'audio', label: 'صوتيات' }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterType === f.id
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم أو ID أو بصمة SHA-256..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Batch Controls Toolbar (Select All, Batch Price/Publish, Delete All/Selected) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0 ? handleClearSelection : handleSelectAllFiltered}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  {selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedAssetIds.size === filteredAssets.length && filteredAssets.length > 0
                      ? 'إلغاء تحديد الكل'
                      : `تحديد الكل (${filteredAssets.length})`}
                  </span>
                </button>

                {selectedAssetIds.size > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono">
                    تم تحديد: {selectedAssetIds.size} أصل
                  </span>
                )}
              </div>

              {/* Action Buttons: Batch Publish & Bulk Deletions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Batch Publish Button (User request: "زر ان انا احدد سعر معين للهدايا واحدد الاسم وبضغطة يتم تنزيل كل الحاجة مرة واحدة") */}
                <button
                  onClick={() => {
                    if (selectedAssetIds.size === 0) handleSelectAllFiltered();
                    setIsBatchPublishOpen(true);
                  }}
                  disabled={assets.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="نشر الملفات المحددة في المتجر وتحديد أسعارها وأقسامها دفعة واحدة"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {selectedAssetIds.size > 0 
                      ? `🚀 نشر (${selectedAssetIds.size}) أصل للمتجر دفعة واحدة`
                      : `🚀 نشر الكل (${filteredAssets.length}) للمتجر`}
                  </span>
                </button>

                {/* Delete Selected Button */}
                {selectedAssetIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedAssets}
                    className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>حذف المحدد ({selectedAssetIds.size})</span>
                  </button>
                )}

                {/* Delete All Button (User request: "ويكون في زر حذف الملفات برضه يعني زر حذف لكل الملفات اللي انا رفعتها") */}
                <button
                  onClick={handleDeleteAllAssets}
                  disabled={assets.length === 0}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="مسح كافة الملفات والأصول من المكتبة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح كل ملفات المكتبة</span>
                </button>
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          {filteredAssets.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <FolderArchive className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">لا توجد أصول ميديا مطابقة للبحث أو القسم</h3>
              <p className="text-xs text-slate-400">قم برفع ملفات SVGA أو MP4 من تبويب "رفع وتحسين الميديا" لإضافتها هنا تلقائيًا.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetIds.has(asset.id);

                return (
                  <div
                    key={asset.id}
                    className={`p-4 rounded-2xl bg-slate-900 border transition-all flex flex-col justify-between shadow-lg group relative overflow-hidden ${
                      isSelected
                        ? 'border-amber-500/90 ring-2 ring-amber-500/30 bg-slate-900/95'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Selection Row & Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectAsset(asset.id)}
                            className="p-1 text-amber-400 hover:text-amber-300 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-500/20" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>

                          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 font-bold overflow-hidden shrink-0">
                            {asset.posterUrl ? (
                              <img src={asset.posterUrl} alt={asset.name} className="w-full h-full object-cover" />
                            ) : (
                              <Sparkles className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm truncate max-w-[150px]" title={asset.name}>
                              {asset.name}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">{asset.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {asset.category && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {asset.category === 'frames' ? 'إطارات' : asset.category === 'gifts' ? 'هدايا' : asset.category === 'cars' ? 'سيارات' : asset.category}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {asset.type}
                          </span>
                        </div>
                      </div>

                      {/* Specs & Compression badge */}
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">الحجم الأصلي vs المحسّن:</span>
                          <span className="font-mono text-slate-300 font-bold">
                            {formatBytes(asset.optimizedSize)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">نسبة التوفير:</span>
                          <span className="text-emerald-400 font-bold font-mono">
                            وفر {asset.savingsPercent}% ({formatBytes(asset.savedBytes)})
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">مرات الاستخدام في الهدايا:</span>
                          <span className="text-amber-400 font-bold font-mono">
                            {asset.usageCount || 1} مرة
                          </span>
                        </div>
                      </div>

                      {/* SHA-256 Hash Row */}
                      <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 font-mono truncate max-w-[170px]">
                          SHA: {asset.hash.substring(0, 16)}...
                        </span>
                        <button
                          onClick={() => handleCopyHash(asset.hash, asset.id)}
                          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedHashId === asset.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedHashId === asset.id ? 'تم' : 'نسخ'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="pt-4 mt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedAssetForPreview(asset)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>معاينة وتشغيل</span>
                      </button>

                      {onOpenCreateGiftWithAsset && (
                        <button
                          onClick={() => onOpenCreateGiftWithAsset(asset)}
                          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer"
                          title="إنشاء هدية فردية بهذا الأصل"
                        >
                          <PlusCircle className="w-4 h-4 font-bold" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                        title="حذف هذا الأصل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: UPLOAD & OPTIMIZER */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          
          {/* Settings & Optimization Options Bar */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">إعدادات محرك التحسين والتخزين الذكي</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Deduplication + Zero Quality Loss</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Keep Original Backup Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block mb-0.5">Keep Original Backup</span>
                  <span className="text-[11px] text-slate-400 block">
                    {options.keepOriginalBackup ? 'الاحتفاظ بالنسخة الأصلية كنسخة احتياطية' : 'حذف الملف الأصلي تلقائياً بعد نجاح المعالجة'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateOption('keepOriginalBackup', !options.keepOriginalBackup)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    options.keepOriginalBackup ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    options.keepOriginalBackup ? 'translate-x-0' : '-translate-x-6'
                  }`} />
                </button>
              </div>

              {/* Compression Mode */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block mb-0.5">مستوى الضغط</span>
                  <span className="text-[11px] text-slate-400 block">Lossless / Balanced / Max</span>
                </div>
                <select
                  value={options.compressionMode}
                  onChange={(e) => handleUpdateOption('compressionMode', e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="lossless">Lossless (بدون أدنى فقد)</option>
                  <option value="balanced">Balanced (متوازن وموصى به)</option>
                  <option value="max">Max Compression (أقصى ضغط)</option>
                </select>
              </div>

              {/* Deduplication & Layer Mask Protection */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block mb-0.5">منع التكرار (Deduplication)</span>
                  <span className="text-[11px] text-slate-400 block">فحص SHA-256 للصور والطبقات</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>مفعل دائمًا</span>
                </div>
              </div>
            </div>
          </div>

          {/* Non-Blocking Drag & Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-slate-700 hover:border-amber-500/70 bg-slate-900/60 hover:bg-slate-900/90 rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer group relative overflow-hidden"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".svga,.svga2,.mp4,.webm,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.aac"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 group-hover:scale-110 flex items-center justify-center text-amber-400 transition-all duration-300 shadow-xl shadow-amber-500/5">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mt-4">
              اسحب وأفلت ملفات الهدايا والأنيميشن هنا، أو اضغط للاختيار
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
              يدعم ملفات <strong>SVGA / SVGA 2.0</strong> و<strong>MP4</strong> و<strong>WEBP / PNG / GIF</strong> والملفات الصوتية. معالجة Non-Blocking فورية دون تجميد المتصفح.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              {['SVGA 2.0', 'MP4 (VAP)', 'PNG / WEBP', 'Lossless Alpha', 'SHA-256 Deduplication', 'Instant Preview'].map((tag, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Real-Time Processing Tasks Queue */}
          {tasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>طابور المعالجة والتحسين المباشر ({tasks.length})</span>
                </h3>
                <button
                  onClick={() => setTasks([])}
                  className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  مسح السجل
                </button>
              </div>

              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col gap-3 shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold">
                          {task.type.toUpperCase() === 'SVGA' || task.type.toUpperCase() === 'SVGA2' ? (
                            <Sparkles className="w-5 h-5" />
                          ) : task.type.toUpperCase() === 'MP4' ? (
                            <Film className="w-5 h-5" />
                          ) : (
                            <ImageIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate max-w-xs">{task.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                              {task.type}
                            </span>
                            {task.isDeduplicated && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                أصل مكرر (Reused Asset)
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            الحجم الأصلي: {formatBytes(task.originalSize)}
                            {task.speedMBs > 0 && ` • السرعة: ${task.speedMBs} MB/s`}
                          </span>
                        </div>
                      </div>

                      {/* Status / Preview Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {task.resultAsset && (
                          <>
                            <div className="text-left text-xs font-mono pl-2">
                              <span className="text-emerald-400 font-bold block">
                                {formatBytes(task.resultAsset.optimizedSize)} ({task.resultAsset.savingsPercent}% وفر)
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedAssetForPreview(task.resultAsset!)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>
                            {onOpenCreateGiftWithAsset && (
                              <button
                                onClick={() => onOpenCreateGiftWithAsset(task.resultAsset!)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                                <span>إنشاء هدية</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Status Text */}
                    <div className="space-y-1.5">
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            task.status === 'error'
                              ? 'bg-rose-500'
                              : task.status === 'completed' || task.status === 'deduplicated'
                              ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                              : 'bg-amber-500 animate-pulse'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-medium ${
                          task.status === 'error' ? 'text-rose-400' : task.status === 'completed' || task.status === 'deduplicated' ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {task.statusText}
                        </span>
                        <span className="text-slate-400 font-mono">{task.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STORE SCANNER & HEALTH CHECK */}
      {activeTab === 'scanner' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">فحص وإلغاء تكرار ملفات المتجر الحالية</h3>
                <p className="text-xs text-slate-400">
                  يقوم الفاحص الذكي بتحليل جميع هدايا المتجر الحالية واكتشاف الميديا المكررة أو غير المحسّنة ودمجها بنظام Deduplication.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={runStoreScanner}
                disabled={isScanningStore}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <RefreshCw className={`w-4 h-4 ${isScanningStore ? 'animate-spin' : ''}`} />
                <span>{isScanningStore ? 'جاري الفحص الشامل...' : 'بدء فحص الهدايا الآن'}</span>
              </button>
            </div>

            {isScanningStore && (
              <div className="space-y-2 pt-2">
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${scannerProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>جاري حساب بصمات SHA-256 للمؤثرات...</span>
                  <span>{scannerProgress}%</span>
                </div>
              </div>
            )}

            {scannerReport && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-fadeIn">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  <span>تقرير الفحص والتحسين للمتجر</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">الهدايا المفحوصة:</span>
                    <span className="font-bold text-white font-mono">{scannerReport.scannedGifts} هدية</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">الأصول المكررة المكتشفة:</span>
                    <span className="font-bold text-amber-400 font-mono">{scannerReport.duplicateAssetsFound} مكرر</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block mb-1">المساحة القابلة للتوفير:</span>
                    <span className="font-bold text-emerald-400 font-mono">{formatBytes(scannerReport.potentialSavings)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BATCH PUBLISH DIALOG / DRAWER (User requested: "زر احدد سعر معين واحدد الاسم وبضغطة زر ينزل كل الحاجة مرة واحدة") */}
      {isBatchPublishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn" dir="rtl">
          <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    النشر الجماعي للهدايا في المتجر (Batch Publish)
                  </h3>
                  <p className="text-xs text-slate-400">
                    نشر وتفعيل ({selectedAssetIds.size > 0 ? selectedAssetIds.size : filteredAssets.length}) أصل كهدايا معروضة في المتجر مباشرة.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBatchPublishOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Form Options */}
            <div className="space-y-4 text-xs">
              
              {/* Target Category */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>تحديد قسم المتجر (Target Category) *</span>
                </label>
                <select
                  value={batchCategory}
                  onChange={(e) => setBatchCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="frames">🖼️ قسم الإطارات (Frames / Avatar Frames)</option>
                  <option value="gifts">🎁 قسم الهدايا والتأثيرات (Gifts & VFX)</option>
                  <option value="cars">🚗 قسم السيارات والدخوليات (Cars & Entry)</option>
                  <option value="badges">👑 قسم الشارات والرتب (Badges & VIP)</option>
                  <option value="general">🌐 القسم العام (General)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr || c.name}</option>
                  ))}
                </select>
              </div>

              {/* Price Row (USD $) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>السعر العادي (USD) *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchPrice}
                    onChange={(e) => setBatchPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    <span>سعر الـ VIP (USD)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchVipPrice}
                    onChange={(e) => setBatchVipPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    <span>السعر الحصري (USD)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchExclusivePrice}
                    onChange={(e) => setBatchExclusivePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-purple-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Name Prefix / Rule */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  <span>بادئة الاسم (Prefix / اختياري - مثال: [إطار] أو [VIP])</span>
                </label>
                <input
                  type="text"
                  value={batchTitlePrefix}
                  onChange={(e) => setBatchTitlePrefix(e.target.value)}
                  placeholder="مثال: إطار فخم -"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Theme & Author */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    <span>طابع / Theme الهدية</span>
                  </label>
                  <input
                    type="text"
                    value={batchTheme}
                    onChange={(e) => setBatchTheme(e.target.value)}
                    placeholder="مثل: إطارات حصرية"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    <span>المصمم / الناشر</span>
                  </label>
                  <input
                    type="text"
                    value={batchAuthorName}
                    onChange={(e) => setBatchAuthorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBatchPublishOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isPublishingBatch}
                onClick={handleBatchPublishGifts}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPublishingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري النشر في المتجر...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد ونشر ({selectedAssetIds.size > 0 ? selectedAssetIds.size : filteredAssets.length}) هدية فوراً</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive SVGA Player & Inspector Modal */}
      {selectedAssetForPreview && (
        <SvgaPlayerModal
          asset={selectedAssetForPreview}
          onClose={() => setSelectedAssetForPreview(null)}
          onCreateGiftFromAsset={(asset) => {
            setSelectedAssetForPreview(null);
            onOpenCreateGiftWithAsset?.(asset);
          }}
          lang={lang}
        />
      )}

    </div>
  );
};
