import React, { useState, useEffect, useRef } from 'react';
import { Settings, Gift, Diamond, Mic, List, Plus, Trash2, Edit2, Check, X, ShieldAlert, Gamepad2, Image as ImageIcon, TrendingUp, ShoppingBag, Layout, Users, RefreshCw, Upload, Loader2, Star, Briefcase, Crown, Smile, FileText, Radio } from 'lucide-react';
import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, setDoc, onSnapshot, DocumentSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import BannersTab from './admin/BannersTab';
import UsersTab from './admin/UsersTab';
import RoomBackgroundsTab from './admin/RoomBackgroundsTab';
import AdminResetTab from './admin/AdminResetTab';
import CPTab from './admin/CPTab';
import GamesTab from './admin/GamesTab';
import ActiveRoomsTab from './admin/ActiveRoomsTab';
import AppSettingsTab from './admin/AppSettingsTab';

import AppIconsTab from './admin/AppIconsTab';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const checkAdmin = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          }
        } catch (error) {
          console.error("Error checking admin status", error);
        } finally {
          setLoading(false);
        }
      };
      checkAdmin();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-full">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">عذراً، لا تملك صلاحية الدخول</h2>
        <p className="text-gray-500 mt-2">هذه الصفحة مخصصة للمسؤولين فقط.</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'gifts': return <AddGiftTab />;
      case 'games': return <GamesTabOld />;
      case 'gameCenter': return <GamesTab />;
      case 'store': return <StoreTab />;
      case 'icons': return <AppIconsTab />;
      case 'giftBox': return <GiftBoxTab />;
      case 'badges': return <BadgesTab />;
      case 'diamonds': return <DiamondsTab />;
      case 'agencies': return <AgenciesTab />;
      case 'vip': return <VIPTab />;
      case 'gift_categories': return <GiftCategoriesTab />;
      case 'login_settings': return <LoginSettingsTab />;
      case 'mics': return <MicsTab />;
      case 'banners': return <BannersTab />;
      case 'cp': return <CPTab />;
      case 'backgrounds': return <RoomBackgroundsTab />;
      case 'emotes': return <EmotesTab />;
      case 'myAccount': return <MyAdminAccountTab />;
      case 'reset': return <AdminResetTab />;
      case 'users': return <UsersTab />;
      case 'active_rooms': return <ActiveRoomsTab />;
      case 'app_settings': return <AppSettingsTab />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      <div className="bg-white p-4 shadow-sm z-10">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-purple-600" />
          لوحة تحكم الإدارة
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <TabCard onClick={() => setActiveTab('gifts')} icon={<Plus size={24} />} label="إضافة هدية" />
          <TabCard onClick={() => setActiveTab('games')} icon={<Gamepad2 size={24} />} label="الألعاب (هدايا الحظ)" />
          <TabCard onClick={() => setActiveTab('gameCenter')} icon={<Gamepad2 size={24} />} label="مركز الألعاب" />
          <TabCard onClick={() => setActiveTab('store')} icon={<ShoppingBag size={24} />} label="المتجر (إطارات)" />
          <TabCard onClick={() => setActiveTab('icons')} icon={<ImageIcon size={24} />} label="بنك الأيقونات" />
          <TabCard onClick={() => setActiveTab('giftBox')} icon={<Gift size={24} />} label="صندوق الهدايا" />
          <TabCard onClick={() => setActiveTab('badges')} icon={<Star size={24} />} label="الأوسمة" />
          <TabCard onClick={() => setActiveTab('diamonds')} icon={<Diamond size={24} />} label="شحن الألماس" />
          <TabCard onClick={() => setActiveTab('agencies')} icon={<Briefcase size={24} />} label="وكالات الشحن" />
          <TabCard onClick={() => setActiveTab('vip')} icon={<Crown size={24} />} label="نظام VIP" />
          <TabCard onClick={() => setActiveTab('gift_categories')} icon={<List size={24} />} label="أقسام الهدايا" />
          <TabCard onClick={() => setActiveTab('login_settings')} icon={<Layout size={24} />} label="إعدادات صفحة الدخول" />
          <TabCard onClick={() => setActiveTab('mics')} icon={<Mic size={24} />} label="إدارة المايكات" />
          <TabCard onClick={() => setActiveTab('banners')} icon={<ImageIcon size={24} />} label="البنرات" />
          <TabCard onClick={() => setActiveTab('cp')} icon={<Users size={24} />} label="إعدادات الـ CP" />
          <TabCard onClick={() => setActiveTab('backgrounds')} icon={<ImageIcon size={24} />} label="خلفيات الغرف" />
          <TabCard onClick={() => setActiveTab('emotes')} icon={<Smile size={24} />} label="الإيموشنات" />
          <TabCard onClick={() => setActiveTab('myAccount')} icon={<Users size={24} />} label="حسابي (المدير)" />
          <TabCard onClick={() => setActiveTab('reset')} icon={<RefreshCw size={24} />} label="إعادة تعيين الحساب" />
          <TabCard onClick={() => setActiveTab('users')} icon={<List size={24} />} label="سجلات الدخول" />
          <TabCard onClick={() => setActiveTab('active_rooms')} icon={<Radio size={24} />} label="الغرف المتصلة (النشطة)" />
          <TabCard onClick={() => setActiveTab('app_settings')} icon={<Settings size={24} />} label="إعدادات التطبيق" />
        </div>
      </div>

      {/* Full Screen Tab View */}
      {activeTab && (
        <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col">
          <div className="bg-white p-4 shadow-sm flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {activeTab}
            </h2>
            <button 
              onClick={() => setActiveTab(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {renderTabContent()}
          </div>
        </div>
      )}
    </div>
  );
}

function TabCard({ onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all group"
    >
      <div className="p-3 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </button>
  );
}

