import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, Shield, X, Upload, Trash2, Check, RefreshCw, 
  RotateCw, Sliders, Palette, Type, Image as ImageIcon, Sparkles, 
  LayoutGrid, Grid, Eye, Pin, Star, Move, Zap, FastForward, Rewind,
  Layers, Disc, Award, CornerUpRight
} from 'lucide-react';
import { 
  ViewerWatermarkSettings, 
  ViewerWatermarkPattern, 
  ViewerWatermarkShape,
  ViewerWatermarkType, 
  ViewerWatermarkPosition 
} from './MultiSvgaViewer';

interface MultiSvgaWatermarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ViewerWatermarkSettings;
  onSave: (newSettings: ViewerWatermarkSettings) => void;
  watermarkLogo: string | null;
  onLogoChange: (url: string | null) => void;
}

const COLOR_PRESETS = [
  { name: 'أبيض نقي', hex: '#ffffff' },
  { name: 'ذهبي VIP', hex: '#f59e0b' },
  { name: 'سماوي نيون', hex: '#06b6d4' },
  { name: 'أحمر تحذيري', hex: '#ef4444' },
  { name: 'زمردي أخضر', hex: '#10b981' },
  { name: 'بنفسجي ملكي', hex: '#a855f7' },
  { name: 'فضي معدني', hex: '#94a3b8' },
  { name: 'أسود فحمي', hex: '#0a0a0a' },
];

const SHAPE_PRESETS: { id: ViewerWatermarkShape; label: string; desc: string; icon: string }[] = [
  { id: 'pill', label: 'كبسولة بيضاوية', desc: 'تصميم انسيابي ناعم ومدور', icon: '💊' },
  { id: 'glass_card', label: 'بطاقة زجاجية بلورية', desc: 'زجاج شفاف متطور مع ضبابية', icon: '🪟' },
  { id: 'neon_glow', label: 'نيون سايبر متوهج', desc: 'إطار متوهج ساطع مع إضاءة حيوية', icon: '⚡' },
  { id: 'futuristic_hud', label: 'درع مستقبلي HUD', desc: 'تصميم تقني سايبربانك محكم', icon: '🛡️' },
  { id: 'stamp_seal', label: 'ختم دائري رسمي', desc: 'ختم حماية الحقوق الموثق', icon: '💮' },
  { id: 'ribbon_badge', label: 'شريط زاوية احترافي', desc: 'شريط جانبي مائل أنيق', icon: '🏷️' },
  { id: 'golden_vip', label: 'وسام ذهبي ملكي', desc: 'تدرج ذهبي فاخر لكبار الأعضاء', icon: '👑' },
  { id: 'minimal_clean', label: 'نص ناصع بدون إطار', desc: 'نقاء تام بدون أي خلفية أو إطار', icon: '✨' },
];

const SPEED_PRESETS = [
  { speed: 1, label: '0.25x بطيء جداً 🐌', factor: 1 },
  { speed: 2, label: '0.5x هادئ 🐢', factor: 2 },
  { speed: 4, label: '1x متوازن ⚡', factor: 4 },
  { speed: 6, label: '1.5x متوسط 🚀', factor: 6 },
  { speed: 8, label: '2.5x سريع ⚡', factor: 8 },
  { speed: 10, label: '4x فائق 🌪️', factor: 10 },
];

