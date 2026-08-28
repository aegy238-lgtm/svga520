import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Save, Loader2, Image as ImageIcon, Wrench, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Sparkles } from 'lucide-react';

export default function AppSettingsTab() {
  const [appName, setAppName] = useState('');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('الموقع حالياً تحت التحديث والتطوير، يرجى الانتظار حتى انتهاء أعمال التطوير.');
  const [maintenanceTitle, setMaintenanceTitle] = useState('الموقع تحت التحديث والتطوير');
  const [maintenanceEstimatedTime, setMaintenanceEstimatedTime] = useState('');
  
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
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [message, setMessage] = useState('');
  const [maintenanceSuccessMsg, setMaintenanceSuccessMsg] = useState('');

  useEffect(() => {
    // Real-time listener for global and app_config settings
    const unsubGlobal = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isMaintenanceMode !== undefined) setIsMaintenanceMode(data.isMaintenanceMode);
        if (data.maintenanceMessage) setMaintenanceMessage(data.maintenanceMessage);
        if (data.maintenanceTitle) setMaintenanceTitle(data.maintenanceTitle);
        if (data.maintenanceEstimatedTime !== undefined) setMaintenanceEstimatedTime(data.maintenanceEstimatedTime);
        if (data.appName && !appName) setAppName(data.appName);
      }
    }, (err) => console.warn("Global settings snapshot error:", err));

    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'app_config'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.appName) setAppName(data.appName);
          if (data.navIcons) setNavIcons(data.navIcons);
          if (data.rankingBackgrounds) setRankingBackgrounds(data.rankingBackgrounds);
        } else {
          setAppName('SVGA Studio');
        }
      } catch (error) {
        console.error("Error fetching app config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();

    return () => {
      unsubGlobal();
    };
  }, []);

  const handleToggleMaintenance = async () => {
    setSavingMaintenance(true);
    setMaintenanceSuccessMsg('');
    const newMode = !isMaintenanceMode;
    try {
      const payload = {
        isMaintenanceMode: newMode,
        maintenanceMessage: maintenanceMessage.trim(),
        maintenanceTitle: maintenanceTitle.trim() || 'الموقع تحت التحديث والتطوير',
        maintenanceEstimatedTime: maintenanceEstimatedTime.trim(),
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        setDoc(doc(db, 'settings', 'global'), payload, { merge: true }),
        setDoc(doc(db, 'settings', 'app_config'), payload, { merge: true })
      ]);

      setIsMaintenanceMode(newMode);
      setMaintenanceSuccessMsg(
        newMode 
          ? 'تم تفعيل وضع التحديث والتطوير بنجاح! الموقع مغلق الآن للمستخدمين العاديين.' 
          : 'تم إلغاء وضع التحديث! الموقع متاح الآن لجميع المستخدمين بشكل طبيعي.'
      );
      setTimeout(() => setMaintenanceSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error("Error toggling maintenance mode:", err);
      alert('حدث خطأ أثناء تغيير حالة وضع الصيانة: ' + err.message);
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleSaveMaintenanceDetails = async () => {
    setSavingMaintenance(true);
    setMaintenanceSuccessMsg('');
    try {
      const payload = {
        isMaintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
        maintenanceTitle: maintenanceTitle.trim() || 'الموقع تحت التحديث والتطوير',
        maintenanceEstimatedTime: maintenanceEstimatedTime.trim(),
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        setDoc(doc(db, 'settings', 'global'), payload, { merge: true }),
        setDoc(doc(db, 'settings', 'app_config'), payload, { merge: true })
      ]);

      setMaintenanceSuccessMsg('تم حفظ وتحديث بيانات رسالة الصيانة والتطوير بنجاح.');
      setTimeout(() => setMaintenanceSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error saving maintenance details:", err);
      alert('حدث خطأ أثناء حفظ التفاصيل: ' + err.message);
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleSave = async () => {
    if (!appName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await Promise.all([
        setDoc(doc(db, 'settings', 'app_config'), { 
          appName: appName.trim(),
          navIcons,
          rankingBackgrounds
        }, { merge: true }),
        setDoc(doc(db, 'settings', 'global'), { 
          appName: appName.trim()
        }, { merge: true })
      ]);
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
    <div className="p-4 max-w-3xl mx-auto pb-20 font-sans" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-gray-800">إعدادات التطبيق والنظام</h2>
          <p className="text-sm text-gray-500 mt-1">التحكم في تشغيل الموقع وتخصيص تجربة المستخدمين</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔴 وضع التحديث والتطوير (Maintenance Mode Section) - TOP PRIORITY */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl shadow-md border transition-all duration-300 p-6 sm:p-7 mb-8 ${
        isMaintenanceMode 
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-amber-950/20 border-amber-500/40 shadow-amber-500/10' 
          : 'bg-white border-gray-100'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200/50">
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-2xl ${
              isMaintenanceMode 
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 animate-pulse' 
                : 'bg-purple-100 text-purple-600'
            }`}>
              <Wrench size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl font-black ${isMaintenanceMode ? 'text-white' : 'text-gray-900'}`}>
                  وضع التحديث والتطوير
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  isMaintenanceMode 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {isMaintenanceMode ? '● نشط حالياً (الموقع مغلق)' : '● غير نشط'}
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-1.5 ${isMaintenanceMode ? 'text-amber-200/80' : 'text-gray-500'}`}>
                عند التفعيل، يتم حظر المستخدمين العاديين وإظهار صفحة الصيانة والتطوير، مع السماح للمسؤولين فقط بالوصول.
              </p>
            </div>
          </div>

          {/* Master Toggle Button */}
          <button
            onClick={handleToggleMaintenance}
            disabled={savingMaintenance}
            className={`px-5 py-3 rounded-2xl font-black text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg active:scale-95 flex-shrink-0 disabled:opacity-60 ${
              isMaintenanceMode
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/30'
            }`}
          >
            {savingMaintenance ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isMaintenanceMode ? (
              <>
                <CheckCircle2 size={18} />
                <span>إلغاء وضع التحديث (فتح الموقع)</span>
              </>
            ) : (
              <>
                <ShieldAlert size={18} />
                <span>تفعيل وضع التحديث والتطوير</span>
              </>
            )}
          </button>
        </div>

        {/* Current State Status Banner */}
        <div className={`mt-5 p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold ${
          isMaintenanceMode 
            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200' 
            : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        }`}>
          {isMaintenanceMode ? (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <strong>تنبيه:</strong> الموقع مغلق حالياً أمام المستخدمين وتظهر لهم صفحة التحديث والتطوير. أنت كمدير تتصفح وتدير الموقع بشكل طبيعي.
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <strong>الحالة الحالية:</strong> الموقع يعمل بشكل طبيعي ومتاح لجميع الزوار والمستخدمين.
              </div>
            </>
          )}
        </div>

        {/* Maintenance Configuration Details Form */}
        <div className="mt-6 space-y-4">
          <div>
            <label className={`block text-xs sm:text-sm font-bold mb-1.5 ${isMaintenanceMode ? 'text-slate-200' : 'text-gray-700'}`}>
              عنوان صفحة التحديث
            </label>
            <input
              type="text"
              value={maintenanceTitle}
              onChange={(e) => setMaintenanceTitle(e.target.value)}
              className={`w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                isMaintenanceMode 
                  ? 'bg-slate-950/80 border border-white/10 text-white focus:ring-2 focus:ring-amber-500' 
                  : 'bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-purple-500'
              }`}
              placeholder="الموقع تحت التحديث والتطوير"
            />
          </div>

          <div>
            <label className={`block text-xs sm:text-sm font-bold mb-1.5 ${isMaintenanceMode ? 'text-slate-200' : 'text-gray-700'}`}>
              رسالة التحديث المخصصة للمستخدمين
            </label>
            <textarea
              rows={3}
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              className={`w-full rounded-xl p-4 text-sm focus:outline-none transition resize-none ${
                isMaintenanceMode 
                  ? 'bg-slate-950/80 border border-white/10 text-white focus:ring-2 focus:ring-amber-500' 
                  : 'bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-purple-500'
              }`}
              placeholder="الموقع حالياً تحت التحديث والتطوير، يرجى الانتظار حتى انتهاء أعمال التطوير."
            />
          </div>

          <div>
            <label className={`block text-xs sm:text-sm font-bold mb-1.5 flex items-center gap-1.5 ${isMaintenanceMode ? 'text-slate-200' : 'text-gray-700'}`}>
              <Clock size={16} className={isMaintenanceMode ? 'text-amber-400' : 'text-purple-600'} />
              <span>الوقت المقدر للانتهاء (اختياري)</span>
            </label>
            <input
              type="text"
              value={maintenanceEstimatedTime}
              onChange={(e) => setMaintenanceEstimatedTime(e.target.value)}
              className={`w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                isMaintenanceMode 
                  ? 'bg-slate-950/80 border border-white/10 text-white focus:ring-2 focus:ring-amber-500' 
                  : 'bg-gray-50 border border-gray-200 text-gray-900 focus:ring-2 focus:ring-purple-500'
              }`}
              placeholder="مثال: 30 دقيقة / الساعة 10:00 مساءً / قريباً"
            />
          </div>

          {maintenanceSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{maintenanceSuccessMsg}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSaveMaintenanceDetails}
              disabled={savingMaintenance}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                isMaintenanceMode 
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30' 
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {savingMaintenance ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>تحديث نصوص ورسالة الصيانة</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* ========================================================================= */}
      {/* App General Configuration */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">اسم التطبيق</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold"
            placeholder="أدخل اسم التطبيق (مثل: SVGA Studio)"
            dir="auto"
          />
          <p className="text-xs text-gray-500 mt-2">سيظهر هذا الاسم في الصفحة الرئيسية والرسائل الرسمية وشاشة الصيانة.</p>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-left text-gray-900"
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
        className="w-full bg-purple-600 text-white rounded-xl py-3 font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
      >
        {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
        حفظ الإعدادات العامة
      </button>
    </div>
  );
}
