import React, { useState, useEffect } from 'react';
import { X, Crown, ShoppingBag, Mic, Image as ImageIcon, MessageCircle, Settings } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, addDoc, runTransaction } from 'firebase/firestore';

interface MallModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onlyVip?: boolean;
}

export default function MallModal({ isOpen, onClose, user, onlyVip = false }: MallModalProps) {
  const [mallCategory, setMallCategory] = useState(onlyVip ? 'vip' : 'mic_frame');
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [vipLevels, setVipLevels] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{show: boolean, title: string, message: string, onConfirm: () => void}>({ show: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    if (!isOpen || !user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) setUserData(doc.data());
    });

    const unsubStore = onSnapshot(collection(db, 'store_items'), (snapshot) => {
      setStoreItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubVip = onSnapshot(collection(db, 'vip_levels'), (snapshot) => {
      setVipLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubUser();
      unsubStore();
      unsubVip();
    };
  }, [isOpen, user]);

  if (!isOpen) return null;

  const userDiamonds = userData?.diamonds || 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-gray-900 w-full h-[80vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-gray-800" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingBag className="text-pink-500" />
            المتجر
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-black/50 px-3 py-1.5 rounded-full border border-white/5">
              <span className="text-yellow-400 font-bold text-sm">{userDiamonds.toLocaleString()}</span>
              <span className="text-[10px]">💎</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-full transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Categories */}
        {!onlyVip && (
          <div className="flex overflow-x-auto hide-scrollbar p-3 gap-2 bg-black/20">
            <button onClick={() => setMallCategory('vip')} className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mallCategory === 'vip' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <Crown size={16} /> VIP
            </button>
            <button onClick={() => setMallCategory('mic_frame')} className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mallCategory === 'mic_frame' ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <Mic size={16} /> إطارات المايك
            </button>
            <button onClick={() => setMallCategory('entrance')} className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mallCategory === 'entrance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <ImageIcon size={16} /> دخوليات
            </button>
            <button onClick={() => setMallCategory('chat_bubble')} className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mallCategory === 'chat_bubble' ? 'bg-pink-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <MessageCircle size={16} /> فقاعات الدردشة
            </button>
            <button onClick={() => setMallCategory('room_background')} className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${mallCategory === 'room_background' ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <ImageIcon size={16} /> خلفيات الغرف
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          {mallCategory === 'vip' ? (
            <div className="grid grid-cols-2 gap-4 pb-10">
              {vipLevels.map((level: any) => {
                const isMyVip = userData?.vipLevel === level.levelNumber;
                return (
                  <div key={level.id} className={`bg-gray-800/50 border ${isMyVip ? 'border-yellow-500' : 'border-gray-700'} rounded-2xl p-4 flex flex-col items-center relative overflow-hidden`}>
                    <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-500/10 rounded-full blur-xl"></div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3">
                      V{level.levelNumber}
                    </div>
                    <h4 className="text-white text-xs font-bold mb-1">{level.name}</h4>
                    <div className="flex items-center gap-1 mb-4">
                      <span className="text-yellow-400 font-bold text-sm">{(level.levelNumber * 5000).toLocaleString()}</span>
                      <span className="text-[8px] text-gray-400">💎</span>
                    </div>
                    
                    <button 
                      onClick={async () => {
                        if (!user) return;
                        const cost = level.levelNumber * 5000;
                        if (userDiamonds < cost) return alert('رصيدك غير كافٍ');
                        
                        setConfirmModal({
                          show: true,
                          title: 'شراء VIP',
                          message: `هل تريد شراء ${level.name} بـ ${cost.toLocaleString()} ماسة؟`,
                          onConfirm: async () => {
                            try {
                              await runTransaction(db, async (transaction) => {
                                const userRef = doc(db, 'users', user.uid);
                                const userSnap = await transaction.get(userRef);
                                if (!userSnap.exists()) return;
                                
                                const currentDiamonds = userSnap.data().diamonds || 0;
                                if (currentDiamonds < cost) throw new Error('رصيدك غير كافٍ');
                                
                                transaction.update(userRef, {
                                  diamonds: currentDiamonds - cost,
                                  vipLevel: level.levelNumber,
                                  isVIP: true,
                                  equippedMicFrame: level.frameUrl || userSnap.data().equippedMicFrame,
                                  equippedEntrance: level.entranceEffectUrl ? {
                                    imageUrl: level.entranceEffectUrl,
                                    isFullScreen: true,
                                    duration: 4
                                  } : userSnap.data().equippedEntrance
                                });
                                
                                const purchasedRef = doc(collection(db, 'users', user.uid, 'purchased_items'));
                                transaction.set(purchasedRef, {
                                  type: 'vip',
                                  name: level.name,
                                  levelNumber: level.levelNumber,
                                  frameUrl: level.frameUrl || null,
                                  entranceEffectUrl: level.entranceEffectUrl || null,
                                  purchasedAt: Date.now()
                                });
                              });
                              setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
                            } catch (error: any) {
                              alert('خطأ في الشراء: ' + error.message);
                            }
                          }
                        });
                      }}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition ${isMyVip ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-yellow-500 text-black hover:bg-yellow-600'}`}
                      disabled={isMyVip}
                    >
                      {isMyVip ? 'مفعل حالياً' : 'شراء الآن'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 pb-10">
              {storeItems.filter(item => item.type === mallCategory).map(item => (
              <div key={item.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-3 flex flex-col items-center relative">
                <div className="w-16 h-16 bg-gray-900 rounded-full mb-3 relative flex items-center justify-center overflow-hidden">
                  {item.type === 'text_color' ? (
                    <div className="w-full h-full" style={{ backgroundColor: item.imageUrl }}></div>
                  ) : (
                    <img src={item.imageUrl || undefined} alt={item.name} className={`absolute inset-0 w-full h-full object-cover z-10 pointer-events-none ${item.type === 'mic_frame' ? 'scale-125' : ''}`} />
                  )}
                  {item.type === 'mic_frame' && <img src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} className="w-full h-full rounded-full object-cover opacity-50" />}
                  {item.type === 'mic_icon' && <Mic size={20} className="text-gray-400" />}
                </div>
                <h4 className="text-white text-xs font-bold text-center mb-1">{item.name}</h4>
                <p className="text-yellow-400 text-[10px] font-bold mb-3">{item.price} 💎</p>
                <button 
                  onClick={async () => {
                    if (!user) return;
                    if (userDiamonds < item.price) return alert('رصيدك لا يكفي');
                    if (window.confirm(`هل تريد شراء ${item.name} بـ ${item.price} ماسة؟`)) {
                      try {
                        const updateData: any = { diamonds: userDiamonds - item.price };
                        if (item.type === 'mic_frame') updateData.equippedMicFrame = item.imageUrl;
                        if (item.type === 'mic_icon') updateData.equippedMicIcon = item.imageUrl;
                        if (item.type === 'entrance') updateData.equippedEntrance = {
                          imageUrl: item.imageUrl,
                          isFullScreen: item.isFullScreen,
                          audioUrl: item.audioUrl,
                          duration: item.duration
                        };
                        if (item.type === 'chat_bubble') updateData.equippedBubble = item.imageUrl;
                        if (item.type === 'text_color') updateData.equippedTextColor = item.imageUrl;
                        if (item.type === 'room_background') updateData.equippedBackground = item.imageUrl;

                        await updateDoc(doc(db, 'users', user.uid), updateData);
                        
                        // Add to purchased items
                        await addDoc(collection(db, 'users', user.uid, 'purchased_items'), {
                          ...item,
                          purchasedAt: Date.now()
                        });

                        alert('تم الشراء والتركيب بنجاح!');
                      } catch (e: any) {
                        alert('خطأ: ' + e.message);
                      }
                    }
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] py-1.5 rounded-lg font-bold hover:scale-105 transition"
                >
                  شراء وتركيب
                </button>
              </div>
            ))}
            {storeItems.filter(item => item.type === mallCategory).length === 0 && (
              <div className="col-span-3 text-center text-gray-400 py-10">لا توجد عناصر متاحة حالياً في هذا القسم</div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="absolute inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-gray-800 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-gray-400 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} })}
                className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 py-3 rounded-xl font-bold text-black bg-yellow-500 hover:bg-yellow-600 transition"
              >
                تأكيد الشراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
