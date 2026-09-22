import React, { useState } from 'react';
import { 
  X, Download, Check, AlertCircle, Sparkles, CheckCircle2, 
  Archive, FileText, Film, Layers, Sliders, RefreshCw, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { ProjectSession } from './types';
import { exportEditedSvga } from './svgaExportEngine';
import { renderAllProjectFrames } from './svgaProjectRenderer';
import { 
  exportAsGif, 
  exportAsApng, 
  exportAsWebp, 
  exportAsPngFramesZip, 
  exportAsMp4, 
  exportAsWebm,
  downloadBlob 
} from '../AnimationManager/utils/exportEngine';
import { generateAEProject } from '../../services/aeExportService';

export type BatchExportFormat = 
  | 'SVGA 2.0'
  | 'MP4 (Video)'
  | 'WebP (Animated)'
  | 'GIF (Animation)'
  | 'APNG (Animation)'
  | 'WebM (Transparent)'
  | 'Image Sequence (ZIP)'
  | 'After Effects (ZIP)';

interface SvgaBatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSession[];
  onSuccessToast?: (msg: string) => void;
}

interface ProjectExportStatus {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  message?: string;
  blobSize?: number;
}

export const SvgaBatchExportModal: React.FC<SvgaBatchExportModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSuccessToast
}) => {
  // Selected format
  const [selectedFormat, setSelectedFormat] = useState<BatchExportFormat>('SVGA 2.0');
  
  // Selected projects to export (all selected by default)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => projects.map(p => p.id));
  
  // Output packaging
  const [packageAsZip, setPackageAsZip] = useState<boolean>(true);
  const [zipFileName, setZipFileName] = useState<string>('exported_svga_projects');

  // Status & Progress
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [currentProjectIndex, setCurrentProjectIndex] = useState<number>(0);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectExportStatus>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [finalZipBlob, setFinalZipBlob] = useState<Blob | null>(null);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === projects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(projects.map(p => p.id));
    }
  };

  const toggleSelectProject = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getFormatExtension = (fmt: BatchExportFormat) => {
    switch (fmt) {
      case 'SVGA 2.0': return '.svga';
      case 'MP4 (Video)': return '.mp4';
      case 'WebP (Animated)': return '.webp';
      case 'GIF (Animation)': return '.gif';
      case 'APNG (Animation)': return '.png';
      case 'WebM (Transparent)': return '.webm';
      case 'Image Sequence (ZIP)':
      case 'After Effects (ZIP)': return '.zip';
      default: return '.svga';
    }
  };

  // Run Batch Export
  const handleStartBatchExport = async () => {
    const toExport = projects.filter(p => selectedIds.includes(p.id));
    if (toExport.length === 0) {
      alert('يرجى اختيار مشروع واحد على الأقل للتصدير.');
      return;
    }

    setIsExporting(true);
    setIsCompleted(false);
    setErrorMessage(null);
    setFinalZipBlob(null);

    const statuses: Record<string, ProjectExportStatus> = {};
    toExport.forEach(p => {
      statuses[p.id] = { id: p.id, status: 'pending', progress: 0 };
    });
    setProjectStatuses(statuses);

    const zip = packageAsZip ? new JSZip() : null;
    const ext = getFormatExtension(selectedFormat);

    try {
      for (let i = 0; i < toExport.length; i++) {
        const proj = toExport[i];
        setCurrentProjectIndex(i + 1);

        // Update current project status to processing
        setProjectStatuses(prev => ({
          ...prev,
          [proj.id]: { id: proj.id, status: 'processing', progress: 10, message: 'بدء المعالجة...' }
        }));

        const baseName = proj.name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
        const outFileName = `${baseName}_${i + 1}${ext}`;

        let exportBlob: Blob | null = null;

        if (selectedFormat === 'SVGA 2.0') {
          // Direct SVGA 2.0 Export
          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: { ...prev[proj.id], progress: 50, message: 'تجميع إطارات وبيانات SVGA...' }
          }));

          const res = await exportEditedSvga(
            proj.project,
            proj.layers,
            outFileName,
            {
              fadeConfig: proj.fadeConfig,
              cropConfig: proj.cropConfig,
              cropFeather: proj.cropFeather
            }
          );
          exportBlob = res.blob;

        } else if (selectedFormat === 'After Effects (ZIP)') {
          // After Effects Project
          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: { ...prev[proj.id], progress: 60, message: 'توليد ملفات After Effects...' }
          }));

          const rawImagesData: Record<string, Uint8Array> = {};
          if (proj.project.rawImages) {
            for (const [k, v] of Object.entries(proj.project.rawImages)) {
              if (v instanceof Uint8Array) rawImagesData[k] = v;
              else if ((v as any)?.buffer instanceof ArrayBuffer) rawImagesData[k] = new Uint8Array((v as any).buffer);
            }
          }

          // Generate AE project using the service
          await generateAEProject({
            metadata: {
              name: proj.project.fileName,
              dimensions: { width: proj.project.width, height: proj.project.height },
              fps: proj.project.fps,
              frames: proj.project.totalFrames
            },
            originalWidth: proj.project.width,
            originalHeight: proj.project.height,
            sprites: proj.project.rawMovie?.sprites || [],
            imagesData: rawImagesData,
            previewBg: null,
            audioFile: null,
            audioUrl: null,
            bgPos: { x: 0, y: 0 },
            bgScale: 1,
            setProgress: (p: number) => {
              setProjectStatuses(prev => ({
                ...prev,
                [proj.id]: { ...prev[proj.id], progress: Math.round(p) }
              }));
            }
          });
          // Handled via internal download
        } else {
          // Frame-based formats (MP4, WebP, GIF, APNG, WebM, Image Sequence)
          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: { ...prev[proj.id], progress: 30, message: 'تصيير إطارات الكانفاس والطبقات...' }
          }));

          const rendered = await renderAllProjectFrames(proj.project, proj.layers, {
            fadeConfig: proj.fadeConfig,
            cropConfig: proj.cropConfig,
            cropFeather: proj.cropFeather,
            onProgress: (p) => {
              setProjectStatuses(prev => ({
                ...prev,
                [proj.id]: { ...prev[proj.id], progress: 30 + Math.round(p * 40) }
              }));
            }
          });

          const canvases = rendered.canvases;
          const delays = rendered.delays;
          const width = proj.project.width || 750;
          const height = proj.project.height || 1334;

          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: { ...prev[proj.id], progress: 75, message: 'ترميز الملف النهائي...' }
          }));

          if (selectedFormat === 'GIF (Animation)') {
            exportBlob = await exportAsGif(canvases, delays, width, height);
          } else if (selectedFormat === 'WebP (Animated)') {
            exportBlob = await exportAsWebp(canvases, delays, width, height, 95);
          } else if (selectedFormat === 'APNG (Animation)') {
            exportBlob = await exportAsApng(canvases, delays, width, height);
          } else if (selectedFormat === 'Image Sequence (ZIP)') {
            exportBlob = await exportAsPngFramesZip(canvases, baseName, delays);
          } else if (selectedFormat === 'MP4 (Video)') {
            exportBlob = await exportAsMp4(canvases, delays, width, height, 30, '#000000');
          } else if (selectedFormat === 'WebM (Transparent)') {
            exportBlob = await exportAsWebm(canvases, delays, width, height, 30, 100);
          }
        }

        if (exportBlob) {
          if (zip) {
            zip.file(outFileName, exportBlob);
          } else {
            downloadBlob(exportBlob, outFileName);
          }

          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: {
              id: proj.id,
              status: 'done',
              progress: 100,
              blobSize: exportBlob!.size,
              message: 'تم التصدير بنجاح'
            }
          }));
        } else {
          setProjectStatuses(prev => ({
            ...prev,
            [proj.id]: { id: proj.id, status: 'done', progress: 100, message: 'تم التصدير' }
          }));
        }

        const overall = Math.round(((i + 1) / toExport.length) * 100);
        setOverallProgress(overall);
      }

      // If packaging as ZIP, generate and trigger download
      if (zip) {
        setProjectStatuses(prev => ({
          ...prev,
          zipGenerating: { id: 'zip', status: 'processing', progress: 95, message: 'جاري ضغط ملف ZIP النهائي...' }
        }));

        const generatedZip = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });

        setFinalZipBlob(generatedZip);
        const finalZipName = `${zipFileName.trim() || 'all_projects'}_${selectedFormat.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
        downloadBlob(generatedZip, finalZipName);
      }

      setIsCompleted(true);
      onSuccessToast?.(`🎉 تم تصدير جميع المشاريع (${toExport.length}) بنجاح!`);
    } catch (err: any) {
      console.error('Batch export error:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء التصدير الجماعي.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">تصدير جماعي لكافة المشاريع المفتوحة</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تصدير دفعة واحدة لـ {projects.length} مشاريع بالصيغة التي تختارها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              1. اختر صيغة التصدير المطلوبة لكافة المشاريع:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['SVGA 2.0', 'MP4 (Video)', 'WebP (Animated)', 'GIF (Animation)', 'APNG (Animation)', 'WebM (Transparent)', 'Image Sequence (ZIP)', 'After Effects (ZIP)'] as BatchExportFormat[]).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  disabled={isExporting}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    selectedFormat === fmt
                      ? 'bg-emerald-950/80 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black">{fmt}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{getFormatExtension(fmt)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Packaging Option (ZIP Archive vs Multiple Single Downloads) */}
          <div className="space-y-2 bg-black/30 p-3.5 rounded-2xl border border-white/10">
            <label className="text-xs font-bold text-slate-300 block">
              2. طريقة تسليم الملفات المصدرة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setPackageAsZip(true)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                  packageAsZip
                    ? 'bg-emerald-950/60 border-emerald-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Archive size={16} className={packageAsZip ? 'text-emerald-400' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold block">ملف ZIP مجمع (موصى به)</span>
                  <span className="text-[10px] text-slate-400">تحميل ملف مضغوط واحد يحتوي على كافة المشاريع</span>
                </div>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => setPackageAsZip(false)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                  !packageAsZip
                    ? 'bg-emerald-950/60 border-emerald-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <Download size={16} className={!packageAsZip ? 'text-emerald-400' : 'text-slate-400'} />
                <div>
                  <span className="text-xs font-bold block">تحميل فردي مباشر</span>
                  <span className="text-[10px] text-slate-400">تحميل كل ملف على حدة فور اكتمال تصييره</span>
                </div>
              </button>
            </div>

            {packageAsZip && (
              <div className="pt-2">
                <label className="text-[11px] text-slate-400 block mb-1">اسم حزمة ZIP المجمعة:</label>
                <input
                  type="text"
                  value={zipFileName}
                  disabled={isExporting}
                  onChange={(e) => setZipFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Projects Selection List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                3. اختر المشاريع المراد تصديرها ({selectedIds.length} من {projects.length}):
              </label>
              <button
                type="button"
                disabled={isExporting}
                onClick={toggleSelectAll}
                className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer font-medium"
              >
                {selectedIds.length === projects.length ? 'إلغاء تحديد الكل' : 'تحديد كافة المشاريع'}
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {projects.map((proj, idx) => {
                const isChecked = selectedIds.includes(proj.id);
                const status = projectStatuses[proj.id];

                return (
                  <div
                    key={proj.id}
                    onClick={() => !isExporting && toggleSelectProject(proj.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-white/10 border-indigo-500/40 text-white'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isExporting}
                        onChange={() => toggleSelectProject(proj.id)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-white/20"
                      />
                      <div>
                        <span className="text-xs font-bold block">{proj.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {proj.project.width}×{proj.project.height} • {proj.project.totalFrames} إطار • {proj.layers.length} طبقات
                        </span>
                      </div>
                    </div>

                    {/* Progress / Status Indicator */}
                    {status && (
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        {status.status === 'processing' && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            <span>{status.progress}%</span>
                          </span>
                        )}
                        {status.status === 'done' && (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>مكتمل</span>
                          </span>
                        )}
                        {status.status === 'error' && (
                          <span className="text-rose-400 flex items-center gap-1">
                            <AlertCircle size={14} />
                            <span>فشل</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exporting Progress Bar */}
          {isExporting && (
            <div className="space-y-2 bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-bold flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>جاري تصدير المشروع {currentProjectIndex} من {selectedIds.length}...</span>
                </span>
                <span className="text-emerald-300 font-mono font-bold">{overallProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Completed State Banner */}
          {isCompleted && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span>تم تصدير وتحميل كافة المشاريع بنجاح!</span>
              </div>
              {finalZipBlob && (
                <button
                  type="button"
                  onClick={() => downloadBlob(finalZipBlob, `${zipFileName}.zip`)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={13} />
                  <span>إعادة تحميل الحزمة</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={handleStartBatchExport}
            disabled={isExporting || selectedIds.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all cursor-pointer hover:scale-105"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>جاري معالجة وتصدير المشاريع ({overallProgress}%)...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>بدء التصدير الجماعي الآن ({selectedIds.length} مشاريع)</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
