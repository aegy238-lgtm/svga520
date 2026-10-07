import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, Download, Sparkles, CheckCircle2, AlertCircle, FileCode, 
  Layers, Play, Sliders, Shield, Zap, Film, Image as ImageIcon,
  Check, ArrowDownToLine, Settings2, Hash, RefreshCw, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EditableLayer, SVGAProjectData, FadeConfig, CropConfig, CropFeather } from './types';
import { exportEditedSvga, SvgaCompressionOptions } from './svgaExportEngine';
import { isTransparencyActive } from './transparencyEngine';
import { 
  extractSvgaFrames, 
  exportAsGif, 
  exportAsApng, 
  exportAsWebp, 
  exportAsPngFramesZip, 
  exportAsMp4, 
  exportAsWebm,
  exportAsVap,
  exportAsYyeva,
  exportAsAnimatedSvg,
  exportAsLottie,
  downloadBlob 
} from '../AnimationManager/utils/exportEngine';
import { renderAllProjectFrames } from './svgaProjectRenderer';
import { generateAEProject } from '../../services/aeExportService';
import { mixAudioTracksToBuffer, ExtractedAudioTrack } from '../../utils/svgaVideoAudioExporter';
import { ensureMp3WithId3 } from '../../utils/svgaAudio';
import { backgroundExportManager } from '../../services/backgroundExportManager';

export type ExportFormatType = 
  | 'VAP1.0'
  | 'SVGA 2.0'
  | 'SVGA 2.0 EX'
  | 'SVGA – Animated SVG'
  | 'Lottie (Sequence)'
  | 'AE Project'
  | 'WebM (Video)'
  | 'APNG (Animation)'
  | 'GIF (Animation)'
  | 'Image Sequence'
  | 'SVGA – YYSVA'
  | 'VAP (MP4)'
  | 'VAP 1.0.5'
  | 'WebP (Animated)';

interface SvgaExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: SVGAProjectData;
  layers: EditableLayer[];
  fadeConfig?: FadeConfig;
  cropConfig?: CropConfig;
  cropFeather?: CropFeather;
  onOpenViewer?: (blob: Blob, fileName: string) => void;
  onSuccessToast?: (msg: string) => void;
  initialFormat?: ExportFormatType;
}

