import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, Sliders, Play, Pause, RotateCcw, Copy, Check, 
  Download, Eye, EyeOff, Layers, Move, Palette, Zap, ArrowRight, Video, FileCode, Upload, Image as ImageIcon
} from 'lucide-react';

export interface FrameSheenPoint {
  x: number; // 0 to 1 (normalized canvas ratio)
  y: number;
}

export interface FrameSheenConfig {
  enabled: boolean;
  sheenType: 'gradient' | 'image';
  sheenImageUrl: string | null;
  sheenImageElement?: HTMLImageElement | null;
  pointA: FrameSheenPoint; // Start control point
  pointB: FrameSheenPoint; // End control point
  pointC: FrameSheenPoint; // Width/Spread control point
  width: number; // Sheen band width in pixels
  colorPreset: 'gold' | 'silver' | 'platinum' | 'diamond' | 'rainbow' | 'custom';
  customColor: string;
  speed: number; // Cycle duration in seconds
  blendMode: 'ADD' | 'SCREEN' | 'OVERLAY' | 'HARD_LIGHT' | 'LIGHTEN';
  opacity: number; // 0.1 to 1.0
  feather: number; // Blur / feathering px
  maskToFrame: boolean;
  loopInterval: number; // Pause interval between sweeps in seconds
}

export const DEFAULT_FRAME_SHEEN_CONFIG: FrameSheenConfig = {
  enabled: true,
  sheenType: 'image',
  sheenImageUrl: null,
  sheenImageElement: null,
  pointA: { x: 0.1, y: 0.1 },
  pointB: { x: 0.9, y: 0.9 },
  pointC: { x: 0.5, y: 0.35 },
  width: 80,
  colorPreset: 'gold',
  customColor: '#ffd700',
  speed: 2.5,
  blendMode: 'ADD',
  opacity: 0.9,
  feather: 10,
  maskToFrame: true,
  loopInterval: 0.5
};

// Preset colors and stops
export const SHEEN_PRESETS = {
  gold: {
    name: 'ذهب ملكي (Gold Sheen)',
    color: '#ffd700',
    stops: [
      { offset: 0, color: 'rgba(255, 215, 0, 0)' },
      { offset: 0.3, color: 'rgba(255, 223, 128, 0.4)' },
      { offset: 0.5, color: 'rgba(255, 255, 255, 0.95)' },
      { offset: 0.7, color: 'rgba(255, 215, 0, 0.4)' },
      { offset: 1, color: 'rgba(255, 215, 0, 0)' }
    ]
  },
  silver: {
    name: 'فضة براقة (Silver)',
    color: '#e2e8f0',
    stops: [
      { offset: 0, color: 'rgba(224, 224, 224, 0)' },
      { offset: 0.4, color: 'rgba(240, 240, 255, 0.6)' },
      { offset: 0.5, color: 'rgba(255, 255, 255, 1)' },
      { offset: 0.6, color: 'rgba(240, 240, 255, 0.6)' },
      { offset: 1, color: 'rgba(224, 224, 224, 0)' }
    ]
  },
  platinum: {
    name: 'بلاتينيوم كريستال (Platinum Crystal)',
    color: '#cbd5e1',
    stops: [
      { offset: 0, color: 'rgba(200, 230, 255, 0)' },
      { offset: 0.3, color: 'rgba(220, 240, 255, 0.5)' },
      { offset: 0.5, color: 'rgba(255, 255, 255, 0.98)' },
      { offset: 0.7, color: 'rgba(180, 220, 255, 0.5)' },
      { offset: 1, color: 'rgba(200, 230, 255, 0)' }
    ]
  },
  diamond: {
    name: 'ماس فوسفوري (Diamond Cyan)',
    color: '#38bdf8',
    stops: [
      { offset: 0, color: 'rgba(0, 240, 255, 0)' },
      { offset: 0.35, color: 'rgba(0, 255, 240, 0.6)' },
      { offset: 0.5, color: 'rgba(255, 255, 255, 1)' },
      { offset: 0.65, color: 'rgba(0, 200, 255, 0.6)' },
      { offset: 1, color: 'rgba(0, 240, 255, 0)' }
    ]
  },
  rainbow: {
    name: 'طيـف المـاس (Rainbow Prism)',
    color: '#a855f7',
    stops: [
      { offset: 0, color: 'rgba(255, 0, 0, 0)' },
      { offset: 0.25, color: 'rgba(255, 215, 0, 0.7)' },
      { offset: 0.5, color: 'rgba(255, 255, 255, 0.95)' },
      { offset: 0.75, color: 'rgba(0, 220, 255, 0.7)' },
      { offset: 1, color: 'rgba(180, 0, 255, 0)' }
    ]
  },
  custom: {
    name: 'لون مخصص (Custom Color)',
    color: '#3b82f6',
    stops: []
  }
};

