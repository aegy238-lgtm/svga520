import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  Search, 
  ShieldAlert, 
  Save, 
  Clock, 
  User, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Edit3, 
  RotateCcw, 
  Server, 
  Check, 
  Filter,
  Layers,
  Sparkles,
  FlaskConical
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserRecord, AccountVersionHistory, AppSettings } from '../../types';
import { 
  CURRENT_APP_VERSION, 
  DEFAULT_ALLOWED_VERSION, 
  COMMON_VERSION_PRESETS,
  BUILD_NUMBER,
  BUILD_ID,
  BUILD_TIMESTAMP,
  getActiveClientVersion,
  setSimulatedClientVersion 
} from '../../utils/versionControl';

interface AccountVersionsTabProps {
  currentAdminEmail?: string;
  currentAdminId?: string;
}

export const AccountVersionsTab: React.FC<AccountVersionsTabProps> = ({
  currentAdminEmail = 'Admin',
  currentAdminId = 'admin'
}) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // System Default Version Setting
  const [defaultVersion, setDefaultVersion] = useState<string>(DEFAULT_ALLOWED_VERSION);
  const [savingDefaultVersion, setSavingDefaultVersion] = useState(false);
  const [defaultVersionSaved, setDefaultVersionSaved] = useState(false);

  // Selected User for Version Modification Modal
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('v3.0.0');
  const [customVersion, setCustomVersion] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');
  const [updatingUserVersion, setUpdatingUserVersion] = useState(false);
  const [versionUpdateSuccess, setVersionUpdateSuccess] = useState(false);

  // Version History Modal
  const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);
  const [versionHistoryList, setVersionHistoryList] = useState<AccountVersionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Testing & Simulation Mode State
  const [simulatedVersion, setSimulatedVersion] = useState<string>(getActiveClientVersion());
  const [simulationActive, setSimulationActive] = useState<boolean>(getActiveClientVersion() !== CURRENT_APP_VERSION);

  // Fetch users and global settings
  const fetchUsersAndSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Global Default Version
      const settingsRef = doc(db, 'settings', 'global');
      const settingsDoc = await getDoc(settingsRef);
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as AppSettings;
        if (data.defaultAllowedVersion) {
          setDefaultVersion(data.defaultAllowedVersion);
        }
      }

      // 2. Fetch Users
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const fetchedUsers: UserRecord[] = [];
      snapshot.forEach(docSnap => {
        const u = { id: docSnap.id, ...docSnap.data() } as UserRecord;
        fetchedUsers.push(u);
      });

      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users for version control:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSettings();
  }, []);

  // Save Default Allowed Version for New Accounts
  const handleSaveDefaultVersion = async () => {
    setSavingDefaultVersion(true);
    try {
      const settingsRef = doc(db, 'settings', 'global');
      await setDoc(settingsRef, {
        defaultAllowedVersion: defaultVersion.trim() || DEFAULT_ALLOWED_VERSION
      }, { merge: true });

      setDefaultVersionSaved(true);
      setTimeout(() => setDefaultVersionSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save default version setting:", error);
      alert("حدث خطأ أثناء حفظ الإصدار الافتراضي");
    } finally {
      setSavingDefaultVersion(false);
    }
  };

  // Open Modal to Edit User Version
  const handleOpenEditModal = (user: UserRecord) => {
    setEditingUser(user);
    const currentAllowed = user.allowedVersion || defaultVersion || DEFAULT_ALLOWED_VERSION;
    if (COMMON_VERSION_PRESETS.includes(currentAllowed)) {
      setSelectedVersion(currentAllowed);
      setCustomVersion('');
    } else {
      setSelectedVersion('custom');
      setCustomVersion(currentAllowed);
    }
    setChangeReason('');
    setVersionUpdateSuccess(false);
  };

  // Save Modified User Version
  const handleSaveUserVersion = async () => {
    if (!editingUser) return;

    const versionToApply = selectedVersion === 'custom' 
      ? customVersion.trim() 
      : selectedVersion;

    if (!versionToApply) {
      alert("يرجى إدخال أو اختيار إصدار صحيح");
      return;
    }

    setUpdatingUserVersion(true);
    try {
      const oldVersion = editingUser.allowedVersion || defaultVersion || DEFAULT_ALLOWED_VERSION;
      const userDocRef = doc(db, 'users', editingUser.id);
      const timestampNow = Timestamp.now();

      // Update User Document
      await updateDoc(userDocRef, {
        allowedVersion: versionToApply,
        versionLastUpdated: timestampNow,
        versionUpdatedBy: currentAdminEmail
      });

      // Add Record to Version History Subcollection
      const historyRef = collection(db, 'users', editingUser.id, 'versionHistory');
      await addDoc(historyRef, {
        userId: editingUser.id,
        userEmail: editingUser.email || '',
        oldVersion,
        newVersion: versionToApply,
        updatedBy: currentAdminEmail,
        reason: changeReason.trim() || 'تحديث من لوحة التحكم',
        timestamp: timestampNow
      });

      // Update Local State
      setUsers(prev => prev.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            allowedVersion: versionToApply,
            versionLastUpdated: timestampNow,
            versionUpdatedBy: currentAdminEmail
          };
        }
        return u;
      }));

      setVersionUpdateSuccess(true);
      setTimeout(() => {
        setEditingUser(null);
        setVersionUpdateSuccess(false);
      }, 1200);

    } catch (error) {
      console.error("Failed to update user version:", error);
      alert("حدث خطأ أثناء تحديث إصدار الحساب");
    } finally {
      setUpdatingUserVersion(false);
    }
  };

  // Fetch Version History for a specific User
  const handleViewHistory = async (user: UserRecord) => {
    setHistoryUser(user);
    setLoadingHistory(true);
    try {
      const historyRef = collection(db, 'users', user.id, 'versionHistory');
      const q = query(historyRef, orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      const historyItems: AccountVersionHistory[] = [];
      snapshot.forEach(d => {
        historyItems.push({ id: d.id, ...d.data() } as AccountVersionHistory);
      });

      setVersionHistoryList(historyItems);
    } catch (error) {
      console.error("Error loading version history:", error);
      setVersionHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Simulation Mode Toggle
  const handleToggleSimulation = (version: string) => {
    if (version === CURRENT_APP_VERSION) {
      setSimulatedClientVersion(null);
      setSimulatedVersion(CURRENT_APP_VERSION);
      setSimulationActive(false);
    } else {
      setSimulatedClientVersion(version);
      setSimulatedVersion(version);
      setSimulationActive(true);
    }
    window.location.reload();
  };

  // Filter Users by Search Term (Email or User ID)
  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.id && u.id.toLowerCase().includes(term)) ||
      (u.name && u.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 dir-rtl text-right">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/80 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-emerald-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                إدارة إصدارات الحسابات
                <span className="text-xs font-mono bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 dir-ltr">
                  Server-Enforced
                </span>
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                ربط كل حساب بإصدار محدد وحظر استخدام النسخ القديمة أو غير المسموحة تلقائيًا من السيرفر.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              <Server className="w-4 h-4 text-emerald-400" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">إصدار الموقع (Version):</span>
                <span className="font-mono text-emerald-400 font-bold dir-ltr">{CURRENT_APP_VERSION}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div className="text-xs">
                <span className="text-slate-400 block text-[10px]">رقم البناء (Build ID):</span>
                <span className="font-mono text-cyan-300 font-bold text-[11px] dir-ltr">{BUILD_NUMBER}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Controls: Default Settings & Admin Simulation Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Default Allowed Version for New Accounts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Layers className="w-4 h-4" />
              <span>الإصدار الافتراضي للحسابات الجديدة</span>
            </div>
            <span className="text-[11px] text-slate-500">Auto-assigned on Signup</span>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            عند إنشاء أي حساب جديد، يتم ربطه تلقائياً بهذا الإصدار الافتراضي لإجبار المستخدم على استخدامه.
          </p>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={defaultVersion}
                onChange={(e) => setDefaultVersion(e.target.value)}
                placeholder="مثال: v3.0.0"
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-4 py-2.5 text-sm font-mono text-white text-left dir-ltr outline-none transition-colors"
              />
            </div>
            <button
              onClick={handleSaveDefaultVersion}
              disabled={savingDefaultVersion}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {savingDefaultVersion ? (
                <span>جاري الحفظ...</span>
              ) : defaultVersionSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                  تم الحفظ!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  حفظ الإعداد
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Admin Version Tester & Simulator */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <FlaskConical className="w-4 h-4" />
              <span>أداة المحاكاة واختبار حظر الإصدار القديم</span>
            </div>
            {simulationActive && (
              <span className="bg-red-500/20 text-red-300 text-[10px] px-2 py-0.5 rounded border border-red-500/30 animate-pulse dir-ltr font-mono">
                Simulation Active: {simulatedVersion}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            اختبر كيف يرى المستخدم الشاشة عندما يدخل من نسخة قديمة (مثل v2.4.0) للتحقق من عمل الحظر:
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {['v3.0.0', 'v2.5.0', 'v2.4.0', 'v1.8.0'].map(v => (
              <button
                key={v}
                onClick={() => handleToggleSimulation(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border dir-ltr ${
                  simulatedVersion === v
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {v} {v === CURRENT_APP_VERSION ? '(الأصلي)' : ''}
              </button>
            ))}

            {simulationActive && (
              <button
                onClick={() => handleToggleSimulation(CURRENT_APP_VERSION)}
                className="px-3 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors mr-auto"
              >
                <RotateCcw className="w-3 h-3" />
                إلغاء المحاكاة
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Main Table Section: Users Search and Version List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="البحث برقم المعرف User ID أو البريد الإلكتروني..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white text-xs pr-10 pl-4 py-2.5 rounded-xl outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>إجمالي الحسابات:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg">
              {filteredUsers.length}
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">الحساب / البريد الإلكتروني</th>
                <th className="py-3.5 px-4">User ID</th>
                <th className="py-3.5 px-4 text-center">الإصدار المسموح</th>
                <th className="py-3.5 px-4 text-center">الإصدار الأخير المتصل</th>
                <th className="py-3.5 px-4 text-center">حالة الحساب</th>
                <th className="py-3.5 px-4">آخر تعديل للإصدار</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    جاري تحميل حسابات المستخدمين وإعدادات الإصدارات...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    لا توجد حسابات تطابق خيارات البحث الحالية.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const allowedVer = user.allowedVersion || defaultVersion || DEFAULT_ALLOWED_VERSION;
                  const lastUsedVer = user.lastUsedVersion || 'v3.0.0';
                  const isVersionMatch = lastUsedVer.toLowerCase() === allowedVer.toLowerCase();

                  return (
                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Email & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs uppercase shrink-0">
                            {user.email ? user.email[0] : 'U'}
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.name || 'مستخدم'}</p>
                            <p className="text-[11px] text-slate-400 font-mono dir-ltr text-right">{user.email || 'لا يوجد بريد'}</p>
                          </div>
                        </div>
                      </td>

                      {/* User ID */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] text-slate-300 bg-slate-950 px-2 py-1 rounded border border-slate-800 dir-ltr inline-block">
                          {user.id}
                        </span>
                      </td>

                      {/* Allowed Version */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 dir-ltr inline-block">
                          {allowedVer}
                        </span>
                      </td>

                      {/* Last Connected Version */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-bold px-2.5 py-1 rounded-lg border dir-ltr inline-block ${
                          isVersionMatch 
                            ? 'text-slate-300 bg-slate-950 border-slate-800'
                            : 'text-red-400 bg-red-500/10 border-red-500/30'
                        }`}>
                          {lastUsedVer}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          user.status === 'banned'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {user.status === 'banned' ? 'محظور' : 'نشط'}
                        </span>
                      </td>

                      {/* Last Modified Info */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {user.versionLastUpdated ? (
                          <div>
                            <p className="text-slate-300">{user.versionUpdatedBy || 'المشرف'}</p>
                            <p className="text-[10px] text-slate-500">
                              {user.versionLastUpdated.toDate 
                                ? user.versionLastUpdated.toDate().toLocaleDateString('ar-SA')
                                : 'مؤخراً'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-600">الإصدار الافتراضي</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            تغيير الإصدار
                          </button>

                          <button
                            onClick={() => handleViewHistory(user)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            title="عرض سجل تغييرات الإصدار"
                          >
                            <History className="w-4 h-4" />
                          </button>
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

      {/* MODAL 1: Edit User Version */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-400" />
              تحديد الإصدار المسموح للحساب
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              سيتم إجبار هذا الحساب على استخدام الإصدار المحدد فقط وحظر أي إصدار آخر من السيرفر.
            </p>

            {/* Account Metadata Preview */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>البريد الإلكتروني:</span>
                <span className="text-slate-200 font-mono">{editingUser.email || 'غير مسجل'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>معرف الحساب User ID:</span>
                <span className="text-slate-200 font-mono dir-ltr">{editingUser.id}</span>
              </div>
            </div>

            {/* Version Selection */}
            <div className="space-y-3 mb-4">
              <label className="block text-xs font-semibold text-slate-300">
                اختر الإصدار المسموح:
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {COMMON_VERSION_PRESETS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVersion(v)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all dir-ltr ${
                      selectedVersion === v
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Custom Version Input option */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVersion('custom')}
                  className={`w-full py-1.5 text-xs text-slate-400 hover:text-white text-center underline ${
                    selectedVersion === 'custom' ? 'font-bold text-indigo-400' : ''
                  }`}
                >
                  أو إدخال إصدار مخصص يدوياً
                </button>

                {selectedVersion === 'custom' && (
                  <input
                    type="text"
                    value={customVersion}
                    onChange={(e) => setCustomVersion(e.target.value)}
                    placeholder="مثال: v3.1.0-beta"
                    className="w-full mt-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl font-mono dir-ltr text-left outline-none"
                  />
                )}
              </div>
            </div>

            {/* Change Reason Input */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                سبب التغيير (اختياري - للسجل):
              </label>
              <input
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="مثال: ترقية الحساب، حظر نسخ تجريبية قديمة..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveUserVersion}
                disabled={updatingUserVersion}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {updatingUserVersion ? (
                  <span>جاري الحفظ والربط...</span>
                ) : versionUpdateSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    تم الربط بنجاح!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ وتطبيق التغيير فوراً
                  </>
                )}
              </button>

              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Version History */}
      {historyUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl text-right">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  سجل تغييرات الإصدار للحساب
                </h3>
              </div>
              <button
                onClick={() => setHistoryUser(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                إغلاق ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              الحساب: <span className="text-slate-200 font-mono dir-ltr">{historyUser.email || historyUser.id}</span>
            </p>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {loadingHistory ? (
                <p className="text-center text-xs text-slate-500 py-8">جاري تحميل سجل التغييرات...</p>
              ) : versionHistoryList.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">لا يوجد سجل تغييرات سابق لهذا الحساب.</p>
              ) : (
                versionHistoryList.map((item) => (
                  <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400 line-through">{item.oldVersion}</span>
                        <span className="text-slate-500">←</span>
                        <span className="text-emerald-400 font-bold">{item.newVersion}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {item.timestamp && item.timestamp.toDate ? item.timestamp.toDate().toLocaleString('ar-SA') : 'مؤخراً'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                      <span>المشرف: <strong className="text-slate-300">{item.updatedBy}</strong></span>
                      {item.reason && <span className="text-slate-400 italic">السبب: {item.reason}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
