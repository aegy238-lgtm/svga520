import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Crown, Sparkles, CheckCircle2, MessageCircle, Key, 
  AlertCircle, ShieldCheck, Zap, FastForward, Film, Clock, Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDocs, query, collection, where, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppSettings, LicenseKey, UserRecord } from '../types';

interface VipSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  currentUser?: UserRecord | null;
  initialFeatureName?: string;
}

export const VipSubscriptionModal: React.FC<VipSubscriptionModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentUser: propUser,
  initialFeatureName
}) => {
  const { currentUser: authUser } = useAuth();
  const currentUser = propUser || authUser;
  
  const [activeTab, setActiveTab] = useState<'purchase' | 'activate'>('purchase');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Extract VIP price in USD set by admin
  const vipPriceUsd = (settings as any)?.costs?.vipPrice || (settings as any)?.vipSubscriptionPrice || 15;
  const rawWhatsapp = settings?.whatsappNumber || '201000000000';
  const cleanWhatsapp = rawWhatsapp.replace(/[^0-9]/g, '');

  const featureTitle = initialFeatureName || 'تحرير طبقات SVGA';

  const whatsappMessage = `مرحباً، أرغب في شراء اشتراك VIP الملكي ($${vipPriceUsd} دولار) لتفعيل الميزات الحصرية وميزة (${featureTitle}).
بيانات الحساب:
الاسم: ${currentUser?.name || currentUser?.displayName || 'مستخدم'}
البريد: ${currentUser?.email || 'N/A'}
المعرف: ${currentUser?.id || currentUser?.numericId || 'N/A'}`;

  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(whatsappMessage)}`;

  const handleActivateKey = async () => {
    if (!licenseKey.trim() || !currentUser) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const q = query(collection(db, 'licenseKeys'), where('key', '==', licenseKey.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError('مفتاح الترخيص غير صالح أو تم إدخاله بشكل خاطئ');
        setLoading(false);
        return;
      }

      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as LicenseKey;

      if (keyData.isUsed) {
        setError('هذا المفتاح مستخدم من قبل في حساب آخر');
        setLoading(false);
        return;
      }

      let expiry = new Date();
      if (keyData.duration === 'day') expiry.setDate(expiry.getDate() + 1);
      else if (keyData.duration === 'week') expiry.setDate(expiry.getDate() + 7);
      else if (keyData.duration === 'month') expiry.setMonth(expiry.getMonth() + 1);
      else if (keyData.duration === 'year') expiry.setFullYear(expiry.getFullYear() + 1);
      else expiry.setFullYear(expiry.getFullYear() + 5); // Lifetime default

      // Update User to VIP
      await updateDoc(doc(db, 'users', currentUser.id), {
        isVIP: true,
        subscriptionType: keyData.duration || 'month',
        subscriptionExpiry: Timestamp.fromDate(expiry),
        activatedKey: keyData.key,
        hasSvgaExAccess: true
      });

      // Mark Key as Used
      await updateDoc(doc(db, 'licenseKeys', keyDoc.id), {
        isUsed: true,
        usedBy: currentUser.id,
        usedAt: Timestamp.now()
      });

      setSuccess(`تهانينا! تم تفعيل اشتراك VIP الملكي (${keyData.duration}) بنجاح!`);
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1800);

    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء الاتصال بالسيرفر والتفعيل: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isAlreadyVip = !!(currentUser?.isVIP || currentUser?.role === 'admin' || currentUser?.isSuperAdmin);

  return (
    <AnimatePresence>
      <div 
        id="vip-subscription-modal-backdrop"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        dir="rtl"
      >
        <motion.div
          id="vip-subscription-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-gradient-to-b from-[#181105] via-[#150d22] to-[#0a0d18] border border-amber-500/40 rounded-[2.5rem] shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden text-white my-8"
        >
          {/* Glowing Ambient Background Orbs */}
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-amber-500/15 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            id="vip-modal-close-btn"
            onClick={onClose}
            className="absolute top-5 left-5 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all z-20 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Banner */}
          <div className="pt-8 pb-6 px-6 sm:px-10 text-center relative border-b border-amber-500/20 bg-gradient-to-b from-amber-500/10 to-transparent">
            {/* Royal Crown Badge */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 shadow-[0_0_30px_rgba(245,158,11,0.5)] mb-4">
              <div className="w-full h-full bg-[#160e02] rounded-[22px] flex items-center justify-center">
                <Crown className="w-10 h-10 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse" />
              </div>
            </div>

            <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-widest uppercase mb-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              👑 مركز ترقية واشتراك VIP الحصري
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 tracking-tight">
              اشتراك VIP الملكي • VIP Center
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-lg mx-auto leading-relaxed">
              ارتقِ بحسابك إلى عضوية VIP للحصول على وصول فوري ومباشر إلى أحدث الأدوات الحصرية وأقصى سرعة معالجة.
            </p>

            {/* Current Status Pill */}
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold">
              <span className="text-slate-400">حالة حسابك:</span>
              {isAlreadyVip ? (
                <span className="text-amber-400 flex items-center gap-1 font-black">
                  <Crown className="w-3.5 h-3.5" /> VIP مفعل ونشط ⭐
                </span>
              ) : (
                <span className="text-slate-300 font-semibold">حساب عادي (غير مفعل)</span>
              )}
            </div>
          </div>

          {/* Pricing Highlight Card */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-purple-600/15 border border-amber-400/40 p-5 sm:p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-right">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">سعر الاشتراك المحدد</span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                      قيمة خاصة بالدولار
                    </span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-white mt-1 flex items-baseline justify-center sm:justify-start gap-1">
                    <span className="text-amber-400 font-mono">${vipPriceUsd}</span>
                    <span className="text-sm font-normal text-slate-300">دولار أمريكي (USD)</span>
                  </div>
                  <p className="text-xs text-amber-200/80 mt-1">تفعيل فوري لكافة الميزات الملكية وميزة ({featureTitle})</p>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <a
                    id="vip-whatsapp-direct-btn"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all hover:scale-105 active:scale-95 text-center"
                  >
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>شراء عبر واتساب (${vipPriceUsd})</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Exclusive VIP Features List */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>ماذا ستحصل عند الاشتراك في VIP؟</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-amber-400/30 hover:border-amber-400/50 transition-colors bg-gradient-to-br from-amber-500/10 to-transparent">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">تحرير طبقات SVGA (محرر كانفاس متقدم)</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      التحكم التفاعلي بالماوس في الكانفاس، تدوير، تحجيم وترتيب الطبقات مع الحفاظ على الحركة والأصوات.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/30 transition-colors">
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">أولوية معالجة وتصدير قصوى</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      تصدير سريع وبأعلى جودة لملفات SVGA 2.0 و VAP و WebM و GIF بلا حدود أو بطء.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/30 transition-colors">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">شارة VIP الذهبية المميزة</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      ظهور التاج الذهبي في حسابك وعلى كل أدواتك وملفاتك الشخصية داخل المنصة.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-400/30 transition-colors">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">دعم فني مباشر وتفعيل سريع</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      تواصل دائم عبر واتساب لتقديم المساعدة والتفعيل المباشر من المدير في أي وقت.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* License Key Activation Option */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'activate' ? 'purchase' : 'activate')}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{activeTab === 'activate' ? 'إخفاء خانة كود التفعيل' : 'هل اشتريت كود تفعيل؟ اضغط هنا لإدخاله وتفعيله'}</span>
                </button>
              </div>

              {activeTab === 'activate' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/10"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="vip-license-key-input"
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder="أدخل كود تفعيل VIP هنا..."
                      className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-4 py-2.5 text-center text-white font-mono uppercase text-sm focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <button
                      type="button"
                      id="vip-activate-key-btn"
                      onClick={handleActivateKey}
                      disabled={loading || !licenseKey.trim()}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl text-xs transition-all shadow-md cursor-pointer"
                    >
                      {loading ? 'جاري التفعيل...' : 'تفعيل'}
                    </button>
                  </div>

                  {error && (
                    <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 bg-black/50 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>منصة SVGA Platinum • مركز ترقية واشتراك VIP</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline font-bold flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب الدعم: {cleanWhatsapp || 'متاح'}</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
