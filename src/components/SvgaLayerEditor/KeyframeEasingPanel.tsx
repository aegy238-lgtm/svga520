import React, { useState } from 'react';
import { LayerKeyframe, KeyframeEasing } from './types';
import { 
  Sliders, Trash2, Zap, ArrowRight, Play, RefreshCw, 
  Sparkles, Check, ChevronRight, X
} from 'lucide-react';

interface KeyframeEasingPanelProps {
  keyframe: LayerKeyframe;
  totalFrames: number;
  fps: number;
  onUpdateKeyframe: (updated: Partial<LayerKeyframe>) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
  onClose: () => void;
}

const EASING_PRESETS: { name: string; type: KeyframeEasing; bezier?: [number, number, number, number]; desc: string }[] = [
  { name: 'Linear', type: 'linear', desc: 'سرعة ثابتة منتظمة' },
  { name: 'Ease In', type: 'ease-in', bezier: [0.42, 0.0, 1.0, 1.0], desc: 'بداية بطيئة ثم تسارع' },
  { name: 'Ease Out', type: 'ease-out', bezier: [0.0, 0.0, 0.58, 1.0], desc: 'بداية سريعة ثم تباطؤ ناعم' },
  { name: 'Ease In Out', type: 'ease-in-out', bezier: [0.42, 0.0, 0.58, 1.0], desc: 'تسارع في البداية وتباطؤ في النهاية' },
  { name: 'Cubic Bezier (0.25, 0.1, 0.25, 1.0)', type: 'cubic-bezier', bezier: [0.25, 0.1, 0.25, 1.0], desc: 'حركة قياسية سلسة وممتعة' },
  { name: 'Anticipate / Back', type: 'cubic-bezier', bezier: [0.68, -0.3, 0.32, 1.3], desc: 'تراجع طفيف ثم انطلاق وارتداد ناعم' },
  { name: 'Step (Instant)', type: 'step', desc: 'قفزة فورية عند الوصول للفريم' }
];

