import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Plus, Trash2, Image as ImageIcon, Link as LinkIcon, Upload, Loader2, Save } from 'lucide-react';

export default function RoomBackgroundsTab() {
  const [backgrounds, setBackgrounds] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [defaultBgUrl, setDefaultBgUrl] = useState('');
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'room_backgrounds'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setDefaultBgUrl(doc.data().defaultRoomBackground || '');
      }
    });
    
    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  const handleSaveDefault = async () => {
    setIsSavingDefault(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        defaultRoomBackground: defaultBgUrl
      }, { merge: true });
      alert('تم حفظ الخلفية الافتراضية بنجاح');
    } catch (error: any) {
      alert('خطأ في الحفظ: ' + error.message);
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return alert('الرجاء تعبئة جميع الحقول');
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'room_backgrounds'), {
        name,
        url,
        createdAt: new Date().toISOString()
      });
      setName('');
      setUrl('');
    } catch (error: any) {
      alert('خطأ في الإضافة: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخلفية؟')) return;
    try {
      await deleteDoc(doc(db, 'room_backgrounds', id));
    } catch (error: any) {
      alert('خطأ في الحذف: ' + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `official_backgrounds/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setUrl(downloadURL);
      if (!name) setName(file.name.split('.')[0]);
    } catch (error: any) {
      alert('خطأ في الرفع: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
          <ImageIcon className="text-purple-600" size={20} />
          الخلفية الافتراضية للغرف
        </h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط الخلفية الافتراضية (تظهر في جميع الغرف تلقائياً)</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                value={defaultBgUrl}
                onChange={(e) => setDefaultBgUrl(e.target.value)}
                className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="https://example.com/default-bg.jpg"
                dir="ltr"
              />
            </div>
          </div>
          <button
            onClick={handleSaveDefault}
            disabled={isSavingDefault}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingDefault ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            حفظ
          </button>
        </div>
        {defaultBgUrl && (
          <div className="mt-4 w-full max-w-[200px] aspect-video rounded-lg overflow-hidden border border-gray-200 bg-black">
            {defaultBgUrl.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
              <video src={defaultBgUrl} className="w-full h-full object-cover" autoPlay muted loop />
            ) : (
              <img src={defaultBgUrl} className="w-full h-full object-cover" />
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
          <Plus className="text-purple-600" size={20} />
          إضافة خلفية رسمية (صورة أو فيديو)
        </h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخلفية</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="مثال: خلفية الطبيعة"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رابط الخلفية (MP4 أو صورة)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="https://example.com/media.mp4"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,video/*"
              className="hidden"
            />
            {isUploading ? (
              <>
                <Loader2 size={24} className="text-purple-600 animate-spin" />
                <span className="text-sm text-gray-600">جاري الرفع...</span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition shadow-sm"
                >
                  <Upload size={18} className="text-purple-600" />
                  رفع ملف من الجهاز
                </button>
                <span className="text-[10px] text-gray-400">يمكنك رفع صور أو فيديوهات MP4</span>
              </>
            )}
            {url && (
              <div className="mt-2 w-full max-w-[200px] aspect-video rounded-lg overflow-hidden border border-gray-200 bg-black">
                {url.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) ? (
                  <video src={url} className="w-full h-full object-cover" autoPlay muted loop />
                ) : (
                  <img src={url} className="w-full h-full object-cover" />
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'جاري الحفظ...' : 'إضافة الخلفية'}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">الخلفيات المضافة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {backgrounds.map((bg) => {
            const isVideo = bg.url?.toLowerCase().match(/\.(mp4|webm|ogg)(\?.*)?$/) != null;
            return (
              <div key={bg.id} className="relative group overflow-hidden rounded-xl border border-gray-200 bg-black aspect-video">
                {isVideo ? (
                  <video
                    src={bg.url}
                    className="w-full h-full object-cover opacity-60"
                    muted
                    loop
                    onMouseOver={(e) => e.currentTarget.play()}
                    onMouseOut={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                ) : (
                  <img src={bg.url} className="w-full h-full object-cover opacity-60" alt={bg.name} />
                )}
                <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white font-bold text-sm truncate">{bg.name}</p>
                  <button
                    onClick={() => handleDelete(bg.id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {backgrounds.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500">
              لا توجد خلفيات مضافة حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
