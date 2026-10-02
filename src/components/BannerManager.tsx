import React, { useState } from 'react';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Upload, 
  Sparkles, 
  Maximize2, 
  ExternalLink, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { HeroBannerItem, Language } from '../types';
import { saveBanner, deleteBanner } from '../lib/firebaseService';

interface BannerManagerProps {
  lang: Language;
  banners: HeroBannerItem[];
  setBanners?: React.Dispatch<React.SetStateAction<HeroBannerItem[]>>;
}

export const BannerManager: React.FC<BannerManagerProps> = ({
  lang,
  banners,
  setBanners
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [badge, setBadge] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [btnText, setBtnText] = useState('');
  const [btnLink, setBtnLink] = useState('');
  const [dimensionsNote, setDimensionsNote] = useState('1920 × 600 px (نسبة 16:5)');
  const [isActive, setIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Preset Luxury Banners for quick preview/selection
  const sampleBackgrounds = [
    {
      name: 'Cyber Future Tunnel / نفق نيون سيبراني',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&auto=format&fit=crop&q=85'
    },
    {
      name: 'Golden Dust Stream / تدفق الذهب والجسيمات',
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&auto=format&fit=crop&q=85'
    },
    {
      name: 'Cosmic Royal Aurora / شفق كوني بنفسجي',
      url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1920&auto=format&fit=crop&q=85'
    },
    {
      name: 'Deep Luxury Blue / أزرق داكن فخم',
      url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&auto=format&fit=crop&q=85'
    }
  ];

  // Handle local image file upload directly from device
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(lang === 'ar' ? 'حجم الصورة كبير جداً، يفضل اختيار صورة أقل من 5 ميجابايت' : '图片体积过大，建议不超过5MB');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
      setIsUploading(false);
      setStatusMessage(lang === 'ar' ? 'تم تجهيز الصورة بنجاح!' : '图片上传就绪！');
      setTimeout(() => setStatusMessage(null), 2500);
    };
    reader.onerror = () => {
      setIsUploading(false);
      alert(lang === 'ar' ? 'حدث خطأ أثناء قراءة الصورة' : '读取图片文件失败');
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setBadge('');
    setImageUrl('');
    setBtnText('');
    setBtnLink('');
    setDimensionsNote('1920 × 600 px (نسبة 16:5)');
    setIsActive(true);
  };

  const handleStartEdit = (b: HeroBannerItem) => {
    setEditingId(b.id);
    setTitle(b.title || '');
    setSubtitle(b.subtitle || '');
    setBadge(b.badge || '');
    setImageUrl(b.imageUrl || '');
    setBtnText(b.btnText || '');
    setBtnLink(b.btnLink || '');
    setDimensionsNote(b.dimensionsNote || '1920 × 600 px (نسبة 16:5)');
    setIsActive(b.isActive !== false);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim() && !title.trim()) {
      alert(lang === 'ar' 
        ? 'يرجى إما رفع صورة للبنر أو كتابة نص للبنر (يمكنك رفع صورة بدون أي كتابة كما طلبت)' 
        : '请上传横幅图片或输入文本（支持无文字纯图横幅）');
      return;
    }

    const bannerData: HeroBannerItem = {
      id: editingId || `BANNER-${Date.now().toString().slice(-6)}`,
      badge: badge.trim() || undefined,
      title: title.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      btnText: btnText.trim() || undefined,
      btnLink: btnLink.trim() || undefined,
      dimensionsNote: dimensionsNote.trim() || '1920 × 600 px (16:5)',
      isActive: isActive,
      createdAt: new Date().toISOString().split('T')[0]
    };

    try {
      // Direct real-time sync with Firestore!
      await saveBanner(bannerData);

      if (setBanners) {
        setBanners((prev) => {
          const index = prev.findIndex((b) => b.id === bannerData.id);
          if (index >= 0) {
            const copy = [...prev];
            copy[index] = bannerData;
            return copy;
          }
          return [bannerData, ...prev];
        });
      }

      setStatusMessage(
        lang === 'ar'
          ? editingId ? 'تم تحديث البنر وحفظه على الموقع بنجاح!' : 'تم إضافة البنر الجديد ونشره بنجاح!'
          : '横幅已成功保存并实时同步至全站！'
      );
      resetForm();
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء حفظ البنر في السيرفر' : '保存横幅失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا البنر نهائياً؟' : '确认删除此横幅？')) {
      try {
        await deleteBanner(id);
        if (setBanners) {
          setBanners((prev) => prev.filter((b) => b.id !== id));
        }
        setStatusMessage(lang === 'ar' ? 'تم حذف البنر بنجاح' : '已删除横幅');
        setTimeout(() => setStatusMessage(null), 2500);
      } catch (err) {
        console.error(err);
        alert(lang === 'ar' ? 'حدث خطأ أثناء حذف البنر' : '删除横幅失败');
      }
    }
  };

  const handleToggle = async (b: HeroBannerItem) => {
    const updated = { ...b, isActive: !b.isActive };
    try {
      await saveBanner(updated);
      if (setBanners) {
        setBanners((prev) => prev.map((item) => (item.id === b.id ? updated : item)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Official Banner Dimensions Specification Callout (MANDATORY REQUIREMENT) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-slate-900 border border-purple-500/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 shadow-md">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {lang === 'ar' ? '📐 نظام البنر المتكيف بالكامل (Auto-Adaptive Hero Banner)' : '📐 全自适应横幅系统'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-[10px] text-emerald-300 font-bold">
                  {lang === 'ar' ? 'متكيف مع أي مقاس 100%' : '100% Adaptive'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                {lang === 'ar' 
                  ? 'يتكيف البنر تلقائياً مع أي صورة ترفعها بأي أبعاد أو نسبة عرض إلى ارتفاع، ويظهر بالكامل بدون أي حواف فارغة أو مساحات سوداء مقتطعة.'
                  : '横幅现已完美自适应任何上传尺寸与比例，全画幅完整呈现，零留白零黑边。'}
              </p>
            </div>
          </div>

          {/* Quick Specifications Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/30 text-center">
              <div className="text-[10px] text-purple-300 font-semibold">{lang === 'ar' ? 'المقاس البانورامي الواسع' : '超宽大图'}</div>
              <div className="text-sm font-mono font-black text-white mt-0.5">1920 × 600 px</div>
              <div className="text-[10px] text-emerald-400 font-mono">{lang === 'ar' ? 'كامل العرض بدون حواف' : '无黑边自适应'}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-center">
              <div className="text-[10px] text-cyan-300 font-semibold">{lang === 'ar' ? 'المقاس المتوسط أو القياسي' : '标准中图'}</div>
              <div className="text-sm font-mono font-black text-white mt-0.5">1200 × 500 px</div>
              <div className="text-[10px] text-emerald-400 font-mono">{lang === 'ar' ? 'يتكيف تلقائياً' : '自适应高度'}</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-center">
              <div className="text-[10px] text-emerald-300 font-semibold">{lang === 'ar' ? 'أي مقاس أو نسبة أخرى' : '任意尺寸'}</div>
              <div className="text-sm font-mono font-black text-white mt-0.5">{lang === 'ar' ? 'حر بالكامل' : '完全自由'}</div>
              <div className="text-[10px] text-emerald-400 font-mono">{lang === 'ar' ? 'ظهور كامل 100%' : '100% 全显'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      {/* 2. Interactive Live Banner Preview on Screen */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>{lang === 'ar' ? 'معاينة حية لشكل البنر على واجهة الموقع (يظهر بالكامل بدون أي حواف فاضية):' : '横幅实时效果预览（全屏完整呈现，无留白）：'}</span>
          </label>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            ✓ {lang === 'ar' ? 'عرض متكامل بدون حواف' : 'Zero Borders'}
          </span>
        </div>

        <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-cyan-500/30 bg-transparent shadow-2xl p-0 block transition-all">
          {/* Background Image Preview - Edge to edge without any borders */}
          {imageUrl ? (
            <div className="relative w-full block">
              <img
                src={imageUrl}
                alt="Banner Preview"
                className="w-full h-auto block rounded-2xl sm:rounded-3xl object-cover select-none"
              />
              {(title || subtitle || badge || btnText) && (
                <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent rounded-2xl sm:rounded-3xl" />
              )}
            </div>
          ) : (
            <div className="w-full min-h-[160px] sm:min-h-[200px] bg-gradient-to-r from-slate-950 via-indigo-950/80 to-blue-950/90 flex items-center justify-center p-6 text-center">
              <span className="text-xs text-slate-300">
                ✨ {lang === 'ar' ? 'قم برفع صورة أو كتابة نص للبنر لرؤية المعاينة الحية' : '上传图片或输入文本查看实时预览'}
              </span>
            </div>
          )}

          {/* Render text overlay ONLY if at least one text field is filled */}
          {(title || subtitle || badge || btnText) && imageUrl ? (
            <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 z-10 max-w-2xl">
              {badge && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-[10px] font-semibold text-cyan-300 shadow-sm backdrop-blur">
                    <ShieldCheck className="w-3 h-3 text-cyan-400" />
                    <span>{badge}</span>
                  </span>
                </div>
              )}

              {title && (
                <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight leading-snug mb-1">
                  {title}
                </h2>
              )}

              {subtitle && (
                <p className="text-xs text-slate-300 leading-relaxed mb-3 max-w-xl line-clamp-2">
                  {subtitle}
                </p>
              )}

              {btnText && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
                >
                  <span>{btnText}</span>
                  {btnLink && <ExternalLink className="w-3 h-3 text-white/80" />}
                </button>
              )}
            </div>
          ) : imageUrl ? (
            <div className="absolute bottom-2.5 right-3 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-[10px] text-white font-medium">
                ✨ {lang === 'ar' ? 'بنر بصري نقي بدون كتابة (يظهر بالكامل 100%)' : '纯视觉全画幅横幅'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Banner Editor Form */}
      <div className="bg-[#111520] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              {editingId
                ? (lang === 'ar' ? `تعديل البنر [${editingId}]` : `编辑横幅 [${editingId}]`)
                : (lang === 'ar' ? 'إضافة ورفع بنر إعلاني جديد' : '添加与上传新横幅')}
            </h3>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء التعديل' : '取消'}
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Banner Image Upload & URL First */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-slate-200 font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'صورة البنر (رفع ملف من جهازك أو وضع رابط مباشر)' : '横幅图片（本地上传或外链）'}</span>
              </label>
              <span className="text-[11px] text-cyan-400 font-medium">
                {lang === 'ar' ? 'المقاس الموصى به: 1920×600 px' : '推荐分辨率 1920x600'}
              </span>
            </div>

            {/* Direct File Upload button */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="px-4 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 font-semibold cursor-pointer flex items-center gap-2 transition-colors active:scale-95">
                <Upload className="w-4 h-4 text-purple-300" />
                <span>{isUploading ? (lang === 'ar' ? 'جاري قراءة الملف...' : '正在加载...') : (lang === 'ar' ? '📁 اختر صورة من جهازك لرفعها' : '📁 从电脑或相册选择图片')}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <span className="text-xs text-slate-500">{lang === 'ar' ? 'أو ضع رابط الصورة المباشر:' : '或填入图片URL:'}</span>
            </div>

            {/* Image URL input */}
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... أو /uploads/... أو رابط الصورة"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 font-mono text-xs"
            />

            {/* Preset Samples */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-semibold">
                {lang === 'ar' ? '✨ قوالب خلفيات فخمة عالية الدقة (انقر للاختيار الفوري):' : '✨ 快速选用高清背景模板：'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sampleBackgrounds.map((bg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setImageUrl(bg.url)}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 text-left transition-all flex items-center gap-2 group cursor-pointer"
                  >
                    <img
                      src={bg.url}
                      alt={bg.name}
                      className="w-10 h-7 rounded object-cover border border-slate-700 shrink-0"
                    />
                    <span className="text-[10px] text-slate-300 truncate group-hover:text-purple-300">
                      {bg.name.split('/')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Banner Redirect Link */}
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
            <label className="text-slate-200 font-bold flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>
                {lang === 'ar' 
                  ? 'رابط البنر (الرابط الذي يفتح عند الضغط على البنر)' 
                  : '横幅跳转链接（点击横幅后打开的目标URL）'}
              </span>
              <span className="text-[10px] text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-500/20 font-normal">
                {lang === 'ar' ? 'اختياري' : '可选'}
              </span>
            </label>
            <p className="text-[11px] text-slate-300">
              {lang === 'ar' 
                ? 'أي شخص يضغط على هذا البنر في الصفحة الرئيسية سيتم نقله مباشرة إلى هذا الرابط (مثل رابط موقعك، قناة تليجرام، واتساب، أو رابط خارجي).'
                : '前台用户点击该横幅将直接跳转至此链接（可填网页、WhatsApp、Telegram等任意URL）。'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={btnLink}
                onChange={(e) => setBtnLink(e.target.value)}
                placeholder="https://... أو https://wa.me/966... أو اتركه فارغاً"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setBtnLink('custom_design')}
                  className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 hover:text-white cursor-pointer"
                >
                  {lang === 'ar' ? 'طلب تصميم' : '定制弹窗'}
                </button>
                <button
                  type="button"
                  onClick={() => setBtnLink('vip')}
                  className="px-2.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-300 hover:text-white cursor-pointer"
                >
                  VIP
                </button>
                <button
                  type="button"
                  onClick={() => setBtnLink('')}
                  className="px-2 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  {lang === 'ar' ? 'تفريغ' : '清空'}
                </button>
              </div>
            </div>
          </div>

          {/* Optional Text Settings Collapsible / Notice */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold">
                {lang === 'ar' ? '✍️ نصوص البنر (اختيارية بالكامل - لا يشترط كتابة أي شيء):' : '✍️ 横幅文案（完全可选 - 支持无文字）：'}
              </span>
              <span className="text-[10px] text-slate-400">
                {lang === 'ar' ? 'اتركها فارغة لعرض صورة البنر فقط' : '留空即为纯图模式'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  {lang === 'ar' ? 'العنوان الرئيسي (اختياري)' : '横幅主标题（可选）'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: خصومات كبرى على هدايا البث"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  {lang === 'ar' ? 'الشارة العلوية (Badge Tag) (اختياري)' : '顶部角标文字（可选）'}
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="مثال: عرض خاص · لفترة محدودة"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {lang === 'ar' ? 'النص التعريفي / الوصف (اختياري)' : '宣传文案 / 副标题（可选）'}
              </label>
              <textarea
                rows={2}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="مثال: تسليم فوري وتوثيق رسمي مع ملفات المؤثرات كاملة..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500 leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                {lang === 'ar' ? 'نص الزر على البنر (اختياري)' : '按钮文字（可选）'}
              </label>
              <input
                type="text"
                value={btnText}
                onChange={(e) => setBtnText(e.target.value)}
                placeholder="مثال: اضغط هنا للاستكشاف"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : '取消'}
              </button>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {editingId
                  ? (lang === 'ar' ? 'حفظ التعديلات ونشر البنر فوراً' : '保存修改并更新全站')
                  : (lang === 'ar' ? 'نشر البنر الجديد على الموقع' : '发布新横幅至全站')}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Existing Banners Management List */}
      <div className="bg-[#111520] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">
              {lang === 'ar' ? 'قائمة البنرات النشطة على الموقع' : '全站横幅轮播列表'} ({banners.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {lang === 'ar' ? 'يتم التبديل التلقائي بينها كل 6 ثوانٍ' : '每6秒自动轮播展示'}
          </span>
        </div>

        <div className="space-y-3">
          {banners.map((b, index) => (
            <div
              key={b.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                b.isActive !== false
                  ? 'bg-slate-900/90 border-slate-700/80 hover:border-purple-500/40'
                  : 'bg-slate-950/60 border-slate-800/60 opacity-60'
              }`}
            >
              {/* Banner Left Info */}
              <div className="flex items-start sm:items-center gap-3.5">
                {/* Thumbnail Preview */}
                <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shrink-0 relative">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-slate-900 to-indigo-950 flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[9px] font-mono text-cyan-300">
                    #{index + 1}
                  </span>
                </div>

                <div className="space-y-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                      {b.badge || (lang === 'ar' ? 'بنر' : '横幅')}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      📐 {b.dimensionsNote || '1920×600 px'}
                    </span>
                    {b.btnLink && (
                      <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30 flex items-center gap-1 font-mono">
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{b.btnLink}</span>
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {b.id}
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-md lg:max-w-xl">
                    {b.title || (
                      <span className="text-slate-400 italic">
                        {lang === 'ar' ? '(بنر بدون نص - صورة فقط)' : '(无文本纯图横幅)'}
                      </span>
                    )}
                  </h4>

                  {b.subtitle && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 max-w-md lg:max-w-xl">
                      {b.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {/* Toggle Active */}
                <button
                  type="button"
                  onClick={() => handleToggle(b)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    b.isActive !== false
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title={b.isActive !== false ? 'تعطيل العرض' : 'تفعيل العرض'}
                >
                  {b.isActive !== false ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                      <span>{lang === 'ar' ? 'نشط' : '启用'}</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-slate-500" />
                      <span>{lang === 'ar' ? 'معطل' : '隐藏'}</span>
                    </>
                  )}
                </button>

                {/* Edit */}
                <button
                  type="button"
                  onClick={() => handleStartEdit(b)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  title={lang === 'ar' ? 'تعديل البنر' : '编辑'}
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(b.id)}
                  className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                  title={lang === 'ar' ? 'حذف نهائي' : '删除'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
