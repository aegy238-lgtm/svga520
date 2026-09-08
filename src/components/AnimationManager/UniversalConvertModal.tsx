import React, { useState } from 'react';
import {
  X, RefreshCw, Download, CheckCircle2, AlertCircle,
  Sparkles, Layers, Palette, Sliders, ShieldCheck, ArrowRightLeft, FileCheck, HelpCircle
} from 'lucide-react';
import { AnimationItem, ExportFormat } from './types';
import { exportItem, batchExportToZip, downloadBlob } from './utils/exportEngine';
import { FeatureInfoModal } from './FeatureInfoModal';

interface UniversalConvertModalProps {
  selectedItems: AnimationItem[];
  allItems: AnimationItem[];
  onClose: () => void;
  onRefresh?: () => void;
}

interface FormatOption {
  format: ExportFormat;
  name: string;
  badge: string;
  ext: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: 'svga',
    name: 'صيغة SVGA 2.0',
    badge: 'SVGA',
    ext: '.svga',
    desc: 'صيغة الأنيميشن الفائقة للألعاب وتطبيقات البث المباشر مع دعم كامل للشفافية وتوفير المساحة.',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30'
  },
  {
    format: 'mp4',
    name: 'فيديو MP4 عالي الدقة',
    badge: 'MP4',
    ext: '.mp4',
    desc: 'فيديو H.264 متوافق مع كافة المشغلات ومواقع التواصل ومناسب للعرض التوضيحي.',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    border: 'border-red-500/30'
  },
  {
    format: 'webp',
    name: 'صيغة WebP متحرك',
    badge: 'WEBP',
    ext: '.webp',
    desc: 'صيغة ويب حديثة وفائقة الضغط مع دعم الشفافية وألوان 24 بت حقيقية.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30'
  },
  {
    format: 'gif',
    name: 'صيغة GIF متحرك',
    badge: 'GIF',
    ext: '.gif',
    desc: 'الصيغة التقليدية الشائعة للصور المتحركة مع شفافية وتوافق عالمي.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30'
  },
  {
    format: 'apng',
    name: 'صيغة APNG (Animated PNG)',
    badge: 'APNG',
    ext: '.png',
    desc: 'أعلى دقة نقاء وشفافية ألفا متدرجة 24-bit بدون أي تشوه أو خسارة لونية.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30'
  },
  {
    format: 'png_frames',
    name: 'حزمة إطارات PNG منفصلة',
    badge: 'PNG ZIP',
    ext: '.zip',
    desc: 'أرشيف ZIP يحتوي على كل إطار كصورة PNG مستقلة عالية النقاء مع ملف البيانات.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30'
  },
  {
    format: 'lottie',
    name: 'Lottie JSON',
    badge: 'JSON',
    ext: '.json',
    desc: 'تنسيق متجهي خفيف الوزن للملفات المدعومة من Lottie أو DotLottie.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30'
  },
  {
    format: 'dotlottie',
    name: 'DotLottie Archive',
    badge: '.lottie',
    ext: '.lottie',
    desc: 'حاوية DotLottie فائقة الضغط لمكتبات وأجهزة الجوال.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/15',
    border: 'border-pink-500/30'
  }
];

