import React, { useState } from 'react';
import { 
  X, Download, Layers, CheckCircle2, AlertCircle, 
  Archive, ShieldCheck, Sparkles, Palette, Settings2, HelpCircle 
} from 'lucide-react';
import { AnimationItem, BatchExportOptions, ExportFormat } from './types';
import { batchExportToZip, downloadBlob } from './utils/exportEngine';
import { FeatureInfoModal } from './FeatureInfoModal';

interface BatchExportModalProps {
  selectedItems: AnimationItem[];
  onClose: () => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  selectedItems,
  onClose
}) => {
  const [format, setFormat] = useState<ExportFormat>('original');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [compressionLevel, setCompressionLevel] = useState(80);
  const [deduplicate, setDeduplicate] = useState(true);
  const [zipName, setZipName] = useState('animations_bundle');
  const [isExporting, setIsExporting] = useState(false);
  const [infoModal, setInfoModal] = useState<{ isOpen: boolean; title: string; desc: string }>({
    isOpen: false,
    title: '',
    desc: ''
  });
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
    currentName: string;
  }>({
    current: 0,
    total: selectedItems.length,
    percentage: 0,
    currentName: ''
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);

    const options: BatchExportOptions = {
      format,
      backgroundColor: format === 'mp4' ? backgroundColor : 'transparent',
      fps: 30,
      quality: 100 - compressionLevel,
      compressionLevel,
      scale: 1,
      zipFileName: zipName.trim() || 'animations_bundle',
      deduplicateBeforeExport: deduplicate
    };

    try {
      const zipBlob = await batchExportToZip(selectedItems, options, (p) => {
        setProgress(p);
      });

      downloadBlob(zipBlob, `${options.zipFileName}.zip`);
      setIsCompleted(true);
    } catch (err: any) {
      console.error('Batch export failed:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء تجميع وتحزيم الملفات.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      onClick={!isExporting ? onClose : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in"
      dir="rtl"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-[#0b101d] border border-white/15 shadow-2xl p-6 sm:p-8 flex flex-col gap-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white font-arabic">
                التصدير الجماعي المضغوط (ZIP)
              </h3>
              <p className="text-xs text-gray-400 font-arabic">
                تصدير {selectedItems.length} ملف محدد داخل أرشيف منظم
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Options */}
        {!isExporting && !isCompleted && (
          <div className="flex flex-col gap-4 font-arabic">
            {/* Target Format */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300 font-bold">صيغة الملفات المصدرة:</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="w-full bg-[#070b14] border border-white/15 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-cyan-400"
              >
                <option value="original">الصيغة الأصلية لكل ملف (Original)</option>
                <option value="svga">صيغة SVGA 2.0 (.svga - تحويل ذكي للتأثيرات والتطبيقات)</option>
                <option value="webp">WebP متحرك</option>
                <option value="apng">APNG (عالي الجودة مع شفافية ألفا)</option>
                <option value="png_frames">حزم إطارات PNG (PNG Frames ZIP)</option>
                <option value="lottie">Lottie JSON (لملفات Lottie و DotLottie)</option>
                <option value="dotlottie">DotLottie (.lottie)</option>
                <option value="mp4">فيديو MP4</option>
              </select>
            </div>

            {/* Compression Slider */}
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-300 font-bold flex items-center gap-1.5 cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => setInfoModal({
                    isOpen: true,
                    title: 'مستوى ضغط الملفات (Compression)',
                    desc: 'يتحكم في جودة وحجم الملف الناتج.\n\n• نسبة 0% (حجم أصغر): يتم تطبيق ضغط عالي لتقليل مساحة الملف، مما قد يقلل من الجودة قليلاً.\n• نسبة 100% (جودة أعلى): يتم الاحتفاظ بجودة وألوان الملف الأصلي بدون فقدان، ولكن ينتج عنه ملف بحجم أكبر.\n\nيعمل هذا الخيار بكفاءة مع صيغ MP4, WebP, SVGA, وغيرها لتوفير التوازن المثالي بين الجودة والحجم.'
                  })}>
                  <span>مستوى ضغط الملفات (Compression):</span>
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-500/70" />
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

            {/* Background color for MP4 */}
            {format === 'mp4' && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
                <label className="text-xs text-gray-300">لون خلفية الفيديو للشفافية:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-gray-300">{backgroundColor}</span>
                  <span className="text-[11px] text-gray-400">
                    (يحل محل الشفافية لأن MP4 لا يدعم ألفا)
                  </span>
                </div>
              </div>
            )}

            {/* Deduplication Toggle */}
            <div
              onClick={() => setDeduplicate(!deduplicate)}
              className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">
                    منع تكرار الملفات في الحزمة
                  </span>
                  <span className="text-[10px] text-gray-400">
                    فحص Content Hash لضمان عدم تكرار أي ملف متطابق داخل الأرشيف
                  </span>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  deduplicate ? 'bg-cyan-500 border-cyan-400 text-black' : 'border-white/20'
                }`}
              >
                {deduplicate && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
              </div>
            </div>

            {/* Archive Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-300 font-bold">اسم ملف الـ ZIP:</label>
              <input
                type="text"
                value={zipName}
                onChange={(e) => setZipName(e.target.value)}
                placeholder="animations_bundle"
                className="w-full bg-[#070b14] border border-white/15 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        )}

        {/* Progress Display */}
        {isExporting && (
          <div className="flex flex-col gap-4 py-4 font-arabic">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold">{progress.currentName}</span>
              <span className="text-cyan-400 font-mono font-bold">{progress.percentage}%</span>
            </div>

            {/* Bar */}
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-gray-400">
              <span>جاري المعالجة والتحزيم...</span>
              <span>
                {progress.current} من {progress.total}
              </span>
            </div>
          </div>
        )}

        {/* Completed State */}
        {isCompleted && (
          <div className="flex flex-col items-center gap-3 py-6 text-center font-arabic">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-white">تم تصدير وتنزيل الحزمة بنجاح!</h4>
            <p className="text-xs text-gray-400 max-w-sm">
              تم إنشاء ملف الـ ZIP وحفظ كافة الملفات بدقة وجودة عالية وبدون تكرار.
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 font-arabic">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          {!isExporting && !isCompleted && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold font-arabic transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleStartExport}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold font-arabic shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>بدء التصدير المضغوط</span>
              </button>
            </>
          )}

          {isCompleted && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold font-arabic transition-all"
            >
              إغلاق
            </button>
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
