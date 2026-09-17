import React from 'react';
import { ShineEffectConfig } from './types';
import { Sparkles, RotateCcw, Sliders, Check } from 'lucide-react';

interface SvgaShinePanelProps {
  layerName: string;
  shineConfig?: ShineEffectConfig;
  onUpdateShineConfig: (config: Partial<ShineEffectConfig>) => void;
  onResetShine?: () => void;
}

const COLOR_PRESETS = [
  { name: 'أبيض ناصع', value: '255, 255, 255', hex: '#ffffff' },
  { name: 'ذهبي درامي', value: '255, 215, 0', hex: '#ffd700' },
  { name: 'أزرق سماوي', value: '56, 189, 248', hex: '#38bdf8' },
  { name: 'وردي ماسي', value: '244, 114, 182', hex: '#f472b6' },
  { name: 'أخضر زمردي', value: '52, 211, 153', hex: '#34d399' }
];

export const SvgaShinePanel: React.FC<SvgaShinePanelProps> = ({
  layerName,
  shineConfig,
  onUpdateShineConfig,
  onResetShine
}) => {
  const isEnabled = shineConfig?.enabled ?? false;
  const beamWidth = shineConfig?.beamWidth ?? 50;
  const angleDeg = shineConfig?.angleDeg ?? 90;
  const opacity = Math.round((shineConfig?.opacity ?? 0.85) * 100);
  const featherSides = Math.round((shineConfig?.featherSides ?? 0.85) * 100);
  const featherTopBottom = Math.round((shineConfig?.featherTopBottom ?? 0.7) * 100);
  const maskToAlpha = shineConfig?.maskToAlpha ?? true;
  const color = shineConfig?.color ?? '255, 255, 255';
  const keyStart = Math.round((shineConfig?.keyframeStart ?? 0.0) * 100);
  const keyEnd = Math.round((shineConfig?.keyframeEnd ?? 1.0) * 100);

  const handleToggle = () => {
    onUpdateShineConfig({ enabled: !isEnabled });
  };

  return (
    <div className="space-y-4">
      {/* Header Card with Enable Toggle */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white">تحريك لمعة الطبقة (Shine Effect)</h3>
              <p className="text-[10px] text-amber-200/80">تطبيق شريط ضوئي متحرك بحواف باهتة متناسقة على "{layerName}"</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggle}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isEnabled
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 font-black'
                : 'bg-white/10 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-slate-950 animate-ping' : 'bg-slate-500'}`} />
            <span>{isEnabled ? 'مفعلة ✓' : 'معطلة'}</span>
          </button>
        </div>

        {isEnabled && onResetShine && (
          <div className="pt-2 border-t border-amber-500/20 flex justify-end">
            <button
              type="button"
              onClick={onResetShine}
              className="text-[10px] text-amber-400 hover:text-amber-200 flex items-center gap-1 transition-colors cursor-pointer font-bold"
            >
              <RotateCcw size={12} />
              <span>إعادة ضبط إعدادات اللمعة الافتراضية</span>
            </button>
          </div>
        )}
      </div>

      {isEnabled && (
        <div className="space-y-3">
          {/* Preset Color Selection */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
            <span className="text-xs font-black text-amber-300 block">لون وحجم شريط اللمعة:</span>
            
            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_PRESETS.map((p) => {
                const isSelected = color === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onUpdateShineConfig({ color: p.value })}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-sm'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    title={p.name}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white/30 shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: p.hex }}
                    >
                      {isSelected && <Check size={10} className={p.value === '255, 255, 255' ? 'text-black' : 'text-white'} />}
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 text-center truncate w-full">{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Beam Width & Opacity */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* Beam Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>عرض الشريط (px):</span>
                  <span className="font-mono text-amber-400">{beamWidth}px</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={5}
                  value={beamWidth}
                  onChange={(e) => onUpdateShineConfig({ beamWidth: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>السطوع والشفافية:</span>
                  <span className="font-mono text-amber-400">{opacity}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={opacity}
                  onChange={(e) => onUpdateShineConfig({ opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Angle & Movement Trajectory */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
            <span className="text-xs font-black text-sky-300 block">اتجاه وزاوية الحركة:</span>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-slate-300">
                <span>زاوية الدوران (درجة):</span>
                <span className="font-mono text-sky-400">{angleDeg}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={angleDeg}
                onChange={(e) => onUpdateShineConfig({ angleDeg: Number(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>0° أفقي</span>
                <span>45° مائل</span>
                <span>90° رأسي (من فوق لتحت)</span>
                <span>180° عكسي</span>
              </div>
            </div>

            {/* Quick Angle Presets */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { label: 'رأسي (90°)', deg: 90 },
                { label: 'مائل (45°)', deg: 45 },
                { label: 'أفقي (0°)', deg: 0 },
                { label: 'مائل عكسي (135°)', deg: 135 }
              ].map((preset) => (
                <button
                  key={preset.deg}
                  type="button"
                  onClick={() => onUpdateShineConfig({ angleDeg: preset.deg })}
                  className={`py-1.5 text-[10px] font-bold rounded-xl border transition-all cursor-pointer ${
                    angleDeg === preset.deg
                      ? 'bg-sky-500 text-slate-950 font-black border-sky-400 shadow-sm'
                      : 'bg-white/5 text-slate-300 hover:text-white border-white/10'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feathering Controls */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
            <span className="text-xs font-black text-cyan-300 block">نعومة وتلاشي الحواف (Feathering):</span>

            <div className="grid grid-cols-2 gap-3">
              {/* Side Feathering */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>تلاشي الجوانب:</span>
                  <span className="font-mono text-cyan-400">{featherSides}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={featherSides}
                  onChange={(e) => onUpdateShineConfig({ featherSides: Number(e.target.value) / 100 })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Top/Bottom Feathering */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>تلاشي الأطراف:</span>
                  <span className="font-mono text-cyan-400">{featherTopBottom}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={featherTopBottom}
                  onChange={(e) => onUpdateShineConfig({ featherTopBottom: Number(e.target.value) / 100 })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Mask to Alpha Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <span className="text-xs font-bold text-slate-200 block">قصر اللمعة على حدود الصورة فقط</span>
                <span className="text-[10px] text-slate-400">حجب اللمعة عن الفراغ الشفاف المحيط بالطبقة</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateShineConfig({ maskToAlpha: !maskToAlpha })}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                  maskToAlpha ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    maskToAlpha ? 'translate-x-0' : '-translate-x-5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Keyframes Start & End Range */}
          <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg">
            <span className="text-xs font-black text-purple-300 block">نطاق بداية ونهاية الحركة (Keyframes):</span>

            <div className="grid grid-cols-2 gap-3">
              {/* Start Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>نقطة البداية:</span>
                  <span className="font-mono text-purple-400">{keyStart}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={keyStart}
                  onChange={(e) => onUpdateShineConfig({ keyframeStart: Number(e.target.value) / 100 })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              {/* End Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-300">
                  <span>نقطة النهاية:</span>
                  <span className="font-mono text-purple-400">{keyEnd}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={keyEnd}
                  onChange={(e) => onUpdateShineConfig({ keyframeEnd: Number(e.target.value) / 100 })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
