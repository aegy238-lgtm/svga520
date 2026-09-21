import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Product, PromoCode } from '../../data/mockData';
import { Tag, Plus, Trash2, Edit2, Percent, CheckCircle, XCircle, Search, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminPromotions() {
  const { products, promoCodes, addPromoCode, updatePromoCode, deletePromoCode, updateProduct } = useStore();
  const [isAddingCode, setIsAddingCode] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [promoSearch, setPromoSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const [codeForm, setCodeForm] = useState<Omit<PromoCode, 'id' | 'usageCount'>>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    isActive: true,
    targetProductId: ''
  });

  const handleToggleOffer = async (product: Product) => {
    await updateProduct(product.id, { isOffer: !product.isOffer });
  };

  const handleUpdateDiscount = async (product: Product, percentage: string) => {
    const val = parseInt(percentage) || 0;
    await updateProduct(product.id, { discountPercentage: val });
  };

  const handleSaveCode = async () => {
    if (!codeForm.code || codeForm.discountValue <= 0) return;
    
    if (editingCodeId) {
      await updatePromoCode(editingCodeId, codeForm);
      setEditingCodeId(null);
    } else {
      await addPromoCode(codeForm);
      setIsAddingCode(false);
    }
    
    setCodeForm({
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      isActive: true,
      targetProductId: ''
    });
  };

  const handleEditCode = (code: PromoCode) => {
    const { id, usageCount, ...rest } = code;
    setCodeForm(rest);
    setEditingCodeId(id);
    setIsAddingCode(true);
  };

  const filteredCodes = promoCodes.filter(c => c.code.toLowerCase().includes(promoSearch.toLowerCase()));
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-12 pb-20">
      {/* Offers Management */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-display font-black text-slate-900 flex items-center gap-3">
              <Percent className="text-indigo-600" />
              Manage Product Offers (عروض المنتجات)
            </h2>
            <p className="text-slate-500 text-sm mt-1">Set special discounts and offer labels on products.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm w-full sm:w-64 shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex gap-4 mb-4">
                <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-xl border border-slate-100" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
                  <p className="text-xs text-slate-500">{product.category}</p>
                  <p className="text-sm font-black text-indigo-600 mt-1">{product.price} EGP</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-semibold text-slate-700">Display as Offer?</span>
                  <button 
                    onClick={() => handleToggleOffer(product)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${product.isOffer ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${product.isOffer ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Discount %</p>
                    <input 
                      type="number"
                      value={product.discountPercentage || 0}
                      onChange={e => handleUpdateDiscount(product, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Final Price</p>
                    <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-black border border-emerald-100">
                      {(product.price * (1 - (product.discountPercentage || 0) / 100)).toFixed(0)} EGP
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Promo Codes Management */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-display font-black text-slate-900 flex items-center gap-3">
              <Gift className="text-indigo-600" />
              Promo & Invitations (أكواد الخصم والدعوة)
            </h2>
            <p className="text-slate-500 text-sm mt-1">Create codes that users can use for special discounts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search codes..." 
                value={promoSearch}
                onChange={e => setPromoSearch(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm w-full sm:w-48 shadow-sm"
              />
            </div>
            <button 
              onClick={() => {
                setEditingCodeId(null);
                setCodeForm({ code: '', discountType: 'percentage', discountValue: 0, isActive: true, targetProductId: '' });
                setIsAddingCode(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" /> New Code
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {isAddingCode && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Gift className="w-32 h-32 text-indigo-600" />
                </div>
                
                <h3 className="font-bold text-indigo-900 mb-4">{editingCodeId ? 'Edit Code' : 'Create New Code'}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Promo Code</label>
                    <input 
                      type="text"
                      placeholder="e.g. WELCOME10"
                      value={codeForm.code}
                      onChange={e => setCodeForm({...codeForm, code: e.target.value.toUpperCase()})}
                      className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-black uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Type</label>
                      <select 
                        value={codeForm.discountType}
                        onChange={e => setCodeForm({...codeForm, discountType: e.target.value as any})}
                        className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="percentage">Percentage %</option>
                        <option value="fixed">Fixed EGP</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Value</label>
                      <input 
                        type="number"
                        value={codeForm.discountValue}
                        onChange={e => setCodeForm({...codeForm, discountValue: parseInt(e.target.value) || 0})}
                        className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-indigo-400 uppercase mb-1 block">Specific Product (Optional)</label>
                    <select 
                      value={codeForm.targetProductId}
                      onChange={e => setCodeForm({...codeForm, targetProductId: e.target.value})}
                      className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Apply to all products</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={handleSaveCode}
                      className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200"
                    >
                      {editingCodeId ? 'Update' : 'Generate'}
                    </button>
                    <button 
                      onClick={() => setIsAddingCode(false)}
                      className="bg-white text-slate-500 border border-indigo-100 px-4 rounded-xl font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filteredCodes.map(promo => (
            <div key={promo.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Gift className="w-5 h-5" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEditCode(promo)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePromoCode(promo.id)} className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-wider select-all">{promo.code}</h3>
                  <button 
                    onClick={() => updatePromoCode(promo.id, { isActive: !promo.isActive })}
                    className={`p-1 rounded ${promo.isActive ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {promo.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md uppercase">
                    {promo.discountType === 'percentage' ? `${promo.discountValue}% Off` : `${promo.discountValue} EGP Off`}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Used {promo.usageCount} times
                  </span>
                </div>
              </div>

              {promo.targetProductId && (
                <div className="mt-auto p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                  <Tag className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-500 truncate italic">
                    Works on: {products.find(p => p.id === promo.targetProductId)?.name || 'Unknown Item'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
