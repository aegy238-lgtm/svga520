import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { Trash2, Plus, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

export default function BannersTab() {
  const [banners, setBanners] = useState<any[]>([]);
  const [newBanner, setNewBanner] = useState({ imageUrl: '', linkUrl: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanner.imageUrl) return alert('الرجاء إدخال رابط الصورة');
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'banners'), {
        ...newBanner,
        createdAt: Date.now()
      });
      setNewBanner({ imageUrl: '', linkUrl: '' });
      alert('تم إضافة البنر بنجاح');
    } catch (error: any) {
      alert('خطأ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا البنر؟')) {
      await deleteDoc(doc(db, 'banners', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">إضافة بنر جديد</h3>
        <form onSubmit={handleAddBanner} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط الصورة</label>
            <div className="relative">
              <ImageIcon className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="url"
                required
                value={newBanner.imageUrl}
                onChange={e => setNewBanner({...newBanner, imageUrl: e.target.value})}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://example.com/banner.jpg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رابط التوجيه (اختياري)</label>
            <div className="relative">
              <LinkIcon className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="url"
                value={newBanner.linkUrl}
                onChange={e => setNewBanner({...newBanner, linkUrl: e.target.value})}
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://example.com"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {loading ? 'جاري الإضافة...' : 'إضافة البنر'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">البنرات الحالية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map(banner => (
            <div key={banner.id} className="border border-gray-200 rounded-xl overflow-hidden relative group">
              <img src={banner.imageUrl} alt="Banner" className="w-full h-32 object-cover" />
              <div className="p-3 bg-gray-50 flex justify-between items-center">
                <a href={banner.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 truncate max-w-[200px]">
                  {banner.linkUrl || 'لا يوجد رابط'}
                </a>
                <button
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8">لا توجد بنرات حالياً</div>
          )}
        </div>
      </div>
    </div>
  );
}
