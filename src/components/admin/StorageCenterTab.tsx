import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  HardDrive, Server, UploadCloud, RefreshCw, Search, Filter, 
  ExternalLink, Copy, Check, Trash2, Download, Eye, AlertTriangle, 
  CheckCircle2, XCircle, FileText, Image as ImageIcon, Video, 
  Music, Sparkles, FolderLock, ShieldCheck, Layers, ArrowUpDown, 
  X, AlertCircle, Trash, RotateCcw, FileArchive, Clock, User, 
  Calendar, Flame, Activity, Shield, ArrowDownToLine, Link2
} from 'lucide-react';
import { StoredFileRecord, StorageCenterStats, StorageActivityLog, UserRecord } from '../../types';
import { 
  fetchStorageCenterStats, 
  fetchStoredFiles, 
  moveFileToTrash, 
  restoreFileFromTrash, 
  permanentlyDeleteFile, 
  generateSecureDownloadLink, 
  executeStorageCleanup, 
  executeServerCleanup, 
  fetchServerStatus, 
  fetchStorageActivityLogs,
  logStorageAdminActivity,
  purgeAllFirestoreDatabaseFiles 
} from '../../services/storageCenterService';
import CentralUploadService, { getFileCategory } from '../../services/centralUploadService';

interface StorageCenterTabProps {
  currentUser?: UserRecord | any;
}

