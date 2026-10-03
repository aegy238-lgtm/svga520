import React, { useState, useEffect } from 'react';
import { UserRecord, LicenseKey } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { 
  User, CreditCard, Key, X, CheckCircle, AlertCircle, 
  BadgeCheck, Calendar, Clock, Crown, AlertTriangle, ShieldCheck,
  Sparkles, RefreshCw, Zap
} from 'lucide-react';
import { calculateSubscriptionInfo, formatArabicDate, parseDate } from '../utils/subscriptionUtils';

interface UserProfileModalProps {
  currentUser: UserRecord;
  onClose: () => void;
  onOpenStore?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ currentUser, onClose, onOpenStore }) => {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Live subscription info calculation (always in sync with current clock)
  const [subInfo, setSubInfo] = useState(() => calculateSubscriptionInfo(currentUser));

  useEffect(() => {
    // Recalculate every minute or when currentUser updates
    const updateInfo = () => setSubInfo(calculateSubscriptionInfo(currentUser));
    updateInfo();
    const interval = setInterval(updateInfo, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // If user subscription was marked VIP in database but now actually expired according to Date,
  // automatically synchronize user's doc to prevent stale states
  useEffect(() => {
    if (subInfo.isExpired && currentUser.isVIP && currentUser.id && currentUser.role !== 'admin' && !currentUser.isSuperAdmin) {
      updateDoc(doc(db, 'users', currentUser.id), {
        isVIP: false,
        subscriptionStatus: 'expired'
      }).catch(err => console.warn('Could not auto-sync expired status:', err));
    }
  }, [subInfo.isExpired, currentUser]);

  const handleRedeemKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    
    setLoading(true);
    setMessage(null);

    try {
      // 1. Find the key
      const q = query(collection(db, 'licenseKeys'), where('key', '==', keyInput.trim()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage({ type: 'error', text: 'مفتاح التفعيل غير صحيح أو غير موجود' });
        setLoading(false);
        return;
      }

      const keyDoc = snapshot.docs[0];
      const keyData = keyDoc.data() as LicenseKey;

      if (keyData.isUsed) {
        setMessage({ type: 'error', text: 'هذا المفتاح تم استخدامه مسبقاً' });
        setLoading(false);
        return;
      }

      // 2. Calculate new expiry
      let expiry = new Date();
      const currentExpiry = parseDate(currentUser.subscriptionExpiry);
      
      if (currentExpiry && currentExpiry > new Date()) {
        expiry = new Date(currentExpiry);
      }

      if (keyData.duration === 'day') expiry.setDate(expiry.getDate() + 1);
      else if (keyData.duration === 'week') expiry.setDate(expiry.getDate() + 7);
      else if (keyData.duration === 'month') expiry.setMonth(expiry.getMonth() + 1);
      else if (keyData.duration === 'year') expiry.setFullYear(expiry.getFullYear() + 1);
      else if ((keyData.duration as string) === 'lifetime') expiry.setFullYear(expiry.getFullYear() + 20);

      // 3. Update Key status
      await updateDoc(doc(db, 'licenseKeys', keyDoc.id), {
        isUsed: true,
        usedBy: currentUser.id,
        usedAt: Timestamp.now()
      });

      // 4. Update User subscription
      await updateDoc(doc(db, 'users', currentUser.id), {
        subscriptionType: keyData.duration,
        subscriptionStartDate: Timestamp.now(),
        subscriptionExpiry: Timestamp.fromDate(expiry),
        isVIP: true,
        activatedKey: keyData.key,
        subscriptionStatus: 'active'
      });

      setMessage({ type: 'success', text: `تم تفعيل وتمديد الاشتراك (${keyData.duration}) بنجاح!` });
      setKeyInput('');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error("Redemption error:", error);
      setMessage({ type: 'error', text: error.message || 'حدث خطأ أثناء التفعيل' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b1329] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">الملف الشخصي والاشتراك</h3>
              <p className="text-xs text-slate-400">إدارة وتفاصيل الحساب وتاريخ انتهاء الصلاحية</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* User Info Header Card */}
          <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl relative shadow-lg shadow-indigo-600/20 overflow-visible shrink-0">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.name} 
                    className="w-14 h-14 rounded-2xl object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white border border-white/10">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {subInfo.isActive && (
                  <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full p-0.5 z-10">
                    <BadgeCheck className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <span>{currentUser.name}</span>
                  {currentUser.isVIP && <Crown className="w-4 h-4 text-amber-400" />}
                </h4>
                <p className="text-slate-400 text-xs font-mono" dir="ltr">{currentUser.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                    currentUser.role === 'admin' 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' 
                      : currentUser.isVIP 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                      : 'bg-slate-800 text-slate-400 border-white/5'
                  }`}>
                    {currentUser.role === 'admin' ? 'مدير عام 👑' : currentUser.role === 'moderator' ? 'مشرف 🛡️' : currentUser.isVIP ? 'عضوية VIP 👑' : 'عضوية عادية'}
                  </span>
                  {currentUser.numericId && (
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                      ID: {currentUser.numericId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Tag */}
            <div className="text-left shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${subInfo.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${subInfo.dotClass}`} />
                <span>{subInfo.statusLabelAr}</span>
              </span>
            </div>
          </div>

          {/* Expiring Soon / Expired Alerts */}
          {subInfo.isExpiringSoon && (
            <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-200 text-xs flex items-start gap-3 shadow-lg shadow-amber-500/10 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-amber-300 mb-0.5">تنبيه: اقترب موعد انتهاء الاشتراك!</div>
                <div>اشتراكك الحالي سينتهي قريباً ({subInfo.formattedRemaining}). يرجى تجديد الاشتراك لضمان استمرار الاستفادة من الميزات.</div>
              </div>
            </div>
          )}

          {subInfo.isExpired && (
            <div className="p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-500/10">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-rose-300 mb-0.5">انتهت صلاحية اشتراكك</div>
                <div>انتهى اشتراكك في تاريخ {subInfo.expiryDateFormatted}. يرجى إدخال كود اشتراك جديد لتفعيل الحساب ومتابعة الاستخدام.</div>
              </div>
            </div>
          )}

          {/* Subscription Details Grid */}
          <div className="bg-slate-950/70 rounded-2xl p-4 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>تفاصيل ومعلومات الاشتراك</span>
              </span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${subInfo.badgeClass}`}>
                {subInfo.statusLabelAr}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              {/* Subscription Type */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block mb-1">نوع الاشتراك</span>
                <span className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{subInfo.subscriptionTypeLabel}</span>
                </span>
              </div>

              {/* Remaining Days */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block mb-1">المدة المتبقية</span>
                <span className={`font-black text-sm ${
                  subInfo.isExpired 
                    ? 'text-rose-400' 
                    : subInfo.isExpiringSoon 
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`}>
                  {subInfo.formattedRemaining}
                </span>
              </div>

              {/* Start Date */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>تاريخ بداية الاشتراك</span>
                </span>
                <span className="font-mono text-slate-200">
                  {subInfo.startDateFormatted}
                </span>
              </div>

              {/* Expiry Date */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
                <span className="text-slate-400 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>تاريخ انتهاء الاشتراك</span>
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {subInfo.expiryDateFormatted}
                </span>
              </div>
            </div>

            {/* Time progress bar if active & not lifetime */}
            {subInfo.isActive && !subInfo.isLifetime && (
              <div className="pt-2">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-bold">
                  <span>نسبة الوقت المنقضي</span>
                  <span>{subInfo.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      subInfo.isExpiringSoon 
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                        : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                    }`}
                    style={{ width: `${subInfo.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Redeem Key Form */}
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/10">
            <label className="block text-xs font-black text-slate-300 mb-2.5 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>تفعيل أو تجديد الاشتراك بكود ترخيص</span>
            </label>
            <form onSubmit={handleRedeemKey} className="relative">
              <input 
                type="text" 
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="أدخل كود الاشتراك (License Key)..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 pr-4 focus:outline-none focus:border-indigo-500/60 transition-colors text-center font-mono uppercase text-xs text-white"
              />
              <button 
                type="submit"
                disabled={loading || !keyInput.trim()}
                className="absolute left-2 top-2 bottom-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>{loading ? 'جاري التفعيل...' : 'تفعيل الكود'}</span>
              </button>
            </form>

            {message && (
              <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 border ${
                message.type === 'success' 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>محدث تلقائياً ومباشر</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
