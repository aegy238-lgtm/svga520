import React, { useState, useEffect } from 'react';
import { 
  Zap, Crown, Users, Check, X, Shield, Plus, Edit2, Trash2, 
  Calendar, Clock, DollarSign, Search, Filter, AlertTriangle, 
  Sparkles, CheckCircle2, RefreshCw, Upload, Image as ImageIcon,
  Layers, HardDrive, Download, Gauge, Settings, FileText, ChevronRight
} from 'lucide-react';
import { UserRecord, ProPlan, ProFeature, ProSettings, ProOrder, ProMembershipLog } from '../../types';
import { 
  DEFAULT_PRO_PLANS, 
  DEFAULT_PRO_FEATURES, 
  DEFAULT_PRO_SETTINGS,
  fetchProSettings,
  saveProSettings,
  fetchProPlans,
  saveProPlan,
  deleteProPlan,
  fetchProFeatures,
  saveProFeatures,
  grantProMembership,
  cancelProMembership,
  fetchProLogs,
  fetchProOrders,
  approveProOrder,
  getProStatus,
  isProActive
} from '../../utils/proMembership';

interface ProMembershipTabProps {
  users: UserRecord[];
  currentUser: UserRecord | null;
  onRefreshUsers?: () => void;
}

export const ProMembershipTab: React.FC<ProMembershipTabProps> = ({
  users,
  currentUser,
  onRefreshUsers
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'plans' | 'features' | 'orders' | 'logs' | 'settings'>('members');
  const [settings, setSettings] = useState<ProSettings>(DEFAULT_PRO_SETTINGS);
  const [plans, setPlans] = useState<ProPlan[]>(DEFAULT_PRO_PLANS);
  const [features, setFeatures] = useState<ProFeature[]>(DEFAULT_PRO_FEATURES);
  const [orders, setOrders] = useState<ProOrder[]>([]);
  const [logs, setLogs] = useState<ProMembershipLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Search & Filter for Members
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'active' | 'expired'>('all');

  // Grant PRO Modal State
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [selectedUserForGrant, setSelectedUserForGrant] = useState<UserRecord | null>(null);
  const [grantPlanId, setGrantPlanId] = useState<string>('pro_basic');
  const [grantDurationDays, setGrantDurationDays] = useState<number>(30);
  const [customDaysInput, setCustomDaysInput] = useState<string>('');
  const [grantSelectedFeatures, setGrantSelectedFeatures] = useState<string[]>([]);
  const [grantCustomColor, setGrantCustomColor] = useState<string>('#8b5cf6');

  // Plan Edit Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProPlan | null>(null);

  // Load all initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p, f, o, l] = await Promise.all([
        fetchProSettings(),
        fetchProPlans(),
        fetchProFeatures(),
        fetchProOrders(),
        fetchProLogs()
      ]);
      setSettings(s);
      setPlans(p);
      setFeatures(f);
      setOrders(o);
      setLogs(l);
    } catch (err) {
      console.warn('Error loading pro admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  // Filtered members
  const proMembers = users.filter(u => {
    const isPro = isProActive(u);
    const hasHistory = u.isPRO || u.proPlanId || u.proStatus === 'expired';
    if (memberFilter === 'active' && !isPro) return false;
    if (memberFilter === 'expired' && isPro) return false;
    if (memberFilter === 'all' && !hasHistory && !isPro) return false;

    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase();
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchPlan = (u.proPlanName || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchPlan;
    }
    return true;
  });

  const activeProCount = users.filter(u => isProActive(u)).length;

  // Handle Open Grant Modal
  const handleOpenGrantModal = (user?: UserRecord) => {
    const defaultUser = user || users[0] || null;
    setSelectedUserForGrant(defaultUser);
    const firstPlan = plans[0] || DEFAULT_PRO_PLANS[0];
    setGrantPlanId(firstPlan.id);
    setGrantDurationDays(firstPlan.durationDays);
    setGrantSelectedFeatures(firstPlan.features);
    setGrantCustomColor(firstPlan.badgeColor || '#8b5cf6');
    setCustomDaysInput('');
    setIsGrantModalOpen(true);
  };

  // Handle Submit Grant
  const handleGrantProSubmit = async () => {
    if (!selectedUserForGrant) return;
    const plan = plans.find(p => p.id === grantPlanId) || plans[0] || DEFAULT_PRO_PLANS[0];
    const finalDays = customDaysInput ? parseInt(customDaysInput) || 30 : grantDurationDays;

    try {
      await grantProMembership({
        userId: selectedUserForGrant.id,
        plan,
        durationDays: finalDays,
        adminUser: currentUser,
        customFeatures: grantSelectedFeatures,
        customBadgeColor: grantCustomColor
      });
      triggerToast(`تم تفعيل عضوية ${plan.nameAr || plan.name} للمستخدم ${selectedUserForGrant.name} بنجاح! ⚡`);
      setIsGrantModalOpen(false);
      if (onRefreshUsers) onRefreshUsers();
      loadData();
    } catch (err: any) {
      alert('خطأ في منح العضوية: ' + (err.message || String(err)));
    }
  };

  // Handle Cancel Member
  const handleCancelMember = async (userId: string, userName: string) => {
    if (!confirm(`هل أنت متأكد من إلغاء عضوية PRO للمستخدم "${userName}"؟`)) return;
    try {
      await cancelProMembership(userId, currentUser, 'إلغاء يدوي من لوحة الإدارة');
      triggerToast(`تم إلغاء عضوية PRO للمستخدم ${userName}`);
      if (onRefreshUsers) onRefreshUsers();
      loadData();
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  // Handle Toggle Global Setting
  const handleToggleGlobalPro = async () => {
    const nextState = !settings.isEnabled;
    const updated = { ...settings, isEnabled: nextState };
    setSettings(updated);
    await saveProSettings({ isEnabled: nextState });
    triggerToast(nextState ? 'تم تفعيل نظام عضوية PRO في الموقع بالكامل ⚡' : 'تم تعطيل نظام عضوية PRO مؤقتاً');
  };

  // Handle Toggle Feature Global
  const handleToggleFeature = async (featId: string) => {
    const updated = features.map(f => f.id === featId ? { ...f, enabled: !f.enabled } : f);
    setFeatures(updated);
    await saveProFeatures(updated);
    triggerToast('تم تحديث حالة الميزة بنجاح');
  };

  // Handle Save Plan
  const handleSavePlanSubmit = async () => {
    if (!editingPlan) return;
    await saveProPlan(editingPlan);
    triggerToast(`تم حفظ باقة ${editingPlan.nameAr} بنجاح!`);
    setIsPlanModalOpen(false);
    setEditingPlan(null);
    loadData();
  };

  // Handle Delete Plan
  const handleDeletePlan = async (planId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    await deleteProPlan(planId);
    triggerToast('تم حذف الباقة بنجاح');
    loadData();
  };

  // Handle Order Approve
  const handleApproveOrder = async (orderId: string) => {
    try {
      await approveProOrder(orderId, currentUser);
      triggerToast('تم اعتماد الطلب وتفعيل العضوية للمستخدم فوراً! ⚡');
      if (onRefreshUsers) onRefreshUsers();
      loadData();
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-purple-400/40 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-300" />
          <span className="text-sm font-black">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 border border-purple-400/40 shrink-0">
              <Zap className="w-8 h-8 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white">إدارة نظام عضوية PRO الاحترافية</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                  settings.isEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {settings.isEnabled ? 'النظام مفعّل نشط ⚡' : 'النظام متوقف'}
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1">
                نظام عضويات مستقل بالكامل، تحكم شامل في الباقات والأسعار والصلاحيات وصورة البروفايل والشارات.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleToggleGlobalPro}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 border cursor-pointer ${
                settings.isEnabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{settings.isEnabled ? 'تعطيل النظام مؤقتاً' : 'تفعيل النظام الآن'}</span>
            </button>

            <button
              onClick={() => handleOpenGrantModal()}
              className="px-5 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>منح عضوية PRO لمستخدم ⚡</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5">
            <span className="text-xs text-slate-400 block font-bold">الأعضاء النشطين</span>
            <span className="text-2xl font-black text-purple-400 mt-1 block">{activeProCount}</span>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5">
            <span className="text-xs text-slate-400 block font-bold">عدد الباقات المتاحة</span>
            <span className="text-2xl font-black text-indigo-400 mt-1 block">{plans.length}</span>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5">
            <span className="text-xs text-slate-400 block font-bold">الميزات المفعلة</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{features.filter(f => f.enabled).length}</span>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5">
            <span className="text-xs text-slate-400 block font-bold">طلبات الاشتراك المعلقة</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{orders.filter(o => o.status === 'pending').length}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/10">
        {[
          { id: 'members', label: `أعضاء PRO (${activeProCount})`, icon: Users },
          { id: 'plans', label: `إدارة الباقات والأسعار (${plans.length})`, icon: DollarSign },
          { id: 'features', label: `نظام المميزات والصلاحيات (${features.length})`, icon: Shield },
          { id: 'orders', label: `طلبات الاشتراك (${orders.length})`, icon: CheckCircle2 },
          { id: 'logs', label: 'سجل العمليات الإدارية', icon: FileText },
          { id: 'settings', label: 'إعدادات وسياسات PRO', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 border border-purple-400/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------- 1. MEMBERS TAB ---------------- */}
      {activeSubTab === 'members' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-white/10 p-3.5 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث بالاسم، البريد، أو الباقة..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMemberFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  memberFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setMemberFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  memberFilter === 'active' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                النشطين فقط ({activeProCount})
              </button>
              <button
                onClick={() => setMemberFilter('expired')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  memberFilter === 'expired' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                المنتهيين
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/10">
                  <tr>
                    <th className="p-3.5">المستخدم</th>
                    <th className="p-3.5">الباقة</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">الأيام المتبقية</th>
                    <th className="p-3.5">تاريخ الانتهاء</th>
                    <th className="p-3.5 text-center">إجراءات الإدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {proMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                        لا يوجد أعضاء يطابقون البحث حالياً
                      </td>
                    </tr>
                  ) : (
                    proMembers.map(user => {
                      const status = getProStatus(user);
                      return (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-purple-500/30 shrink-0">
                                {user.photoURL ? (
                                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-purple-600/20 text-purple-300 flex items-center justify-center font-bold">
                                    {(user.name || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-black text-white flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {status.isActive && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm flex items-center gap-0.5">
                                      <Zap size={9} /> PRO
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono" dir="ltr">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-bold text-purple-300">
                            {status.planName}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                              status.isActive 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}>
                              {status.isActive ? 'نشط ⚡' : 'منتهي'}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold">
                            {status.isActive ? `${status.daysRemaining} يوم` : '—'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">
                            {status.formattedExpiry}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenGrantModal(user)}
                                className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold transition-all cursor-pointer"
                                title="تمديد أو ترقية العضوية"
                              >
                                تمديد / تعديل
                              </button>
                              {status.isActive && (
                                <button
                                  onClick={() => handleCancelMember(user.id, user.name)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition-all cursor-pointer"
                                  title="إلغاء عضوية PRO"
                                >
                                  إلغاء
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
      )}

      {/* ---------------- 2. PLANS TAB ---------------- */}
      {activeSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 border border-white/10 p-4 rounded-2xl">
            <div>
              <h3 className="text-base font-black text-white">باقات عضوية PRO المتاحة</h3>
              <p className="text-xs text-slate-400">حدد الأسعار والمدد والمميزات لكل باقة بشكل مستقل</p>
            </div>
            <button
              onClick={() => {
                setEditingPlan({
                  id: `pro_plan_${Date.now()}`,
                  name: 'PRO Custom Plan',
                  nameAr: 'باقة مخصصة جديدة',
                  description: 'New custom PRO tier',
                  descriptionAr: 'باقة مخصصة مع مميزات محددة',
                  price: 20,
                  currency: '$',
                  durationDays: 180,
                  durationLabel: '6 أشهر',
                  features: ['avatar_upload', 'pro_badge', 'pro_avatar_frame'],
                  badgeColor: '#06b6d4',
                  isPopular: false,
                  isActive: true,
                  order: plans.length + 1
                });
                setIsPlanModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة باقة جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map(plan => (
              <div 
                key={plan.id}
                className="relative bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between overflow-hidden group hover:border-purple-500/40 transition-all"
              >
                {plan.isPopular && (
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-md">
                    الأكثر طلباً 🔥
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-black text-white shadow-sm"
                      style={{ backgroundColor: plan.badgeColor || '#8b5cf6' }}
                    >
                      {plan.nameAr}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">{plan.durationLabel}</span>
                  </div>

                  <div className="flex items-baseline gap-1 my-3">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    <span className="text-sm font-bold text-slate-400">{plan.currency}</span>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">{plan.descriptionAr}</p>

                  <div className="space-y-2 border-t border-white/10 pt-4 mb-6">
                    <span className="text-[11px] font-bold text-slate-400 block mb-2">المميزات المضمنة:</span>
                    {plan.features.map(fId => {
                      const f = features.find(item => item.id === fId);
                      return (
                        <div key={fId} className="flex items-center gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{f?.nameAr || fId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  <button
                    onClick={() => {
                      setEditingPlan(plan);
                      setIsPlanModalOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                    title="حذف الباقة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 3. FEATURES TAB ---------------- */}
      {activeSubTab === 'features' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl">
            <h3 className="text-base font-black text-white">نظام تحديد مميزات عضوية PRO</h3>
            <p className="text-xs text-slate-400 mt-1">
              تحكم ديناميكي في كل ميزة على حدة. إيقاف أي ميزة هنا يعطلها فوراً لجميع المشتركين دون الحاجة لأي تعديل برمجي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map(f => (
              <div 
                key={f.id}
                className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4 shadow-lg hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    f.enabled 
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20' 
                      : 'bg-slate-800 text-slate-500 border-white/5'
                  }`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">{f.nameAr}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.descriptionAr}</p>
                    <span className="inline-block mt-2 font-mono text-[10px] text-purple-400/80 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/20">
                      ID: {f.id}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleFeature(f.id)}
                    className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer border ${
                      f.enabled ? 'bg-purple-600 border-purple-400' : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      f.enabled ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                  <span className={`text-[10px] font-bold ${f.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {f.enabled ? 'مفعلة' : 'معطلة'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 4. ORDERS TAB ---------------- */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl">
            <h3 className="text-base font-black text-white">طلبات الاشتراك والمدفوعات</h3>
            <p className="text-xs text-slate-400">متابعة واعتماد طلبات الاشتراك وشراء عضوية PRO</p>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-white/10">
                  <tr>
                    <th className="p-3.5">رقم الطلب</th>
                    <th className="p-3.5">المستخدم</th>
                    <th className="p-3.5">الباقة</th>
                    <th className="p-3.5">المبلغ</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                        لا توجد طلبات شراء مسجلة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    orders.map(order => (
                      <tr key={order.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-mono text-purple-400">#{order.id.substring(0, 8)}</td>
                        <td className="p-3.5 font-bold text-white">{order.userName}</td>
                        <td className="p-3.5 font-bold text-slate-200">{order.planName}</td>
                        <td className="p-3.5 font-black text-emerald-400">{order.price} {order.currency}</td>
                        <td className="p-3.5 font-bold text-slate-400">
                          {order.paymentMethod === 'coins' ? 'رصيد العملات' : order.paymentMethod === 'whatsapp' ? 'واتساب / تحويل' : 'يدوي'}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            order.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : order.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            {order.status === 'completed' ? 'معتمد ومفعّل' : order.status === 'pending' ? 'قيد المراجعة' : 'ملغي'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {order.status === 'pending' ? (
                            <button
                              onClick={() => handleApproveOrder(order.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm transition-all cursor-pointer"
                            >
                              اعتماد وتفعيل فوراً ⚡
                            </button>
                          ) : (
                            <span className="text-slate-500 font-bold text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 5. LOGS TAB ---------------- */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-white/10 p-4 rounded-2xl">
            <h3 className="text-base font-black text-white">سجل العمليات الإدارية</h3>
            <p className="text-xs text-slate-400">تسجيل كامل لكافة عمليات منح وتمديد وإلغاء وتغيير عضويات PRO</p>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-white/5">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">لا توجد عمليات مسجلة</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="p-4 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{log.details}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          المستخدم: <span className="text-purple-300">{log.userName}</span> • بواسطة: <span className="text-slate-300">{log.adminName || 'المدير'}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {log.timestamp ? new Date(log.timestamp.seconds ? log.timestamp.seconds * 1000 : log.timestamp).toLocaleString('ar-EG') : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. SETTINGS TAB ---------------- */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-slate-900/60 border border-white/10 p-6 rounded-3xl space-y-5">
            <h3 className="text-base font-black text-white border-b border-white/10 pb-3">إعدادات وسياسات عضوية PRO</h3>

            {/* Avatar Policy */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                سياسة صورة البروفايل عند انتهاء العضوية:
              </label>
              <select
                value={settings.avatarPolicyOnExpire}
                onChange={async e => {
                  const val = e.target.value as any;
                  setSettings(prev => ({ ...prev, avatarPolicyOnExpire: val }));
                  await saveProSettings({ avatarPolicyOnExpire: val });
                  triggerToast('تم تحديث سياسة انتهاء الصلاحية للصور');
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="freeze_changes">تجميد التعديل مع الاحتفاظ بالصورة الحالية (مستحسن)</option>
                <option value="keep">الاحتفاظ بالصورة بشكل دائم دون قيود</option>
                <option value="reset_to_default">إعادة الصورة إلى الصورة الافتراضية فور انتهاء العضوية</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                تحدد ماذا يحدث لصورة البروفايل الشخصية التي رفعها العضو عند انتهاء فترة اشتراكه.
              </p>
            </div>

            {/* Max Avatar File Size */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                الحد الأقصى لحجم صورة البروفايل المسموح برفعها:
              </label>
              <select
                value={settings.maxAvatarSizeBytes}
                onChange={async e => {
                  const val = parseInt(e.target.value);
                  setSettings(prev => ({ ...prev, maxAvatarSizeBytes: val }));
                  await saveProSettings({ maxAvatarSizeBytes: val });
                  triggerToast('تم تحديث الحد الأقصى لحجم الملفات');
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value={1 * 1024 * 1024}>1 ميجابايت (1MB)</option>
                <option value={2 * 1024 * 1024}>2 ميجابايت (2MB)</option>
                <option value={5 * 1024 * 1024}>5 ميجابايت (5MB - مستحسن)</option>
                <option value={10 * 1024 * 1024}>10 ميجابايت (10MB)</option>
              </select>
            </div>

            {/* WhatsApp Contact */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-2">
                رقم الواتساب لاستقبال طلبات الاشتراك اليدوية:
              </label>
              <input
                type="text"
                value={settings.whatsappContact || ''}
                onChange={e => setSettings(prev => ({ ...prev, whatsappContact: e.target.value }))}
                onBlur={async () => {
                  await saveProSettings({ whatsappContact: settings.whatsappContact });
                  triggerToast('تم حفظ رقم الواتساب');
                }}
                placeholder="+201000000000"
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- GRANT PRO MODAL ---------------- */}
      {isGrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1329] border border-purple-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">منح وتفعيل عضوية PRO يدويًا</h3>
                  <p className="text-xs text-slate-400">اختر المستخدم والباقة والمدة المحددة</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGrantModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Select User */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">اختر المستخدم المستهدف:</label>
                <select
                  value={selectedUserForGrant?.id || ''}
                  onChange={e => {
                    const u = users.find(item => item.id === e.target.value) || null;
                    setSelectedUserForGrant(u);
                  }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email || 'بدون بريد'}) {isProActive(u) ? '⚡ PRO حالي' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Plan */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">اختر الباقة:</label>
                <div className="grid grid-cols-3 gap-2">
                  {plans.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setGrantPlanId(p.id);
                        setGrantDurationDays(p.durationDays);
                        setGrantSelectedFeatures(p.features);
                        setGrantCustomColor(p.badgeColor);
                        setCustomDaysInput('');
                      }}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        grantPlanId === p.id 
                          ? 'bg-purple-600/30 border-purple-500 text-white font-black shadow-md' 
                          : 'bg-slate-950/60 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs font-black">{p.nameAr}</span>
                      <span className="block text-[10px] text-purple-300 mt-0.5">{p.price} {p.currency}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Options */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">مدة العضوية:</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'أسبوع (7 أيام)', days: 7 },
                    { label: 'شهر (30 يوم)', days: 30 },
                    { label: '3 أشهر (90 يوم)', days: 90 },
                    { label: 'سنة (365 يوم)', days: 365 },
                  ].map(d => (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => {
                        setGrantDurationDays(d.days);
                        setCustomDaysInput('');
                      }}
                      className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        grantDurationDays === d.days && !customDaysInput
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-950 border-white/10 text-slate-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="أو أدخل عدد الأيام المخصصة..."
                  value={customDaysInput}
                  onChange={e => setCustomDaysInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Badge Color Selection */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">لون شارة PRO للمستخدم:</label>
                <div className="flex items-center gap-2">
                  {['#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#10b981', '#ef4444'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setGrantCustomColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        grantCustomColor === color ? 'scale-125 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={grantCustomColor}
                    onChange={e => setGrantCustomColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>

              {/* Feature checkboxes */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">المميزات الممنوحة في هذه العضوية:</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-white/10">
                  {features.map(f => {
                    const checked = grantSelectedFeatures.includes(f.id);
                    return (
                      <label 
                        key={f.id}
                        className="flex items-center gap-2 p-1.5 rounded text-xs text-slate-300 hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setGrantSelectedFeatures(prev => prev.filter(id => id !== f.id));
                            } else {
                              setGrantSelectedFeatures(prev => [...prev, f.id]);
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-0"
                        />
                        <span className="truncate">{f.nameAr}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsGrantModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleGrantProSubmit}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 hover:scale-105 transition-all cursor-pointer"
              >
                تأكيد ومنح العضوية فوراً ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PLAN EDIT MODAL ---------------- */}
      {isPlanModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1329] border border-purple-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60">
              <h3 className="text-base font-black text-white">تعديل باقة PRO</h3>
              <button onClick={() => setIsPlanModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">اسم الباقة (عربي):</label>
                <input
                  type="text"
                  value={editingPlan.nameAr}
                  onChange={e => setEditingPlan({ ...editingPlan, nameAr: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">السعر:</label>
                  <input
                    type="number"
                    value={editingPlan.price}
                    onChange={e => setEditingPlan({ ...editingPlan, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">العملة:</label>
                  <input
                    type="text"
                    value={editingPlan.currency}
                    onChange={e => setEditingPlan({ ...editingPlan, currency: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">المدة بالأيام:</label>
                  <input
                    type="number"
                    value={editingPlan.durationDays}
                    onChange={e => setEditingPlan({ ...editingPlan, durationDays: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">نص المدة للعرض:</label>
                  <input
                    type="text"
                    value={editingPlan.durationLabel}
                    onChange={e => setEditingPlan({ ...editingPlan, durationLabel: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">وصف الباقة:</label>
                <textarea
                  value={editingPlan.descriptionAr}
                  onChange={e => setEditingPlan({ ...editingPlan, descriptionAr: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingPlan.isPopular}
                  onChange={e => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                  className="rounded text-purple-600"
                />
                <span className="text-xs font-bold text-white">تمييز كـ "الباقة الأكثر طلباً 🔥"</span>
              </label>

              {/* Features included */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">المميزات المفتوحة في هذه الباقة:</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-white/10">
                  {features.map(f => {
                    const hasF = editingPlan.features.includes(f.id);
                    return (
                      <label key={f.id} className="flex items-center gap-2 p-1.5 rounded text-xs text-slate-300 hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasF}
                          onChange={() => {
                            if (hasF) {
                              setEditingPlan({ ...editingPlan, features: editingPlan.features.filter(id => id !== f.id) });
                            } else {
                              setEditingPlan({ ...editingPlan, features: [...editingPlan.features, f.id] });
                            }
                          }}
                          className="rounded text-purple-600"
                        />
                        <span className="truncate">{f.nameAr}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-end gap-3">
              <button onClick={() => setIsPlanModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-400">إلغاء</button>
              <button 
                onClick={handleSavePlanSubmit}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-lg cursor-pointer"
              >
                حفظ الباقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
