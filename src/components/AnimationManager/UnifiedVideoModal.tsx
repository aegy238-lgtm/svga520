import React, { useState } from 'react';
import {
  X, Film, Play, Download, Clock, Sliders, CheckCircle2,
  AlertCircle, Sparkles, Layers, Palette, Eye, Video, HelpCircle
} from 'lucide-react';
import { AnimationItem, UnifiedVideoOptions } from './types';
import { exportUnifiedMp4Video, downloadBlob } from './utils/exportEngine';
import { FeatureInfoModal } from './FeatureInfoModal';

interface UnifiedVideoModalProps {
  items: AnimationItem[];
  onClose: () => void;
}

const RESOLUTION_OPTIONS = [
  { id: 'square_hd', label: 'مربع HD (1080 × 1080)', width: 1080, height: 1080, desc: 'مثالي لإنستغرام والملصقات والعروض' },
  { id: 'vertical_reels', label: 'عمودي Reels / Shorts (1080 × 1920)', width: 1080, height: 1920, desc: 'مثالي لتيك توك وريلز والقصص' },
  { id: 'horizontal_fhd', label: 'أفقي Full HD (1920 × 1080)', width: 1920, height: 1080, desc: 'مثالي لليوتيوب وشاشات العرض' },
  { id: 'square_sd', label: 'مربع قياسي (720 × 720)', width: 720, height: 720, desc: 'حجم ملف خفيف وسريع المعالجة' }
];

