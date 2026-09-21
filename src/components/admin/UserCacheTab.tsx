import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  CacheFileRecord, 
  CacheCategory, 
  CacheActivityLog, 
  UserRecord, 
  CacheStats,
  CachePermissions 
} from '../../types';
import { 
  formatFileSize, 
  deleteCacheFile, 
  recordFileDownload, 
  recordLinkCopied, 
  toggleUserCacheAccess,
  computeCacheStats 
} from '../../services/cacheService';
import { 
  Search, 
  Filter, 
  HardDrive, 
  FolderArchive, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  FileCode, 
  Video, 
  Image as ImageIcon, 
  Music, 
  Layers, 
  FileText, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Clock, 
  Calendar, 
  ExternalLink, 
  Activity, 
  Key, 
  Play, 
  Pause, 
  X, 
  AlertTriangle, 
  ChevronRight, 
  User, 
  Hash, 
  Sparkles,
  Info,
  CheckCircle2,
  FileBox,
  Share2
} from 'lucide-react';

interface UserCacheTabProps {
  currentUser: UserRecord | null;
  users: UserRecord[];
  onRefreshUsers?: () => void;
}

const CATEGORY_TABS: { id: string; label: string; icon: any; countKey?: string }[] = [
  { id: 'all', label: 'جميع الملفات', icon: FolderArchive },
  { id: 'svga', label: 'SVGA', icon: Layers },
  { id: 'vap', label: 'VAP', icon: Video },
  { id: 'video', label: 'فيديو MP4', icon: Video },
  { id: 'image', label: 'الصور والتصاميم', icon: ImageIcon },
  { id: 'audio', label: 'الصوتيات', icon: Music },
  { id: 'pag', label: 'PAG Studio', icon: FileCode },
  { id: 'json', label: 'Lottie JSON', icon: FileText },
  { id: 'other', label: 'أخرى', icon: FileBox },
];