export const UniversalConvertModal: React.FC<UniversalConvertModalProps> = ({
  selectedItems,
  allItems,
  onClose
}) => {
  const [targetFormat, setTargetFormat] = useState<ExportFormat>('svga');
  const [scope, setScope] = useState<'selected' | 'all'>(selectedItems.length > 0 ? 'selected' : 'all');
  const [backgroundColor, setBackgroundColor] = useState<string>('#000000');
  const [fps, setFps] = useState<number>(30);
  const [compressionLevel, setCompressionLevel] = useState<number>(80);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    currentName: string;
  }>({
    current: 0,
    total: 0,
    percentage: 0,
    currentName: ''
  });
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; desc: string }>({
    isOpen: false,
    title: '',
    desc: ''
  });

  const activeItems = scope === 'selected' && selectedItems.length > 0 ? selectedItems : allItems;
  const selectedFormatConfig = FORMAT_OPTIONS.find((f) => f.format === targetFormat) || FORMAT_OPTIONS[0];

  const handleStartConversion = async () => {
    if (activeItems.length === 0) return;
    setIsConverting(true);
    setErrorMessage(null);

    try {
      if (activeItems.length === 1) {
        // Single item conversion & direct download
        const item = activeItems[0];
        setProgress({
          current: 1,
          total: 1,
          percentage: 50,
          currentName: item.name
        });

        const { blob, filename } = await exportItem(item, targetFormat, {
          backgroundColor: targetFormat === 'mp4' ? backgroundColor : 'transparent',
          fps,
          quality: 100 - compressionLevel,
          compressionLevel
        });

        downloadBlob(blob, filename);
        setProgress((prev) => ({ ...prev, percentage: 100 }));
      } else {
        // Batch conversion & ZIP archive
        const zipName = `svga_studio_${targetFormat}_bundle`;
        const blob = await batchExportToZip(
          activeItems,
          {
            format: targetFormat,
            backgroundColor: targetFormat === 'mp4' ? backgroundColor : 'transparent',
            fps,
            quality: 100 - compressionLevel,
            compressionLevel,
            scale: 1,
            zipFileName: zipName,
            deduplicateBeforeExport: false
          },
          (p) => setProgress(p)
        );

        downloadBlob(blob, `${zipName}.zip`);
      }
      setIsCompleted(true);
    } catch (err: any) {
      console.error('Universal conversion failed:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تحويل الصيغ.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div
      onClick={!isConverting ? onClose : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0b101d] border border-white/15 shadow-2xl overflow-hidden font-arabic"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#080c16]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>محول الصيغ الشامل (تحويل أي صيغة إلى أي صيغة)</span>
              </h3>
              <p className="text-xs text-gray-400">
                تحويل فوري فائق الجودة بين صيغ SVGA و MP4 و WebP و GIF و APNG و Lottie
              </p>
            </div>
          </div>

          {!isConverting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {!isConverting && !isCompleted && (
            <>
              {/* Target Selection & Scope */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">نطاق الملفات المراد تحويلها:</span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScope('selected')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        scope === 'selected'
                          ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      الملفات المحددة فقط ({selectedItems.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      scope === 'all'
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    كافة الملفات المرفوعة ({allItems.length})
                  </button>
                </div>
              </div>

              {/* Target Format Grid */}
              <div className="space-y-3">
                <label className="text-xs font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>اختر الصيغة المستهدفة للتحويل إليها:</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FORMAT_OPTIONS.map((f) => (
                    <div
                      key={f.format}
                      onClick={() => setTargetFormat(f.format)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 relative ${
                        targetFormat === f.format
                          ? `${f.bg} ${f.border} shadow-lg ring-1 ring-cyan-400/40`
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${f.color}`}>{f.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-gray-300">
                            {f.ext}
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            targetFormat === f.format
                              ? 'bg-cyan-400 border-cyan-400 text-black'
                              : 'border-white/30'
                          }`}
                        >
                          {targetFormat === f.format && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-300 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Settings for Specific Formats */}
              {targetFormat === 'mp4' && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-red-400" />
                    <span>لون خلفية الفيديو عند تحويل الأنيميشن الشفاف:</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 rounded-xl border border-white/20 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-white font-bold">{backgroundColor}</span>
                    <span className="text-[11px] text-gray-400">
                      (ضروري لأن صيغة MP4 لا تدعم قنوات الشفافية Alpha Channel)
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setInfoModal({
                    isOpen: true,
                    title: 'مستوى ضغط الملفات (Compression)',
                    desc: 'يتحكم في جودة وحجم الملف الناتج.\n\n• نسبة 0% (حجم أصغر): يتم تطبيق ضغط عالي لتقليل مساحة الملف، مما قد يقلل من الجودة قليلاً.\n• نسبة 100% (جودة أعلى): يتم الاحتفاظ بجودة وألوان الملف الأصلي بدون فقدان، ولكن ينتج عنه ملف بحجم أكبر.\n\nيعمل هذا الخيار بكفاءة مع صيغ MP4, WebP, SVGA, وغيرها لتوفير التوازن المثالي بين الجودة والحجم.'
                  })}>
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>مستوى ضغط الملفات (Compression):</span>
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-500/70 ml-1" />
                  </label>
                  <span className="text-[11px] font-mono text-cyan-400">{100 - compressionLevel}% جودة</span>
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
                  <span>حجم أصغر (ضغط عالي)</span>
                  <span>جودة أعلى (ضغط منخفض)</span>
                </div>
              </div>
            </>
          )}

          {/* Progress Display */}
          {isConverting && (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <ArrowRightLeft className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">
                  جاري تحويل الملفات إلى صيغة {selectedFormatConfig.badge}...
                </h4>
                <p className="text-xs text-gray-400 font-mono">
                  {progress.currentName || 'جاري استخراج وتحويل الإطارات...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs text-gray-300">
                  <span className="text-indigo-400 font-bold">{progress.percentage}%</span>
                  <span>
                    {progress.current} من {progress.total}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 transition-all duration-300 shadow-md shadow-indigo-500/50"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">تم تحويل وتنزيل الملفات بنجاح!</h4>
                <p className="text-xs text-gray-400 max-w-md">
                  تم تحويل {activeItems.length} ملف إلى صيغة {selectedFormatConfig.name} بدقة وأعلى جودة.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 bg-[#080c16] flex items-center justify-between">
          {!isConverting && !isCompleted ? (
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
                onClick={handleStartConversion}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-cyan-600 hover:from-indigo-400 hover:to-cyan-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>
                  بدء التحويل إلى {selectedFormatConfig.badge} ({activeItems.length} ملف)
                </span>
              </button>
            </>
          ) : isCompleted ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all"
            >
              إغلاق
            </button>
          ) : (
            <div className="w-full text-center text-xs text-gray-400 font-mono">
              جاري معالجة التحويل... يرجى الانتظار
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
