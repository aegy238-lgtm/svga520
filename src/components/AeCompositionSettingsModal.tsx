import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Check, Sliders, Play, Clock, Film, Sparkles, Layers,
  Maximize2, ArrowRightLeft, FolderOpen, Zap, FileCode, Upload
} from 'lucide-react';

export interface CompositionSettingsData {
  compName: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec: number;
  importSvgaDirectly: boolean;
}

interface AeCompositionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: Partial<CompositionSettingsData>;
  onApply: (settings: CompositionSettingsData) => void;
  onTransferProject?: (settings: CompositionSettingsData) => void;
}

const PRESET_RESOLUTIONS = [
  { label: '500 × 500 (SVGA قياسي)', width: 500, height: 500 },
  { label: '1080 × 1080 (مربع - إنستغرام)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (عمودي - ريلز/تيك توك)', width: 1080, height: 1920 },
  { label: '1920 × 1080 (أفقي - Full HD)', width: 1920, height: 1080 },
  { label: '720 × 1280 (عمودي - HD)', width: 720, height: 1280 },
  { label: '300 × 300 (أيقونة / شعار)', width: 300, height: 300 },
];

export const AeCompositionSettingsModal: React.FC<AeCompositionSettingsModalProps> = ({
  isOpen,
  onClose,
  initialSettings,
  onApply,
  onTransferProject
}) => {
  const [compName, setCompName] = useState<string>(initialSettings?.compName || 'Comp 1');
  const [width, setWidth] = useState<number>(initialSettings?.width || 500);
  const [height, setHeight] = useState<number>(initialSettings?.height || 500);
  const [fps, setFps] = useState<number>(initialSettings?.fps || 30);
  const [totalFrames, setTotalFrames] = useState<number>(initialSettings?.totalFrames || 90);
  const [durationSec, setDurationSec] = useState<number>(initialSettings?.durationSec || 3.0);
  const [importSvgaDirectly, setImportSvgaDirectly] = useState<boolean>(initialSettings?.importSvgaDirectly ?? true);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
    setCompName(baseName);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setWidth(img.naturalWidth || 500);
        setHeight(img.naturalHeight || 500);
        setIsReadingFile(false);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else if (file.name.toLowerCase().endsWith('.svga')) {
      try {
        const { parseSvgaToProject } = await import('./SvgaLayerEditor/svgaParserEngine');
        const proj = await parseSvgaToProject(file);
        if (proj) {
          setWidth(proj.width || 500);
          setHeight(proj.height || 500);
          setFps(proj.fps || 30);
          setTotalFrames(proj.totalFrames || 90);
          setDurationSec(Number(((proj.totalFrames || 90) / (proj.fps || 30)).toFixed(2)));
        }
      } catch (err) {
        console.error("Failed to parse SVGA in composition settings modal:", err);
      } finally {
        setIsReadingFile(false);
      }
    } else {
      setIsReadingFile(false);
    }
  };

  // Sync Duration <-> Total Frames in real time
  const handleFramesChange = (val: number) => {
    const safeFrames = Math.max(1, val);
    setTotalFrames(safeFrames);
    const calculatedDur = Math.round((safeFrames / (fps || 30)) * 100) / 100;
    setDurationSec(calculatedDur);
  };

  const handleDurationChange = (val: number) => {
    const safeSec = Math.max(0.1, val);
    setDurationSec(safeSec);
    const calculatedFrames = Math.round(safeSec * (fps || 30));
    setTotalFrames(calculatedFrames);
  };

  const handleFpsSelect = (selectedFps: number) => {
    setFps(selectedFps);
    // Keep totalFrames constant and update duration
    const calculatedDur = Math.round((totalFrames / selectedFps) * 100) / 100;
    setDurationSec(calculatedDur);
  };

  const handlePresetSelect = (presetW: number, presetH: number) => {
    setWidth(presetW);
    setHeight(presetH);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialSettings?.compName) setCompName(initialSettings.compName);
      if (initialSettings?.width) setWidth(initialSettings.width);
      if (initialSettings?.height) setHeight(initialSettings.height);
      if (initialSettings?.fps) setFps(initialSettings.fps);
      if (initialSettings?.totalFrames) {
        setTotalFrames(initialSettings.totalFrames);
        setDurationSec(Math.round((initialSettings.totalFrames / (initialSettings.fps || 30)) * 100) / 100);
      } else if (initialSettings?.durationSec) {
        setDurationSec(initialSettings.durationSec);
        setTotalFrames(Math.round(initialSettings.durationSec * (initialSettings.fps || 30)));
      }
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CompositionSettingsData = {
      compName: compName.trim() || 'Comp 1',
      width: Number(width) || 500,
      height: Number(height) || 500,
      fps: Number(fps) || 30,
      totalFrames: Number(totalFrames) || 90,
      durationSec: Number(durationSec) || 3.0,
      importSvgaDirectly
    };
    onApply(data);
    if (onTransferProject) {
      onTransferProject(data);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-[#090d18] border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Top Bar Header */}
          <div className="px-6 py-4 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center font-black text-xs font-mono shadow-sm">
                Ae
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Composition Settings
                </h3>
                <p className="text-[11px] text-slate-400">إعدادات الكومبوزيشن ومقاسات المشروع في After Effects</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1"
            >
              <span>الرئيسية</span>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5 custom-scrollbar max-h-[80vh] overflow-y-auto">
            {/* File Upload Dropzone for auto dimensions & naming */}
            <div className="p-4 bg-purple-950/20 hover:bg-purple-950/30 border-2 border-dashed border-purple-500/40 hover:border-purple-400 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all group relative cursor-pointer min-h-[90px]">
              <input
                type="file"
                accept=".svga,image/*"
                onChange={handleFileImport}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                title=""
              />
              {isReadingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                  <span className="text-[11px] font-bold text-purple-300">جاري قراءة الملف وتحديد المقاسات...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-black text-purple-200">
                    اسحب وأسقط أو اختر ملف (.svga) أو صورة (.png, .jpg)
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    سيتم قراءة الأبعاد والاسم تلقائياً من الملف المرفوع وتطبيقها فوراً في الإعدادات
                  </div>
                </>
              )}
            </div>

            {/* 1. اسم الكومبوزيشن */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">اسم الكومبوزيشن (Comp Name):</label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Comp 1"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-purple-500 focus:outline-none transition-all"
              />
            </div>

            {/* 2. الأبعاد والمقاسات المعتادة */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">الأبعاد (العرض × الارتفاع px):</label>
                <span className="text-[10px] text-indigo-400 font-bold">المقاسات القياسية المعتادة مرتبة</span>
              </div>

              {/* Resolution Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PRESET_RESOLUTIONS.map((preset, idx) => {
                  const isSelected = width === preset.width && height === preset.height;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetSelect(preset.width, preset.height)}
                      className={`p-2 rounded-xl text-[11px] font-bold text-right transition-all border ${
                        isSelected
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-glow-indigo'
                          : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                      }`}
                    >
                      <div className="text-white font-mono text-xs">{preset.width} × {preset.height}</div>
                      <div className="text-[9px] text-slate-400 truncate">{preset.label.split('(')[1]?.replace(')', '') || preset.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Dimension Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">px</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    placeholder="العرض"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pr-4 pl-8 py-2 text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">العرض (Width)</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">px</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    placeholder="الارتفاع"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl pr-4 pl-8 py-2 text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">الارتفاع (Height)</span>
                </div>
              </div>
            </div>

            {/* 3. معدل الفريمات FPS */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">معدل الفريمات (FPS):</label>
              <div className="grid grid-cols-3 gap-2">
                {[24, 30, 60].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleFpsSelect(rate)}
                    className={`py-2 rounded-xl text-xs font-black transition-all border ${
                      fps === rate
                        ? 'bg-purple-600 border-purple-400 text-white shadow-lg'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    FPS {rate}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. عدد الفريمات والمدة الزمنية بالثواني */}
            <div className="bg-slate-950/70 rounded-2xl border border-white/10 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Frames */}
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">
                    عدد الفريمات بالضبط (Total Frames):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={totalFrames}
                      onChange={(e) => handleFramesChange(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-sm font-black text-white focus:border-purple-500 focus:outline-none font-mono"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">فريم</span>
                  </div>
                </div>

                {/* Duration in Seconds */}
                <div>
                  <label className="text-xs font-bold text-slate-200 block mb-1">
                    المدة الزمنية بالثواني (Duration Sec):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      value={durationSec}
                      onChange={(e) => handleDurationChange(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-sm font-black text-emerald-300 focus:border-purple-500 focus:outline-none font-mono"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-emerald-400 font-bold">ثانية</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Summary Banner */}
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs font-bold text-purple-200 flex items-center justify-between">
                <span>المدة الإجمالية المقابلة:</span>
                <span className="font-mono text-emerald-300 font-black">
                  {durationSec} ثانية • {totalFrames} فريم (@ {fps} fps)
                </span>
              </div>
            </div>

            {/* 5. استدعاء ملفات SVGA وفتحها مباشرة داخل AE */}
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 cursor-pointer hover:bg-white/[0.06] transition-all">
              <input
                type="checkbox"
                checked={importSvgaDirectly}
                onChange={(e) => setImportSvgaDirectly(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-purple-400" />
                  <span>استدعاء وتصليح ملفات الـ SVGA داخل After Effects تلقائياً (.svga)</span>
                </span>
                <span className="text-[10px] text-slate-400">تجهيز السكريبت لربط واستدعاء ملف الـ SVGA الأصلي والطبقات مباشرة داخل AE</span>
              </div>
            </label>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4 text-emerald-300" />
                <span>تطبيق التعديلات ونقل المشروع 🚀</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
