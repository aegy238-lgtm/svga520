import React from 'react';
import { X, Crown, Check, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface VipModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onUpgrade: () => void;
}

export const VipModal: React.FC<VipModalProps> = ({
  isOpen,
  onClose,
  lang,
  onUpgrade
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#161a29] to-[#0e111a] border border-amber-500/40 shadow-2xl p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 mb-3 shadow-lg shadow-amber-500/20">
            <Crown className="w-6 h-6 fill-current" />
          </div>
          <h2 className="text-xl font-black text-white">
            {lang === 'ar' ? 'عضوية منصة جياوي VIP لكبار الشخصيات' : '开通平台会员 · 最低享 6 折'}
          </h2>
          <p className="text-xs text-amber-300/80 mt-1">
            {lang === 'ar' ? 'وفر حتى 40% على جميع المؤثرات مع تحميل غير محدود لملفات الفحص' : '全场50000+正版动效特惠特权，尊享极速云盘无码直下'}
          </p>
        </div>

        {/* Benefits List */}
        <div className="space-y-2.5 mb-6 text-xs text-slate-300">
          {[
            { zh: '全场单品折上折，最低享受标价 6 折', ar: 'خصم مباشر 40% على جميع الهدايا والمؤثرات' },
            { zh: '每月赠送 50 次官方动效格式无损转换工具', ar: '50 عملية تحويل مجانية شهرياً لصيغ SVGA و VAP' },
            { zh: '独享 1080P/60FPS 高码率带透明通道 MP4 资源', ar: 'تحميل مباشر لملفات MP4 الشفافة بدقة 60 إطار' },
            { zh: '优先一对一版权咨询与排他买断预定权', ar: 'أولوية الاستشارات وحجز الحقوق الحصرية' }
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>{lang === 'ar' ? b.ar : b.zh}</span>
            </div>
          ))}
        </div>

        {/* Pricing options */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-center">
            <div className="text-xs font-bold text-amber-300">年度黄金会员</div>
            <div className="text-xl font-black text-white font-mono my-1">¥ 699 <span className="text-xs text-slate-400 font-normal">/年</span></div>
            <div className="text-[10px] text-amber-400">平均每月仅 ¥58</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <div className="text-xs font-bold text-slate-300">季度银卡会员</div>
            <div className="text-xl font-black text-white font-mono my-1">¥ 238 <span className="text-xs text-slate-400 font-normal">/季</span></div>
            <div className="text-[10px] text-slate-400">标准尝鲜体验</div>
          </div>
        </div>

        <button
          onClick={() => {
            onUpgrade();
            onClose();
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-600 hover:opacity-95 text-slate-950 font-extrabold text-sm shadow-xl shadow-amber-500/25 transition-transform active:scale-95"
        >
          {lang === 'ar' ? 'ترقية العضوية فوراً' : '立即开通 VIP 会员'}
        </button>
      </div>
    </div>
  );
};
