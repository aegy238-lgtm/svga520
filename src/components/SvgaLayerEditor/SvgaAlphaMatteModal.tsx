import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, Upload, Image as ImageIcon, Layers, Play, Check, 
  ArrowDown, ArrowRight, Wand2, Sliders, Eye
} from 'lucide-react';
import { EditableLayer } from './types';

// Pre-generated SVG Shine Presets as high-res Data URLs
const SHINE_PRESETS = [
  {
    id: 'diagonal_beam',
    title: 'شعاع مائل ناعم',
    desc: 'شعاع ضوئي مائل بانسيابية ناعمة مناسب للإطارات والمجوهرات',
    createDataUrl: (w = 300, h = 300) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
              <stop offset="35%" stop-color="#ffffff" stop-opacity="0.3" />
              <stop offset="50%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="65%" stop-color="#ffffff" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="g2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fef08a" stop-opacity="0" />
              <stop offset="50%" stop-color="#fef08a" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#fef08a" stop-opacity="0" />
            </linearGradient>
          </defs>
          <rect x="-${w*0.5}" y="${h*0.35}" width="${w*2}" height="${h*0.3}" transform="rotate(-35 ${w/2} ${h/2})" fill="url(#g1)" />
          <rect x="-${w*0.5}" y="${h*0.42}" width="${w*2}" height="${h*0.15}" transform="rotate(-35 ${w/2} ${h/2})" fill="url(#g2)" />
        </svg>
      `;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'radial_glow',
    title: 'توهج شعاعي برّاق',
    desc: 'توهج كروي مركز للأزرار والأوسمة',
    createDataUrl: (w = 300, h = 300) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <radialGradient id="rg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="25%" stop-color="#fef08a" stop-opacity="0.8" />
              <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="${w/2}" cy="${h/2}" r="${w*0.45}" fill="url(#rg)" />
        </svg>
      `;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'wide_band',
    title: 'شريط لمعة عريض',
    desc: 'شريط ضوئي أفقي فخم يعبر على كامل الطبقة',
    createDataUrl: (w = 300, h = 300) => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="wg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0" />
              <stop offset="30%" stop-color="#ffffff" stop-opacity="0.6" />
              <stop offset="50%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="70%" stop-color="#ffffff" stop-opacity="0.6" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="${h*0.2}" width="${w}" height="${h*0.6}" fill="url(#wg)" />
        </svg>
      `;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  },
  {
    id: 'diamond_star',
    title: 'وميض نجمي متلألئ',
    desc: 'نجمة لمعة ماسية بأربعة أشعة مضيئة',
    createDataUrl: (w = 300, h = 300) => {
      const cx = w / 2;
      const cy = h / 2;
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
              <stop offset="40%" stop-color="#fde047" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#fde047" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${w*0.3}" fill="url(#starGlow)" />
          <path d="M ${cx} 10 Q ${cx} ${cy} ${w-10} ${cy} Q ${cx} ${cy} ${cx} ${h-10} Q ${cx} ${cy} 10 ${cy} Q ${cx} ${cy} ${cx} 10 Z" fill="#ffffff" opacity="0.95" />
          <circle cx="${cx}" cy="${cy}" r="${w*0.08}" fill="#ffffff" />
        </svg>
      `;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  }
];

interface SvgaAlphaMatteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLayer: EditableLayer | null;
  onApplyMatte: (
    parentLayer: EditableLayer,
    source: { file?: File; dataUrl?: string; name: string },
    options: {
      blendMode: 'screen' | 'lighter' | 'source-over';
      animationSweep: 'top-to-bottom' | 'left-to-right' | 'static';
    }
  ) => void;
}

