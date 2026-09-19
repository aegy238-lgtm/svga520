import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import { 
  Crown, DollarSign, MessageCircle, UserCheck, ShieldCheck, 
  Search, CheckCircle2, AlertCircle, Clock, Zap, Sparkles, 
  RefreshCw, ShieldOff, Calendar, Award, Check
} from 'lucide-react';
import { UserRecord, AppSettings } from '../../types';

interface VipCenterTabProps {
  settings: AppSettings | null;
  currentUser?: UserRecord | null;
  onSettingsUpdate?: (newSettings: Partial<AppSettings>) => void;
}

export const VipCenterTab: React.FC<VipCenterTabProps> = ({
  settings,
  currentUser,
  onSettingsUpdate
}) => {
  // Price and WhatsApp settings
  const [vipPrice, setVipPrice] = useState<number>(
    (settings as any)?.costs?.vipPrice || (settings as any)?.vipSubscriptionPrice || 25
  );
  const [whatsappNumber, setWhatsappNumber] = useState<string>(
    settings?.whatsappNumber || ''
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // User management states
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<'month' | '3months' | 'year' | 'lifetime'>('month');
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vip' | 'regular'>('all');

  // Load initial settings
  useEffect(() => {
    if (settings) {
      if ((settings as any)?.costs?.vipPrice !== undefined) {
        setVipPrice((settings as any).costs.vipPrice);
      } else if ((settings as any)?.vipSubscriptionPrice !== undefined) {
        setVipPrice((settings as any).vipSubscriptionPrice);
      }
      if (settings.whatsappNumber) {
        setWhatsappNumber(settings.whatsappNumber);
      }
    }
  }, [settings]);

  // Fetch users for VIP assignment
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as UserRecord[];
      setUsers(userList);
    } catch (error) {
      console.error('Error fetching users in VIP Center:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Save VIP Price and WhatsApp
  const handleSaveVipSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess('');

    try {
      const cleanPrice = Number(vipPrice) || 0;
      const cleanWhatsapp = whatsappNumber.trim();

      const payload = {
        costs: {
          ...(settings?.costs || { svgaProcess: 0, batchCompress: 0 }),
          vipPrice: cleanPrice
        },
        vipSubscriptionPrice: cleanPrice,
        whatsappNumber: cleanWhatsapp,
        updatedAt: new Date().toISOString()
      };

      await Promise.all([
        setDoc(doc(db, 'settings', 'global'), payload, { merge: true }),
        setDoc(doc(db, 'settings', 'app_config'), payload, { merge: true })
      ]);

      if (onSettingsUpdate) {
        onSettingsUpdate(payload as any);
      }

      setSettingsSuccess(`تم حفظ سعر اشتراك VIP ($${cleanPrice}) ورقم الواتساب بنجاح!`);
      setTimeout(() => setSettingsSuccess(''), 4000);
    } catch (err: any) {
      console.error('Error saving VIP settings:', err);
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + (err.message || ''));
    } finally {
      setSavingSettings(false);
    }
  };

  // Activate VIP for a user
  const handleActivateVip = async (targetUser: UserRecord) => {
    setActionLoadingUserId(targetUser.id);
    setActionSuccessMsg('');

    try {
      let expiry = new Date();
      if (selectedDuration === 'month') {
        expiry.setMonth(expiry.getMonth() + 1);
      } else if (selectedDuration === '3months') {
        expiry.setMonth(expiry.getMonth() + 3);
      } else if (selectedDuration === 'year') {
        expiry.setFullYear(expiry.getFullYear() + 1);
      } else {
        // Lifetime: 20 years
        expiry.setFullYear(expiry.getFullYear() + 20);
      }

      const updateData = {
        isVIP: true,
        subscriptionType: selectedDuration,
        subscriptionExpiry: Timestamp.fromDate(expiry),
        hasSvgaExAccess: true,
        vipActivatedBy: currentUser?.email || 'admin',
        vipActivatedAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'users', targetUser.id), updateData);

      // Update local state
      setUsers(prev => prev.map(u => u.id === targetUser.id ? ({ ...u, ...updateData } as UserRecord) : u));

      const durationArabic = selectedDuration === 'month' ? 'شهر واحد' : selectedDuration === '3months' ? '3 أشهر' : selectedDuration === 'year' ? 'سنة كاملة' : 'دائم مدى الحياة';
      setActionSuccessMsg(`تم تفعيل اشتراك VIP الملكي بنجاح للمستخدم: ${targetUser.name || targetUser.email} (المدة: ${durationArabic})`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Error activating VIP:', err);
      alert('حدث خطأ أثناء تفعيل VIP: ' + (err.message || ''));
    } finally {
      setActionLoadingUserId(null);
    }
  };

  // Revoke VIP for a user
  const handleRevokeVip = async (targetUser: UserRecord) => {
    if (!confirm(`هل أنت متأكد من إلغاء اشتراك VIP للمستخدم (${targetUser.name || targetUser.email})؟`)) {
      return;
    }

    setActionLoadingUserId(targetUser.id);
    setActionSuccessMsg('');

    try {
      const updateData = {
        isVIP: false,
        subscriptionType: null,
        subscriptionExpiry: null,
        vipRevokedAt: Timestamp.now()
      };

      await updateDoc(doc(db, 'users', targetUser.id), updateData);

      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, ...updateData } : u));

      setActionSuccessMsg(`تم إلغاء اشتراك VIP للمستخدم: ${targetUser.name || targetUser.email}`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error revoking VIP:', err);
      alert('حدث خطأ أثناء إلغاء VIP: ' + (err.message || ''));
    } finally {
      setActionLoadingUserId(null);
    }
  };

  // Filtered users list
  const filteredUsers = users.filter(user => {
    // Filter by tab
    if (activeFilter === 'vip' && !user.isVIP) return false;
    if (activeFilter === 'regular' && user.isVIP) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (user.name || user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const id = (user.id || '').toLowerCase();
    const numericId = String(user.numericId || '');

    return name.includes(q) || email.includes(q) || id.includes(q) || numericId.includes(q);
  });

  const totalVips = users.filter(u => u.isVIP).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto" dir="rtl">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-purple-900/30 border border-amber-400/40 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/40 border border-amber-200 shrink-0">
              <Crown className="w-9 h-9 text-black drop-shadow-sm animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>إدارة ترقية واشتراكات VIP الملكية</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
                رفع مركز VIP • VIP Center
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                حدد قيمة اشتراك VIP بالدولار، رقم الواتساب للشراء، وفَعِّل عضوية VIP فورياً لأي مستخدم بنقرة واحدة.
              </p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
            <div className="text-center px-3 border-l border-white/10">
              <div className="text-xl font-black text-amber-400 font-mono">{totalVips}</div>
              <div className="text-[10px] text-slate-400 font-bold">مشتركي VIP</div>
            </div>
            <div className="text-center px-3 border-l border-white/10">
              <div className="text-xl font-black text-white font-mono">{users.length}</div>
              <div className="text-[10px] text-slate-400 font-bold">إجمالي المستخدمين</div>
            </div>
            <div className="text-center px-3">
              <div className="text-xl font-black text-emerald-400 font-mono">${vipPrice}</div>
              <div className="text-[10px] text-slate-400 font-bold">سعر VIP الحالي</div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. VIP Subscription Price & WhatsApp Settings Card */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-6">
          <DollarSign className="w-6 h-6 text-amber-400" />
          <div>
            <h3 className="text-lg font-bold text-white">إعدادات سعر اشتراك VIP والتواصل عبر واتساب</h3>
            <p className="text-xs text-slate-400">هذه القيمة تظهر للمستخدمين عند النقر على شراء VIP في الداشبورد</p>
          </div>
        </div>

        {settingsSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{settingsSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveVipSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VIP Price in Dollars */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">
                قيمة اشتراك VIP بالدولار ($ USD) <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(Number(e.target.value))}
                  placeholder="مثال: 25"
                  className="w-full bg-slate-950/70 border border-amber-500/30 focus:border-amber-400 rounded-2xl p-4 pr-12 text-white font-mono text-xl font-black outline-none transition-all shadow-inner"
                  required
                />
                <div className="absolute top-1/2 right-4 -translate-y-1/2 text-amber-400 font-black text-lg">
                  $
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-slate-400 font-bold">خيارات سريعة:</span>
                {[10, 15, 20, 25, 30, 50, 99].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setVipPrice(amt)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold font-mono transition-all ${
                      vipPrice === amt
                        ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30 font-black'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Number for Purchases */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">
                رقم واتساب المبيعات والدعم الفني (مع كود الدولة) <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="مثال: 201001234567"
                  dir="ltr"
                  className="w-full bg-slate-950/70 border border-white/10 focus:border-emerald-400 rounded-2xl p-4 pl-12 text-white font-mono text-base outline-none transition-all text-left shadow-inner"
                  required
                />
                <div className="absolute top-1/2 left-4 -translate-y-1/2 text-emerald-400">
                  <MessageCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                عندما يضغط المستخدم على "شراء VIP" في الداشبورد، سيفتح له هذا الواتساب مع رسالة تلقائية تتضمن بيانات حسابه والقيمة بالدولار.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Crown className="w-4 h-4" />
              <span>{savingSettings ? 'جاري حفظ الإعدادات...' : 'حفظ سعر VIP ورقم الواتساب'}</span>
            </button>

            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`تجربة محادثة شراء اشتراك VIP ($${vipPrice})`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-2 transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>اختبار فتح محادثة الشراء عبر واتساب</span>
              </a>
            )}
          </div>
        </form>
      </div>

      {/* 2. Direct User VIP Activation and Management */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-white">تفعيل وترقية VIP لأي مستخدم فورياً</h3>
              <p className="text-xs text-slate-400">ابحث عن أي مستخدم بالاسم أو الإيميل أو المعرف وفعِّل له VIP فوراً بنقرة واحدة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all"
              title="تحديث قائمة المستخدمين"
            >
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-bold flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Filter and Duration Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الإيميل، أو المعرف الرقمي..."
              className="w-full bg-slate-950/70 border border-white/10 focus:border-amber-400 rounded-2xl p-3.5 pr-11 text-white text-sm outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 right-4 -translate-y-1/2" />
          </div>

          {/* Duration Selector for Next Activation */}
          <div className="flex items-center gap-2 bg-slate-950/70 border border-white/10 p-1.5 rounded-2xl">
            <span className="text-xs text-slate-400 font-bold px-2 whitespace-nowrap">مدة التفعيل:</span>
            {[
              { id: 'month', label: 'شهر' },
              { id: '3months', label: '3 أشهر' },
              { id: 'year', label: 'سنة' },
              { id: 'lifetime', label: 'دائم مدى الحياة 👑' }
            ].map((dur) => (
              <button
                key={dur.id}
                type="button"
                onClick={() => setSelectedDuration(dur.id as any)}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                  selectedDuration === dur.id
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black font-black shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {dur.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Tabs (All / VIP Only / Regular Only) */}
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: `جميع المستخدمين (${users.length})` },
            { id: 'vip', label: `أعضاء VIP فقط (${totalVips})` },
            { id: 'regular', label: `حسابات عادية (${users.length - totalVips})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeFilter === tab.id
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
          <table className="w-full text-right border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/5 font-bold">
                <th className="p-3.5">المستخدم</th>
                <th className="p-3.5">حالة VIP</th>
                <th className="p-3.5">نوع الاشتراك</th>
                <th className="p-3.5">تاريخ الانتهاء</th>
                <th className="p-3.5 text-center">إجراءات التفعيل / الإلغاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>جاري تحميل قائمة المستخدمين...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-bold">
                    لا توجد نتائج مطابقة لبحثك
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isUserVip = !!(u.isVIP || u.subscriptionType);
                  const isActionLoading = actionLoadingUserId === u.id;
                  
                  let expiryDateStr = '—';
                  if (u.subscriptionExpiry) {
                    try {
                      const d = (u.subscriptionExpiry as any).toDate ? (u.subscriptionExpiry as any).toDate() : new Date(u.subscriptionExpiry);
                      expiryDateStr = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
                    } catch {
                      expiryDateStr = 'نشط';
                    }
                  }

                  return (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      {/* User Info */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                            isUserVip 
                              ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' 
                              : 'bg-white/10 text-slate-300'
                          }`}>
                            {isUserVip ? <Crown className="w-5 h-5 text-black" /> : (u.name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white flex items-center gap-2 truncate">
                              <span>{u.name || u.displayName || 'بدون اسم'}</span>
                              {isUserVip && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                                  VIP 👑
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate" dir="ltr">{u.email || 'N/A'}</div>
                            {u.numericId && (
                              <div className="text-[10px] text-indigo-400 font-mono">ID: {u.numericId}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* VIP Status */}
                      <td className="p-3.5">
                        {isUserVip ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-black border border-amber-400/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span>مفعل نشط</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-medium border border-white/5">
                            غير مفعل
                          </span>
                        )}
                      </td>

                      {/* Subscription Type */}
                      <td className="p-3.5">
                        {isUserVip ? (
                          <span className="font-bold text-amber-200">
                            {(u.subscriptionType as string) === 'month' ? 'شهري' : (u.subscriptionType as string) === '3months' ? '3 أشهر' : (u.subscriptionType as string) === 'year' ? 'سنوي' : (u.subscriptionType as string) === 'lifetime' ? 'دائم (Lifetime)' : 'مفعل'}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="p-3.5 text-slate-300 font-mono text-xs">
                        {expiryDateStr}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isUserVip ? (
                            <>
                              {/* Quick Re-activate / Extend */}
                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleActivateVip(u)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                                title={`تمديد اشتراك VIP (${selectedDuration})`}
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                                <span>تمديد VIP</span>
                              </button>

                              {/* Revoke VIP */}
                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleRevokeVip(u)}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                                title="إلغاء اشتراك VIP لهذا المستخدم"
                              >
                                <ShieldOff className="w-3.5 h-3.5" />
                                <span>إلغاء VIP</span>
                              </button>
                            </>
                          ) : (
                            /* Direct 1-Click Activate VIP */
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleActivateVip(u)}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-black text-xs font-black shadow-md shadow-amber-400/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title={`تفعيل اشتراك VIP فوراً لمدة (${selectedDuration})`}
                            >
                              <Crown className="w-3.5 h-3.5" />
                              <span>{isActionLoading ? 'جاري التفعيل...' : `تفعيل VIP فوري (${selectedDuration === 'month' ? 'شهر' : selectedDuration === '3months' ? '3 أشهر' : selectedDuration === 'year' ? 'سنة' : 'دائم'})`}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
