import React, { useState } from 'react';
import { Coins, Plus, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecharge: (amount: number) => void;
  isAlertOnly?: boolean;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  onRecharge,
  isAlertOnly = false,
}) => {
  const { t, isRTL, language } = useLanguage();
  const [showPackages, setShowPackages] = useState(!isAlertOnly);
  const [successNotice, setSuccessNotice] = useState<number | null>(null);
  const [adminPhone, setAdminPhone] = useState('201000000000');

  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/overview', {
        headers: { 'Accept': 'application/json' },
      })
        .then(async (res) => {
          if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return res.json();
            }
          }
          return null;
        })
        .then((data) => {
          if (data?.config?.whatsappNumber) {
            setAdminPhone(data.config.whatsappNumber);
          }
        })
        .catch((err) => console.warn('Failed to fetch admin config', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const packages = [
    { coins: 1000, label: language === 'ar' ? 'باقة المبتدئين' : 'Starter Pack', popular: false },
    { coins: 5000, label: language === 'ar' ? 'الخزينة الفضية' : 'Silver Stash', popular: false },
    { coins: 20000, label: language === 'ar' ? 'كبار اللاعبين' : 'High Roller', popular: true },
    { coins: 50000, label: language === 'ar' ? 'ثروة الـ VIP' : 'VIP Wealth', popular: false },
    { coins: 100000, label: language === 'ar' ? 'زعيم الكازينو' : 'Casino Boss', popular: false },
  ];

  const handleSelectPackage = (amount: number) => {
    onRecharge(amount);
    setSuccessNotice(amount);
    setTimeout(() => {
      setSuccessNotice(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Insufficient coin prompt */}
      {!showPackages && !successNotice ? (
        <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Coins className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-black text-white">{t.insufficientCoins}</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            {t.insufficientPrompt}
          </p>

          <div className="flex items-center gap-3">
            <button
              id="btn-recharge-confirm"
              onClick={() => setShowPackages(true)}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm shadow-lg transition-all"
            >
              {t.confirm}
            </button>
            <button
              id="btn-recharge-cancel"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm border border-slate-700 transition-all"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : successNotice ? (
        <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center shadow-2xl">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-3 text-emerald-400 animate-bounce" />
          <h3 className="text-xl font-black text-white">{t.rechargeSuccessful}</h3>
          <p className="text-emerald-400 font-mono font-bold text-lg mt-1">
            +{successNotice.toLocaleString()} {t.chips}
          </p>
        </div>
      ) : (
        /* Full Coin Store */
        <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-4 xs:p-6 shadow-2xl max-h-[92dvh] overflow-y-auto">
          <button
            id="btn-close-store"
            onClick={onClose}
            className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400`}
            title={t.coinStore}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{t.coinStore}</h3>
              <p className="text-xs text-slate-400">
                {t.coinStoreSubtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {packages.map((pkg) => (
              <a
                key={pkg.coins}
                href={`https://wa.me/${adminPhone}?text=${encodeURIComponent(language === 'ar' ? `أريد شراء باقة ${pkg.coins} كوينز` : `I want to buy the ${pkg.coins} coins package`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.99] ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-yellow-950/60 border-amber-400/60 shadow-lg'
                    : 'bg-slate-950/50 hover:bg-slate-800/60 border-slate-800'
                }`}
              >
                {pkg.popular && (
                  <span className={`absolute -top-2.5 ${isRTL ? 'right-4' : 'left-4'} bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow`}>
                    <Sparkles className="w-2.5 h-2.5" /> {language === 'ar' ? 'الأكثر طلباً' : 'POPULAR'}
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="text-sm font-black text-white">
                      {pkg.coins.toLocaleString()} {t.chips}
                    </p>
                    <p className="text-[11px] text-slate-400">{pkg.label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-400/40">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addCoins}</span>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              {language === 'ar' 
                ? 'لشراء الكوينزات، يرجى التواصل مع المسؤول مباشرة عبر الواتساب. سيتم إضافة الكوينزات إلى حسابك فوراً بعد الدفع.'
                : 'To purchase coins, please contact the admin directly via WhatsApp. Coins will be added to your account immediately after payment.'}
            </p>
            <a 
              href={`https://wa.me/${adminPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              {language === 'ar' ? 'تواصل مع المسؤول' : 'Contact Admin'}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