/**
 * Generate a procedural high-res shine texture canvas data URL
 */
const createProcedureShineTexture = (type: string, colorHex: string): string => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  const cx = 128;
  const cy = 128;

  // Draw radial shine burst flare
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, colorHex);
  grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Cross star rays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let r = 0; r < 4; r++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(-120, -3);
    ctx.lineTo(0, -1);
    ctx.lineTo(120, -3);
    ctx.lineTo(0, 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  return c.toDataURL();
};

/**
 * Draw the Frame Sheen Effect (Image or Procedural) onto any target canvas at time t (seconds)
 */
export const drawFrameSheenOnCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: FrameSheenConfig,
  timeSec: number
) => {
  if (!config || !config.enabled) return;

  const { pointA, pointB, colorPreset, customColor, speed, blendMode, opacity, width: bandWidth, feather, loopInterval, sheenType, sheenImageUrl, sheenImageElement } = config;

  // Convert normalized points to actual canvas pixels
  const ax = pointA.x * width;
  const ay = pointA.y * height;
  const bx = pointB.x * width;
  const by = pointB.y * height;

  // Vector from A to B
  const dx = bx - ax;
  const dy = by - ay;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1) return;

  // Angle of vector A -> B
  const angle = Math.atan2(dy, dx);

  // Compute animation progress along line A -> B
  const totalCycle = speed + (loopInterval || 0);
  const cycleTime = timeSec % totalCycle;
  let progress = 0;
  if (cycleTime <= speed) {
    progress = cycleTime / speed; // 0 to 1
  } else {
    // In pause interval
    return;
  }

  // Current sheen sweep center point along vector A -> B
  const currentX = ax + dx * progress;
  const currentY = ay + dy * progress;

  // Save context
  ctx.save();

  // Blend mode & global opacity
  if (blendMode === 'ADD') ctx.globalCompositeOperation = 'lighter';
  else if (blendMode === 'SCREEN') ctx.globalCompositeOperation = 'screen';
  else if (blendMode === 'OVERLAY') ctx.globalCompositeOperation = 'overlay';
  else if (blendMode === 'HARD_LIGHT') ctx.globalCompositeOperation = 'hard-light';
  else ctx.globalCompositeOperation = 'source-over';

  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

  // Translate to current sweep position & rotate perpendicular to line A -> B
  ctx.translate(currentX, currentY);
  ctx.rotate(angle + Math.PI / 2);

  // Filter / Feathering
  if (feather && feather > 0) {
    ctx.filter = `blur(${feather}px)`;
  }

  // Check if custom uploaded image or preset image exists
  if (sheenImageElement && sheenImageElement.complete && sheenImageElement.naturalWidth > 0) {
    // Draw user's uploaded sheen image / texture
    const imgAspect = sheenImageElement.naturalHeight / (sheenImageElement.naturalWidth || 1);
    const drawW = bandWidth * 2;
    const drawH = drawW * imgAspect;
    ctx.drawImage(sheenImageElement, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    // Draw linear gradient shine band
    const halfW = bandWidth / 2;
    const grad = ctx.createLinearGradient(-halfW, 0, halfW, 0);

    const preset = SHEEN_PRESETS[colorPreset] || SHEEN_PRESETS.gold;
    if (colorPreset === 'custom' && customColor) {
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, customColor);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      preset.stops.forEach(s => grad.addColorStop(s.offset, s.color));
    }

    ctx.fillStyle = grad;
    const lengthCover = Math.hypot(width, height) * 2;
    ctx.fillRect(-halfW, -lengthCover / 2, bandWidth, lengthCover);
  }

  ctx.restore();
};

/**
 * Generate ExtendScript (.jsx) for Adobe After Effects to create the exact Sheen Image Layer with Control Points
 */