export const KeyframeEasingPanel: React.FC<KeyframeEasingPanelProps> = ({
  keyframe,
  totalFrames,
  fps,
  onUpdateKeyframe,
  onDeleteKeyframe,
  onClose
}) => {
  const currentBezier: [number, number, number, number] = keyframe.cubicBezier || [0.25, 0.1, 0.25, 1.0];
  const [testAnim, setTestAnim] = useState(0);

  const triggerTest = () => {
    setTestAnim(prev => prev + 1);
  };

  const timeSec = fps > 0 ? (keyframe.frame / fps).toFixed(2) : '0.00';

  // SVG Curve coordinate mapping (100x100 box)
  const p1x = currentBezier[0] * 100;
  const p1y = 100 - (currentBezier[1] * 100);
  const p2x = currentBezier[2] * 100;
  const p2y = 100 - (currentBezier[3] * 100);

  const pathD = `M 0 100 C ${p1x} ${p1y}, ${p2x} ${p2y}, 100 0`;

  return (
    <div className="bg-slate-900/95 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl space-y-4 backdrop-blur-xl text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
            <Sliders size={13} />
          </div>
          <div>
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <span>إعدادات الفريم الرئيسي (Keyframe)</span>
              <span className="bg-indigo-600 text-white font-mono px-1.5 py-0.2 rounded text-[10px]">
                F{keyframe.frame} ({timeSec}s)
              </span>
            </h4>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
        >
          <X size={14} />
        </button>
      </div>

      {/* Values stored at this keyframe */}
      <div className="grid grid-cols-3 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 font-mono text-[11px]">
        {keyframe.x !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">الموضع X:</span>
            <span className="font-bold text-indigo-300">{Math.round(keyframe.x)} px</span>
          </div>
        )}
        {keyframe.y !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">الموضع Y:</span>
            <span className="font-bold text-indigo-300">{Math.round(keyframe.y)} px</span>
          </div>
        )}
        {keyframe.rotation !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">التدوير:</span>
            <span className="font-bold text-purple-300">{Math.round(keyframe.rotation)}°</span>
          </div>
        )}
        {keyframe.scaleX !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">التكبير X:</span>
            <span className="font-bold text-emerald-300">{Math.round(keyframe.scaleX * 100)}%</span>
          </div>
        )}
        {keyframe.scaleY !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">التكبير Y:</span>
            <span className="font-bold text-emerald-300">{Math.round(keyframe.scaleY * 100)}%</span>
          </div>
        )}
        {keyframe.opacity !== undefined && (
          <div className="text-slate-300">
            <span className="text-slate-500 text-[10px] block font-sans">الشفافية:</span>
            <span className="font-bold text-amber-300">{Math.round(keyframe.opacity)}%</span>
          </div>
        )}
      </div>

      {/* Bezier Visualizer Box */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-bold">منحنى التسارع (Easing Curve):</span>
          <button
            onClick={triggerTest}
            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-200 bg-indigo-600/20 px-2 py-0.5 rounded-lg border border-indigo-500/30"
          >
            <Play size={10} />
            <span>معاينة الحركة</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* SVG Curve Display */}
          <div className="relative w-28 h-24 bg-slate-950 border border-white/10 rounded-lg overflow-hidden shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full p-2 overflow-visible">
              {/* Grid lines */}
              <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              
              {/* Diagonal base reference */}
              <line x1="0" y1="100" x2="100" y2="0" stroke="rgba(255,255,255,0.1)" strokeDasharray="2,2" strokeWidth="1" />

              {/* Control handle lines */}
              <line x1="0" y1="100" x2={p1x} y2={p1y} stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.7" />
              <line x1="100" y1="0" x2={p2x} y2={p2y} stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.7" />

              {/* Curve line */}
              <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

              {/* Control points */}
              <circle cx={p1x} cy={p1y} r="3.5" fill="#6366f1" />
              <circle cx={p2x} cy={p2y} r="3.5" fill="#a855f7" />
            </svg>
          </div>

          {/* Real-time Preview Motion Box */}
          <div className="flex-1 space-y-1.5">
            <div className="text-[10px] text-slate-400 font-mono text-left" dir="ltr">
              cubic-bezier({currentBezier.join(', ')})
            </div>
            
            <div className="h-6 bg-slate-950 border border-white/10 rounded-lg relative overflow-hidden flex items-center px-1">
              <div 
                key={testAnim}
                className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-md shadow-cyan-500/50"
                style={{
                  animation: `slidePreview 1.2s cubic-bezier(${currentBezier.join(',')}) infinite alternate`
                }}
              />
            </div>
            <style>{`
              @keyframes slidePreview {
                0% { transform: translateX(0); }
                100% { transform: translateX(calc(100% + 140px)); }
              }
            `}</style>
          </div>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400 font-bold block">أنماط التسارع الجاهزة:</label>
        <div className="grid grid-cols-2 gap-1.5">
          {EASING_PRESETS.map((preset) => {
            const isSelected = keyframe.easing === preset.type && 
              (!preset.bezier || JSON.stringify(preset.bezier) === JSON.stringify(currentBezier));

            return (
              <button
                key={preset.name}
                onClick={() => {
                  onUpdateKeyframe({
                    easing: preset.type,
                    cubicBezier: preset.bezier || [0.25, 0.1, 0.25, 1.0]
                  });
                }}
                className={`p-2 rounded-xl text-right transition-all border text-xs cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-md'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px]">{preset.name}</span>
                  {isSelected && <Check size={12} className="text-indigo-400" />}
                </div>
                <span className="text-[9px] text-slate-400 block font-normal mt-0.5 truncate">
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <button
          onClick={() => onDeleteKeyframe(keyframe.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
          <span>حذف الفريم (Delete)</span>
        </button>

        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer"
        >
          تم
        </button>
      </div>
    </div>
  );
};
