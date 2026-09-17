import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Move,
  RotateCw,
  Type,
  Maximize2,
  Sliders,
  Palette,
  Image as ImageIcon,
  Copy,
  Search,
  Eye,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  FileArchive,
  Grid,
  Check,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Hash,
  ListOrdered,
  Box,
  Sun,
  ShieldCheck,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import JSZip from 'jszip';
import { DetectedElement } from '../utils/smartImageSegmentation';
import {
  IconLabelConfig,
  DEFAULT_LABEL_CONFIG,
  AVAILABLE_FONTS,
  GRADIENT_PRESETS,
  GradientPresetKey,
  LabelValidationReport,
  auditAndValidateLabels,
  formatIconText,
  formatIconFilename,
  renderLabelOnContext,
  renderLabeledIconCanvas
} from '../utils/smartIconLabelingEngine';

interface SmartIconLabelingModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: DetectedElement[];
  originalImage: HTMLImageElement | null;
  imageFileName?: string;
  onApplyLabelsToSheet?: (config: IconLabelConfig) => void;
}

type TabKey = 'editor' | 'review' | 'reorder';
type SettingsSubTab = 'numbering' | 'position' | 'style3d' | 'colors';

export const SmartIconLabelingModal: React.FC<SmartIconLabelingModalProps> = ({
  isOpen,
  onClose,
  elements: initialElements,
  originalImage,
  imageFileName = 'Icons',
  onApplyLabelsToSheet
}) => {
  // Ordered elements state
  const [elements, setElements] = useState<DetectedElement[]>(initialElements);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<TabKey>('editor');
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('numbering');

  // Label Configuration
  const [config, setConfig] = useState<IconLabelConfig>({
    ...DEFAULT_LABEL_CONFIG,
    // Auto-detect best start number
    startNumber: 0
  });

  // Custom text list string for textarea
  const [customListText, setCustomListText] = useState<string>('');

  // Texture image upload state
  const [textureName, setTextureName] = useState<string>('');
  const textureInputRef = useRef<HTMLInputElement>(null);

  // Zoom & Pan inside Master Editor
  const [zoom, setZoom] = useState<number>(2.5); // Start zoomed for easy text positioning
  const [isDraggingText, setIsDraggingText] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [bgMode, setBgMode] = useState<'checkered' | 'dark' | 'white'>('checkered');

  // Review Filter & Search
  const [reviewSearch, setReviewSearch] = useState<string>('');

  // Batch Exporting State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Sync elements when prop changes
  useEffect(() => {
    setElements(initialElements);
    if (initialElements.length > 0 && selectedIndex >= initialElements.length) {
      setSelectedIndex(0);
    }
  }, [initialElements]);

  // Selected Master Icon
  const selectedElement = elements[selectedIndex] || elements[0] || null;

  // Real-time Audit & Validation Report (Single Source of Truth)
  const validationReport: LabelValidationReport = useMemo(() => {
    return auditAndValidateLabels(elements, config);
  }, [elements, config]);

  // Texture Upload Handler
  const handleTextureUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setTextureName(file.name);
      setConfig(prev => ({
        ...prev,
        styleType: 'texture',
        textureImageUrl: url,
        textureImageElement: img
      }));
    };
    img.src = url;
  };

  // Live Canvas Rendering Effect
  useEffect(() => {
    if (!previewCanvasRef.current || !originalImage || !selectedElement) return;

    const canvas = previewCanvasRef.current;
    canvas.width = Math.max(1, selectedElement.width);
    canvas.height = Math.max(1, selectedElement.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Original Cropped Image
    ctx.drawImage(
      originalImage,
      selectedElement.x,
      selectedElement.y,
      selectedElement.width,
      selectedElement.height,
      0,
      0,
      selectedElement.width,
      selectedElement.height
    );

    // 2. Render Text / Number with 3D and effects
    const labelText = formatIconText(selectedIndex, config);
    renderLabelOnContext(ctx, labelText, selectedElement.width, selectedElement.height, config);
  }, [originalImage, selectedElement, selectedIndex, config]);

  // Interactive Dragging on Master Icon Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedElement) return;
    setIsDraggingText(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingText || !selectedElement || !canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    // Calculate relative mouse position in container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to percentage of icon box
    const pctX = Math.max(0, Math.min(100, Math.round((mouseX / rect.width) * 100)));
    const pctY = Math.max(0, Math.min(100, Math.round((mouseY / rect.height) * 100)));

    setConfig(prev => ({
      ...prev,
      positionX: pctX,
      positionY: pctY
    }));
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingText(false);
  };

  // Re-ordering Handlers
  const handleMoveElement = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === elements.length - 1)
    ) {
      return;
    }

    const newElements = [...elements];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newElements[index];
    newElements[index] = newElements[targetIndex];
    newElements[targetIndex] = temp;

    setElements(newElements);
    setSelectedIndex(targetIndex);
  };

  // Batch Export all labeled icons to ZIP
  const handleExportZip = async () => {
    if (!originalImage || elements.length === 0) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText('جاري إنشاء حزمة الصور المرقمة بدقة فائقة...');

    try {
      const zip = new JSZip();
      const folder = zip.folder(`${imageFileName}_Numbered_Icons`) || zip;
      const total = elements.length;

      // Temporary offscreen canvas
      const offscreenCanvas = document.createElement('canvas');

      for (let i = 0; i < total; i++) {
        const el = elements[i];
        const labelText = formatIconText(i, config);
        const filename = formatIconFilename(i, config, 'png');

        renderLabeledIconCanvas(originalImage, el, labelText, config, offscreenCanvas);

        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          offscreenCanvas.toBlob(resolve, 'image/png');
        });

        if (blob) {
          folder.file(filename, blob);
        }

        const pct = Math.round(((i + 1) / total) * 90);
        setExportProgress(pct);
        setExportStatusText(`قص وترقيم الأيقونة ${i + 1} من ${total} (${filename})`);

        if (i % 8 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      setExportStatusText('جاري ضغط وتنزيل ملف ZIP...');
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => {
          setExportProgress(90 + Math.round(meta.percent * 0.1));
        }
      );

      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${imageFileName}_Numbered_${elements.length}_Icons.zip`;
      link.click();
      URL.revokeObjectURL(downloadUrl);

      setExportProgress(100);
      setExportStatusText('تم التصدير والتحميل بنجاح!');
      setTimeout(() => {
        setIsExporting(false);
      }, 1200);
    } catch (err) {
      console.error('Batch label export failed:', err);
      alert('حدث خطأ أثناء تصدير الأيقونات');
      setIsExporting(false);
    }
  };

  // Single Icon Download
  const handleDownloadSingleIcon = (index: number) => {
    if (!originalImage || !elements[index]) return;
    const el = elements[index];
    const labelText = formatIconText(index, config);
    const filename = formatIconFilename(index, config, 'png');

    const canvas = renderLabeledIconCanvas(originalImage, el, labelText, config);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  // Download Composite Full Sheet with All Labels
  const handleDownloadFullSheet = () => {
    if (!originalImage || elements.length === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw full background original image
    ctx.drawImage(originalImage, 0, 0);

    // Draw labels onto all icons
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const text = formatIconText(i, config);

      ctx.save();
      // Translate to element top-left
      ctx.translate(el.x, el.y);
      renderLabelOnContext(ctx, text, el.width, el.height, config);
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${imageFileName}_Full_Numbered_Sheet.png`;
    a.click();
  };

  // Filtered list in review
  const filteredReviewItems = validationReport.items.filter(item => {
    if (!reviewSearch.trim()) return true;
    const q = reviewSearch.trim().toLowerCase();
    return (
      item.computedLabel.toLowerCase().includes(q) ||
      item.filename.toLowerCase().includes(q) ||
      String(item.index).includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#080d1a]/95 backdrop-blur-xl flex flex-col font-sans select-none overflow-hidden text-slate-100" dir="rtl">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 bg-[#0b1222] px-6 flex items-center justify-between shrink-0 z-30 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#0b1222] rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-base font-black text-white">
                نظام ترقيم وتسمية الأيقونات الذكي
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <Box className="w-3 h-3 text-amber-400" />
                <span>Smart 3D Icon Labeling</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden md:block">
              تحديد مكان النص ورسم الأرقام والأسماء بتأثيرات 3D ونقلها لجميع الأيقونات مع التحقق التلقائي
            </p>
          </div>
        </div>

        {/* Mode Navigation Tabs in Center/Header */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>محرر النموذج والـ 3D</span>
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'review'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>المعاينة والتدقيق ({elements.length})</span>
            {validationReport.isValid ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('reorder')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'reorder'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>إدارة وترتيب الأيقونات</span>
          </button>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-3">
          {/* Quick Sheet Download */}
          <button
            onClick={handleDownloadFullSheet}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer hidden lg:flex"
            title="تنزيل الشيت الكامل الأصلي وعليه كافة الأرقام والتأثيرات"
          >
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>تنزيل الشيت كامل</span>
          </button>

          {/* Master Export Button */}
          <button
            onClick={handleExportZip}
            disabled={isExporting || elements.length === 0}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>قص وتصدير حزمة ZIP ({elements.length} أيقونة)</span>
          </button>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIEW TAB 1: MASTER TEMPLATE EDITOR */}
        {activeTab === 'editor' && (
          <>
            {/* Center Canvas Stage */}
            <div className="flex-1 flex flex-col bg-[#060a14] relative overflow-hidden">
              {/* Canvas Top Bar */}
              <div className="h-12 border-b border-white/10 bg-[#090f1d] px-4 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    الأيقونة النشطة:
                  </span>
                  <span className="font-mono text-xs font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    أيقونة #{selectedIndex} (العنصر {selectedIndex + 1} من {elements.length})
                  </span>
                  {selectedElement && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      {selectedElement.width} × {selectedElement.height} px
                    </span>
                  )}
                </div>

                {/* Quick Prev / Next Icon Navigation */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
                    disabled={selectedIndex === 0}
                    className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-slate-300 cursor-pointer"
                    title="الأيقونة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-mono font-bold text-white">
                    {selectedIndex + 1} / {elements.length}
                  </span>
                  <button
                    onClick={() => setSelectedIndex(prev => Math.min(elements.length - 1, prev + 1))}
                    disabled={selectedIndex === elements.length - 1}
                    className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-slate-300 cursor-pointer"
                    title="الأيقونة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* Zoom & View Options */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-0.5">
                    <button
                      onClick={() => setZoom(prev => Math.max(0.5, prev - 0.5))}
                      className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-[11px] font-mono font-bold text-slate-300">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom(prev => Math.min(6, prev + 0.5))}
                      className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setShowGrid(prev => !prev)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      showGrid ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' : 'bg-white/5 border-white/10 text-slate-400'
                    }`}
                    title="إظهار/إخفاء خطوط الإرشاد وشبكة المحاذاة"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="text-[11px]">الشبكة</span>
                  </button>
                </div>
              </div>

              {/* Interactive Canvas Viewport */}
              <div 
                className="flex-1 flex items-center justify-center p-8 overflow-auto relative"
                style={{
                  backgroundImage: bgMode === 'checkered'
                    ? 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)'
                    : undefined,
                  backgroundSize: '16px 16px',
                  backgroundColor: bgMode === 'dark' ? '#030712' : bgMode === 'white' ? '#f8fafc' : '#060a14'
                }}
              >
                {selectedElement ? (
                  <div
                    ref={canvasContainerRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="relative transition-transform duration-75 shadow-2xl rounded-2xl border border-white/20 select-none group cursor-crosshair"
                    style={{
                      width: selectedElement.width * zoom,
                      height: selectedElement.height * zoom,
                      boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 20px rgba(245, 158, 11, 0.15)'
                    }}
                  >
                    {/* Live Rendered Canvas */}
                    <canvas
                      ref={previewCanvasRef}
                      className="w-full h-full object-contain rounded-2xl"
                    />

                    {/* Interactive Guidelines / Crosshairs */}
                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
                        {/* Horizontal Center Line */}
                        <div 
                          className="absolute w-full h-[1px] bg-amber-400/40 border-b border-dashed border-amber-400/60"
                          style={{ top: `${config.positionY}%` }}
                        />
                        {/* Vertical Center Line */}
                        <div 
                          className="absolute h-full w-[1px] bg-amber-400/40 border-r border-dashed border-amber-400/60"
                          style={{ left: `${config.positionX}%` }}
                        />
                        {/* Center Target Point Indicator */}
                        <div 
                          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 bg-amber-500/30 flex items-center justify-center shadow-lg"
                          style={{
                            left: `${config.positionX}%`,
                            top: `${config.positionY}%`
                          }}
                        >
                          <div className="w-1 h-1 rounded-full bg-white" />
                        </div>
                      </div>
                    )}

                    {/* Drag Helper Tooltip */}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 px-3 py-1 rounded-full border border-white/10 text-[10px] text-slate-300 pointer-events-none flex items-center gap-1.5 shadow-md">
                      <Move className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>اسحب بالماوس لتغيير مكان الرقم بحرية</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 text-sm">
                    لا توجد أيقونات مكتشفة لعرضها
                  </div>
                )}
              </div>

              {/* Canvas Bottom Coordinates Bar */}
              <div className="h-10 border-t border-white/10 bg-[#090f1d] px-6 flex items-center justify-between text-xs text-slate-400 font-mono z-10 shrink-0">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="text-amber-400 font-bold">X:</span> {config.positionX}%
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="text-amber-400 font-bold">Y:</span> {config.positionY}%
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="text-cyan-400 font-bold">الحجم:</span> {config.fontSizeRatio}%
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="text-emerald-400 font-bold">الزاوية:</span> {config.rotation}°
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>معاينة حية فورية (Live 60FPS)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Settings Panel */}
            <div className="w-96 border-r border-white/10 bg-[#0a101f] flex flex-col shrink-0 z-20 overflow-hidden shadow-2xl">
              {/* Subtabs Header */}
              <div className="grid grid-cols-4 p-2 gap-1 border-b border-white/10 bg-[#070c17] shrink-0">
                <button
                  onClick={() => setSettingsTab('numbering')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    settingsTab === 'numbering'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span>الترقيم</span>
                </button>

                <button
                  onClick={() => setSettingsTab('position')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    settingsTab === 'position'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <Move className="w-4 h-4" />
                  <span>الموضع</span>
                </button>

                <button
                  onClick={() => setSettingsTab('style3d')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    settingsTab === 'style3d'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <Box className="w-4 h-4" />
                  <span>الـ 3D والخط</span>
                </button>

                <button
                  onClick={() => setSettingsTab('colors')}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    settingsTab === 'colors'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  <span>اللون والخامة</span>
                </button>
              </div>

              {/* Scrollable Subtab Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                {/* SUBTAB 1: NUMBERING ENGINE */}
                {settingsTab === 'numbering' && (
                  <div className="space-y-4">
                    {/* Numbering Mode Switch */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">نمط الترقيم / التسمية:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, textMode: 'auto_number' }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            config.textMode === 'auto_number'
                              ? 'bg-amber-500 text-black border-amber-400 shadow-md font-black'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          🔢 ترقيم تسلسلي ذكي
                        </button>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, textMode: 'custom_list' }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            config.textMode === 'custom_list'
                              ? 'bg-amber-500 text-black border-amber-400 shadow-md font-black'
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}
                        >
                          📝 قائمة أسماء مخصصة
                        </button>
                      </div>
                    </div>

                    {config.textMode === 'auto_number' ? (
                      <>
                        {/* Start Number & Step */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300">بداية الترقيم:</label>
                            <input
                              type="number"
                              value={config.startNumber}
                              onChange={e => setConfig(prev => ({ ...prev, startNumber: parseInt(e.target.value, 10) || 0 }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300">الزيادة (Step):</label>
                            <input
                              type="number"
                              min="1"
                              value={config.step}
                              onChange={e => setConfig(prev => ({ ...prev, step: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold font-mono text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        {/* Fast Presets */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-400">إعدادات سريعة جاهزة:</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              onClick={() => setConfig(prev => ({ ...prev, startNumber: 0, paddingDigits: 0, prefix: '', suffix: '' }))}
                              className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[11px] font-bold text-slate-300"
                            >
                              من 0 إلى {elements.length - 1}
                            </button>
                            <button
                              onClick={() => setConfig(prev => ({ ...prev, startNumber: 1, paddingDigits: 0, prefix: '', suffix: '' }))}
                              className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[11px] font-bold text-slate-300"
                            >
                              من 1 إلى {elements.length}
                            </button>
                            <button
                              onClick={() => setConfig(prev => ({ ...prev, startNumber: 100, paddingDigits: 0, prefix: '', suffix: '' }))}
                              className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[11px] font-bold text-slate-300"
                            >
                              من 100 إلى {100 + elements.length - 1}
                            </button>
                          </div>
                        </div>

                        {/* Digits Padding */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <label className="text-xs font-bold text-slate-300">تنسيق الأصفار (Padding):</label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: 'عادي (0)', val: 0 },
                              { label: 'خانة (01)', val: 2 },
                              { label: '3 خانات (001)', val: 3 },
                              { label: '4 خانات (0001)', val: 4 }
                            ].map(p => (
                              <button
                                key={p.val}
                                onClick={() => setConfig(prev => ({ ...prev, paddingDigits: p.val }))}
                                className={`py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all border ${
                                  config.paddingDigits === p.val
                                    ? 'bg-amber-500/30 text-amber-300 border-amber-500'
                                    : 'bg-white/5 text-slate-400 border-white/5'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Prefix & Suffix */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300">بادئة (Prefix):</label>
                            <input
                              type="text"
                              placeholder="مثال: VIP-"
                              value={config.prefix}
                              onChange={e => setConfig(prev => ({ ...prev, prefix: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-300">لاحقة (Suffix):</label>
                            <input
                              type="text"
                              placeholder="مثال: ★ أو px"
                              value={config.suffix}
                              onChange={e => setConfig(prev => ({ ...prev, suffix: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Custom Names List Textarea */
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                          <span>أدخل الأسماء (اسم لكل سطر):</span>
                          <span className="text-[10px] text-amber-400 font-mono">
                            {config.customNamesList.length} / {elements.length} اسم
                          </span>
                        </label>
                        <textarea
                          rows={8}
                          value={customListText}
                          onChange={e => {
                            setCustomListText(e.target.value);
                            const lines = e.target.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                            setConfig(prev => ({ ...prev, customNamesList: lines }));
                          }}
                          placeholder={`المستوى 1\nالمستوى 2\nالتاج الذهبي\nالوسام الملكي...`}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: POSITION & SIZE */}
                {settingsTab === 'position' && (
                  <div className="space-y-4">
                    {/* Quick Position Presets */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">مواضع سريعة جاهزة:</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, positionX: 50, positionY: 20 }))}
                          className="py-1.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-lg border border-white/5"
                        >
                          أعلى المنتصف
                        </button>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, positionX: 50, positionY: 50 }))}
                          className="py-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold rounded-lg border border-amber-500/30"
                        >
                          المنتصف تماماً
                        </button>
                        <button
                          onClick={() => setConfig(prev => ({ ...prev, positionX: 50, positionY: 80 }))}
                          className="py-1.5 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-lg border border-white/5"
                        >
                          أسفل المنتصف
                        </button>
                      </div>
                    </div>

                    {/* Position X Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">الموقع الأفقي (X):</span>
                        <span className="font-mono text-amber-400 font-bold">{config.positionX}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.positionX}
                        onChange={e => setConfig(prev => ({ ...prev, positionX: Number(e.target.value) }))}
                        className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Position Y Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">الموقع الرأسي (Y):</span>
                        <span className="font-mono text-amber-400 font-bold">{config.positionY}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={config.positionY}
                        onChange={e => setConfig(prev => ({ ...prev, positionY: Number(e.target.value) }))}
                        className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Font Size Ratio */}
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">حجم الخط النسبي:</span>
                        <span className="font-mono text-cyan-400 font-bold">{config.fontSizeRatio}% من الارتفاع</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="80"
                        value={config.fontSizeRatio}
                        onChange={e => setConfig(prev => ({ ...prev, fontSizeRatio: Number(e.target.value) }))}
                        className="w-full accent-cyan-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Rotation Angle */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">زاوية الدوران:</span>
                        <span className="font-mono text-emerald-400 font-bold">{config.rotation}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={config.rotation}
                        onChange={e => setConfig(prev => ({ ...prev, rotation: Number(e.target.value) }))}
                        className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Opacity */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-bold">الشفافية (Opacity):</span>
                        <span className="font-mono text-white font-bold">{config.opacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={config.opacity}
                        onChange={e => setConfig(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                        className="w-full accent-white h-2 bg-white/10 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {/* SUBTAB 3: 3D & TYPOGRAPHY */}
                {settingsTab === 'style3d' && (
                  <div className="space-y-4">
                    {/* Font Family Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">نوع الخط (Font Family):</label>
                      <select
                        value={config.fontFamily}
                        onChange={e => setConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                        className="w-full bg-[#070c17] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {AVAILABLE_FONTS.map(f => (
                          <option key={f.family} value={f.family}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3D Master Toggle */}
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                          <Box className="w-4 h-4 text-amber-400" />
                          <span>تفعيل التأثير ثلاثي الأبعاد (3D Text)</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={config.is3D}
                          onChange={e => setConfig(prev => ({ ...prev, is3D: e.target.checked }))}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </div>

                      {config.is3D && (
                        <div className="space-y-3 pt-2 border-t border-amber-500/20">
                          {/* 3D Depth */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-300">عمق البروز (Extrusion):</span>
                              <span className="font-mono text-amber-400 font-bold">{config.depth3D}px</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="20"
                              value={config.depth3D}
                              onChange={e => setConfig(prev => ({ ...prev, depth3D: Number(e.target.value) }))}
                              className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* 3D Angle */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-300">زاوية البروز:</span>
                              <span className="font-mono text-amber-400 font-bold">{config.angle3D}°</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={config.angle3D}
                              onChange={e => setConfig(prev => ({ ...prev, angle3D: Number(e.target.value) }))}
                              className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg cursor-pointer"
                            />
                          </div>

                          {/* 3D Side Color */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">لون الجوانب ثلاثية الأبعاد:</span>
                            <input
                              type="color"
                              value={config.sideColor3D}
                              onChange={e => setConfig(prev => ({ ...prev, sideColor3D: e.target.value }))}
                              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stroke / Outline */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">الحد الخارجي (Stroke / Outline):</span>
                        <input
                          type="checkbox"
                          checked={config.stroke.enabled}
                          onChange={e => setConfig(prev => ({ ...prev, stroke: { ...prev.stroke, enabled: e.target.checked } }))}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer"
                        />
                      </div>
                      {config.stroke.enabled && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">اللون:</span>
                            <input
                              type="color"
                              value={config.stroke.color}
                              onChange={e => setConfig(prev => ({ ...prev, stroke: { ...prev.stroke, color: e.target.value } }))}
                              className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-400">العرض ({config.stroke.width}px):</span>
                            <input
                              type="range"
                              min="1"
                              max="8"
                              value={config.stroke.width}
                              onChange={e => setConfig(prev => ({ ...prev, stroke: { ...prev.stroke, width: Number(e.target.value) } }))}
                              className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shadow & Glow */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="p-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-slate-300">ظل واقعي</span>
                        <input
                          type="checkbox"
                          checked={config.shadow.enabled}
                          onChange={e => setConfig(prev => ({ ...prev, shadow: { ...prev.shadow, enabled: e.target.checked } }))}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </label>
                      <label className="p-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between cursor-pointer">
                        <span className="text-xs font-bold text-slate-300">توهج وإضاءة</span>
                        <input
                          type="checkbox"
                          checked={config.glow.enabled}
                          onChange={e => setConfig(prev => ({ ...prev, glow: { ...prev.glow, enabled: e.target.checked } }))}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* SUBTAB 4: COLORS, GRADIENTS & TEXTURE MATERIAL */}
                {settingsTab === 'colors' && (
                  <div className="space-y-4">
                    {/* Fill Style Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">نوع التلوين والخامة:</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { key: 'gradient', label: 'تدرج ملكي' },
                          { key: 'metallic', label: 'ميتاليك لامع' },
                          { key: 'solid', label: 'لون خالص' },
                          { key: 'texture', label: 'خامة صورة (Material)' }
                        ].map(st => (
                          <button
                            key={st.key}
                            onClick={() => setConfig(prev => ({ ...prev, styleType: st.key as any }))}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              config.styleType === st.key
                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 font-black shadow-md'
                                : 'bg-white/5 text-slate-400 border-white/10'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gradient Presets */}
                    {(config.styleType === 'gradient' || config.styleType === 'metallic') && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300">ألوان التدرج الفاخرة:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(GRADIENT_PRESETS) as GradientPresetKey[]).map(gk => {
                            const preset = GRADIENT_PRESETS[gk];
                            return (
                              <button
                                key={gk}
                                onClick={() => setConfig(prev => ({
                                  ...prev,
                                  gradientPreset: gk,
                                  sideColor3D: preset.side3D
                                }))}
                                className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                  config.gradientPreset === gk
                                    ? 'border-amber-400 bg-amber-500/20 text-white shadow-md'
                                    : 'border-white/5 bg-white/5 text-slate-300 hover:border-white/20'
                                }`}
                              >
                                <div
                                  className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.color1}, ${preset.color2})`
                                  }}
                                />
                                <span className="truncate">{preset.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Solid Color */}
                    {config.styleType === 'solid' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-300">اختر اللون الخالص:</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.solidColor}
                            onChange={e => setConfig(prev => ({ ...prev, solidColor: e.target.value }))}
                            className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={config.solidColor}
                            onChange={e => setConfig(prev => ({ ...prev, solidColor: e.target.value }))}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Texture / Material Upload (Point 8 in requirements) */}
                    {config.styleType === 'texture' && (
                      <div className="space-y-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-amber-400" />
                            <span>استخدام صورة كخامة للنص (Texture)</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          ارفع أي صورة (ورق ذهب، بودرة فضة، ألماس، أو نقش) ليتم استخدامها كخامة حقيقية تغطي أحرف وأرقام النص.
                        </p>

                        <input
                          ref={textureInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleTextureUpload(e.target.files[0]);
                            }
                          }}
                        />

                        <button
                          onClick={() => textureInputRef.current?.click()}
                          className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span>{textureName ? 'تغيير صورة الخامة' : 'رفع صورة خامة النص'}</span>
                        </button>

                        {textureName && (
                          <div className="flex items-center justify-between p-2 bg-black/40 rounded-xl border border-white/10 text-xs">
                            <span className="truncate text-amber-200">{textureName}</span>
                            <span className="text-[10px] text-emerald-400 font-bold">✅ محملة</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Master "Apply to All Icons" Button */}
              <div className="p-4 border-t border-white/10 bg-[#070c17] shrink-0 space-y-2">
                <button
                  onClick={() => {
                    if (onApplyLabelsToSheet) {
                      onApplyLabelsToSheet(config);
                    }
                    alert(`✅ تم تطبيق الإعدادات بنجاح على جميع الأيقونات (${elements.length} أيقونة)!`);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>تطبيق على جميع الأيقونات ({elements.length})</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* VIEW TAB 2: AUDIT & FULL REVIEW */}
        {activeTab === 'review' && (
          <div className="flex-1 flex flex-col bg-[#060a14] overflow-hidden p-6 space-y-6">
            {/* Audit Summary Card */}
            <div className={`p-5 rounded-3xl border flex flex-wrap items-center justify-between gap-4 shadow-xl ${
              validationReport.isValid
                ? 'bg-emerald-950/40 border-emerald-500/30'
                : 'bg-rose-950/40 border-rose-500/40'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  validationReport.isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {validationReport.isValid ? (
                    <ShieldCheck className="w-7 h-7" />
                  ) : (
                    <AlertTriangle className="w-7 h-7" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{validationReport.statusTitle}</h3>
                  <p className="text-xs text-slate-300">{validationReport.statusMessage}</p>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3">
                <div className="bg-black/40 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block">إجمالي الأيقونات</span>
                  <span className="text-sm font-black text-white font-mono">{validationReport.totalIcons}</span>
                </div>
                <div className="bg-black/40 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block">أول رقم</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{validationReport.firstNumber}</span>
                </div>
                <div className="bg-black/40 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block">آخر رقم</span>
                  <span className="text-sm font-black text-amber-400 font-mono">{validationReport.lastNumber}</span>
                </div>
                <div className="bg-black/40 px-3.5 py-2 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block">التكرارات</span>
                  <span className={`text-sm font-black font-mono ${validationReport.duplicates.length > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {validationReport.duplicates.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Search and Action Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث في الأيقونات بالرقم أو الاسم..."
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pr-9 pl-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportZip}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير حزمة ZIP بالكامل</span>
                </button>
              </div>
            </div>

            {/* Review Cards Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-1 custom-scrollbar">
              {filteredReviewItems.map(item => {
                const el = elements[item.index];
                return (
                  <div
                    key={item.elementId}
                    onClick={() => {
                      setSelectedIndex(item.index);
                      setActiveTab('editor');
                    }}
                    className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-between gap-2 cursor-pointer group hover:scale-[1.03] ${
                      selectedIndex === item.index
                        ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/20'
                        : item.hasWarning
                        ? 'bg-rose-500/10 border-rose-500'
                        : 'bg-[#0b1222] border-white/10 hover:border-white/30'
                    }`}
                  >
                    {/* Badge Number Header */}
                    <div className="w-full flex items-center justify-between text-[11px] font-mono">
                      <span className="font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        #{item.index}
                      </span>
                      <span className="text-slate-400 truncate max-w-[80px]">
                        {item.computedLabel}
                      </span>
                    </div>

                    {/* Thumbnail Canvas Preview */}
                    <div 
                      className="w-full h-24 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center overflow-hidden p-1 relative"
                      style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
                        backgroundSize: '8px 8px'
                      }}
                    >
                      {originalImage && el && (
                        <canvas
                          ref={node => {
                            if (node && originalImage) {
                              renderLabeledIconCanvas(originalImage, el, item.computedLabel, config, node);
                            }
                          }}
                          className="max-w-full max-h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Filename & Quick Download */}
                    <div className="w-full flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[85px]">
                        {item.filename}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSingleIcon(item.index);
                        }}
                        className="p-1 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 transition-colors"
                        title="تنزيل هذه الأيقونة"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW TAB 3: REORDER & LIST MANAGEMENT */}
        {activeTab === 'reorder' && (
          <div className="flex-1 flex flex-col bg-[#060a14] p-6 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">إدارة وترتيب الأيقونات المكتشفة</h3>
                <p className="text-xs text-slate-400">
                  يمكنك تحريك أي أيقونة لأعلى أو لأسفل، ويتم تحديث الترقيم التسلسلي فوراً
                </p>
              </div>
              <button
                onClick={() => setElements(initialElements)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 flex items-center gap-1.5 border border-white/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة للترتيب الأصلي</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 p-1 custom-scrollbar">
              {elements.map((el, idx) => {
                const label = formatIconText(idx, config);
                const fname = formatIconFilename(idx, config, 'png');

                return (
                  <div
                    key={el.id}
                    className="p-3 bg-[#0b1222] border border-white/10 rounded-2xl flex items-center justify-between gap-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                        {idx}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white font-mono">{label}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({fname})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          المقاس: {el.width} × {el.height} px
                        </span>
                      </div>
                    </div>

                    {/* Reorder Up / Down Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMoveElement(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 rounded-xl bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveElement(idx, 'down')}
                        disabled={idx === elements.length - 1}
                        className="p-2 rounded-xl bg-white/5 hover:bg-indigo-600/30 text-slate-300 hover:text-white disabled:opacity-20 cursor-pointer"
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Export Progress Modal */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-[#0b1222] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                <FileArchive className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white mb-1">جاري قص وترقيم الأيقونات</h3>
                <p className="text-xs text-slate-400 font-mono">{exportStatusText}</p>
              </div>

              <div className="space-y-2">
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>التقدم الإجمالي</span>
                  <span className="font-bold text-white">{exportProgress}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
