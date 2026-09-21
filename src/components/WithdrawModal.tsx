import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wallet, 
  ArrowDownToLine, 
  Coins, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  CreditCard,
  Building,
  Smartphone,
  Copy,
  Check,
  History
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { UserProfile, WithdrawalRequest, AdminConfig } from '../types/game';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  userBalance: number;
  onBalanceUpdated: (newBalance: number) => void;
}

const PAYMENT_METHODS = [
  { id: 'usdt', nameAr: 'USDT (TRC-20) محفظة إلكترونية', icon: '💲', placeholder: 'عنوان محفظة USDT (TRC-20)' },
  { id: 'vodafone_cash', nameAr: 'فودافون كاش / اتصالات / أورنج كاش', icon: '📱', placeholder: 'رقم محفظة كاش (01xxxxxxxxx)' },
  { id: 'bank_transfer', nameAr: 'تحويل بنكي مباشر (IBAN / حساب)', icon: '🏛️', placeholder: 'رقم الآيبان (IBAN) أو رقم الحساب البنكي' },
  { id: 'stc_pay', nameAr: 'STC Pay / محفظة Urpay / مدى', icon: '💳', placeholder: 'رقم هاتف STC Pay أو معرف الحساب' },
  { id: 'payeer', nameAr: 'محفظة Payeer', icon: '🅿️', placeholder: 'رقم حساب بايير (P100xxxxxx)' },
  { id: 'binance_pay', nameAr: 'بينانس باي (Binance Pay ID)', icon: '🟡', placeholder: 'Binance Pay ID / Pay ID' },
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  user,
  userBalance,
  onBalanceUpdated,
}) => {
  const { isRTL, language } = useLanguage();
  const [coinsAmount, setCoinsAmount] = useState<number | ''>('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].nameAr);
  const [accountDetails, setAccountDetails] = useState('');
  const [recipientName, setRecipientName] = useState(user?.displayName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<WithdrawalRequest | null>(null);
  const [withdrawalsHistory, setWithdrawalsHistory] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Exchange rate config
  const [coinsPerUsd, setCoinsPerUsd] = useState(1200);
  const [minCoins, setMinCoins] = useState(1000);

  useEffect(() => {
    if (isOpen) {
      // Load current admin exchange rate
      fetch('/api/admin/overview', {
        headers: { Accept: 'application/json' },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.config) {
            if (data.config.coinsPerUsdWithdraw) setCoinsPerUsd(data.config.coinsPerUsdWithdraw);
            if (data.config.minWithdrawCoins) setMinCoins(data.config.minWithdrawCoins);
          }
        })
        .catch(() => {});

      // Load user's past withdrawals
      if (user?.userId) {
        fetch(`/api/user/withdrawals/${user.userId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.withdrawals) {
              setWithdrawalsHistory(data.withdrawals);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, user?.userId]);

  if (!isOpen) return null;

  const numCoins = Number(coinsAmount) || 0;
  const usdEquivalent = (numCoins / coinsPerUsd).toFixed(2);
  const maxCoinsAllowed = Math.floor(userBalance);

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.floor((userBalance * pct) / 100);
    setCoinsAmount(calculated);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user) {
      setErrorMsg(language === 'ar' ? 'يرجى تسجيل الدخول أولاً لطلب السحب' : 'Please login first to withdraw');
      return;
    }

    if (numCoins < minCoins) {
      setErrorMsg(
        language === 'ar' 
          ? `الحد الأدنى للسحب هو ${minCoins.toLocaleString()} كوينز` 
          : `Minimum withdrawal is ${minCoins.toLocaleString()} coins`
      );
      return;
    }

    if (numCoins > userBalance) {
      setErrorMsg(
        language === 'ar' 
          ? 'رصيد الكوينز الحالي لديك غير كافٍ لتنفيذ هذا المبلغ' 
          : 'Your current balance is insufficient'
      );
      return;
    }

    if (!accountDetails.trim()) {
      setErrorMsg(
        language === 'ar' 
          ? 'يرجى إدخال بيانات ورقم الحساب أو المحفظة لاستلام الأرباح' 
          : 'Please enter your payment account or wallet details'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          customId: user.customId || user.userId,
          userName: user.displayName || user.email,
          userEmail: user.email,
          coinsAmount: numCoins,
          paymentMethod: selectedMethod,
          accountDetails: accountDetails.trim(),
          recipientName: recipientName.trim() || user.displayName || 'User',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || (language === 'ar' ? 'فشل إرسال طلب السحب' : 'Failed to submit withdrawal'));
      } else {
        setSuccessData(data.withdrawal);
        onBalanceUpdated(data.newBalance);
        setWithdrawalsHistory((prev) => [data.withdrawal, ...prev]);
        setCoinsAmount('');
        setAccountDetails('');
      }
    } catch (err) {
      setErrorMsg(language === 'ar' ? 'حدث خطأ في الاتصال بالخادم' : 'Server connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentMethodObj = PAYMENT_METHODS.find((m) => m.nameAr === selectedMethod) || PAYMENT_METHODS[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn select-text"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-lg bg-[#0d1222] border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-h-[94dvh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer`}
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center text-slate-950 shrink-0">
            <ArrowDownToLine className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-white">
                {language === 'ar' ? 'سحب الأرباح النقدية' : 'Withdraw Profits'}
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {language === 'ar' ? 'فوري وآمن' : 'Instant & Safe'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'ar'
                ? `حول رصيدك من الكوينز إلى دولارات حقيقية (${coinsPerUsd.toLocaleString()} كوينز = 1$)`
                : `Convert your chips to real money (${coinsPerUsd.toLocaleString()} coins = $1)`}
            </p>
          </div>
        </div>

        {/* Tabs: Request vs History */}
        <div className="flex items-center gap-2 mb-4 p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => { setActiveTab('request'); setSuccessData(null); }}
            className={`flex-1 py-2 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'request'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>{language === 'ar' ? 'طلب سحب جديد' : 'New Request'}</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{language === 'ar' ? 'سجل السحوبات' : 'History'}</span>
            {withdrawalsHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-emerald-300 text-[10px]">
                {withdrawalsHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: NEW WITHDRAWAL REQUEST */}
        {activeTab === 'request' && (
          <div>
            {successData ? (
              /* Success Confirmation Box */
              <div className="p-6 rounded-3xl bg-slate-900 border border-emerald-500/50 text-center space-y-4 shadow-xl animate-fadeIn">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-10 h-10 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white">
                    {language === 'ar' ? 'تم استلام طلب السحب بنجاح!' : 'Withdrawal Request Received!'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {language === 'ar'
                      ? 'سيتم مراجعة الطلب وتحويل المبلغ إلى حسابك المحدد في أسرع وقت ممكن.'
                      : 'Your request is being processed and will be transferred shortly.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2 text-slate-300 text-right">
                  <div className="flex justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-slate-400">{language === 'ar' ? 'رقم الطلب:' : 'Request ID:'}</span>
                    <span className="font-mono text-emerald-300 font-bold">{successData.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-slate-400">{language === 'ar' ? 'المبلغ المطلوب:' : 'Amount:'}</span>
                    <span className="font-bold text-white">
                      {successData.coinsAmount.toLocaleString()} 🪙 (${successData.usdAmount})
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-slate-400">{language === 'ar' ? 'طريقة الاستلام:' : 'Method:'}</span>
                    <span className="text-amber-300 font-bold">{successData.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">{language === 'ar' ? 'بيانات الحساب:' : 'Account:'}</span>
                    <span className="font-mono text-slate-200 truncate max-w-[200px]">
                      {successData.accountDetails}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSuccessData(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
                  >
                    {language === 'ar' ? 'طلب سحب آخر' : 'Another Request'}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs shadow-md transition-transform active:scale-95"
                  >
                    {language === 'ar' ? 'تم، العودة للألعاب' : 'Done'}
                  </button>
                </div>
              </div>
            ) : (
              /* Withdrawal Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Balance & Live Conversion Bar */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {language === 'ar' ? 'رصيدك المتاح للسحب:' : 'Available Balance:'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="text-base font-black text-amber-300 font-mono">
                        {userBalance.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400">
                        ≈ ${(userBalance / coinsPerUsd).toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      {language === 'ar' ? 'سعر الصرف الحالي' : 'Exchange Rate'}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      1$ = {coinsPerUsd.toLocaleString()} 🪙
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {language === 'ar' ? 'عدد الكوينز المراد سحبها:' : 'Coins to Withdraw:'}
                  </label>
                  <div className="relative">
                    <Coins className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400`} />
                    <input
                      type="number"
                      min={minCoins}
                      max={maxCoinsAllowed}
                      placeholder={`${language === 'ar' ? 'الحد الأدنى' : 'Min'}: ${minCoins.toLocaleString()}`}
                      value={coinsAmount}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setCoinsAmount(val);
                        setErrorMsg(null);
                      }}
                      className={`w-full ${isRTL ? 'pr-9 pl-28' : 'pl-9 pr-28'} py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400 shadow-inner`}
                    />
                    <div className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 font-mono font-black text-xs text-emerald-400`}>
                      ≈ ${usdEquivalent} USD
                    </div>
                  </div>

                  {/* Quick percentage buttons */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {[
                      { label: '25%', val: 25 },
                      { label: '50%', val: 50 },
                      { label: '75%', val: 75 },
                      { label: language === 'ar' ? 'الكل' : 'MAX', val: 100 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => handleQuickPercent(p.val)}
                        className="flex-1 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] font-bold text-slate-300 hover:text-white transition-colors border border-slate-700 active:scale-95 cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {language === 'ar' ? 'اختر طريقة استلام الأرباح:' : 'Select Payment Method:'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const isSelected = selectedMethod === m.nameAr;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMethod(m.nameAr)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2.5 text-right cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-400 text-white shadow-md'
                              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-lg">{m.icon}</span>
                          <span className="truncate">{m.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account Details / Wallet Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {language === 'ar' ? 'بيانات الاستلام (رقم المحفظة / رقم الحساب / الآيبان):' : 'Account Details / Wallet:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={currentMethodObj.placeholder}
                    value={accountDetails}
                    onChange={(e) => setAccountDetails(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>

                {/* Recipient Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {language === 'ar' ? 'اسم المستلم (كما في الحساب):' : 'Recipient Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={language === 'ar' ? 'الاسم بالكامل كما في المحفظة أو البنك' : 'Full Name'}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 shadow-inner"
                  />
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || userBalance < minCoins}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? (language === 'ar' ? 'جاري إرسال الطلب...' : 'Submitting...')
                      : (language === 'ar' ? `تأكيد سحب $${usdEquivalent} دولار الآن` : `Confirm Withdraw $${usdEquivalent}`)}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: WITHDRAWAL HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {withdrawalsHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold">
                  {language === 'ar' ? 'لا توجد طلبات سحب سابقة لديك' : 'No withdrawal requests yet'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ar' ? 'يمكنك إرسال طلب سحب جديد في أي وقت عندما يكون لديك رصيد' : 'Submit a withdrawal whenever you have coins'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {withdrawalsHistory.map((item) => {
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';
                  return (
                    <div 
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">{item.id}</span>
                          <button
                            onClick={() => handleCopy(item.id, item.id)}
                            className="text-slate-500 hover:text-slate-300 p-0.5 rounded cursor-pointer"
                            title="نسخ رقم الطلب"
                          >
                            {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Status badge */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isRejected
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {isApproved ? '✅ تم التحويل بنجاح' : isRejected ? '❌ مرفوض وتم استرجاع الكوينز' : '⏳ قيد المراجعة والتحويل'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                        <div>
                          <span className="font-bold text-white">
                            {item.coinsAmount.toLocaleString()} 🪙
                          </span>
                          <span className="text-emerald-400 font-mono ml-1.5 rtl:mr-1.5">
                            (${item.usdAmount} USD)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {item.paymentMethod}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono truncate bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                        {item.accountDetails}
                      </div>

                      {item.notes && (
                        <p className="text-[10px] text-amber-300/90 italic">
                          ملاحظات الإدارة: {item.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