export const MultiSvgaWatermarkModal: React.FC<MultiSvgaWatermarkModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  watermarkLogo,
  onLogoChange,
}) => {
  const [localSettings, setLocalSettings] = useState<ViewerWatermarkSettings>({ 
    shape: 'pill',
    pattern: 'smooth_right_glide',
    ...settings 
  });
  const [previewBgTheme, setPreviewBgTheme] = useState<'dark' | 'grid' | 'light'>('dark');
  const [isDraggingBadge, setIsDraggingBadge] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const previewCanvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pinnedName, setPinnedName] = useState<string>(() => {
    try {
      return localStorage.getItem('svga_permanent_watermark_text') || 'Ahmed SVGA • Ahmed SVGA';
    } catch (e) {
      return 'Ahmed SVGA • Ahmed SVGA';
    }
  });

  const [savedPresets, setSavedPresets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('svga_saved_watermark_presets');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return ['Ahmed SVGA • Ahmed SVGA', '🔒 محتوى محمي - يمنع السرقة', 'SVGA AHMED STUDIO'];
  });

  const [pinToast, setPinToast] = useState<string | null>(null);

  const handlePinPermanent = () => {
    const text = localSettings.text.trim();
    if (!text) return;
    try {
      localStorage.setItem('svga_permanent_watermark_text', text);
      setPinnedName(text);
      setPinToast(`✓ تم تثبيت "${text}" كاسم دائم لك بنجاح!`);
      setTimeout(() => setPinToast(null), 3500);
    } catch (e) {}
  };

  const handleSaveToPresets = () => {
    const text = localSettings.text.trim();
    if (!text || savedPresets.includes(text)) return;
    const updated = [text, ...savedPresets].slice(0, 10);
    setSavedPresets(updated);
    try {
      localStorage.setItem('svga_saved_watermark_presets', JSON.stringify(updated));
      setPinToast(`✓ تمت إضافة "${text}" إلى قائمتك السريعة`);
      setTimeout(() => setPinToast(null), 3000);
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({ 
        shape: 'pill',
        pattern: 'smooth_right_glide',
        ...settings 
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onLogoChange(url);
      setLocalSettings(prev => ({
        ...prev,
        logoUrl: url,
        type: prev.type === 'text' ? 'both' : prev.type
      }));
    }
  };

  const handleFileDropOnCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      onLogoChange(url);
      setLocalSettings(prev => ({
        ...prev,
        logoUrl: url,
        type: prev.type === 'text' ? 'both' : prev.type
      }));
      setPinToast('✓ تم إدراج الشعار بالسحب والإفلات بنجاح!');
      setTimeout(() => setPinToast(null), 3000);
    }
  };

  const handleCanvasDragBadge = (clientX: number, clientY: number) => {
    if (!previewCanvasRef.current) return;
    setIsDraggingBadge(true);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!previewCanvasRef.current) return;
      const rect = previewCanvasRef.current.getBoundingClientRect();
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const pctX = Math.max(5, Math.min(95, ((curX - rect.left) / rect.width) * 100));
      const pctY = Math.max(5, Math.min(95, ((curY - rect.top) / rect.height) * 100));

      setLocalSettings(prev => ({
        ...prev,
        pattern: 'custom_drag',
        customX: Math.round(pctX),
        customY: Math.round(pctY)
      }));
    };

    const onEnd = () => {
      setIsDraggingBadge(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const handleRemoveLogo = () => {
    onLogoChange(null);
    setLocalSettings(prev => ({
      ...prev,
      logoUrl: null,
      type: prev.type === 'both' ? 'text' : 'text'
    }));
  };

  const handleApply = () => {
    try {
      localStorage.setItem('svga_watermark_settings', JSON.stringify(localSettings));
      if (localSettings.text && localSettings.text.trim()) {
        localStorage.setItem('svga_permanent_watermark_text', localSettings.text.trim());
      }
    } catch (e) {}
    onSave(localSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    const defaultSettings: ViewerWatermarkSettings = {
      enabled: true,
      type: 'text',
      text: 'Ahmed SVGA • Ahmed SVGA',
      logoUrl: null,
      shape: 'pill',
      pattern: 'smooth_right_glide',
      position: 'bottom-right',
      customX: 75,
      customY: 80,
      opacity: 0.45,
      fontSize: 22,
      color: '#ffffff',
      angle: -25,
      spacingX: 200,
      spacingY: 120,
      shadow: true,
      isAnimated: true,
      animationSpeed: 4,
      speed: 4
    };
    setLocalSettings(defaultSettings);
    onLogoChange(null);
  };

  const activeLogo = localSettings.logoUrl || watermarkLogo;
  const currentSpeed = localSettings.animationSpeed || localSettings.speed || 4;

  const getShapeClasses = (shapeType: ViewerWatermarkShape) => {
    switch (shapeType) {
      case 'glass_card':
        return 'px-4 py-2 rounded-2xl backdrop-blur-xl border border-white/20 font-black text-xs shadow-2xl bg-slate-950/80';
      case 'neon_glow':
        return 'px-4 py-2 rounded-2xl border-2 font-black text-xs bg-slate-950/90 shadow-[0_0_20px_rgba(6,182,212,0.7)]';
      case 'futuristic_hud':
        return 'px-4 py-2 rounded-lg border-x-4 border-y font-mono font-black text-xs tracking-widest bg-slate-950/90';
      case 'stamp_seal':
        return 'px-4 py-2 rounded-full border-2 border-dashed font-black text-xs -rotate-3 bg-amber-950/90';
      case 'ribbon_badge':
        return 'px-4 py-2 rounded-lg border-r-4 border-l border-y font-black text-xs bg-indigo-950/90';
      case 'golden_vip':
        return 'px-4 py-2 rounded-2xl border border-amber-400 font-black text-xs bg-gradient-to-r from-amber-950/90 via-black/90 to-amber-950/90 shadow-[0_0_20px_rgba(245,158,11,0.45)] text-amber-200';
      case 'minimal_clean':
        return 'p-1 font-black text-xs';
      case 'pill':
      default:
        return 'flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-2xl font-black text-xs tracking-wide bg-slate-950/85';
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-4xl bg-[#090e1c] border border-cyan-500/40 rounded-[2rem] shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden flex flex-col max-h-[92vh] text-right"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                استوديو العلامة المائية وحماية العرض المتعدد
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                  Multi-Shape & Smooth 3D 🌊
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                حماية عروض وتصدير حركات SVGA والفيديو بنمط ثلاثي الأبعاد سلس وسحب وإفلات وتحكم كامل بالسرعة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 custom-scrollbar">

          {/* Top Live Interactive Preview Box with Drag & Drop Canvas */}
          <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-slate-950 p-4 shadow-inner">
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  معاينة حية ومباشرة (اسحب العلامة لتغيير موضعها بحرية 🎯)
                </span>
                {localSettings.pattern === 'custom_drag' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                    موضع مخصص: X: {localSettings.customX || 75}% | Y: {localSettings.customY || 80}%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setPreviewBgTheme('dark')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${previewBgTheme === 'dark' ? 'bg-cyan-500/30 text-cyan-300' : 'text-slate-400'}`}
                >
                  داكن
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBgTheme('grid')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${previewBgTheme === 'grid' ? 'bg-cyan-500/30 text-cyan-300' : 'text-slate-400'}`}
                >
                  شبكي
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBgTheme('light')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${previewBgTheme === 'light' ? 'bg-cyan-500/30 text-cyan-300' : 'text-slate-400'}`}
                >
                  فاتح
                </button>
              </div>
            </div>

            {/* Preview Viewport Canvas Simulation with Drag & Drop */}
            <div 
              ref={previewCanvasRef}
              onDragOver={(e) => { e.preventDefault(); setIsDragOverCanvas(true); }}
              onDragLeave={() => setIsDragOverCanvas(false)}
              onDrop={handleFileDropOnCanvas}
              className={`relative w-full h-48 sm:h-56 rounded-xl overflow-hidden border transition-all flex items-center justify-center select-none ${
                isDragOverCanvas ? 'border-cyan-400 bg-cyan-950/30 ring-2 ring-cyan-500/50' : 'border-white/10'
              } ${
                previewBgTheme === 'dark' ? 'bg-[#060a14]' :
                previewBgTheme === 'grid' ? 'bg-[#0f172a] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]' :
                'bg-slate-200'
              }`}
            >
              {/* Simulated Dummy Content Behind Watermark */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse mb-1" />
                <span className="text-sm font-bold text-slate-400">SVGA Animation Preview</span>
              </div>

              {/* Drag & Drop File Indicator */}
              {isDragOverCanvas && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-cyan-950/80 backdrop-blur-sm text-cyan-200 text-xs font-black gap-2">
                  <Upload className="w-5 h-5 animate-bounce" />
                  <span>أفلت صورة الشعار هنا لتعيينها كشعار للعلامة المائية!</span>
                </div>
              )}

              {/* Watermark Rendering Keyframes */}
              <style>{`
                @keyframes wmModalSmoothGlide {
                  0% { transform: translateX(120%) translateY(0px) rotateY(-18deg) rotateZ(-2deg); opacity: 0.2; }
                  15% { opacity: ${localSettings.opacity}; }
                  50% { transform: translateX(0%) translateY(-12px) rotateY(0deg) rotateZ(0deg); opacity: ${localSettings.opacity}; }
                  85% { opacity: ${localSettings.opacity}; }
                  100% { transform: translateX(-120%) translateY(8px) rotateY(18deg) rotateZ(2deg); opacity: 0.2; }
                }
                @keyframes wmModalWave3D {
                  0% { transform: translateX(110%) translateY(15px) scale(0.85); }
                  50% { transform: translateX(0%) translateY(-20px) scale(1.1); }
                  100% { transform: translateX(-110%) translateY(15px) scale(0.85); }
                }
                @keyframes wmModalOrbit {
                  0% { transform: translate(-50%, -50%) rotate(0deg) translateX(80px) rotate(0deg); }
                  100% { transform: translate(-50%, -50%) rotate(360deg) translateX(80px) rotate(-360deg); }
                }
                @keyframes wmModalGridDrift {
                  0% { transform: rotate(${localSettings.angle}deg) translate(0px, 0px); }
                  50% { transform: rotate(${localSettings.angle}deg) translate(-35px, -20px); }
                  100% { transform: rotate(${localSettings.angle}deg) translate(-70px, -45px); }
                }
                @keyframes wmModalMarquee {
                  0% { transform: translateX(0); }
                  100% { transform: translateX(-90px); }
                }
              `}</style>

              {localSettings.enabled ? (
                /* 1. Smooth Right Glide */
                localSettings.pattern === 'smooth_right_glide' ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                      className="will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
                      style={{
                        animation: localSettings.isAnimated !== false ? `wmModalSmoothGlide ${Math.max(2, 16 - currentSpeed * 1.3)}s ease-in-out infinite` : 'none',
                        perspective: '600px'
                      }}
                      onMouseDown={(e) => handleCanvasDragBadge(e.clientX, e.clientY)}
                      onTouchStart={(e) => handleCanvasDragBadge(e.touches[0].clientX, e.touches[0].clientY)}
                      title="انزلاق سلس ثلاثي الأبعاد من اليمين • اسحب لتحديد موضع حر"
                    >
                      <div 
                        className={getShapeClasses(localSettings.shape || 'pill')}
                        style={{
                          borderColor: `${localSettings.color}60`,
                          color: localSettings.color,
                          opacity: localSettings.opacity
                        }}
                      >
                        {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                          <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                        )}
                        {(localSettings.type === 'text' || localSettings.type === 'both') && (
                          <span>{localSettings.text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : localSettings.pattern === 'wave_3d' ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                      className="will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
                      style={{
                        animation: localSettings.isAnimated !== false ? `wmModalWave3D ${Math.max(2, 14 - currentSpeed * 1.2)}s ease-in-out infinite` : 'none'
                      }}
                      onMouseDown={(e) => handleCanvasDragBadge(e.clientX, e.clientY)}
                      onTouchStart={(e) => handleCanvasDragBadge(e.touches[0].clientX, e.touches[0].clientY)}
                    >
                      <div 
                        className={getShapeClasses(localSettings.shape || 'pill')}
                        style={{
                          borderColor: `${localSettings.color}60`,
                          color: localSettings.color,
                          opacity: localSettings.opacity
                        }}
                      >
                        {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                          <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                        )}
                        {(localSettings.type === 'text' || localSettings.type === 'both') && (
                          <span>{localSettings.text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : localSettings.pattern === 'circular_orbit' ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                      className="absolute top-1/2 left-1/2 will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
                      style={{
                        animation: localSettings.isAnimated !== false ? `wmModalOrbit ${Math.max(2, 14 - currentSpeed * 1.2)}s linear infinite` : 'none'
                      }}
                      onMouseDown={(e) => handleCanvasDragBadge(e.clientX, e.clientY)}
                      onTouchStart={(e) => handleCanvasDragBadge(e.touches[0].clientX, e.touches[0].clientY)}
                    >
                      <div 
                        className={getShapeClasses(localSettings.shape || 'pill')}
                        style={{
                          borderColor: `${localSettings.color}60`,
                          color: localSettings.color,
                          opacity: localSettings.opacity
                        }}
                      >
                        {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                          <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                        )}
                        {(localSettings.type === 'text' || localSettings.type === 'both') && (
                          <span>{localSettings.text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : localSettings.pattern === 'custom_drag' ? (
                  <div 
                    className="absolute pointer-events-auto cursor-grab active:cursor-grabbing z-40 transition-transform hover:scale-105"
                    style={{
                      left: `${localSettings.customX || 75}%`,
                      top: `${localSettings.customY || 80}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: localSettings.opacity
                    }}
                    onMouseDown={(e) => handleCanvasDragBadge(e.clientX, e.clientY)}
                    onTouchStart={(e) => handleCanvasDragBadge(e.touches[0].clientX, e.touches[0].clientY)}
                    title="موضع حر مخصص (اسحب لتغيير الموضع)"
                  >
                    <div 
                      className={getShapeClasses(localSettings.shape || 'pill')}
                      style={{
                        borderColor: `${localSettings.color}60`,
                        color: localSettings.color
                      }}
                    >
                      {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                        <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                      )}
                      {(localSettings.type === 'text' || localSettings.type === 'both') && (
                        <span>{localSettings.text}</span>
                      )}
                    </div>
                  </div>
                ) : localSettings.pattern === 'diagonal_repeat' ? (
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
                    style={{ opacity: localSettings.opacity }}
                  >
                    <div 
                      className="w-[280%] h-[280%] -translate-x-[30%] -translate-y-[30%] flex flex-col justify-around select-none pointer-events-none"
                      style={{ 
                        transform: `rotate(${localSettings.angle}deg)`,
                        animation: localSettings.isAnimated !== false ? `wmModalGridDrift ${Math.max(2.5, 16 - currentSpeed * 1.2)}s ease-in-out infinite alternate` : 'none'
                      }}
                    >
                      {Array.from({ length: 7 }).map((_, rowIdx) => (
                        <div 
                          key={rowIdx} 
                          className="flex justify-around whitespace-nowrap text-xs font-black tracking-wider"
                          style={{ 
                            transform: rowIdx % 2 === 1 ? 'translateX(40px)' : 'none'
                          }}
                        >
                          {Array.from({ length: 5 }).map((_, colIdx) => (
                            <span 
                              key={colIdx} 
                              className="px-4 py-2 inline-flex items-center gap-1.5"
                              style={{ 
                                color: localSettings.color,
                                textShadow: localSettings.shadow ? '0 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)' : 'none'
                              }}
                            >
                              {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                                <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                              )}
                              {(localSettings.type === 'text' || localSettings.type === 'both') && (
                                <span>{localSettings.text}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : localSettings.pattern === 'horizontal_bands' ? (
                  <div 
                    className="absolute inset-0 flex flex-col justify-around pointer-events-none overflow-hidden"
                    style={{ opacity: localSettings.opacity }}
                  >
                    {Array.from({ length: 4 }).map((_, rowIdx) => (
                      <div 
                        key={rowIdx} 
                        className="flex justify-around whitespace-nowrap text-xs font-black tracking-wider py-1 border-y border-white/5 bg-black/10"
                        style={{ 
                          color: localSettings.color,
                          textShadow: localSettings.shadow ? '0 2px 4px rgba(0,0,0,0.9)' : 'none',
                          animation: localSettings.isAnimated !== false ? `wmModalMarquee ${Math.max(2, 12 - currentSpeed * 0.9)}s linear infinite` : 'none'
                        }}
                      >
                        {Array.from({ length: 4 }).map((_, colIdx) => (
                          <span key={colIdx} className="px-3 inline-flex items-center gap-1.5">
                            {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                              <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                            )}
                            {(localSettings.type === 'text' || localSettings.type === 'both') && (
                              <span>{localSettings.text}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    className="absolute bottom-4 right-4 pointer-events-auto cursor-grab active:cursor-grabbing"
                    style={{ opacity: localSettings.opacity }}
                    onMouseDown={(e) => handleCanvasDragBadge(e.clientX, e.clientY)}
                    onTouchStart={(e) => handleCanvasDragBadge(e.touches[0].clientX, e.touches[0].clientY)}
                  >
                    <div 
                      className={getShapeClasses(localSettings.shape || 'pill')}
                      style={{
                        borderColor: `${localSettings.color}60`,
                        color: localSettings.color
                      }}
                    >
                      {(localSettings.type === 'image' || localSettings.type === 'both') && activeLogo && (
                        <img src={activeLogo} className="w-4 h-4 object-contain inline shrink-0" alt="" />
                      )}
                      {(localSettings.type === 'text' || localSettings.type === 'both') && (
                        <span>{localSettings.text}</span>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center text-slate-500 text-xs font-bold">
                  العلامة المائية معطلة حالياً. قم بتفعيلها أدناه.
                </div>
              )}
            </div>
          </div>

          {/* Master Enable/Disable Bar */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border transition-colors ${localSettings.enabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-white/5'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">تفعيل العلامة المائية والحماية</h4>
                <p className="text-xs text-slate-400">تطبيق العلامة على شاشات العرض والتحميل وتصدير الفيديو وكافة الملفات</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enabled}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-13 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
            </label>
          </div>

          {/* SECTION 1: Multiple Watermark Shapes Selection (كذا شكل للعلامة المائية) */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                أشكال وهياكل العلامة المائية (اختر الشكل المناسب لعلامتك):
              </label>
              <span className="text-[10px] text-cyan-300 font-mono font-bold">8 أشكال مميزة ✨</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SHAPE_PRESETS.map((shapeItem) => (
                <button
                  key={shapeItem.id}
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, shape: shapeItem.id }))}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    (localSettings.shape || 'pill') === shapeItem.id
                      ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md ring-1 ring-cyan-400/50'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{shapeItem.icon}</span>
                    {(localSettings.shape || 'pill') === shapeItem.id && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="font-black text-xs text-white">{shapeItem.label}</div>
                    <div className="text-[9px] text-slate-400 leading-tight mt-0.5">{shapeItem.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2: Dedicated Speed Controls (زر تبطيء وتسريع السرعة) */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-cyan-500/30 space-y-3.5 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Zap className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-white flex items-center gap-2">
                    التحكم في سرعة حركة العلامة المائية ⚡
                    <span className="text-[9px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                      {currentSpeed}x
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    أزرار تبطيء وتسريع السرعة لتناسب وتيرة الفيديو والتصميم
                  </p>
                </div>
              </div>

              {/* Quick - / + Speed Stepper */}
              <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, animationSpeed: Math.max(1, currentSpeed - 1), speed: Math.max(1, currentSpeed - 1) }))}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                  title="تبطيء السرعة 🐢"
                >
                  <Rewind className="w-3.5 h-3.5" />
                  <span>أبطأ (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, animationSpeed: Math.min(10, currentSpeed + 1), speed: Math.min(10, currentSpeed + 1) }))}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 text-xs font-black transition-all cursor-pointer flex items-center gap-1"
                  title="تسريع السرعة 🚀"
                >
                  <span>أسرع (+)</span>
                  <FastForward className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Speed Presets Buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SPEED_PRESETS.map((p) => (
                <button
                  key={p.speed}
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, animationSpeed: p.factor, speed: p.factor }))}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center flex flex-col items-center gap-0.5 ${
                    currentSpeed === p.factor
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white border-cyan-400 font-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                  }`}
                >
                  <span className="text-[11px]">{p.label}</span>
                </button>
              ))}
            </div>

            {/* Continuous Speed Slider */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-300">مؤشر السرعة الدقيق:</span>
                <span className="font-mono text-cyan-400 font-bold">{currentSpeed}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={currentSpeed}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setLocalSettings(prev => ({ ...prev, animationSpeed: val, speed: val }));
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Grid Settings Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Left Column: Type, Text & Logo */}
            <div className="space-y-4">
              {/* Watermark Type Selector */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <label className="block text-xs font-black text-slate-300">نوع محتوى العلامة المائية:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, type: 'text' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      localSettings.type === 'text'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Type className="w-4 h-4" />
                    <span>نص فقط</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, type: 'image' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      localSettings.type === 'image'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>شعار صورة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, type: 'both' }))}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      localSettings.type === 'both'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>نص + شعار</span>
                  </button>
                </div>
              </div>

              {/* Text Input & Quick Presets with Permanent Pin Option */}
              {(localSettings.type === 'text' || localSettings.type === 'both') && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  {pinToast && (
                    <div className="text-xs font-black text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in shadow-md">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{pinToast}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-300">نص العلامة المائية:</label>
                    <span className="text-[10px] text-slate-400">يمكنك تثبيت اسمك دائماً</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={localSettings.text}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, text: e.target.value }))}
                      placeholder="مثال: Ahmed SVGA • Ahmed SVGA"
                      className="flex-1 px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />

                    {/* Permanent Pin Button */}
                    <button
                      type="button"
                      onClick={handlePinPermanent}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                        localSettings.text.trim() === pinnedName.trim()
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                          : 'bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border-white/10 hover:border-amber-400/40'
                      }`}
                      title="تثبيت هذا الاسم كاسمك الافتراضي الدائم في النظام"
                    >
                      <Pin className={`w-3.5 h-3.5 ${localSettings.text.trim() === pinnedName.trim() ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                      <span>{localSettings.text.trim() === pinnedName.trim() ? 'مثبت دائماً ✓' : 'تثبيت 📌'}</span>
                    </button>
                  </div>

                  {/* Text Quick Presets */}
                  <div className="flex flex-wrap gap-1.5 pt-1 items-center">
                    <span className="text-[10px] text-amber-400 font-black flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      الأسماء السريعة:
                    </span>

                    {pinnedName && (
                      <button
                        type="button"
                        onClick={() => setLocalSettings(prev => ({ ...prev, text: pinnedName }))}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                          localSettings.text === pinnedName
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30'
                        }`}
                      >
                        <span>📌 {pinnedName}</span>
                        <span className="text-[8px] px-1 py-0.2 rounded bg-black/40 text-amber-200 font-mono">دائم</span>
                      </button>
                    )}

                    {savedPresets.filter(p => p !== pinnedName).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLocalSettings(prev => ({ ...prev, text: preset }))}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                          localSettings.text === preset
                            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/5'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}

                    {localSettings.text && !savedPresets.includes(localSettings.text) && (
                      <button
                        type="button"
                        onClick={handleSaveToPresets}
                        className="px-2 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold transition-all cursor-pointer"
                      >
                        + حفظ بالقائمة
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Logo Upload Section with Drag & Drop */}
              {(localSettings.type === 'image' || localSettings.type === 'both') && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <label className="block text-xs font-black text-slate-300">شعار العلامة المائية (صورة شفافة PNG):</label>
                  
                  <div className="flex items-center gap-3">
                    {activeLogo ? (
                      <div className="relative p-2 rounded-xl bg-black/40 border border-cyan-500/40 shrink-0">
                        <img src={activeLogo} alt="Logo preview" className="w-12 h-12 object-contain" />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-md cursor-pointer"
                          title="حذف الشعار"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl border border-dashed border-white/20 flex items-center justify-center text-slate-500 shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-black transition-all cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{activeLogo ? 'تغيير الشعار (أو اسحبه وأفلته بالمعاينة)' : 'رفع صورة / شعار PNG شفاف (أو اسحبها)'}</span>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png,image/webp,image/svg+xml,image/*"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Color Presets */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-300">لون وتوهج العلامة المائية:</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">{localSettings.color}</span>
                    <input
                      type="color"
                      value={localSettings.color}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, color: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((col, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLocalSettings(prev => ({ ...prev, color: col.hex }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        localSettings.color.toLowerCase() === col.hex.toLowerCase()
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full border border-black/40 shrink-0" style={{ backgroundColor: col.hex }} />
                      <span>{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Pattern & Motion Modes (كذا وضع وحركة ثلاثية وسلسة) */}
            <div className="space-y-4">

              {/* Pattern Mode Selector */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                <label className="block text-xs font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  أوضاع وحركات العلامة المائية (كذا وضع وحركة):
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {/* 1. Smooth Right Glide (الحركة السلسة ثلاثية الأبعاد من اليمين) */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'smooth_right_glide' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'smooth_right_glide'
                        ? 'bg-gradient-to-r from-cyan-500/30 via-indigo-600/30 to-purple-600/30 text-cyan-200 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <CornerUpRight className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                    <div>
                      <div className="font-black text-white flex items-center gap-1">
                        انزلاق 3D من اليمين 🌊
                        <span className="text-[8px] px-1 rounded bg-cyan-500 text-slate-950 font-bold">فائق السلاسة</span>
                      </div>
                      <div className="text-[9px] text-cyan-300 font-normal">حركة ثلاثية الأبعاد سلسة من اليمين لليسار</div>
                    </div>
                  </button>

                  {/* 2. Drag and Drop Custom Position */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'custom_drag' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'custom_drag'
                        ? 'bg-gradient-to-r from-emerald-500/25 to-cyan-600/25 text-emerald-200 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Move className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-black text-white flex items-center gap-1">
                        موضع حر (سحب وإفلات) 🎯
                      </div>
                      <div className="text-[9px] text-slate-400 font-normal">اسحب العلامة لأي مكان على الشاشة</div>
                    </div>
                  </button>

                  {/* 3. 3D Wave */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'wave_3d' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'wave_3d'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-black">موجة 3D متأرجحة 🌊</div>
                      <div className="text-[9px] text-slate-400 font-normal">تموج عميق مع ميلان بالمنظور</div>
                    </div>
                  </button>

                  {/* 4. Circular Orbit */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'circular_orbit' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'circular_orbit'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-black">مدار فلكي ثلاثي الأبعاد 🪐</div>
                      <div className="text-[9px] text-slate-400 font-normal">دوران بيضاوي بالعمق والمنظور</div>
                    </div>
                  </button>

                  {/* 5. Diagonal Matrix Grid */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'diagonal_repeat' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'diagonal_repeat'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-black">شبكة مصفوفة مائلة 🛡️</div>
                      <div className="text-[9px] text-cyan-300/70 font-normal">الأعلى حماية لمنع السرقة والقص</div>
                    </div>
                  </button>

                  {/* 6. Horizontal Bands */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'horizontal_bands' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'horizontal_bands'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Grid className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div className="font-black">أشرطة أفقية متدفقة 📜</div>
                      <div className="text-[9px] text-slate-400 font-normal">تكرار أفقي سينمائي متصل</div>
                    </div>
                  </button>

                  {/* 7. Floating Bounce */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'floating' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'floating'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                    <div>
                      <div className="font-black">عائم مرتد ناعم 💫</div>
                      <div className="text-[9px] text-slate-400 font-normal">حركة ارتداد ديناميكية بالحواف</div>
                    </div>
                  </button>

                  {/* 8. Fixed Single Position */}
                  <button
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, pattern: 'single_position' }))}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-black text-right transition-all cursor-pointer ${
                      localSettings.pattern === 'single_position'
                        ? 'bg-gradient-to-r from-cyan-500/25 to-indigo-600/25 text-cyan-200 border-cyan-400 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <Sliders className="w-4 h-4 text-pink-400 shrink-0" />
                    <div>
                      <div className="font-black">موقع ثابت محدد 📍</div>
                      <div className="text-[9px] text-slate-400 font-normal">تثبيت دقيق بإحدى الزوايا التسع</div>
                    </div>
                  </button>
                </div>

                {/* If single position, show 9-anchor selector */}
                {localSettings.pattern === 'single_position' && (
                  <div className="pt-2 border-t border-white/5">
                    <label className="block text-[11px] font-bold text-slate-400 mb-2">اختر موقع التثبيت:</label>
                    <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
                      {[
                        { id: 'top-left', label: 'أعلى يسار' },
                        { id: 'top-center', label: 'أعلى وسط' },
                        { id: 'top-right', label: 'أعلى يمين' },
                        { id: 'center-left', label: 'وسط يسار' },
                        { id: 'center', label: 'المنتصف' },
                        { id: 'center-right', label: 'وسط يمين' },
                        { id: 'bottom-left', label: 'أسفل يسار' },
                        { id: 'bottom-center', label: 'أسفل وسط' },
                        { id: 'bottom-right', label: 'أسفل يمين' },
                      ].map(pos => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setLocalSettings(prev => ({ ...prev, position: pos.id as ViewerWatermarkPosition }))}
                          className={`p-2 rounded-lg text-[10px] font-black transition-all cursor-pointer border ${
                            localSettings.position === pos.id
                              ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400'
                              : 'bg-black/30 text-slate-400 border-white/5 hover:bg-white/5'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sliders: Opacity, Angle, Size */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                {/* Opacity Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-300">الشفافية (Opacity):</span>
                    <span className="font-mono text-cyan-400 font-bold">{Math.round(localSettings.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.0"
                    step="0.05"
                    value={localSettings.opacity}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Angle Slider */}
                {localSettings.pattern === 'diagonal_repeat' && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-300">زاوية الميلان (Rotation Angle):</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLocalSettings(prev => ({ ...prev, angle: -25 }))}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-cyan-300 cursor-pointer"
                        >
                          افتراضي (-25°)
                        </button>
                        <span className="font-mono text-cyan-400 font-bold">{localSettings.angle}°</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="90"
                      step="5"
                      value={localSettings.angle}
                      onChange={(e) => setLocalSettings(prev => ({ ...prev, angle: parseInt(e.target.value) }))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                )}

                {/* Font / Size Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-300">حجم الخط والشعار:</span>
                    <span className="font-mono text-cyan-400 font-bold">{localSettings.fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="56"
                    step="2"
                    value={localSettings.fontSize}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {/* Shadow / Glow toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs font-bold text-slate-300">تأثير الظل والتوهج للوضوح فوق أي خلفية:</span>
                  <input
                    type="checkbox"
                    checked={localSettings.shadow}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, shadow: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>استعادة الإعدادات الافتراضية</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تطبيق وحفظ الإعدادات 🔒</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