export const generateAfterEffectsSheenJsx = (config: FrameSheenConfig, compWidth = 1080, compHeight = 1080): string => {
  const ax = (config.pointA.x * compWidth).toFixed(1);
  const ay = (config.pointA.y * compHeight).toFixed(1);
  const bx = (config.pointB.x * compWidth).toFixed(1);
  const by = (config.pointB.y * compHeight).toFixed(1);
  const w = config.width;
  const speed = config.speed;
  const opacity = (config.opacity * 100).toFixed(0);

  return `// =========================================================
// Adobe After Effects - Integrated Frame Sheen Image Layer Generator
// Compatible with After Effects CC 2018 - CC 2025+
// =========================================================

(function() {
  var comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) {
    alert("⚠️ يرجى تحديد التركيب (Composition) أولاً في أفترافكت.");
    return;
  }

  app.beginUndoGroup("Create Integrated Frame Sheen Layer");

  var compWidth = comp.width;
  var compHeight = comp.height;

  // 1. Create Solid Layer for Sheen Effect
  var sheenLayer = comp.layers.addSolid([1, 1, 1], "✨ Integrated Frame Sheen (طبقة لمعة الإطار)", compWidth, compHeight, comp.pixelAspect, comp.duration);
  
  // Set Blending Mode
  ${config.blendMode === 'ADD' ? 'sheenLayer.blendingMode = BlendingMode.ADD;' : ''}
  ${config.blendMode === 'SCREEN' ? 'sheenLayer.blendingMode = BlendingMode.SCREEN;' : ''}
  ${config.blendMode === 'OVERLAY' ? 'sheenLayer.blendingMode = BlendingMode.OVERLAY;' : ''}
  sheenLayer.opacity.setValue(${opacity});

  // 2. Add Interactive Control Points Effects to Layer
  var ptA = sheenLayer.Effects.addProperty("ADBE Point Control");
  ptA.name = "Point A (بداية مسار اللمعة)";
  ptA.property("Point").setValue([${ax}, ${ay}]);

  var ptB = sheenLayer.Effects.addProperty("ADBE Point Control");
  ptB.name = "Point B (نهاية مسار اللمعة)";
  ptB.property("Point").setValue([${bx}, ${by}]);

  var widthEffect = sheenLayer.Effects.addProperty("ADBE Slider Control");
  widthEffect.name = "Sheen Width (عرض اللمعة)";
  widthEffect.property("Slider").setValue(${w});

  var speedEffect = sheenLayer.Effects.addProperty("ADBE Slider Control");
  speedEffect.name = "Sweep Speed Sec (السرعة بالثواني)";
  speedEffect.property("Slider").setValue(${speed});

  // 3. Add Ramp / Sweep Effect
  try {
    var ramp = sheenLayer.Effects.addProperty("ADBE Ramp");
    ramp.property("Start of Ramp").setValue([${ax}, ${ay}]);
    ramp.property("End of Ramp").setValue([${bx}, ${by}]);
    ramp.property("Ramp Shape").setValue(1); // Linear Ramp
    
    // Animate Start and End of Ramp using Expression tied to Point Controls
    var expr = 'var pA = effect("Point A (بداية مسار اللمعة)")("Point");\\n' +
               'var pB = effect("Point B (نهاية مسار اللمعة)")("Point");\\n' +
               'var speed = effect("Sweep Speed Sec (السرعة بالثواني)")("Slider");\\n' +
               'var t = (time % speed) / speed;\\n' +
               'pA + (pB - pA) * t;';
    
    ramp.property("Start of Ramp").expression = expr;
  } catch(e) {
    // Alternative universal wipe fallback
    var wipe = sheenLayer.Effects.addProperty("ADBE Linear Wipe");
    wipe.property("Transition Completion").expression = '(time % effect("Sweep Speed Sec (السرعة بالثواني)")("Slider")) / effect("Sweep Speed Sec (السرعة بالثواني)")("Slider") * 100;';
  }

  app.endUndoGroup();
  alert("🎉 تم إنشاء طبقة لمعة الإطار بنجاح مع نقاط التحكم التفاعلية (Point A & Point B)!");
})();
`;
};

interface IntegratedFrameSheenControlProps {
  config: FrameSheenConfig;
  onChange: (newConfig: FrameSheenConfig) => void;
  previewImageSrc?: string | null;
  onExportJsx?: () => void;
}

