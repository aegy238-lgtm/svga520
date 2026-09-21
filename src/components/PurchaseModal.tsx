import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  QrCode, 
  CreditCard, 
  Sparkles, 
  Check, 
  Lock, 
  Mail, 
  User, 
  Flame,
  CheckCircle2
} from 'lucide-react';
import { GiftItem, Language, DeliveryItem } from '../types';
import { translations } from '../utils/translations';

interface PurchaseModalProps {
  gift: GiftItem | null;
  onClose: () => void;
  lang: Language;
  onPaymentSuccess: (delivery: DeliveryItem) => void;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  gift,
  onClose,
  lang,
  onPaymentSuccess
}) => {
  const t = translations[lang];

  const [licenseType, setLicenseType] = useState<'standard' | 'exclusive'>('standard');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'card'>('wechat');
  const [buyerName, setBuyerName] = useState('主播小甜甜 / VIP Streamer');
  const [buyerEmail, setBuyerEmail] = useState('streamer@vip.com');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!gift) return null;

  const currentPrice = licenseType === 'exclusive' ? gift.exclusivePrice : gift.price;

  const handleConfirmPay = () => {
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const randomOrder = 'JW' + Date.now().toString().slice(-8);
      const randomLicense = 'CERT-JW-' + Math.floor(100000 + Math.random() * 900000);

      const delivery: DeliveryItem = {
        id: 'DEL-' + Math.random().toString(36).substr(2, 9),
        orderId: randomOrder,
        giftId: gift.id,
        giftTitle: gift.title,
        posterUrl: gift.posterUrl,
        videoUrl: gift.videoUrl,
        format: selectedFormat === 'all' ? '全套打包 (SVGA+MP4+VAP+PAG+Audio)' : selectedFormat,
        licenseType: licenseType,
        licenseKey: randomLicense,
        downloadUrl: gift.deliveryUrl || `https://cdn.jwtexiao.com/downloads/${gift.id.toLowerCase()}-full-bundle.zip`,
        fileSize: '45.8 MB',
        cloudDiskCode: gift.cloudDiskCode || 'JW8866',
        purchaseDate: new Date().toISOString().split('T')[0],
        price: currentPrice,
        buyerName: buyerName.trim() || (lang === 'ar' ? 'مشتري المتجر الإلكتروني' : 'Online Buyer'),
        buyerContact: buyerEmail.trim() || 'buyer@streamer.com',
        paymentMethod: paymentMethod,
        status: 'completed'
      };

      onPaymentSuccess(delivery);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl rounded-2xl bg-[#111520] border border-slate-700/80 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {t.purchaseBoxTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.purchaseSub}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Item Preview Card */}
          <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            <img
              src={gift.posterUrl}
              alt={gift.title}
              className="w-16 h-16 rounded-lg object-cover border border-slate-700 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm truncate">{gift.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800">
                  {gift.id}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {gift.category} · {gift.effectType} · {gift.resolution}
              </div>
              <div className="text-xs text-amber-400 font-bold mt-1 font-mono">
                单品标价: ¥{gift.price} CNY
              </div>
            </div>
          </div>

          {/* License Choice */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              {t.licenseChoice}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => setLicenseType('standard')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  licenseType === 'standard'
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{lang === 'ar' ? 'ترخيص تجاري عام' : '商业通用授权'}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">${gift.price} USD</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t.stdLicense}
                </p>
              </div>

              <div
                onClick={() => setLicenseType('exclusive')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  licenseType === 'exclusive'
                    ? 'bg-purple-950/40 border-purple-500 text-purple-200 shadow-md shadow-purple-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white">{lang === 'ar' ? 'شراء حقوق حصرية كاملة' : '全网独占买断'}</span>
                    <span className="text-[9px] px-1 bg-amber-500 text-black font-black rounded">VIP</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">${gift.exclusivePrice} USD</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {t.excLicense}
                </p>
              </div>
            </div>
          </div>

          {/* Formats Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              {t.formatSelect}
            </label>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="radio"
                  name="formatChoice"
                  checked={selectedFormat === 'all'}
                  onChange={() => setSelectedFormat('all')}
                  className="accent-cyan-400"
                />
                <span className="font-semibold text-cyan-300">{t.allFormatsBundle}</span>
              </label>
              <div className="text-[11px] text-slate-400 pl-5">
                包含 SVGA文件、透明通道MP4（带声音）、VAP序列、PAG文件、JSON/Lottie 及 AE工程源文件。
              </div>
            </div>
          </div>

          {/* Buyer Details */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              {t.buyerInfo}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder={t.buyerNamePlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder={t.buyerEmailPlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              {t.paymentMethod}
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('wechat')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  paymentMethod === 'wechat'
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>{t.wechatPay}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('alipay')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  paymentMethod === 'alipay'
                    ? 'bg-blue-950/40 border-blue-500 text-blue-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>{t.alipay}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-medium transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span>银联/Card</span>
              </button>
            </div>
          </div>

          {/* Simulated Instant Delivery Notice */}
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>{t.instantDeliveryNotice}</span>
          </div>
        </div>

        {/* Footer & Checkout Button */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-slate-400 block">{lang === 'ar' ? 'المبلغ المستحق:' : '实付金额:'}</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              $ {currentPrice} <span className="text-xs text-slate-400 font-semibold">USD</span>
            </span>
          </div>

          <button
            onClick={handleConfirmPay}
            disabled={isProcessing}
            className="py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 transition-all active:scale-95"
          >
            {isProcessing ? (
              <span className="animate-pulse">{lang === 'ar' ? 'جاري التحقق والربط...' : '正在生成数字凭证与交付盒...'}</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.confirmPay}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