export const StorageCenterTab: React.FC<StorageCenterTabProps> = ({ currentUser }) => {
  // Stats & State
  const [stats, setStats] = useState<StorageCenterStats | null>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tabs: 'active' | 'trash' | 'server_cleanup' | 'logs'
  const [subTab, setSubTab] = useState<'active' | 'trash' | 'server_cleanup' | 'logs'>('active');

  // Files & Filtering
  const [files, setFiles] = useState<StoredFileRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'size' | 'originalName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Logs
  const [logs, setLogs] = useState<StorageActivityLog[]>([]);

  // Action feedback & Modals
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<StoredFileRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ file: StoredFileRecord; permanent: boolean } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Server Cleanup modal / state
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupType, setCleanupType] = useState<'server_temp' | 'trash_empty' | 'purge_all'>('server_temp');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  // Upload modal / state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedRecord, setUploadedRecord] = useState<StoredFileRecord | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, serverRes, filesRes, logsRes] = await Promise.all([
        fetchStorageCenterStats(),
        fetchServerStatus(),
        fetchStoredFiles({
          status: subTab === 'trash' ? 'trash' : 'active',
          search: searchQuery,
          category: selectedCategory,
          sortBy,
          sortOrder,
          limitCount: 300
        }),
        subTab === 'logs' ? fetchStorageActivityLogs(50) : Promise.resolve([])
      ]);

      setStats(statsRes);
      setServerStatus(serverRes);
      setFiles(filesRes);
      if (subTab === 'logs') setLogs(logsRes);
    } catch (err) {
      console.error('Error loading storage center data:', err);
      showToast('حدث خطأ أثناء تحميل بيانات التخزين', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [subTab, selectedCategory, sortBy, sortOrder]);

  // Listen for real-time central upload events from anywhere across the website
  useEffect(() => {
    const handleCentralUpload = () => {
      loadAllData(true);
    };
    window.addEventListener('central_file_uploaded', handleCentralUpload);
    return () => window.removeEventListener('central_file_uploaded', handleCentralUpload);
  }, [subTab, selectedCategory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadAllData(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date helper
  const formatDate = (dateVal: any) => {
    if (!dateVal) return 'غير محدد';
    let d: Date;
    if (dateVal.toDate) d = dateVal.toDate();
    else if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
    else d = new Date(dateVal);
    
    if (isNaN(d.getTime())) return 'غير محدد';
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Copy link to clipboard
  const handleCopyLink = async (file: StoredFileRecord) => {
    try {
      const link = file.downloadUrl 
        ? (window.location.origin + file.downloadUrl)
        : await generateSecureDownloadLink(file.fileId, currentUser);

      await navigator.clipboard.writeText(link);
      setCopiedId(file.fileId);
      showToast(`تم نسخ رابط الملف "${file.originalName}" بنجاح!`);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err: any) {
      console.error('Error copying link:', err);
      showToast('فشل نسخ الرابط', 'error');
    }
  };

  // Direct download
  const handleDownload = async (file: StoredFileRecord) => {
    try {
      showToast(`جارٍ تحضير تنزيل "${file.originalName}"...`, 'info');
      const directUrl = await generateSecureDownloadLink(file.fileId, currentUser);
      
      const link = document.createElement('a');
      link.href = directUrl;
      link.download = file.originalName || 'file';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Download error:', err);
      showToast('فشل بدء تنزيل الملف', 'error');
    }
  };

  // Delete / Trash handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.permanent) {
        await permanentlyDeleteFile(deleteConfirm.file.fileId, currentUser);
        showToast(`تم حذف الملف "${deleteConfirm.file.originalName}" نهائياً من التخزين وقاعدة البيانات.`);
      } else {
        await moveFileToTrash(deleteConfirm.file.fileId, currentUser);
        showToast(`تم نقل الملف "${deleteConfirm.file.originalName}" إلى سلة المهملات.`);
      }
      setDeleteConfirm(null);
      loadAllData(true);
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast(err?.message || 'فشل حذف الملف', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Restore file
  const handleRestore = async (file: StoredFileRecord) => {
    try {
      await restoreFileFromTrash(file.fileId, currentUser);
      showToast(`تمت استعادة الملف "${file.originalName}" بنجاح إلى الملفات النشطة.`);
      loadAllData(true);
    } catch (err: any) {
      console.error('Restore error:', err);
      showToast('فشل استعادة الملف', 'error');
    }
  };

  // Server Cleanup execution
  const handleExecuteCleanup = async (type: 'server_temp' | 'trash_empty' | 'purge_all') => {
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      if (type === 'purge_all') {
        const res = await purgeAllFirestoreDatabaseFiles(currentUser);
        setCleanupResult({
          ok: true,
          deletedCount: res.deletedCount,
          freedBytes: 0,
          freedMb: '0',
          message: res.message
        });
        showToast(res.message, 'success');
      } else if (type === 'server_temp') {
        const res = await executeServerCleanup(currentUser);
        setCleanupResult(res);
        showToast(res.message);
      } else {
        const res = await executeStorageCleanup({ cleanTrashOnly: true, trashDaysThreshold: 0 }, currentUser);
        setCleanupResult({
          ok: true,
          deletedCount: res.deletedCount,
          freedBytes: res.freedBytes,
          freedMb: (res.freedBytes / (1024 * 1024)).toFixed(2),
          message: res.message
        });
        showToast(res.message);
      }
      loadAllData(true);
    } catch (err: any) {
      console.error('Cleanup error:', err);
      showToast(err?.message || 'فشل تنفيذ عملية التنظيف', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  // Direct Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadedRecord(null);

    try {
      const record = await CentralUploadService.uploadFile(file, {
        user: currentUser,
        uploadContext: 'admin_storage_center',
        onProgress: (p) => setUploadProgress(p)
      });

      setUploadedRecord(record);
      showToast(`تم رفع وتخزين "${record.originalName}" بنجاح!`);
      loadAllData(true);
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast(err?.message || 'فشل رفع الملف إلى التخزين الدائم', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Render category icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'svga':
      case 'vap':
      case 'lottie':
        return <Sparkles className="text-amber-400" size={18} />;
      case 'video':
        return <Video className="text-blue-400" size={18} />;
      case 'image':
        return <ImageIcon className="text-emerald-400" size={18} />;
      case 'audio':
        return <Music className="text-pink-400" size={18} />;
      case 'zip':
        return <FileArchive className="text-purple-400" size={18} />;
      case 'pdf':
        return <FileText className="text-rose-400" size={18} />;
      default:
        return <HardDrive className="text-gray-400" size={18} />;
    }
  };

  const categories = [
    { id: 'all', label: 'جميع الملفات' },
    { id: 'svga', label: 'SVGA' },
    { id: 'vap', label: 'VAP' },
    { id: 'lottie', label: 'Lottie' },
    { id: 'video', label: 'فيديو' },
    { id: 'image', label: 'صور' },
    { id: 'audio', label: 'صوتيات' },
    { id: 'zip', label: 'ZIP مضغوطة' },
    { id: 'pdf', label: 'PDF' },
    { id: 'other', label: 'أخرى' },
  ];

  return (
    <div className="flex flex-col gap-6 text-gray-100 p-2 sm:p-4 max-w-7xl mx-auto" dir="rtl">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50' 
            : toast.type === 'error'
            ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
            : 'bg-blue-950/90 text-blue-200 border-blue-500/50'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : toast.type === 'error' ? <AlertTriangle size={20} /> : <Activity size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-6 rounded-2xl border border-indigo-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <HardDrive size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                مركز إدارة وتخزين الملفات وتنظيف السيرفر
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  Firebase + Private Storage
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                نظام مركزي آمن لإدارة جميع ملفات الموقع (SVGA, VAP, Lottie, وسائط) مع أداة تنظيف السيرفر وتوليد روابط التنزيل الفورية.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-sm font-bold border border-slate-700 transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
            تحديث
          </button>

          <button
            onClick={() => {
              setCleanupType('purge_all');
              setShowCleanupModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600/30 hover:bg-red-600/40 text-red-200 rounded-xl text-sm font-black border border-red-500/50 transition-all shadow-md"
            title="حذف وتفريغ كافة الملفات المخزنة من قاعدة البيانات والتخزين بالكامل"
          >
            <Flame size={16} className="text-red-400" />
            تنظيف قاعدة البيانات والتخزين 💥
          </button>

          <button
            onClick={() => {
              setCleanupType('server_temp');
              setShowCleanupModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-xl text-sm font-bold border border-rose-500/40 transition-all shadow-sm"
          >
            <Trash2 size={16} />
            تنظيف السيرفر 🧹
          </button>

          <button
            onClick={() => {
              setUploadedRecord(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all"
          >
            <UploadCloud size={18} />
            رفع ملف جديد
          </button>
        </div>
      </div>

      {/* Metrics & Analytics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>إجمالي الملفات</span>
            <FileText size={16} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white">{stats?.totalFiles ?? '...'}</span>
            <span className="text-xs text-gray-500 mr-2">ملف مخزن</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>حجم التخزين</span>
            <HardDrive size={16} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-400">
              {stats ? formatBytes(stats.totalSize) : '...'}
            </span>
            <span className="text-xs text-gray-500 mr-2">مساحة مستخدمة</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>ملفات اليوم</span>
            <Calendar size={16} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-300">{stats?.filesToday ?? '...'}</span>
            <span className="text-xs text-gray-500 mr-2">خلال 24 ساعة</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>سلة المهملات</span>
            <Trash size={16} className="text-rose-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-400">{stats?.trashCount ?? '...'}</span>
            <span className="text-xs text-gray-500 mr-2">ملف محذوف</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>كاش السيرفر المؤقت</span>
            <Server size={16} className="text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-cyan-300">
              {serverStatus ? formatBytes(serverStatus.totalTempBytes) : '0 B'}
            </span>
            <span className="text-xs text-gray-500 mr-2">
              ({serverStatus?.totalTempFiles ?? 0} ملف)
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('active')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              subTab === 'active'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <HardDrive size={16} />
            الملفات النشطة ({stats?.activeCount ?? files.length})
          </button>

          <button
            onClick={() => setSubTab('trash')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              subTab === 'trash'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Trash2 size={16} />
            سلة المهملات ({stats?.trashCount ?? 0})
          </button>

          <button
            onClick={() => setSubTab('server_cleanup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              subTab === 'server_cleanup'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Flame size={16} />
            مركز تنظيف السيرفر
          </button>

          <button
            onClick={() => setSubTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              subTab === 'logs'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-800/80 text-gray-400 hover:text-white'
            }`}
          >
            <Activity size={16} />
            سجل العمليات
          </button>
        </div>

        {subTab === 'trash' && stats && stats.trashCount > 0 && (
          <button
            onClick={() => {
              setCleanupType('trash_empty');
              setShowCleanupModal(true);
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 rounded-xl text-xs font-bold border border-rose-500/40"
          >
            <Trash2 size={14} />
            تفريغ سلة المهملات بالكامل
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {subTab === 'server_cleanup' ? (
        /* Server Cleanup Dedicated View */
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="text-amber-400" />
              نظام تنظيف السيرفر والملفات المتخزنة المؤقتة
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              تنظيف ملفات التصدير المؤقتة، كاش التخزين المحلي، وذاكرة التنزيل المؤقتة In-Memory لتحرير مساحة السيرفر فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Temp Storage Card */}
            <div className="p-5 bg-slate-800/60 rounded-xl border border-slate-700 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-200">ملفات السيرفر المؤقتة (Local & Cache)</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {serverStatus?.totalTempFiles ?? 0} ملف
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  الملفات الناتجة عن مهام التصدير، الكاش المحلي، ومعالجة الصوتيات المؤقتة. حجمها الحالي: 
                  <strong className="text-cyan-400 mr-1">{serverStatus ? formatBytes(serverStatus.totalTempBytes) : '0 B'}</strong>.
                </p>
              </div>

              <button
                onClick={() => handleExecuteCleanup('server_temp')}
                disabled={isCleaning}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isCleaning ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                تنظيف ملفات السيرفر المؤقتة فوراً
              </button>
            </div>

            {/* Trash Files Card */}
            <div className="p-5 bg-slate-800/60 rounded-xl border border-slate-700 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-gray-200">سلة المهملات في التخزين السحابي</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {stats?.trashCount ?? 0} ملف
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                  الملفات المحذوفة التي تم نقلها لسلة المهملات. حذفها نهائياً يوفر مساحة Firebase Storage وقاعدة البيانات فوراً.
                </p>
              </div>

              <button
                onClick={() => handleExecuteCleanup('trash_empty')}
                disabled={isCleaning || (stats?.trashCount ?? 0) === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isCleaning ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
                تفريغ سلة المهملات نهائياً
              </button>
            </div>

            {/* Total Firebase Database Purge Card */}
            <div className="p-5 bg-slate-800/60 rounded-xl border border-red-900/50 md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="text-red-500" size={20} />
                  <span className="text-base font-bold text-white">تفريغ وحذف قاعدة بيانات فايربيس (Purge All Files Database)</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  حذف جميع السجلات والملفات المخزنة في مجموعة files و storageActivityLogs في Firestore نهائياً لتفريغ قاعدة البيانات فوراً.
                </p>
              </div>

              <button
                onClick={async () => {
                  if (!window.confirm('⚠️ هل أنت متأكد من حذف وتفريغ كل سجلات الملفات من قاعدة بيانات فايربيس بالكامل؟')) return;
                  setIsCleaning(true);
                  try {
                    const res = await purgeAllFirestoreDatabaseFiles();
                    setCleanupResult({
                      ok: true,
                      deletedCount: res.deletedCount,
                      message: res.message
                    });
                    loadData();
                  } catch (e: any) {
                    alert('خطأ: ' + (e.message || 'فشل تنظيف قاعدة البيانات'));
                  } finally {
                    setIsCleaning(false);
                  }
                }}
                disabled={isCleaning}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/20 whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isCleaning ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}
                <span>تنظيف قاعدة بيانات فايربيس من كل شيء</span>
              </button>
            </div>
          </div>

          {/* Cleanup Status & Result */}
          {cleanupResult && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>{cleanupResult.message}</span>
              </div>
              {cleanupResult.freedMb && (
                <div className="text-xs text-emerald-300">
                  تم تحرير: {cleanupResult.freedMb} ميجابايت | عدد الملفات المحذوفة: {cleanupResult.deletedCount}
                </div>
              )}
            </div>
          )}
        </div>
      ) : subTab === 'logs' ? (
        /* Storage Activity Logs View */
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="text-indigo-400" />
              سجل نشاطات التخزين والتنظيف
            </h2>
            <span className="text-xs text-gray-400">آخر 50 عملية</span>
          </div>

          <div className="divide-y divide-slate-800">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                لا توجد سجلات نشاط مسجلة بعد.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                      log.action === 'cleanup' ? 'bg-amber-500/20 text-amber-300' :
                      log.action === 'delete' ? 'bg-rose-500/20 text-rose-300' :
                      log.action === 'download' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {log.action}
                    </span>
                    <span className="text-gray-300 font-medium">{log.details}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 font-mono">
                    <span>{log.adminName || 'المدير'}</span>
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Files Browser View (Active / Trash) */
        <div className="space-y-4">
          {/* Search, Filter Categories & Sorter Bar */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الملف، اسم المستخدم، معرّف UID..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-800/80 text-white text-sm rounded-xl border border-slate-700/80 focus:border-indigo-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-800 text-gray-200 text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none font-bold"
              >
                <option value="createdAt">تاريخ الرفع</option>
                <option value="size">حجم الملف</option>
                <option value="originalName">اسم الملف</option>
              </select>

              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl border border-slate-700 transition-colors"
                title={sortOrder === 'desc' ? 'ترتيب تنازلي' : 'ترتيب تصاعدي'}
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-gray-400 hover:bg-slate-800 hover:text-gray-200 border border-slate-700/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Files List / Table */}
          {loading ? (
            <div className="p-16 text-center bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="animate-spin text-indigo-400" size={32} />
              <span className="text-gray-400 text-sm">جارٍ تحميل الملفات من التخزين السحابي...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="p-16 text-center bg-slate-900 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3">
              <HardDrive className="text-slate-600" size={48} />
              <h3 className="text-lg font-bold text-gray-300">لا توجد ملفات متطابقة</h3>
              <p className="text-xs text-gray-500">
                {searchQuery ? 'جرب البحث بكلمات مختلفة أو إزالة الفلاتر.' : 'لم يتم رفع ملفات في هذا القسم بعد.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => {
                const cat = getFileCategory(file.extension || '', file.mimeType || '');
                const directUrl = file.downloadUrl ? (window.location.origin + file.downloadUrl) : '';

                return (
                  <div
                    key={file.fileId}
                    className="bg-slate-900/90 hover:bg-slate-900 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm group"
                  >
                    {/* File Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-gray-300 flex-shrink-0 group-hover:scale-105 transition-transform">
                        {getCategoryIcon(cat)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white truncate max-w-md" title={file.originalName}>
                            {file.originalName}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-indigo-300 border border-slate-700 uppercase">
                            {file.extension || cat}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {formatBytes(file.size)}
                          </span>
                        </div>

                        {/* Direct Link Box & Copy (The User's Core Request) */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2 max-w-lg">
                            <Link2 size={13} className="text-indigo-400 flex-shrink-0" />
                            <input
                              type="text"
                              readOnly
                              value={directUrl || `/api/files/download/${file.fileId}`}
                              className="bg-transparent text-[11px] text-gray-300 font-mono focus:outline-none w-full select-all cursor-pointer"
                              title="انقر لتحديد الرابط بالكامل"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                          </div>

                          <button
                            onClick={() => handleCopyLink(file)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                              copiedId === file.fileId
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                            }`}
                            title="نسخ الرابط المباشر للملف"
                          >
                            {copiedId === file.fileId ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedId === file.fileId ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                          </button>
                        </div>

                        {/* Metadata row */}
                        <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-gray-500" />
                            {file.userName || file.userId || 'مستخدم'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-500" />
                            {formatDate(file.createdAt)}
                          </span>
                          {file.uploadContext && (
                            <span className="text-gray-500 font-mono">
                              ({file.uploadContext})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Download, Preview, Trash, Restore */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
                      <button
                        onClick={() => handleDownload(file)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                        title="تنزيل الملف على جهازك"
                      >
                        <ArrowDownToLine size={15} />
                        <span>تنزيل</span>
                      </button>

                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
                        title="معاينة الملف"
                      >
                        <Eye size={16} />
                      </button>

                      {subTab === 'trash' ? (
                        <>
                          <button
                            onClick={() => handleRestore(file)}
                            className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl border border-emerald-500/30 transition-colors"
                            title="استعادة الملف"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ file, permanent: true })}
                            className="p-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded-xl border border-rose-500/30 transition-colors"
                            title="حذف نهائي من التخزين"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm({ file, permanent: false })}
                          className="p-2 bg-slate-800 hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-colors"
                          title="نقل لسلة المهملات"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Direct Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UploadCloud className="text-indigo-400" />
                رفع وتخزين ملف جديد
              </h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              اختر أي نوع ملف (SVGA, VAP, Lottie, MP4, PNG, ZIP, PDF). سيتم تخزينه في التخزين الخاص وتوليد رابط تنزيل فوري لك.
            </p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-indigo-500/40 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-indigo-950/20 hover:bg-indigo-950/30 transition-all flex flex-col items-center gap-3"
            >
              <div className="p-4 bg-indigo-600/20 text-indigo-400 rounded-full">
                <UploadCloud size={32} />
              </div>
              <div>
                <span className="text-sm font-bold text-gray-200">انقر لاختيار ملف من جهازك</span>
                <p className="text-xs text-gray-400 mt-1">يدعم كافة التنسيقات والأحجام حتى 250MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                  <span>جارٍ الرفع والتخزين السحابي...</span>
                  <span>{uploadProgress || 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress || 0}%` }}
                  />
                </div>
              </div>
            )}

            {uploadedRecord && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                  <CheckCircle2 size={18} />
                  <span>تم الرفع بنجاح! الرابط جاهز للنسخ:</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin + uploadedRecord.downloadUrl}
                    className="bg-transparent text-xs text-gray-200 font-mono w-full focus:outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(uploadedRecord)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold flex items-center gap-1"
                  >
                    <Copy size={13} />
                    نسخ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold text-white">
                {deleteConfirm.permanent ? 'تأكيد الحذف النهائي للملف' : 'تأكيد النقل لسلة المهملات'}
              </h3>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {deleteConfirm.permanent 
                ? `هل أنت متأكد من حذف الملف "${deleteConfirm.file.originalName}" نهائياً من التخزين؟ لا يمكن التراجع عن هذا الإجراء.`
                : `هل أنت متأكد من نقل الملف "${deleteConfirm.file.originalName}" إلى سلة المهملات؟`
              }
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isDeleting && <RefreshCw size={14} className="animate-spin" />}
                {deleteConfirm.permanent ? 'حذف نهائي' : 'نقل للمهملات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className={`flex items-center gap-3 ${cleanupType === 'purge_all' ? 'text-red-400' : 'text-amber-400'}`}>
              {cleanupType === 'purge_all' ? <Flame size={24} /> : <Trash2 size={24} />}
              <h3 className="text-lg font-bold text-white">
                {cleanupType === 'purge_all'
                  ? 'حذف وتفريغ قاعدة بيانات فايربيس والتخزين بالكامل'
                  : cleanupType === 'server_temp'
                  ? 'تنظيف ملفات السيرفر المؤقتة'
                  : 'تفريغ سلة المهملات بالكامل'}
              </h3>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {cleanupType === 'purge_all'
                ? `تحذير هام: سيتم مسح وحذف كافة سجلات الملفات المخزنة في قاعدة البيانات Firestore (${stats?.totalFiles ?? 0} ملف) وحذفها نهائياً من التخزين لتوفير المساحة بالكامل. هل تريد الاستمرار؟`
                : cleanupType === 'server_temp'
                ? `سيتم تنظيف مجلد الرفع المؤقت، كاش السيرفر الداخلي، وذاكرة التنزيل المؤقتة In-Memory. مساحة التخزين المستهلكة حالياً: ${serverStatus ? formatBytes(serverStatus.totalTempBytes) : '0 B'}.`
                : `سيتم حذف جميع الملفات الموجودة في سلة المهملات (${stats?.trashCount ?? 0} ملف) نهائياً من التخزين السحابي وقاعدة البيانات.`
              }
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  await handleExecuteCleanup(cleanupType);
                  setShowCleanupModal(false);
                }}
                disabled={isCleaning}
                className={`px-5 py-2 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 ${
                  cleanupType === 'purge_all'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                {isCleaning && <RefreshCw size={14} className="animate-spin" />}
                {cleanupType === 'purge_all' ? 'تنظيف ومسح قاعدة البيانات الآن 💥' : 'بدء التنظيف الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white truncate max-w-md">
                معاينة: {previewFile.originalName}
              </h3>
              <button 
                onClick={() => setPreviewFile(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center min-h-[220px]">
              {previewFile.mimeType.startsWith('image/') ? (
                <img 
                  src={previewFile.downloadUrl || ''} 
                  alt={previewFile.originalName}
                  className="max-h-[350px] object-contain rounded-lg"
                />
              ) : previewFile.mimeType.startsWith('video/') ? (
                <video 
                  src={previewFile.downloadUrl || ''} 
                  controls 
                  className="max-h-[350px] w-full rounded-lg"
                />
              ) : previewFile.mimeType.startsWith('audio/') ? (
                <audio 
                  src={previewFile.downloadUrl || ''} 
                  controls 
                  className="w-full"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <FileText size={48} className="mx-auto text-indigo-400" />
                  <p className="text-sm font-bold text-gray-300">{previewFile.originalName}</p>
                  <p className="text-xs text-gray-500">هذا الملف مخصص للتنزيل أو المعاينة في المشغل المخصص.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => handleCopyLink(previewFile)}
                className="px-4 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Copy size={14} />
                نسخ الرابط
              </button>

              <button
                onClick={() => handleDownload(previewFile)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Download size={14} />
                تنزيل الملف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StorageCenterTab;