export const IntegratedFrameSheenControl: React.FC<IntegratedFrameSheenControlProps> = ({
  config,
  onChange,
  previewImageSrc,
  onExportJsx
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [activeHandle, setActiveHandle] = useState<'A' | 'B' | 'C' | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [copiedJsx, setCopiedJsx] = useState(false);
  const [activeTab, setActiveTab] = useState<'points' | 'image' | 'style' | 'ae'>('points');

  // Handle uploading custom sheen image
  const handleSheenImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        onChange({
          ...config,
          enabled: true,
          sheenType: 'image',
          sheenImageUrl: url,
          sheenImageElement: img
        });
      };
      img.src = url;
    }
  };

  // Preload sheen texture image
  useEffect(() => {
    if (config.sheenImageUrl && !config.sheenImageElement) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        onChange({ ...config, sheenImageElement: img });
      };
      img.src = config.sheenImageUrl;
    }
  }, [config.sheenImageUrl]);

  // Handle Dragging Control Points on Canvas Overlay
  const handlePointerDown = (handle: 'A' | 'B' | 'C') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeHandle === 'A') {
      onChange({ ...config, pointA: { x: rx, y: ry } });
    } else if (activeHandle === 'B') {
      onChange({ ...config, pointB: { x: rx, y: ry } });
    } else if (activeHandle === 'C') {
      onChange({ ...config, pointC: { x: rx, y: ry } });
      const ax = config.pointA.x * rect.width;
      const ay = config.pointA.y * rect.height;
      const bx = config.pointB.x * rect.width;
      const by = config.pointB.y * rect.height;
      const cx = rx * rect.width;
      const cy = ry * rect.height;

      const distLine = Math.hypot(bx - ax, by - ay);
      if (distLine > 1) {
        const perpDist = Math.abs((by - ay) * cx - (bx - ax) * cy + bx * ay - by * ax) / distLine;
        onChange({ ...config, pointC: { x: rx, y: ry }, width: Math.max(10, Math.round(perpDist * 2)) });
      }
    }
  }, [activeHandle, config, onChange]);

  const handlePointerUp = useCallback(() => {
    setActiveHandle(null);
  }, []);

  // Animation Loop for Canvas Preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    const render = (now: number) => {
      const timeSec = (now - startTime) / 1000;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Draw background preview image or dark frame placeholder
      if (previewImageSrc) {
        const img = new Image();
        img.src = previewImageSrc;
        if (img.complete) {
          ctx.drawImage(img, 0, 0, w, h);
        }
      } else {
        // Subtle frame contour placeholder
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 6;
        ctx.strokeRect(12, 12, w - 24, h - 24);
      }

      // Render Sheen Effect
      if (config.enabled) {
        drawFrameSheenOnCanvas(ctx, w, h, config, isPlaying ? timeSec : 0.5);
      }

      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [config, previewImageSrc, isPlaying]);

  const copyJsxScript = () => {
    const jsx = generateAfterEffectsSheenJsx(config);
    navigator.clipboard.writeText(jsx);
    setCopiedJsx(true);
    setTimeout(() => setCopiedJsx(false), 2500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl max-w-4xl mx-auto space-y-6">
      {/* SINGLE BUTTON TOGGLE & BAR FOR THE LAYER */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-indigo-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 rounded-xl text-slate-950 font-black shadow-lg shadow-amber-500/30">
            <Sparkles className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              طبقة لمعة الإطار المدمجة
              {config.enabled && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                  مميّزة ونشطة ✨
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-300">
              زر واحد لتفعيل طبقة اللمعة المدمجة للقطعة مع صورة اللمعة ونقاط التحكم التفاعلية A و B
            </p>
          </div>
        </div>

        {/* SINGLE TOGGLE BUTTON */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange({ ...config, enabled: !config.enabled })}
            className={`px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 shadow-xl active:scale-95 ${
              config.enabled
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-400/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {config.enabled ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            <span>{config.enabled ? '✨ طبقة اللمعة مفعلة' : 'إضافة طبقة اللمعة للإطار'}</span>
          </button>

          {/* Upload Shine Image Button */}
          <label className="cursor-pointer px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl text-xs font-bold text-amber-300 flex items-center gap-2 transition-all">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>رفع صورة اللمعة</span>
            <input type="file" accept="image/*" onChange={handleSheenImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Interactive Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Canvas Preview & Interactive Control Points Handle Overlay */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div
            ref={containerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full aspect-square max-w-[420px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner select-none touch-none group"
          >
            {/* Canvas Render */}
            <canvas
              ref={canvasRef}
              width={500}
              height={500}
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Interactive Control Handles Overlay */}
            {config.enabled && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {/* Connecting Line between Point A & Point B */}
                <line
                  x1={`${config.pointA.x * 100}%`}
                  y1={`${config.pointA.y * 100}%`}
                  x2={`${config.pointB.x * 100}%`}
                  y2={`${config.pointB.y * 100}%`}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="opacity-80"
                />
              </svg>
            )}

            {/* Draggable Handle A (Start Point) */}
            {config.enabled && (
              <div
                onPointerDown={handlePointerDown('A')}
                style={{
                  left: `${config.pointA.x * 100}%`,
                  top: `${config.pointA.y * 100}%`
                }}
                className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group-hover:scale-110 transition-transform ${
                  activeHandle === 'A' ? 'scale-125 z-30' : ''
                }`}
                title="نقطة البداية (Point A)"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-rose-500/90 border-2 border-white shadow-xl flex items-center justify-center text-white font-black text-xs">
                    A
                  </div>
                  <span className="absolute -bottom-6 bg-rose-950/90 text-rose-300 text-[10px] px-1.5 py-0.5 rounded font-mono border border-rose-800 whitespace-nowrap">
                    بداية اللمعة
                  </span>
                </div>
              </div>
            )}

            {/* Draggable Handle B (End Point) */}
            {config.enabled && (
              <div
                onPointerDown={handlePointerDown('B')}
                style={{
                  left: `${config.pointB.x * 100}%`,
                  top: `${config.pointB.y * 100}%`
                }}
                className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group-hover:scale-110 transition-transform ${
                  activeHandle === 'B' ? 'scale-125 z-30' : ''
                }`}
                title="نقطة النهاية (Point B)"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/90 border-2 border-white shadow-xl flex items-center justify-center text-slate-950 font-black text-xs">
                    B
                  </div>
                  <span className="absolute -bottom-6 bg-cyan-950/90 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded font-mono border border-cyan-800 whitespace-nowrap">
                    الاتجاه والنهاية
                  </span>
                </div>
              </div>
            )}

            {/* Draggable Handle C (Width & Spread Control) */}
            {config.enabled && (
              <div
                onPointerDown={handlePointerDown('C')}
                style={{
                  left: `${config.pointC.x * 100}%`,
                  top: `${config.pointC.y * 100}%`
                }}
                className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing group-hover:scale-110 transition-transform ${
                  activeHandle === 'C' ? 'scale-125 z-30' : ''
                }`}
                title="مقبض عرض اللمعة (Width Handle)"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-slate-950 shadow-xl flex items-center justify-center text-slate-950 font-black text-[10px]">
                    W
                  </div>
                  <span className="absolute -bottom-6 bg-amber-950/90 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono border border-amber-800 whitespace-nowrap">
                    عرض المسار ({config.width}px)
                  </span>
                </div>
              </div>
            )}

            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-mono text-slate-300 border border-slate-700/50">
              اسحب النقاط A و B مباشرة لضبط اتجاه اللمعة
            </div>
          </div>
        </div>

        {/* Controls Side Panel */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {/* Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'points' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              نقاط التحكم
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'image' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              صورة اللمعة
            </button>
            <button
              onClick={() => setActiveTab('style')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'style' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              المظهر
            </button>
            <button
              onClick={() => setActiveTab('ae')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'ae' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              أفترافكت
            </button>
          </div>

          {/* Tab: Custom Sheen Image */}
          {activeTab === 'image' && (
            <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <label className="text-xs font-bold text-amber-300 block mb-1">صورة اللمعة والشاين المدمجة:</label>
              
              <label className="cursor-pointer block border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl p-4 text-center bg-amber-500/5 transition-all">
                <Upload className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">رفع صورة شاين خاصة (PNG مع شفافية)</span>
                <span className="text-[10px] text-slate-400">تُمج الصورة وتتحرك مباشرة عبر مسار النقاط A و B</span>
                <input type="file" accept="image/*" onChange={handleSheenImageUpload} className="hidden" />
              </label>

              {/* Procedural Preset Textures */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">أو اختر صورة لمعة جاهزة:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SHEEN_PRESETS) as Array<keyof typeof SHEEN_PRESETS>).slice(0, 5).map((pKey) => {
                    const preset = SHEEN_PRESETS[pKey];
                    return (
                      <button
                        key={pKey}
                        onClick={() => {
                          const texUrl = createProcedureShineTexture(pKey, preset.color);
                          const img = new Image();
                          img.onload = () => {
                            onChange({
                              ...config,
                              enabled: true,
                              colorPreset: pKey,
                              sheenImageUrl: texUrl,
                              sheenImageElement: img
                            });
                          };
                          img.src = texUrl;
                        }}
                        className={`p-2 rounded-lg text-[10px] font-bold transition-all border flex flex-col items-center gap-1 ${
                          config.colorPreset === pKey
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: preset.color }} />
                        <span>{preset.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Control Points Numbers */}
          {activeTab === 'points' && (
            <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              {/* Point A */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-rose-400 flex items-center justify-between">
                  <span>🔴 نقطة البداية Point A (X, Y)</span>
                  <span className="font-mono text-slate-400">
                    ({(config.pointA.x * 100).toFixed(0)}%, {(config.pointA.y * 100).toFixed(0)}%)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.pointA.x}
                    onChange={(e) => onChange({ ...config, pointA: { ...config.pointA, x: parseFloat(e.target.value) } })}
                    className="accent-rose-500"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.pointA.y}
                    onChange={(e) => onChange({ ...config, pointA: { ...config.pointA, y: parseFloat(e.target.value) } })}
                    className="accent-rose-500"
                  />
                </div>
              </div>

              {/* Point B */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-cyan-400 flex items-center justify-between">
                  <span>🔵 نقطة النهاية والاتجاه Point B (X, Y)</span>
                  <span className="font-mono text-slate-400">
                    ({(config.pointB.x * 100).toFixed(0)}%, {(config.pointB.y * 100).toFixed(0)}%)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.pointB.x}
                    onChange={(e) => onChange({ ...config, pointB: { ...config.pointB, x: parseFloat(e.target.value) } })}
                    className="accent-cyan-500"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.pointB.y}
                    onChange={(e) => onChange({ ...config, pointB: { ...config.pointB, y: parseFloat(e.target.value) } })}
                    className="accent-cyan-500"
                  />
                </div>
              </div>

              {/* Band Width Slider */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-amber-400 flex items-center justify-between">
                  <span>🟡 عرض النطاق واللمعة (Sheen Width)</span>
                  <span className="font-mono text-slate-400">{config.width}px</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="250"
                  step="2"
                  value={config.width}
                  onChange={(e) => onChange({ ...config, width: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Reset to Defaults */}
              <button
                onClick={() => onChange(DEFAULT_FRAME_SHEEN_CONFIG)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة ضبط النقاط الافتراضية
              </button>
            </div>
          )}

          {/* Tab 2: Style & Speed */}
          {activeTab === 'style' && (
            <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              {/* Speed Slider */}
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1">
                  <span>سرعة الحركة (زمن الدورة)</span>
                  <span className="font-mono text-slate-400">{config.speed}ث</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.1"
                  value={config.speed}
                  onChange={(e) => onChange({ ...config, speed: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Opacity */}
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-1">
                  <span>شدة التوهج والشفافية (Opacity)</span>
                  <span className="font-mono text-slate-400">{Math.round(config.opacity * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.opacity}
                  onChange={(e) => onChange({ ...config, opacity: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Blend Mode */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">وضع الدمج (Blend Mode):</label>
                <select
                  value={config.blendMode}
                  onChange={(e) => onChange({ ...config, blendMode: e.target.value as any })}
                  className="w-full bg-slate-900 text-white p-2 rounded-lg border border-slate-800 text-xs font-bold"
                >
                  <option value="ADD">ADD (توهج ساطع)</option>
                  <option value="SCREEN">SCREEN (شاشة ناعمة)</option>
                  <option value="OVERLAY">OVERLAY (تراكب متناسق)</option>
                  <option value="HARD_LIGHT">HARD LIGHT (ضوء قاطِع)</option>
                </select>
              </div>
            </div>
          )}

          {/* Tab 3: After Effects Integration */}
          {activeTab === 'ae' && (
            <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
                ✨ يتم تصدير صورة اللمعة المدمجة مع نقاط التحكم (Point A & Point B Controls) تلقائياً داخل برنامج <strong>Adobe After Effects</strong>!
              </div>

              <button
                onClick={copyJsxScript}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                {copiedJsx ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedJsx ? 'تم نسخ كود سكريبت AE!' : 'نسخ كود سكريبت After Effects (.jsx)'}
              </button>

              {onExportJsx && (
                <button
                  onClick={onExportJsx}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  تحميل سكريبت أفترافكت المباشر (.jsx)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