function StoreTab() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('mic_frame');
  const [filterType, setFilterType] = useState('all');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [duration, setDuration] = useState('4');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'image' | 'audio'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'store_items'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'image' | 'audio' = 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = target === 'audio' ? 'store_audio' : `store_items/${type}`;
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (target === 'audio') setAudioUrl(downloadURL);
      else setImageUrl(downloadURL);
      
      if (!name) setName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !imageUrl || !price) return alert('الرجاء تعبئة جميع الحقول الأساسية');
    
    setIsSaving(true);
    try {
      const itemData: any = {
        name,
        imageUrl,
        price: Number(price),
        type,
        timestamp: Date.now()
      };

      if (type === 'entrance') {
        itemData.isFullScreen = isFullScreen;
        itemData.audioUrl = audioUrl;
        itemData.duration = Number(duration) || 4;
      }

      await addDoc(collection(db, 'store_items'), itemData);
      
      setName('');
      setImageUrl('');
      setPrice('');
      setAudioUrl('');
      setIsFullScreen(false);
      setDuration('4');
      alert('تم إضافة العنصر بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      await deleteDoc(doc(db, 'store_items', id));
    }
  };

  const itemTypes = [
    { id: 'mic_frame', label: 'إطار مايك' },
    { id: 'mic_icon', label: 'شكل مايك' },
    { id: 'entrance', label: 'دخولية' },
    { id: 'chat_bubble', label: 'فقاعة دردشة' },
    { id: 'text_color', label: 'لون كتابة' },
    { id: 'room_background', label: 'خلفية غرفة' }
  ];

  const filteredItems = filterType === 'all' ? items : items.filter(item => item.type === filterType);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4">إضافة عنصر جديد للمتجر</h2>
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع العنصر</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white">
                {itemTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العنصر</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="مثال: إطار ذهبي" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e, uploadTarget)}
              accept={uploadTarget === 'audio' ? "audio/*" : (type === 'room_background' || type === 'entrance' ? "image/*,video/*" : "image/*")}
              className="hidden"
            />
            {isUploading ? (
              <>
                <Loader2 size={24} className="text-purple-600 animate-spin" />
                <span className="text-sm text-gray-600">جاري الرفع...</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setUploadTarget('image'); setTimeout(() => fileInputRef.current?.click(), 0); }}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition shadow-sm"
                >
                  <Upload size={18} className="text-purple-600" />
                  رفع ملف من الجهاز
                </button>
                <span className="text-[10px] text-gray-400">يمكنك رفع صور أو فيديوهات MP4 حسب نوع العنصر</span>
              </>
            )}
            {imageUrl && (
              <div className="mt-2 w-full max-w-[200px] aspect-video rounded-lg overflow-hidden border border-gray-200 bg-black">
                {imageUrl.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
                  <video src={imageUrl || undefined} className="w-full h-full object-cover" autoPlay muted loop />
                ) : (
                  <img src={imageUrl || undefined} className="w-full h-full object-cover" />
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'text_color' ? 'كود اللون (مثال: #FF0000)' : 
               type === 'room_background' ? 'رابط الخلفية (صورة أو فيديو MP4)' : 
               'رابط الصورة / التأثير (PNG شفاف أو GIF)'}
            </label>
            <input type={type === 'text_color' ? 'text' : 'url'} value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-left" dir="ltr" placeholder={type === 'text_color' ? '#...' : 'https://...'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">السعر (بالألماس)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="مثال: 500" />
          </div>
          
          {type === 'entrance' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold text-sm text-gray-800">إعدادات الدخولية</h4>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isFullScreen" checked={isFullScreen} onChange={e => setIsFullScreen(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <label htmlFor="isFullScreen" className="text-sm text-gray-700">ملء الشاشة بالكامل (بدون نصوص)</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصوت (اختياري)</label>
                <div className="flex gap-2">
                  <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-left" dir="ltr" placeholder="https://... (MP3/WAV)" />
                  <button type="button" onClick={() => { setUploadTarget('audio'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
                </div>
                {audioUrl && <audio controls src={audioUrl} className="mt-2 w-full h-8" />}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مدة العرض (بالثواني)</label>
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" min="1" max="15" />
              </div>
            </div>
          )}

          <button type="submit" disabled={isSaving || isUploading} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50">
            {isSaving ? 'جاري الإضافة...' : 'إضافة العنصر'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">العناصر الحالية</h2>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1 text-sm bg-white">
            <option value="all">الكل</option>
            {itemTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center relative">
              <button onClick={() => handleDelete(item.id)} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-md transition z-20">
                <Trash2 size={16} />
              </button>
              <div className="w-16 h-16 bg-gray-100 rounded-full mb-3 relative flex items-center justify-center overflow-hidden">
                {item.type === 'text_color' ? (
                  <div className="w-full h-full" style={{ backgroundColor: item.imageUrl }}></div>
                ) : (
                  <img src={item.imageUrl} alt={item.name} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${item.type === 'mic_frame' ? 'scale-125' : ''}`} />
                )}
                {item.type === 'mic_frame' && <Mic size={20} className="text-gray-400" />}
              </div>
              <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500 mb-1">
                {itemTypes.find(t => t.id === item.type)?.label || item.type}
              </span>
              <h3 className="font-bold text-sm text-center">{item.name}</h3>
              <p className="text-yellow-600 font-bold text-xs mt-1">{item.price} 💎</p>
            </div>
          ))}
          {filteredItems.length === 0 && <p className="text-gray-500 text-sm col-span-full text-center py-4">لا توجد عناصر مضافة حالياً</p>}
        </div>
      </div>
    </div>
  );
}



function BadgesTab() {
  const [badges, setBadges] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'badges'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBadges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `badges/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setImageUrl(downloadURL);
      if (!name) setName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !imageUrl) return alert('الرجاء تعبئة جميع الحقول');
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'badges'), {
        name,
        imageUrl,
        timestamp: Date.now()
      });
      setName('');
      setImageUrl('');
      alert('تم إضافة الوسام بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الوسام؟')) {
      await deleteDoc(doc(db, 'badges', id));
    }
  };

  const [assignUserId, setAssignUserId] = useState('');
  const [selectedBadge, setSelectedBadge] = useState<any>(null);

  const handleAssignBadge = async () => {
    if (!assignUserId || !selectedBadge) return alert('الرجاء إدخال ID المستخدم واختيار وسام');
    
    try {
      // Find user by numericId
      const usersRef = collection(db, 'users');
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      const userDoc = querySnapshot.docs.find(doc => doc.data().numericId === assignUserId);
      
      if (!userDoc) return alert('المستخدم غير موجود');

      const userData = userDoc.data();
      const currentBadges = userData.badges || [];
      
      if (currentBadges.some((b: any) => b.id === selectedBadge.id)) {
        return alert('المستخدم يملك هذا الوسام بالفعل');
      }

      await updateDoc(doc(db, 'users', userDoc.id), {
        badges: [...currentBadges, { id: selectedBadge.id, name: selectedBadge.name, imageUrl: selectedBadge.imageUrl }]
      });

      alert(`تم منح وسام ${selectedBadge.name} للمستخدم ${userData.displayName} بنجاح`);
      setAssignUserId('');
      setSelectedBadge(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4">إضافة وسام جديد</h2>
        <form onSubmit={handleAddBadge} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الوسام</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="مثال: وسام الملك" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الوسام (PNG أو GIF)</label>
            <div className="flex gap-2">
              <input 
                type="url" 
                value={imageUrl} 
                onChange={e => setImageUrl(e.target.value)} 
                placeholder="https://..." 
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-left" 
                dir="ltr" 
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm">
                <Upload size={18} className="text-purple-600" />
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            {isUploading ? (
              <Loader2 size={24} className="text-purple-600 animate-spin" />
            ) : (
              !imageUrl && <span className="text-sm text-gray-500">ارفع صورة أو ضع رابطاً في الأعلى</span>
            )}
            {imageUrl && <img src={imageUrl} className="w-16 h-16 object-contain mt-2" />}
          </div>

          <button type="submit" disabled={isSaving || isUploading} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50">
            {isSaving ? 'جاري الإضافة...' : 'إضافة الوسام'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4">منح وسام لمستخدم</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">ID المستخدم (الرقمي)</label>
            <input type="text" value={assignUserId} onChange={e => setAssignUserId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="مثال: 1234567" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">اختر الوسام</label>
            <select 
              value={selectedBadge?.id || ''} 
              onChange={e => setSelectedBadge(badges.find(b => b.id === e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white"
            >
              <option value="">اختر وساماً...</option>
              {badges.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <button onClick={handleAssignBadge} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">
            منح الوسام
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4">الأوسمة الحالية</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges.map(badge => (
            <div key={badge.id} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center relative">
              <button onClick={() => handleDelete(badge.id)} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded-md transition">
                <Trash2 size={16} />
              </button>
              <img src={badge.imageUrl} alt={badge.name} className="w-16 h-16 object-contain mb-2" />
              <h3 className="font-bold text-sm text-center">{badge.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Tabs Components ---

function AddGiftTab() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState('6');
  const [hasAnimation, setHasAnimation] = useState(true);
  const [animationSize, setAnimationSize] = useState('normal');
  const [category, setCategory] = useState('classic');
  const [giftEffect, setGiftEffect] = useState('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<'image' | 'animation' | 'audio'>('image');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'gift_categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = uploadTarget === 'audio' ? 'gift_audio' : 'gift_animations';
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (uploadTarget === 'image') setImageUrl(downloadURL);
      else if (uploadTarget === 'animation') setLink(downloadURL);
      else if (uploadTarget === 'audio') setAudioUrl(downloadURL);
      
      if (!name) setName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return alert('يرجى إدخال اسم وقيمة الهدية');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'gifts'), {
        name,
        description,
        imageUrl,
        link,
        audioUrl,
        value: Number(value),
        duration: Number(duration),
        hasAnimation,
        animationSize,
        category,
        giftEffect,
        createdAt: new Date().toISOString()
      });
      alert('تم إضافة الهدية بنجاح!');
      setName(''); setDescription(''); setImageUrl(''); setLink(''); setAudioUrl(''); setValue(''); setDuration('6'); setHasAnimation(true); setAnimationSize('normal'); setCategory('classic'); setGiftEffect('none');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">إضافة هدية جديدة</h2>
      <form onSubmit={handleAddGift} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الهدية</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">قسم الهدية</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
              <option value="classic">كلاسيك (عادية)</option>
              <option value="lucky">هدايا الحظ</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الهدية (الأيقونة التي تظهر في الصندوق)</label>
          <div className="flex gap-2">
            <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('image'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الهدية (MP4, GIF, PNG - اختياري)</label>
          <div className="flex gap-2">
            <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="إذا تركته فارغاً سيتم استخدام صورة الهدية للأنيميشن" className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('animation'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صوت الهدية (MP3, WAV - اختياري)</label>
          <div className="flex gap-2">
            <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="رابط ملف صوتي يعمل عند رمي الهدية" className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('audio'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept={uploadTarget === 'audio' ? "audio/*" : (uploadTarget === 'animation' ? "image/*,video/*" : "image/*")} 
          className="hidden" 
        />
        
        {isUploading && (
          <div className="flex items-center gap-2 text-purple-600 text-sm font-bold bg-purple-50 p-2 rounded-lg">
            <Loader2 size={16} className="animate-spin" />
            جاري رفع الملف...
          </div>
        )}

        {(imageUrl || link) && (
          <div className="flex gap-4 mt-2">
            {imageUrl && (
              <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                <img src={imageUrl} className="w-full h-full object-contain" />
                <p className="text-[8px] text-center bg-black/50 text-white py-0.5">الأيقونة</p>
              </div>
            )}
            {link && (
              <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-black">
                {link.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
                  <video src={link} className="w-full h-full object-contain" autoPlay muted loop />
                ) : (
                  <img src={link} className="w-full h-full object-contain" />
                )}
                <p className="text-[8px] text-center bg-black/50 text-white py-0.5">التأثير</p>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الهدية (ألماس)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مدة ظهور الهدية (بالثواني)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">حجم تأثير الهدية على الشاشة (الأنيميشن)</label>
            <select value={animationSize} onChange={e => setAnimationSize(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
              <option value="normal">عادي (متوسط في المنتصف)</option>
              <option value="large">كبير (يأخذ مساحة أكبر)</option>
              <option value="fullscreen">شاشة كاملة (يملأ الغرفة بالكامل)</option>
            </select>
          </div>
          {category === 'lucky' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تأثير حركة الهدية (CSS Effect)</label>
              <select value={giftEffect} onChange={e => setGiftEffect(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                <option value="none">بدون تأثير إضافي</option>
                <option value="shake">اهتزاز (Shake)</option>
                <option value="pulse">نبض (Pulse)</option>
                <option value="spin">دوران (Spin)</option>
                <option value="bounce">قفز (Bounce)</option>
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
            <input type="checkbox" checked={hasAnimation} onChange={e => setHasAnimation(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
            <span className="text-sm font-bold text-gray-700">تفعيل تأثير الشاشة الكاملة (أنيميشن) عند إرسال هذه الهدية</span>
          </label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الإضافة...' : 'إضافة الهدية'}
        </button>
      </form>
    </div>
  );
}

function GamesTabOld() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [value, setValue] = useState('');
  const [duration, setDuration] = useState('6');
  const [winProbability, setWinProbability] = useState('20');
  const [winMultiplier, setWinMultiplier] = useState('5');
  const [giftEffect, setGiftEffect] = useState('normal');
  const [hasAnimation, setHasAnimation] = useState(true);
  const [animationSize, setAnimationSize] = useState('normal');
  const [giftSize, setGiftSize] = useState('50');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<'image' | 'animation' | 'audio'>('image');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = uploadTarget === 'audio' ? 'gift_audio' : 'gift_animations';
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (uploadTarget === 'image') setImageUrl(downloadURL);
      else if (uploadTarget === 'animation') setLink(downloadURL);
      else if (uploadTarget === 'audio') setAudioUrl(downloadURL);
      
      if (!name) setName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const [bigWinConfig, setBigWinConfig] = useState({ threshold: 1000, audioUrl: '' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'big_win_config'));
      if (docSnap.exists()) {
        setBigWinConfig(docSnap.data() as any);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveBigWinConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'big_win_config'), bigWinConfig);
      alert('تم حفظ إعدادات الفوز الكبير بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAddLuckyGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !value) return alert('يرجى إدخال اسم وقيمة الهدية');
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'gifts'), {
        name,
        description,
        imageUrl,
        link,
        audioUrl,
        value: Number(value),
        duration: Number(duration),
        winProbability: Number(winProbability),
        winMultiplier: Number(winMultiplier),
        giftEffect,
        hasAnimation,
        animationSize,
        giftSize: Number(giftSize),
        category: 'lucky',
        createdAt: new Date().toISOString()
      });
      alert('تم إضافة هدية الحظ بنجاح!');
      setName(''); setDescription(''); setImageUrl(''); setLink(''); setAudioUrl(''); setValue(''); setDuration('6');
      setWinProbability('20'); setWinMultiplier('5'); setGiftEffect('normal'); setHasAnimation(true); setAnimationSize('normal'); setGiftSize('50');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">إعدادات الفوز الكبير (شريط عالي)</h2>
        <form onSubmit={handleSaveBigWinConfig} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للفوز الكبير (بالألماس)</label>
              <input type="number" value={bigWinConfig.threshold} onChange={e => setBigWinConfig({...bigWinConfig, threshold: Number(e.target.value)})} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصوت (MP3, WAV)</label>
              <input type="url" value={bigWinConfig.audioUrl} onChange={e => setBigWinConfig({...bigWinConfig, audioUrl: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" placeholder="https://..." />
            </div>
          </div>
          <button type="submit" disabled={isSavingConfig} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition disabled:opacity-50">
            {isSavingConfig ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">إضافة هدية حظ (قسم الألعاب)</h2>
        <form onSubmit={handleAddLuckyGift} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم الهدية</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الهدية (الأيقونة التي تظهر في الصندوق)</label>
          <div className="flex gap-2">
            <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('image'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الهدية (MP4, GIF, PNG - اختياري)</label>
          <div className="flex gap-2">
            <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="إذا تركته فارغاً سيتم استخدام صورة الهدية للأنيميشن" className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('animation'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رابط صوت الهدية (MP3, WAV - اختياري)</label>
          <div className="flex gap-2">
            <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="رابط ملف صوتي يعمل عند رمي الهدية" className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
            <button type="button" onClick={() => { setUploadTarget('audio'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept={uploadTarget === 'audio' ? "audio/*" : (uploadTarget === 'animation' ? "image/*,video/*" : "image/*")} 
          className="hidden" 
        />
        
        {isUploading && (
          <div className="flex items-center gap-2 text-purple-600 text-sm font-bold bg-purple-50 p-2 rounded-lg">
            <Loader2 size={16} className="animate-spin" />
            جاري رفع الملف...
          </div>
        )}

        {(imageUrl || link) && (
          <div className="flex gap-4 mt-2">
            {imageUrl && (
              <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                <img src={imageUrl} className="w-full h-full object-contain" />
                <p className="text-[8px] text-center bg-black/50 text-white py-0.5">الأيقونة</p>
              </div>
            )}
            {link && (
              <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-black">
                {link.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
                  <video src={link} className="w-full h-full object-contain" autoPlay muted loop />
                ) : (
                  <img src={link} className="w-full h-full object-contain" />
                )}
                <p className="text-[8px] text-center bg-black/50 text-white py-0.5">التأثير</p>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الهدية (ألماس)</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مدة ظهور الهدية (بالثواني)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الفوز (%)</label>
            <input type="number" value={winProbability} onChange={e => setWinProbability(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" max="100" />
            <p className="text-[10px] text-gray-500 mt-1">مثال: 20 يعني 20% فوز</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">مضاعف الربح (عند الفوز)</label>
            <input type="number" value={winMultiplier} onChange={e => setWinMultiplier(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" step="0.1" />
            <p className="text-[10px] text-gray-500 mt-1">مثال: 5 يعني إذا فاز المستخدم سيربح (قيمة الهدية × 5)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تأثير الهدية (للهدايا الحظ)</label>
            <select value={giftEffect} onChange={e => setGiftEffect(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none">
              <option value="normal">عادي (تكبير وتصغير)</option>
              <option value="shake">اهتزازي (Shaking)</option>
              <option value="pulse">نبضي (Pulse)</option>
              <option value="spin">دوران (Spin)</option>
              <option value="bounce">قفز (Bounce)</option>
              <option value="zoom_mic">زوم على المايك (Zoom to Mic)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">حجم الهدية (0-100)</label>
            <div className="flex items-center gap-4">
              <input type="range" min="10" max="100" value={giftSize} onChange={e => setGiftSize(e.target.value)} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
              <span className="text-sm font-bold text-purple-600 w-8">{giftSize}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">حجم تأثير الهدية على الشاشة (الأنيميشن)</label>
          <select value={animationSize} onChange={e => setAnimationSize(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none">
            <option value="normal">عادي (متوسط في المنتصف)</option>
            <option value="large">كبير (يأخذ مساحة أكبر)</option>
            <option value="fullscreen">شاشة كاملة (يملأ الغرفة بالكامل)</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
            <input type="checkbox" checked={hasAnimation} onChange={e => setHasAnimation(e.target.checked)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
            <span className="text-sm font-bold text-gray-700">تفعيل تأثير الشاشة الكاملة (أنيميشن) عند إرسال هذه الهدية</span>
          </label>
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الإضافة...' : 'إضافة هدية الحظ'}
        </button>
      </form>
      </div>
    </div>
  );
}

function GiftBoxTab() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGift, setEditingGift] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'image' | 'animation' | 'audio'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = uploadTarget === 'audio' ? 'gift_audio' : 'gift_animations';
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (uploadTarget === 'image') setEditImageUrl(downloadURL);
      else if (uploadTarget === 'animation') setEditLink(downloadURL);
      else if (uploadTarget === 'audio') setEditAudioUrl(downloadURL);
      
      if (!editName) setEditName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editAudioUrl, setEditAudioUrl] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editDuration, setEditDuration] = useState('6');
  const [editHasAnimation, setEditHasAnimation] = useState(true);
  const [editAnimationSize, setEditAnimationSize] = useState('normal');
  const [editGiftSize, setEditGiftSize] = useState('50');
  const [editCategory, setEditCategory] = useState('classic');
  const [editGiftEffect, setEditGiftEffect] = useState('none');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'gift_categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
        const q = query(collection(db, 'gifts'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setGifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching gifts", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGifts();
  }, []);

  const handleEditClick = (gift: any) => {
    setEditingGift(gift);
    setEditName(gift.name || '');
    setEditDescription(gift.description || '');
    setEditImageUrl(gift.imageUrl || '');
    setEditLink(gift.link || '');
    setEditAudioUrl(gift.audioUrl || '');
    setEditValue(gift.value?.toString() || '');
    setEditDuration(gift.duration?.toString() || '6');
    setEditHasAnimation(gift.hasAnimation !== false);
    setEditAnimationSize(gift.animationSize || 'normal');
    setEditGiftSize(gift.giftSize?.toString() || '50');
    setEditCategory(gift.category || 'classic');
    setEditGiftEffect(gift.giftEffect || 'none');
  };

  const handleUpdateGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGift) return;
    if (!editName || !editValue) return alert('يرجى إدخال اسم وقيمة الهدية');

    setIsSaving(true);
    try {
      const giftRef = doc(db, 'gifts', editingGift.id);
      const updatedData = {
        name: editName,
        description: editDescription,
        imageUrl: editImageUrl,
        link: editLink,
        audioUrl: editAudioUrl,
        value: Number(editValue),
        duration: Number(editDuration),
        hasAnimation: editHasAnimation,
        animationSize: editAnimationSize,
        giftSize: Number(editGiftSize),
        category: editCategory,
        giftEffect: editGiftEffect,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(giftRef, updatedData);
      
      // Update local state
      setGifts(gifts.map(g => g.id === editingGift.id ? { ...g, ...updatedData } : g));
      
      alert('تم تحديث الهدية بنجاح!');
      setEditingGift(null);
    } catch (error: any) {
      alert('خطأ في التحديث: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الهدية؟')) {
      try {
        await deleteDoc(doc(db, 'gifts', id));
        setGifts(gifts.filter(g => g.id !== id));
      } catch (error: any) {
        alert('خطأ في الحذف: ' + error.message);
      }
    }
  };

  if (loading) return <div>جاري تحميل الهدايا...</div>;

  return (
    <div className="space-y-4">
      {editingGift && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">تعديل الهدية: {editingGift.name}</h3>
              <button onClick={() => setEditingGift(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X size={24} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateGift} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الهدية</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">قسم الهدية</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                    <option value="classic">كلاسيك (عادية)</option>
                    <option value="lucky">هدايا الحظ</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط صورة الهدية</label>
                <div className="flex gap-2">
                  <input type="url" value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
                  <button type="button" onClick={() => { setUploadTarget('image'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الهدية (اختياري)</label>
                <div className="flex gap-2">
                  <input type="url" value={editLink} onChange={e => setEditLink(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
                  <button type="button" onClick={() => { setUploadTarget('animation'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط صوت الهدية (اختياري)</label>
                <div className="flex gap-2">
                  <input type="url" value={editAudioUrl} onChange={e => setEditAudioUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
                  <button type="button" onClick={() => { setUploadTarget('audio'); fileInputRef.current?.click(); }} className="bg-gray-100 px-3 rounded-lg hover:bg-gray-200 transition"><Upload size={18} /></button>
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept={uploadTarget === 'audio' ? "audio/*" : (uploadTarget === 'animation' ? "image/*,video/*" : "image/*")} 
                className="hidden" 
              />
              
              {isUploading && (
                <div className="flex items-center gap-2 text-purple-600 text-sm font-bold bg-purple-50 p-2 rounded-lg">
                  <Loader2 size={16} className="animate-spin" />
                  جاري رفع الملف...
                </div>
              )}

              {(editImageUrl || editLink) && (
                <div className="flex gap-4 mt-2">
                  {editImageUrl && (
                    <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      <img src={editImageUrl} className="w-full h-full object-contain" />
                      <p className="text-[8px] text-center bg-black/50 text-white py-0.5">الأيقونة</p>
                    </div>
                  )}
                  {editLink && (
                    <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-black">
                      {editLink.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
                        <video src={editLink} className="w-full h-full object-contain" autoPlay muted loop />
                      ) : (
                        <img src={editLink} className="w-full h-full object-contain" />
                      )}
                      <p className="text-[8px] text-center bg-black/50 text-white py-0.5">التأثير</p>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">قيمة الهدية (ألماس)</label>
                  <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مدة الظهور (ثواني)</label>
                  <input type="number" value={editDuration} onChange={e => setEditDuration(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حجم الأنيميشن</label>
                  <select value={editAnimationSize} onChange={e => setEditAnimationSize(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                    <option value="normal">عادي</option>
                    <option value="large">كبير</option>
                    <option value="fullscreen">شاشة كاملة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">حجم الهدية (0-100)</label>
                  <div className="flex items-center gap-4">
                    <input type="range" min="10" max="100" value={editGiftSize} onChange={e => setEditGiftSize(e.target.value)} className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                    <span className="text-sm font-bold text-purple-600 w-8">{editGiftSize}</span>
                  </div>
                </div>
                {editCategory === 'lucky' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تأثير حركة الهدية</label>
                    <select value={editGiftEffect} onChange={e => setEditGiftEffect(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
                      <option value="none">بدون تأثير</option>
                      <option value="shake">اهتزاز</option>
                      <option value="pulse">نبض</option>
                      <option value="spin">دوران</option>
                      <option value="bounce">قفز</option>
                      <option value="zoom_mic">زوم على المايك</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input type="checkbox" id="editHasAnimation" checked={editHasAnimation} onChange={e => setEditHasAnimation(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                <label htmlFor="editHasAnimation" className="text-sm font-bold text-gray-700 cursor-pointer">تفعيل الأنيميشن عند الإرسال</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={isSaving} className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition disabled:opacity-50">
                  {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
                <button type="button" onClick={() => setEditingGift(null)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {gifts.length === 0 ? (
        <div className="text-center text-gray-500 py-8">لا توجد هدايا مضافة بعد.</div>
      ) : (
        gifts.map(gift => (
          <div key={gift.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <img src={gift.imageUrl || 'https://via.placeholder.com/60'} alt={gift.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">{gift.name}</h3>
              <p className="text-xs text-gray-500 line-clamp-1">{gift.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-purple-600">{gift.value} 💎</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${gift.category === 'lucky' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                  {gift.category === 'lucky' ? 'حظ' : 'كلاسيك'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleEditClick(gift)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"><Edit2 size={18} /></button>
              <button onClick={() => handleDelete(gift.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DiamondsTab() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !amount) return alert('يرجى إدخال ID المستخدم والكمية');
    
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        alert('المستخدم غير موجود!');
        setIsSubmitting(false);
        return;
      }

      const currentDiamonds = userSnap.data().diamonds || 0;
      const currentTotalSpent = userSnap.data().totalSpent || 0;
      const newAmount = currentDiamonds + Number(amount);

      await updateDoc(userRef, { 
        diamonds: newAmount,
        totalSpent: currentTotalSpent + Number(amount)
      });
      
      await addDoc(collection(db, 'transactions'), {
        userId,
        amount: Number(amount),
        type: 'recharge',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      alert('تم شحن الألماس بنجاح!');
      setUserId(''); setAmount('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-bold mb-4 text-gray-800">شحن ألماس للمستخدمين</h2>
      <form onSubmit={handleRecharge} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ID المستخدم</label>
          <input type="text" value={userId} onChange={e => setUserId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" required placeholder="مثال: abc123xyz" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">كمية الألماس</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" required min="1" />
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {isSubmitting ? 'جاري الشحن...' : 'تنفيذ الشحن'}
        </button>
      </form>
    </div>
  );
}

function MicsTab() {
  const [settings, setSettings] = useState({ maxMics: 3, allowMovement: true });
  const [mics, setMics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingUser, setMovingUser] = useState<{ micId: string, userId: string } | null>(null);

  useEffect(() => {
    // Listen to global mic settings
    const unsubSettings = onSnapshot(doc(db, 'system', 'mic_settings'), (snapshot: any) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as any);
      } else {
        setDoc(snapshot.ref, { maxMics: 8, allowMovement: true });
      }
    });

    // Listen to mics
    const unsubMics = onSnapshot(collection(db, 'mics'), async (snapshot) => {
      if (snapshot.empty) {
        // Initialize 12 mics if they don't exist
        for (let i = 0; i < 12; i++) {
          await setDoc(doc(db, 'mics', `mic_${i}`), {
            order: i,
            userId: null,
            status: 'open',
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        const micsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setMics(micsData.sort((a, b) => a.order - b.order));
        setLoading(false);
      }
    });

    return () => { unsubSettings(); unsubMics(); };
  }, []);

  const updateSettings = async (field: string, value: any) => {
    await updateDoc(doc(db, 'system', 'mic_settings'), { [field]: value });
  };

  const handleKick = async (micId: string) => {
    await updateDoc(doc(db, 'mics', micId), { userId: null, status: 'open' });
  };

  const handleLock = async (micId: string, isLocked: boolean) => {
    await updateDoc(doc(db, 'mics', micId), { status: isLocked ? 'open' : 'locked', userId: null });
  };

  const handleMove = async (targetMicId: string) => {
    if (!movingUser) return;
    
    try {
      // 1. Clear old mic
      await updateDoc(doc(db, 'mics', movingUser.micId), { userId: null, status: 'open' });
      // 2. Set new mic
      await updateDoc(doc(db, 'mics', targetMicId), { userId: movingUser.userId, status: 'open' });
      setMovingUser(null);
      alert('تم نقل المستخدم بنجاح');
    } catch (error: any) {
      alert('خطأ في النقل: ' + error.message);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {movingUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">نقل المستخدم إلى مايك آخر</h3>
            <p className="text-xs text-gray-500 mb-4 text-center">اختر المايك المستهدف لنقل المستخدم {movingUser.userId.substring(0, 8)}...</p>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {mics.slice(0, settings.maxMics).map((m, i) => (
                <button 
                  key={m.id}
                  disabled={m.userId || m.status === 'locked' || m.id === movingUser.micId}
                  onClick={() => handleMove(m.id)}
                  className={`h-10 rounded-lg font-bold text-sm transition ${
                    m.userId || m.status === 'locked' || m.id === movingUser.micId
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-purple-100 text-purple-600 hover:bg-purple-600 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={() => setMovingUser(null)} className="w-full py-2 text-gray-500 font-medium hover:bg-gray-50 rounded-lg transition">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">إعدادات المايكات العامة</h2>
        
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">عدد المايكات المتاحة</span>
          <select 
            value={settings.maxMics} 
            onChange={(e) => updateSettings('maxMics', Number(e.target.value))}
            className="border border-gray-300 rounded-lg p-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value={3}>3 مايكات</option>
            <option value={5}>5 مايكات</option>
            <option value={8}>8 مايكات</option>
            <option value={9}>9 مايكات</option>
            <option value={12}>جميع المايكات (12)</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">السماح بتنقل المستخدمين بحرية</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.allowMovement} onChange={(e) => updateSettings('allowMovement', e.target.checked)} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">مراقبة وإدارة المايكات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: settings.maxMics }).map((_, index) => {
            const mic = mics.find(m => m.order === index);
            const isLocked = mic?.status === 'locked';
            const hasUser = !!mic?.userId;

            return (
              <div key={index} className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 ${isLocked ? 'border-red-200 bg-red-50' : hasUser ? 'border-purple-200 bg-purple-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <span className="absolute top-1 right-2 text-xs font-bold text-gray-400">{index + 1}</span>
                
                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 overflow-hidden">
                  {hasUser ? (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mic.userId}`} alt="User" className="w-full h-full" />
                  ) : (
                    <Mic size={20} className={isLocked ? 'text-red-400' : 'text-gray-400'} />
                  )}
                </div>
                
                <div className="text-[10px] font-medium text-center truncate w-full">
                  {isLocked ? 'مغلق' : hasUser ? mic.userId.substring(0, 6) + '...' : 'فارغ'}
                </div>

                <div className="flex gap-1 mt-2">
                  {hasUser && (
                    <>
                      <button onClick={() => handleKick(mic.id)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="إنزال">
                        <X size={12} />
                      </button>
                      <button onClick={() => setMovingUser({ micId: mic.id, userId: mic.userId })} className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="نقل">
                        <TrendingUp size={12} className="rotate-90" />
                      </button>
                    </>
                  )}
                  <button onClick={() => handleLock(mic?.id || `mic_${index}`, isLocked)} className={`p-1 rounded ${isLocked ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={isLocked ? 'فتح' : 'قفل'}>
                    {isLocked ? <Check size={12} /> : <Settings size={12} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MyAdminAccountTab() {
  const { user } = useAuth();
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [numericId, setNumericId] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [addDiamonds, setAddDiamonds] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setAdminData(data);
        setName(data.displayName || '');
        setNumericId(data.numericId || '');
        setPhotoURL(data.photoURL || '');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        numericId: numericId,
        photoURL: photoURL
      });
      alert('تم تحديث الملف الشخصي بنجاح!');
    } catch (error: any) {
      alert('خطأ في التحديث: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDiamonds = async () => {
    if (!user || !addDiamonds) return;
    const amount = Number(addDiamonds);
    if (isNaN(amount) || amount <= 0) return alert('يرجى إدخال كمية صحيحة');

    setIsSaving(true);
    try {
      const currentDiamonds = adminData.diamonds || 0;
      await updateDoc(doc(db, 'users', user.uid), {
        diamonds: currentDiamonds + amount
      });
      
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        amount: amount,
        type: 'admin_self_recharge',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      alert(`تم إضافة ${amount} ألماس بنجاح!`);
      setAddDiamonds('');
    } catch (error: any) {
      alert('خطأ في إضافة الألماس: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">جاري تحميل بيانات الحساب...</div>;
  if (!adminData) return <div className="p-8 text-center text-red-500">تعذر العثور على بيانات الحساب.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <img src={adminData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-purple-100" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">{adminData.displayName || 'المدير'}</h2>
            <p className="text-sm text-gray-500">رتبة: <span className="text-purple-600 font-bold">مسؤول (Admin)</span></p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-yellow-600 font-bold">{adminData.diamonds || 0} 💎</span>
              <span className="text-gray-400 text-xs">| ID: {adminData.numericId || '---'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4 border-t border-gray-100 pt-6">
          <h3 className="font-bold text-gray-800 mb-2">تعديل بيانات الحساب</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الاسم المستعار</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الآي دي (Numeric ID)</label>
              <input type="text" value={numericId} onChange={e => setNumericId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة الشخصية</label>
            <input type="url" value={photoURL} onChange={e => setPhotoURL(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" />
          </div>
          <button type="submit" disabled={isSaving} className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50">
            {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Diamond className="text-yellow-500" size={20} />
          شحن رصيدي (ألماس)
        </h3>
        <div className="flex gap-2">
          <input 
            type="number" 
            value={addDiamonds} 
            onChange={e => setAddDiamonds(e.target.value)} 
            placeholder="أدخل الكمية لإضافتها لرصيدك..." 
            className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
          />
          <button 
            onClick={handleAddDiamonds} 
            disabled={isSaving || !addDiamonds}
            className="bg-yellow-500 text-white font-bold px-6 py-2 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
          >
            إضافة
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-2">ملاحظة: يمكنك إضافة أي كمية من الألماس لحسابك كمسؤول.</p>
      </div>
    </div>
  );
}

function BackgroundsTab() {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('image'); // image or video
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'room_backgrounds'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return alert('الرجاء تعبئة جميع الحقول');
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'room_backgrounds'), {
        name,
        url,
        type,
        timestamp: Date.now()
      });
      setName('');
      setUrl('');
    } catch (error: any) {
      alert('خطأ في الإضافة: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخلفية؟')) return;
    try {
      await deleteDoc(doc(db, 'room_backgrounds', id));
    } catch (error: any) {
      alert('خطأ في الحذف: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">إضافة خلفية جديدة</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسم الخلفية" className="p-2 border rounded-lg text-sm" />
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="رابط الخلفية (صورة أو MP4)" className="p-2 border rounded-lg text-sm" dir="ltr" />
          <select value={type} onChange={e => setType(e.target.value)} className="p-2 border rounded-lg text-sm">
            <option value="image">صورة</option>
            <option value="video">فيديو (MP4)</option>
          </select>
          <button type="submit" disabled={isSaving} className="bg-purple-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition">
            {isSaving ? 'جاري الإضافة...' : 'إضافة الخلفية'}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">الخلفيات المضافة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {backgrounds.map(bg => (
            <div key={bg.id} className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-video bg-gray-100">
              {bg.type === 'video' ? (
                <video src={bg.url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={bg.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => handleDelete(bg.id)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[10px] text-white text-center truncate">
                {bg.name} ({bg.type === 'video' ? 'فيديو' : 'صورة'})
              </div>
            </div>
          ))}
          {backgrounds.length === 0 && <p className="text-gray-500 text-sm col-span-full text-center py-4">لا توجد خلفيات مضافة حالياً</p>}
        </div>
      </div>
    </div>
  );
}

function AgenciesTab() {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [initialBalance, setInitialBalance] = useState('10000');
  const [bonusPercentage, setBonusPercentage] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'agencies'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setAgencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !initialBalance) return alert('الرجاء إدخال ID المستخدم والرصيد');
    setIsSubmitting(true);
    try {
      // Find user by numericId (string or number) or uid
      const usersRef = collection(db, 'users');
      let targetUserId = userId;
      let targetUserName = 'مستخدم';
      let found = false;

      // 1. Try numericId as string
      const q1 = query(usersRef, where('numericId', '==', userId));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        targetUserId = snap1.docs[0].id;
        targetUserName = snap1.docs[0].data().displayName || 'مستخدم';
        found = true;
      }

      // 2. Try numericId as number
      if (!found && !isNaN(parseInt(userId))) {
        const q2 = query(usersRef, where('numericId', '==', parseInt(userId)));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          targetUserId = snap2.docs[0].id;
          targetUserName = snap2.docs[0].data().displayName || 'مستخدم';
          found = true;
        }
      }

      // 3. Try direct ID (uid)
      if (!found) {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          targetUserName = docSnap.data().displayName || 'مستخدم';
          found = true;
        }
      }

      if (!found) {
        throw new Error('لم يتم العثور على المستخدم');
      }

      await addDoc(collection(db, 'agencies'), {
        userId: targetUserId,
        userName: targetUserName,
        numericId: parseInt(userId) || 0,
        balance: parseInt(initialBalance),
        bonusPercentage: parseInt(bonusPercentage),
        createdAt: Date.now()
      });

      // Update user to be an agent
      await updateDoc(doc(db, 'users', targetUserId), {
        isAgent: true,
        agentBalance: parseInt(initialBalance),
        agentBonus: parseInt(bonusPercentage)
      });

      setUserId('');
      setInitialBalance('10000');
      setBonusPercentage('0');
      alert('تم إنشاء وكالة الشحن بنجاح!');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAgency = async (agencyId: string, targetUserId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الوكالة؟')) return;
    try {
      await deleteDoc(doc(db, 'agencies', agencyId));
      await updateDoc(doc(db, 'users', targetUserId), {
        isAgent: false
      });
    } catch (error: any) {
      alert('خطأ في الحذف: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">إنشاء وكالة شحن جديدة</h2>
        <form onSubmit={handleCreateAgency} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID المستخدم</label>
            <input type="text" value={userId} onChange={e => setUserId(e.target.value)} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الرصيد الافتتاحي (ألماس)</label>
            <input type="number" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نسبة البونص الإضافي (%)</label>
            <input type="number" value={bonusPercentage} onChange={e => setBonusPercentage(e.target.value)} className="w-full border rounded-lg p-2" required />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء وكالة'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">الوكالات الحالية</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 rounded-tr-lg">المستخدم</th>
                <th className="p-3">ID</th>
                <th className="p-3">الرصيد الحالي</th>
                <th className="p-3">البونص</th>
                <th className="p-3 rounded-tl-lg">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map(agency => (
                <tr key={agency.id} className="border-b border-gray-50">
                  <td className="p-3 font-bold">{agency.userName}</td>
                  <td className="p-3 font-mono text-gray-500">{agency.numericId || agency.userId.substring(0,8)}</td>
                  <td className="p-3 text-indigo-600 font-bold">{agency.balance?.toLocaleString()} 💎</td>
                  <td className="p-3 text-green-600 font-bold">+{agency.bonusPercentage || 0}%</td>
                  <td className="p-3">
                    <button onClick={() => handleDeleteAgency(agency.id, agency.userId)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {agencies.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">لا توجد وكالات شحن حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VIPTab() {
  const [levels, setLevels] = useState<any[]>([]);
  const [levelNumber, setLevelNumber] = useState('');
  const [name, setName] = useState('');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [frameUrl, setFrameUrl] = useState('');
  const [entranceEffectUrl, setEntranceEffectUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'vip_levels'), orderBy('levelNumber', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddVIP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelNumber || !name) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'vip_levels'), {
        levelNumber: parseInt(levelNumber),
        name,
        backgroundUrl,
        frameUrl,
        entranceEffectUrl,
        createdAt: Date.now()
      });
      setLevelNumber('');
      setName('');
      setBackgroundUrl('');
      setFrameUrl('');
      setEntranceEffectUrl('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المستوى؟')) return;
    await deleteDoc(doc(db, 'vip_levels', id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">إضافة مستوى VIP جديد</h2>
        <form onSubmit={handleAddVIP} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم المستوى (مثال: 1)</label>
            <input type="number" value={levelNumber} onChange={e => setLevelNumber(e.target.value)} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستوى (مثال: VIP 1)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط خلفية الغرفة (اختياري)</label>
            <input type="url" value={backgroundUrl} onChange={e => setBackgroundUrl(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط إطار الصورة (اختياري)</label>
            <input type="url" value={frameUrl} onChange={e => setFrameUrl(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط تأثير الدخول (اختياري)</label>
            <input type="url" value={entranceEffectUrl} onChange={e => setEntranceEffectUrl(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-500 text-white font-bold py-3 rounded-lg hover:bg-yellow-600 transition disabled:opacity-50">
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة مستوى VIP'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {levels.map(level => (
          <div key={level.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-200 relative overflow-hidden">
            <div className="absolute top-2 left-2">
              <button onClick={() => handleDelete(level.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                V{level.levelNumber}
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{level.name}</h3>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-500">
              <p className="flex justify-between"><span>خلفية:</span> <span>{level.backgroundUrl ? '✅' : '❌'}</span></p>
              <p className="flex justify-between"><span>إطار:</span> <span>{level.frameUrl ? '✅' : '❌'}</span></p>
              <p className="flex justify-between"><span>تأثير دخول:</span> <span>{level.entranceEffectUrl ? '✅' : '❌'}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginSettingsTab() {
  const [logoUrl, setLogoUrl] = useState('');
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [isBackgroundVideo, setIsBackgroundVideo] = useState(false);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<'logo' | 'background' | 'avatar'>('logo');

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'login_page'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLogoUrl(data.logoUrl || '');
        setBackgroundUrl(data.backgroundUrl || '');
        setIsBackgroundVideo(data.isBackgroundVideo || false);
        setAvatars(data.avatars || []);
      }
    };
    fetchSettings();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = uploadTarget === 'logo' ? 'app_logos' : (uploadTarget === 'background' ? 'login_backgrounds' : 'user_avatars');
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      if (uploadTarget === 'logo') setLogoUrl(downloadURL);
      else if (uploadTarget === 'background') setBackgroundUrl(downloadURL);
      else if (uploadTarget === 'avatar') setNewAvatarUrl(downloadURL);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'login_page'), {
        logoUrl,
        backgroundUrl,
        isBackgroundVideo,
        avatars,
        updatedAt: new Date().toISOString()
      });
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addAvatar = () => {
    if (!newAvatarUrl) return;
    setAvatars([...avatars, newAvatarUrl]);
    setNewAvatarUrl('');
  };

  const removeAvatar = (index: number) => {
    setAvatars(avatars.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-6 text-gray-800">إعدادات صفحة تسجيل الدخول</h2>
        
        <div className="space-y-6">
          {/* Logo Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">لوجو التطبيق (رابط)</label>
            <div className="flex gap-2">
              <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" placeholder="https://..." />
              <button onClick={() => { setUploadTarget('logo'); fileInputRef.current?.click(); }} className="bg-gray-100 px-4 rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
                <Upload size={18} /> رفع
              </button>
            </div>
            {logoUrl && (
              <div className="mt-2 w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                <img src={logoUrl} className="max-w-full max-h-full object-contain" />
              </div>
            )}
          </div>

          {/* Background Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">خلفية الصفحة (صورة أو فيديو)</label>
            <div className="flex gap-2 mb-2">
              <input type="url" value={backgroundUrl} onChange={e => setBackgroundUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" placeholder="https://..." />
              <button onClick={() => { setUploadTarget('background'); fileInputRef.current?.click(); }} className="bg-gray-100 px-4 rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
                <Upload size={18} /> رفع
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" id="isVideo" checked={isBackgroundVideo} onChange={e => setIsBackgroundVideo(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
              <label htmlFor="isVideo" className="text-sm text-gray-700 cursor-pointer font-medium">الرابط المرفوع هو فيديو (MP4)</label>
            </div>
            {backgroundUrl && (
              <div className="mt-2 w-full h-40 rounded-xl border border-gray-200 overflow-hidden bg-black relative">
                {isBackgroundVideo ? (
                  <video src={backgroundUrl} className="w-full h-full object-cover" autoPlay muted loop />
                ) : (
                  <img src={backgroundUrl} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-bold">معاينة الخلفية</div>
              </div>
            )}
          </div>

          {/* Avatars Section */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">بنك الصور الرمزية (Avatars) للمستخدمين الجدد</label>
            <div className="flex gap-2 mb-4">
              <input type="url" value={newAvatarUrl} onChange={e => setNewAvatarUrl(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none text-left" dir="ltr" placeholder="رابط صورة رمزية جديدة..." />
              <button onClick={() => { setUploadTarget('avatar'); fileInputRef.current?.click(); }} className="bg-gray-100 px-4 rounded-lg hover:bg-gray-200 transition">
                <Upload size={18} />
              </button>
              <button onClick={addAvatar} className="bg-purple-600 text-white px-4 rounded-lg hover:bg-purple-700 transition font-bold">إضافة</button>
            </div>
            
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {avatars.map((url, index) => (
                <div key={index} className="relative group aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={url} className="w-full h-full object-cover" />
                  <button onClick={() => removeAvatar(index)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept={uploadTarget === 'background' && isBackgroundVideo ? "video/*" : "image/*"} />
          
          {isUploading && (
            <div className="flex items-center gap-2 text-purple-600 text-sm font-bold bg-purple-50 p-3 rounded-xl">
              <Loader2 size={18} className="animate-spin" />
              جاري رفع الملف إلى السيرفر...
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <button onClick={handleSaveSettings} disabled={isSaving || isUploading} className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-50">
              {isSaving ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GiftCategoriesTab() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'gift_categories'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'gift_categories'), {
        name,
        createdAt: Date.now()
      });
      setName('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا القسم؟')) return;
    await deleteDoc(doc(db, 'gift_categories', id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">إضافة قسم هدايا جديد</h2>
        <form onSubmit={handleAddCategory} className="flex gap-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسم القسم (مثال: هدايا حصرية)" className="flex-1 border rounded-lg p-3" required />
          <button type="submit" disabled={isSubmitting} className="bg-pink-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-pink-600 transition disabled:opacity-50 whitespace-nowrap">
            {isSubmitting ? 'جاري الإضافة...' : 'إضافة القسم'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">الأقسام الحالية</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map(cat => (
            <div key={cat.id} className="bg-pink-50 border border-pink-200 text-pink-700 px-4 py-2 rounded-full flex items-center gap-2 font-bold">
              {cat.name}
              <button onClick={() => handleDelete(cat.id)} className="text-pink-400 hover:text-red-500 transition ml-2">
                <X size={16} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-gray-400 w-full text-center py-4">لا توجد أقسام حالياً. سيتم استخدام الأقسام الافتراضية.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerTab() {
  const { user } = useAuth();
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAccount = async () => {
    if (!user) return;
    if (!confirm('تحذير: سيتم حذف جميع بيانات حسابك (الألماس، المستويات، العناصر المشتراة، الصورة، والاسم) وإعادتها للوضع الافتراضي. هل أنت متأكد؟')) return;
    
    setIsResetting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: 'المدير العام',
        photoURL: '',
        diamonds: 0,
        totalSpent: 0,
        totalSupport: 0,
        equippedMicFrame: null,
        equippedMicIcon: null,
        equippedEntrance: null,
        equippedBubble: null,
        equippedTextColor: null,
        resetAt: new Date().toISOString()
      });
      alert('تم إعادة تعيين حساب المدير بنجاح!');
      window.location.reload();
    } catch (error: any) {
      alert('خطأ في إعادة التعيين: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
      <ShieldAlert size={48} className="text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2 text-gray-800">إدارة حساب المدير</h2>
      <p className="text-gray-500 mb-8 text-sm">هذا القسم مخصص لإعادة تعيين بيانات حساب المدير الحالي.</p>
      
      <div className="max-w-xs mx-auto">
        <button 
          onClick={handleResetAccount}
          disabled={isResetting}
          className="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition flex items-center justify-center gap-2"
        >
          {isResetting ? 'جاري إعادة التعيين...' : (
            <>
              <Trash2 size={20} />
              إعادة ريستارت حساب المدير
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function EmotesTab() {
  const [emotes, setEmotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmote, setNewEmote] = useState({ id: '', url: '' });
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const fetchEmotes = async () => {
      const q = query(collection(db, 'emotes'));
      const snapshot = await getDocs(q);
      setEmotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchEmotes();
  }, []);

  const handleAddEmote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmote.id || !newEmote.url) return alert('الرجاء إدخال المعرف والرابط');
    
    setIsAdding(true);
    try {
      await setDoc(doc(db, 'emotes', newEmote.id), {
        url: newEmote.url,
        createdAt: new Date().toISOString()
      });
      setEmotes([...emotes, { id: newEmote.id, url: newEmote.url }]);
      setNewEmote({ id: '', url: '' });
      alert('تم إضافة الإيموشن بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteEmote = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإيموشن؟')) return;
    try {
      await deleteDoc(doc(db, 'emotes', id));
      setEmotes(emotes.filter(e => e.id !== id));
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">إضافة إيموشن جديد</h2>
        <form onSubmit={handleAddEmote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">معرف الإيموشن (مثل: heart, laugh)</label>
            <input 
              type="text" 
              value={newEmote.id}
              onChange={e => setNewEmote({...newEmote, id: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط الإيموشن (صورة أو GIF)</label>
            <input 
              type="url" 
              value={newEmote.url}
              onChange={e => setNewEmote({...newEmote, url: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg text-left"
              dir="ltr"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={isAdding}
            className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition disabled:opacity-50"
          >
            {isAdding ? 'جاري الإضافة...' : 'إضافة الإيموشن'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold mb-4 text-gray-800">الإيموشنات الحالية</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {emotes.map(emote => (
            <div key={emote.id} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center relative group">
              <img src={emote.url} alt={emote.id} className="w-12 h-12 object-contain mb-2" />
              <span className="text-xs text-gray-500">{emote.id}</span>
              <button 
                onClick={() => handleDeleteEmote(emote.id)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {emotes.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8">لا توجد إيموشنات مضافة بعد</div>
          )}
        </div>
      </div>
    </div>
  );
}
