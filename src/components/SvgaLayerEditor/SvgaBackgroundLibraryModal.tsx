import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Image as ImageIcon, Download, Star, Check, Upload, Link as LinkIcon, 
  Trash2, RefreshCw, Layers, Sparkles, Search, SlidersHorizontal, 
  ExternalLink, CheckCircle2, ShieldCheck, Heart, Eye
} from 'lucide-react';
import { db, storage } from '../../firebase';
import { collection, onSnapshot, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface BackgroundAsset {
  id: string;
  name: string;
  url: string;
  source: 'dashboard' | 'preset' | 'pinned' | 'upload';
  createdAt?: string | number;
  timestamp?: number;
  type?: 'image' | 'video';
  isPinned?: boolean;
}

// Built-in high-quality preset backgrounds for SVGA testing and gift preview
const DEFAULT_PRESETS: BackgroundAsset[] = [
  {
    id: 'preset_live_stage_neon',
    name: 'مسرح البث المباشر - Neon Live Room',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  },
  {
    id: 'preset_vip_dark_lounge',
    name: 'صالة البث الصوتي الفاخرة - VIP Dark Lounge',
    url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  },
  {
    id: 'preset_concert_lights',
    name: 'أضواء المسرح والحفلات - Concert Lights & Glow',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  },
  {
    id: 'preset_studio_gradient',
    name: 'استوديو نيون الهدايا - Cyber Studio Gradient',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  },
  {
    id: 'preset_luxury_gold_podium',
    name: 'منصة الذهب الفاخرة - Luxury Gold Stage',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  },
  {
    id: 'preset_cosmic_galaxy',
    name: 'الفضاء الكوني والنجوم - Cosmic Aurora Galaxy',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1080&q=80',
    source: 'preset'
  }
];

const PINNED_STORAGE_KEY = 'svga_pinned_backgrounds_v1';

export async function downloadImageUrl(url: string, suggestedName: string = 'background') {
  const safeName = (suggestedName || 'background')
    .trim()
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  const filename = safeName.endsWith('.png') || safeName.endsWith('.jpg') || safeName.endsWith('.webp') 
    ? safeName 
    : `${safeName}.png`;

  try {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  } catch (e) {
    // Direct link trigger if fetch fails
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

interface SvgaBackgroundLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBgUrl: string | null;
  onSelectBackground: (url: string | null, applyToAll: boolean) => void;
  projectsCount: number;
}

export const SvgaBackgroundLibraryModal: React.FC<SvgaBackgroundLibraryModalProps> = ({
  isOpen,
  onClose,
  activeBgUrl,
  onSelectBackground,
  projectsCount
}) => {
  const [dashboardBackgrounds, setDashboardBackgrounds] = useState<BackgroundAsset[]>([]);
  const [pinnedBackgrounds, setPinnedBackgrounds] = useState<BackgroundAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'dashboard' | 'pinned' | 'presets' | 'upload'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [applyToAllProjects, setApplyToAllProjects] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Direct upload or custom URL inputs
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load pinned backgrounds from localStorage
  const loadPinnedFromStorage = (): BackgroundAsset[] => {
    try {
      const raw = localStorage.getItem(PINNED_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse pinned backgrounds:', e);
    }
    return [];
  };

  // Save pinned backgrounds to localStorage
  const savePinnedToStorage = (list: BackgroundAsset[]) => {
    try {
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(list));
      setPinnedBackgrounds(list);
    } catch (e) {
      console.warn('Failed to save pinned backgrounds:', e);
    }
  };

  // Fetch dashboard backgrounds from Firestore
  useEffect(() => {
    if (!isOpen) return;

    // Load local pinned items first
    setPinnedBackgrounds(loadPinnedFromStorage());

    setIsLoading(true);
    let isSubscribed = true;

    // Listen to room_backgrounds from dashboard
    const unsubRoomBgs = onSnapshot(collection(db, 'room_backgrounds'), (snapshot) => {
      if (!isSubscribed) return;
      const items: BackgroundAsset[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.url) {
          items.push({
            id: docSnap.id,
            name: data.name || 'خلفية لوحة التحكم',
            url: data.url,
            source: 'dashboard',
            createdAt: data.createdAt,
            timestamp: data.timestamp,
            type: data.type || 'image'
          });
        }
      });

      // Also try fetching presetBackgrounds and settings global/general
      getDocs(collection(db, 'presetBackgrounds')).then(presetSnap => {
        presetSnap.forEach(docSnap => {
          const data = docSnap.data();
          const candidateUrl = data.url || data.imageUrl || data.backgroundUrl;
          if (candidateUrl && !items.some(i => i.url === candidateUrl)) {
            items.push({
              id: docSnap.id,
              name: data.name || 'خلفية جاهزة',
              url: candidateUrl,
              source: 'dashboard',
              createdAt: data.createdAt
            });
          }
        });

        // Also check settings/general
        getDoc(doc(db, 'settings', 'general')).then(genDoc => {
          if (genDoc.exists()) {
            const defBg = genDoc.data().defaultRoomBackground;
            if (defBg && !items.some(i => i.url === defBg)) {
              items.push({
                id: 'settings_default_room_bg',
                name: 'الخلفية الافتراضية للغرف (الإعدادات العامة)',
                url: defBg,
                source: 'dashboard'
              });
            }
          }
        }).catch(() => {});

        // Also check settings/global
        getDoc(doc(db, 'settings', 'global')).then(globDoc => {
          if (globDoc.exists()) {
            const globBg = globDoc.data().backgroundUrl;
            if (globBg && !items.some(i => i.url === globBg)) {
              items.push({
                id: 'settings_global_bg',
                name: 'الخلفية الرئيسية للمنصة (Global)',
                url: globBg,
                source: 'dashboard'
              });
            }
          }
        }).catch(() => {});

        if (isSubscribed) {
          setDashboardBackgrounds(items);
          setIsLoading(false);
        }
      }).catch(err => {
        console.warn('Error fetching presetBackgrounds:', err);
        if (isSubscribed) {
          setDashboardBackgrounds(items);
          setIsLoading(false);
        }
      });
    }, (err) => {
      console.warn('Firestore room_backgrounds listener error:', err);
      if (isSubscribed) setIsLoading(false);
    });

    return () => {
      isSubscribed = false;
      unsubRoomBgs();
    };
  }, [isOpen]);

  // Check if item is pinned
  const isItemPinned = (item: BackgroundAsset) => {
    return pinnedBackgrounds.some(p => p.url === item.url || p.id === item.id);
  };

  // Toggle pinning
  const togglePin = (item: BackgroundAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const already = isItemPinned(item);
    if (already) {
      const updated = pinnedBackgrounds.filter(p => p.url !== item.url && p.id !== item.id);
      savePinnedToStorage(updated);
    } else {
      const newItem: BackgroundAsset = {
        ...item,
        isPinned: true,
        timestamp: Date.now()
      };
      const updated = [newItem, ...pinnedBackgrounds];
      savePinnedToStorage(updated);
    }
  };

  // Handle single download
  const handleDownload = async (item: BackgroundAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(item.id);
    try {
      await downloadImageUrl(item.url, item.name);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle selecting background
  const handleSelect = (url: string | null) => {
    onSelectBackground(url, applyToAllProjects);
  };

  // Handle custom upload file
  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP)');
      return;
    }

    setIsUploadingFile(true);
    setUploadStatus('جاري معالجة الصورة محلياً وتثبيتها...');

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        setIsUploadingFile(false);
        return;
      }

      const newAsset: BackgroundAsset = {
        id: `upload_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: dataUrl,
        source: 'upload',
        isPinned: true,
        timestamp: Date.now()
      };

      // Automatically pin this uploaded image so user never loses it
      const updatedPinned = [newAsset, ...pinnedBackgrounds];
      savePinnedToStorage(updatedPinned);

      // Apply to projects
      onSelectBackground(dataUrl, applyToAllProjects);
      setIsUploadingFile(false);
      setUploadStatus('تمت إضافة الخلفية وتطبيقها بنجاح!');

      // Also try background upload to Firebase storage for permanence if feasible
      try {
        const storageRef = ref(storage, `official_backgrounds/${Date.now()}_${file.name}`);
        const snap = await uploadBytes(storageRef, file);
        const remoteUrl = await getDownloadURL(snap.ref);
        // Also save to room_backgrounds collection
        await addDoc(collection(db, 'room_backgrounds'), {
          name: newAsset.name,
          url: remoteUrl,
          type: 'image',
          createdAt: new Date().toISOString(),
          timestamp: Date.now()
        });
      } catch (cloudErr) {
        // Local preview remains fully working even if cloud upload is not permitted
        console.warn('Optional cloud storage sync skipped:', cloudErr);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle adding by direct URL
  const handleAddCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;

    const url = customUrlInput.trim();
    const name = customNameInput.trim() || 'خلفية مخصصة';

    const newAsset: BackgroundAsset = {
      id: `url_${Date.now()}`,
      name,
      url,
      source: 'upload',
      isPinned: true,
      timestamp: Date.now()
    };

    const updatedPinned = [newAsset, ...pinnedBackgrounds];
    savePinnedToStorage(updatedPinned);

    onSelectBackground(url, applyToAllProjects);
    setCustomUrlInput('');
    setCustomNameInput('');
  };

  // Combine and deduplicate backgrounds
  const allBackgrounds = useMemo(() => {
    const map = new Map<string, BackgroundAsset>();

    // 1. Dashboard backgrounds
    dashboardBackgrounds.forEach(item => {
      map.set(item.url, { ...item, source: 'dashboard' });
    });

    // 2. Presets
    DEFAULT_PRESETS.forEach(item => {
      if (!map.has(item.url)) {
        map.set(item.url, item);
      }
    });

    // 3. Pinned / Custom
    pinnedBackgrounds.forEach(item => {
      const existing = map.get(item.url);
      if (existing) {
        map.set(item.url, { ...existing, isPinned: true });
      } else {
        map.set(item.url, item);
      }
    });

    return Array.from(map.values());
  }, [dashboardBackgrounds, pinnedBackgrounds]);

  // Filter based on active tab and search query
  const filteredBackgrounds = useMemo(() => {
    let list = allBackgrounds;

    if (activeTab === 'dashboard') {
      list = list.filter(b => b.source === 'dashboard');
    } else if (activeTab === 'pinned') {
      list = list.filter(b => isItemPinned(b) || b.source === 'pinned');
    } else if (activeTab === 'presets') {
      list = list.filter(b => b.source === 'preset');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(b => b.name.toLowerCase().includes(q));
    }

    return list;
  }, [allBackgrounds, activeTab, searchQuery, pinnedBackgrounds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0b0f19] border border-indigo-500/40 rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <ImageIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  مكتبة خلفيات المنصة والداشبورد
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {allBackgrounds.length} خلفية متاحة
                </span>
              </div>
              <p className="text-xs text-slate-400">
                اختر أي خلفية تم رفعها على الموقع لتثبيتها في المعاينة أو تنزيلها بضغطة واحدة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Propagation Toggle */}
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-xs font-bold text-indigo-200 cursor-pointer hover:bg-indigo-900/40 transition-colors">
              <input
                type="checkbox"
                checked={applyToAllProjects}
                onChange={(e) => setApplyToAllProjects(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <Layers size={13} className="text-indigo-400" />
                تطبيق على جميع المشاريع المفتوحة ({projectsCount} مشاريع)
              </span>
            </label>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Tabs, & Upload Trigger */}
        <div className="px-6 py-3 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={13} />
              الكل ({allBackgrounds.length})
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon size={13} className="text-cyan-400" />
              مرفوعة من الداشبورد ({dashboardBackgrounds.length})
            </button>

            <button
              onClick={() => setActiveTab('pinned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'pinned'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Star size={13} className="text-amber-300 fill-amber-300" />
              المثبتة عندي ({pinnedBackgrounds.length})
            </button>

            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={13} />
              خلفيات الاستوديو ({DEFAULT_PRESETS.length})
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload size={13} className="text-purple-300" />
              رفع وتثبيت خلفية جديدة
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم..."
              className="w-full pl-3 pr-9 py-1.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Current Active Background Bar (if any) */}
        {activeBgUrl && (
          <div className="px-6 py-2.5 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium">الخلفية النشطة حالياً للمعاينة:</span>
              <img
                src={activeBgUrl}
                alt="Active Background"
                className="w-7 h-7 rounded-lg object-cover border border-indigo-400/50 shadow-sm"
              />
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                مطبقة {applyToAllProjects ? 'على جميع المشاريع' : 'على المشروع الحالي'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadImageUrl(activeBgUrl, 'current_active_background')}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg border border-indigo-500/40 font-bold transition-all shadow-sm"
                title="تنزيل الخلفية النشطة حالياً"
              >
                <Download size={12} />
                تحميل النشطة
              </button>

              <button
                onClick={() => {
                  handleSelect(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg border border-rose-500/30 font-bold transition-all"
                title="إزالة صورة الخلفية والعودة للخلفية الشفافة المربعة"
              >
                <X size={12} />
                إزالة الخلفية
              </button>
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[380px]">
          {activeTab === 'upload' ? (
            /* Upload & Custom URL View */
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Upload size={32} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">رفع خلفية جديدة من جهازك</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    اختر صورة خلفية من جهازك ليتم تطبيقها على جميع المشاريع وتثبيتها في قائمتك
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCustomFileUpload}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingFile}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
                  >
                    <Upload size={16} />
                    {isUploadingFile ? 'جاري الرفع والمعالجة...' : 'اختيار ملف صورة من الكمبيوتر'}
                  </button>
                </div>

                {uploadStatus && (
                  <p className="text-xs text-emerald-400 font-bold">{uploadStatus}</p>
                )}
              </div>

              {/* Add Via Direct URL */}
              <form onSubmit={handleAddCustomUrl} className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <LinkIcon size={16} className="text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">أو استيراد وتثبيت من رابط مباشر</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">اسم الخلفية (اختياري)</label>
                    <input
                      type="text"
                      value={customNameInput}
                      onChange={(e) => setCustomNameInput(e.target.value)}
                      placeholder="مثال: خلفية منصة التيك توك"
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">رابط الصورة المباشر (Image URL)</label>
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://example.com/background.jpg"
                      required
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!customUrlInput.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  استيراد وتثبيت وتطبيق على جميع المشاريع
                </button>
              </form>
            </div>
          ) : (
            /* Cards Grid View */
            <div>
              {isLoading && dashboardBackgrounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <RefreshCw size={28} className="animate-spin text-indigo-400" />
                  <p className="text-sm">جاري جلب الخلفيات من لوحة التحكم...</p>
                </div>
              ) : filteredBackgrounds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <ImageIcon size={36} className="text-slate-600" />
                  <p className="text-sm">لا توجد خلفيات تطابق بحثك حالياً</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors"
                  >
                    رفع خلفية جديدة الآن
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredBackgrounds.map((bg) => {
                    const isSelected = activeBgUrl === bg.url;
                    const isPinned = isItemPinned(bg);
                    const isDownloading = downloadingId === bg.id;

                    return (
                      <div
                        key={bg.id}
                        onClick={() => handleSelect(bg.url)}
                        className={`group relative flex flex-col bg-slate-900/90 rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer shadow-lg hover:shadow-indigo-950/50 hover:translate-y-[-2px] ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/50 bg-indigo-950/30'
                            : 'border-white/10 hover:border-indigo-400/50'
                        }`}
                      >
                        {/* Thumbnail Viewport */}
                        <div className="relative aspect-[4/3] bg-black/50 overflow-hidden">
                          <img
                            src={bg.url}
                            alt={bg.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* Gradient Vignette */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                          {/* Source Badge */}
                          <div className="absolute top-2 right-2">
                            {bg.source === 'dashboard' ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-600/80 text-white backdrop-blur-sm shadow">
                                لوحة التحكم
                              </span>
                            ) : bg.source === 'preset' ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-600/80 text-white backdrop-blur-sm shadow">
                                جاهزة
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-600/80 text-white backdrop-blur-sm shadow">
                                مثبتة
                              </span>
                            )}
                          </div>

                          {/* Top-Left Action Icons: Pin & Download */}
                          <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                            {/* Pin / Star Button */}
                            <button
                              type="button"
                              onClick={(e) => togglePin(bg, e)}
                              className={`p-1.5 rounded-lg backdrop-blur-md transition-all shadow-md ${
                                isPinned
                                  ? 'bg-amber-500 text-white shadow-amber-900/40'
                                  : 'bg-black/60 text-slate-300 hover:text-amber-300 hover:bg-black/90'
                              }`}
                              title={isPinned ? 'مثبتة في قائمتك (انقر لإلغاء التثبيت)' : 'تثبيت هذه الخلفية عندي'}
                            >
                              <Star size={13} className={isPinned ? 'fill-white' : ''} />
                            </button>

                            {/* Download Button */}
                            <button
                              type="button"
                              onClick={(e) => handleDownload(bg, e)}
                              disabled={isDownloading}
                              className="p-1.5 rounded-lg bg-black/60 hover:bg-indigo-600 text-slate-300 hover:text-white backdrop-blur-md transition-all shadow-md"
                              title="تحميل هذه الخلفية على جهازك"
                            >
                              <Download size={13} className={isDownloading ? 'animate-bounce' : ''} />
                            </button>
                          </div>

                          {/* Selected Active Checkmark */}
                          {isSelected && (
                            <div className="absolute inset-0 bg-emerald-950/40 border-2 border-emerald-400 flex items-center justify-center pointer-events-none">
                              <span className="bg-emerald-500 text-white px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg">
                                <Check size={14} /> مطبقة الآن
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Card Info & Quick Apply Action */}
                        <div className="p-3 flex flex-col gap-1.5 bg-[#0e1424]">
                          <span className="text-xs font-bold text-white truncate" title={bg.name}>
                            {bg.name}
                          </span>

                          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => handleSelect(bg.url)}
                              className={`w-full py-1 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white border border-white/10'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check size={11} />
                                  <span>مطبقة في الكانفاس</span>
                                </>
                              ) : (
                                <>
                                  <Layers size={11} />
                                  <span>تطبيق على {applyToAllProjects ? 'الكل' : 'المشروع'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">
              💡 نصيحة: انقر على أي خلفية لمعاينتها فوراً خلف هدايا SVGA والفيديوهات، أو اضغط زر التنزيل لحفظها على جهازك.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
