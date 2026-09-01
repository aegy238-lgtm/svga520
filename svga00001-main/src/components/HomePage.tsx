import React, { useState, useEffect } from 'react';
import { Search, Bell, Flame, Users, MapPin, Radio, Mic, X, Heart } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { registerBackHandler, unregisterBackHandler } from '../hooks/useBackButton';

export default function HomePage({ onOpenRoom }: { onOpenRoom: (id?: string) => void }) {
  const { user } = useAuth();
  const tabs = ['مشهور', 'متابع', 'سوريا', 'البث'];
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showCPModal, setShowCPModal] = useState(false);
  const [topSupporters, setTopSupporters] = useState<any[]>([]);
  const [cpList, setCpList] = useState<any[]>([]);
  const [appName, setAppName] = useState('Cocco');
  const [navIcons, setNavIcons] = useState<any>({});
  
  const [rankingBackgrounds, setRankingBackgrounds] = useState<any>({});

  // Search state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (doc) => {
      if (doc.exists()) {
        if (doc.data().appName) setAppName(doc.data().appName);
        if (doc.data().navIcons) setNavIcons(doc.data().navIcons);
        if (doc.data().rankingBackgrounds) setRankingBackgrounds(doc.data().rankingBackgrounds);
      }
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    const handleBack = () => {
      if (showRankingModal) { setShowRankingModal(false); return true; }
      if (showCPModal) { setShowCPModal(false); return true; }
      if (showSearchModal) { setShowSearchModal(false); return true; }
      return false;
    };

    registerBackHandler(handleBack);
    return () => unregisterBackHandler(handleBack);
  }, [showRankingModal, showCPModal, showSearchModal]);

  useEffect(() => {
    if (showCPModal) {
      const q = query(collection(db, 'cp_requests'), where('status', '==', 'accepted'), limit(50));
      const unsub = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setCpList(list);
      });
      return () => unsub();
    }
  }, [showCPModal]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResult(null);
    try {
      const q = query(collection(db, 'users'), where('numericId', '==', searchQuery.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setSearchResult({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
      } else {
        setSearchResult('not_found');
      }
    } catch (error) {
      console.error("Error searching:", error);
      alert("حدث خطأ أثناء البحث");
    } finally {
      setIsSearching(false);
    }
  };
  useEffect(() => {
    if (showRankingModal) {
      const q = query(collection(db, 'users'), orderBy('dailySupport', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snapshot) => {
        setTopSupporters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [showRankingModal]);

  useEffect(() => {
    const q = query(collection(db, 'rooms'), where('active', '==', true));
    const unsub = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      rooms.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setActiveRooms(rooms);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [banners.length]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-2 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">{appName}</h1>
          <div className="flex gap-3 text-gray-600">
            <button onClick={() => setShowSearchModal(true)} className="hover:text-purple-600 transition">
              <Search size={24} />
            </button>
            <Bell size={24} />
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-6 overflow-x-auto hide-scrollbar">
          {tabs.map((tab, idx) => (
            <button 
              key={tab} 
              className={`whitespace-nowrap pb-2 text-sm font-semibold border-b-2 transition-colors ${idx === 0 ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Banners */}
        {banners.length > 0 ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden shadow-md">
            {banners.map((banner, idx) => (
              <a 
                key={banner.id} 
                href={banner.linkUrl || '#'} 
                target={banner.linkUrl ? "_blank" : "_self"}
                rel="noreferrer"
                className={`absolute inset-0 transition-opacity duration-500 ${idx === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                <img src={banner.imageUrl || undefined} alt="Banner" className="w-full h-full object-cover" />
              </a>
            ))}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20">
              {banners.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentBannerIndex ? 'bg-white' : 'bg-white/50'}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            <div className="min-w-[280px] h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-4 text-white flex flex-col justify-center relative overflow-hidden shadow-md">
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <h3 className="text-lg font-bold mb-1 z-10">خدمة الداعمين</h3>
              <p className="text-xs opacity-90 z-10">احصل على مميزات حصرية الآن!</p>
              <button className="mt-3 bg-white/20 hover:bg-white/30 transition text-white text-xs py-1.5 px-4 rounded-full w-fit backdrop-blur-sm z-10">
                اكتشف المزيد
              </button>
            </div>
            <div className="min-w-[280px] h-32 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white flex flex-col justify-center relative overflow-hidden shadow-md">
              <h3 className="text-lg font-bold mb-1">Lucky Gift 🎁</h3>
              <p className="text-xs opacity-90">اربح هدايا مضاعفة في غرف البث</p>
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="flex gap-4">
          <div onClick={() => setShowRankingModal(true)} className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 overflow-hidden">
              {navIcons.homeTopSupporters ? <img src={navIcons.homeTopSupporters} alt="ثروة" className="w-full h-full object-cover" /> : <Flame size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold">ثروة</p>
              <p className="text-[10px] text-gray-400">تصنيف الداعمين</p>
            </div>
          </div>
          <div onClick={() => setShowCPModal(true)} className="flex-1 bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 overflow-hidden">
              {navIcons.homeCP ? <img src={navIcons.homeCP} alt="زوجين" className="w-full h-full object-cover" /> : <Users size={20} />}
            </div>
            <div>
              <p className="text-sm font-bold">زوجين</p>
              <p className="text-[10px] text-gray-400">أفضل الثنائيات</p>
            </div>
          </div>
        </div>

        {/* Room Grid */}
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-3">غرف نشطة الآن</h2>
          {activeRooms.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {activeRooms.map(room => (
                <div 
                  key={room.id} 
                  onClick={() => onOpenRoom(room.id)}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow relative"
                >
                  <div className="h-32 bg-gray-200 relative">
                    <img src={room.ownerAvatar || undefined} alt={room.ownerName} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-white text-[10px]">
                      <Radio size={10} className="text-green-400 animate-pulse" />
                      مباشر
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{room.ownerName}</p>
                    <p className="text-[10px] text-gray-500 truncate">غرفة دردشة</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
              <Radio size={48} className="mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">لا توجد غرف نشطة حالياً</p>
              <button onClick={() => onOpenRoom()} className="mt-4 bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2">
                <Mic size={18} />
                إنشاء غرفة عامة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ranking Modal */}
      {showRankingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="absolute inset-0" onClick={() => setShowRankingModal(false)}></div>
          <div className="bg-white rounded-t-3xl h-[80vh] flex flex-col relative z-10 overflow-hidden">
            {rankingBackgrounds.wealthRanking && (
              <div className="absolute inset-0 z-0">
                <img src={rankingBackgrounds.wealthRanking} className="w-full h-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-white"></div>
              </div>
            )}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between relative z-10 bg-white/80 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-800">تصنيف الداعمين (اليومي)</h2>
              <button onClick={() => setShowRankingModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10">
              {topSupporters.map((user, idx) => (
                <div key={user.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-600' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                    {idx + 1}
                  </div>
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{user.displayName || 'مستخدم'}</p>
                    <p className="text-xs text-gray-500">ID: {user.numericId || '---'}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-yellow-600">{user.dailySupport || 0}</p>
                    <p className="text-[10px] text-gray-400">ماسة</p>
                  </div>
                </div>
              ))}
              {topSupporters.length === 0 && (
                <div className="text-center text-gray-500 py-10">لا يوجد داعمين اليوم</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* CP List Modal */}
      {showCPModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="absolute inset-0" onClick={() => setShowCPModal(false)}></div>
          <div className="bg-white rounded-t-3xl h-[80vh] flex flex-col relative z-10 overflow-hidden">
            {rankingBackgrounds.cpRanking && (
              <div className="absolute inset-0 z-0">
                <img src={rankingBackgrounds.cpRanking} className="w-full h-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-white"></div>
              </div>
            )}
            <div className="p-4 border-b border-pink-100 flex items-center justify-between relative z-10 bg-white/80 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-gray-800">أفضل الثنائيات (CP)</h2>
              <button onClick={() => setShowCPModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
              {cpList.map((cp, idx) => (
                <div key={cp.id} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-pink-200 flex items-center justify-between relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-10 shadow-sm">
                    #{idx + 1}
                  </div>
                  
                  {/* Sender */}
                  <div className="flex flex-col items-center gap-2 z-10 w-1/3 mt-2">
                    <div className="relative">
                      <img src={cp.senderAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cp.senderId}`} className="w-16 h-16 rounded-full object-cover border-2 border-pink-300 shadow-sm" />
                      {cp.frameUrl && <img src={cp.frameUrl} className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] max-w-none object-contain pointer-events-none" />}
                    </div>
                    <p className="text-xs font-bold text-gray-800 text-center truncate w-full mt-1">{cp.senderName}</p>
                  </div>

                  {/* Heart Icon */}
                  <div className="flex flex-col items-center justify-center z-10 px-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center text-pink-500 animate-pulse shadow-inner border border-pink-200">
                      <Heart size={20} className="text-pink-500 fill-pink-500" />
                    </div>
                  </div>

                  {/* Receiver */}
                  <div className="flex flex-col items-center gap-2 z-10 w-1/3 mt-2">
                    <div className="relative">
                      <img src={cp.receiverAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cp.receiverId}`} className="w-16 h-16 rounded-full object-cover border-2 border-pink-300 shadow-sm" />
                      {cp.frameUrl && <img src={cp.frameUrl} className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] max-w-none object-contain pointer-events-none" />}
                    </div>
                    <p className="text-xs font-bold text-gray-800 text-center truncate w-full mt-1">{cp.receiverName}</p>
                  </div>

                  {/* Background if any */}
                  {cp.backgroundUrl && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-multiply">
                      <img src={cp.backgroundUrl} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
              {cpList.length === 0 && (
                <div className="text-center text-gray-500 py-10 bg-white/50 rounded-2xl backdrop-blur-sm">لا توجد ثنائيات حالياً</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <button onClick={() => setShowSearchModal(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
              <X size={20} />
            </button>
            <form onSubmit={handleSearch} className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن طريق الآي دي (ID)..."
                className="w-full bg-gray-100 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-purple-500"
                dir="auto"
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600">
                <Search size={18} />
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {isSearching ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            ) : searchResult === 'not_found' ? (
              <div className="text-center text-gray-500 py-10">
                لم يتم العثور على مستخدم بهذا الآي دي
              </div>
            ) : searchResult ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
                <div className="relative mb-4">
                  <img src={searchResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${searchResult.id}`} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                  {searchResult.equippedCpFrame && (
                    <img src={searchResult.equippedCpFrame} className="absolute -inset-4 w-[calc(100%+32px)] h-[calc(100%+32px)] max-w-none object-contain pointer-events-none" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">{searchResult.displayName || 'مستخدم'}</h3>
                <p className="text-sm text-gray-500 font-mono mb-4">ID: {searchResult.numericId}</p>
                
                <div className="flex gap-4 w-full">
                  <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-purple-600 font-bold mb-1">المستوى</p>
                    <p className="text-lg font-black text-purple-700">{searchResult.level || 1}</p>
                  </div>
                  <div className="flex-1 bg-pink-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-pink-600 font-bold mb-1">الدعم</p>
                    <p className="text-lg font-black text-pink-700">{searchResult.totalSupport || 0}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>أدخل الآي دي للبحث عن مستخدم</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