export const SvgaExportModal: React.FC<SvgaExportModalProps> = ({
  isOpen,
  onClose,
  project,
  layers,
  fadeConfig,
  cropConfig,
  cropFeather,
  onOpenViewer,
  onSuccessToast,
  initialFormat
}) => {
  // Compression presets & numeric state (Defaults to pristine / uncompressed original quality)
  const [compressionMode, setCompressionMode] = useState<'high' | 'medium' | 'low' | 'custom'>('high');
  const [customQuality, setCustomQuality] = useState<number>(100); // 10 to 100
  const [zlibLevel, setZlibLevel] = useState<number>(6); // 0 to 9
  const [compressImages, setCompressImages] = useState<boolean>(true);
  const [imageFormat, setImageFormat] = useState<'png' | 'webp' | 'jpeg' | 'auto'>('png');
  // VAP channel layout: 'top-right-alpha' puts RGB on left and the white alpha matte in top-right quadrant (Matching exact user screenshot 2432443434.png)
  const [vapLayout, setVapLayout] = useState<'top-right-alpha' | 'left-right' | 'top-bottom' | 'right-left' | 'bottom-top'>('top-right-alpha');

  // Selected format
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatType>(initialFormat || 'SVGA 2.0');

  // File Name
  const [fileNameBase, setFileNameBase] = useState<string>(() => {
    return project.fileName ? project.fileName.replace(/\.svga$/i, '') + '_edited' : 'gift_animation_edited';
  });

  // Exporting status
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportPhase, setExportPhase] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportedSvgaBlob, setExportedSvgaBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [completedExport, setCompletedExport] = useState<{
    blob: Blob;
    fileName: string;
    format: string;
    url: string;
    size: number;
  } | null>(null);

  // Helper to reliably compute file extension for any format
  const getExtForFormat = (fmt: ExportFormatType): string => {
    switch (fmt) {
      case 'SVGA 2.0':
      case 'SVGA 2.0 EX':
        return '.svga';
      case 'VAP1.0':
      case 'VAP (MP4)':
      case 'VAP 1.0.5':
      case 'SVGA – YYSVA':
        return '.mp4';
      case 'AE Project':
      case 'Image Sequence':
        return '.zip';
      case 'Lottie (Sequence)':
        return '.json';
      case 'GIF (Animation)':
        return '.gif';
      case 'APNG (Animation)':
        return '.png';
      case 'WebP (Animated)':
        return '.webp';
      case 'WebM (Video)':
        return '.webm';
      case 'SVGA – Animated SVG':
        return '.svg';
      default:
        return '.svga';
    }
  };

  // Derive target file extension
  const formatExtension = useMemo(() => {
    switch (selectedFormat) {
      case 'SVGA 2.0':
      case 'SVGA 2.0 EX':
        return '.svga';
      case 'VAP1.0':
      case 'VAP (MP4)':
      case 'VAP 1.0.5':
      case 'SVGA – YYSVA':
        return '.mp4';
      case 'AE Project':
      case 'Image Sequence':
        return '.zip';
      case 'Lottie (Sequence)':
        return '.json';
      case 'GIF (Animation)':
        return '.gif';
      case 'APNG (Animation)':
        return '.png';
      case 'WebP (Animated)':
        return '.webp';
      case 'WebM (Video)':
        return '.webm';
      case 'SVGA – Animated SVG':
        return '.svg';
      default:
        return '.svga';
    }
  }, [selectedFormat]);

  const fullFileName = useMemo(() => {
    const clean = fileNameBase.trim() || 'animation_export';
    return clean.endsWith(formatExtension) ? clean : `${clean}${formatExtension}`;
  }, [fileNameBase, formatExtension]);

  // Formats Grid (Matching screenshot layout + prominent VAP1.0 button)
  const formatButtons: { id: ExportFormatType; label: string }[] = [
    { id: 'VAP1.0', label: 'VAP1.0' },
    { id: 'SVGA 2.0', label: 'SVGA 2.0' },
    { id: 'SVGA 2.0 EX', label: 'SVGA 2.0 EX' },
    { id: 'VAP (MP4)', label: 'VAP (MP4)' },
    { id: 'AE Project', label: 'AE Project' },
    { id: 'Lottie (Sequence)', label: 'Lottie (Sequence)' },
    { id: 'WebM (Video)', label: 'WebM (Video)' },
    { id: 'APNG (Animation)', label: 'APNG (Animation)' },
    { id: 'GIF (Animation)', label: 'GIF (Animation)' },
    { id: 'Image Sequence', label: 'Image Sequence' },
    { id: 'SVGA – YYSVA', label: 'SVGA – YYSVA' },
    { id: 'SVGA – Animated SVG', label: 'SVGA – Animated SVG' },
    { id: 'WebP (Animated)', label: 'WebP (Animated)' }
  ];

  // Primary execution handler
  const handleExport = async (formatToExport: ExportFormatType = selectedFormat) => {
    if (isExporting) return;
    setIsExporting(true);
    setErrorMessage(null);
    setCompletedExport(null);
    setProgressPercent(10);
    setExportPhase('جاري معالجة طبقات الهدية والشفافية...');

    const targetExt = getExtForFormat(formatToExport);
    const cleanBase = fileNameBase.trim().replace(/\.[a-zA-Z0-9]+$/, '') || 'animation_export';
    const targetFileName = `${cleanBase}${targetExt}`;

    const finalizeDownload = (outBlob: Blob, phaseTitle: string = 'تم التصدير والتحميل بنجاح!') => {
      const blobUrl = URL.createObjectURL(outBlob);
      setCompletedExport({
        blob: outBlob,
        fileName: targetFileName,
        format: formatToExport,
        url: blobUrl,
        size: outBlob.size
      });

      // 1. Programmatic browser download trigger
      downloadBlob(outBlob, targetFileName);

      // 2. Continuous Background Job sync (persists in GlobalExportWidget & backend)
      backgroundExportManager.registerCompletedJob({
        title: `تصدير ${formatToExport} (${cleanBase})`,
        fileName: targetFileName,
        blob: outBlob
      });

      setProgressPercent(100);
      setExportPhase(`${phaseTitle} ✓`);
      onSuccessToast?.(`تم تصدير ملف ${formatToExport} بنجاح!`);
      setIsExporting(false);
    };

    try {
      // Calculate active compression options - default to level 9 maximum lossless compression
      const activeOptions: SvgaCompressionOptions = {
        mode: compressionMode,
        quality: compressionMode === 'custom' ? customQuality : compressionMode === 'low' ? 60 : compressionMode === 'medium' ? 80 : 100,
        zlibLevel: compressionMode === 'custom' ? zlibLevel : 9,
        compressImages: compressionMode === 'custom' ? compressImages : (compressionMode === 'low' || compressionMode === 'medium'),
        imageFormat: imageFormat
      };

      // 1. Direct SVGA Downloads: Only encode protobuf & zlib when exporting SVGA format directly
      if (formatToExport === 'SVGA 2.0' || formatToExport === 'SVGA 2.0 EX') {
        setProgressPercent(25);
        setExportPhase('جاري ضغط وتحزيم بنية الـ SVGA...');
        const svgaResult = await exportEditedSvga(
          project,
          layers,
          cleanBase,
          { fadeConfig, cropConfig, cropFeather },
          activeOptions
        );

        setExportedSvgaBlob(svgaResult);
        finalizeDownload(svgaResult.blob, 'تم تصدير ملف SVGA بنجاح!');
        return;
      }

      // 2. Handle After Effects Project Export (JSX + manifest.json + assets zip)
      if (formatToExport === 'AE Project') {
        setExportPhase('جاري بناء مشروع After Effects (JSX + Assets)...');
        setProgressPercent(30);

        const rawImagesData: { [key: string]: Uint8Array } = {};
        if (project.rawImages) {
          for (const [k, v] of Object.entries(project.rawImages)) {
            if (v instanceof Uint8Array) rawImagesData[k] = v;
            else if ((v as any)?.buffer instanceof ArrayBuffer) rawImagesData[k] = new Uint8Array((v as any).buffer);
          }
        }

        // Ensure newly added layer images are included in AE assets
        for (const l of layers) {
          if (l.imageKey && !rawImagesData[l.imageKey] && l.thumbnailUrl) {
            if (l.thumbnailUrl.startsWith('data:')) {
              try {
                const b64 = l.thumbnailUrl.includes(',') ? l.thumbnailUrl.split(',')[1] : l.thumbnailUrl;
                const binaryStr = atob(b64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let bi = 0; bi < binaryStr.length; bi++) bytes[bi] = binaryStr.charCodeAt(bi);
                rawImagesData[l.imageKey] = bytes;
              } catch (e) {}
            }
          }
        }

        // Build sprites representing the current layer stack (including all added layers and order)
        // In SVGA 2.0 / AE, sprites[0] is bottom (background), sprites[N-1] is top (foreground).
        const currentSprites = [...layers].filter(l => l.visible).reverse().map((l, sIdx) => {
          if (l.spriteRef && l.spriteRef.frames) {
            const spr = JSON.parse(JSON.stringify(l.spriteRef));
            spr.imageKey = l.imageKey || spr.imageKey || `layer_${sIdx}`;
            if (l.matteKey) spr.matteKey = l.matteKey;
            if (l.blendMode) spr.blendMode = l.blendMode;
            return spr;
          }
          return {
            imageKey: l.imageKey || `layer_${sIdx}`,
            matteKey: l.matteKey,
            blendMode: l.blendMode,
            frames: Array.from({ length: project.totalFrames }, () => ({
              alpha: (l.transform.opacity ?? 100) / 100,
              transform: { a: l.transform.scaleX ?? 1, b: 0, c: 0, d: l.transform.scaleY ?? 1, tx: l.transform.x ?? 0, ty: l.transform.y ?? 0 },
              layout: { x: 0, y: 0, width: l.transform.width, height: l.transform.height }
            }))
          };
        });

        const aeResult = await generateAEProject({
          metadata: {
            name: project.fileName,
            dimensions: { width: project.width, height: project.height },
            fps: project.fps,
            frames: project.totalFrames
          },
          originalWidth: project.width,
          originalHeight: project.height,
          sprites: currentSprites.length > 0 ? currentSprites : (project.rawMovie?.sprites || []),
          imagesData: rawImagesData,
          previewBg: null,
          audioFile: null,
          audioUrl: project.audios?.[0]?.audioKey ? (project.imagesMap?.[project.audios[0].audioKey] || null) : null,
          bgPos: { x: 0, y: 0 },
          bgScale: 1,
          setProgress: (p) => setProgressPercent(30 + Math.round(p * 0.65))
        });

        finalizeDownload(aeResult.zipBlob, 'تم تصدير حزمة After Effects بنجاح!');
        return;
      }

      // 3. Render exact project canvas frames with hardware optimization and progress tracking
      setExportPhase('جاري معالجة وتصيير كافة طبقات الهدية والرسوم...');
      setProgressPercent(10);
      let rendered = await renderAllProjectFrames(project, layers, {
        fadeConfig,
        cropConfig,
        cropFeather,
        onProgress: (p, cur, tot) => {
          setProgressPercent(10 + Math.round(p * 55));
          if (cur && tot) {
            setExportPhase(`تصيير طبقات الهدية: إطار ${cur} من ${tot}...`);
          }
        }
      });

      let canvases = rendered.canvases;
      let delays = rendered.delays;
      let fps = rendered.fps;

      if (!canvases || canvases.length === 0) {
        // Fallback: only encode edited SVGA if frame renderer returned empty
        const fallbackSvga = await exportEditedSvga(
          project,
          layers,
          cleanBase,
          { fadeConfig, cropConfig, cropFeather },
          activeOptions
        );
        const svgaExtracted = await extractSvgaFrames(fallbackSvga.blob);
        canvases = svgaExtracted.canvases;
        delays = svgaExtracted.delays;
        fps = svgaExtracted.fps;
      }

      if (!canvases || canvases.length === 0) {
        throw new Error('لم يتم العثور على إطارات لعرضها للتصدير.');
      }

      // 4. Dedicated export per selected format
      if (formatToExport === 'Image Sequence') {
        setExportPhase('جاري تحزيم إطارات PNG في ملف ZIP...');
        setProgressPercent(75);
        const zipBlob = await exportAsPngFramesZip(canvases, cleanBase, delays);
        finalizeDownload(zipBlob, 'تم تصدير حزمة إطارات PNG بنجاح!');
        return;
      } else if (formatToExport === 'GIF (Animation)') {
        setExportPhase('جاري ترميز صورة GIF المتحركة مع الشفافية وضغط الألوان...');
        setProgressPercent(75);
        const gifBlob = await exportAsGif(canvases, delays, project.width, project.height);
        finalizeDownload(gifBlob, 'تم تصدير صورة GIF المتحركة بنجاح!');
        return;
      } else if (formatToExport === 'APNG (Animation)') {
        setExportPhase('جاري إنشاء صورة APNG فائقة الدقة والشفافية...');
        setProgressPercent(75);
        const apngBlob = await exportAsApng(canvases, delays, project.width, project.height);
        finalizeDownload(apngBlob, 'تم تصدير صورة APNG فائقة الدقة بنجاح!');
        return;
      } else if (formatToExport === 'WebP (Animated)') {
        setExportPhase('جاري تصدير WebP المتحرك فائق الضغط...');
        setProgressPercent(75);
        const webpBlob = await exportAsWebp(
          canvases, 
          delays, 
          project.width, 
          project.height, 
          activeOptions.quality || 100
        );
        finalizeDownload(webpBlob, 'تم تصدير WebP المتحرك بنجاح!');
        return;
      } else if (formatToExport === 'WebM (Video)' || formatToExport === 'VAP1.0' || formatToExport === 'VAP (MP4)' || formatToExport === 'VAP 1.0.5' || formatToExport === 'SVGA – YYSVA') {
        // Extract and mix any audio tracks attached to the SVGA project
        let mixedAudioBuffer: AudioBuffer | null = null;
        try {
          const extractedTracks: ExtractedAudioTrack[] = [];
          if (project.audios && Array.isArray(project.audios)) {
            for (const track of project.audios) {
              const key = track.audioKey;
              let rawBytes: Uint8Array | null = null;
              if (project.rawImages && project.rawImages[key]) {
                const r = project.rawImages[key];
                rawBytes = r instanceof Uint8Array ? r : new Uint8Array((r as any).buffer);
              } else if (project.imagesMap && project.imagesMap[key]) {
                const src = project.imagesMap[key];
                if (typeof src === 'string' && src.startsWith('data:')) {
                  const base64 = src.split(',')[1] || '';
                  const binary = atob(base64);
                  rawBytes = new Uint8Array(binary.length);
                  for (let i = 0; i < binary.length; i++) rawBytes[i] = binary.charCodeAt(i);
                }
              }
              if (rawBytes && rawBytes.length > 0) {
                const startFrame = typeof track.startFrame === 'number' ? Math.max(0, track.startFrame) : 0;
                const endFrame = typeof track.endFrame === 'number' ? Math.min(project.totalFrames, track.endFrame) : project.totalFrames;
                extractedTracks.push({
                  audioKey: key,
                  audioBytes: ensureMp3WithId3(rawBytes),
                  startFrame,
                  endFrame,
                  startTimeSec: startFrame / Math.max(1, fps)
                });
              }
            }
          }
          if (extractedTracks.length > 0) {
            setExportPhase('جاري تجهيز ودمج المسارات الصوتية في ملف الفيديو...');
            setProgressPercent(68);
            mixedAudioBuffer = await mixAudioTracksToBuffer(extractedTracks, {
              durationSec: project.totalFrames / Math.max(1, fps),
              fps: fps,
              loopShorterAudio: true
            });
          }
        } catch (audioErr) {
          console.warn('Audio preparation notice for video export:', audioErr);
        }

        if (formatToExport === 'WebM (Video)') {
          setExportPhase('جاري ترميز فيديو WebM شفاف (VP9 Alpha) بمسرع العتاد...');
          setProgressPercent(70);
          const webmBlob = await exportAsWebm(
            canvases,
            delays,
            project.width,
            project.height,
            fps,
            activeOptions.quality || 100,
            mixedAudioBuffer,
            (p, phase) => {
              setProgressPercent(70 + Math.round(p * 29));
              if (phase) setExportPhase(phase);
            }
          );
          finalizeDownload(webmBlob, 'تم تصدير فيديو WebM الشفاف بنجاح!');
          return;
        } else if (formatToExport === 'VAP1.0' || formatToExport === 'VAP (MP4)' || formatToExport === 'VAP 1.0.5') {
          const layoutName = vapLayout === 'top-right-alpha' 
            ? 'الحته البيضاء بأعلى اليمين مثل الاسكرين' 
            : vapLayout === 'left-right' 
              ? 'الحته البيضاء باليمين بجانب الهدية' 
              : vapLayout === 'top-bottom' 
                ? 'الحته البيضاء بالأعلى' 
                : vapLayout === 'right-left' 
                  ? 'الحته البيضاء باليسار' 
                  : 'الحته البيضاء بالأسفل';
          setExportPhase(`جاري تشكيل فيديو Tencent VAP الشفاف (${formatToExport}) بمسرع العتاد مع تموضع قناع الشفافية (${layoutName})...`);
          setProgressPercent(70);
          const vapVersion = formatToExport === 'VAP1.0' ? '1.0' : formatToExport === 'VAP 1.0.5' ? '1.0.5' : '2.0';
          const vapBlob = await exportAsVap(
            canvases, 
            delays, 
            project.width, 
            project.height, 
            fps, 
            vapVersion as any, 
            mixedAudioBuffer,
            (p, phase) => {
              setProgressPercent(70 + Math.round(p * 29));
              if (phase) setExportPhase(phase);
            },
            activeOptions.quality || 100,
            vapLayout // Dynamic layout: defaults to 'top-right-alpha' matching screenshot (RGB on left, white Alpha on top right)
          );
          finalizeDownload(vapBlob, `تم تصدير فيديو Tencent ${formatToExport} بنجاح!`);
          return;
        } else if (formatToExport === 'SVGA – YYSVA') {
          setExportPhase('جاري تجهيز فيديو YYEVA / YYSVA المزدوج الشفاف بمسرع العتاد...');
          setProgressPercent(70);
          const yyevaBlob = await exportAsYyeva(
            canvases, 
            delays, 
            project.width, 
            project.height, 
            fps, 
            mixedAudioBuffer,
            (p, phase) => {
              setProgressPercent(70 + Math.round(p * 29));
              if (phase) setExportPhase(phase);
            },
            activeOptions.quality || 100
          );
          finalizeDownload(yyevaBlob, 'تم تصدير فيديو YYEVA الشفاف بنجاح!');
          return;
        }
      } else if (formatToExport === 'SVGA – Animated SVG') {
        setExportPhase('جاري إنشاء ملف Animated SVG بكافة الإطارات ومتحركات CSS...');
        setProgressPercent(75);
        const svgBlob = await exportAsAnimatedSvg(canvases, delays, project.width, project.height);
        finalizeDownload(svgBlob, 'تم تصدير ملف Animated SVG بنجاح!');
        return;
      } else if (formatToExport === 'Lottie (Sequence)') {
        setExportPhase('جاري تحويل وتصدير الرسوم إلى ملف Lottie JSON كامل...');
        setProgressPercent(75);
        const lottieBlob = await exportAsLottie(canvases, fps);
        finalizeDownload(lottieBlob, 'تم تصدير ملف Lottie JSON بنجاح!');
        return;
      }

      setProgressPercent(100);
      setExportPhase('تم التصدير والتحميل بنجاح! ✓');
      onSuccessToast?.(`تم تصدير ملف ${formatToExport} بنجاح!`);
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Export Error:', err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء معالجة وتصدير الملف.');
      setIsExporting(false);
    }
  };

  // Keyboard shortcut: Press Enter to trigger SVGA export immediately, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable ||
        Boolean(activeEl.closest('input, textarea, select, [contenteditable="true"]'))
      );
      if (isInput) return;

      if (e.key === 'Enter' || e.code === 'Enter' || e.key === 'Tab' || e.code === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (!isExporting) {
          handleExport(selectedFormat || 'SVGA 2.0');
        }
      } else if (e.key === 'Escape' || e.code === 'Escape') {
        if (!isExporting) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, selectedFormat, handleExport, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#0b1020] border border-white/15 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">مركز التصدير والضغط الاحترافي</h3>
              <p className="text-[11px] text-slate-400">اختر صيغة التصدير ومستوى الضغط المناسب لجودة وحجم الهدية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Compression Presets & Numeric Custom Controls (Directly matching sdsdsd88.png) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>مستوى الضغط والجودة (Quality & Compression):</span>
            {compressionMode === 'custom' && (
              <span className="text-cyan-400 font-mono text-[10px]">
                جودة: {customQuality}% | ضغط Zlib: {zlibLevel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {/* Card 1: عالية (أفضل دقة) - Emerald Highlight like in screenshot */}
            <button
              type="button"
              onClick={() => setCompressionMode('high')}
              className={`py-2.5 px-1.5 rounded-2xl text-[11px] font-black uppercase border transition-all cursor-pointer flex flex-col items-center justify-center ${
                compressionMode === 'high'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-[1.02]'
                  : 'bg-slate-900/80 text-slate-300 border-white/5 hover:bg-white/5'
              }`}
            >
              <span>عالية</span>
              <span className={`block text-[9px] font-normal mt-0.5 ${compressionMode === 'high' ? 'text-emerald-100' : 'text-slate-400'}`}>
                أفضل دقة
              </span>
            </button>

            {/* Card 2: متوسطة (متوازن) */}
            <button
              type="button"
              onClick={() => setCompressionMode('medium')}
              className={`py-2.5 px-1.5 rounded-2xl text-[11px] font-black uppercase border transition-all cursor-pointer flex flex-col items-center justify-center ${
                compressionMode === 'medium'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-[1.02]'
                  : 'bg-slate-900/80 text-slate-300 border-white/5 hover:bg-white/5'
              }`}
            >
              <span>متوسطة</span>
              <span className={`block text-[9px] font-normal mt-0.5 ${compressionMode === 'medium' ? 'text-emerald-100' : 'text-slate-400'}`}>
                متوازن
              </span>
            </button>

            {/* Card 3: منخفضة (حجم صغير) */}
            <button
              type="button"
              onClick={() => setCompressionMode('low')}
              className={`py-2.5 px-1.5 rounded-2xl text-[11px] font-black uppercase border transition-all cursor-pointer flex flex-col items-center justify-center ${
                compressionMode === 'low'
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)] scale-[1.02]'
                  : 'bg-slate-900/80 text-slate-300 border-white/5 hover:bg-white/5'
              }`}
            >
              <span>منخفضة</span>
              <span className={`block text-[9px] font-normal mt-0.5 ${compressionMode === 'low' ? 'text-emerald-100' : 'text-slate-400'}`}>
                حجم صغير
              </span>
            </button>

            {/* Card 4: رقمي / مخصص (Requested by User) */}
            <button
              type="button"
              onClick={() => setCompressionMode('custom')}
              className={`py-2.5 px-1.5 rounded-2xl text-[11px] font-black uppercase border transition-all cursor-pointer flex flex-col items-center justify-center ${
                compressionMode === 'custom'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-[1.02]'
                  : 'bg-slate-900/80 text-slate-300 border-white/5 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-1">
                <Sliders size={11} className={compressionMode === 'custom' ? 'text-cyan-300' : 'text-slate-400'} />
                <span>رقمي</span>
              </div>
              <span className={`block text-[9px] font-normal mt-0.5 ${compressionMode === 'custom' ? 'text-indigo-100' : 'text-slate-400'}`}>
                إدخال يدوي
              </span>
            </button>
          </div>

          {/* Image Compression Format Selector */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <span>🖼️ صيغة أصول الصور في الطبقات (حفظ تأثير الهدية والشفافية):</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {imageFormat === 'png' ? 'PNG (صور كاملة - تأثير الهدية يظهر 100%)' : imageFormat === 'auto' ? 'تلقائي ذكي' : imageFormat === 'webp' ? 'WebP فائق' : 'JPEG'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'png', label: 'PNG (بصيغة الصور)', desc: 'ظهور تأثير الهدية 100% بدون تفريغ' },
                { id: 'auto', label: 'تلقائي ذكي', desc: 'الحفاظ على صور PNG مع تقليل الحجم' },
                { id: 'webp', label: 'WebP (فائق الضغط)', desc: 'قد لا تدعمه بعض مشغلات الهدايا' },
                { id: 'jpeg', label: 'JPEG', desc: 'بدون قناة شفافية' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setImageFormat(fmt.id as any)}
                  className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-0.5 ${
                    imageFormat === fmt.id
                      ? 'bg-emerald-600/30 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white">{fmt.label}</span>
                    {imageFormat === fmt.id && <Check size={12} className="text-emerald-400" />}
                  </div>
                  <span className="text-[9px] text-slate-400">{fmt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* VAP Layout Selector (Matching user's exact screen layout: Left RGB + Right Alpha Mask) */}
          {(selectedFormat === 'VAP1.0' || selectedFormat === 'VAP (MP4)' || selectedFormat === 'VAP 1.0.5') && (
            <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-cyan-200">
                <span className="flex items-center gap-1.5">
                  <Video size={13} className="text-cyan-400" />
                  <span>تموضع قناع الشفافية (الحته البيضاء) في فيديو VAP:</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono font-bold">
                  {vapLayout === 'top-right-alpha' ? 'الهدية يسار + الحتة البيضاء بأعلى اليمين (تخطيط الاسكرين الأصلي 2432443434)' : vapLayout === 'left-right' ? 'أفقي كامل: الهدية يسار + الحتة البيضاء يمين بالكامل' : vapLayout === 'top-bottom' ? 'عمودي: الحتة البيضاء فوق + الهدية تحت' : vapLayout === 'right-left' ? 'أفقي: الحتة البيضاء يسار' : 'عمودي: الحتة البيضاء تحت'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {[
                  { id: 'top-right-alpha', label: 'الهدية يسار + أعلى اليمين', desc: 'مطابق للاسكرين 2432443434 (افتراضي)' },
                  { id: 'left-right', label: 'الهدية يسار + بيضاء يمين', desc: 'أفقي كامل 100%' },
                  { id: 'top-bottom', label: 'بيضاء فوق + الهدية تحت', desc: 'الوضع الرأسي الافتراضي' },
                  { id: 'right-left', label: 'بيضاء يسار + الهدية يمين', desc: 'أفقي معكوس' },
                  { id: 'bottom-top', label: 'الهدية فوق + بيضاء تحت', desc: 'عمودي معكوس' },
                ].map((lyt) => (
                  <button
                    key={lyt.id}
                    type="button"
                    onClick={() => setVapLayout(lyt.id as any)}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-0.5 ${
                      vapLayout === lyt.id
                        ? 'bg-cyan-600/40 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)] scale-[1.02]'
                        : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white">{lyt.label}</span>
                      {vapLayout === lyt.id && <Check size={12} className="text-cyan-300" />}
                    </div>
                    <span className="text-[9px] text-cyan-200/70">{lyt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {compressionMode === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3.5 space-y-3"
            >
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <Hash size={13} className="text-cyan-400" />
                  <span>تحديد نسبة الجودة رقمياً (%):</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={customQuality}
                    onChange={(e) => setCustomQuality(Math.min(100, Math.max(10, parseInt(e.target.value) || 100)))}
                    className="w-16 bg-slate-900 border border-indigo-500/40 rounded-lg px-2 py-0.5 text-xs font-mono text-cyan-300 text-center outline-none"
                  />
                  <span className="text-xs text-indigo-300 font-mono">%</span>
                </div>
              </div>

              {/* Slider for Quality */}
              <input
                type="range"
                min="10"
                max="100"
                value={customQuality}
                onChange={(e) => setCustomQuality(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />

              {/* Zlib Compression Level Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200">
                  <span>مستوى ضغط الحزمة (Zlib Level 0 - 9):</span>
                  <span className="text-xs font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-white/10">
                    مستوى {zlibLevel}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="9"
                  value={zlibLevel}
                  onChange={(e) => setZlibLevel(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>0 (فائق السرعة)</span>
                  <span>6 (متوازن موصى به)</span>
                  <span>9 (أقصى ضغط)</span>
                </div>
              </div>

              {/* Image optimization toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={compressImages}
                  onChange={(e) => setCompressImages(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-[11px] text-slate-200">
                  ضغط الصور الداخلية بترميز WebP الذكي (توفير إضافي في حجم الملف)
                </span>
              </label>
            </motion.div>
          )}
        </div>

        {/* 2. Prominent Action Button */}
        <div>
          <button
            type="button"
            onClick={() => handleExport(selectedFormat)}
            disabled={isExporting}
            className={`w-full py-3.5 text-xs sm:text-sm font-black rounded-2xl active:scale-95 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50 text-white border ${
              selectedFormat === 'VAP1.0' || selectedFormat === 'VAP (MP4)' || selectedFormat === 'VAP 1.0.5'
                ? 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.45)]'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 border-purple-400/40 shadow-[0_0_25px_rgba(168,85,247,0.35)]'
            }`}
          >
            {selectedFormat === 'VAP1.0' || selectedFormat === 'VAP (MP4)' || selectedFormat === 'VAP 1.0.5' ? (
              <Video size={17} className="text-cyan-200 animate-pulse" />
            ) : (
              <Sparkles size={17} className="text-amber-300" />
            )}
            <span className="text-sm">
              {isExporting 
                ? 'جاري التصدير والمعالجة...' 
                : selectedFormat === 'VAP1.0' || selectedFormat === 'VAP (MP4)' || selectedFormat === 'VAP 1.0.5'
                  ? '🚀 تصدير فيديو VAP1.0 الآن (الهدية يسار + الحتة البيضاء مثل الاسكرين)'
                  : selectedFormat === 'SVGA 2.0'
                    ? '⚡ تنزيل وحفظ ملف SVGA 2.0 فوراً'
                    : `🚀 تصدير ${selectedFormat} الآن`}
            </span>
          </button>
        </div>

        {/* 3. Export Formats Grid (Exact 13 Formats with prominent VAP1.0) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 block">
            صيغ التصدير المتاحة (انقر للاختيار أو التصدير المباشر):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {formatButtons.map((fmt) => {
              const isSelected = selectedFormat === fmt.id;
              const isVap10 = fmt.id === 'VAP1.0';
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id)}
                  onDoubleClick={() => handleExport(fmt.id)}
                  className={`py-2.5 px-2 rounded-xl text-[10px] font-black border transition-all text-center truncate cursor-pointer relative ${
                    isSelected
                      ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.45)] scale-[1.02]'
                      : isVap10
                        ? 'bg-cyan-950/60 text-cyan-200 border-cyan-500/60 hover:bg-cyan-900/60 hover:border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-950/60 text-slate-300 border-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                  title={`${fmt.label} (انقر مرتين للتصدير الفوري)`}
                >
                  {isVap10 && (
                    <span className="absolute -top-1.5 -left-1 px-1 py-0.2 rounded text-[7px] font-bold bg-cyan-500 text-black">
                      جديد
                    </span>
                  )}
                  {fmt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. File Name and Preservation Status */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">اسم الملف عند الحفظ:</label>
            <span className="text-[10px] text-cyan-400 font-mono">الصيغة: {formatExtension}</span>
          </div>
          <div className="bg-slate-900 border border-white/10 focus-within:border-indigo-500 rounded-2xl px-4 py-2 flex items-center gap-2" dir="ltr">
            <FileCode size={15} className="text-indigo-400 shrink-0" />
            <input
              type="text"
              value={fileNameBase}
              onChange={(e) => setFileNameBase(e.target.value)}
              placeholder="gift_animation_edited"
              className="w-full bg-transparent text-xs font-mono text-white outline-none text-left"
              dir="ltr"
            />
            <span className="text-xs text-cyan-400 font-mono select-none font-bold">{formatExtension}</span>
          </div>
        </div>

        {/* 5. Project Specs Cards */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block">الأبعاد</span>
            <span className="text-[11px] font-mono font-bold text-white">{project.width} × {project.height}</span>
          </div>
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block">الفريمات / FPS</span>
            <span className="text-[11px] font-mono font-bold text-white">{project.totalFrames} F @ {project.fps}</span>
          </div>
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block">الطبقات</span>
            <span className="text-[11px] font-mono font-bold text-indigo-400">{layers.filter(l => l.visible).length} طبقة</span>
          </div>
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2">
            <span className="text-[9px] text-slate-400 block">تدرج الحواف</span>
            <span className={`text-[11px] font-bold ${isTransparencyActive(fadeConfig, cropConfig) ? 'text-cyan-300' : 'text-slate-500'}`}>
              {isTransparencyActive(fadeConfig, cropConfig) ? 'مفعل ✓' : 'غير مفعل'}
            </span>
          </div>
        </div>

        {/* 6. Live Export Progress & Status Bar */}
        {isExporting && (
          <div className="bg-indigo-950/60 border border-indigo-500/40 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
              <span className="flex items-center gap-2">
                <RefreshCw size={13} className="animate-spin text-cyan-400" />
                <span>{exportPhase || 'جاري التصدير...'}</span>
              </span>
              <span className="font-mono text-cyan-300">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                initial={{ width: '0%' }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 7. Completed Export Success & Direct Download Card */}
        {completedExport && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-emerald-950/80 border border-emerald-500/60 rounded-2xl p-4 space-y-3 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 animate-pulse" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-emerald-200">تم تجهيز ملف التصدير بنجاح! جاهز للتحميل</h4>
                  <p className="text-[10px] text-slate-300 font-mono mt-0.5">
                    {completedExport.fileName} • {(completedExport.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/40">
                {completedExport.format}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => downloadBlob(completedExport.blob, completedExport.fileName)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs sm:text-sm font-black rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01]"
              >
                <Download size={16} />
                <span>تحميل الملف الآن على جهازك ({(completedExport.size / 1024 / 1024).toFixed(2)} MB)</span>
              </button>

              {onOpenViewer && (completedExport.format.startsWith('SVGA') || completedExport.format === 'SVGA 2.0') && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenViewer(completedExport.blob, completedExport.fileName);
                    onClose();
                  }}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="معاينة الملف المصدّر في العارض مباشرة"
                >
                  <Play size={14} />
                  <span>معاينة</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Action Controls Bottom */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => handleExport(selectedFormat)}
            disabled={isExporting}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01] disabled:opacity-50"
          >
            <Download size={14} />
            <span>{isExporting ? 'جاري إنشاء الملف...' : `تصدير وتحميل بصيغة ${selectedFormat} (Enter / Tab ⇥)`}</span>
          </button>

          {/* Player Preview Button if SVGA was exported */}
          {onOpenViewer && (
            <button
              type="button"
              onClick={() => {
                if (exportedSvgaBlob) {
                  onOpenViewer(exportedSvgaBlob.blob, exportedSvgaBlob.fileName);
                  onClose();
                } else {
                  handleExport('SVGA 2.0');
                }
              }}
              disabled={isExporting}
              className="px-3.5 py-3 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-bold rounded-2xl border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="معاينة في مشغل SVGA"
            >
              <Play size={14} />
              <span className="hidden sm:inline">معاينة</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
