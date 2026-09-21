import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { CreditCard, Plus, Edit2, Trash2, X } from 'lucide-react';
import { PaymentMethod } from '../../data/mockData';

export default function AdminPaymentMethods() {
  const { paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod } = useStore();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<PaymentMethod>>({
    name: '',
    details: '',
    isActive: true,
    imageUrl: ''
  });

  const handleEdit = (method: PaymentMethod) => {
    setFormData(method);
    setIsEditing(method.id);
  };

  const handleSave = () => {
    if (isEditing === 'new') {
      addPaymentMethod(formData as PaymentMethod);
    } else if (isEditing) {
      updatePaymentMethod(isEditing, formData);
    }
    setIsEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-500" />
            Payment Methods
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage physical payment details shown during WhatsApp Checkout.</p>
        </div>
          <button 
            onClick={() => {
              setIsEditing('new');
              setFormData({ name: '', details: '', isActive: true, imageUrl: '' });
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/20"
          >
          <Plus className="w-5 h-5" />
          Add Method
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paymentMethods.map((method) => (
          <div key={method.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-3">
                  {method.imageUrl && (
                    <img src={method.imageUrl} alt={method.name} className="w-10 h-10 object-cover rounded-lg border border-slate-100" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{method.name}</h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${method.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {method.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
               </div>
               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => handleEdit(method)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                   <Edit2 className="w-4 h-4" />
                 </button>
                 <button onClick={() => deletePaymentMethod(method.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                   <Trash2 className="w-4 h-4" />
                 </button>
               </div>
            </div>
            
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 font-mono text-sm text-slate-700 break-all">
               {method.details}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-900">{isEditing === 'new' ? 'Add Payment Method' : 'Edit Method'}</h2>
              <button onClick={() => setIsEditing(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Method Name</label>
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="e.g. Vodafone Cash"
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Details (Number, Email, IBAN)</label>
                <textarea 
                  rows={3}
                  value={formData.details || ''} 
                  onChange={e => setFormData({...formData, details: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" 
                  placeholder="e.g. 01000000000"
                />
              </div>
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Image URL (Optional)</label>
                <p className="text-[10px] text-amber-600 font-bold uppercase animate-pulse">Recommended: 256 x 256 px (Square)</p>
                <input 
                  type="text" 
                  value={formData.imageUrl || ''} 
                  onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="https://example.com/image.png"
                />
              </div>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                   <p className="font-semibold text-slate-900">Active Method</p>
                   <p className="text-xs text-slate-500">Show this method at checkout</p>
                </div>
              </label>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setIsEditing(null)} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} className="px-6 py-2 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm shadow-indigo-600/20">Save Method</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
