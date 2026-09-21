import React, { useState } from 'react';
import { X, QrCode, Smartphone, Lock, ShieldCheck, Check } from 'lucide-react';
import { Language } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onLoginSuccess: (name: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  lang,
  onLoginSuccess
}) => {
  const [tab, setTab] = useState<'qrcode' | 'phone'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isAgreed, setIsAgreed] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(phone ? `用户_${phone.slice(-4)}` : '特权主播_888');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-[#111520] border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 text-center border-b border-slate-800">
          <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white mb-2 shadow-lg shadow-cyan-500/20">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M3.5 4L9.5 19.5L14 9.5L12 5.5L8 14L5.5 4H3.5ZM14.5 4L20.5 19.5H18L13.5 8L15 4H14.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">
            佳维特效 · 买正版 不侵权
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === 'ar' ? 'تسجيل الدخول للاستمتاع بخصومات الأعضاء والتحميل السريع' : '登录开启会员折扣与专属动效下载'}
          </p>
        </div>

        {/* Tabs - exactly as shown in video frames 0:13, 0:38 */}
        <div className="flex border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setTab('phone')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              tab === 'phone'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {lang === 'ar' ? 'رقم الهاتف / SMS' : '手机号登录'}
          </button>
          <button
            onClick={() => setTab('qrcode')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              tab === 'qrcode'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {lang === 'ar' ? 'مسح رمز QR' : '扫码登录'}
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === 'phone' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 overflow-hidden">
                <span className="px-3 text-xs font-mono text-cyan-400 border-r border-slate-700">
                  +86
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号 / Enter phone number"
                  className="w-full px-3 py-2.5 text-xs bg-transparent text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setCode('8866')}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium shrink-0 border border-slate-700"
                >
                  {lang === 'ar' ? 'رمز تلقائي' : '获取验证码'}
                </button>
              </div>

              <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  className="mt-0.5 accent-cyan-400"
                />
                <span>
                  {lang === 'ar' ? 'أوافق على اتفاقية شروط الخدمة وسياسة الخصوصية' : '我已阅读并同意《用户服务协议》与《隐私保护指引》'}
                </span>
              </div>

              <button
                type="submit"
                disabled={!isAgreed}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-cyan-500/20"
              >
                {lang === 'ar' ? 'تسجيل الدخول الآن' : '登录 / 注册'}
              </button>
            </form>
          ) : (
            <div className="py-4 text-center space-y-3">
              <div className="w-44 h-44 mx-auto bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center relative">
                {/* QR graphic */}
                <div className="w-full h-full border-4 border-slate-900 p-2 flex flex-col items-center justify-between">
                  <div className="w-full flex justify-between">
                    <div className="w-7 h-7 bg-black"></div>
                    <div className="w-7 h-7 bg-black"></div>
                  </div>
                  <QrCode className="w-16 h-16 text-slate-900" />
                  <div className="w-full flex justify-between">
                    <div className="w-7 h-7 bg-black"></div>
                    <div className="w-7 h-7 bg-cyan-600"></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'امسح الرمز عبر WeChat أو التطبيق للدخول الفوري' : '微信扫码一键安全登录'}
              </p>
              <button
                onClick={() => {
                  onLoginSuccess('微信认证主播_JW');
                  onClose();
                }}
                className="text-xs text-cyan-400 underline"
              >
                {lang === 'ar' ? 'محاكاة نجاح المسح' : '模拟扫码完成'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
