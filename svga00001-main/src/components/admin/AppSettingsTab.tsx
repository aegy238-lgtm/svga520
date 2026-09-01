import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Loader2, Image as ImageIcon } from 'lucide-react';

export default function AppSettingsTab() {
  const [appName, setAppName] = useState('');
  const [navIcons, setNavIcons] = useState({
    home: '',
    discover: '',
    center: '',
    messages: '',
    profile: '',
    discoverLatest: '',
    discoverVideos: '',
    homeCP: '',
    homeTopSupporters: ''
  });
  const [rankingBackgrounds, setRankingBackgrounds] = useState({
    cpRanking: '',
    wealthRanking: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'app_config'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.appName) setAppName(data.appName);
          if (data.navIcons) setNavIcons(data.navIcons);
          if (data.rankingBackgrounds) setRankingBackgrounds(data.rankingBackgrounds);
        } else {
          setAppName('Cocco');
        }
      } catch (error) {
        console.error("Error fetching app settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!appName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await setDoc(doc(db, 'settings', 'app_config'), { 
        appName: appName.trim(),
        navIcons,
        rankingBackgrounds
      }, { merge: true });
      setMessage('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error saving app settings:", error);
      setMessage('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleIconChange = (key: keyof typeof navIcons, value: string) => {
    setNavIcons(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-purple-600" /></div>;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">إعدادات التطبيق العامة</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم التطبيق</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="أدخل اسم التطبيق (مثل: Cocco)"
            dir="auto"
          />
          <p className="text-xs text-gray-500 mt-2">سيظهر هذا الاسم في الصفحة الرئيسية والرسائل الرسمية.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <ImageIcon size={20} className="text-purple-600" />
          أيقونات الشريط السفلي
        </h3>
        <p className="text-sm text-gray-500 mb-6">ضع روابط للصور (PNG أو SVG) لاستبدال الأيقونات الافتراضية. اترك الحقل فارغاً لاستخدام الأيقونة الافتراضية.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "الرئيسية"</label>
            <input
              type="text"
              value={navIcons.home}
              onChange={(e) => handleIconChange('home', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "اكتشاف"</label>
            <input
              type="text"
              value={navIcons.discover}
              onChange={(e) => handleIconChange('discover', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "الزر الأوسط (الميكروفون)"</label>
            <input
              type="text"
              value={navIcons.center}
              onChange={(e) => handleIconChange('center', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "رسائل"</label>
            <input
              type="text"
              value={navIcons.messages}
              onChange={(e) => handleIconChange('messages', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "حسابي"</label>
            <input
              type="text"
              value={navIcons.profile}
              onChange={(e) => handleIconChange('profile', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "تبويب أحدث" (في صفحة اكتشاف)</label>
            <input
              type="text"
              value={navIcons.discoverLatest || ''}
              onChange={(e) => handleIconChange('discoverLatest', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "تبويب فيديوهات" (في صفحة اكتشاف)</label>
            <input
              type="text"
              value={navIcons.discoverVideos || ''}
              onChange={(e) => handleIconChange('discoverVideos', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "زوجين" (في الصفحة الرئيسية)</label>
            <input
              type="text"
              value={navIcons.homeCP || ''}
              onChange={(e) => handleIconChange('homeCP', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">أيقونة "ثروة" (في الصفحة الرئيسية)</label>
            <input
              type="text"
              value={navIcons.homeTopSupporters || ''}
              onChange={(e) => handleIconChange('homeTopSupporters', e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/icon.png"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">خلفيات القوائم</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">خلفية قائمة "أفضل الثنائيات (CP)"</label>
            <input
              type="text"
              value={rankingBackgrounds.cpRanking || ''}
              onChange={(e) => setRankingBackgrounds({...rankingBackgrounds, cpRanking: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/bg.png"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">خلفية قائمة "تصنيف الداعمين (ثروة)"</label>
            <input
              type="text"
              value={rankingBackgrounds.wealthRanking || ''}
              onChange={(e) => setRankingBackgrounds({...rankingBackgrounds, wealthRanking: e.target.value})}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left"
              placeholder="https://example.com/bg.png"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${message.includes('نجاح') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          {message}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !appName.trim()}
        className="w-full bg-purple-600 text-white rounded-xl py-3 font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
        حفظ الإعدادات
      </button>
    </div>
  );
}
