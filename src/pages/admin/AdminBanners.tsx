import { useStore } from '../../store/useStore';
import { Image, Plus, Trash2, Edit2, X } from 'lucide-react';
import { useState } from 'react';
import { Banner } from '../../store/useStore';

export default function AdminBanners() {
  const { banners, addBanner, updateBanner, deleteBanner, toggleBannerStatus } = useStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Banner>>({
    imageUrl: '',
    linkUrl: '',
    isActive: true,
    position: 'top',
    showAsSlider: false
  });

  const handleEdit = (banner: Banner) => {
    setFormData({ 
      ...banner, 
      position: banner.position || 'top', 
      showAsSlider: !!banner.showAsSlider,
      afterProductCount: banner.afterProductCount || 0 
    });
    setIsEditing(banner.id);
  };

  const handleSave = () => {
    if (isEditing === 'new') {
      addBanner(formData as Banner);
    } else if (isEditing) {
      updateBanner(isEditing, formData);
    }
    setIsEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Image className="w-6 h-6 text-indigo-500" />
            Home Banners
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage the hero carousel banners on the homepage.</p>
        </div>
        <button 
          onClick={() => {
            setIsEditing('new');
            setFormData({ imageUrl: '', linkUrl: '', isActive: true, position: 'top', showAsSlider: false, afterProductCount: 0 });
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {banners.map(banner => (
           <div key={banner.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
             <div className="aspect-[21/9] bg-slate-100 relative">
               <img src={banner.imageUrl} alt="Banner" className="w-full h-full object-cover" />
               <div className="absolute top-4 right-4 flex flex-col gap-2">
                 <button 
                   onClick={() => toggleBannerStatus(banner.id)} 
                   className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${banner.isActive ? 'bg-emerald-500/90 text-white' : 'bg-slate-900/80 text-white'}`}
                 >
                   {banner.isActive ? 'Active' : 'Hidden'}
                 </button>
                 <span className="px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md bg-white/90 text-slate-800 self-end">
                   {banner.position === 'middle' ? (
                     (banner.afterProductCount ?? 0) > 0 
                       ? `In Grid (After ${banner.afterProductCount})` 
                       : (banner.showAsSlider ? 'Middle (Slider)' : 'Middle')
                   ) : 'Top'}
                 </span>
               </div>
               <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <button onClick={() => handleEdit(banner)} className="p-3 bg-white text-indigo-600 rounded-xl hover:scale-110 transition-transform shadow-lg">
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => deleteBanner(banner.id)} className="p-3 bg-red-600 text-white rounded-xl hover:scale-110 transition-transform shadow-lg">
                    <Trash2 className="w-5 h-5" />
                  </button>
               </div>
             </div>
             <div className="p-4 bg-white flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium truncate pr-4">Link: {banner.linkUrl || 'None'}</span>
             </div>
           </div>
        ))}
      </div>

       {/* Edit/Add Modal */}
       {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-900">{isEditing === 'new' ? 'Add Banner' : 'Edit Banner'}</h2>
              <button onClick={() => setIsEditing(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Image URL</label>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-amber-600 font-bold uppercase animate-pulse">Recommended: 1200 x 600 px (Better for Mobile)</p>
                  <p className="text-[10px] text-slate-500 font-medium">(المقاس المثالي للموبايل والكمبيوتر: 1200 × 600 بكسل)</p>
                </div>
                <input 
                  type="text" 
                  value={formData.imageUrl || ''} 
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Link URL (Optional)</label>
                <input 
                  type="text" 
                  value={formData.linkUrl || ''} 
                  onChange={e => setFormData({...formData, linkUrl: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="/store?cat=Software"
                />
              </div>
               <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Banner Position (مكان البنر)</label>
                <select 
                  value={formData.position || 'top'} 
                  onChange={e => setFormData({...formData, position: e.target.value as any})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                >
                  <option value="top">Top (Hero Slider) - أعلى الموقع</option>
                  <option value="middle">Middle (After Products) - وسط الموقع</option>
                </select>
              </div>
              
              {formData.position === 'middle' && (
                <div className="space-y-4">
                  <div className="p-4 border border-indigo-100 bg-indigo-50/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 text-xs">After Products Count (الظهور بعد عدد من المنتجات)</label>
                      <input 
                        type="number"
                        min="0"
                        value={formData.afterProductCount || 0}
                        onChange={e => setFormData({...formData, afterProductCount: parseInt(e.target.value) || 0})}
                        className="w-16 border border-indigo-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold text-slate-900"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">Enter 0 to show it in the fixed middle section below all featured products, or enter a number (e.g. 5) to inject it into the product grid after that many items.</p>
                  </div>

                  <label className="flex items-center gap-3 p-3 border border-indigo-100 bg-indigo-50/30 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={formData.showAsSlider}
                      onChange={e => setFormData({...formData, showAsSlider: e.target.checked})}
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <p className="font-semibold text-indigo-900 leading-none">Slider Mode (وضع العرض المتحرك)</p>
                      <p className="text-[10px] text-indigo-500 mt-1">If enabled, multiple middle banners will cycle automatically like the top bar.</p>
                    </div>
                  </label>
                </div>
              )}
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                   <p className="font-semibold text-slate-900">Active</p>
                   <p className="text-xs text-slate-500">Show this banner on the homepage</p>
                </div>
              </label>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setIsEditing(null)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-600/20">Save Banner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
