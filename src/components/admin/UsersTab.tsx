import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, Timestamp, setDoc } from 'firebase/firestore';
import { Trash2, Edit2, Coins, Image as ImageIcon, Search, Tag, Crown, Eye, EyeOff, Copy, Check, Key, Loader2, CheckCircle2, ShieldAlert, ShieldCheck, UserX, UserCheck } from 'lucide-react';

export default function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [coinsAmount, setCoinsAmount] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [idIconUrl, setIdIconUrl] = useState('');
  const [revealedPasswords, setRevealedPasswords] = useState<{ [userId: string]: boolean }>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleToggleVip = async (user: any) => {
    try {
      const newVip = !user.isVIP;
      await updateDoc(doc(db, 'users', user.id), { isVIP: newVip });
    } catch (error: any) {
      alert('خطأ في تغيير حالة VIP: ' + error.message);
    }
  };

  const handleToggleBanUser = async (user: any) => {
    if (user.role === 'admin' || user.email === 'iejehdgdig@gmail.com' || user.email === 'uhbijnokmpl098900@gmail.com') {
      return alert('لا يمكن حظر حساب المدير العام');
    }
    const newStatus = user.status === 'banned' ? 'active' : 'banned';
    if (!confirm(`هل أنت متأكد من ${newStatus === 'banned' ? 'حظر' : 'فك حظر'} هذا المستخدم (${user.email || user.name})؟`)) return;

    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      if (user.email) {
        const cleanEmail = user.email.trim().toLowerCase();
        const emailDocId = cleanEmail.replace(/\./g, '_');
        if (newStatus === 'banned') {
          await setDoc(doc(db, 'banned_emails', emailDocId), {
            email: cleanEmail,
            userId: user.id,
            bannedAt: Timestamp.now()
          });
        } else {
          await Promise.all([
            deleteDoc(doc(db, 'banned_emails', emailDocId)).catch(() => {}),
            deleteDoc(doc(db, 'banned_emails', cleanEmail)).catch(() => {})
          ]);
        }
      }
    } catch (error: any) {
      alert('خطأ في تعديل حالة الحظر: ' + error.message);
    }
  };

  const handleCopyCredentials = (email: string, pass: string, userId?: string) => {
    const text = `بيانات تسجيل الدخول:\nالبريد الإلكتروني: ${email}\nكلمة المرور: ${pass}`;
    navigator.clipboard.writeText(text);
    if (userId) {
      setCopiedPasswordId(userId);
      setTimeout(() => setCopiedPasswordId(null), 3000);
    }
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordInput(result);
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPasswordInput) return alert('الرجاء إدخال كلمة المرور');
    if (newPasswordInput.trim().length < 6) return alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    setSavingPassword(true);
    try {
      const newPass = newPasswordInput.trim();
      const oldPass = (selectedUser.plainPassword || selectedUser.password || '').trim();
      await updateDoc(doc(db, 'users', selectedUser.id), {
        password: newPass,
        plainPassword: newPass,
        oldPassword: oldPass,
        passwordUpdatedAt: Timestamp.now()
      });
      setPasswordSuccess(true);
    } catch (error: any) {
      alert('خطأ في تعيين كلمة المرور: ' + error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleUpdateCoins = async (action: 'add' | 'reset') => {
    if (!selectedUser) return;
    try {
      let newDiamonds = selectedUser.diamonds || 0;
      if (action === 'add') {
        const amount = parseInt(coinsAmount);
        if (isNaN(amount) || amount <= 0) return alert('الرجاء إدخال مبلغ صحيح');
        newDiamonds += amount;
      } else {
        newDiamonds = 0;
      }
      
      await updateDoc(doc(db, 'users', selectedUser.id), { diamonds: newDiamonds });
      alert('تم تحديث الرصيد بنجاح');
      setCoinsAmount('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateAvatar = async () => {
    if (!selectedUser || !avatarUrl) return alert('الرجاء إدخال رابط الصورة');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { photoURL: avatarUrl });
      alert('تم تحديث الصورة بنجاح');
      setAvatarUrl('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleUpdateIdIcon = async () => {
    if (!selectedUser || !idIconUrl) return alert('الرجاء إدخال رابط الأيقونة');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { idIcon: idIconUrl });
      alert('تم تحديث أيقونة الـ ID بنجاح');
      setIdIconUrl('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const [numericIdInput, setNumericIdInput] = useState('');

  const handleUpdateNumericId = async () => {
    if (!selectedUser || !numericIdInput) return alert('الرجاء إدخال الآي دي الجديد');
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { numericId: numericIdInput });
      alert('تم تحديث الآي دي بنجاح');
      setNumericIdInput('');
      setSelectedUser(null);
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (window.confirm(`هل أنت متأكد من حذف المستخدم ${user.displayName}؟`)) {
      try {
        await deleteDoc(doc(db, 'users', user.id));
        alert('تم حذف المستخدم بنجاح');
      } catch (error: any) {
        alert('خطأ: ' + error.message);
      }
    }
  };

  const handleResetDailySupport = async () => {
    if (window.confirm('هل أنت متأكد من تصفير الدعم اليومي لجميع المستخدمين؟')) {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);
        usersSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { dailySupport: 0 });
        });
        await batch.commit();
        alert('تم تصفير الدعم اليومي بنجاح');
      } catch (error: any) {
        alert('خطأ: ' + error.message);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="بحث عن مستخدم بالاسم أو البريد..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button onClick={handleResetDailySupport} className="bg-red-100 text-red-600 hover:bg-red-200 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-colors">
          تصفير الدعم اليومي
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">المستخدم</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الآي دي</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">البريد</th>
                <th className="px-4 py-3 text-sm font-bold text-indigo-600">كلمة المرور 🔑</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الحالة / الحظر</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الرصيد</th>
                <th className="px-4 py-3 text-sm font-bold text-amber-600">عضوية VIP</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">تاريخ التسجيل</th>
                <th className="px-4 py-3 text-sm font-bold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{user.displayName || user.name || 'مستخدم'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{user.numericId || '---'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.plainPassword || user.password ? (
                      <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg w-fit">
                        <span className="font-mono text-xs text-indigo-700 font-bold select-all">
                          {revealedPasswords[user.id] ? (user.plainPassword || user.password) : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealedPasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                          className="text-gray-500 hover:text-gray-900 transition-colors"
                          title={revealedPasswords[user.id] ? 'إخفاء' : 'إظهار'}
                        >
                          {revealedPasswords[user.id] ? <EyeOff size={14} className="text-amber-600" /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyCredentials(user.email || '', user.plainPassword || user.password || '', user.id)}
                          className="text-gray-500 hover:text-emerald-600 transition-colors"
                          title="نسخ"
                        >
                          {copiedPasswordId === user.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSelectedUser({ ...user, action: 'password' }); setNewPasswordInput(''); setPasswordSuccess(false); }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 font-bold"
                      >
                        <Key size={12} />
                        <span>تعيين كلمة سر</span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleBanUser(user)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm ${
                        user.status === 'banned'
                          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title={user.status === 'banned' ? 'الحساب محظور (اضغط لفك الحظر فوراً)' : 'الحساب نشط (اضغط للحظر)'}
                    >
                      {user.status === 'banned' ? (
                        <>
                          <UserX size={14} className="text-red-600" />
                          <span>محظور (فك الحظر)</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} className="text-emerald-600" />
                          <span>نشط</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-yellow-600">{user.diamonds || 0} 💎</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleVip(user)}
                      className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                        user.isVIP
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-900 border-amber-500 shadow-amber-300/50 hover:brightness-105'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300'
                      }`}
                      title={user.isVIP ? 'عضو VIP نشط (اضغط للإلغاء)' : 'حساب عادي (اضغط لتفعيل VIP)'}
                    >
                      <Crown size={14} className={user.isVIP ? 'fill-slate-900' : 'text-gray-400'} />
                      <span>{user.isVIP ? 'VIP 👑 مفعل' : 'تفعيل VIP'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate().toLocaleDateString() : new Date(user.createdAt).toLocaleDateString()) : 'غير معروف'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setSelectedUser({ ...user, action: 'password' }); setNewPasswordInput(''); setPasswordSuccess(false); }} 
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" 
                        title="تعيين / تغيير كلمة السر"
                      >
                        <Key size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'numericId' })} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg" title="تعديل الآي دي">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'coins' })} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="تعديل الرصيد">
                        <Coins size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'avatar' })} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="تغيير الصورة">
                        <ImageIcon size={18} />
                      </button>
                      <button onClick={() => setSelectedUser({ ...user, action: 'idIcon' })} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="تغيير أيقونة الـ ID">
                        <Tag size={18} />
                      </button>
                      <button onClick={() => handleDeleteUser(user)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="حذف الحساب">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center text-gray-500 py-8">لا يوجد مستخدمين</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedUser && selectedUser.action === 'numericId' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تعديل الآي دي لـ {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الآي دي الجديد</label>
                <input
                  type="text"
                  value={numericIdInput}
                  onChange={e => setNumericIdInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl font-mono"
                  placeholder="مثال: 1234567"
                />
              </div>
              <button onClick={handleUpdateNumericId} className="w-full bg-purple-600 text-white font-bold py-2 rounded-xl">
                حفظ الآي دي
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'coins' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">إدارة رصيد {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">إضافة كوينزات</label>
                <input
                  type="number"
                  value={coinsAmount}
                  onChange={e => setCoinsAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="الكمية..."
                />
                <button onClick={() => handleUpdateCoins('add')} className="w-full mt-2 bg-yellow-500 text-white font-bold py-2 rounded-xl">
                  إضافة
                </button>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <button onClick={() => handleUpdateCoins('reset')} className="w-full bg-red-100 text-red-600 font-bold py-2 rounded-xl hover:bg-red-200">
                  تصفير الرصيد
                </button>
              </div>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'avatar' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تغيير صورة {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة الجديدة</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="https://..."
                />
              </div>
              <button onClick={handleUpdateAvatar} className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl">
                حفظ الصورة
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {selectedUser && selectedUser.action === 'idIcon' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">تغيير أيقونة الـ ID لـ {selectedUser.displayName}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الأيقونة الجديدة</label>
                <input
                  type="url"
                  value={idIconUrl}
                  onChange={e => setIdIconUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="https://..."
                />
              </div>
              <button onClick={handleUpdateIdIcon} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl">
                حفظ الأيقونة
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500 py-2">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔑 Reset Password Modal in UsersTab */}
      {selectedUser && selectedUser.action === 'password' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">تعيين كلمة سر جديدة</h3>
                  <p className="text-xs text-gray-500">{selectedUser.displayName || selectedUser.name} ({selectedUser.email})</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>

            {passwordSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-2 font-bold">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <span>تم حفظ وتعيين كلمة المرور بنجاح!</span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-1 font-mono">
                  <div className="text-gray-600">البريد: {selectedUser.email}</div>
                  <div className="text-indigo-700 font-bold">كلمة المرور: {newPasswordInput}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyCredentials(selectedUser.email, newPasswordInput)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1"
                  >
                    <Copy size={14} />
                    <span>نسخ بيانات الدخول</span>
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 rounded-xl text-xs"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedUser.plainPassword && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex justify-between items-center font-mono">
                    <span>كلمة السر الحالية:</span>
                    <span className="font-bold">{selectedUser.plainPassword}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPasswordInput}
                      onChange={e => setNewPasswordInput(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl font-mono text-sm pr-10"
                      placeholder="أدخل كلمة المرور (6 أحرف على الأقل)..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-700"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateRandomPassword}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                >
                  ⚡ توليد كلمة سر عشوائية قوية
                </button>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdatePassword}
                    disabled={savingPassword || !newPasswordInput}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                    <span>حفظ وتعيين كلمة المرور</span>
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 text-gray-500 hover:bg-gray-100 font-bold py-2 rounded-xl text-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