export const SvgaAlphaMatteModal: React.FC<SvgaAlphaMatteModalProps> = ({
  isOpen,
  onClose,
  targetLayer,
  onApplyMatte
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('diagonal_beam');
  const [activeSourceType, setActiveSourceType] = useState<'upload' | 'preset'>('upload');
  const [blendMode, setBlendMode] = useState<'screen' | 'lighter' | 'source-over'>('lighter');
  const [animationSweep, setAnimationSweep] = useState<'top-to-bottom' | 'left-to-right' | 'static'>('top-to-bottom');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !targetLayer) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setActiveSourceType('upload');
    }
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      if (activeSourceType === 'upload' && selectedFile) {
        onApplyMatte(
          targetLayer,
          { file: selectedFile, name: selectedFile.name },
          { blendMode, animationSweep }
        );
      } else {
        const preset = SHINE_PRESETS.find(p => p.id === selectedPresetId) || SHINE_PRESETS[0];
        const dataUrl = preset.createDataUrl(targetLayer.transform.width || 300, targetLayer.transform.height || 300);
        onApplyMatte(
          targetLayer,
          { dataUrl, name: preset.title },
          { blendMode, animationSweep }
        );
      }
      onClose();
    } catch (err: any) {
      console.error('Error applying matte layer:', err);
      alert(`فشل تطبيق الطبقة: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-slate-950/95 border-2 border-purple-500/50 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.35)] overflow-hidden flex flex-col max-h-[90vh]"
          dir="rtl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/60 via-slate-900/60 to-purple-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <Sparkles size={20} className="text-yellow-300 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  استدعاء طبقة إضاءة مدمجة (Alpha Matte)
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    After Effects System
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  حصر وتضمين طبقة الإضاءة والشعاع داخل حدود: <strong className="text-amber-300 font-mono">{targetLayer.name}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveSourceType('upload')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeSourceType === 'upload'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload size={14} />
                <span>رفع صورة من جهازك (PNG / WebP)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceType('preset')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeSourceType === 'preset'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wand2 size={14} />
                <span>قوالب ولمعات إضاءة جاهزة (Presets)</span>
              </button>
            </div>

            {/* Upload Area */}
            {activeSourceType === 'upload' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-500/5 hover:bg-purple-500/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white mb-1">
                      {selectedFile ? `الملف المحدد: ${selectedFile.name}` : 'انقر لاختيار صورة الإضاءة أو الشعاع'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      يدعم PNG, WebP, SVG بخلفية شفافة (حجم مستحسن: مثل حجم الإطار)
                    </p>
                  </div>
                  {selectedFile && (
                    <span className="text-[11px] font-bold text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      ✓ جاهز للتطبيق
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Presets Grid */}
            {activeSourceType === 'preset' && (
              <div className="grid grid-cols-2 gap-3">
                {SHINE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative group ${
                        isSelected
                          ? 'bg-purple-600/25 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="w-full h-24 bg-black/60 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center p-2 relative">
                        <img
                          src={preset.createDataUrl(160, 160)}
                          alt={preset.title}
                          className="max-w-full max-h-full object-contain drop-shadow"
                        />
                        {isSelected && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md">
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-xs text-white group-hover:text-purple-300 transition-colors">
                          {preset.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                          {preset.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Settings: Blend Mode & Animation Direction */}
            <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders size={13} className="text-indigo-400" />
                  نمط الدمج (Blend Mode):
                </span>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setBlendMode('lighter')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      blendMode === 'lighter' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    توهج قوي (Lighter)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlendMode('screen')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      blendMode === 'screen' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    شاشة (Screen)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlendMode('source-over')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      blendMode === 'source-over' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    عادي (Normal)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Play size={13} className="text-indigo-400" />
                  حركة المسار التلقائية (Sweep Animation):
                </span>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setAnimationSweep('top-to-bottom')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      animationSweep === 'top-to-bottom' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDown size={11} />
                    <span>من أعلى لأسفل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationSweep('left-to-right')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      animationSweep === 'left-to-right' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowRight size={11} />
                    <span>من يسار ليمين</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationSweep('static')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      animationSweep === 'static' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ثابت بدون تحريك
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={isProcessing || (activeSourceType === 'upload' && !selectedFile)}
              onClick={handleConfirm}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles size={15} />
              <span>{isProcessing ? 'جاري الاستدعاء والدمج...' : 'تطبيق واستدعاء الطبقة المدمجة'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
