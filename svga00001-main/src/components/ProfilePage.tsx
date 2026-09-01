import React, { useState, useEffect } from 'react';
import { Settings, Edit, Crown, ShoppingBag, Tag, Wallet, Gamepad2, Briefcase, Award, Video, Image as ImageIcon, TrendingUp, ChevronLeft, LogOut, Check, X, Shield, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, onSnapshot, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateLevel, getProgressToNextLevel, getLevelColor } from '../lib/levels';
import { registerBackHandler, unregisterBackHandler } from '../hooks/useBackButton';
import GameCenterModal from './games/GameCenterModal';
import MallModal from './MallModal';

export default function ProfilePage({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const { user, logout, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editIdIcon, setEditIdIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [appIcons, setAppIcons] = useState<{idIcon?: string}>({});
  const [showGameCenter, setShowGameCenter] = useState(false);
  const [showAgencyPanel, setShowAgencyPanel] = useState(false);
  const [showMall, setShowMall] = useState(false);
  const [showVipCenter, setShowVipCenter] = useState(false);

  useEffect(() => {
    const handleBack = () => {
      if (showGameCenter) { setShowGameCenter(false); return true; }
      if (showAgencyPanel) { setShowAgencyPanel(false); return true; }
      if (showMall) { setShowMall(false); return true; }
      if (showVipCenter) { setShowVipCenter(false); return true; }
      if (isEditing) { setIsEditing(false); return true; }
      return false;
    };

    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [isEditing, showGameCenter, showAgencyPanel, showMall, showVipCenter]);

  useEffect(() => {
    if (user) {
      setEditName(user.displayName || '');
      setEditPhotoURL(user.photoURL || '');
      
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setEditIdIcon(data.idIcon || '');
          if (data.role === 'admin') {
            setIsAdmin(true);
          }
        }
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    const unsubAppIcons = onSnapshot(doc(db, 'settings', 'app_icons'), (doc) => {
      if (doc.exists()) setAppIcons(doc.data() as any);
    });
    return () => unsubAppIcons();
  }, []);

  const chargingLevel = calculateLevel(userData?.totalSpent || 0);
  const supportLevel = calculateLevel(userData?.totalSupport || 0);
  const chargingProgress = getProgressToNextLevel(userData?.totalSpent || 0);
  const supportProgress = getProgressToNextLevel(userData?.totalSupport || 0);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserProfile(editName, editPhotoURL);
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          idIcon: editIdIcon || null
        });
      }
      setIsEditing(false);
    } catch (error: any) {
      console.error("Failed to update profile", error);
      alert(`فشل تحديث الملف الشخصي: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(user?.displayName || '');
    setEditPhotoURL(user?.photoURL || '');
    setIsEditing(false);
  };
  
  const menuItems = [
    { icon: <Crown size={20} />, label: 'VIP', color: 'text-yellow-500', bg: 'bg-yellow-50', action: () => setShowVipCenter(true) },
    { icon: <ShoppingBag size={20} />, label: 'المول', color: 'text-pink-500', bg: 'bg-pink-50', action: () => setShowMall(true) },
    { icon: <TrendingUp size={20} />, label: 'مستوى الشحن', color: 'text-cyan-500', bg: 'bg-cyan-50', value: `Lv. ${chargingLevel}`, progress: chargingProgress },
    { icon: <Award size={20} />, label: 'مستوى الدعم', color: 'text-purple-500', bg: 'bg-purple-50', value: `Lv. ${supportLevel}`, progress: supportProgress },
    { icon: <Wallet size={20} />, label: 'المحفظة', color: 'text-orange-500', bg: 'bg-orange-50', value: `${(userData?.diamonds || 0).toLocaleString()} 💎` },
    { icon: <Gamepad2 size={20} />, label: 'ألعاب', color: 'text-blue-500', bg: 'bg-blue-50', action: () => setShowGameCenter(true) },
    ...(userData?.isAgent ? [{ icon: <Briefcase size={20} />, label: 'لوحة وكيل الشحن', color: 'text-indigo-500', bg: 'bg-indigo-50', action: () => setShowAgencyPanel(true) }] : []),
    { icon: <Video size={20} />, label: 'ابدأ البث المباشر', color: 'text-teal-500', bg: 'bg-teal-50' },
    { icon: <ImageIcon size={20} />, label: 'منشوراتي', color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white pt-8 pb-6 px-4 rounded-b-3xl shadow-sm relative">
        <div className="absolute top-4 left-4 flex gap-2 text-gray-600 z-10">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={isSaving} className="bg-green-500 text-white hover:bg-green-600 px-4 py-1.5 rounded-full transition text-sm font-bold flex items-center gap-1 shadow-sm">
                <Check size={16} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ البيانات'}
              </button>
              <button onClick={handleCancel} disabled={isSaving} className="bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded-full transition text-sm font-bold flex items-center gap-1 shadow-sm">
                <X size={16} />
                إلغاء
              </button>
            </>
          ) : (
            <>
              <button onClick={logout} className="text-red-500 hover:bg-red-50 p-1 rounded-full transition" title="تسجيل الخروج">
                <LogOut size={22} />
              </button>
              {isAdmin && (
                <button onClick={onOpenAdmin} className="text-purple-600 hover:bg-purple-50 p-1 rounded-full transition" title="لوحة التحكم">
                  <Shield size={22} />
                </button>
              )}
              <button onClick={() => setIsEditing(true)} className="hover:bg-gray-50 p-1 rounded-full transition" title="تعديل الملف الشخصي">
                <Edit size={22} />
              </button>
              <button className="hover:bg-gray-50 p-1 rounded-full transition" title="الإعدادات">
                <Settings size={22} />
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="relative w-20 h-20 flex items-center justify-center">
            {(() => {
              const src = isEditing ? (editPhotoURL || "https://picsum.photos/seed/myprofile/100/100") : (user?.photoURL || "https://picsum.photos/seed/myprofile/100/100");
              const isVideo = src.toLowerCase().includes('.mp4');
              return isVideo ? (
                <video src={src} autoPlay loop muted playsInline className="w-full h-full rounded-full object-cover border-2 border-purple-100" />
              ) : (
                <img src={src} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-purple-100" referrerPolicy="no-referrer" />
              );
            })()}
            {userData?.equippedMicFrame && !isEditing && (
              <img src={userData.equippedMicFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="Avatar Frame" />
            )}
            <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r ${getLevelColor(Math.max(chargingLevel, supportLevel)).from} ${getLevelColor(Math.max(chargingLevel, supportLevel)).to} ${getLevelColor(Math.max(chargingLevel, supportLevel)).text} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border border-white z-20`}>
              Lv. {Math.max(chargingLevel, supportLevel)}
            </div>
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="الاسم"
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <input 
                  type="text" 
                  value={editPhotoURL} 
                  onChange={(e) => setEditPhotoURL(e.target.value)} 
                  placeholder="رابط الصورة"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  dir="ltr"
                />
                <input 
                  type="text" 
                  value={editIdIcon} 
                  onChange={(e) => setEditIdIcon(e.target.value)} 
                  placeholder="رابط أيقونة الـ ID"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-purple-500 outline-none"
                  dir="ltr"
                />
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-800">{user?.displayName || 'مستخدم جديد'}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative h-6 px-3 flex items-center justify-center overflow-hidden rounded-md border border-gray-200">
                    {(userData?.idIcon || appIcons.idIcon) && (
                      <img src={userData?.idIcon || appIcons.idIcon || undefined} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="ID Background" />
                    )}
                    <span className="relative z-10 text-xs text-gray-700 font-mono font-bold">ID: {userData?.numericId || '123456789'}</span>
                  </div>
                  <button className="text-purple-600 text-[10px] bg-purple-50 px-1.5 py-0.5 rounded">نسخ</button>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    ♂ 24
                  </span>
                  <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">
                    🇸🇾 سوريا
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-around mt-8 pt-4 border-t border-gray-100">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">1.2k</span>
            <span className="text-xs text-gray-500">الزوار</span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">8.5k</span>
            <span className="text-xs text-gray-500">المتابعون</span>
          </div>
          <div className="w-px h-8 bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-gray-800">245</span>
            <span className="text-xs text-gray-500">تابعون</span>
          </div>
        </div>

        {/* CP Section */}
        {userData?.cpPartnerId && (
          <div className="mt-6">
            <div className="relative rounded-2xl overflow-hidden p-4 shadow-sm border border-pink-100 flex items-center justify-between bg-white">
              {userData.cpBackground && (
                <img src={userData.cpBackground || undefined} className="absolute inset-0 w-full h-full object-cover" style={{ imageRendering: 'high-quality' }} alt="CP Background" />
              )}
              <div className="absolute inset-0 bg-black/40"></div>
              
              <div className="relative z-10 flex items-center gap-4 w-full justify-center">
                {/* Current User */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <img src={user?.photoURL || "https://picsum.photos/seed/myprofile/100/100"} className="w-full h-full rounded-full object-cover border-2 border-white/50 shadow-sm" alt="Me" referrerPolicy="no-referrer" />
                    {userData.equippedCpFrame && (
                      <img src={userData.equippedCpFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="CP Frame" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-white mt-4 bg-black/50 px-2 py-0.5 rounded-full shadow-sm truncate max-w-[80px] text-center">{user?.displayName}</span>
                </div>

                {/* Heart Icon */}
                <div className="flex flex-col items-center justify-center animate-pulse px-2">
                  <Heart className="text-pink-500 fill-pink-500 drop-shadow-md" size={28} />
                  <span className="text-[9px] font-bold text-pink-400 mt-1 bg-black/50 px-2 py-0.5 rounded-full shadow-sm">CP</span>
                </div>

                {/* Partner */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <img src={userData.cpPartnerAvatar || "https://picsum.photos/seed/partner/100/100"} className="w-full h-full rounded-full object-cover border-2 border-white/50 shadow-sm" alt="Partner" referrerPolicy="no-referrer" />
                    {userData.equippedCpFrame && (
                      <img src={userData.equippedCpFrame || undefined} className="absolute inset-0 w-full h-full object-contain scale-[1.35] pointer-events-none z-10" alt="CP Frame" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-white mt-4 bg-black/50 px-2 py-0.5 rounded-full shadow-sm truncate max-w-[80px] text-center">{userData.cpPartnerName}</span>
                </div>
              </div>
              
              <button 
                onClick={async () => {
                  if (!confirm('هل أنت متأكد من إلغاء علاقة الـ CP؟')) return;
                  try {
                    const partnerId = userData.cpPartnerId;
                    await updateDoc(doc(db, 'users', user!.uid), {
                      cpPartnerId: null,
                      cpPartnerName: null,
                      cpPartnerAvatar: null,
                      equippedCpFrame: null,
                      cpBackground: null
                    });
                    await updateDoc(doc(db, 'users', partnerId), {
                      cpPartnerId: null,
                      cpPartnerName: null,
                      cpPartnerAvatar: null,
                      equippedCpFrame: null,
                      cpBackground: null
                    });
                    alert('تم إلغاء علاقة الـ CP بنجاح');
                  } catch (error) {
                    console.error('Error cancelling CP:', error);
                  }
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500/40 transition z-20"
                title="إلغاء CP"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Menu Grid */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {menuItems.map((item, idx) => (
            <div key={idx} onClick={item.action} className={`flex flex-col p-4 cursor-pointer hover:bg-gray-50 transition ${idx !== menuItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.bg} ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {item.value && (
                    <span className="text-xs font-bold text-gray-500">{item.value}</span>
                  )}
                  <ChevronLeft size={18} className="text-gray-400" />
                </div>
              </div>
              {item.progress !== undefined && (
                <div className="mt-3 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color.replace('text-', 'bg-')}`} style={{ width: `${item.progress}%` }}></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Game Center Modal */}
      {showGameCenter && (
        <GameCenterModal onClose={() => setShowGameCenter(false)} />
      )}

      {/* Agency Panel Modal */}
      {showAgencyPanel && userData?.isAgent && (
        <AgencyPanelModal 
          onClose={() => setShowAgencyPanel(false)} 
          agentBalance={userData.agentBalance || 0}
          agentBonus={userData.agentBonus || 0}
        />
      )}

      {/* Mall Modal */}
      <MallModal isOpen={showMall} onClose={() => setShowMall(false)} user={user} />
      <MallModal isOpen={showVipCenter} onClose={() => setShowVipCenter(false)} user={user} onlyVip={true} />
    </div>
  );
}

function AgencyPanelModal({ onClose, agentBalance, agentBonus }: { onClose: () => void, agentBalance: number, agentBonus: number }) {
  const [targetId, setTargetId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const rechargeAmount = parseInt(amount);
    
    if (!targetId || !rechargeAmount || rechargeAmount <= 0) {
      return alert('الرجاء إدخال بيانات صحيحة');
    }
    
    if (rechargeAmount > agentBalance) {
      return alert('رصيدك كوكيل لا يكفي لإتمام هذه العملية');
    }

    setIsSubmitting(true);
    try {
      // Find target user by numericId (string or number) or uid
      const usersRef = collection(db, 'users');
      let targetUserId = targetId;
      let currentDiamonds = 0;
      let currentTotalSpent = 0;
      let found = false;

      // 1. Try numericId as string
      const q1 = query(usersRef, where('numericId', '==', targetId));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        targetUserId = snap1.docs[0].id;
        currentDiamonds = snap1.docs[0].data().diamonds || 0;
        currentTotalSpent = snap1.docs[0].data().totalSpent || 0;
        found = true;
      }

      // 2. Try numericId as number
      if (!found && !isNaN(parseInt(targetId))) {
        const q2 = query(usersRef, where('numericId', '==', parseInt(targetId)));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          targetUserId = snap2.docs[0].id;
          currentDiamonds = snap2.docs[0].data().diamonds || 0;
          currentTotalSpent = snap2.docs[0].data().totalSpent || 0;
          found = true;
        }
      }

      // 3. Try direct ID (uid)
      if (!found) {
        const docRef = doc(db, 'users', targetId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          currentDiamonds = docSnap.data().diamonds || 0;
          currentTotalSpent = docSnap.data().totalSpent || 0;
          found = true;
        }
      }

      if (!found) {
        throw new Error('لم يتم العثور على المستخدم');
      }

      // Calculate bonus
      const bonusAmount = Math.floor(rechargeAmount * (agentBonus / 100));
      const totalToReceive = rechargeAmount + bonusAmount;

      // Update target user
      await updateDoc(doc(db, 'users', targetUserId), {
        diamonds: currentDiamonds + totalToReceive,
        totalSpent: currentTotalSpent + rechargeAmount
      });

      // Update agent balance
      await updateDoc(doc(db, 'users', user.uid), {
        agentBalance: agentBalance - rechargeAmount
      });

      // Send notification to target user
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        title: 'تم الشحن بنجاح',
        body: `تم إضافة ${rechargeAmount} ماسة + ${bonusAmount} مكافأة الشحن من إدارة تطبيق Key Live`,
        type: 'recharge',
        createdAt: Date.now(),
        read: false
      });

      alert(`تم شحن ${totalToReceive} ماسة بنجاح!`);
      setTargetId('');
      setAmount('');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-3xl p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-gray-800 bg-gray-100 p-2 rounded-full transition"><X size={20} /></button>
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Briefcase size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">لوحة وكيل الشحن</h2>
          <p className="text-gray-500 text-sm mt-1">قم بتحويل الألماس للمستخدمين بسهولة</p>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white mb-6 shadow-lg">
          <p className="text-indigo-100 text-sm mb-1">رصيدك الحالي</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black">{agentBalance.toLocaleString()}</span>
            <span className="text-indigo-200 mb-1">ماسة</span>
          </div>
          {agentBonus > 0 && (
            <div className="mt-2 text-xs bg-white/20 inline-block px-2 py-1 rounded-lg">
              يحصل المستخدم على بونص إضافي {agentBonus}%
            </div>
          )}
        </div>

        <form onSubmit={handleRecharge} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ID المستخدم المستلم</label>
            <input 
              type="text" 
              value={targetId} 
              onChange={e => setTargetId(e.target.value)} 
              placeholder="أدخل الـ ID هنا..."
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-lg focus:border-indigo-500 focus:ring-0 outline-none transition text-center font-mono" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كمية الألماس</label>
            <input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              placeholder="0"
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-lg focus:border-indigo-500 focus:ring-0 outline-none transition text-center font-bold text-indigo-600" 
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-600/30 mt-2 text-lg"
          >
            {isSubmitting ? 'جاري التحويل...' : 'تحويل الألماس الآن'}
          </button>
        </form>
      </div>
    </div>
  );
}
