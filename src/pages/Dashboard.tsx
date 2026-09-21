import { useStore } from '../store/useStore';
import { Package, User as UserIcon, Mail, Shield, MessageCircle, LogOut, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { user, allOrders, whatsappNumber, logout } = useStore();
  const { t } = useTranslation();
  const myOrders = allOrders.filter(o => o.userId === user?.id);

  const handleContactWhatsApp = (order: any) => {
    const text = `${t('cart.whatsappMessageIntro')}\n\n` + 
    `Order ID: #${order.id}\n` +
    `Date: ${new Date(order.date).toLocaleDateString()}\n\n` +
    order.items.map((i: any) => {
      return `- ${i.quantity}x ${i.product.name} ${i.selectedDuration ? `(${i.selectedDuration.label})` : ''}`;
    }).join('\n') +
    `\n\nTotal: ${(order.total || 0).toLocaleString()} ${t('common.currency')}\n` +
    `Status: ${order.status}`;
    
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="font-display text-3xl font-black text-slate-900 mb-10 tracking-tight">{t('dashboard.title')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
        
        {/* Profile Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-2xl font-black mb-6">
              {user.name.charAt(0)}
            </div>
            <h2 className="font-display text-xl font-black text-slate-900 mb-2">{user.name}</h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center text-slate-500 text-sm gap-3 font-medium">
                 <Mail className="w-5 h-5 text-slate-300" />
                 {user.email}
              </div>
              <div className="flex items-center text-slate-500 text-sm gap-3 font-medium">
                 <UserIcon className="w-5 h-5 text-slate-300" />
                 {t('dashboard.role')}: <span className="capitalize font-bold text-slate-700">{user.role}</span>
              </div>
              <div className="flex items-center text-slate-500 text-sm gap-3 font-medium">
                 <Shield className="w-5 h-5 text-emerald-500" />
                 {t('dashboard.activeSecured')}
              </div>
            </div>
            
            <button 
              onClick={() => logout()}
              className="mt-8 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-100 text-red-600 font-bold hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              {t('nav.signOut')}
            </button>
          </div>

          {/* Used Coupons */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
            <h3 className="font-display text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-500" />
               Used Coupons
            </h3>
            {user.usedPromoCodes && user.usedPromoCodes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.usedPromoCodes.map((codeId, idx) => {
                  const promo = useStore.getState().promoCodes.find(p => p.id === codeId);
                  const displayCode = promo?.code || (codeId.startsWith('GIFT-') ? codeId : 'PROMO');
                  return (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-500">
                      <Shield className="w-3 h-3 text-slate-400" />
                      {displayCode}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-xs font-bold bg-slate-50 p-4 rounded-xl text-center border border-slate-100 border-dashed">
                No coupons used yet
              </p>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
           <div className="bg-white rounded-[2rem] p-6 sm:p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
              <h2 className="font-display text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <Package className="w-6 h-6 text-indigo-500" />
                {t('dashboard.orderHistory')}
              </h2>
              
              {myOrders.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 border-2 border-slate-100 border-dashed rounded-[2.5rem]">
                  <Package className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">{t('dashboard.noOrders')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {myOrders.map(order => (
                    <div key={order.id} className="border border-slate-100 rounded-[2rem] overflow-hidden bg-slate-50/30">
                      <div className="bg-white p-5 sm:p-6 border-b border-slate-100 flex flex-wrap gap-4 justify-between items-center text-sm">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('dashboard.orderPlaced')}</p>
                          <p className="font-black text-slate-900">{new Date(order.date).toLocaleDateString()}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('common.total')}</p>
                          <p className="font-black text-indigo-600">{(order.total || 0).toLocaleString()} <span className="text-[10px]">{t('common.currency')}</span></p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('dashboard.orderId')}</p>
                          <p className="font-black text-slate-900">#{order.id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                              order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {order.status === 'Completed' ? t('dashboard.completed') : 
                               order.status === 'Pending' ? t('dashboard.pending') : t('dashboard.cancelled')}
                            </span>
                            <button 
                              onClick={() => handleContactWhatsApp(order)}
                              className="flex items-center justify-center w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                              title={t('common.contactWhatsApp')}
                            >
                              <MessageCircle className="w-5 h-5" />
                            </button>
                        </div>
                      </div>
                      
                      <div className="p-5 sm:p-6 space-y-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-5">
                             <div className="w-16 h-16 rounded-2xl bg-white p-2 border border-slate-100 shadow-sm flex-shrink-0">
                                <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                             </div>
                             <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 truncate">{item.product.name}</h4>
                                <p className="text-slate-400 text-xs font-bold">{t('cart.qty')}: {item.quantity} {item.selectedDuration && <span className="text-indigo-600 ml-1">({item.selectedDuration.label})</span>}</p>
                             </div>
                          </div>
                        ))}
                      </div>

                      {order.status === 'Completed' && order.keys && order.keys.length > 0 && (
                        <div className="p-5 sm:p-6 border-t border-slate-100 bg-emerald-50/50">
                          <p className="font-black text-emerald-800 text-[10px] uppercase tracking-widest mb-4">{t('dashboard.yourKeys')}</p>
                          <div className="space-y-3">
                            {order.keys.map((key, idx) => (
                              <div key={idx} className="bg-white border border-emerald-100 p-4 rounded-2xl font-mono text-sm text-emerald-700 break-all shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                <span className="font-black text-[10px] text-emerald-500 uppercase block mb-1 tracking-wider">{key.productName}</span>
                                <div className="flex items-center justify-between gap-4">
                                   <span className="font-bold">{key.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