export const UserCacheTab: React.FC<UserCacheTabProps> = ({ currentUser, users, onRefreshUsers }) => {
  const [activeSubTab, setActiveSubTab] = useState<'files' | 'users' | 'logs'>('files');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest' | 'smallest' | 'downloads'>('newest');
  
  // Data States
  const [files, setFiles] = useState<CacheFileRecord[]>([]);
  const [logs, setLogs] = useState<CacheActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);

  // Interaction States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkInfo, setCopiedLinkInfo] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<CacheFileRecord | null>(null);
  const [fileToDelete, setFileToDelete] = useState<CacheFileRecord | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [toggleUserModal, setToggleUserModal] = useState<UserRecord | null>(null);
  const [savingUserPerms, setSavingUserPerms] = useState(false);

  // User permission editing states
  const [editPerms, setEditPerms] = useState<CachePermissions>({
    view: true,
    download: true,
    copyLink: true,
    delete: false,
    manage: false
  });

  // Load Real-time Cache Files
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'user_cache'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docsData: CacheFileRecord[] = [];
      snapshot.forEach(docSnap => {
        docsData.push({ ...docSnap.data(), id: docSnap.id } as CacheFileRecord);
      });
      setFiles(docsData);
      setLoading(false);
    }, (error) => {
      console.error("Cache listener error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Compute stats when files or users change
  useEffect(() => {
    computeCacheStats(users).then(s => setStats(s)).catch(console.error);
  }, [files.length, users]);

  // Load logs on demand
  useEffect(() => {
    if (activeSubTab === 'logs') {
      setLoadingLogs(true);
      const q = query(collection(db, 'cache_activity_logs'), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const logsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as CacheActivityLog));
        setLogs(logsData);
        setLoadingLogs(false);
      }, (e) => {
        console.error("Logs error:", e);
        setLoadingLogs(false);
      });
      return () => unsub();
    }
  }, [activeSubTab]);

  // Filter and Sort files
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      // Category filter
      if (selectedCategory !== 'all' && f.category !== selectedCategory) {
        return false;
      }
      // User filter
      if (selectedUserId !== 'all' && f.userId !== selectedUserId) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesName = (f.fileName || '').toLowerCase().includes(queryLower);
        const matchesOriginal = (f.originalName || '').toLowerCase().includes(queryLower);
        const matchesId = (f.id || '').toLowerCase().includes(queryLower);
        const matchesUser = (f.userName || '').toLowerCase().includes(queryLower);
        const matchesEmail = (f.userEmail || '').toLowerCase().includes(queryLower);
        const matchesNumeric = (f.userNumericId || '').toLowerCase().includes(queryLower);
        const matchesHash = (f.sha256 || '').toLowerCase().includes(queryLower);

        if (!matchesName && !matchesOriginal && !matchesId && !matchesUser && !matchesEmail && !matchesNumeric && !matchesHash) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'oldest') {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'largest') {
        return (b.size || 0) - (a.size || 0);
      }
      if (sortBy === 'smallest') {
        return (a.size || 0) - (b.size || 0);
      }
      if (sortBy === 'downloads') {
        return (b.downloadCount || 0) - (a.downloadCount || 0);
      }
      return 0;
    });
  }, [files, selectedCategory, selectedUserId, searchQuery, sortBy]);

  const handleCopyLink = (file: CacheFileRecord) => {
    const link = file.downloadUrl || `${window.location.origin}/api/cache/file/${file.id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(file.id);
    setCopiedLinkInfo(`تم نسخ رابط الملف: ${file.fileName}`);
    recordLinkCopied(file, currentUser);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedLinkInfo(null);
    }, 3000);
  };

  const handleDownload = (file: CacheFileRecord) => {
    recordFileDownload(file, currentUser);
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.originalName || file.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!fileToDelete || !currentUser) return;
    setDeletingFile(true);
    try {
      await deleteCacheFile(fileToDelete, {
        id: currentUser.id,
        name: currentUser.displayName || currentUser.name || 'Admin',
        email: currentUser.email,
        role: currentUser.role
      });
      setFileToDelete(null);
    } catch (err: any) {
      alert(`خطأ أثناء حذف الملف: ${err.message}`);
    } finally {
      setDeletingFile(false);
    }
  };

  const handleOpenUserPerms = (user: UserRecord) => {
    setToggleUserModal(user);
    setEditPerms({
      view: user.cachePermissions?.view ?? true,
      download: user.cachePermissions?.download ?? true,
      copyLink: user.cachePermissions?.copyLink ?? true,
      delete: user.cachePermissions?.delete ?? false,
      manage: user.cachePermissions?.manage ?? false
    });
  };

  const handleSaveUserCacheAccess = async (enable: boolean) => {
    if (!toggleUserModal || !currentUser) return;
    setSavingUserPerms(true);
    try {
      await toggleUserCacheAccess(toggleUserModal.id, enable, currentUser, editPerms);
      setToggleUserModal(null);
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      alert(`خطأ في تحديث إعدادات الكاش للمستخدم: ${err.message}`);
    } finally {
      setSavingUserPerms(false);
    }
  };

  const getCategoryBadgeColor = (cat: CacheCategory) => {
    switch (cat) {
      case 'svga': return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'vap': return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      case 'video': return 'bg-blue-950/80 text-blue-300 border-blue-500/40';
      case 'image': return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'audio': return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      case 'pag': return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'json': return 'bg-orange-950/80 text-orange-300 border-orange-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-950 to-red-950/50 p-6 rounded-3xl border border-red-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-slate-900 border border-red-500/50 flex items-center justify-center text-3xl shadow-lg shadow-red-900/50">
              ☠️
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white tracking-wide">
                  نظام كاش المستخدمين المركزي (User Cache System)
                </h2>
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  ☠️ CACHE CENTRAL
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                طبقة تخزين سحابية مركزية فائقة الأمان تحفظ تلقائياً نسخاً مشفرة من كافة الملفات المرفوعة عبر حسابات المستخدمين مع التزامن الكامل عبر كافة الأجهزة.
              </p>
            </div>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <button
              onClick={() => setActiveSubTab('files')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'files'
                  ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderArchive size={16} />
              <span>مستودع الملفات ({files.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'users'
                  ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={16} />
              <span>إدارة الحسابات ({users.filter(u => u.hasCacheAccess).length} ☠️)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'logs'
                  ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity size={16} />
              <span>سجل العمليات</span>
            </button>
          </div>
        </div>

        {/* Real-time KPI Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>إجمالي الملفات</span>
                <FolderArchive size={14} className="text-red-400" />
              </div>
              <div className="text-xl font-black text-white mt-1 font-mono">{stats.totalFiles}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">ملف مخزن سحابياً</div>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>الحجم الإجمالي</span>
                <HardDrive size={14} className="text-cyan-400" />
              </div>
              <div className="text-xl font-black text-cyan-300 mt-1 font-mono">{formatFileSize(stats.totalSizeBytes)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">سعة التخزين المستهلكة</div>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-red-500/30 bg-red-950/20">
              <div className="text-xs text-red-300 flex items-center justify-between">
                <span>حسابات الكاش ☠️</span>
                <span className="text-xs">☠️</span>
              </div>
              <div className="text-xl font-black text-red-400 mt-1 font-mono">{stats.activeCacheUsersCount}</div>
              <div className="text-[10px] text-red-400/70 mt-0.5">حسابات مفعلة بصلاحية</div>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>الكاش المعطل</span>
                <ShieldAlert size={14} className="text-amber-400" />
              </div>
              <div className="text-xl font-black text-amber-300 mt-1 font-mono">{stats.disabledCacheUsersCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">مخفي عن المستخدم</div>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>رفع خلال 24 ساعة</span>
                <Clock size={14} className="text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1 font-mono">{stats.recentUploadsCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">ملفات جديدة</div>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>إجمالي التنزيلات</span>
                <Download size={14} className="text-purple-400" />
              </div>
              <div className="text-xl font-black text-purple-300 mt-1 font-mono">{stats.recentDownloadsCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">مرات تحميل الروابط</div>
            </div>
          </div>
        )}
      </div>

      {/* Copy Toast Notification */}
      {copiedLinkInfo && (
        <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-200 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span>{copiedLinkInfo}</span>
          </div>
          <span className="text-xs bg-emerald-950 px-2 py-1 rounded-lg font-mono">رابط سحابي جاهز</span>
        </div>
      )}

      {/* SUB-TAB 1: FILES REPOSITORY */}
      {activeSubTab === 'files' && (
        <div className="space-y-4">
          {/* Controls: Search, User Selector, Sort, Category Filter */}
          <div className="bg-slate-900/80 p-4 rounded-3xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3.5 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="بحث باسم الملف، User ID، SHA-256..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                />
              </div>

              {/* User Selector Filter */}
              <div className="relative">
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none"
                >
                  <option value="all">👤 جميع المستخدمين ({users.length})</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.hasCacheAccess ? '☠️ ' : ''}{u.displayName || u.name} ({u.email || u.numericId || u.id.slice(0, 6)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:border-red-500 outline-none"
                >
                  <option value="newest">🕒 الأحدث رفعاً</option>
                  <option value="oldest">🕰️ الأقدم رفعاً</option>
                  <option value="largest">💾 الحجم الأكبر</option>
                  <option value="smallest">📄 الحجم الأصغر</option>
                  <option value="downloads">📥 الأكثر تحميلاً</option>
                </select>
              </div>

              {/* Reset Filters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setSelectedUserId('all'); setSortBy('newest'); }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw size={14} />
                  <span>إعادة تعيين الفلاتر</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {CATEGORY_TABS.map(tab => {
                const IconComponent = tab.icon;
                const count = tab.id === 'all' 
                  ? files.length 
                  : files.filter(f => f.category === tab.id).length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                      selectedCategory === tab.id
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      selectedCategory === tab.id ? 'bg-red-800 text-white' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Files Grid */}
          {loading ? (
            <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/80">
              <RefreshCw size={32} className="animate-spin text-red-500 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">جاري مزامنة ملفات الكاش السحابية...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800/80">
              <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3 text-2xl">
                📂
              </div>
              <h3 className="text-lg font-bold text-slate-300">لا توجد ملفات كاش مطابقة</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                عند قيام أي مستخدم برفع ملفات من حسابه، سيتم حفظ نسخة مشفرة تلقائياً هنا في التخزين المركزي.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map(file => {
                const uploadDate = file.createdAt?.toDate 
                  ? file.createdAt.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
                  : new Date(file.createdAt).toLocaleString('ar-EG');

                return (
                  <div 
                    key={file.id} 
                    className="bg-slate-900/90 rounded-2xl border border-slate-800/90 p-4 hover:border-red-500/50 hover:shadow-xl hover:shadow-red-950/20 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Card Header: Category & Extension */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${getCategoryBadgeColor(file.category)}`}>
                          {file.category}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-slate-500">
                            .{file.extension || 'bin'}
                          </span>
                        </div>
                      </div>

                      {/* File Name */}
                      <h4 className="font-bold text-white text-sm line-clamp-2 mb-2 group-hover:text-red-300 transition-colors" title={file.fileName}>
                        {file.fileName}
                      </h4>

                      {/* User & Meta Information */}
                      <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-slate-500" />
                            <span className="text-slate-300 font-bold">{file.userName || 'مستخدم'}</span>
                          </span>
                          {file.userNumericId && (
                            <span className="text-[10px] text-slate-500 font-mono">ID: {file.userNumericId}</span>
                          )}
                        </div>

                        {file.userEmail && (
                          <div className="text-[10px] text-slate-500 truncate" title={file.userEmail}>
                            {file.userEmail}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 font-mono">
                          <span>{uploadDate}</span>
                          <span className="text-purple-400 flex items-center gap-1">
                            <Download size={10} />
                            {file.downloadCount || 0}
                          </span>
                        </div>

                        {/* Extra dimension / fps info if available */}
                        {(file.dimensions || file.fps) && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5 font-mono">
                            {file.dimensions && <span>{file.dimensions.width}×{file.dimensions.height}px</span>}
                            {file.fps && <span>{file.fps} FPS</span>}
                            {file.frames && <span>{file.frames} إطار</span>}
                          </div>
                        )}

                        {/* Unique File ID */}
                        <div className="text-[9px] text-slate-600 font-mono flex items-center justify-between pt-1">
                          <span className="truncate">ID: {file.id}</span>
                          <span className="text-slate-600 font-mono">{file.sourceFeature || 'Upload'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="grid grid-cols-4 gap-1.5 mt-4 pt-3 border-t border-slate-800/80">
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 flex items-center justify-center transition-colors text-xs font-bold"
                        title="معاينة الملف"
                      >
                        <Eye size={16} />
                      </button>

                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-300 flex items-center justify-center transition-colors text-xs font-bold"
                        title="تنزيل الملف"
                      >
                        <Download size={16} />
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(file)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-amber-300 flex items-center justify-center transition-colors text-xs font-bold"
                        title="نسخ الرابط المباشر"
                      >
                        {copiedId === file.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setFileToDelete(file)}
                        className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 flex items-center justify-center transition-colors text-xs font-bold"
                        title="حذف من الكاش"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: USERS CACHE ACCESS MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
            <div>
              <h3 className="font-bold text-white text-base">إدارة تفعيل الكاش وصلاحيات الحسابات</h3>
              <p className="text-xs text-slate-400">تفعيل ظهور نظام الكاش وتحديد صلاحيات التحميل والحذف لكل مستخدم</p>
            </div>
            <span className="text-xs font-mono bg-red-950/80 text-red-400 border border-red-500/40 px-3 py-1 rounded-xl font-bold">
              ☠️ {users.filter(u => u.hasCacheAccess).length} حساب مفعّل
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-950 text-slate-400 text-xs border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-4">المستخدم</th>
                  <th className="p-4">الآي دي / البريد</th>
                  <th className="p-4">حالة الكاش ☠️</th>
                  <th className="p-4">عدد الملفات المخزنة</th>
                  <th className="p-4">الصلاحيات</th>
                  <th className="p-4">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {users.map(u => {
                  const userFilesCount = files.filter(f => f.userId === u.id).length;
                  const isEnabled = Boolean(u.hasCacheAccess);

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={u.photoURL || u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} 
                            alt="" 
                            className="w-9 h-9 rounded-full object-cover border border-slate-700" 
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.displayName || u.name}</span>
                              {isEnabled && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-gradient-to-r from-red-950 to-slate-900 text-red-400 border border-red-500/50 shadow-sm shadow-red-950">
                                  ☠️ CACHE ENABLED
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{u.role}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-xs font-mono text-slate-300">{u.numericId || u.id.slice(0, 10)}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleOpenUserPerms(u)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                            isEnabled
                              ? 'bg-gradient-to-r from-red-950 via-slate-900 to-red-950 text-red-400 border-red-500 shadow-red-950/50 hover:brightness-125'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50'
                          }`}
                        >
                          <span>☠️</span>
                          <span>{isEnabled ? 'الكاش مفعّل (ON)' : 'الكاش مخفي (OFF)'}</span>
                        </button>
                      </td>

                      <td className="p-4 font-mono font-bold text-slate-300">
                        {userFilesCount > 0 ? (
                          <button
                            onClick={() => { setSelectedUserId(u.id); setActiveSubTab('files'); }}
                            className="text-red-400 hover:underline flex items-center gap-1"
                          >
                            <span>{userFilesCount} ملف</span>
                            <ChevronRight size={14} />
                          </button>
                        ) : (
                          <span className="text-slate-600">0 ملف</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${u.cachePermissions?.view !== false ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-950 text-slate-600'}`}>عرض</span>
                          <span className={`px-1.5 py-0.5 rounded ${u.cachePermissions?.download !== false ? 'bg-blue-950/60 text-blue-400' : 'bg-slate-950 text-slate-600'}`}>تحميل</span>
                          <span className={`px-1.5 py-0.5 rounded ${u.cachePermissions?.copyLink !== false ? 'bg-amber-950/60 text-amber-400' : 'bg-slate-950 text-slate-600'}`}>نسخ</span>
                          <span className={`px-1.5 py-0.5 rounded ${u.cachePermissions?.delete ? 'bg-red-950/60 text-red-400' : 'bg-slate-950 text-slate-600'}`}>حذف</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleOpenUserPerms(u)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5"
                        >
                          <Key size={14} className="text-amber-400" />
                          <span>تعديل الصلاحية</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ACTIVITY AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
            <div>
              <h3 className="font-bold text-white text-base">سجل عمليات الكاش (Cache Activity Log)</h3>
              <p className="text-xs text-slate-400">سجل أمني متكامل لكافة عمليات الرفع والتحميل والحذف وتغيير الصلاحيات</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{logs.length} سجل مسجل</span>
          </div>

          {loadingLogs ? (
            <div className="text-center py-16">
              <RefreshCw size={24} className="animate-spin text-red-500 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">جاري تحميل السجلات...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              لا توجد عمليات مسجلة بعد.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
              {logs.map(log => {
                const logTime = log.timestamp?.toDate 
                  ? log.timestamp.toDate().toLocaleString('ar-EG') 
                  : new Date(log.timestamp).toLocaleString('ar-EG');

                let badgeColor = 'bg-slate-800 text-slate-300';
                if (log.action === 'file_uploaded') badgeColor = 'bg-emerald-950 text-emerald-400 border border-emerald-800';
                if (log.action === 'file_downloaded') badgeColor = 'bg-blue-950 text-blue-400 border border-blue-800';
                if (log.action === 'file_deleted') badgeColor = 'bg-red-950 text-red-400 border border-red-800';
                if (log.action === 'cache_enabled') badgeColor = 'bg-purple-950 text-purple-400 border border-purple-800';
                if (log.action === 'cache_disabled') badgeColor = 'bg-amber-950 text-amber-400 border border-amber-800';

                return (
                  <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase ${badgeColor}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                        <span className="font-bold text-white text-sm">{log.userName}</span>
                        {log.userEmail && <span className="text-xs text-slate-500">({log.userEmail})</span>}
                      </div>
                      <p className="text-xs text-slate-300">{log.details}</p>
                      {log.fileName && (
                        <div className="text-[11px] text-slate-500 font-mono">الملف: {log.fileName} ({log.fileId})</div>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {logTime}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getCategoryBadgeColor(previewFile.category)}`}>
                  {previewFile.category}
                </span>
                <h3 className="font-bold text-white text-sm truncate">{previewFile.fileName}</h3>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-950/50">
              {previewFile.category === 'video' || previewFile.category === 'vap' ? (
                <video
                  src={previewFile.downloadUrl}
                  controls
                  autoPlay
                  className="max-h-[60vh] max-w-full rounded-2xl shadow-lg border border-slate-800"
                />
              ) : previewFile.category === 'image' ? (
                <img
                  src={previewFile.downloadUrl}
                  alt={previewFile.fileName}
                  className="max-h-[60vh] max-w-full object-contain rounded-2xl shadow-lg border border-slate-800"
                />
              ) : previewFile.category === 'audio' ? (
                <div className="w-full max-w-md p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-4">
                  <Music size={48} className="text-amber-400 mx-auto" />
                  <p className="text-white font-bold">{previewFile.fileName}</p>
                  <audio src={previewFile.downloadUrl} controls className="w-full" />
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-900/60 rounded-2xl border border-slate-800 max-w-md">
                  <FileBox size={48} className="text-purple-400 mx-auto mb-3" />
                  <h4 className="text-white font-bold text-base mb-1">{previewFile.fileName}</h4>
                  <p className="text-xs text-slate-400 mb-4 font-mono">
                    صيغة {previewFile.extension.toUpperCase()} - {formatFileSize(previewFile.size)}
                  </p>
                  <p className="text-xs text-slate-500 mb-4">
                    يمكن تنزيل هذا الملف مباشرة إلى جهازك أو نسخه لاستخدامه في برامج التصميم.
                  </p>
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 shadow-lg"
                  >
                    <Download size={16} />
                    <span>تنزيل الملف المباشر</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap justify-between items-center gap-2">
              <div className="text-xs text-slate-400 font-mono">
                <span>المستخدم: {previewFile.userName} | الحجم: {formatFileSize(previewFile.size)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyLink(previewFile)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy size={14} />
                  <span>نسخ الرابط</span>
                </button>
                <button
                  onClick={() => handleDownload(previewFile)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>تنزيل</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: USER PERMISSIONS / TOGGLE CACHE MODAL */}
      {toggleUserModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-950 border border-red-500/40 flex items-center justify-center text-xl">
                  ☠️
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">إعدادات الكاش ☠️ للمستخدم</h3>
                  <p className="text-xs text-slate-400">{toggleUserModal.displayName || toggleUserModal.name} ({toggleUserModal.email || 'بدون إيميل'})</p>
                </div>
              </div>
              <button onClick={() => setToggleUserModal(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Main Toggle */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span>ظهور وإتاحة الكاش</span>
                  <span className="text-xs">☠️</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {toggleUserModal.hasCacheAccess ? 'الكاش مفعّل وظاهر للحساب حالياً' : 'الكاش مخفي تماماً عن الحساب'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                toggleUserModal.hasCacheAccess ? 'bg-red-950 text-red-400 border border-red-500' : 'bg-slate-800 text-slate-500'
              }`}>
                {toggleUserModal.hasCacheAccess ? 'مفعّل ☠️ ON' : 'معطّل OFF'}
              </span>
            </div>

            {/* Granular Sub-permissions */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">الصلاحيات الممنوحة للمستخدم:</label>
              
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <span className="text-xs text-slate-300">رؤية ومعاينة مستودع الكاش (View Cache)</span>
                <input 
                  type="checkbox" 
                  checked={editPerms.view} 
                  onChange={e => setEditPerms(p => ({ ...p, view: e.target.checked }))}
                  className="rounded text-red-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <span className="text-xs text-slate-300">تنزيل الملفات (Download Cache)</span>
                <input 
                  type="checkbox" 
                  checked={editPerms.download} 
                  onChange={e => setEditPerms(p => ({ ...p, download: e.target.checked }))}
                  className="rounded text-red-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <span className="text-xs text-slate-300">نسخ روابط الملفات (Copy File Link)</span>
                <input 
                  type="checkbox" 
                  checked={editPerms.copyLink} 
                  onChange={e => setEditPerms(p => ({ ...p, copyLink: e.target.checked }))}
                  className="rounded text-red-600 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 cursor-pointer">
                <span className="text-xs text-slate-300">حذف الملفات من الكاش (Delete Cache)</span>
                <input 
                  type="checkbox" 
                  checked={editPerms.delete} 
                  onChange={e => setEditPerms(p => ({ ...p, delete: e.target.checked }))}
                  className="rounded text-red-600 focus:ring-0"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleSaveUserCacheAccess(true)}
                disabled={savingUserPerms}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/50"
              >
                <span>☠️ تفعيل الكاش (ENABLE)</span>
              </button>

              <button
                onClick={() => handleSaveUserCacheAccess(false)}
                disabled={savingUserPerms}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <span>إيقاف / إخفاء (DISABLE)</span>
              </button>

              <button
                onClick={() => setToggleUserModal(null)}
                className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-white text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" dir="rtl">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-950 border border-red-500 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle size={24} />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">تأكيد حذف الملف من الكاش</h3>
              <p className="text-xs text-slate-400">
                هل أنت متأكد من رغبتك في حذف الملف التالي نهائياً من التخزين السحابي وقاعدة البيانات؟
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-1 font-mono">
              <div className="text-white font-bold truncate">{fileToDelete.fileName}</div>
              <div className="text-slate-500 text-[11px]">المستخدم: {fileToDelete.userName} | الحجم: {formatFileSize(fileToDelete.size)}</div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleDelete}
                disabled={deletingFile}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950/50"
              >
                {deletingFile ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>نعم، حذف نهائي</span>
              </button>
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
