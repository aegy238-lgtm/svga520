import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Check, 
  Sparkles, 
  Phone, 
  MessageCircle, 
  Globe, 
  ExternalLink, 
  Plus, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Camera
} from 'lucide-react';
import { Language, SiteSettings } from '../types';
import { saveSiteSettings } from '../lib/firebaseService';

interface SiteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  siteSettings: SiteSettings;
  onSettingsSaved: (newSettings: SiteSettings) => void;
}

export const SiteSettingsModal: React.FC<SiteSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  siteSettings,
  onSettingsSaved
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wechatQrInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [siteName, setSiteName] = useState(siteSettings?.siteName || 'Destroy KING Designer');
  const [siteSlogan, setSiteSlogan] = useState(siteSettings?.siteSlogan || '');
  const [logoUrl, setLogoUrl] = useState(siteSettings?.logoUrl || '');
  
  // Phone numbers
  const [primaryPhone, setPrimaryPhone] = useState(
    siteSettings?.primaryPhone || siteSettings?.whatsapp || '+923400700013'
  );
  const [primaryPhoneLabel, setPrimaryPhoneLabel] = useState(
    siteSettings?.primaryPhoneLabel || 'WhatsApp'
  );

  const [hasSecondaryPhone, setHasSecondaryPhone] = useState(
    Boolean(siteSettings?.secondaryPhone || siteSettings?.secondaryWhatsapp)
  );
  const [secondaryPhone, setSecondaryPhone] = useState(
    siteSettings?.secondaryPhone || siteSettings?.secondaryWhatsapp || ''
  );
  const [secondaryPhoneLabel, setSecondaryPhoneLabel] = useState(
    siteSettings?.secondaryPhoneLabel || (lang === 'ar' ? 'واتساب 2' : 'WhatsApp 2')
  );

  // Email & WeChat & Security Passcode
  const [email, setEmail] = useState(siteSettings?.email || 'southasia216@gmail.com');
  const [wechat, setWechat] = useState(siteSettings?.wechat || 'southasia216');
  const [wechatQrUrl, setWechatQrUrl] = useState(siteSettings?.wechatQrUrl || '');
  const [deletePasscode, setDeletePasscode] = useState(siteSettings?.deletePasscode || '150150');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize when modal opens or siteSettings changes
  useEffect(() => {
    if (isOpen) {
      setSiteName(siteSettings?.siteName || 'Destroy KING Designer');
      setSiteSlogan(siteSettings?.siteSlogan || '');
      setLogoUrl(siteSettings?.logoUrl || '');
      setPrimaryPhone(siteSettings?.primaryPhone || siteSettings?.whatsapp || '+923400700013');
      setPrimaryPhoneLabel(siteSettings?.primaryPhoneLabel || 'WhatsApp');
      setSecondaryPhone(siteSettings?.secondaryPhone || siteSettings?.secondaryWhatsapp || '');
      setSecondaryPhoneLabel(siteSettings?.secondaryPhoneLabel || (lang === 'ar' ? 'واتساب 2' : 'WhatsApp 2'));
      setHasSecondaryPhone(Boolean(siteSettings?.secondaryPhone || siteSettings?.secondaryWhatsapp));
      setEmail(siteSettings?.email || 'southasia216@gmail.com');
      setWechat(siteSettings?.wechat || 'southasia216');
      setWechatQrUrl(siteSettings?.wechatQrUrl || '');
      setDeletePasscode(siteSettings?.deletePasscode || '150150');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, siteSettings, lang]);

  if (!isOpen) return null;

  // Handle image file upload for logo
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'ar' ? 'يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP, SVG)' : 'Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(lang === 'ar' ? 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 5 ميجابايت' : 'Image size exceeds 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setLogoUrl(dataUrl);
        setErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setErrorMsg(lang === 'ar' ? 'حدث خطأ أثناء قراءة ملف الصورة' : 'Error reading image file');
    };
    reader.readAsDataURL(file);
  };

  // Handle image file upload for WeChat QR Code
  const handleWeChatQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'ar' ? 'يرجى اختيار صورة صالحة لرمز الوي شات (PNG, JPG, WEBP)' : 'Please select a valid QR image');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setWechatQrUrl(dataUrl);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال اسم الموقع' : 'Please enter website name');
      return;
    }
    if (!primaryPhone.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال رقم الهاتف / الواتساب الأساسي' : 'Please enter primary phone number');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const finalSettings: SiteSettings = {
        ...siteSettings,
        siteName: siteName.trim(),
        siteSlogan: siteSlogan.trim(),
        logoUrl: logoUrl.trim(),
        primaryPhone: primaryPhone.trim(),
        primaryPhoneLabel: primaryPhoneLabel.trim() || 'WhatsApp',
        whatsapp: primaryPhone.trim(),
        secondaryPhone: hasSecondaryPhone ? secondaryPhone.trim() : '',
        secondaryPhoneLabel: hasSecondaryPhone ? (secondaryPhoneLabel.trim() || 'WhatsApp 2') : '',
        secondaryWhatsapp: hasSecondaryPhone ? secondaryPhone.trim() : '',
        email: email.trim() || 'southasia216@gmail.com',
        wechat: wechat.trim() || 'southasia216',
        wechatQrUrl: wechatQrUrl.trim(),
        deletePasscode: deletePasscode.trim() || '150150',
        updatedAt: new Date().toISOString()
      };

      const saved = await saveSiteSettings(finalSettings);
      onSettingsSaved(saved);
      
      setSuccessMsg(
        lang === 'ar'
          ? '✓ تم حفظ وتثبيت لوجو واسم الموقع وأرقام التواصل بشكل دائم في قاعدة البيانات بنجاح!'
          : '✓ Site logo, name, and phone numbers permanently saved successfully!'
      );

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Failed to save site settings:', err);
      setErrorMsg(
        lang === 'ar'
          ? 'حدث خطأ أثناء حفظ الإعدادات، تم الحفظ محلياً على جهازك'
          : 'Failed to save settings to cloud, saved locally'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const cleanPrimary = primaryPhone.replace(/[^0-9]/g, '');
  const cleanSecondary = secondaryPhone.replace(/[^0-9]/g, '');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl rounded-3xl bg-[#0f131d] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? 'تعديل هوية الموقع وأرقام التواصل' : 'Site Identity & Phone Numbers'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' ? 'تثبيت دائم للوجو والاسم والرقم في أعلى الموقع' : 'Permanent branding and top header contact numbers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-950/80 border border-red-700/80 text-red-200 text-xs flex items-center gap-2.5 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} id="siteSettingsForm" className="space-y-6 text-xs">
            {/* SECTION 1: LOGO & SITE NAME */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'لوجو واسم الموقع' : 'Logo & Site Name'}</span>
              </h3>

              {/* Logo preview and upload */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                {/* Logo Display Circle */}
                <div className="relative group shrink-0">
                  {logoUrl ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-400 shadow-lg shadow-amber-500/20 bg-slate-950">
                      <img 
                        src={logoUrl} 
                        alt="Site Logo" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-yellow-600 p-0.5 shadow-lg shadow-amber-500/20">
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                        <span className="text-2xl">👑</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                    title={lang === 'ar' ? 'تغيير الصورة' : 'Change logo'}
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-2 w-full">
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleLogoFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40 flex items-center gap-1.5 transition-all text-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'رفع لوجو من جهازك' : 'Upload from device'}</span>
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 transition-colors text-xs flex items-center gap-1"
                        title={lang === 'ar' ? 'استعادة التاج الافتراضي' : 'Reset to default crown'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>{lang === 'ar' ? 'استعادة التاج' : 'Reset'}</span>
                      </button>
                    )}
                  </div>

                  {/* Or direct URL input */}
                  <div>
                    <input 
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder={lang === 'ar' ? 'أو ألصق رابط اللوجو المباشر هنا (URL)...' : 'Or paste direct logo image URL...'}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Site Name Input */}
              <div className="space-y-1">
                <label className="block text-slate-300 font-bold">
                  {lang === 'ar' ? 'اسم الموقع / البراند الظاهر في الهيدر' : 'Website Name (Shown in Top Header)'}
                </label>
                <input 
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g. Destroy KING Designer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-sm focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Site Slogan Input */}
              <div className="space-y-1">
                <label className="block text-slate-400">
                  {lang === 'ar' ? 'الوصف الترويجي المختصر (Slogan)' : 'Tagline / Slogan'}
                </label>
                <input 
                  type="text"
                  value={siteSlogan}
                  onChange={(e) => setSiteSlogan(e.target.value)}
                  placeholder="e.g. Animation Gallery & Live Stream VFX"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* SECTION 2: TOP HEADER CONTACT NUMBERS */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'ar' ? 'أرقام التواصل والواتساب الظاهرة بالأعلى' : 'Top Bar Phone & WhatsApp Numbers'}</span>
                </h3>

                {!hasSecondaryPhone && (
                  <button
                    type="button"
                    onClick={() => setHasSecondaryPhone(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{lang === 'ar' ? 'إضافة رقم آخر كمان' : 'Add 2nd Number'}</span>
                  </button>
                )}
              </div>

              {/* Primary Phone / WhatsApp (الرقم الأساسي الموجود فوق) */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'الرقم الأساسي (يظهر في الهيدر مباشرة)' : 'Primary Number (Shown in Header)'}
                  </span>
                  {cleanPrimary && (
                    <a
                      href={`https://wa.me/${cleanPrimary}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>{lang === 'ar' ? 'تجربة رابط الواتساب' : 'Test WhatsApp'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input 
                      type="text"
                      value={primaryPhone}
                      onChange={(e) => setPrimaryPhone(e.target.value)}
                      placeholder="+923400700013"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div>
                    <input 
                      type="text"
                      value={primaryPhoneLabel}
                      onChange={(e) => setPrimaryPhoneLabel(e.target.value)}
                      placeholder="WhatsApp"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Phone / WhatsApp (إضافة رقم آخر كمان) */}
              {hasSecondaryPhone && (
                <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/80 border border-cyan-900/50 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {lang === 'ar' ? 'الرقم الثاني الإضافي' : 'Secondary Contact Number'}
                    </span>
                    <div className="flex items-center gap-2">
                      {cleanSecondary && (
                        <a
                          href={`https://wa.me/${cleanSecondary}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <span>{lang === 'ar' ? 'تجربة الواتساب' : 'Test'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setHasSecondaryPhone(false);
                          setSecondaryPhone('');
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                      >
                        {lang === 'ar' ? 'إزالة الرقم الثاني' : 'Remove'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input 
                        type="text"
                        value={secondaryPhone}
                        onChange={(e) => setSecondaryPhone(e.target.value)}
                        placeholder="+966501234567"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <input 
                        type="text"
                        value={secondaryPhoneLabel}
                        onChange={(e) => setSecondaryPhoneLabel(e.target.value)}
                        placeholder={lang === 'ar' ? 'واتساب 2 / المبيعات' : 'WhatsApp 2'}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {lang === 'ar'
                  ? '💡 سيتم تثبيت الاسم واللوجو ورقم الواتساب بشكل دائم في الهيدر، وعند الضغط على الرقم من قِبل أي زائر سيتم فتح المحادثة مباشرة في واتساب.'
                  : '💡 Branding and WhatsApp numbers are permanently locked into the header. Visitors clicking will be taken directly to WhatsApp.'}
              </p>
            </div>

            {/* SECTION 3: WECHAT QR CODE & BUSINESS EMAIL & SECURITY PASSCODE */}
            <div className="space-y-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'صورة الوي شات (WeChat QR) والبريد ورمز الحماية' : 'WeChat QR Code, Email & Passcode'}</span>
              </h3>

              {/* 1. WeChat QR Code Upload */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{lang === 'ar' ? 'صورة باركود / رمز الوي شات (WeChat QR Code):' : 'WeChat QR Code Image:'}</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  {/* QR Preview Box */}
                  <div className="w-20 h-20 rounded-xl bg-white border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                    {wechatQrUrl ? (
                      <img src={wechatQrUrl} alt="WeChat QR" className="w-full h-full object-contain p-1" />
                    ) : (
                      <div className="text-slate-400 text-[10px] text-center p-1">
                        {lang === 'ar' ? 'رمز افتراضي' : 'Default QR'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        ref={wechatQrInputRef} 
                        onChange={handleWeChatQrFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button
                        type="button"
                        onClick={() => wechatQrInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40 flex items-center gap-1.5 transition-all text-xs cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'رفع صورة الوي شات من جهازك' : 'Upload WeChat QR'}</span>
                      </button>

                      {wechatQrUrl && (
                        <button
                          type="button"
                          onClick={() => setWechatQrUrl('')}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>{lang === 'ar' ? 'حذف' : 'Clear'}</span>
                        </button>
                      )}
                    </div>

                    <input 
                      type="text"
                      value={wechatQrUrl}
                      onChange={(e) => setWechatQrUrl(e.target.value)}
                      placeholder={lang === 'ar' ? 'أو ألصق رابط صورة الوي شات هنا مباشرة...' : 'Or paste WeChat QR Image URL...'}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'معرف حساب الوي شات (WeChat ID)' : 'WeChat ID'}
                  </label>
                  <input 
                    type="text"
                    value={wechat}
                    onChange={(e) => setWechat(e.target.value)}
                    placeholder="southasia216"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 2. Business Email Input */}
              <div className="space-y-1 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <label className="block text-xs font-bold text-slate-200">
                  {lang === 'ar' ? 'البريد الإلكتروني للدعم والتواصل' : 'Business Support Email'}
                </label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="southasia216@gmail.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>

              {/* 3. Delete All Products Passcode Input */}
              <div className="space-y-1 p-3.5 rounded-xl bg-slate-950/80 border border-red-900/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-red-300">
                    {lang === 'ar' ? 'كلمة سر الحماية لحذف جميع المنتجات (Passcode)' : 'Security Passcode for Deleting Products'}
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">150 150</span>
                </div>
                <input 
                  type="text"
                  value={deletePasscode}
                  onChange={(e) => setDeletePasscode(e.target.value)}
                  placeholder="150150"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-red-800/60 text-white font-mono font-bold text-xs focus:outline-none focus:border-red-400"
                />
                <p className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'كلمة السر المطلوبة عند الضغط على زر "حذف جميع المنتجات" لحماية المتجر.' : 'Passcode required when deleting all products.'}
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="submit"
            form="siteSettingsForm"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4 stroke-[3]" />
            )}
            <span>
              {isSaving
                ? (lang === 'ar' ? 'جارِ الحفظ والتثبيت...' : 'Saving...')
                : (lang === 'ar' ? 'حفظ وتثبيت بشكل دائم' : 'Save & Lock Permanently')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
