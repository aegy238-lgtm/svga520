import React, { useState, useEffect } from 'react';
import { 
  X, Calendar, Clock, Sparkles, CheckCircle2, AlertTriangle, 
  Crown, Save, RotateCcw, ShieldCheck, User, Zap, AlertCircle
} from 'lucide-react';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  calculateSubscriptionInfo, 
  calculateExtendedExpiry, 
  formatArabicDate, 
  formatInputDate, 
  parseDate 
} from '../../utils/subscriptionUtils';

interface UserSubscriptionModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  currentAdminEmail?: string;
}

export const UserSubscriptionModal: React.FC<UserSubscriptionModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdated,
  currentAdminEmail
}) => {
  if (!isOpen || !user) return null;

  const currentInfo = calculateSubscriptionInfo(user);

  const [subscriptionType, setSubscriptionType] = useState<string>(
    user.subscriptionType || (user.isVIP ? 'month' : 'none')
  );
  const [isVip, setIsVip] = useState<boolean>(!!user.isVIP);
  
  // Custom date state (YYYY-MM-DD)
  const [expiryDateInput, setExpiryDateInput] = useState<string>(() => {
    const d = parseDate(user.subscriptionExpiry);
    return d ? formatInputDate(d) : '';
  });

  const [startDateInput, setStartDateInput] = useState<string>(() => {
    const d = parseDate(user.subscriptionStartDate) || parseDate(user.createdAt);
    return d ? formatInputDate(d) : formatInputDate(new Date());
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Calculate preview of what new expiry will be
  const previewExpiryDate = expiryDateInput ? new Date(expiryDateInput + 'T23:59:59') : null;
  const previewInfo = calculateSubscriptionInfo({
    ...user,
    subscriptionExpiry: previewExpiryDate,
    subscriptionStartDate: startDateInput ? new Date(startDateInput) : new Date(),
    subscriptionType,
    isVIP: isVip
  });

  const handleQuickExtend = (duration: '1day' | '7days' | '1month' | '3months' | '6months' | '1year' | 'lifetime') => {
    const currentExp = parseDate(user.subscriptionExpiry);
    const newDate = calculateExtendedExpiry(currentExp, duration);
    setExpiryDateInput(formatInputDate(newDate));
    setIsVip(true);

    if (duration === '1day') setSubscriptionType('day');
    else if (duration === '7days') setSubscriptionType('week');
    else if (duration === '1month') setSubscriptionType('month');
    else if (duration === '3months') setSubscriptionType('3months');
    else if (duration === '1year') setSubscriptionType('year');
    else if (duration === 'lifetime') setSubscriptionType('lifetime');
  };

  const handleExpireNow = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setExpiryDateInput(formatInputDate(yesterday));
    setIsVip(false);
    setSubscriptionType('none');
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const userRef = doc(db, 'users', user.id);
      
      let finalExpiry: Timestamp | null = null;
      if (expiryDateInput) {
        // Set to end of chosen day
        const dateObj = new Date(expiryDateInput + 'T23:59:59');
        if (isNaN(dateObj.getTime())) {
          throw new Error('تاريخ الانتهاء غير صالح');
        }
        finalExpiry = Timestamp.fromDate(dateObj);
      }

      let finalStart: Timestamp = Timestamp.now();
      if (startDateInput) {
        const startDateObj = new Date(startDateInput + 'T00:00:00');
        if (!isNaN(startDateObj.getTime())) {
          finalStart = Timestamp.fromDate(startDateObj);
        }
      }

      const isSubActive = finalExpiry ? finalExpiry.toDate() > new Date() : false;

      const updates: any = {
        subscriptionExpiry: finalExpiry,
        subscriptionStartDate: finalStart,
        subscriptionType: isSubActive ? subscriptionType : (subscriptionType === 'lifetime' ? 'lifetime' : 'none'),
        isVIP: isSubActive ? isVip : false,
        subscriptionUpdatedAt: Timestamp.now(),
        subscriptionUpdatedBy: currentAdminEmail || 'admin'
      };

      await updateDoc(userRef, updates);

      setSuccessMsg('تم حفظ وتحديث بيانات الاشتراك بنجاح!');
      if (onUpdated) onUpdated();

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update subscription:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ الاشتراك');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">إدارة وتعديل تاريخ انتهاء الاشتراك</h3>
              <p className="text-xs text-slate-400">تحديد المدة وتاريخ البدء والانتهاء والتمديد المباشر</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* User Summary Card */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                {(user.name || user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-white flex items-center gap-2 text-sm">
                  <span>{user.name || user.displayName || 'مستخدم'}</span>
                  {user.numericId && <span className="text-[10px] font-mono text-indigo-400">ID: {user.numericId}</span>}
                </div>
                <div className="text-xs text-slate-400 font-mono" dir="ltr">{user.email || 'بدون بريد'}</div>
              </div>
            </div>

            {/* Current status pill */}
            <div className="text-left">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${currentInfo.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${currentInfo.dotClass}`} />
                <span>{currentInfo.statusLabelAr}</span>
              </span>
              <div className="text-[11px] text-slate-400 mt-1">
                {currentInfo.formattedRemaining}
              </div>
            </div>
          </div>

          {/* Quick Extend Buttons */}
          <div>
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>تمديد سريع للاشتراك</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickExtend('1day')}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/40 rounded-xl text-xs font-bold text-slate-200 transition-all text-center"
              >
                + 1 يوم
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('7days')}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/40 rounded-xl text-xs font-bold text-slate-200 transition-all text-center"
              >
                + أسبوع (7 أيام)
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('1month')}
                className="px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/60 rounded-xl text-xs font-black text-indigo-300 transition-all text-center"
              >
                + شهر (30 يوم)
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('3months')}
                className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-xs font-black text-purple-300 transition-all text-center"
              >
                + 3 أشهر
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('6months')}
                className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-indigo-500/40 rounded-xl text-xs font-bold text-slate-200 transition-all text-center"
              >
                + 6 أشهر
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('1year')}
                className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl text-xs font-black text-emerald-300 transition-all text-center"
              >
                + سنة كاملة
              </button>
              <button
                type="button"
                onClick={() => handleQuickExtend('lifetime')}
                className="px-3 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 rounded-xl text-xs font-black text-amber-300 transition-all text-center"
              >
                👑 دائم (Lifetime)
              </button>
              <button
                type="button"
                onClick={handleExpireNow}
                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300 transition-all text-center"
              >
                ⛔ إنهاء الاشتراك
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>تاريخ بداية الاشتراك</span>
              </label>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>تاريخ انتهاء الاشتراك *</span>
              </label>
              <input
                type="date"
                value={expiryDateInput}
                onChange={(e) => setExpiryDateInput(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Subscription Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">نوع الاشتراك</label>
              <select
                value={subscriptionType}
                onChange={(e) => setSubscriptionType(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="none">بدون اشتراك (عادي)</option>
                <option value="day">يومي (24 ساعة)</option>
                <option value="week">أسبوعي (7 أيام)</option>
                <option value="month">شهري (30 يوماً)</option>
                <option value="3months">3 أشهر (ربع سنوي)</option>
                <option value="year">سنوي (سنة كاملة)</option>
                <option value="lifetime">دائم (مدى الحياة 👑)</option>
                <option value="custom">مخصص</option>
              </select>
            </div>

            {/* VIP Status Checkbox */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-white/10 rounded-xl cursor-pointer hover:bg-slate-900 transition-all w-full mt-5">
                <input
                  type="checkbox"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
                <div className="flex items-center gap-2">
                  <Crown className={`w-4 h-4 ${isVip ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold text-white">تفعيل ميزات VIP الملكية</span>
                </div>
              </label>
            </div>
          </div>

          {/* Real-time Preview Banner */}
          <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-slate-400 mb-1">المعاينة بعد الحفظ:</div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-300">الحالة الناتجة:</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${previewInfo.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${previewInfo.dotClass}`} />
                <span>{previewInfo.statusLabelAr}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-300">تاريخ الانتهاء:</span>
              <span className="text-amber-300 font-mono font-bold">{previewInfo.expiryDateFormatted}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-300">المدة المتبقية:</span>
              <span className="text-white font-bold">{previewInfo.formattedRemaining}</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ والتحديث...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات وتحديث الاشتراك</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
