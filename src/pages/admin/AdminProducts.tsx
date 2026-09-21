import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Product, ProductType } from '../../data/mockData';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';

export default function AdminProducts() {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    type: 'License Key',
    category: '',
    imageUrl: '',
    stock: 0,
    features: []
  });

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleEdit = (product: Product) => {
    setFormData(product);
    setIsEditing(product.id);
  };

  const handleSave = () => {
    if (isEditing === 'new') {
      addProduct({ ...formData, id: `prod-${Date.now()}` } as Product);
    } else if (isEditing) {
      updateProduct(isEditing, formData);
    }
    setIsEditing(null);
  };

  const handleAddDuration = () => {
    setFormData(prev => ({
      ...prev,
      durationOptions: [
        ...(prev.durationOptions || []),
        { id: `dur-${Date.now()}`, label: 'New Option', price: prev.price || 0 }
      ]
    }));
  };

  const handleUpdateDuration = (index: number, field: 'label' | 'price', value: string | number) => {
    setFormData(prev => {
      const newDurations = [...(prev.durationOptions || [])];
      newDurations[index] = { ...newDurations[index], [field]: value };
      return { ...prev, durationOptions: newDurations };
    });
  };

  const handleRemoveDuration = (index: number) => {
    setFormData(prev => {
      const newDurations = [...(prev.durationOptions || [])];
      newDurations.splice(index, 1);
      return { ...prev, durationOptions: newDurations };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your store's inventory and categories.</p>
        </div>
        <button 
          onClick={() => {
            setIsEditing('new');
            setFormData({ name: '', description: '', price: 0, type: 'License Key', category: '', imageUrl: '', stock: 0, features: [] });
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Product Info</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 shrink-0">
                        <img className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200" src={product.imageUrl} alt="" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{product.name}</div>
                        <div className="text-slate-500 text-xs">{product.type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    <span className="bg-slate-100 px-2 py-1 rounded-md text-xs">{product.category}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{(product.price || 0).toLocaleString()} EGP</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        product.stock > 10 ? 'bg-emerald-100 text-emerald-700' :
                        product.stock > 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                      {product.stock} left
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProduct(product.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No products found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/90 backdrop-blur z-10">
              <h2 className="text-xl font-bold text-slate-900">{isEditing === 'new' ? 'Add New Product' : 'Edit Product'}</h2>
              <button onClick={() => setIsEditing(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Name</label>
                  <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <input type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Price (EGP)</label>
                  <input type="number" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Stock</label>
                  <input type="number" value={formData.stock || 0} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Image URL</label>
                  <p className="text-[10px] text-amber-600 font-bold uppercase animate-pulse mb-1">Recommended: 800 x 800 px (Square)</p>
                  <input type="text" value={formData.imageUrl || ''} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Type</label>
                  <select value={formData.type || ''} onChange={e => setFormData({...formData, type: e.target.value as ProductType})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="License Key">License Key</option>
                    <option value="Account">Account</option>
                    <option value="Subscription">Subscription</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">Discount Percentage (%)</label>
                  <input type="number" min="0" max="100" value={formData.discountPercentage || ''} onChange={e => setFormData({...formData, discountPercentage: e.target.value ? Number(e.target.value) : undefined})} placeholder="e.g. 10 for 10% off" className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="space-y-4 md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-slate-700">Subscription/Duration Options</label>
                    <button type="button" onClick={handleAddDuration} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Option
                    </button>
                  </div>
                  {formData.durationOptions && formData.durationOptions.length > 0 ? (
                    <div className="space-y-3">
                      {formData.durationOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-3 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <input type="text" value={opt.label} onChange={(e) => handleUpdateDuration(idx, 'label', e.target.value)} placeholder="e.g. 1 Month" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                          <div className="relative w-32">
                            <input type="number" value={opt.price} onChange={(e) => handleUpdateDuration(idx, 'price', Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm pr-10" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">EGP</span>
                          </div>
                          <button type="button" onClick={() => handleRemoveDuration(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                     <p className="text-xs text-slate-500 italic">No duration options. Base price will be used.</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2 border-t border-slate-200 pt-4">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setIsEditing(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-600/20">Save Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
