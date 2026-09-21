import React, { useState } from 'react';
import { X, Headphones, Send, MessageSquare, Check, Phone, ShieldCheck } from 'lucide-react';
import { Language } from '../types';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, lang }) => {
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-[#111520] border border-slate-700 shadow-2xl p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div className="w-10 h-10 mx-auto rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
            <Headphones className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            {lang === 'ar' ? 'خدمة العملاء والاستشارات الفنية' : '官方客服与独家定制咨询'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar' ? 'دعم فني على مدار الساعة لملفات SVGA/VAP واستشارات الشراء الحصري' : '7x24小时全天候动效工程师在线，支持微信与企业对接'}
          </p>
        </div>

        {submitted ? (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-center space-y-2">
            <Check className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-xs font-bold text-emerald-300">
              {lang === 'ar' ? 'تم إرسال رسالتك وسيتواصل معك المستشار فوراً!' : '咨询已提交！专属顾问将在5分钟内响应对接。'}
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
            >
              确定
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="space-y-3 text-xs"
          >
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>{lang === 'ar' ? 'معرف WeChat الرسمي:' : '官方微信客服:'}</span>
                <strong className="text-cyan-400 font-mono">jiaweivfx_01</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>{lang === 'ar' ? 'البريد الإلكتروني:' : '商务与定制邮箱:'}</span>
                <strong className="text-cyan-400 font-mono">vip@jwtexiao.com</strong>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                {lang === 'ar' ? 'اكتب استفسارك أو طلبك المخصص:' : '输入您的定制需求或技术疑问:'}
              </label>
              <textarea
                required
                rows={3}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="如: 需要中秋节专属3D霸气龙动效定制 / 全网排他买断..."
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white font-bold"
            >
              {lang === 'ar' ? 'إرسال الاستفسار' : '提交需求咨询'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
