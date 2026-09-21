import React, { useState, useEffect, useMemo } from 'react';
import { UserRecord, CacheFileRecord, CacheCategory } from '../types';
import { 
  getUserCacheFiles, 
  formatFileSize, 
  recordFileDownload, 
  recordLinkCopied, 
  deleteCacheFile 
} from '../services/cacheService';
import { 
  X, 
  Search, 
  Download, 
  Copy, 
  Check, 
  Eye, 
  Trash2, 
  FolderArchive, 
  Layers, 
  Video, 
  Image as ImageIcon, 
  Music, 
  FileCode, 
  FileText, 
  FileBox, 
  RefreshCw, 
  HardDrive,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface UserCacheModalProps {
  currentUser: UserRecord;
  onClose: () => void;
}

const CATEGORIES: { id: string; label: string; icon: any }[] = [
  { id: 'all', label: 'الكل', icon: FolderArchive },
  { id: 'svga', label: 'SVGA', icon: Layers },
  { id: 'vap', label: 'VAP', icon: Video },
  { id: 'video', label: 'فيديو MP4', icon: Video },
  { id: 'image', label: 'الصور والتصاميم', icon: ImageIcon },
  { id: 'audio', label: 'الصوتيات', icon: Music },
  { id: 'pag', label: 'PAG', icon: FileCode },
  { id: 'json', label: 'Lottie JSON', icon: FileText },
  { id: 'other', label: 'أخرى', icon: FileBox }
];

export const UserCacheModal: React.FC<UserCacheModalProps> = ({ currentUser, onClose }) => {
  const [files, setFiles] = useState<CacheFileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<CacheFileRecord | null>(null);
  const [fileToDelete, setFileToDelete] = useState<CacheFileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = Boolean(currentUser?.isSuperAdmin || currentUser?.role === 'admin' || currentUser?.cachePermissions?.delete);
  const canCopyLink = currentUser?.cachePermissions?.copyLink !== false;
  const canDownload = currentUser?.cachePermissions?.download !== false;

  useEffect(() => {
    loadFiles();
  }, [currentUser.id]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const userFiles = await getUserCacheFiles(currentUser.id);
      setFiles(userFiles);
    } catch (e) {
      console.error("Failed to load user cache:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (f.fileName || '').toLowerCase().includes(q);
        const matchesOriginal = (f.originalName || '').toLowerCase().includes(q);
        const matchesId = (f.id || '').toLowerCase().includes(q);
        if (!matchesName && !matchesOriginal && !matchesId) return false;
      }
      return true;
    });
  }, [files, selectedCategory, searchQuery]);

  const totalSize = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [files]);

  const handleCopyLink = (file: CacheFileRecord) => {
    if (!canCopyLink) return;
    const link = file.downloadUrl || `${window.location.origin}/api/cache/file/${file.id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(file.id);
    setCopiedMessage(`تم نسخ الرابط المباشر للملف`);
    recordLinkCopied(file, currentUser);
    setTimeout(() => {
      setCopiedId(null);
      setCopiedMessage(null);
    }, 3000);
  };

  const handleDownload = (file: CacheFileRecord) => {
    if (!canDownload) return;
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
    if (!fileToDelete) return;
    setDeleting(true);
    try {
      await deleteCacheFile(fileToDelete, {
        id: currentUser.id,
        name: currentUser.displayName || currentUser.name || 'User',
        email: currentUser.email,
        role: currentUser.role
      });
      setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
      setFileToDelete(null);
    } catch (e: any) {
      alert(`تعذر حذف الملف: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-l from-slate-950 via-slate-900 to-red-950/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-slate-950 border border-red-500/50 flex items-center justify-center text-2xl shadow-lg shadow-red-950">
              ☠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">سحابة ملفاتي (User Cloud Cache)</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                  ☠️ CACHE ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تخزين سحابي مركزي يحفظ كافة الملفات المرفوعة من حسابك مع إمكانية التنزيل والنسخ من أي جهاز
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats Strip & Search */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="بحث في ملفاتك السحابية..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-1.5">
                <FolderArchive size={14} className="text-red-400" />
                <span>{files.length} ملف</span>
              </div>
              <div className="bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-300 flex items-center gap-1.5">
                <HardDrive size={14} className="text-cyan-400" />
                <span>{formatFileSize(totalSize)}</span>
              </div>
              <button
                onClick={loadFiles}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white"
                title="تحديث"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs font-bold">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const count = cat.id === 'all' ? files.length : files.filter(f => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all border ${
                    selectedCategory === cat.id
                      ? 'bg-red-600 text-white border-red-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.label}</span>
                  <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-md font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Copy Toast */}
        {copiedMessage && (
          <div className="bg-emerald-950 border-b border-emerald-800 px-4 py-2 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {copiedMessage}
            </span>
            <span className="font-mono text-[10px]">جاهز للاستخدام</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-20">
              <RefreshCw size={28} className="animate-spin text-red-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">جاري تحميل ملفات الكاش...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <FolderArchive size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-slate-400">لا توجد ملفات في هذا القسم</p>
              <p className="text-xs text-slate-600 mt-1">أي ملف تقوم برفعه من حسابك سيظهر هنا تلقائياً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredFiles.map(file => {
                const dateStr = file.createdAt?.toDate 
                  ? file.createdAt.toDate().toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={file.id}
                    className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 hover:border-red-500/40 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-900 text-slate-400 border border-slate-800">
                          {file.category}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{formatFileSize(file.size)}</span>
                      </div>

                      <h4 className="font-bold text-white text-xs line-clamp-2 mb-1 group-hover:text-red-300 transition-colors" title={file.fileName}>
                        {file.fileName}
                      </h4>

                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between mt-2 pt-2 border-t border-slate-900">
                        <span>{dateStr}</span>
                        <span>.{file.extension}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 mt-3 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 flex items-center justify-center text-xs"
                        title="معاينة"
                      >
                        <Eye size={14} />
                      </button>

                      {canDownload && (
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 flex items-center justify-center text-xs"
                          title="تنزيل"
                        >
                          <Download size={14} />
                        </button>
                      )}

                      {canCopyLink && (
                        <button
                          onClick={() => handleCopyLink(file)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 flex items-center justify-center text-xs"
                          title="نسخ الرابط"
                        >
                          {copiedId === file.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => setFileToDelete(file)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 flex items-center justify-center text-xs"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-500 font-mono">
          <span>الحساب: {currentUser.displayName || currentUser.name}</span>
          <span>آمن ومشفر سحابياً ☠️</span>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-4 overflow-hidden space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white text-sm truncate">{previewFile.fileName}</h4>
              <button onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex items-center justify-center min-h-[250px] bg-black/50 rounded-2xl p-4">
              {previewFile.category === 'video' || previewFile.category === 'vap' ? (
                <video src={previewFile.downloadUrl} controls autoPlay className="max-h-[50vh] rounded-xl" />
              ) : previewFile.category === 'image' ? (
                <img src={previewFile.downloadUrl} alt="" className="max-h-[50vh] object-contain rounded-xl" />
              ) : previewFile.category === 'audio' ? (
                <audio src={previewFile.downloadUrl} controls className="w-full" />
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  صيغة {previewFile.extension.toUpperCase()} - اضغط تنزيل للاستخدام
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleDownload(previewFile)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>تنزيل الملف</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-3xl w-full max-w-sm p-5 space-y-4 text-center">
            <h4 className="font-bold text-white text-base">تأكيد حذف الملف من الكاش؟</h4>
            <p className="text-xs text-slate-400 font-mono truncate">{fileToDelete.fileName}</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                {deleting ? 'جاري الحذف...' : 'نعم، حذف'}
              </button>
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
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
