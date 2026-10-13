import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Zap, Crown, Check, Sparkles, Shield, Upload, Image as ImageIcon, 
  Calendar, Clock, DollarSign, AlertTriangle, ArrowRight, CheckCircle2,
  Share2, MessageCircle, RefreshCw, Trash2, Camera
} from 'lucide-react';
import { UserRecord, ProPlan, ProFeature, ProSettings } from '../types';
import { 
  isProActive, 
  getProStatus, 
  hasProFeature,
  fetchProPlans,
  fetchProSettings,
  fetchProFeatures,
  createProOrder,
  grantProMembership,
  processAndUploadAvatar,
  DEFAULT_PRO_PLANS,
  DEFAULT_PRO_SETTINGS
} from '../utils/proMembership';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserRecord | null;
  onOpenAdmin?: () => void;
}

export const ProMembershipModal: React.FC<ProMembershipModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenAdmin
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'plans' | 'avatar' | 'compare'>('plans');
  const [plans, setPlans] = useState<ProPlan[]>(DEFAULT_PRO_PLANS);
  const [settings, setSettings] = useState<ProSettings>(DEFAULT_PRO_SETTINGS);
  const [selectedPlan, setSelectedPlan] = useState<ProPlan | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseStep, setPurchaseStep] = useState<'select' | 'payment' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = useState<'coins' | 'whatsapp'>('coins');
  const [createdOrderId, setCreatedOrderId] = useState<string>('');

  // Avatar Upload State
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentUser?.photoURL || null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string>('');
  const [avatarSuccess, setAvatarSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPro = isProActive(currentUser);
  const proStatus = getProStatus(currentUser);
  const canUploadAvatar = isPro && hasProFeature(currentUser, 'avatar_upload');

  useEffect(() => {
    const load = async () => {
      const [p, s] = await Promise.all([fetchProPlans(), fetchProSettings()]);
      setPlans(p);
      setSettings(s);
      if (p.length > 0 && !selectedPlan) {
        setSelectedPlan(p.find(item => item.isPopular) || p[0]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (currentUser?.photoURL) {
      setAvatarPreview(currentUser.photoURL);
    }
  }, [currentUser?.photoURL]);

  // Handle Avatar Selection
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setAvatarError('');
    setAvatarSuccess('');
    setIsUploadingAvatar(true);

    try {
      const dataUrl = await processAndUploadAvatar(file, currentUser);
      setAvatarPreview(dataUrl);
      setAvatarSuccess('تم تحديث وحفظ صورة البروفايل الشخصية بنجاح! ✨');
      setTimeout(() => setAvatarSuccess(''), 4000);
    } catch (err: any) {
      setAvatarError(err.message || 'فشل رفع الصورة');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Remove Avatar
  const handleRemoveAvatar = async () => {
    if (!currentUser || !confirm('هل أنت متأكد من إزالة الصورة الشخصية؟')) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        photoURL: null,
        avatarUrl: null
      });
      setAvatarPreview(null);
      setAvatarSuccess('تمت إزالة الصورة الشخصية');
      setTimeout(() => setAvatarSuccess(''), 3000);
    } catch (err: any) {
      setAvatarError(err.message || 'فشل إزالة الصورة');
    }
  };

  // Handle Purchase Plan
  const handleProceedPurchase = async () => {
    if (!currentUser || !selectedPlan) return;

    setIsPurchasing(true);
    try {
      if (paymentMethod === 'coins') {
        const costInCoins = Math.round(selectedPlan.price * 100);
        const userCoins = currentUser.coins || 0;

        if (userCoins < costInCoins) {
          alert(`رصيدك الحالي (${userCoins} عملة) غير كافٍ. تحتاج إلى ${costInCoins} عملة لشراء هذه الباقة. يرجى شحن الرصيد أولاً أو اختيار التحويل عبر الواتساب.`);
          setIsPurchasing(false);
          return;
        }

        // Deduct coins & Grant PRO
        await updateDoc(doc(db, 'users', currentUser.id), {
          coins: increment(-costInCoins)
        });

        await grantProMembership({
          userId: currentUser.id,
          plan: selectedPlan,
          durationDays: selectedPlan.durationDays,
          adminUser: null,
          notes: `شراء ذاتي بالعملات (${costInCoins} عملة)`
        });

        setPurchaseStep('success');
      } else {
        // WhatsApp / Manual Payment
        const orderId = await createProOrder({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          planId: selectedPlan.id,
          planName: selectedPlan.nameAr,
          durationDays: selectedPlan.durationDays,
          price: selectedPlan.price,
          currency: selectedPlan.currency,
          paymentMethod: 'whatsapp'
        });

        setCreatedOrderId(orderId);
        setPurchaseStep('payment');

        // Open WhatsApp
        const phone = settings.whatsappContact?.replace(/[^0-9]/g, '') || '201000000000';
        const msg = encodeURIComponent(
          `مرحباً، أود تفعيل عضوية PRO في الموقع:\n- رقم الطلب: #${orderId.substring(0, 8)}\n- اسم الحساب: ${currentUser.name}\n- البريد: ${currentUser.email || 'N/A'}\n- الباقة: ${selectedPlan.nameAr} (${selectedPlan.price} ${selectedPlan.currency})\n- المدة: ${selectedPlan.durationLabel}`
        );
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      }
    } catch (err: any) {
      alert('حدث خطأ أثناء إتمام الطلب: ' + (err.message || String(err)));
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-in fade-in" dir="rtl">
      <div className="bg-[#0b1224] border border-purple-500/40 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh] relative">
        
        {/* Glow ambient effects */}
        <div className="absolute -top-32 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 bg-slate-950/70 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 border border-purple-400/40 shrink-0">
              <Zap className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-black text-white">عضوية PRO الاحترافية</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm flex items-center gap-1">
                  <Sparkles size={10} /> PRO TIER
                </span>
              </div>
              <p className="text-xs text-slate-400">صلاحيات حصرية، شارة نيون، صورة شخصية، ومساحة رفع مضاعفة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer"
              >
                <span>لوحة تحكم PRO</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub Header Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/5 bg-slate-950/40 relative z-10">
          {[
            { id: 'plans', label: 'باقات الاشتراك والأسعار', icon: DollarSign },
            { id: 'avatar', label: 'الصورة الشخصية للبروفايل', icon: ImageIcon },
            { id: 'compare', label: 'مقارنة الصلاحيات', icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setPurchaseStep('select');
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-b-2 ${
                  isActive
                    ? 'border-purple-500 text-purple-300 bg-purple-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 relative z-10">
          
          {/* Active Status Hero Card (if user is PRO) */}
          {isPro && (
            <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/60 border border-purple-500/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-right">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] shrink-0">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl">
                      {(currentUser?.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-0.5 text-white">
                    <Zap size={12} className="fill-current" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-black text-white text-base">{currentUser?.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-sm flex items-center gap-0.5">
                      <Zap size={10} /> PRO
                    </span>
                  </div>
                  <p className="text-xs text-purple-300 mt-0.5 font-bold">
                    الباقة الحالية: {proStatus.planName}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تاريخ الانتهاء: <span className="font-mono text-slate-200">{proStatus.formattedExpiry}</span> ({proStatus.daysRemaining} يوم متبقي)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('avatar')}
                  className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer"
                >
                  تغيير الصورة الشخصية 🖼️
                </button>
              </div>
            </div>
          )}

          {/* ---------------- 1. PLANS TAB ---------------- */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {purchaseStep === 'select' && (
                <>
                  <div className="text-center max-w-xl mx-auto">
                    <h4 className="text-xl font-black text-white">اختر باقة PRO المناسبة لاحتياجاتك</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      احصل على هوية بصرية ملكية مميزة ومساحة رفع مضاعفة وأدوات تصميم حصرية مع تفعيل فوري.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {plans.map(plan => {
                      const isSelected = selectedPlan?.id === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className={`relative rounded-3xl p-6 border transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-b from-purple-900/40 to-slate-900 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.25)] scale-[1.02]'
                              : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {plan.isPopular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-black px-3.5 py-0.5 rounded-full shadow-lg">
                              الأكثر طلباً 🔥
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-black text-white text-base">{plan.nameAr}</h5>
                              <span className="text-[11px] font-bold text-slate-400">{plan.durationLabel}</span>
                            </div>

                            <div className="my-3 flex items-baseline gap-1">
                              <span className="text-3xl font-black text-white">{plan.price}</span>
                              <span className="text-sm font-bold text-purple-300">{plan.currency}</span>
                              <span className="text-[11px] text-slate-500 mr-2">({Math.round(plan.price * 100)} عملة)</span>
                            </div>

                            <p className="text-xs text-slate-400 mb-4 leading-relaxed">{plan.descriptionAr}</p>

                            <div className="space-y-2 border-t border-white/10 pt-4 mb-6">
                              {plan.features.map(fId => (
                                <div key={fId} className="flex items-center gap-2 text-xs text-slate-300">
                                  <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  <span>
                                    {fId === 'avatar_upload' && 'رفع وتغيير صورة البروفايل'}
                                    {fId === 'pro_badge' && 'شارة PRO النيون الملكية'}
                                    {fId === 'pro_avatar_frame' && 'إطار بروفايل متوهج'}
                                    {fId === 'custom_name_color' && 'ألوان وتأثيرات متدرجة للاسم'}
                                    {fId === 'exclusive_tools' && 'أدوات ومؤثرات حصرية'}
                                    {fId === 'advanced_designer' && 'محرر التصميم المتقدم'}
                                    {fId === 'high_file_limits' && 'سعة رفع حتى 500MB'}
                                    {fId === 'extra_storage' && 'مساحة تخزين سحابية 20GB'}
                                    {fId === 'exclusive_downloads' && 'تنزيل ملفات نادرة مجاناً'}
                                    {fId === 'priority_processing' && 'أولوية معالجة فورية'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlan(plan);
                              setPurchaseStep('payment');
                            }}
                            className={`w-full py-2.5 rounded-xl font-black text-xs transition-all shadow-md cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                                : 'bg-white/10 hover:bg-white/15 text-white'
                            }`}
                          >
                            {isPro ? 'تمديد / ترقية العضوية ⚡' : 'اشترك في هذه الباقة الآن ⚡'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Purchase Step: Payment Method Selection */}
              {purchaseStep === 'payment' && selectedPlan && (
                <div className="max-w-md mx-auto bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
                  <div className="text-center">
                    <h4 className="text-lg font-black text-white">إتمام الاشتراك في {selectedPlan.nameAr}</h4>
                    <p className="text-xs text-purple-300 font-bold mt-1">
                      القيمة: {selectedPlan.price} {selectedPlan.currency} ({Math.round(selectedPlan.price * 100)} عملة) • المدة: {selectedPlan.durationLabel}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">اختر طريقة الدفع المناسبة:</label>
                    <div className="space-y-2.5">
                      <div
                        onClick={() => setPaymentMethod('coins')}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          paymentMethod === 'coins'
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-slate-950/60 border-white/10 text-slate-400 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                            🪙
                          </div>
                          <div>
                            <span className="font-bold text-xs block text-white">الدفع برصيد العملات (تفعيل فوري ⚡)</span>
                            <span className="text-[11px] text-slate-400">
                              رصيدك الحالي: {currentUser?.coins || 0} عملة
                            </span>
                          </div>
                        </div>
                        <input type="radio" checked={paymentMethod === 'coins'} readOnly className="text-purple-600" />
                      </div>

                      <div
                        onClick={() => setPaymentMethod('whatsapp')}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          paymentMethod === 'whatsapp'
                            ? 'bg-emerald-600/20 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-white/10 text-slate-400 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs block text-white">التحويل اليدوي وتواصل واتساب</span>
                            <span className="text-[11px] text-slate-400">فودافون كاش، بنك، أو تحويل محلي</span>
                          </div>
                        </div>
                        <input type="radio" checked={paymentMethod === 'whatsapp'} readOnly className="text-emerald-600" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setPurchaseStep('select')}
                      className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white"
                    >
                      رجوع
                    </button>
                    <button
                      type="button"
                      onClick={handleProceedPurchase}
                      disabled={isPurchasing}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isPurchasing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                      <span>تأكيد وتفعيل العضوية</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Purchase Step: Success */}
              {purchaseStep === 'success' && (
                <div className="max-w-md mx-auto text-center bg-slate-900/90 border border-purple-500/40 rounded-3xl p-8 space-y-4 animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-black text-white">تهانينا! تم تفعيل عضوية PRO بنجاح ⚡</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    أصبحت الآن عضو PRO رسمي في الموقع! استمتع بشارة PRO الملكية، وإمكانية تغيير صورة البروفايل، وسعة الرفع المتقدمة.
                  </p>
                  <button
                    onClick={() => {
                      setPurchaseStep('select');
                      setActiveTab('avatar');
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs shadow-lg shadow-purple-600/30 cursor-pointer"
                  >
                    تخصيص صورة البروفايل الآن 🖼️
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------------- 2. AVATAR UPLOAD TAB ---------------- */}
          {activeTab === 'avatar' && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="text-center">
                <h4 className="text-lg font-black text-white">إدارة وتخصيص صورة البروفايل الشخصية</h4>
                <p className="text-xs text-slate-400 mt-1">
                  ميزة حصرية لأعضاء PRO: ارفع صورتك الخاصة مع إطار نيون براق وشارة PRO مميزة.
                </p>
              </div>

              {avatarError && (
                <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{avatarError}</span>
                </div>
              )}

              {avatarSuccess && (
                <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{avatarSuccess}</span>
                </div>
              )}

              {/* Live Profile Card Preview */}
              <div className="bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                <div className="relative mb-4">
                  {/* Neon Glowing Profile Frame */}
                  <div className={`w-28 h-28 rounded-3xl relative overflow-hidden border-2 transition-all ${
                    isPro 
                      ? 'border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)] ring-4 ring-purple-500/20' 
                      : 'border-white/20'
                  }`}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-black">
                        {(currentUser?.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* PRO Badge Overlay */}
                  {isPro && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-purple-300/40 flex items-center gap-1">
                      <Zap size={10} className="fill-current" />
                      <span>PRO</span>
                    </div>
                  )}
                </div>

                <h5 className="text-base font-black text-white flex items-center gap-2">
                  <span>{currentUser?.name}</span>
                  {isPro && <Sparkles size={14} className="text-purple-400" />}
                </h5>
                <span className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">{currentUser?.email}</span>

                {/* Upload Action Buttons */}
                <div className="flex items-center gap-3 mt-6 w-full max-w-xs">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    className="hidden"
                  />

                  {canUploadAvatar ? (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        {isUploadingAvatar ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        <span>{avatarPreview ? 'تغيير الصورة' : 'رفع صورة من جهازك'}</span>
                      </button>

                      {avatarPreview && (
                        <button
                          onClick={handleRemoveAvatar}
                          className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="w-full p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs font-bold text-center">
                      🔒 رفع وتغيير الصورة الشخصية متاح لأعضاء PRO فقط. يرجى الاشتراك لفتح الميزة.
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 mt-3">
                  الصيغ المدعومة: PNG, JPG, WebP. الحد الأقصى للحجم: 5 ميجابايت.
                </p>
              </div>
            </div>
          )}

          {/* ---------------- 3. COMPARE TAB ---------------- */}
          {activeTab === 'compare' && (
            <div className="space-y-4">
              <div className="text-center max-w-xl mx-auto">
                <h4 className="text-lg font-black text-white">مقارنة العضويات والصلاحيات</h4>
                <p className="text-xs text-slate-400 mt-1">
                  اكتشف الفارق بين الحساب العادي وعضوية PRO الاحترافية وباقة VIP الملكية.
                </p>
              </div>

              <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/10">
                    <tr>
                      <th className="p-3.5">الميزة أو الصلاحية</th>
                      <th className="p-3.5 text-center">المستخدم العادي</th>
                      <th className="p-3.5 text-center text-purple-300 font-black">عضوية PRO ⚡</th>
                      <th className="p-3.5 text-center text-amber-300 font-black">عضوية VIP 👑</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {[
                      { name: 'رفع وتغيير صورة البروفايل الشخصية', normal: '❌', pro: '✅ نعم', vip: '✅ نعم' },
                      { name: 'شارة تمييز بجانب الاسم', normal: '❌', pro: '⚡ شارة PRO نيون', vip: '👑 شارة VIP ذهبية' },
                      { name: 'إطار متوهج لصورة الحساب', normal: '❌', pro: '✅ إطار نيون حصري', vip: '✅ إطار ملكي' },
                      { name: 'الحد الأقصى لحجم الملفات المرفوعة', normal: '30MB', pro: '⚡ 500MB', vip: '⚡ 500MB' },
                      { name: 'مساحة تخزين سحابية خاصة', normal: '1GB', pro: '⚡ حتى 20GB', vip: '⚡ حتى 50GB' },
                      { name: 'الوصول لمحرر الطبقات ومصمم 3D', normal: 'محدود', pro: '✅ كامل بلا قيود', vip: '✅ كامل بلا قيود' },
                      { name: 'تنزيل مؤثرات وقوالب نادرة مجاناً', normal: '❌ غير متاح', pro: '✅ متجر PRO النادر', vip: '✅ مكتبة VIP' },
                      { name: 'أولوية وسرعة فائقة في معالجة الفيديو', normal: 'عادي', pro: '⚡ فوري (VIP Queue)', vip: '⚡ فوري (VIP Queue)' },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-bold text-white">{row.name}</td>
                        <td className="p-3.5 text-center text-slate-400">{row.normal}</td>
                        <td className="p-3.5 text-center font-bold text-purple-300 bg-purple-500/5">{row.pro}</td>
                        <td className="p-3.5 text-center font-bold text-amber-300 bg-amber-500/5">{row.vip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
