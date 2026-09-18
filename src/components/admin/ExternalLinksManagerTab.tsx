import React, { useState } from 'react';
import { AppSettings, DashboardExternalLinks, CustomExternalLink } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Link2, ShoppingBag, ExternalLink, Save, CheckCircle2, 
  Layers, Plus, Trash2, Globe, Sparkles, AlertCircle, Eye
} from 'lucide-react';

interface ExternalLinksManagerTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const ExternalLinksManagerTab: React.FC<ExternalLinksManagerTabProps> = ({
  settings,
  onUpdateSettings
}) => {
  const currentLinks: DashboardExternalLinks = settings.externalLinks || {
    storeLink: {
      id: 'store_link',
      title: 'المتجر',
      url: '',
      enabled: false,
      desc: 'زيارة متجر الأصول والقوالب والمؤثرات الجاهزة',
      openInNewTab: true,
      badge: 'متجر خارجي'
    },
    svgaEditorLink: {
      id: 'svga_editor_link',
      title: 'محرر SVGA',
      url: '',
      enabled: false,
      desc: 'الانتقال إلى محرر ومصمم ملفات SVGA الاحترافي',
      openInNewTab: true,
      badge: 'محرر خارجي'
    },
    customLinks: []
  };

  const [storeLink, setStoreLink] = useState<CustomExternalLink>(
    currentLinks.storeLink || {
      id: 'store_link',
      title: 'المتجر',
      url: '',
      enabled: false,
      desc: 'زيارة متجر الأصول والقوالب والمؤثرات الجاهزة',
      openInNewTab: true,
      badge: 'متجر خارجي'
    }
  );

  const [svgaEditorLink, setSvgaEditorLink] = useState<CustomExternalLink>(
    currentLinks.svgaEditorLink || {
      id: 'svga_editor_link',
      title: 'محرر SVGA',
      url: '',
      enabled: false,
      desc: 'الانتقال إلى محرر ومصمم ملفات SVGA الاحترافي',
      openInNewTab: true,
      badge: 'محرر خارجي'
    }
  );

  const [customLinks, setCustomLinks] = useState<CustomExternalLink[]>(
    currentLinks.customLinks || []
  );

  const [linkHeroUploadToExternal, setLinkHeroUploadToExternal] = useState<boolean>(
    currentLinks.linkHeroUploadToExternal ?? false
  );
  const [heroUploadTarget, setHeroUploadTarget] = useState<'first' | 'second'>(
    currentLinks.heroUploadTarget || 'first'
  );
  const [defaultActiveList, setDefaultActiveList] = useState<'first' | 'second'>(
    currentLinks.defaultActiveList || 'first'
  );
  const [openInsideApp, setOpenInsideApp] = useState<boolean>(
    currentLinks.openInsideApp ?? true
  );

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkBadge, setNewLinkBadge] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const updatedExternalLinks: DashboardExternalLinks = {
        storeLink: {
          ...storeLink,
          url: storeLink.url.trim()
        },
        svgaEditorLink: {
          ...svgaEditorLink,
          url: svgaEditorLink.url.trim()
        },
        customLinks: customLinks.map(link => ({
          ...link,
          url: link.url.trim()
        })),
        linkHeroUploadToExternal,
        heroUploadTarget,
        defaultActiveList,
        openInsideApp
      };

      const updatedSettings: AppSettings = {
        ...settings,
        externalLinks: updatedExternalLinks
      };

      await setDoc(doc(db, 'settings', 'global'), updatedSettings, { merge: true });
      onUpdateSettings(updatedSettings);
      setSuccessMsg('تم حفظ وتحديث إعدادات الروابط الخارجية للداشبورد بنجاح! ✅');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      console.error('Error saving external links:', error);
      alert('فشل حفظ الإعدادات، يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      alert('يرجى كتابة عنوان الرابط وعنوان URL على الأقل.');
      return;
    }

    let formattedUrl = newLinkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: CustomExternalLink = {
      id: 'custom_link_' + Date.now(),
      title: newLinkTitle.trim(),
      url: formattedUrl,
      enabled: true,
      desc: newLinkDesc.trim() || 'رابط خارجي مخصص',
      openInNewTab: true,
      badge: newLinkBadge.trim() || 'رابط مخصص'
    };

    setCustomLinks(prev => [...prev, newLink]);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkDesc('');
    setNewLinkBadge('');
  };

  const handleRemoveCustomLink = (id: string) => {
    setCustomLinks(prev => prev.filter(l => l.id !== id));
  };

  const handleToggleCustomLink = (id: string) => {
    setCustomLinks(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950/80 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl shadow-lg">
              <Link2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                إدارة الروابط الخارجية للداشبورد
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  احترافي
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تحديد وضبط روابط المواقع الخارجية (المتجر، محرر SVGA، وروابط مخصصة إضافية) لتظهر كخيارات وأيقونات منفصلة في الداشبورد وتفتح الموقع المطلوب مباشرة.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 text-sm disabled:opacity-50 active:scale-95 flex-shrink-0"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </div>

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Settings & In-App Portal Integration Control Card */}
      <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              خيارات فتح المواقع والربط بالواجهة الرئيسية
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                موصى به
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              تحديد سلوك الفتح المدمج داخل نفس الصفحة وإخفاء الروابط وربط أيقونة الواجهة الرئيسية
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. فتح الموقع داخل الصفحة وإخفاء الرابط */}
          <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-white block">
                  فتح المواقع داخل التطبيق في نفس الصفحة
                </span>
                <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                  يفتح المواقع كعارض مدمج داخل نفس الصفحة (In-App Portal) دون فتح تبويبات جديدة أو صفحات خارجية، ويخفي رابط الـ URL تماماً عن المستخدمين.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenInsideApp(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 mt-1 ${
                  openInsideApp ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  openInsideApp ? 'right-7' : 'right-1'
                }`}></div>
              </button>
            </div>
            <div className="text-[11px] font-bold text-emerald-400/90 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>الرابط مخفي تماماً ومحمي داخل الصفحة</span>
            </div>
          </div>

          {/* 2. ربط أيقونة رفع الواجهة الرئيسية */}
          <div className="bg-slate-950/60 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-white block">
                  ربط أيقونة رفع الواجهة الرئيسية
                </span>
                <span className="text-xs text-slate-400 mt-1 block leading-relaxed">
                  تفعيل النقر على أيقونة الواجهة الرئيسية ليفتح الموقع المربوط مباشرة بدلاً من اختيار الملفات.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLinkHeroUploadToExternal(prev => !prev)}
                className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 mt-1 ${
                  linkHeroUploadToExternal ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  linkHeroUploadToExternal ? 'right-7' : 'right-1'
                }`}></div>
              </button>
            </div>

            {/* الاختيار بين القائمة الأولى والثانية */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <label className="block text-[11px] font-bold text-slate-300">
                الوجهة عند النقر على أيقونة الواجهة الرئيسية:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHeroUploadTarget('first')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                    heroUploadTarget === 'first'
                      ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 shadow-md'
                      : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>القائمة 1 (المتجر)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroUploadTarget('second')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                    heroUploadTarget === 'second'
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md'
                      : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>القائمة 2 (ملفات SVGA)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. القائمة الافتراضية عند الفتح */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-200 block">
              القائمة الافتراضية التي تفتح أولاً عند الدخول للبوابة المدمجة:
            </span>
            <span className="text-[11px] text-slate-400">
              يمكن للمستخدم التبديل بسلاسة بين القائمة الأولى والثانية في أي وقت عبر الشريط العلوي
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setDefaultActiveList('first')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                defaultActiveList === 'first'
                  ? 'bg-fuchsia-600 text-white border-fuchsia-400 shadow-md'
                  : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>القائمة الأولى ({storeLink.title || 'المتجر'})</span>
            </button>
            <button
              type="button"
              onClick={() => setDefaultActiveList('second')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                defaultActiveList === 'second'
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                  : 'bg-slate-800 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>القائمة الثانية ({svgaEditorLink.title || 'محرر SVGA'})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Required Links Grid: Store & SVGA Editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. اختيار المتجر (الصفحة الأولى / رابط المتجر) */}
        <div className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
          storeLink.enabled 
            ? 'bg-slate-900/90 border-fuchsia-500/40 shadow-[0_0_25px_rgba(217,70,239,0.15)]' 
            : 'bg-slate-950/40 border-white/10 opacity-80'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    اختيار المتجر
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                      الصفحة الأولى
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">ربط خيار المتجر بموقع خارجي</span>
                </div>
              </div>

              {/* Toggle Enable */}
              <button
                type="button"
                onClick={() => setStoreLink(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  storeLink.enabled ? 'bg-fuchsia-600' : 'bg-slate-700'
                }`}
                title={storeLink.enabled ? 'مفعل في الداشبورد' : 'معطل'}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  storeLink.enabled ? 'right-7' : 'right-1'
                }`}></div>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  عنوان / اسم الزر في الداشبورد:
                </label>
                <input
                  type="text"
                  value={storeLink.title}
                  onChange={e => setStoreLink(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="مثال: المتجر أو متجر القوالب"
                  className="w-full bg-slate-950/70 border border-white/10 focus:border-fuchsia-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>رابط الموقع الخارجي (URL):</span>
                  {storeLink.url && (
                    <a 
                      href={storeLink.url.startsWith('http') ? storeLink.url : `https://${storeLink.url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[11px] text-fuchsia-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>اختبار الرابط</span>
                    </a>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={storeLink.url}
                    onChange={e => setStoreLink(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://your-store-website.com"
                    dir="ltr"
                    className="w-full bg-slate-950/70 border border-white/10 focus:border-fuchsia-500/60 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none transition-colors font-mono"
                  />
                  <Globe className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  عند الضغط على خيار المتجر في الداشبورد سيتم نقله مباشرة إلى هذا الرابط
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الوصف التوضيحي للبطاقة:
                </label>
                <input
                  type="text"
                  value={storeLink.desc || ''}
                  onChange={e => setStoreLink(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="وصف مختصر يظهر أسفل الأيقونة في الداشبورد"
                  className="w-full bg-slate-950/70 border border-white/10 focus:border-fuchsia-500/60 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    الشارة / البادج:
                  </label>
                  <input
                    type="text"
                    value={storeLink.badge || ''}
                    onChange={e => setStoreLink(prev => ({ ...prev, badge: e.target.value }))}
                    placeholder="مثال: متجر خارجي"
                    className="w-full bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={storeLink.openInNewTab !== false}
                      onChange={e => setStoreLink(prev => ({ ...prev, openInNewTab: e.target.checked }))}
                      className="w-4 h-4 rounded border-white/10 bg-slate-950 text-fuchsia-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">فتح في نافذة جديدة</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className={`font-bold flex items-center gap-1.5 ${
              storeLink.enabled && storeLink.url ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                storeLink.enabled && storeLink.url ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              {storeLink.enabled 
                ? (storeLink.url ? 'مفعّل وجاهز في الداشبورد' : 'مفعّل لكن يحتاج رابط URL') 
                : 'معطل (لن يظهر في الداشبورد)'}
            </span>
            {storeLink.url && (
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>
        </div>

        {/* 2. اختيار محرر SVGA (الصفحة الثانية / محرر خارجي) */}
        <div className={`p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
          svgaEditorLink.enabled 
            ? 'bg-slate-900/90 border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.15)]' 
            : 'bg-slate-950/40 border-white/10 opacity-80'
        }`}>
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    اختيار محرر SVGA
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      الصفحة الثانية
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-400">ربط خيار محرر SVGA بموقع خارجي</span>
                </div>
              </div>

              {/* Toggle Enable */}
              <button
                type="button"
                onClick={() => setSvgaEditorLink(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  svgaEditorLink.enabled ? 'bg-cyan-600' : 'bg-slate-700'
                }`}
                title={svgaEditorLink.enabled ? 'مفعل في الداشبورد' : 'معطل'}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  svgaEditorLink.enabled ? 'right-7' : 'right-1'
                }`}></div>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  عنوان / اسم الزر في الداشبورد:
                </label>
                <input
                  type="text"
                  value={svgaEditorLink.title}
                  onChange={e => setSvgaEditorLink(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="مثال: محرر SVGA أو محرر الأنيميشن"
                  className="w-full bg-slate-950/70 border border-white/10 focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>رابط الموقع الخارجي (URL):</span>
                  {svgaEditorLink.url && (
                    <a 
                      href={svgaEditorLink.url.startsWith('http') ? svgaEditorLink.url : `https://${svgaEditorLink.url}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>اختبار الرابط</span>
                    </a>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={svgaEditorLink.url}
                    onChange={e => setSvgaEditorLink(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://svga-editor-website.com"
                    dir="ltr"
                    className="w-full bg-slate-950/70 border border-white/10 focus:border-cyan-500/60 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-white focus:outline-none transition-colors font-mono"
                  />
                  <Globe className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  عند الضغط على خيار محرر SVGA في الداشبورد سيتم نقله مباشرة إلى هذا الرابط
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الوصف التوضيحي للبطاقة:
                </label>
                <input
                  type="text"
                  value={svgaEditorLink.desc || ''}
                  onChange={e => setSvgaEditorLink(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="وصف مختصر يظهر أسفل الأيقونة في الداشبورد"
                  className="w-full bg-slate-950/70 border border-white/10 focus:border-cyan-500/60 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    الشارة / البادج:
                  </label>
                  <input
                    type="text"
                    value={svgaEditorLink.badge || ''}
                    onChange={e => setSvgaEditorLink(prev => ({ ...prev, badge: e.target.value }))}
                    placeholder="مثال: محرر خارجي"
                    className="w-full bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={svgaEditorLink.openInNewTab !== false}
                      onChange={e => setSvgaEditorLink(prev => ({ ...prev, openInNewTab: e.target.checked }))}
                      className="w-4 h-4 rounded border-white/10 bg-slate-950 text-cyan-600 focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">فتح في نافذة جديدة</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
            <span className={`font-bold flex items-center gap-1.5 ${
              svgaEditorLink.enabled && svgaEditorLink.url ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                svgaEditorLink.enabled && svgaEditorLink.url ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              {svgaEditorLink.enabled 
                ? (svgaEditorLink.url ? 'مفعّل وجاهز في الداشبورد' : 'مفعّل لكن يحتاج رابط URL') 
                : 'معطل (لن يظهر في الداشبورد)'}
            </span>
            {svgaEditorLink.url && (
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>
        </div>
      </div>

      {/* Additional Custom External Links Section */}
      <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-400" />
              إضافة روابط ومواقع خارجية إضافية في الداشبورد
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              يمكنك إضافة أي روابط مواقع أخرى ترغب بظهورها كأيقونات مستقلة في الداشبورد
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-white/5 w-fit">
            {customLinks.length} روابط إضافية مضافة
          </span>
        </div>

        {/* Add Link Form */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">اسم الرابط / العنوان:</label>
              <input
                type="text"
                value={newLinkTitle}
                onChange={e => setNewLinkTitle(e.target.value)}
                placeholder="مثال: منتدى المصممين أو موقع الأدوات"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">رابط الموقع (URL):</label>
              <input
                type="url"
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="https://example.com"
                dir="ltr"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">وصف مختصر:</label>
              <input
                type="text"
                value={newLinkDesc}
                onChange={e => setNewLinkDesc(e.target.value)}
                placeholder="شرح يوضح وظيفة الموقع"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">شارة البادج (اختياري):</label>
              <input
                type="text"
                value={newLinkBadge}
                onChange={e => setNewLinkBadge(e.target.value)}
                placeholder="مثال: موقع شريك أو أداة مساعدة"
                className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddCustomLink}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة هذا الرابط للقائمة</span>
          </button>
        </div>

        {/* Existing Custom Links List */}
        {customLinks.length > 0 && (
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-slate-300 block mb-2">الروابط المضافة حالياً:</span>
            {customLinks.map((link) => (
              <div 
                key={link.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleCustomLink(link.id)}
                    className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${
                      link.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                    title={link.enabled ? 'مفعل' : 'معطل'}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                      link.enabled ? 'right-4' : 'right-0.5'
                    }`}></div>
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{link.title}</span>
                      {link.badge && (
                        <span className="text-[10px] px-2 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {link.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono" dir="ltr">
                      {link.url}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                    title="فتح الرابط"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomLink(link.id)}
                    className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    title="حذف هذا الرابط"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
