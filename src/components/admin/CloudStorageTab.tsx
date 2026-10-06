import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, HardDrive, UploadCloud, RefreshCw, Search, Filter, 
  ExternalLink, Copy, Check, Trash2, Download, Eye, AlertTriangle, 
  CheckCircle2, XCircle, FileText, Image as ImageIcon, Video, 
  Music, Film, Sparkles, FolderLock, ShieldCheck, Play, Pause,
  Layers, ArrowUpDown, ChevronLeft, ChevronRight, X, AlertCircle,
  FileSpreadsheet, Link, Eraser, HardDriveDownload, FileDown, CheckCheck
} from 'lucide-react';
import { 
  MegaStorageRecord, MegaStorageStats, MegaSettings, 
  MegaConnectionTestResult, MegaUploadProgress, MegaFileCategory 
} from '../../types';
import { 
  fetchStorageFiles, fetchStorageStats, fetchStorageSettings, 
  updateStorageSettings, testMegaConnection, uploadToMegaStorage, deleteStorageFile, 
  fetchStorageLinks, triggerServerStorageClean, batchDeleteFiles,
  formatBytes, getCategoryLabel 
} from '../../services/megaStorageService';

export const CloudStorageTab: React.FC = () => {
  // Stats & Settings
  const [stats, setStats] = useState<MegaStorageStats | null>(null);
  const [settings, setSettings] = useState<MegaSettings | null>(null);
  const [folderUrlInput, setFolderUrlInput] = useState('');
  const [folderNameInput, setFolderNameInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Files List State
  const [files, setFiles] = useState<MegaStorageRecord[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'uploadedAt' | 'fileSize' | 'downloadCount'>('uploadedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Upload State
  const [uploadProgress, setUploadProgress] = useState<MegaUploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test Connection State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<MegaConnectionTestResult | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);

  // Modals & Feedback
  const [previewFile, setPreviewFile] = useState<MegaStorageRecord | null>(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<MegaStorageRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active view subtab: 'files' | 'links_center' | 'cleanup' | 'settings'
  const [subTab, setSubTab] = useState<'files' | 'links_center' | 'cleanup' | 'settings'>('files');

  // Links Center State
  const [linksData, setLinksData] = useState<{
    links: Array<{
      id: string;
      fileId: string;
      fileName: string;
      fileSize: number;
      category: string;
      mimeType: string;
      uploadedAt: string;
      uploaderName: string;
      downloadUrl: string;
      megaUrl: string;
    }>;
    formattedText: string;
    rawDownloadLinksText: string;
    rawMegaLinksText: string;
    totalFiles: number;
    totalSizeBytes: number;
  } | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linksSearch, setLinksSearch] = useState('');
  const [linksCategoryFilter, setLinksCategoryFilter] = useState('all');
  const [copiedLinksType, setCopiedLinksType] = useState<string | null>(null);
  const [linksTextViewMode, setLinksTextViewMode] = useState<'formatted' | 'direct' | 'mega'>('formatted');
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  // Server Cleanup State
  const [cleanLocalCache, setCleanLocalCache] = useState(true);
  const [cleanUploadsDir, setCleanUploadsDir] = useState(true);
  const [clearRecords, setClearRecords] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{
    success: boolean;
    freedBytes: number;
    deletedDiskFilesCount: number;
    preservedLinksCount: number;
    remainingFilesCount: number;
    cleanedLocations: string[];
    exportedLinks: any[];
    message: string;
  } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, settingsRes, filesRes] = await Promise.all([
        fetchStorageStats().catch(() => null),
        fetchStorageSettings().catch(() => null),
        fetchStorageFiles({
          search: searchQuery,
          category: selectedCategory,
          page,
          limit: 15,
          sortBy,
          sortOrder
        }).catch(() => ({ files: [], total: 0, page: 1, limit: 15, totalPages: 1 }))
      ]);

      if (statsRes) setStats(statsRes);
      if (settingsRes) {
        setSettings(settingsRes);
        setFolderUrlInput(settingsRes.folderUrl || '');
        setFolderNameInput(settingsRes.folderName || '');
      }
      if (filesRes) {
        setFiles(filesRes.files || []);
        setTotalFiles(filesRes.total || 0);
        setTotalPages(filesRes.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Error loading cloud storage data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLinksData = async () => {
    setLoadingLinks(true);
    try {
      const res = await fetchStorageLinks();
      setLinksData(res);
    } catch (err: any) {
      console.error('Error fetching storage links:', err);
      showNotification('فشل تحميل قائمة الروابط: ' + err.message, 'error');
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleCopyLinks = async (type: 'formatted' | 'direct' | 'mega') => {
    if (!linksData) return;
    let textToCopy = '';
    if (type === 'formatted') textToCopy = linksData.formattedText;
    else if (type === 'direct') textToCopy = linksData.rawDownloadLinksText;
    else if (type === 'mega') textToCopy = linksData.rawMegaLinksText;

    if (!textToCopy) {
      showNotification('لا توجد روابط لنسخها حالياً', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedLinksType(type);
      showNotification(
        type === 'formatted' 
          ? 'تم نسخ جميع الروابط والمعلومات منسقة بنجاح إلى الحافظة! 📋' 
          : type === 'direct' 
            ? 'تم نسخ الروابط المباشرة فقط إلى الحافظة! 🔗' 
            : 'تم نسخ روابط MEGA إلى الحافظة! ☁️',
        'success'
      );
      setTimeout(() => setCopiedLinksType(null), 3000);
    } catch (e) {
      showNotification('فشل النسخ إلى الحافظة', 'error');
    }
  };

  const handleDownloadLinksFile = () => {
    if (!linksData || !linksData.formattedText) {
      showNotification('لا توجد روابط لتنزيلها', 'error');
      return;
    }
    const blob = new Blob([linksData.formattedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server_files_links_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('تم تنزيل ملف الروابط (TXT) بنجاح!', 'success');
  };

  const handleDownloadLinksCsv = () => {
    if (!linksData || !linksData.links || linksData.links.length === 0) {
      showNotification('لا توجد بيانات لإنشاء ملف CSV', 'error');
      return;
    }
    const headers = ['رقم', 'اسم الملف', 'الحجم (بايت)', 'الحجم منسق', 'القسم', 'نوع الملف', 'المرفوع بواسطة', 'تاريخ الرفع', 'رابط التنزيل المباشر', 'رابط MEGA'];
    const rows = linksData.links.map((l, idx) => [
      idx + 1,
      `"${(l.fileName || '').replace(/"/g, '""')}"`,
      l.fileSize,
      `"${formatBytes(l.fileSize)}"`,
      `"${l.category}"`,
      `"${l.mimeType}"`,
      `"${(l.uploaderName || '').replace(/"/g, '""')}"`,
      `"${l.uploadedAt}"`,
      `"${l.downloadUrl}"`,
      `"${l.megaUrl || ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `server_files_links_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('تم تنزيل جدول الروابط (CSV / Excel) بنجاح!', 'success');
  };

  const handleBatchDownloadAllFiles = async () => {
    if (!linksData || !linksData.links || linksData.links.length === 0) {
      showNotification('لا توجد ملفات لتنزيلها', 'error');
      return;
    }
    if (batchDownloading) return;

    setBatchDownloading(true);
    showNotification('بدء تنزيل الملفات تباعاً إلى جهازك...', 'success');

    for (let i = 0; i < linksData.links.length; i++) {
      const item = linksData.links[i];
      setBatchDownloadProgress({
        current: i + 1,
        total: linksData.links.length,
        name: item.fileName
      });
      try {
        const a = document.createElement('a');
        a.href = item.downloadUrl;
        a.download = item.fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.warn('Batch download error for item:', item.fileName, e);
      }
    }

    setBatchDownloading(false);
    setBatchDownloadProgress(null);
    showNotification('اكتمل تنزيل جميع الملفات بنجاح!', 'success');
  };

  const handleExecuteServerClean = async () => {
    const confirmMsg = clearRecords
      ? 'تحذير هام: اخترت حذف السجلات أيضاً! سيتم تنظيف قرص السيرفر وحذف السجلات من الداشبورد. هل تريد المتابعة بالتأكيد؟'
      : 'سيتم الآن تنظيف الملفات المؤقتة وكاش السيرفر لتحرير مساحة الهاردسك مع الاحتفاظ بجميع روابط الملفات المسجلة. هل تريد المتابعة؟';

    if (!window.confirm(confirmMsg)) return;

    setIsCleaning(true);
    setCleanResult(null);
    try {
      const res = await triggerServerStorageClean({
        cleanLocalCache,
        cleanUploadsDir,
        clearRecords
      });
      setCleanResult(res);
      showNotification(res.message, 'success');
      await Promise.all([loadData(true), loadLinksData()]);
    } catch (err: any) {
      console.error('Cleanup error:', err);
      showNotification('حدث خطأ أثناء تنظيف السيرفر: ' + err.message, 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!folderUrlInput.trim()) {
      showNotification('يرجى إدخال رابط صالح لمجلد MEGA', 'error');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await updateStorageSettings({
        folderUrl: folderUrlInput.trim(),
        folderName: folderNameInput.trim() || undefined
      });
      if (res.success) {
        setSettings(res.settings);
        showNotification(res.message || 'تم حفظ وتحديث رابط مجلد MEGA بنجاح!', 'success');
      }
    } catch (err: any) {
      showNotification(err.message || 'فشل حفظ إعدادات المجلد', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetDefaultFolder = async () => {
    const defaultUrl = 'https://mega.nz/folder/ZAEVwBAR#eCpPGWnnzvZRaNXoJleO9g';
    setFolderUrlInput(defaultUrl);
    setSavingSettings(true);
    try {
      const res = await updateStorageSettings({
        folderUrl: defaultUrl,
        folderName: '1112ed / cache'
      });
      if (res.success) {
        setSettings(res.settings);
        showNotification('تم استعادة رابط المجلد الافتراضي بنجاح', 'success');
      }
    } catch (err: any) {
      showNotification(err.message || 'فشل استعادة الرابط الافتراضي', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, selectedCategory, sortBy, sortOrder]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadData(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showNotification('تم نسخ الرابط إلى الحافظة بنجاح!');
  };

  const handleRunTest = async () => {
    setTestingConnection(true);
    setShowTestModal(true);
    setTestResult(null);

    try {
      const res = await testMegaConnection();
      setTestResult(res);
      // Reload settings to update live status
      const updatedSettings = await fetchStorageSettings().catch(() => null);
      if (updatedSettings) setSettings(updatedSettings);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'حدث خطأ غير متوقع أثناء الفحص: ' + err.message,
        provider: 'MEGA',
        timestamp: new Date().toISOString()
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadToMegaStorage(
        file,
        {
          sourceFeature: 'dashboard_storage_tab',
          userName: 'مدير النظام'
        },
        (p) => setUploadProgress(p)
      );

      showNotification(
        result.isDuplicate 
          ? `الملف (${file.name}) متطابق ومخزن مسبقاً في الكاش (تم منع التكرار بنجاح)!` 
          : `تم رفع وتخزين (${file.name}) على خادم MEGA بنجاح!`,
        'success'
      );

      // Refresh list & stats immediately
      loadData(true);
    } catch (err: any) {
      showNotification(err.message || 'فشل رفع الملف', 'error');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(null), 3000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUpload(file);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmFile) return;
    setDeleting(true);
    try {
      const ok = await deleteStorageFile(deleteConfirmFile.id);
      if (ok) {
        showNotification(`تم حذف الملف (${deleteConfirmFile.fileName}) من التخزين وسجل البيانات بنجاح.`);
        setDeleteConfirmFile(null);
        loadData(true);
      } else {
        showNotification('تعذر حذف الملف المطلوب.', 'error');
      }
    } catch (err: any) {
      showNotification('خطأ أثناء الحذف: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'svga': return <Layers className="w-5 h-5 text-amber-400" />;
      case 'vap': return <Film className="w-5 h-5 text-purple-400" />;
      case 'video': return <Video className="w-5 h-5 text-blue-400" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-emerald-400" />;
      case 'audio': return <Music className="w-5 h-5 text-pink-400" />;
      case 'animation': return <Sparkles className="w-5 h-5 text-indigo-400" />;
      default: return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 text-slate-200" dir="rtl">
      {/* Toast Notification */}
      {actionNotice && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border animate-in fade-in slide-in-from-top-4 ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30' 
            : 'bg-rose-950/90 text-rose-200 border-rose-500/30'
        }`}>
          {actionNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400 shadow-inner">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-wide">Cloud Storage / Cache</h1>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                MEGA Cloud v2.0
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              نظام التخزين السحابي المركزي والكاش الذكي لجميع ملفات الموقع والوسائط مع منع التكرار وتوليد روابط التنزيل المباشرة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtabs Toggle */}
          <div className="bg-slate-950/60 p-1 rounded-xl border border-white/10 flex flex-wrap items-center text-xs sm:text-sm font-medium gap-1">
            <button
              onClick={() => setSubTab('files')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'files'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>ملفات التخزين ({totalFiles})</span>
            </button>
            <button
              onClick={() => {
                setSubTab('links_center');
                loadLinksData();
              }}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'links_center'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Copy className="w-4 h-4 text-emerald-300" />
              <span>مركز الروابط والنسخ 📋</span>
            </button>
            <button
              onClick={() => {
                setSubTab('cleanup');
                loadLinksData();
              }}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'cleanup'
                  ? 'bg-rose-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trash2 className="w-4 h-4 text-rose-300" />
              <span>تنظيف السيرفر 🧹</span>
            </button>
            <button
              onClick={() => setSubTab('settings')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                subTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderLock className="w-4 h-4" />
              <span>إعدادات MEGA والفحص</span>
            </button>
          </div>

          <button
            onClick={() => {
              loadData(true);
              if (subTab === 'links_center' || subTab === 'cleanup') {
                loadLinksData();
              }
            }}
            disabled={refreshing || loadingLinks}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-xl transition-all text-slate-300 hover:text-white disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loadingLinks ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Analytics & Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Files */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">إجمالي الملفات</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white">{stats?.totalFiles || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">ملف مسجل في الكاش</div>
          </div>
        </div>

        {/* Total Storage Space */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">المساحة المستخدمة</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-300">{formatBytes(stats?.totalSizeBytes || 0)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">حجم البيانات الكلي</div>
          </div>
        </div>

        {/* Today's Uploads */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">ملفات اليوم</span>
            <UploadCloud className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-cyan-300">{stats?.todayUploads || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">عمليات رفع اليوم</div>
          </div>
        </div>

        {/* Total Uploads */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">عمليات الرفع</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-300">{stats?.totalUploads || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">إجمالي الطلبات</div>
          </div>
        </div>

        {/* Total Downloads */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">عمليات التنزيل</span>
            <Download className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-300">{stats?.totalDownloads || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">تنزيل مباشر</div>
          </div>
        </div>

        {/* Duplicates Prevented */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">الملفات المكررة</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-300">{stats?.duplicatesPrevented || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">تم توفيرها بالكاش الذكي</div>
          </div>
        </div>

        {/* Failed Uploads */}
        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">فشل الرفع</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-300">{stats?.failedUploads || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">محاولات غير ناجحة</div>
          </div>
        </div>
      </div>

      {/* Quick Action Banner for Server Cleanup & Links Center */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-rose-950/40 p-4 sm:p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <Copy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>نظام استخراج الروابط وتنظيف مساحة السيرفر</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-normal">
                جاهز بنقرة واحدة
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              استخرج جميع روابط الملفات لنسخها دفعة واحدة أو تنزيلها إلى جهازك، ونظف مساحة قرص السيرفر بأمان بدون فقدان أي رابط.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => { setSubTab('links_center'); loadLinksData(); }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <Copy className="w-4 h-4" />
            <span>استعراض ونسخ كافة الروابط</span>
          </button>
          <button
            onClick={() => { setSubTab('cleanup'); loadLinksData(); }}
            className="flex-1 md:flex-none px-4 py-2.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>تنظيف السيرفر الآن</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Files View */}
      {subTab === 'files' && (
        <div className="space-y-6">
          {/* Direct Cloud Uploader Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
              dragOver 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-white/15 bg-slate-900/40 hover:border-white/30 hover:bg-slate-900/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              id="cloud-storage-file-input"
            />

            <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
              <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-3">
                <UploadCloud className="w-10 h-10 animate-bounce" />
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                رفع يدوي مباشر إلى MEGA Cloud Storage
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                اسحب وأفلت أي ملف هنا (SVGA, VAP, MP4, PNG, WebP, Audio) أو اضغط لاختيار ملف من جهازك.
                سيتم فحص الـ Hash تلقائياً وتخزينه في مجلد الكاش المخصص.
              </p>

              {/* Progress Bar when uploading */}
              {uploadProgress && (
                <div className="w-full bg-slate-950/80 p-4 rounded-xl border border-indigo-500/30 mb-4 text-right">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="text-indigo-300">{uploadProgress.message}</span>
                    <span className="text-white font-mono">{uploadProgress.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    />
                  </div>
                  {uploadProgress.fileName && (
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      الملف: {uploadProgress.fileName}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 flex items-center gap-2"
              >
                <UploadCloud className="w-4 h-4" />
                <span>اختيار ملف للرفع</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & Sorting Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-white/10">
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم، معرف الملف، Hash، المستخدم..."
                className="w-full pr-10 pl-4 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Badges Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 custom-scrollbar">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'svga', label: 'SVGA' },
                { id: 'vap', label: 'VAP' },
                { id: 'video', label: 'فيديو' },
                { id: 'image', label: 'صور' },
                { id: 'audio', label: 'صوت' },
                { id: 'animation', label: 'أنيميشن' },
                { id: 'other', label: 'أخرى' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="uploadedAt">التاريخ</option>
                <option value="fileSize">الحجم</option>
                <option value="downloadCount">عدد التنزيلات</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white border border-white/10"
                title={sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Files Table */}
          <div className="bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
                <p className="text-sm text-slate-400">جاري تحميل سجل ملفات التخزين السحابي...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="py-16 text-center">
                <HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-white">لا توجد ملفات مخزنة حالياً</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  لم يتم العثور على أي ملفات مطابقة للبحث أو الفلتر المحدد. يمكنك استخدام خانة الرفع أعلاه لبدء تخزين الملفات على خادم MEGA.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/70 border-b border-white/10 text-slate-400 uppercase text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">الملف</th>
                      <th className="py-3 px-3">النوع</th>
                      <th className="py-3 px-3">الحجم</th>
                      <th className="py-3 px-3">المستخدم / المصدر</th>
                      <th className="py-3 px-3">تاريخ الرفع</th>
                      <th className="py-3 px-3">حالة التخزين</th>
                      <th className="py-3 px-3">التنزيلات</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {files.map((file) => (
                      <tr key={file.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* File Name & Icon */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-800/80 rounded-lg border border-white/5 flex-shrink-0">
                              {getCategoryIcon(file.category)}
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <div className="font-semibold text-white truncate" title={file.originalName || file.fileName}>
                                {file.originalName || file.fileName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate" title={file.hash}>
                                Hash: {file.hash?.substring(0, 12)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {getCategoryLabel(file.category)}
                          </span>
                        </td>

                        {/* Size */}
                        <td className="py-3 px-3 font-mono whitespace-nowrap text-slate-300">
                          {formatBytes(file.fileSize)}
                        </td>

                        {/* User & Source */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-white font-medium">{file.uploadedBy.userName || 'مستخدم'}</div>
                          <div className="text-[10px] text-slate-500">{file.sourceFeature || 'رفع يدوي'}</div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                          {new Date(file.uploadedAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>

                        {/* Storage Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {file.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              كاش متطابق
                            </span>
                          ) : file.status === 'active' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              سحابي MEGA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              كاش محلي
                            </span>
                          )}
                        </td>

                        {/* Downloads count */}
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {file.downloadCount || 0}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Preview */}
                            <button
                              onClick={() => setPreviewFile(file)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                              title="معاينة الملف"
                            >
                              <Eye className="w-4 h-4 text-cyan-400" />
                            </button>

                            {/* Direct Download */}
                            <a
                              href={file.downloadUrl}
                              download
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                              title="تنزيل مباشر"
                            >
                              <Download className="w-4 h-4 text-emerald-400" />
                            </a>

                            {/* Copy MEGA Link */}
                            <button
                              onClick={() => handleCopy(file.megaUrl, `mega_${file.id}`)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                              title="نسخ رابط MEGA"
                            >
                              {copiedId === `mega_${file.id}` ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ExternalLink className="w-4 h-4 text-indigo-400" />
                              )}
                            </button>

                            {/* Copy Download Link */}
                            <button
                              onClick={() => handleCopy(`${window.location.origin}${file.downloadUrl}`, `dl_${file.id}`)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors"
                              title="نسخ رابط التنزيل المباشر"
                            >
                              {copiedId === `dl_${file.id}` ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-purple-400" />
                              )}
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => setDeleteConfirmFile(file)}
                              className="p-1.5 hover:bg-rose-950/50 rounded-lg text-slate-400 hover:text-rose-400 transition-colors"
                              title="حذف الملف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
                <div>
                  عرض الصفحة <span className="text-white font-bold">{page}</span> من أصل <span className="text-white font-bold">{totalPages}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Links Center View (استخراج ونسخ وتنزيل روابط الملفات) */}
      {subTab === 'links_center' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Action Card */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950/60 p-6 rounded-2xl border border-emerald-500/30 shadow-2xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl">
                    <Copy className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    مركز نسخ واستخراج روابط ملفات السيرفر
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {linksData?.totalFiles || 0} رابط متاح
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  يمكنك هنا نسخ جميع روابط التنزيل دفعة واحدة للحافظة، أو تصديرها كملف TXT / CSV، أو تنزيل جميع الملفات إلى جهازك بنقرة واحدة.
                </p>
              </div>

              {/* Bulk Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCopyLinks('formatted')}
                  disabled={loadingLinks || !linksData || linksData.totalFiles === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="نسخ جميع الروابط منسقة مع البيانات"
                >
                  {copiedLinksType === 'formatted' ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLinksType === 'formatted' ? 'تم النسخ بنجاح!' : 'نسخ جميع الروابط (منسقة)'}</span>
                </button>

                <button
                  onClick={() => handleCopyLinks('direct')}
                  disabled={loadingLinks || !linksData || linksData.totalFiles === 0}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all border border-white/10 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="نسخ الروابط المباشرة فقط كقائمة نصية"
                >
                  {copiedLinksType === 'direct' ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4 text-cyan-400" />}
                  <span>{copiedLinksType === 'direct' ? 'تم نسخ المباشرة!' : 'نسخ الروابط المباشرة فقط'}</span>
                </button>

                <button
                  onClick={handleDownloadLinksFile}
                  disabled={loadingLinks || !linksData || linksData.totalFiles === 0}
                  className="px-3.5 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="تنزيل قائمة الروابط في ملف TXT"
                >
                  <FileText className="w-4 h-4" />
                  <span>تنزيل (TXT)</span>
                </button>

                <button
                  onClick={handleDownloadLinksCsv}
                  disabled={loadingLinks || !linksData || linksData.totalFiles === 0}
                  className="px-3.5 py-2 bg-teal-600/80 hover:bg-teal-600 text-white rounded-xl text-xs font-medium transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="تنزيل جدول Excel / CSV"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير (CSV)</span>
                </button>

                <button
                  onClick={handleBatchDownloadAllFiles}
                  disabled={batchDownloading || loadingLinks || !linksData || linksData.totalFiles === 0}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  title="تنزيل كافة الملفات إلى جهازك تباعاً"
                >
                  {batchDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />}
                  <span>{batchDownloading ? 'جاري التنزيل...' : 'تنزيل الكل لجهازي'}</span>
                </button>
              </div>
            </div>

            {/* Batch Download Progress Toast */}
            {batchDownloadProgress && (
              <div className="bg-purple-950/60 p-3.5 rounded-xl border border-purple-500/40 text-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  <div>
                    <span className="font-semibold text-white">جاري تنزيل الملف {batchDownloadProgress.current} من {batchDownloadProgress.total}: </span>
                    <span className="text-purple-300 font-mono">{batchDownloadProgress.name}</span>
                  </div>
                </div>
                <span className="font-bold text-white">{Math.round((batchDownloadProgress.current / batchDownloadProgress.total) * 100)}%</span>
              </div>
            )}

            {/* Quick Copy Text Box (Preview & Copy Area) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-2">
                  <span>معاينة ونسخ النص السريع:</span>
                  <div className="bg-slate-950 p-0.5 rounded-lg border border-white/10 flex items-center text-[11px]">
                    <button
                      onClick={() => setLinksTextViewMode('formatted')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        linksTextViewMode === 'formatted' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      منسق مع البيانات
                    </button>
                    <button
                      onClick={() => setLinksTextViewMode('direct')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        linksTextViewMode === 'direct' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      الروابط المباشرة فقط
                    </button>
                    <button
                      onClick={() => setLinksTextViewMode('mega')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        linksTextViewMode === 'mega' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      روابط MEGA
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleCopyLinks(linksTextViewMode)}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ هذا المحتوى</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  rows={6}
                  value={
                    loadingLinks 
                      ? 'جاري استخراج وتحميل جميع الروابط من السيرفر...' 
                      : linksTextViewMode === 'formatted'
                        ? linksData?.formattedText || 'لا توجد ملفات مرفوعة حالياً في السيرفر.'
                        : linksTextViewMode === 'direct'
                          ? linksData?.rawDownloadLinksText || 'لا توجد روابط مباشرة حالياً.'
                          : linksData?.rawMegaLinksText || 'لا توجد روابط MEGA متوفرة.'
                  }
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-y custom-scrollbar"
                />
              </div>
            </div>
          </div>

          {/* Interactive Links Table */}
          <div className="bg-slate-900/60 rounded-2xl border border-white/10 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Link className="w-4 h-4 text-emerald-400" />
                <span>قائمة تفاصيل الروابط القابلة للنسخ والتنزيل</span>
              </h3>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={linksSearch}
                    onChange={(e) => setLinksSearch(e.target.value)}
                    placeholder="بحث في الروابط والأسماء..."
                    className="bg-slate-950/80 border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
                  />
                </div>

                {/* Filter */}
                <select
                  value={linksCategoryFilter}
                  onChange={(e) => setLinksCategoryFilter(e.target.value)}
                  className="bg-slate-950/80 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">جميع الأقسام</option>
                  <option value="svga">SVGA</option>
                  <option value="vap">VAP</option>
                  <option value="video">فيديو</option>
                  <option value="image">صور</option>
                  <option value="audio">صوتيات</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
            </div>

            {/* List Table */}
            {loadingLinks ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                <span>جاري تحميل قائمة الروابط...</span>
              </div>
            ) : !linksData || linksData.links.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                لا توجد ملفات متخزنة حالياً في السيرفر. قم برفع أي ملف ليظهر رابطه هنا تلقائياً.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-[11px] font-semibold">
                      <th className="pb-3 pr-2">الملف</th>
                      <th className="pb-3">القسم</th>
                      <th className="pb-3">الحجم</th>
                      <th className="pb-3">تاريخ الرفع</th>
                      <th className="pb-3">الرابط المباشر</th>
                      <th className="pb-3 text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {linksData.links
                      .filter(item => {
                        if (linksCategoryFilter !== 'all' && item.category !== linksCategoryFilter) return false;
                        if (linksSearch.trim()) {
                          const q = linksSearch.toLowerCase();
                          return item.fileName.toLowerCase().includes(q) || item.uploaderName.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map((item, index) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-slate-500">#{index + 1}</span>
                              <div className="font-semibold text-white truncate max-w-xs" title={item.fileName}>
                                {item.fileName}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-slate-300">
                              {getCategoryLabel(item.category)}
                            </span>
                          </td>
                          <td className="py-3 text-slate-300 font-mono">
                            {formatBytes(item.fileSize)}
                          </td>
                          <td className="py-3 text-slate-400 text-[11px]">
                            {new Date(item.uploadedAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 max-w-xs">
                              <input
                                readOnly
                                value={item.downloadUrl}
                                className="bg-slate-950/80 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300 w-full truncate focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.downloadUrl);
                                  showNotification('تم نسخ الرابط المباشر!', 'success');
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex-shrink-0"
                                title="نسخ الرابط المباشر"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.megaUrl && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(item.megaUrl);
                                    showNotification('تم نسخ رابط MEGA!', 'success');
                                  }}
                                  className="px-2 py-1 bg-red-950/60 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-lg text-[11px] transition-colors"
                                  title="نسخ رابط MEGA"
                                >
                                  MEGA
                                </button>
                              )}
                              <a
                                href={item.downloadUrl}
                                download={item.fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>تنزيل</span>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Server Cleaner View (تنظيف السيرفر من الملفات المتخزنة) */}
      {subTab === 'cleanup' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-950/60 p-6 rounded-2xl border border-rose-500/30 shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 text-rose-300 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  نظام تنظيف السيرفر وتفريغ الكاش والملفات المؤقتة
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                يقوم هذا النظام بفحص وتنظيف الملفات المتخزنة على قرص السيرفر (Local Storage Cache والمجلدات المؤقتة) لتفريغ المساحة وحماية موارد الخادم، مع استخراج وحفظ روابط جميع الملفات تلقائياً حتى تتمكن من نسخها وتنزيلها بكل سهولة!
              </p>
            </div>

            {/* Cleanup Options */}
            <div className="space-y-3 bg-slate-950/60 p-5 rounded-xl border border-white/10">
              <h3 className="text-xs font-bold text-slate-200 mb-2">خيارات التنظيف المستهدفة:</h3>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanLocalCache}
                  onChange={(e) => setCleanLocalCache(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>تنظيف كاش السيرفر المحلي (data/mega_local_cache)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">موصى به - آمن 100%</span>
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    يقوم بحذف الملفات المحملة على قرص السيرفر لتفريغ المساحة فوراً، مع الاحتفاظ بروابط الملفات مسجلة ومتاحة للتنزيل السحابي في أي وقت.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanUploadsDir}
                  onChange={(e) => setCleanUploadsDir(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-white">تفريغ مجلد الرفع المؤقت (/uploads)</div>
                  <div className="text-slate-400 mt-0.5">
                    إزالة بقايا ملفات التحويل والرفع المؤقتة الناتجة عن عمليات الاستيراد والتصدير.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 hover:border-rose-500/40 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearRecords}
                  onChange={(e) => setClearRecords(e.target.checked)}
                  className="mt-0.5 rounded border-white/20 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-rose-200">مسح سجلات وقاعدة بيانات الملفات أيضاً</div>
                  <div className="text-rose-300/70 mt-0.5">
                    تحذير: سيتم مسح قائمة الروابط والسجلات من الداشبورد بالكامل. لا تحدد هذا الخيار إلا إذا كنت تريد إعادة ضبط شاملة.
                  </div>
                </div>
              </label>
            </div>

            {/* Execute Cleanup Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                onClick={handleExecuteServerClean}
                disabled={isCleaning || (!cleanLocalCache && !cleanUploadsDir && !clearRecords)}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-sm font-bold transition-all shadow-xl shadow-rose-900/40 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isCleaning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                <span>{isCleaning ? 'جاري تنظيف وتحرير مساحة السيرفر...' : '🧹 تنفيذ عملية تنظيف السيرفر الآن'}</span>
              </button>

              <div className="text-xs text-slate-400 text-center sm:text-right">
                سيتم استخراج كافة الروابط الحالية وحفظها تلقائياً قبل تنفيذ أي حذف لضمان سلامة بياناتك.
              </div>
            </div>

            {/* Clean Result Card */}
            {cleanResult && (
              <div className="bg-emerald-950/60 p-5 rounded-2xl border border-emerald-500/40 space-y-4 animate-in fade-in">
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">اكتملت عملية تنظيف السيرفر بنجاح!</h3>
                    <p className="text-xs text-emerald-200/90 mt-0.5">{cleanResult.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div className="bg-slate-900/70 p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 block text-[11px]">المساحة المحررة:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      {(cleanResult.freedBytes / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="bg-slate-900/70 p-3 rounded-xl border border-white/5">
                    <span className="text-slate-400 block text-[11px]">الملفات المحذوفة من القرص:</span>
                    <span className="font-bold text-white font-mono text-sm">
                      {cleanResult.deletedDiskFilesCount} ملف
                    </span>
                  </div>
                  <div className="bg-slate-900/70 p-3 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                    <span className="text-slate-400 block text-[11px]">الروابط المحفوظة الجاهزة للنسخ:</span>
                    <span className="font-bold text-indigo-400 font-mono text-sm">
                      {cleanResult.preservedLinksCount} رابط
                    </span>
                  </div>
                </div>

                {/* Quick actions for preserved links */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
                  <button
                    onClick={() => handleCopyLinks('formatted')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ جميع الروابط الآن</span>
                  </button>
                  <button
                    onClick={handleDownloadLinksFile}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors border border-white/10 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل ملف الروابط (TXT)</span>
                  </button>
                  <button
                    onClick={() => setSubTab('links_center')}
                    className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-2"
                  >
                    <Link className="w-4 h-4" />
                    <span>الانتقال لمركز الروابط الكامل</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Settings & Connection Testing View */}
      {subTab === 'settings' && (
        <div className="space-y-6">
          {/* Custom Folder Configuration Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-purple-950/30 p-6 rounded-2xl border border-indigo-500/30 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderLock className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    تخصيص مجلد MEGA المستهدف للتخزين (Target Storage Folder)
                  </h3>
                  {settings?.folderUrl && settings.folderUrl !== 'https://mega.nz/folder/ZAEVwBAR#eCpPGWnnzvZRaNXoJleO9g' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      مجلد مخصص نشط
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      المجلد الافتراضي
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  يمكنك إنشاء أي مجلد تريده على حسابك في MEGA ووضع رابطه هنا؛ سيقوم النظام بتخزين ورفع جميع الملفات المحفوظة من الموقع مباشرة إلى هذا المجلد.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {settings?.folderUrl && (
                  <a
                    href={settings.folderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <span>فتح المجلد في MEGA</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleResetDefaultFolder}
                  disabled={savingSettings}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors disabled:opacity-50"
                  title="استعادة الرابط الافتراضي"
                >
                  استعادة الافتراضي
                </button>
              </div>
            </div>

            {/* Form to edit Target Folder */}
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  رابط مجلد MEGA (MEGA Folder URL with Key):
                </label>
                <div className="relative flex items-center">
                  <input
                    type="url"
                    value={folderUrlInput}
                    onChange={(e) => setFolderUrlInput(e.target.value)}
                    placeholder="https://mega.nz/folder/XXXXX#YYYYY أو https://mega.nz/#F!XXXXX!YYYYY"
                    dir="ltr"
                    required
                    className="w-full bg-slate-950/80 border border-white/15 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-slate-500 transition-all text-left"
                  />
                  {folderUrlInput && (
                    <button
                      type="button"
                      onClick={() => handleCopy(folderUrlInput, 'input_folder_url')}
                      className="absolute left-2.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 border border-white/10"
                    >
                      {copiedId === 'input_folder_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>نسخ</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  تأكد من أن الرابط يحتوي على مفتاح التشفير (يأتي بعد علامة <code className="text-indigo-300 font-mono">#</code> أو <code className="text-indigo-300 font-mono">!</code>) لضمان إمكانية قراءة وتنزيل الملفات بسلاسة.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-200">
                    اسم المجلد التعريفي (اختياري):
                  </label>
                  <input
                    type="text"
                    value={folderNameInput}
                    onChange={(e) => setFolderNameInput(e.target.value)}
                    placeholder="مثال: مجلد ملفات الغرف والكاش 2025"
                    className="w-full bg-slate-950/80 border border-white/15 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full py-2.5 px-5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري حفظ وتحديث المجلد...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ وتعيين مجلد التخزين المستهدف</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Quick Steps Guide */}
            <div className="p-3.5 bg-slate-950/70 border border-white/5 rounded-xl space-y-1.5">
              <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                كيفية إنشاء والحصول على رابط المجلد من MEGA:
              </div>
              <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside leading-relaxed">
                <li>افتح حسابك على <a href="https://mega.nz" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">موقع MEGA</a> وأنشئ مجلداً جديداً بالاسم الذي تريده.</li>
                <li>اضغط بالزر الأيمن على المجلد واختر <strong className="text-white">"الحصول على الرابط" (Get link)</strong>.</li>
                <li>اختر تضمين المفتاح <strong className="text-white">(Link with key)</strong> وانسخ الرابط الناتج والصقه في الخانة أعلاه ثم اضغط <strong className="text-indigo-300">حفظ وتعيين</strong>.</li>
              </ol>
            </div>
          </div>

          {/* Connection Status & Diagnostic Card */}
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  حالة الاتصال والخدمة السحابية (Storage Status)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  معلومات الاتصال بحساب خادم MEGA ومجلد التخزين الحالي.
                </p>
              </div>

              <button
                onClick={handleRunTest}
                disabled={testingConnection}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>فحص واختبار الاتصال (Test Connection)</span>
              </button>
            </div>

            {/* Provider Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 font-medium">مزود الخدمة (Storage Provider)</span>
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span>MEGA Cloud Storage</span>
                  <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    مفعل
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 font-medium">حالة الاتصال (Storage Status)</span>
                <div className="text-base font-bold flex items-center gap-2">
                  {settings?.status === 'connected' ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-400">متصل (Connected)</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-amber-400">بحاجة إلى إعداد المفاتيح (Pending Credentials)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1 md:col-span-2">
                <span className="text-xs text-slate-400 font-medium">مجلد MEGA المستهدف الحالي (Current Active Folder)</span>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <a
                    href={settings?.folderUrl || 'https://mega.nz/folder/ZAEVwBAR#eCpPGWnnzvZRaNXoJleO9g'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 break-all underline flex items-center gap-1"
                  >
                    {settings?.folderUrl || 'https://mega.nz/folder/ZAEVwBAR#eCpPGWnnzvZRaNXoJleO9g'}
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                  <button
                    onClick={() => handleCopy(settings?.folderUrl || 'https://mega.nz/folder/ZAEVwBAR#eCpPGWnnzvZRaNXoJleO9g', 'folder_url')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1"
                  >
                    {copiedId === 'folder_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>نسخ</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 font-medium">آخر عملية رفع ناجحة (Last Upload)</span>
                <div className="text-sm font-semibold text-slate-200">
                  {settings?.lastSuccessfulUpload ? new Date(settings.lastSuccessfulUpload).toLocaleString('ar-EG') : 'لم يتم الرفع بعد'}
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 font-medium">هيكل المجلدات الفرعية الذكية (Subfolders)</span>
                <div className="text-xs font-mono text-indigo-300">
                  /cache/ [svga, vap, video, images, audio, files]
                </div>
              </div>
            </div>

            {/* Architecture Explanation Card */}
            <div className="p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl space-y-2">
              <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                معايير الأمان وتدفق الرفع (Security & Streaming Workflow)
              </h4>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>يتم استدعاء مكتبة <code className="text-indigo-300 font-mono">MEGAJS</code> بالكامل من الـ Backend داخل مسارات آمنة، ولا يتم كشف أي كلمات مرور في كود الواجهة.</li>
                <li>يتم فحص كل ملف بواسطة خوارزمية SHA-256 قبل الرفع لمنع تكرار الملفات المتطابقة في الكاش وتوفير المساحة.</li>
                <li>تنزيل الملفات يتم عبر <code className="text-indigo-300 font-mono">Streams</code> لمنع استهلاك ذاكرة الرام (RAM) للخادم.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Test Diagnostic Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                فحص وتشخيص الاتصال بخادم MEGA
              </h3>
              <button onClick={() => setShowTestModal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {testingConnection ? (
              <div className="py-8 text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                <p className="text-sm text-slate-300">جاري تسجيل الدخول وفحص المجلد وإنشاء ملف اختبار تجريبي...</p>
              </div>
            ) : testResult ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  testResult.success 
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' 
                    : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
                  <div className="text-xs space-y-1 leading-relaxed">
                    <div className="font-semibold text-sm">{testResult.success ? 'نجح الاتصال!' : 'تنبيه الاتصال'}</div>
                    <p>{testResult.message}</p>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>المزود:</span>
                    <span className="text-white">MEGA Cloud</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>رفع ملف اختبار تجريبي:</span>
                    <span className={testResult.testFileUploaded ? 'text-emerald-400' : 'text-slate-500'}>
                      {testResult.testFileUploaded ? 'ناجح' : 'غير متوفر'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>إنشاء وتشفير الرابط:</span>
                    <span className={testResult.testLinkGenerated ? 'text-emerald-400' : 'text-slate-500'}>
                      {testResult.testLinkGenerated ? 'ناجح' : 'غير متوفر'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>حذف ملف الاختبار:</span>
                    <span className={testResult.testFileDeleted ? 'text-emerald-400' : 'text-slate-500'}>
                      {testResult.testFileDeleted ? 'تم بنجاح' : 'غير متوفر'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>وقت الفحص:</span>
                    <span className="text-slate-300">{new Date(testResult.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowTestModal(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2 truncate">
                {getCategoryIcon(previewFile.category)}
                <span className="font-bold text-white text-sm truncate">{previewFile.originalName || previewFile.fileName}</span>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/40 min-h-[250px]">
              {previewFile.category === 'image' ? (
                <img
                  src={previewFile.downloadUrl}
                  alt={previewFile.fileName}
                  className="max-h-96 max-w-full rounded-xl object-contain shadow-lg"
                />
              ) : previewFile.category === 'video' ? (
                <video
                  controls
                  src={previewFile.downloadUrl}
                  className="max-h-96 w-full rounded-xl shadow-lg"
                />
              ) : previewFile.category === 'audio' ? (
                <div className="w-full max-w-md p-6 bg-slate-900 rounded-2xl border border-white/10 text-center space-y-4">
                  <Music className="w-16 h-16 text-pink-400 mx-auto animate-pulse" />
                  <audio controls src={previewFile.downloadUrl} className="w-full" />
                </div>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="p-4 bg-indigo-500/10 rounded-2xl inline-block text-indigo-400">
                    {getCategoryIcon(previewFile.category)}
                  </div>
                  <h4 className="text-base font-semibold text-white">{previewFile.fileName}</h4>
                  <p className="text-xs text-slate-400">
                    نوع الملف: {getCategoryLabel(previewFile.category)} ({formatBytes(previewFile.fileSize)})
                  </p>
                  <a
                    href={previewFile.downloadUrl}
                    download
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold mt-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between text-xs">
              <div className="text-slate-400">
                الحجم: <span className="text-white font-mono">{formatBytes(previewFile.fileSize)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(previewFile.megaUrl, 'preview_mega')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ رابط MEGA</span>
                </button>
                <a
                  href={previewFile.downloadUrl}
                  download
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-right space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">تأكيد حذف الملف</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف الملف التالي نهائياً من خادم MEGA وسجل البيانات؟
            </p>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 text-xs space-y-1">
              <div className="text-white font-semibold truncate">{deleteConfirmFile.fileName}</div>
              <div className="text-slate-400 font-mono">الحجم: {formatBytes(deleteConfirmFile.fileSize)}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmFile(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>حذف نهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudStorageTab;
