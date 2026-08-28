import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { collection, getDocs, doc, updateDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Check, Image as ImageIcon, Link as LinkIcon, Upload, Loader2, ShoppingBag, ShieldAlert } from 'lucide-react';

export default function BackgroundSelector({ roomId, onClose }: { roomId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [purchasedBackgrounds, setPurchasedBackgrounds] = useState<any[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [currentBg, setCurrentBg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if user is owner
    if (user) {
      getDoc(doc(db, 'rooms', roomId)).then(docSnap => {
        if (docSnap.exists() && docSnap.data().ownerId === user.uid) {
          setIsOwner(true);
        }
      });
    }

    // Fetch official backgrounds
    const q = query(collection(db, 'room_backgrounds'), orderBy('createdAt', 'desc'));
    const unsubBgs = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch current room background
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (doc) => {
      if (doc.exists()) {
        setCurrentBg(doc.data().backgroundUrl || null);
      }
    });

    // Fetch user's purchased backgrounds (from store_items)
    const unsubPurchased = onSnapshot(collection(db, 'users', user?.uid || 'none', 'purchased_items'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPurchasedBackgrounds(items.filter((item: any) => item.type === 'room_background'));
    });

    return () => {
      unsubBgs();
      unsubRoom();
      unsubPurchased();
    };
  }, [roomId, user?.uid]);

  const handleSelect = async (url: string) => {
    if (!isOwner) return alert('عذراً، صاحب الغرفة فقط من يمكنه تغيير الخلفية');
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        backgroundUrl: url
      });
      onClose();
    } catch (error: any) {
      alert('خطأ في تحديث الخلفية: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl) return;
    handleSelect(customUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert('يرجى اختيار ملف صورة أو فيديو مدعوم');
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `room_backgrounds/${roomId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      await handleSelect(downloadURL);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">صلاحية محدودة</h3>
        <p className="text-gray-400 text-sm">عذراً، صاحب الغرفة فقط هو من يملك صلاحية تغيير الخلفية.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6 pr-1">
        {/* Custom Upload Section */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <Upload size={16} className="text-purple-400" />
            رفع خلفية من الجهاز (صورة أو فيديو)
          </h4>
          
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/mp4"
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSaving}
              className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition group disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 size={24} className="text-purple-400 animate-spin" />
                  <span className="text-xs text-gray-400">جاري الرفع...</span>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-gray-400 group-hover:text-purple-400 transition" />
                  <span className="text-xs text-gray-400">اضغط هنا لاختيار ملف من جهازك</span>
                </>
              )}
            </button>

            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-[10px] text-gray-500 font-bold">أو استخدم رابط مباشر</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <form onSubmit={handleCustomUpload} className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="ضع رابط الصورة أو الفيديو هنا..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500"
                dir="ltr"
              />
              <button
                type="submit"
                disabled={isSaving || isUploading || !customUrl}
                className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50"
              >
                تطبيق
              </button>
            </form>
          </div>
        </div>

        {/* Purchased Backgrounds Section */}
        {purchasedBackgrounds.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
              <ShoppingBag size={16} />
              خلفياتي المشتراة
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {purchasedBackgrounds.map((bg) => {
                const bgUrl = bg.url || bg.imageUrl;
                const isVideo = bgUrl?.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) != null;
                return (
                  <div
                    key={bg.id}
                    onClick={() => handleSelect(bgUrl)}
                    className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${currentBg === bgUrl ? 'border-purple-500 scale-95' : 'border-transparent hover:border-white/20'}`}
                  >
                    {isVideo ? (
                      <video
                        src={bgUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        onMouseOver={(e) => e.currentTarget.play()}
                        onMouseOut={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                    ) : (
                      <img src={bgUrl} className="w-full h-full object-cover" alt={bg.name} />
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      {currentBg === bgUrl && (
                        <div className="bg-purple-600 p-1.5 rounded-full shadow-lg">
                          <Check size={16} className="text-white" />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[10px] text-white font-bold truncate">{bg.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Official Backgrounds Section */}
        <div>
          <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <ImageIcon size={16} className="text-blue-400" />
            الخلفيات الرسمية
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {backgrounds.map((bg) => {
              const isVideo = bg.url?.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) != null;
              return (
                <div
                  key={bg.id}
                  onClick={() => handleSelect(bg.url)}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${currentBg === bg.url ? 'border-purple-500 scale-95' : 'border-transparent hover:border-white/20'}`}
                >
                  {isVideo ? (
                    <video
                      src={bg.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : (
                    <img src={bg.url} className="w-full h-full object-cover" alt={bg.name} />
                  )}
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    {currentBg === bg.url && (
                      <div className="bg-purple-600 p-1.5 rounded-full shadow-lg">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-[10px] text-white font-bold truncate">{bg.name}</p>
                  </div>
                </div>
              );
            })}
            {backgrounds.length === 0 && (
              <div className="col-span-2 py-8 text-center text-gray-500 text-xs bg-white/5 rounded-xl border border-white/5">
                لا توجد خلفيات رسمية متاحة حالياً
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
