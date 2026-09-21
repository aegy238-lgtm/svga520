import React from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { CartItem, Language, GiftItem } from '../types';
import { translations } from '../utils/translations';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  cartItems: CartItem[];
  onRemoveItem: (index: number) => void;
  onCheckoutAll: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  lang,
  cartItems,
  onRemoveItem,
  onCheckoutAll
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  const totalPrice = cartItems.reduce((acc, item) => acc + item.price, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0f131d] border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">
                {t.cart} ({cartItems.length})
              </h2>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cartItems.length === 0 ? (
              <div className="py-20 text-center text-slate-500 space-y-3">
                <ShoppingBag className="w-12 h-12 mx-auto opacity-30" />
                <p className="text-xs">{lang === 'ar' ? 'سلة المشتريات فارغة حالياً' : '购物车还是空的，去挑选心仪的动效吧'}</p>
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <img
                    src={item.gift.posterUrl}
                    alt={item.gift.title}
                    className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {item.gift.title}
                    </h4>
                    <span className="text-[10px] text-cyan-400 block font-mono">
                      {item.gift.id}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {item.licenseType === 'exclusive' ? (lang === 'ar' ? 'حقوق حصرية كاملة' : '全网买断') : (lang === 'ar' ? 'ترخيص تجاري' : '商业通用')} · {item.gift.formats[0]?.name || 'SVGA'}
                    </div>
                    <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                      $ {item.price} USD
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveItem(index)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer */}
          {cartItems.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{lang === 'ar' ? 'المجموع الإجمالي:' : '总计金额:'}</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  $ {totalPrice} USD
                </span>
              </div>

              <button
                onClick={onCheckoutAll}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>{lang === 'ar' ? 'المتابعة للشراء والاستلام الفوري' : '结算并打开交付盒'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
