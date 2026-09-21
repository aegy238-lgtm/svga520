import { useStore, CartItem } from '../store/useStore';
import { ShoppingCart, Trash2, ArrowRight, CreditCard, MessageCircle, ShieldCheck, Gift, CheckCircle } from 'lucide-react';
import { PromoCode } from '../data/mockData';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function Cart() {
  const { cart, removeFromCart, placeOrder, paymentMethods, whatsappNumber, user } = useStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const { applyPromoCode, promoCodes } = useStore();
  const [promoInput, setPromoInput] = useState('');
  const [activePromo, setActivePromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState('');

  const handleApplyPromo = async () => {
    setPromoError('');
    
    // Preliminary local check
    const promo = promoCodes.find(p => p.code === promoInput && p.isActive);
    if (user?.usedPromoCodes?.includes(promo?.id || '') || user?.usedPromoCodes?.includes(promoInput)) {
       setPromoError('You have already used this coupon');
       return;
    }

    const code = await applyPromoCode(promoInput);
    if (!code) {
      // Check if it's because it was used globally or just invalid
      setPromoError('Invalid code or already used');
      setActivePromo(null);
      return;
    }
    setActivePromo(code);
  };

  const getDiscountedPrice = (item: CartItem) => {
    const basePrice = item.selectedDuration ? item.selectedDuration.price : item.product.price;
    let finalPrice = item.product.discountPercentage 
      ? basePrice * (1 - item.product.discountPercentage / 100)
      : basePrice;
    
    if (activePromo) {
      // Check if it's a global code or specific to this product
      if (!activePromo.targetProductId || activePromo.targetProductId === item.product.id) {
        if (activePromo.discountType === 'percentage') {
          finalPrice = finalPrice * (1 - activePromo.discountValue / 100);
        } else {
          finalPrice = Math.max(0, finalPrice - activePromo.discountValue);
        }
      }
    }
    return finalPrice;
  };

  const subtotal = cart.reduce((sum, item) => {
    const basePrice = item.selectedDuration ? item.selectedDuration.price : item.product.price;
    const priceWithNativeDiscount = item.product.discountPercentage 
      ? basePrice * (1 - item.product.discountPercentage / 100)
      : basePrice;
    return sum + (priceWithNativeDiscount * item.quantity);
  }, 0);

  const total = cart.reduce((sum, item) => {
    return sum + (getDiscountedPrice(item) * item.quantity);
  }, 0);

  const promoDiscount = subtotal - total;

  const activeMethods = paymentMethods.filter(m => m.isActive);

  const handleCheckout = async (method: 'Auto' | 'WhatsApp') => {
    if (!user) {
       navigate('/login');
       return;
    }

    await placeOrder(method, activePromo?.id);
    
    if (method === 'WhatsApp') {
       const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentId);
       const text = `${t('cart.whatsappMessageIntro')}\n\n` + 
       cart.map(i => {
         const basePrice = i.selectedDuration ? i.selectedDuration.price : i.product.price;
         const itemPrice = i.product.discountPercentage ? basePrice * (1 - i.product.discountPercentage / 100) : basePrice;
         return `- ${i.quantity}x ${i.product.name} ${i.selectedDuration ? `(${i.selectedDuration.label})` : ''} - ${ ((itemPrice * i.quantity) || 0).toLocaleString() } ${t('common.currency')}`;
       }).join('\n') +
       `\n\n${t('cart.whatsappMessageTotal')} ${(total || 0).toLocaleString()} ${t('common.currency')}` + 
       (selectedMethod ? `\n${t('cart.whatsappMessagePayment')} ${selectedMethod.name}` : '');
       
       const cleanNumber = whatsappNumber.replace(/\D/g, '');
       window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank');
    }
    
    navigate('/dashboard');
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
         <ShoppingCart className="w-20 h-20 text-slate-200 mx-auto mb-6" />
         <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('cart.empty')}</h2>
         <p className="text-slate-500 mb-8 max-w-md mx-auto">{t('cart.emptyDesc')}</p>
         <Link to="/store" className="inline-flex items-center justify-center px-8 py-3 font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20">
           {t('cart.continueShopping')}
         </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">{t('cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-8 space-y-4">
          {cart.map((item, idx) => (
            <div key={`${item.product.id}-${idx}`} className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm relative group pr-12">
               <img src={item.product.imageUrl} alt={item.product.name} className="w-24 h-24 rounded-xl object-cover bg-slate-100 shrink-0" />
               <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-bold text-slate-900 line-clamp-1 pr-4">{item.product.name}</h3>
                     <p className="text-sm text-slate-500 mt-1">{item.product.type}</p>
                   </div>
                 </div>
                 {item.selectedDuration && (
                   <div className="mt-2 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-fit">
                     {item.selectedDuration.label}
                   </div>
                 )}
                 <div className="flex items-center gap-4 mt-3">
                   <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                      <span className="px-3 text-sm font-semibold text-slate-700">{t('cart.qty')}: {item.quantity}</span>
                   </div>
                   <div className="font-bold text-slate-900">
                     {(() => {
                        const base = item.selectedDuration ? item.selectedDuration.price : item.product.price;
                        const finalP = item.product.discountPercentage ? base * (1 - item.product.discountPercentage / 100) : base;
                        return `${((finalP * item.quantity) || 0).toLocaleString()} ${t('common.currency')}`;
                      })()}
                   </div>
                 </div>
               </div>
               <button 
                 onClick={() => removeFromCart(item.product.id, item.selectedDuration?.id)}
                 className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                 aria-label="Remove item"
               >
                 <Trash2 className="w-5 h-5" />
               </button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-4">
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 sticky top-24">
            <h2 className="text-xl font-bold text-slate-900 mb-6">{t('cart.orderSummary')}</h2>
            
            <div className="space-y-4 mb-6 text-slate-600 border-b border-slate-200 pb-6">
              <div className="flex justify-between">
                <span>{t('cart.subtotal')} ({cart.length} {t('common.items')})</span>
                <span className="font-semibold text-slate-900">{(subtotal || 0).toLocaleString()} {t('common.currency')}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg -mx-2">
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs uppercase">
                    <Gift className="w-3.5 h-3.5" />
                    Promo Applied
                  </div>
                  <span className="font-black text-indigo-600">
                    -{(promoDiscount || 0).toLocaleString()} {t('common.currency')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t('cart.tax')}</span>
                <span className="font-semibold text-emerald-600">Free</span>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="mb-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Gift className="w-3 h-3" />
                Invitation / Promo Code
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                />
                <button 
                  onClick={handleApplyPromo}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md active:scale-95 transition-transform"
                >
                  Apply
                </button>
              </div>
              {promoError && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1">{promoError}</p>}
              {activePromo && !promoError && (
                <p className="text-[10px] text-emerald-600 font-bold mt-1 ml-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Code {activePromo.code} applied successfully!
                </p>
              )}
            </div>

            <div className="flex justify-between items-end mb-8">
              <span className="font-bold text-slate-900">{t('cart.totalDue')}</span>
              <span className="text-3xl font-bold text-indigo-600">{(total || 0).toLocaleString()} {t('common.currency')}</span>
            </div>

            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 border-t border-slate-200 pt-6">
               {!selectedPaymentId ? (
                 <>
                   <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide mb-4">{t('cart.selectPaymentMethod')}</h3>
                   <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                     {activeMethods.map((m) => (
                       <button 
                         key={m.id} 
                         onClick={() => setSelectedPaymentId(m.id)}
                         className="w-full flex items-center justify-between bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md p-4 rounded-xl shadow-sm transition-all text-left"
                       >
                         <div className="flex items-center gap-4">
                           {m.imageUrl ? (
                             <img src={m.imageUrl} alt={m.name} className="w-12 h-12 rounded-lg object-cover bg-slate-50 border border-slate-100" />
                           ) : (
                             <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
                               <CreditCard className="w-6 h-6" />
                             </div>
                           )}
                           <div>
                             <p className="font-bold text-slate-900">{m.name}</p>
                             <p className="text-xs text-slate-500">{t('cart.clickToViewDetails')}</p>
                           </div>
                         </div>
                         <ArrowRight className="w-5 h-5 text-slate-400 rtl:-scale-x-100" />
                       </button>
                     ))}
                     {activeMethods.length === 0 && (
                       <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">No payment methods listed. Please contact support via WhatsApp.</p>
                     )}
                   </div>
                 </>
               ) : (
                 <>
                   {(() => {
                      const selectedMethod = activeMethods.find(m => m.id === selectedPaymentId);
                      if (!selectedMethod) return null;
                      return (
                        <div className="bg-white border text-center border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col items-center gap-4">
                          {selectedMethod.imageUrl ? (
                            <img src={selectedMethod.imageUrl} alt={selectedMethod.name} className="w-24 h-24 rounded-2xl object-cover bg-slate-50 border border-slate-100 mb-2" />
                          ) : (
                             <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-2">
                               <CreditCard className="w-8 h-8" />
                             </div>
                          )}
                          <div>
                             <h3 className="font-bold text-lg text-slate-900">{selectedMethod.name}</h3>
                             <p className="text-sm text-slate-500">{t('cart.pleaseTransfer')} <span className="font-bold text-slate-900 text-lg">{total.toLocaleString()} {t('common.currency')}</span> {t('cart.to')}</p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 w-full rounded-xl p-4">
                             <p className="font-mono text-sm text-slate-700 break-all select-all whitespace-pre-wrap">{selectedMethod.details}</p>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
                            <p className="text-[11px] sm:text-xs text-amber-700 font-bold leading-relaxed px-1">
                              {t('cart.paymentInstructions')}
                            </p>
                          </div>

                          <p className="text-xs text-slate-500 text-center">{t('cart.afterTransferClick')}</p>
                        </div>
                      )
                   })()}
                   <button 
                    onClick={() => handleCheckout('WhatsApp')}
                    className="w-full flex items-center justify-center gap-2 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-4 rounded-xl font-bold transition-all shadow-sm shadow-emerald-500/20"
                  >
                    {t('cart.iHaveTransferred')}
                    <MessageCircle className="w-5 h-5 rtl:-scale-x-100" />
                  </button>
                  <button onClick={() => setSelectedPaymentId(null)} className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 py-2">
                    {t('cart.changePaymentMethod')}
                  </button>
                 </>
               )}
            </div>

            {!user && (
               <p className="text-xs text-center text-amber-600 mt-4 bg-amber-50 p-2 rounded-lg font-medium">
                 {t('product.mustLogin')}
               </p>
            )}
            
            <div className="mt-6 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
              <p>{t('home.securePaymentsDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
