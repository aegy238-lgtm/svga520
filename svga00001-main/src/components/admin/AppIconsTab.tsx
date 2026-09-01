import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, Save, Gift, Mic, MessageCircle, Share2, Settings, Gamepad2, X, Send, LogOut, User, ShoppingBag, Crown, Diamond, Coins, MicOff, Lock, ShieldBan, MoreHorizontal, Smile, Music, Image as ImageIcon, Check, TrendingUp, ShieldAlert, Heart, Zap, Edit3, Users } from 'lucide-react';

const ICON_DEFINITIONS = [
  { id: 'giftBoxIcon', label: 'صندوق الهدايا', description: 'تظهر في أسفل الغرفة لفتح صندوق الهدايا', defaultIcon: <Gift size={24} /> },
  { id: 'micIcon', label: 'المايك (فارغ)', description: 'تظهر في مقاعد الغرفة عندما تكون فارغة', defaultIcon: <Mic size={24} /> },
  { id: 'idIcon', label: 'خلفية الآي دي', description: 'تظهر كخلفية لرقم الآي دي في الغرفة', defaultIcon: <div className="w-6 h-6 bg-gray-800 rounded-md"></div> },
  { id: 'chatIcon', label: 'الدردشة', description: 'أيقونة فتح الدردشة', defaultIcon: <MessageCircle size={24} /> },
  { id: 'gamesIcon', label: 'الألعاب', description: 'أيقونة مركز الألعاب', defaultIcon: <Gamepad2 size={24} /> },
  { id: 'closeIcon', label: 'إغلاق', description: 'أيقونة إغلاق الغرفة/النافذة', defaultIcon: <X size={24} /> },
  { id: 'sendIcon', label: 'إرسال', description: 'أيقونة إرسال رسالة', defaultIcon: <Send size={24} /> },
  { id: 'profileIcon', label: 'الملف الشخصي', description: 'أيقونة الملف الشخصي', defaultIcon: <User size={24} /> },
  { id: 'storeIcon', label: 'المتجر', description: 'أيقونة المتجر', defaultIcon: <ShoppingBag size={24} /> },
  { id: 'vipIcon', label: 'VIP', description: 'أيقونة مركز VIP', defaultIcon: <Crown size={24} /> },
  { id: 'diamondIcon', label: 'الألماس', description: 'أيقونة الألماس', defaultIcon: <Diamond size={24} /> },
  { id: 'micLockedIcon', label: 'المايك (مقفول)', description: 'تظهر عندما يكون المقعد مقفولاً', defaultIcon: <ShieldBan size={24} /> },
  { id: 'moreIcon', label: 'المزيد', description: 'أيقونة القائمة الإضافية', defaultIcon: <MoreHorizontal size={24} /> },
  { id: 'smileIcon', label: 'الموشنات', description: 'أيقونة إرسال الموشنات', defaultIcon: <Smile size={24} /> },
  { id: 'musicIcon', label: 'الموسيقى', description: 'أيقونة تشغيل الموسيقى', defaultIcon: <Music size={24} /> },
  { id: 'settingsIcon', label: 'الإعدادات', description: 'أيقونة الإعدادات', defaultIcon: <Settings size={24} /> },
  { id: 'usersIcon', label: 'المستخدمين', description: 'أيقونة قائمة المستخدمين', defaultIcon: <Users size={24} /> },
];

export default function AppIconsTab() {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string>('');

  useEffect(() => {
    const fetchIcons = async () => {
      const docRef = doc(db, 'settings', 'app_icons');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIcons(docSnap.data() || {});
      }
    };
    fetchIcons();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `app_icons/${uploadTarget}_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setIcons(prev => ({ ...prev, [uploadTarget]: downloadURL }));
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadTarget('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'app_icons'), {
        ...icons,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('تم حفظ الأيقونات بنجاح!');
    } catch (error: any) {
      alert('خطأ في الحفظ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleIconChange = (id: string, value: string) => {
    setIcons(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">إدارة أيقونات التطبيق</h2>
          <p className="text-sm text-gray-500 mt-1">قم بتغيير أي أيقونة أو زر في التطبيق برابط صورة مخصصة.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-xl transition flex items-center gap-2"
        >
          <Save size={20} />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>
      
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ICON_DEFINITIONS.map(def => (
          <div key={def.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-bold text-gray-800">{def.label}</label>
                <p className="text-xs text-gray-500">{def.description}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                {icons[def.id] ? (
                  <img src={icons[def.id]} alt={def.label} className="w-8 h-8 object-contain" />
                ) : (
                  <div className="text-gray-400">
                    {def.defaultIcon}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <input 
                type="url" 
                value={icons[def.id] || ''} 
                onChange={e => handleIconChange(def.id, e.target.value)} 
                placeholder="رابط الصورة..." 
                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none text-left" 
                dir="ltr" 
              />
              <button 
                type="button" 
                onClick={() => { setUploadTarget(def.id); fileInputRef.current?.click(); }} 
                className="bg-white border border-gray-300 p-2 rounded-lg hover:bg-gray-50 transition shadow-sm"
                title="رفع صورة"
              >
                <Upload size={18} className="text-purple-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
