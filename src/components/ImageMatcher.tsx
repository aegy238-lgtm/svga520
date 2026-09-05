import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { UserRecord } from '../types';
import { 
  Image as ImageIcon, 
  Upload, 
  X, 
  Download, 
  Maximize, 
  Move, 
  Settings2,
  Check,
  Layers,
  RefreshCw,
  Eye,
  EyeOff,
  FileText,
  FolderArchive,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Copy,
  Sliders,
  Ratio
} from 'lucide-react';
import { logActivity } from '../utils/logger';
import { useAccessControl } from '../hooks/useAccessControl';

interface ImageMatcherProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

export interface WorkingImageItem {
  id: string;
  name: string;
  file?: File;
  img: HTMLImageElement;
  width: number;
  height: number;
  url: string;
}

export type FitStrategy = 'stretch' | 'contain' | 'cover';
export type OutputImageFormat = 'webp' | 'png';

export const ImageMatcher: React.FC<ImageMatcherProps> = ({ 
  currentUser, 
  onCancel, 
  onLoginRequired, 
  onSubscriptionRequired 
}) => {
  const { checkAccess } = useAccessControl();
  
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [workingImages, setWorkingImages] = useState<WorkingImageItem[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [fitStrategy, setFitStrategy] = useState<FitStrategy>('stretch');
  const [scale, setScale] = useState(1.0);
  const [manualPos, setManualPos] = useState({ x: 0, y: 0 });
  const [manualScale, setManualScale] = useState(1.0);
  const [mergeWithBase, setMergeWithBase] = useState(false);
  
  const [imageFormat, setImageFormat] = useState<OutputImageFormat>('webp');
  const [webpQuality, setWebpQuality] = useState<number>(0.92);

  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'pdf' | 'zip'>('pdf');
  const [pdfFormat, setPdfFormat] = useState<'match_size' | 'catalog'>('match_size');
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; text: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);
  const workingInputRef = useRef<HTMLInputElement>(null);

  // The active working image currently previewed on canvas
  const workingImage = workingImages[activeImageIndex]?.img || null;
  const activeItem = workingImages[activeImageIndex] || null;

  const handleBaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBaseImage(img);
      // Center manual position when new base image is uploaded
      setManualPos({ x: 0, y: 0 });
      setManualScale(1.0);
    };
    img.src = url;
  };

  const processIncomingFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const validImageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|bmp|gif)$/i.test(f.name));
    if (validImageFiles.length === 0) return;

    const newItems: WorkingImageItem[] = [];

    for (let i = 0; i < validImageFiles.length; i++) {
      const file = validImageFiles[i];
      try {
        const url = URL.createObjectURL(file);
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = url;
        });

        newItems.push({
          id: `work_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          file,
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          url
        });
      } catch (err) {
        console.error('Error loading image file:', file.name, err);
      }
    }

    if (newItems.length > 0) {
      setWorkingImages(prev => {
        const updated = [...prev, ...newItems];
        return updated;
      });
    }
  };

  const handleWorkingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveWorkingItem = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkingImages(prev => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (activeImageIndex >= updated.length) {
        setActiveImageIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleClearAllWorking = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkingImages([]);
    setActiveImageIndex(0);
  };

  // Canvas Live Preview Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to base image size * scale
    canvas.width = Math.round(baseImage.width * scale);
    canvas.height = Math.round(baseImage.height * scale);
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Base Image as background
    if (mergeWithBase || mode === 'manual' || !workingImage) {
      ctx.globalAlpha = (mode === 'manual' && !mergeWithBase) ? 0.3 : 1.0;
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }
    
    if (workingImage) {
      if (mode === 'auto') {
        if (fitStrategy === 'stretch') {
          // Draw Working Image stretched to match base image dimensions * scale
          ctx.drawImage(workingImage, 0, 0, canvas.width, canvas.height);
        } else if (fitStrategy === 'contain') {
          // Fit while preserving aspect ratio, centered
          const scaleFactor = Math.min(canvas.width / workingImage.width, canvas.height / workingImage.height);
          const dw = workingImage.width * scaleFactor;
          const dh = workingImage.height * scaleFactor;
          const dx = (canvas.width - dw) / 2;
          const dy = (canvas.height - dh) / 2;
          ctx.drawImage(workingImage, dx, dy, dw, dh);
        } else if (fitStrategy === 'cover') {
          // Fill canvas while preserving aspect ratio, crop edges
          const scaleFactor = Math.max(canvas.width / workingImage.width, canvas.height / workingImage.height);
          const dw = workingImage.width * scaleFactor;
          const dh = workingImage.height * scaleFactor;
          const dx = (canvas.width - dw) / 2;
          const dy = (canvas.height - dh) / 2;
          ctx.drawImage(workingImage, dx, dy, dw, dh);
        }
      } else {
        // Manual Mode: Draw working image with its own transform
        const w = workingImage.width * manualScale * scale;
        const h = workingImage.height * manualScale * scale;
        const x = (canvas.width / 2) - (w / 2) + (manualPos.x * scale);
        const y = (canvas.height / 2) - (h / 2) + (manualPos.y * scale);
        ctx.drawImage(workingImage, x, y, w, h);
      }
    } else {
      // If no working image, draw a placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#22c55e';
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    }
    
  }, [baseImage, workingImage, scale, mode, fitStrategy, manualPos, manualScale, mergeWithBase]);

  // Render a specific working item to an offscreen canvas at the matched target size
  const renderItemToCanvas = (
    item: WorkingImageItem,
    targetW: number,
    targetH: number
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (mergeWithBase && baseImage) {
      ctx.drawImage(baseImage, 0, 0, targetW, targetH);
    }

    if (mode === 'auto') {
      if (fitStrategy === 'stretch') {
        ctx.drawImage(item.img, 0, 0, targetW, targetH);
      } else if (fitStrategy === 'contain') {
        const scaleFactor = Math.min(targetW / item.img.width, targetH / item.img.height);
        const dw = item.img.width * scaleFactor;
        const dh = item.img.height * scaleFactor;
        const dx = (targetW - dw) / 2;
        const dy = (targetH - dh) / 2;
        ctx.drawImage(item.img, dx, dy, dw, dh);
      } else if (fitStrategy === 'cover') {
        const scaleFactor = Math.max(targetW / item.img.width, targetH / item.img.height);
        const dw = item.img.width * scaleFactor;
        const dh = item.img.height * scaleFactor;
        const dx = (targetW - dw) / 2;
        const dy = (targetH - dh) / 2;
        ctx.drawImage(item.img, dx, dy, dw, dh);
      }
    } else {
      const w = item.img.width * manualScale * scale;
      const h = item.img.height * manualScale * scale;
      const x = (targetW / 2) - (w / 2) + (manualPos.x * scale);
      const y = (targetH / 2) - (h / 2) + (manualPos.y * scale);
      ctx.drawImage(item.img, x, y, w, h);
    }

    return canvas;
  };

  // 1. Export Current Single Active Image
  const handleExportSingle = async (overrideFormat?: OutputImageFormat) => {
    if (!baseImage || !workingImage || !activeItem) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Image Matching');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    const fmt = overrideFormat || imageFormat;
    setIsExporting(true);
    setExportType('single');
    setExportProgress({ current: 1, total: 1, text: `جاري تصدير الصورة الحالية بصيغة ${fmt.toUpperCase()} (${fmt === 'webp' ? 'الويف بي' : 'PNG'})...` });
    
    try {
      const targetW = Math.round(baseImage.width * scale);
      const targetH = Math.round(baseImage.height * scale);
      const canvas = renderItemToCanvas(activeItem, targetW, targetH);
      
      const blob = await new Promise<Blob | null>(resolve => 
        fmt === 'webp' 
          ? canvas.toBlob(resolve, 'image/webp', webpQuality) 
          : canvas.toBlob(resolve, 'image/png')
      );
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = activeItem.name.replace(/\.[^/.]+$/, '');
        a.download = `${cleanName}_matched_${targetW}x${targetH}.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
        
        if (currentUser) {
          logActivity(currentUser, 'feature_usage', `Image matched (${mode}) ${fmt.toUpperCase()}: ${targetW}x${targetH}`);
        }
      }
    } catch (e) {
      console.error(e);
      alert("فشل التصدير");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // Quick export a single working item from gallery
  const handleExportSingleItem = async (item: WorkingImageItem, overrideFormat?: OutputImageFormat) => {
    if (!baseImage) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Image Matching');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    const fmt = overrideFormat || imageFormat;
    try {
      const targetW = Math.round(baseImage.width * scale);
      const targetH = Math.round(baseImage.height * scale);
      const canvas = renderItemToCanvas(item, targetW, targetH);
      
      const blob = await new Promise<Blob | null>(resolve => 
        fmt === 'webp' 
          ? canvas.toBlob(resolve, 'image/webp', webpQuality) 
          : canvas.toBlob(resolve, 'image/png')
      );
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = item.name.replace(/\.[^/.]+$/, '');
        a.download = `${cleanName}_matched_${targetW}x${targetH}.${fmt}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. Export All Processed Images to PDF Package / Catalog
  const handleExportPdf = async () => {
    if (!baseImage || workingImages.length === 0) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Image Matching');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    const total = workingImages.length;
    setExportProgress({ current: 0, total, text: `جاري بدء معالجة وتصدير ${total} صورة إلى ملف PDF...` });

    try {
      const targetW = Math.round(baseImage.width * scale);
      const targetH = Math.round(baseImage.height * scale);

      if (pdfFormat === 'match_size') {
        // Option A: Full Size Page per matched image (each page in PDF matches base dimensions perfectly)
        const pdf = new jsPDF({
          orientation: targetW >= targetH ? 'landscape' : 'portrait',
          unit: 'px',
          format: [targetW, targetH],
          hotfixes: ['px_scaling']
        });

        for (let i = 0; i < total; i++) {
          const item = workingImages[i];
          setExportProgress({ 
            current: i + 1, 
            total, 
            text: `جاري معالجة وإضافة الصورة ${i + 1} من ${total} إلى ملف PDF...` 
          });

          // Yield execution to maintain UI responsiveness
          await new Promise(r => setTimeout(r, 8));

          const itemCanvas = renderItemToCanvas(item, targetW, targetH);
          const dataUrl = itemCanvas.toDataURL('image/png');

          if (i > 0) {
            pdf.addPage([targetW, targetH], targetW >= targetH ? 'landscape' : 'portrait');
          }
          pdf.addImage(dataUrl, 'PNG', 0, 0, targetW, targetH);
        }

        setExportProgress({ current: total, total, text: 'جاري إنشاء وحفظ ملف PDF...' });
        pdf.save(`matched_bundle_${targetW}x${targetH}_(${total}_items).pdf`);
      } else {
        // Option B: Multi-item A4 Catalog
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const itemsPerPage = 12; // 3 columns x 4 rows
        const totalPages = Math.ceil(total / itemsPerPage);
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 12;
        const usableW = pageWidth - (margin * 2);
        const usableH = pageHeight - 35 - margin; // top header
        const cols = 3;
        const rows = 4;
        const colW = (usableW - ((cols - 1) * 6)) / cols;
        const rowH = (usableH - ((rows - 1) * 6)) / rows;

        for (let p = 0; p < totalPages; p++) {
          if (p > 0) pdf.addPage('a4', 'portrait');

          // Header
          pdf.setFillColor(15, 23, 42); // slate-900
          pdf.rect(0, 0, pageWidth, 24, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(14);
          pdf.text('كتالوج الصور الموحدة بالمقاس المرجعي', pageWidth / 2, 12, { align: 'center' });
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`الأبعاد الموحدة: ${targetW} × ${targetH} بكسل | الصفحة ${p + 1} من ${totalPages} | إجمالي الصور: ${total}`, pageWidth / 2, 19, { align: 'center' });

          const startIdx = p * itemsPerPage;
          const endIdx = Math.min(startIdx + itemsPerPage, total);

          for (let idx = startIdx; idx < endIdx; idx++) {
            const item = workingImages[idx];
            const localIdx = idx - startIdx;
            const c = localIdx % cols;
            const r = Math.floor(localIdx / cols);

            const x = margin + c * (colW + 6);
            const y = 30 + r * (rowH + 6);

            setExportProgress({ 
              current: idx + 1, 
              total, 
              text: `جاري تجهيز الكتالوج: صورة ${idx + 1} من ${total}...` 
            });

            // Card background
            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(x, y, colW, rowH, 2, 2, 'F');
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(x, y, colW, rowH, 2, 2, 'D');

            const itemCanvas = renderItemToCanvas(item, targetW, targetH);
            const dataUrl = itemCanvas.toDataURL('image/png');

            // Image area inside card
            const imgAreaH = rowH - 12;
            const cardImgW = colW - 4;
            // Fit image into cell preserving target aspect ratio
            const cellScale = Math.min(cardImgW / targetW, imgAreaH / targetH);
            const drawW = targetW * cellScale;
            const drawH = targetH * cellScale;
            const drawX = x + (colW - drawW) / 2;
            const drawY = y + 2 + (imgAreaH - drawH) / 2;

            pdf.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH);

            // Label text underneath
            pdf.setFontSize(7);
            pdf.setTextColor(51, 65, 85);
            const itemLabel = `#${idx + 1} - ${item.name.length > 18 ? item.name.substring(0, 16) + '..' : item.name}`;
            pdf.text(itemLabel, x + colW / 2, y + rowH - 3, { align: 'center' });
          }
        }

        setExportProgress({ current: total, total, text: 'جاري إنشاء ملف الكتالوج...' });
        pdf.save(`matched_catalog_${targetW}x${targetH}_(${total}_items).pdf`);
      }

      if (currentUser) {
        logActivity(currentUser, 'feature_usage', `Batch Image Matched PDF (${total} images): ${targetW}x${targetH}`);
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  // 3. Export All Processed Images as ZIP Archive
  const handleExportZip = async (overrideFormat?: OutputImageFormat) => {
    if (!baseImage || workingImages.length === 0) return;
    
    if (!currentUser) {
      onLoginRequired();
      return;
    }

    const { allowed } = await checkAccess('Image Matching');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    const fmt = overrideFormat || imageFormat;
    setIsExporting(true);
    setExportType('zip');
    const total = workingImages.length;
    setExportProgress({ current: 0, total, text: `جاري ضغط وتحويل ${total} صورة بصيغة ${fmt.toUpperCase()} (${fmt === 'webp' ? 'الويف بي' : 'PNG'})...` });

    try {
      const zip = new JSZip();
      const targetW = Math.round(baseImage.width * scale);
      const targetH = Math.round(baseImage.height * scale);

      for (let i = 0; i < total; i++) {
        const item = workingImages[i];
        setExportProgress({ 
          current: i + 1, 
          total, 
          text: `جاري تجهيز الصورة ${i + 1} من ${total}: ${item.name} (${fmt.toUpperCase()})...` 
        });

        // Small yield to let browser breathe
        await new Promise(r => setTimeout(r, 6));

        const itemCanvas = renderItemToCanvas(item, targetW, targetH);
        const blob = await new Promise<Blob | null>(res => 
          fmt === 'webp' 
            ? itemCanvas.toBlob(res, 'image/webp', webpQuality) 
            : itemCanvas.toBlob(res, 'image/png')
        );
        if (blob) {
          const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_');
          const fileName = `${String(i + 1).padStart(3, '0')}_${cleanName}_${targetW}x${targetH}.${fmt}`;
          zip.file(fileName, blob);
        }
      }

      setExportProgress({ current: total, total, text: `جاري تجميع وحفظ الملف المضغوط (ZIP - ${fmt.toUpperCase()})...` });
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `matched_images_${targetW}x${targetH}_(${total}_items)_${fmt.toUpperCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      if (currentUser) {
        logActivity(currentUser, 'feature_usage', `Batch Image Matched ZIP ${fmt.toUpperCase()} (${total} images): ${targetW}x${targetH}`);
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير الأرشيف المضغوط');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <ImageIcon className="w-8 h-8 text-green-500" />
            مطابق مقاسات الصور التلقائي والدفعات (Batch Image Resizer & Matcher)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            رفع أي عدد من الصور وتوحيد مقاساتها فوراً لتطابق أبعاد الصورة المرجعية بالكامل وتصديرها كـ PDF أو ZIP
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Controls Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-6 space-y-6 shadow-2xl backdrop-blur-xl">
            
            {/* Mode Switcher */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setMode('auto')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'auto' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-400 hover:text-white'}`}
              >
                <Maximize className="w-3.5 h-3.5" />
                تلقائي
              </button>
              <button 
                onClick={() => setMode('manual')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'manual' ? 'bg-sky-500 text-white shadow-glow-sky' : 'text-slate-400 hover:text-white'}`}
              >
                <Move className="w-3.5 h-3.5" />
                يدوي
              </button>
            </div>

            {/* Upload Section 1: Green Box (Reference Image) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-green-500 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  الخانة الخضراء (الصورة المرجعية)
                </span>
                {baseImage && (
                  <span className="font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20">
                    {baseImage.width}×{baseImage.height}px
                  </span>
                )}
              </label>
              <button 
                onClick={() => baseInputRef.current?.click()}
                className={`w-full py-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-2 cursor-pointer ${baseImage ? 'border-green-500 bg-green-500/10' : 'border-green-500/30 hover:border-green-500/50 bg-green-500/5'}`}
              >
                <Upload className={`w-5 h-5 ${baseImage ? 'text-green-500' : 'text-green-400'}`} />
                <span className="text-[11px] font-bold text-green-400">{baseImage ? 'تم رفع المرجع بنجاح' : 'رفع الصورة المرجعية (أخذ المقاسات منها)'}</span>
                {baseImage ? (
                  <span className="text-[9px] text-green-300/80 font-mono">انقر لتغيير الصورة المرجعية</span>
                ) : (
                  <span className="text-[9px] text-slate-500">سيتم تطبيق أبعادها على كافة الصور</span>
                )}
              </button>
              <input type="file" ref={baseInputRef} className="hidden" accept="image/*,.webp" onChange={handleBaseUpload} />
            </div>

            {/* Upload Section 2: Blue Box (Working Images - Multiple Batch Upload) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-sky-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  الخانة الزرقاء (الصور المراد تعديلها)
                </span>
                {workingImages.length > 0 && (
                  <span className="font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20 font-bold">
                    {workingImages.length} صورة
                  </span>
                )}
              </label>

              <button 
                onClick={() => workingInputRef.current?.click()}
                className={`w-full py-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-2 cursor-pointer ${workingImages.length > 0 ? 'border-sky-500 bg-sky-500/10' : 'border-sky-500/30 hover:border-sky-500/50 bg-sky-500/5'}`}
              >
                <Upload className={`w-6 h-6 ${workingImages.length > 0 ? 'text-sky-400' : 'text-sky-400'}`} />
                <span className="text-[11px] font-bold text-sky-300">
                  {workingImages.length > 0 
                    ? `تم رفع ${workingImages.length} صورة للتعديل (انقر لإضافة المزيد)` 
                    : 'رفع الصور للتعديل (يمكنك تحديد عدة صور دفعة واحدة)'}
                </span>
                <span className="text-[9px] text-slate-400">
                  يدعم رفع 1 أو 50 أو 200+ صورة دفعة واحدة مع السحب والإفلات
                </span>
              </button>

              {/* Hidden file input with multiple support */}
              <input 
                type="file" 
                ref={workingInputRef} 
                className="hidden" 
                accept="image/*,.webp" 
                multiple 
                onChange={handleWorkingUpload} 
              />

              {/* Batch Actions when images exist */}
              {workingImages.length > 0 && (
                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <button
                    onClick={() => workingInputRef.current?.click()}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة المزيد من الصور
                  </button>
                  <button
                    onClick={handleClearAllWorking}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    مسح كافة الصور
                  </button>
                </div>
              )}
            </div>

            {/* Fitting Mode Options for Auto */}
            {mode === 'auto' && (
              <div className="space-y-2 pt-3 border-t border-white/5">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <Ratio className="w-3.5 h-3.5" />
                  طريقة ملء ومطابقة الأبعاد
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setFitStrategy('stretch')}
                    className={`py-2 px-1.5 rounded-xl text-[10px] font-bold transition-all text-center cursor-pointer ${
                      fitStrategy === 'stretch' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                    title="تمديد الصورة لتطابق مقاسات المرجع بالمللي"
                  >
                    تمديد تام
                  </button>
                  <button
                    onClick={() => setFitStrategy('contain')}
                    className={`py-2 px-1.5 rounded-xl text-[10px] font-bold transition-all text-center cursor-pointer ${
                      fitStrategy === 'contain' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                    title="احتواء مع الحفاظ على النسبة الأصلية وتوسيط الصورة"
                  >
                    احتواء ونسبة
                  </button>
                  <button
                    onClick={() => setFitStrategy('cover')}
                    className={`py-2 px-1.5 rounded-xl text-[10px] font-bold transition-all text-center cursor-pointer ${
                      fitStrategy === 'cover' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                    title="ملء المساحة بالكامل وقص الأطراف الزائدة"
                  >
                    تغطية وقص
                  </button>
                </div>
              </div>
            )}

            {/* Merge Option */}
            <div className="pt-3 border-t border-white/5">
              <button 
                onClick={() => setMergeWithBase(!mergeWithBase)}
                className={`w-full py-3.5 rounded-2xl border transition-all flex items-center justify-between px-4 cursor-pointer ${mergeWithBase ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="flex items-center gap-3">
                  <Layers className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">دمج الصورتين معاً</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-all ${mergeWithBase ? 'bg-green-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${mergeWithBase ? 'right-1' : 'right-5'}`}></div>
                </div>
              </button>
            </div>

            {/* Manual Controls */}
            {mode === 'manual' && workingImage && (
              <div className="space-y-4 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black uppercase tracking-widest text-sky-400 flex items-center gap-2">
                  <Move className="w-3 h-3" />
                  التحكم اليدوي بالصورة
                </label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-slate-400 font-bold">الحجم (Zoom)</span>
                    <span className="text-[9px] font-mono text-sky-400">{Math.round(manualScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="5" 
                    step="0.01" 
                    value={manualScale} 
                    onChange={(e) => setManualScale(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold">أفقي (X)</span>
                    <input 
                      type="number" 
                      value={manualPos.x} 
                      onChange={(e) => setManualPos(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold">رأسي (Y)</span>
                    <input 
                      type="number" 
                      value={manualPos.y} 
                      onChange={(e) => setManualPos(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-sky-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setManualScale(0.5)} className={`p-2 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${manualScale === 0.5 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>50%</button>
                  <button onClick={() => setManualScale(1.0)} className={`p-2 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${manualScale === 1.0 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>100%</button>
                  <button onClick={() => setManualScale(2.0)} className={`p-2 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${manualScale === 2.0 ? 'bg-sky-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>200%</button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setManualPos(p => ({ ...p, x: p.x - 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400 cursor-pointer">يسار</button>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setManualPos(p => ({ ...p, y: p.y - 10 }))} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold text-slate-400 cursor-pointer">فوق</button>
                    <button onClick={() => setManualPos(p => ({ ...p, y: p.y + 10 }))} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold text-slate-400 cursor-pointer">تحت</button>
                  </div>
                  <button onClick={() => setManualPos(p => ({ ...p, x: p.x + 10 }))} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-400 cursor-pointer">يمين</button>
                </div>

                <button 
                  onClick={() => { setManualPos({ x: 0, y: 0 }); setManualScale(1.0); }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-bold text-slate-400 transition-all cursor-pointer"
                >
                  إعادة ضبط الموقع
                </button>
              </div>
            )}

            {/* Scale Control */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Settings2 className="w-3 h-3" />
                حجم التصدير (Scale)
              </label>
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <input 
                  type="range" 
                  min="0.1" 
                  max="2" 
                  step="0.01" 
                  value={scale} 
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-[10px] font-mono text-amber-500 w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1.0, 0.9, 0.8, 0.75, 0.5].map(s => (
                  <button 
                    key={s}
                    onClick={() => setScale(s)}
                    className={`flex-1 py-1.5 rounded-xl text-[9px] font-bold transition-all cursor-pointer ${scale === s ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                  >
                    {Math.round(s * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Export Section (PDF, ZIP, Single) */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" />
                  خيارات التصدير الذكي
                </span>
                {workingImages.length > 1 && (
                  <span className="text-[9px] text-emerald-400/90 font-mono font-bold">
                    دفعة ({workingImages.length} صور)
                  </span>
                )}
              </label>

              {/* Format Switcher: WebP (الويف بي) vs PNG */}
              <div className="bg-white/5 p-2.5 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold px-1">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    صيغة تصدير الصور:
                  </span>
                  <span className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded font-bold ${imageFormat === 'webp' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                    {imageFormat === 'webp' ? 'WEBP (الويف بي)' : 'PNG'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setImageFormat('webp')}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      imageFormat === 'webp'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30 border border-cyan-400/30'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${imageFormat === 'webp' ? 'opacity-100' : 'opacity-0'}`} />
                    <span>WebP (الويف بي)</span>
                  </button>
                  <button
                    onClick={() => setImageFormat('png')}
                    className={`py-2 px-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      imageFormat === 'png'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400/30'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${imageFormat === 'png' ? 'opacity-100' : 'opacity-0'}`} />
                    <span>PNG (بي إن جي)</span>
                  </button>
                </div>

                {/* WebP Quality Options */}
                {imageFormat === 'webp' && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold px-1">
                      <span>جودة ضغط الـ WebP:</span>
                      <span className="font-mono text-cyan-400">{Math.round(webpQuality * 100)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { q: 0.80, label: '80% خفيف' },
                        { q: 0.92, label: '92% متوازن' },
                        { q: 1.00, label: '100% نقي' },
                      ].map(opt => (
                        <button
                          key={opt.q}
                          onClick={() => setWebpQuality(opt.q)}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            webpQuality === opt.q 
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Format Switcher for PDF */}
              {workingImages.length > 0 && (
                <div className="bg-white/5 p-2 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold px-1">
                    <span>تنسيق ملف الـ PDF:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setPdfFormat('match_size')}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        pdfFormat === 'match_size' 
                          ? 'bg-rose-600 text-white shadow-sm' 
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                      title="كل صورة تأخذ صفحة كاملة بمقاس المرجع المطابق تماماً (مثالي لأصول التطبيقات APK)"
                    >
                      أبعاد مطابقة (APK)
                    </button>
                    <button
                      onClick={() => setPdfFormat('catalog')}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        pdfFormat === 'catalog' 
                          ? 'bg-rose-600 text-white shadow-sm' 
                          : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                      title="كتالوج A4 منظم يضم كل الصور مع ترقيمها ومقاساتها"
                    >
                      كتالوج A4 مصفوفي
                    </button>
                  </div>
                </div>
              )}

              {/* Main PDF Export Button */}
              <button 
                onClick={handleExportPdf}
                disabled={!baseImage || workingImages.length === 0 || isExporting}
                className={`w-full py-3.5 rounded-2xl font-black text-xs tracking-wide flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  (!baseImage || workingImages.length === 0 || isExporting)
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-600/30 active:scale-95'
                }`}
              >
                {isExporting && exportType === 'pdf' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>تصدير كافة الصور كملف PDF ({workingImages.length || 0})</span>
              </button>

              {/* ZIP Export Button (WebP / PNG) */}
              <button 
                onClick={() => handleExportZip()}
                disabled={!baseImage || workingImages.length === 0 || isExporting}
                className={`w-full py-3.5 rounded-2xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  (!baseImage || workingImages.length === 0 || isExporting)
                    ? 'bg-slate-800/80 text-slate-600 cursor-not-allowed'
                    : imageFormat === 'webp'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/30 shadow-md shadow-cyan-600/20 active:scale-95'
                      : 'bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/30 shadow-md shadow-indigo-600/20 active:scale-95'
                }`}
              >
                {isExporting && exportType === 'zip' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderArchive className="w-4 h-4" />
                )}
                <span>
                  تصدير الكل في ملف مضغوط ZIP ({imageFormat === 'webp' ? 'WebP ويف بي' : 'PNG'})
                </span>
              </button>

              {/* Single Image Export - Dual Action (WebP & PNG) */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[9px] text-slate-400 font-bold px-1 block">تصدير الصورة الحالية المعروضة:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleExportSingle('webp')}
                    disabled={!baseImage || !workingImage || isExporting}
                    className={`py-2 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (!baseImage || !workingImage || isExporting)
                        ? 'bg-transparent text-slate-600 border border-white/5 cursor-not-allowed'
                        : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 active:scale-95'
                    }`}
                    title="تصدير الصورة الحالية المعروضة بصيغة WebP خفيفة وعالية النقاء"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>تحميل WebP</span>
                  </button>
                  <button 
                    onClick={() => handleExportSingle('png')}
                    disabled={!baseImage || !workingImage || isExporting}
                    className={`py-2 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (!baseImage || !workingImage || isExporting)
                        ? 'bg-transparent text-slate-600 border border-white/5 cursor-not-allowed'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:text-white active:scale-95'
                    }`}
                    title="تصدير الصورة الحالية المعروضة بصيغة PNG بدقة كاملة"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تحميل PNG</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Main Preview & Batch Gallery Area */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Main Canvas Preview Card */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`bg-slate-950/40 border rounded-[3rem] p-6 min-h-[540px] flex flex-col items-center justify-center relative overflow-hidden transition-all ${
              isDragOver ? 'border-sky-400 bg-sky-500/10 scale-[0.99]' : 'border-white/5'
            }`}
          >
            <div className="absolute inset-0 bg-grid-white/[0.02] -z-10"></div>
            
            {/* Drag & Drop Overlay Indicator */}
            {isDragOver && (
              <div className="absolute inset-0 bg-sky-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-3 text-sky-400 pointer-events-none">
                <Upload className="w-12 h-12 animate-bounce" />
                <span className="text-base font-bold">أفلت الصور هنا لإضافتها إلى قائمة التعديل الفوري!</span>
              </div>
            )}

            {!baseImage ? (
              <div className="text-center space-y-4 p-8">
                <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto border border-green-500/20">
                  <ImageIcon className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white">بانتظار الصورة المرجعية</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  ارفع الصورة التي تريد أخذ مقاساتها في الخانة الخضراء، ثم ارفع أي عدد من الصور في الخانة الزرقاء لتطابقها فوراً.
                </p>
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center gap-4">
                
                {/* Top Info Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 w-full px-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/20 border border-green-500/30 px-3 py-1.5 rounded-full text-[11px] font-black text-green-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      الأبعاد المرجعية المستهدفة: {Math.round(baseImage.width * scale)} × {Math.round(baseImage.height * scale)} px
                    </span>

                    {mergeWithBase && (
                      <span className="bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-300">
                        وضع الدمج مع الخلفية مُفعّل
                      </span>
                    )}
                  </div>

                  {/* Navigation between images */}
                  {workingImages.length > 1 && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                      <button
                        onClick={() => setActiveImageIndex(prev => Math.max(0, prev - 1))}
                        disabled={activeImageIndex === 0}
                        className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="الصورة السابقة"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {activeImageIndex + 1} / {workingImages.length}
                      </span>
                      <button
                        onClick={() => setActiveImageIndex(prev => Math.min(workingImages.length - 1, prev + 1))}
                        disabled={activeImageIndex === workingImages.length - 1}
                        className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="الصورة التالية"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Canvas Box */}
                <div className="flex-1 flex items-center justify-center p-2 max-w-full overflow-auto custom-scrollbar">
                  <canvas 
                    ref={canvasRef} 
                    className="max-w-full h-auto shadow-2xl rounded-2xl bg-black/40 border border-white/10 transition-transform"
                    style={{ 
                      maxHeight: '52vh',
                      objectFit: 'contain'
                    }}
                  />
                </div>

                {/* Current Active Item Details */}
                {activeItem && (
                  <div className="text-center text-xs text-slate-400 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-3">
                    <span className="font-bold text-slate-300">الصورة الحالية المعروضة:</span>
                    <span className="font-mono text-sky-400 max-w-[200px] truncate">{activeItem.name}</span>
                    <span className="text-slate-600">|</span>
                    <span>المقاس الأصلي: <strong className="font-mono text-slate-300">{activeItem.width}×{activeItem.height}</strong></span>
                    <span className="text-slate-600">→</span>
                    <span>المقاس المطابق الجديد: <strong className="font-mono text-emerald-400">{Math.round(baseImage.width * scale)}×{Math.round(baseImage.height * scale)}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Batch Images Gallery Strip (Thumbnail Bar) */}
          {workingImages.length > 0 && (
            <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-4 shadow-xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    قائمة الصور المرفوعة للتعديل ({workingImages.length})
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    (انقر على أي صورة لمعاينتها وضبطها)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => workingInputRef.current?.click()}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-xl border border-sky-500/20 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صور
                  </button>
                  <button
                    onClick={handleClearAllWorking}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-xl border border-rose-500/20 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    مسح الكل
                  </button>
                </div>
              </div>

              {/* Horizontal Scrollable Thumbnails */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 px-1 custom-scrollbar">
                {workingImages.map((item, idx) => {
                  const isActive = idx === activeImageIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative shrink-0 w-24 h-24 rounded-2xl border p-1 transition-all flex flex-col items-center justify-between cursor-pointer group ${
                        isActive 
                          ? 'border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50 scale-105' 
                          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }`}
                    >
                      {/* Badge Number */}
                      <span className="absolute top-1 right-1 z-10 bg-black/70 text-[9px] font-mono font-bold text-slate-200 px-1.5 py-0.5 rounded-md border border-white/10">
                        {idx + 1}
                      </span>

                      {/* Remove Button on Hover */}
                      <button
                        onClick={(e) => handleRemoveWorkingItem(idx, e)}
                        className="absolute top-1 left-1 z-10 bg-rose-600/90 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500 transition-all cursor-pointer"
                        title="حذف هذه الصورة"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Quick Download Button on Hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSingleItem(item);
                        }}
                        className="absolute bottom-6 left-1 z-10 bg-cyan-600/90 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-cyan-500 transition-all cursor-pointer"
                        title={`تحميل هذه الصورة بالمقاس المطابق بصيغة ${imageFormat.toUpperCase()}`}
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      {/* Image Thumbnail */}
                      <div className="w-full h-14 flex items-center justify-center overflow-hidden rounded-xl bg-black/40 mt-1">
                        <img 
                          src={item.url} 
                          alt={item.name} 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>

                      {/* Dimensions Label */}
                      <span className="text-[8px] font-mono text-slate-400 truncate w-full text-center px-1">
                        {item.width}×{item.height}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Export Progress Modal */}
      <AnimatePresence>
        {exportProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-white/15 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">جاري معالجة وتصدير الصور...</h3>
                <p className="text-xs text-slate-400 mt-1">{exportProgress.text}</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>المكتمل: {exportProgress.current}</span>
                  <span>الإجمالي: {exportProgress.total}</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500">
                يرجى الانتظار، تتم معالجة الصور بدقة عالية لضمان مطابقتها التامة للأبعاد المطلوبة.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
