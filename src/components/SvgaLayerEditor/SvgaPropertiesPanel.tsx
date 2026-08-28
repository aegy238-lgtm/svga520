import React, { useRef } from 'react';
import { EditableLayer, SVGAProjectData } from './types';
import { 
  Sliders, Link, Unlink, RotateCcw, 
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  AlignLeft, AlignRight, AlignCenter, ArrowUp, ArrowDown,
  Upload, Image as ImageIcon, Sparkles, RefreshCw, Eye,
  Film, FlipHorizontal, FlipVertical, Clock
} from 'lucide-react';

interface SvgaPropertiesPanelProps {
  project: SVGAProjectData;
  layer: EditableLayer | null;
  currentFrame: number;
  onUpdateTransform: (transform: Partial<EditableLayer['transform']>) => void;
  onToggleAspectLock: () => void;
  onReplaceAsset: (file: File) => void;
  onResetTransform: () => void;
  onUpdateFrameRange?: (startFrame: number, endFrame: number) => void;
}

export const SvgaPropertiesPanel: React.FC<SvgaPropertiesPanelProps> = ({
  project,
  layer,
  currentFrame,
  onUpdateTransform,
  onToggleAspectLock,
  onReplaceAsset,
  onResetTransform,
  onUpdateFrameRange
}) => {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#070b14] border-l border-white/10 text-slate-500 select-none" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <Sliders size={20} />
        </div>
        <h4 className="text-white font-bold text-xs mb-1">لوحة الخصائص (Properties)</h4>
        <p className="text-[11px] text-slate-400 max-w-[200px]">
          حدد أي طبقة من الكانفاس أو قائمة الطبقات لتعديل موضعها وحجمها وخصائصها
        </p>
      </div>
    );
  }

  const { transform, aspectRatioLocked, keyframeSummary } = layer;

  // Handle Quick Alignments
  const handleAlign = (type: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    const pw = project.width;
    const ph = project.height;
    const lw = transform.width;
    const lh = transform.height;

    switch (type) {
      case 'left':
        onUpdateTransform({ x: 0 });
        break;
      case 'centerX':
        onUpdateTransform({ x: Math.round((pw - lw) / 2) });
        break;
      case 'right':
        onUpdateTransform({ x: pw - lw });
        break;
      case 'top':
        onUpdateTransform({ y: 0 });
        break;
      case 'centerY':
        onUpdateTransform({ y: Math.round((ph - lh) / 2) });
        break;
      case 'bottom':
        onUpdateTransform({ y: ph - lh });
        break;
    }
  };

  const handleWidthChange = (val: number) => {
    const w = Math.max(5, val);
    const initW = Math.max(1, layer.initialBounds.width);
    const initH = Math.max(1, layer.initialBounds.height);
    const signX = transform.scaleX < 0 ? -1 : 1;
    const signY = transform.scaleY < 0 ? -1 : 1;

    if (aspectRatioLocked && transform.width > 0) {
      const ratio = transform.height / transform.width;
      const newH = Math.round(w * ratio);
      onUpdateTransform({
        width: w,
        height: newH,
        scaleX: parseFloat(((w / initW) * signX).toFixed(3)),
        scaleY: parseFloat(((newH / initH) * signY).toFixed(3))
      });
    } else {
      onUpdateTransform({
        width: w,
        scaleX: parseFloat(((w / initW) * signX).toFixed(3))
      });
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(5, val);
    const initW = Math.max(1, layer.initialBounds.width);
    const initH = Math.max(1, layer.initialBounds.height);
    const signX = transform.scaleX < 0 ? -1 : 1;
    const signY = transform.scaleY < 0 ? -1 : 1;

    if (aspectRatioLocked && transform.height > 0) {
      const ratio = transform.width / transform.height;
      const newW = Math.round(h * ratio);
      onUpdateTransform({
        height: h,
        width: newW,
        scaleY: parseFloat(((h / initH) * signY).toFixed(3)),
        scaleX: parseFloat(((newW / initW) * signX).toFixed(3))
      });
    } else {
      onUpdateTransform({
        height: h,
        scaleY: parseFloat(((h / initH) * signY).toFixed(3))
      });
    }
  };

  const handleFlipH = () => {
    onUpdateTransform({ scaleX: transform.scaleX * -1 });
  };

  const handleFlipV = () => {
    onUpdateTransform({ scaleY: transform.scaleY * -1 });
  };

  return (
    <div className="flex flex-col h-full bg-[#070b14] border-l border-white/10 overflow-y-auto custom-scrollbar p-4 space-y-4 select-none" dir="rtl">
      <input
        type="file"
        ref={replaceInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplaceAsset(f);
        }}
      />

      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sliders size={14} />
          </div>
          <div>
            <h3 className="text-white font-bold text-xs">خصائص الطبقة</h3>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{layer.name}</p>
          </div>
        </div>

        <button
          onClick={onResetTransform}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
          title="إعادة تعيين للموضع الأصلي"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Layer Thumbnail & Asset Replace */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
          {layer.thumbnailUrl ? (
            <img src={layer.thumbnailUrl} alt={layer.name} className="w-full h-full object-contain p-1" />
          ) : (
            <ImageIcon size={20} className="text-slate-500" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="text-xs font-bold text-white truncate">{layer.name}</span>
          <button
            onClick={() => replaceInputRef.current?.click()}
            className="w-full py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload size={11} /> استبدال الصورة (Replace)
          </button>
        </div>
      </div>

      {/* Alignment Tools */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 block">المحاذاة السريعة (Alignment)</span>
        <div className="grid grid-cols-6 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
          <button onClick={() => handleAlign('left')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة لليسار">
            <AlignLeft size={13} />
          </button>
          <button onClick={() => handleAlign('centerX')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة أفقية للمنتصف">
            <AlignHorizontalDistributeCenter size={13} />
          </button>
          <button onClick={() => handleAlign('right')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة لليمين">
            <AlignRight size={13} />
          </button>
          <button onClick={() => handleAlign('top')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة للأعلى">
            <ArrowUp size={13} />
          </button>
          <button onClick={() => handleAlign('centerY')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة رأسية للمنتصف">
            <AlignVerticalDistributeCenter size={13} />
          </button>
          <button onClick={() => handleAlign('bottom')} className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center justify-center" title="محاذاة للأسفل">
            <ArrowDown size={13} />
          </button>
        </div>
      </div>

      {/* Position (X, Y) */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 block">الموضع (Position)</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">X</span>
            <input
              type="number"
              value={Math.round(transform.x)}
              onChange={(e) => onUpdateTransform({ x: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">Y</span>
            <input
              type="number"
              value={Math.round(transform.y)}
              onChange={(e) => onUpdateTransform({ y: parseFloat(e.target.value) || 0 })}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>
        </div>
      </div>

      {/* Dimensions (W, H) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">الأبعاد (Dimensions)</span>
          <button
            onClick={onToggleAspectLock}
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
              aspectRatioLocked
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            {aspectRatioLocked ? <Link size={10} /> : <Unlink size={10} />}
            <span>{aspectRatioLocked ? 'نسبة ثابتة' : 'نسبة حرة'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">W</span>
            <input
              type="number"
              value={Math.round(transform.width)}
              onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 0)}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono font-bold">H</span>
            <input
              type="number"
              value={Math.round(transform.height)}
              onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 0)}
              className="w-20 bg-transparent text-left text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] text-slate-600 font-mono">px</span>
          </div>
        </div>
      </div>

      {/* Scale X & Scale Y with Flip buttons */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">مقياس التكبير والانعكاس</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleFlipH}
              className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded border border-white/10"
              title="انعكاس أفقي (Flip H)"
            >
              <FlipHorizontal size={12} />
            </button>
            <button
              onClick={handleFlipV}
              className="p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded border border-white/10"
              title="انعكاس رأسي (Flip V)"
            >
              <FlipVertical size={12} />
            </button>
            <span className="text-[10px] font-mono text-indigo-400 font-bold mr-1">
              {Math.round(Math.abs(transform.scaleX) * 100)}%
            </span>
          </div>
        </div>

        <input
          type="range"
          min="10"
          max="300"
          value={Math.round(Math.abs(transform.scaleX) * 100)}
          onChange={(e) => {
            const sc = parseFloat(e.target.value) / 100;
            const signX = transform.scaleX < 0 ? -1 : 1;
            const signY = transform.scaleY < 0 ? -1 : 1;
            const initW = Math.max(1, layer.initialBounds.width);
            const initH = Math.max(1, layer.initialBounds.height);
            onUpdateTransform({
              scaleX: sc * signX,
              scaleY: sc * signY,
              width: Math.round(initW * sc),
              height: Math.round(initH * sc)
            });
          }}
          className="w-full accent-indigo-500 cursor-pointer"
        />

        <div className="flex gap-1 pt-1">
          {[50, 75, 100, 150, 200].map(p => {
            const sc = p / 100;
            const initW = Math.max(1, layer.initialBounds.width);
            const initH = Math.max(1, layer.initialBounds.height);
            return (
              <button
                key={p}
                onClick={() => onUpdateTransform({
                  scaleX: sc * (transform.scaleX < 0 ? -1 : 1),
                  scaleY: sc * (transform.scaleY < 0 ? -1 : 1),
                  width: Math.round(initW * sc),
                  height: Math.round(initH * sc)
                })}
                className={`flex-1 py-1 rounded-lg text-[9px] font-mono transition-colors ${
                  Math.round(Math.abs(transform.scaleX) * 100) === p
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400'
                }`}
              >
                {p}%
              </button>
            );
          })}
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">زاوية التدوير (Rotation)</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={Math.round(transform.rotation)}
              onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) || 0 })}
              className="w-14 bg-slate-900 border border-white/10 rounded-lg px-2 py-0.5 text-center text-xs font-mono font-bold text-white outline-none"
            />
            <span className="text-[10px] font-mono text-slate-500">°</span>
          </div>
        </div>

        <input
          type="range"
          min="-180"
          max="180"
          value={Math.round(transform.rotation)}
          onChange={(e) => onUpdateTransform({ rotation: parseFloat(e.target.value) })}
          className="w-full accent-purple-500 cursor-pointer"
        />

        <div className="grid grid-cols-4 gap-1">
          {[0, 90, 180, -90].map(deg => (
            <button
              key={deg}
              onClick={() => onUpdateTransform({ rotation: deg })}
              className={`py-1 rounded-lg text-[9px] font-mono transition-colors ${
                Math.round(transform.rotation) === deg
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400'
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Opacity */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">الشفافية (Opacity)</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(transform.opacity)}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(transform.opacity)}
          onChange={(e) => onUpdateTransform({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />
      </div>

      {/* Timeline Active Frame Range Controls */}
      {onUpdateFrameRange && (
        <div className="bg-slate-900/90 border border-indigo-500/20 rounded-2xl p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-400" />
              <span>نطاق ظهور الطبقة في الفريمات</span>
            </span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">
              F{keyframeSummary.startFrame} → F{keyframeSummary.endFrame}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">فريم البداية:</label>
              <input
                type="number"
                min="0"
                max={project.totalFrames - 1}
                value={keyframeSummary.startFrame}
                onChange={(e) => {
                  const s = Math.max(0, Math.min(project.totalFrames - 1, parseInt(e.target.value) || 0));
                  onUpdateFrameRange(s, Math.max(s, keyframeSummary.endFrame));
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-white font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">فريم النهاية:</label>
              <input
                type="number"
                min="0"
                max={project.totalFrames - 1}
                value={keyframeSummary.endFrame}
                onChange={(e) => {
                  const end = Math.max(keyframeSummary.startFrame, Math.min(project.totalFrames - 1, parseInt(e.target.value) || 0));
                  onUpdateFrameRange(keyframeSummary.startFrame, end);
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-white font-mono text-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Quick Timeline Presets */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => onUpdateFrameRange(0, project.totalFrames - 1)}
              className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 rounded-lg font-bold border border-white/5"
            >
              كامل الحركة (0→{project.totalFrames - 1})
            </button>
            <button
              onClick={() => onUpdateFrameRange(currentFrame, currentFrame)}
              className="flex-1 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 rounded-lg font-bold border border-white/5"
            >
              الفريم الحالي (F{currentFrame})
            </button>
          </div>
        </div>
      )}

      {/* SVGA 2.0 Entity Inspection Card */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 space-y-2 text-[10px] font-mono">
        <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-1.5 font-bold">
          <span>بيانات الطبقة في SVGA 2.0:</span>
          <span className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">Protobuf</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-slate-300">
          <div>
            <span className="text-slate-500 block text-[9px]">Image Key:</span>
            <span className="text-white truncate block">{layer.imageKey}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Active Span:</span>
            <span className="text-indigo-300">F{keyframeSummary.startFrame} → F{keyframeSummary.endFrame}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Frames Count:</span>
            <span className="text-white">{layer.framesCount} F</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px]">Matte Mask:</span>
            <span className={layer.matteKey ? 'text-amber-400 font-bold' : 'text-slate-500'}>
              {layer.matteKey || 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