export const UnifiedVideoModal: React.FC<UnifiedVideoModalProps> = ({
  items,
  onClose
}) => {
  const [durationMode, setDurationMode] = useState<'original' | 'custom'>('original');
  const [durationPerItem, setDurationPerItem] = useState<number>(3); // 3 seconds default per effect
  const [selectedResId, setSelectedResId] = useState<string>('square_hd');
  const [fps, setFps] = useState<number>(30);
  const [backgroundColor, setBackgroundColor] = useState<string>('#000000');
  const [showItemName, setShowItemName] = useState<boolean>(true);
  const [transitionType, setTransitionType] = useState<'cut' | 'crossfade'>('crossfade');
  const [layoutMode, setLayoutMode] = useState<'sequential' | 'stacked_vertical' | 'grid_simultaneous'>('sequential');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<number>(80);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; desc: string }>({
    isOpen: false,
    title: '',
    desc: ''
  });

  const [exportProgress, setExportProgress] = useState<{
    percentage: number;
    currentName: string;
    currentIndex: number;
    totalItems: number;
    renderedFrames: number;
    totalFrames: number;
  }>({
    percentage: 0,
    currentName: '',
    currentIndex: 0,
    totalItems: items.length,
    renderedFrames: 0,
    totalFrames: 0
  });

  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string>('');
  const [totalVideoDurationSec, setTotalVideoDurationSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRes = RESOLUTION_OPTIONS.find((r) => r.id === selectedResId) || RESOLUTION_OPTIONS[0];
  const originalTotalSeconds = Math.max(1, Math.round(
    items.reduce((sum, item) => sum + (item.duration > 0 ? item.duration : 3), 0)
  ));

  let calculatedTotalSeconds = durationMode === 'original'
    ? originalTotalSeconds
    : Math.round(durationPerItem * items.length);

  if (layoutMode === 'stacked_vertical' || layoutMode === 'grid_simultaneous') {
    calculatedTotalSeconds = durationMode === 'original' 
      ? Math.max(1, Math.round(Math.max(...items.map(i => i.duration > 0 ? i.duration : 3))))
      : Math.max(1, Math.round(durationPerItem));
  }

  const handleStartRendering = async () => {
    setIsExporting(true);
    setErrorMessage(null);

    const options: UnifiedVideoOptions = {
      durationMode,
      durationPerItemSec: durationPerItem,
      fps,
      resolution: {
        width: selectedRes.width,
        height: selectedRes.height,
        label: selectedRes.label
      },
      backgroundColor,
      showItemName,
      transitionType,
      transitionDurationSec: transitionType === 'crossfade' ? 0.35 : 0,
      layoutMode,
      backgroundImageUrl,
      compressionLevel
    };

    try {
      const result = await exportUnifiedMp4Video(items, options, (p) => {
        setExportProgress(p);
      });

      const videoUrl = URL.createObjectURL(result.blob);
      setGeneratedVideoUrl(videoUrl);
      setGeneratedBlob(result.blob);
      setGeneratedFilename(result.filename);
      setTotalVideoDurationSec(result.durationSec);
    } catch (err: any) {
      console.error('Unified video creation failed:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء معالجة ورندر الفيديو الموحد.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (generatedBlob) {
      downloadBlob(generatedBlob, generatedFilename || `unified_animations_${items.length}.mp4`);
    }
  };

  const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBackgroundImageUrl(url);
    }
  };

  return (
    <div
      onClick={!isExporting ? onClose : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0b101d] border border-white/15 shadow-2xl overflow-hidden font-arabic"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#080c16]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>إنشاء فيديو MP4 موحد يجمع الحركات</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {items.length} حركة
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                دمج كافة التأثيرات والأنيميشن في فيديو واحد متصل مع ضبط مدة كل حركة
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* If Result Ready */}
          {generatedVideoUrl && !isExporting ? (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="w-full rounded-2xl overflow-hidden bg-black border border-cyan-500/30 shadow-2xl flex flex-col items-center">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full max-h-[380px] object-contain"
                />
              </div>

              {/* Video stats */}
              <div className="grid grid-cols-3 gap-3 w-full text-center">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col">
                  <span className="text-[11px] text-gray-400">المدة الكلية للفيديو:</span>
                  <span className="text-base font-bold text-cyan-400 font-mono">
                    {totalVideoDurationSec} ثانية
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col">
                  <span className="text-[11px] text-gray-400">عدد الحركات المدمجة:</span>
                  <span className="text-base font-bold text-white font-mono">{items.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col">
                  <span className="text-[11px] text-gray-400">حجم الفيديو:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {generatedBlob ? `${(generatedBlob.size / (1024 * 1024)).toFixed(2)} MB` : '-'}
                  </span>
                </div>
              </div>

              {/* Success Badge */}
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>تم دمج ورندر كافة الحركات في فيديو MP4 موحد بنجاح وبأعلى جودة وسلاسة!</span>
              </div>
            </div>
          ) : isExporting ? (
            /* Progress State */
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
                <Film className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">جاري تجميع ورندر فيديو MP4 الموحد...</h4>
                <p className="text-xs text-gray-400 font-mono">
                  {exportProgress.currentName || 'جاري تجهيز الإطارات...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs text-gray-300">
                  <span className="text-cyan-400 font-bold">{exportProgress.percentage}%</span>
                  <span>
                    عنصر {exportProgress.currentIndex} من {exportProgress.totalItems}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-200 shadow-md shadow-cyan-500/50"
                    style={{ width: `${exportProgress.percentage}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 font-mono">
                  إطارات الفيديو: {exportProgress.renderedFrames} / {exportProgress.totalFrames}
                </p>
              </div>
            </div>
          ) : (
            /* Settings Form */
            <div className="space-y-6">
              {/* Selected Items Thumbnails Strip */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>الحركات المشمولة في الفيديو ({items.length}):</span>
                  </span>
                  <span className="text-gray-400 text-[11px]">
                    سيتم عرضها تتابعياً واحدة تلو الأخرى
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto p-2 rounded-2xl bg-black/40 border border-white/10 scrollbar-thin">
                  {items.map((itm, idx) => (
                    <div
                      key={itm.id}
                      className="flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10"
                    >
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <img
                        src={itm.previewUrl}
                        alt={itm.name}
                        className="w-7 h-7 rounded-lg object-contain bg-black/40"
                      />
                      <span className="text-xs text-white max-w-[90px] truncate">{itm.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Duration Setting (The Core User Request) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-blue-950/30 to-purple-950/30 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <label className="text-xs font-black text-white">
                      طريقة تحديد مدة الحركات في الفيديو:
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {calculatedTotalSeconds}
                    </span>
                    <span className="text-xs text-gray-400">ثانية إجمالية</span>
                  </div>
                </div>

                {/* Duration Mode Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setDurationMode('original')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      durationMode === 'original'
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>المدة الأصلية لكل حركة (موصى به)</span>
                    <span className="text-[10px] opacity-85 font-normal">عرض كل الفريمات والتأثيرات بالكامل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('custom')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${
                      durationMode === 'custom'
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>مدة موحدة مخصصة</span>
                    <span className="text-[10px] opacity-85 font-normal">تحديد ثوانٍ ثابتة لكل حركة</span>
                  </button>
                </div>

                {durationMode === 'original' ? (
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-200 leading-relaxed">
                    ✨ <strong>وضع الاحتراف الكامل:</strong> سيتم تصدير كل حركة بكامل إطاراتها وتأثيراتها الأصلية ومدتها الدقيقة المستخرجة من الملف دون أي قص أو تسريع مفاجئ.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">المدة لكل حركة:</span>
                      <span className="text-sm font-bold text-cyan-400 font-mono">{durationPerItem} ثانية</span>
                    </div>
                    {/* Slider */}
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={durationPerItem}
                      onChange={(e) => setDurationPerItem(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer h-2 rounded-lg bg-white/10"
                    />

                    {/* Quick presets */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-gray-400">اختصارات سريعة:</span>
                      {[2, 3, 4, 5, 8].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setDurationPerItem(sec)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            durationPerItem === sec
                              ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                          }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live total video duration indicator */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-300">إجمالي مدة الفيديو الناتج:</span>
                  <span className="text-cyan-300 font-mono">
                    {calculatedTotalSeconds} ثانية ({Math.floor(calculatedTotalSeconds / 60)}:{(calculatedTotalSeconds % 60).toString().padStart(2, '0')})
                  </span>
                </div>
              </div>

              {/* Resolution selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>دقة وأبعاد الفيديو:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedResId(opt.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col gap-1 ${
                        selectedResId === opt.id
                          ? 'bg-cyan-500/15 border-cyan-400 shadow-md shadow-cyan-500/10'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{opt.label}</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            selectedResId === opt.id
                              ? 'border-cyan-400 bg-cyan-400 text-black'
                              : 'border-white/30'
                          }`}
                        >
                          {selectedResId === opt.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400">{opt.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Background Color & Overlay Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Background color & Image */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-cyan-400" />
                    <span>خلفية الفيديو:</span>
                  </label>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-9 h-9 rounded-xl border border-white/20 bg-transparent cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] text-gray-300">لون ثابت للخلفية</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <label className="text-[11px] text-gray-400 cursor-pointer hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                        <span>أو ارفع صورة خلفية...</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleBackgroundImageUpload} />
                      </label>
                      {backgroundImageUrl && (
                        <button 
                          onClick={() => setBackgroundImageUrl(null)}
                          className="text-[10px] text-red-400 hover:text-red-300 underline"
                        >
                          إزالة الصورة
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Framerate FPS & Compression */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-cyan-400" />
                    <span>معدل الإطارات (FPS):</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {[30, 60].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFps(f)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                          fps === f
                            ? 'bg-cyan-500 text-black shadow'
                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                        }`}
                      >
                        {f} FPS
                      </button>
                    ))}
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-gray-300 flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setInfoModal({
                        isOpen: true,
                        title: 'مستوى الضغط (Compression)',
                        desc: 'يتحكم في جودة وحجم الملف الناتج.\n\n• نسبة 0% (حجم أصغر): يتم تطبيق ضغط عالي لتقليل مساحة الملف، مما قد يقلل من الجودة قليلاً.\n• نسبة 100% (جودة أعلى): يتم الاحتفاظ بجودة وألوان الملف الأصلي بدون فقدان، ولكن ينتج عنه ملف بحجم أكبر.\n\nيعمل هذا الخيار بكفاءة مع صيغ MP4, WebP, SVGA, وغيرها لتوفير التوازن المثالي بين الجودة والحجم.'
                      })}>
                        <span>جودة الضغط (Compression):</span>
                        <HelpCircle className="w-3.5 h-3.5 text-cyan-500/70" />
                      </label>
                      <span className="text-[11px] font-mono text-cyan-400">{compressionLevel}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={compressionLevel}
                      onChange={(e) => setCompressionLevel(Number(e.target.value))}
                      className="w-full accent-cyan-500 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-gray-500 px-1 mt-1">
                      <span>حجم أصغر</span>
                      <span>جودة أعلى (أصلي)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout & Transition Type Settings */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                
                {/* Video Layout Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5 mb-2 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setInfoModal({
                    isOpen: true,
                    title: 'طريقة دمج وعرض الحركات (Layout Mode)',
                    desc: 'يحدد كيفية ترتيب الحركات في الفيديو النهائي:\n\n1. متتالي (Sequential): يقوم بتشغيل الحركات واحدة تلو الأخرى (مثل نظام العروض التقديمية). الخيار الكلاسيكي لدمج الفيديوهات.\n\n2. مدمج رأسي (Stacked Vertical): يعرض جميع الحركات فوق بعضها البعض بشكل طولي في نفس الوقت. ممتاز لمقارنة التأثيرات.\n\n3. شبكي مدمج (Grid): يعرض جميع الحركات متجاورة في نظام شبكة مربعة (مثل مكالمات زووم) في نفس الوقت.'
                  })}>
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>طريقة دمج وعرض الحركات (Layout Mode):</span>
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-500/70 ml-1" />
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <div
                      onClick={() => setLayoutMode('sequential')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        layoutMode === 'sequential'
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-sm'
                          : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">متتالي (كل حاجة لوحدها)</span>
                      <span className="text-[10px] opacity-70">عرض كل حركة بمفردها واحدة تلو الأخرى</span>
                    </div>
                    
                    <div
                      onClick={() => setLayoutMode('stacked_vertical')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        layoutMode === 'stacked_vertical'
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-sm'
                          : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">مدمج رأسي (تحت بعض)</span>
                      <span className="text-[10px] opacity-70">دمج جميع الملفات أفقياً فوق بعضها</span>
                    </div>
                    
                    <div
                      onClick={() => setLayoutMode('grid_simultaneous')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        layoutMode === 'grid_simultaneous'
                          ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-sm'
                          : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="text-xs font-bold block mb-1">شبكي مدمج (Grid)</span>
                      <span className="text-[10px] opacity-70">عرض الحركات متجاورة في نفس الوقت</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark badge & Transition toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Watermark */}
                <div
                  onClick={() => setShowItemName(!showItemName)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    showItemName ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">إظهار عنوان الحركة</span>
                    <span className="text-[10px] text-gray-400">شارة أنيقة في أسفل الفيديو بالاسم والترتيب</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      showItemName ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/20'
                    }`}
                  >
                    {showItemName && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>

                {/* Transition */}
                <div
                  onClick={() => setTransitionType(transitionType === 'crossfade' ? 'cut' : 'crossfade')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    transitionType === 'crossfade' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">تلاشي ناعم بين الحركات</span>
                    <span className="text-[10px] text-gray-400">انتقال سلس Crossfade بدلاً من القطع المفاجئ</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      transitionType === 'crossfade' ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/20'
                    }`}
                  >
                    {transitionType === 'crossfade' && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-[#080c16] flex items-center justify-between">
          {generatedVideoUrl ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setGeneratedVideoUrl(null);
                  setGeneratedBlob(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors"
              >
                إعادة ضبط وإنشاء جديد
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل فيديو MP4 الموحد</span>
                </button>
              </div>
            </>
          ) : !isExporting ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleStartRendering}
                className="px-7 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-cyan-500/30 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
              >
                <Film className="w-4 h-4" />
                <span>بدء إنشاء الفيديو الموحد الآن ({calculatedTotalSeconds}s)</span>
              </button>
            </>
          ) : (
            <div className="w-full text-center text-xs text-gray-400 font-mono">
              يرجى الانتظار حتى اكتمال رندر الإطارات وترميز الفيديو...
            </div>
          )}
        </div>
      </div>

      <FeatureInfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        description={infoModal.desc}
        onClose={() => setInfoModal({ ...infoModal, isOpen: false })}
      />
    </div>
  );
};
