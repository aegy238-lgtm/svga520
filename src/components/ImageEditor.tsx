import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserRecord } from '../types';
import { 
  Download, 
  Upload, 
  X, 
  Sliders, 
  Image as ImageIcon, 
  Sparkles, 
  Wand2, 
  Plus, 
  User, 
  Square, 
  Circle, 
  Trash2, 
  Maximize, 
  Move, 
  Layers, 
  Check, 
  FolderArchive,
  RefreshCw,
  Eye,
  Crop,
  ZoomIn,
  ZoomOut,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import JSZip from 'jszip';

interface BatchImageItem {
  id: string;
  name: string;
  originalFile?: File;
  imgElement: HTMLImageElement;
  previewDataUrl: string;
  width: number;
  height: number;
  // Per-image crop / zoom / pan overrides
  scale?: number; // Zoom % (e.g., 100)
  posX?: number;  // 0-100%
  posY?: number;  // 0-100%
  hasCustomPosition?: boolean;
}

interface ImageEditorProps {
  currentUser?: UserRecord | null;
  onCancel: () => void;
  onLoginRequired?: () => void;
  onSubscriptionRequired?: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ onCancel }) => {
  // Batch Image List
  const [images, setImages] = useState<BatchImageItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);

  // Global Dimensions
  const [width, setWidth] = useState<number>(500);
  const [height, setHeight] = useState<number>(500);
  const [lockAspect, setLockAspect] = useState<boolean>(false);
  
  // Shape & Edge Styling (Applied to all)
  const [borderRadius, setBorderRadius] = useState<number>(30); // %
  const [edgeSoftness, setEdgeSoftness] = useState<number>(0);   // px blur
  const [autoTransparent, setAutoTransparent] = useState<boolean>(false);
  
  // Default / Global Image Positioning
  const [globalScale, setGlobalScale] = useState<number>(100);
  const [globalPosX, setGlobalPosX] = useState<number>(50);
  const [globalPosY, setGlobalPosY] = useState<number>(50);
  
  // Smart Shadow (Applied to all)
  const [shadowStrength, setShadowStrength] = useState<number>(0); // opacity %
  const [shadowBlur, setShadowBlur] = useState<number>(10);
  const [shadowDistance, setShadowDistance] = useState<number>(5);

  // Overlay (Applied to all)
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(100);
  const [overlayScale, setOverlayScale] = useState<number>(100);
  const [overlayTop, setOverlayTop] = useState<number>(50);
  const [overlayLeft, setOverlayLeft] = useState<number>(50);

  // Export Quality
  const [exportQuality, setExportQuality] = useState<'HIGH_PNG' | 'MEDIUM_WEBP' | 'LOW_WEBP'>('HIGH_PNG');
  
  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // Canvas Drag State for Panning
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const activeImage = images.find(img => img.id === activeImageId) || images[0] || null;

  // Active item position or fallback to global
  const currentScale = (activeImage?.hasCustomPosition && activeImage.scale !== undefined) ? activeImage.scale : globalScale;
  const currentPosX = (activeImage?.hasCustomPosition && activeImage.posX !== undefined) ? activeImage.posX : globalPosX;
  const currentPosY = (activeImage?.hasCustomPosition && activeImage.posY !== undefined) ? activeImage.posY : globalPosY;

  // Core Render Function for any given image item
  const renderProcessedCanvas = useCallback((
    imgItem: BatchImageItem,
    targetWidth: number,
    targetHeight: number
  ): HTMLCanvasElement => {
    const imgElem = imgItem.imgElement;
    const itemScale = (imgItem.hasCustomPosition && imgItem.scale !== undefined) ? imgItem.scale : globalScale;
    const itemPosX = (imgItem.hasCustomPosition && imgItem.posX !== undefined) ? imgItem.posX : globalPosX;
    const itemPosY = (imgItem.hasCustomPosition && imgItem.posY !== undefined) ? imgItem.posY : globalPosY;

    // 1. Process Auto Transparency if enabled
    let sourceImage: CanvasImageSource = imgElem;
    if (autoTransparent) {
      const tCanvas = document.createElement('canvas');
      tCanvas.width = targetWidth;
      tCanvas.height = targetHeight;
      const tCtx = tCanvas.getContext('2d')!;
      tCtx.drawImage(imgElem, 0, 0, targetWidth, targetHeight);
      
      const imgData = tCtx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
          data[i+3] = 0;
        }
      }
      tCtx.putImageData(imgData, 0, 0);
      sourceImage = tCanvas;
    }

    // 2. Prepare Mask for Border Radius & Edge Softness
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = targetWidth;
    maskCanvas.height = targetHeight;
    const mCtx = maskCanvas.getContext('2d')!;
    
    mCtx.fillStyle = 'white';
    mCtx.beginPath();
    if (borderRadius > 0) {
      const radius = (borderRadius / 100) * (Math.min(targetWidth, targetHeight) / 2);
      mCtx.moveTo(radius, 0);
      mCtx.lineTo(targetWidth - radius, 0);
      mCtx.quadraticCurveTo(targetWidth, 0, targetWidth, radius);
      mCtx.lineTo(targetWidth, targetHeight - radius);
      mCtx.quadraticCurveTo(targetWidth, targetHeight, targetWidth - radius, targetHeight);
      mCtx.lineTo(radius, targetHeight);
      mCtx.quadraticCurveTo(0, targetHeight, 0, targetHeight - radius);
      mCtx.lineTo(0, radius);
      mCtx.quadraticCurveTo(0, 0, radius, 0);
    } else {
      mCtx.rect(0, 0, targetWidth, targetHeight);
    }
    mCtx.closePath();
    mCtx.fill();

    if (edgeSoftness > 0) {
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = targetWidth;
      blurCanvas.height = targetHeight;
      const bCtx = blurCanvas.getContext('2d')!;
      bCtx.filter = `blur(${edgeSoftness}px)`;
      bCtx.drawImage(maskCanvas, 0, 0);
      
      mCtx.clearRect(0, 0, targetWidth, targetHeight);
      mCtx.drawImage(blurCanvas, 0, 0);
    }

    // Clip Image to Mask
    mCtx.globalCompositeOperation = 'source-in';
    
    const iw = imgElem.width || 500;
    const ih = imgElem.height || 500;
    
    const defaultScale = Math.max(targetWidth / iw, targetHeight / ih);
    const renderScale = defaultScale * (itemScale / 100);
    
    const swo = iw * renderScale;
    const sho = ih * renderScale;
    
    const px = (itemPosX / 100) * targetWidth - swo / 2;
    const py = (itemPosY / 100) * targetHeight - sho / 2;
    
    mCtx.drawImage(sourceImage, px, py, swo, sho);

    // 3. Final Composition Canvas
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return finalCanvas;
    
    ctx.clearRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    if (shadowStrength > 0) {
      ctx.shadowColor = `rgba(0,0,0,${shadowStrength / 100})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowDistance;
      ctx.shadowOffsetY = shadowDistance;
    }
    
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();

    // 4. Overlay if loaded
    if (overlayImage) {
      ctx.save();
      ctx.globalAlpha = overlayOpacity / 100;
      
      const ow = overlayImage.width * (overlayScale / 100);
      const oh = overlayImage.height * (overlayScale / 100);
      
      const opx = (overlayLeft / 100) * targetWidth - ow / 2;
      const opy = (overlayTop / 100) * targetHeight - oh / 2;
      
      ctx.drawImage(overlayImage, opx, opy, ow, oh);
      ctx.restore();
    }

    return finalCanvas;
  }, [
    autoTransparent,
    borderRadius,
    edgeSoftness,
    globalScale,
    globalPosX,
    globalPosY,
    shadowStrength,
    shadowBlur,
    shadowDistance,
    overlayImage,
    overlayOpacity,
    overlayScale,
    overlayLeft,
    overlayTop
  ]);

  // Update Live Preview for the currently selected active image
  useEffect(() => {
    if (!activeImage) {
      setPreviewUrl(null);
      return;
    }
    try {
      const canvas = renderProcessedCanvas(activeImage, width, height);
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error("Preview render failed:", e);
    }
  }, [activeImage, width, height, renderProcessedCanvas]);

  // File Upload Handlers
  const handleFilesUpload = (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArr.length === 0) return;

    let loadedCount = 0;
    const newItems: BatchImageItem[] = [];

    fileArr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          newItems.push({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name.replace(/\.[^/.]+$/, ""),
            originalFile: file,
            imgElement: img,
            previewDataUrl: dataUrl,
            width: img.width,
            height: img.height,
            scale: 100,
            posX: 50,
            posY: 50,
            hasCustomPosition: false
          });

          loadedCount++;
          if (loadedCount === fileArr.length) {
            setImages(prev => {
              const updated = [...prev, ...newItems];
              if (!activeImageId && updated.length > 0) {
                setActiveImageId(updated[0].id);
                if (prev.length === 0) {
                  setWidth(updated[0].width || 500);
                  setHeight(updated[0].height || 500);
                }
              }
              return updated;
            });
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setOverlayImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Update Position for Active Image or Global
  const updateActivePosition = (updates: { scale?: number; posX?: number; posY?: number }) => {
    if (!activeImageId) {
      if (updates.scale !== undefined) setGlobalScale(updates.scale);
      if (updates.posX !== undefined) setGlobalPosX(updates.posX);
      if (updates.posY !== undefined) setGlobalPosY(updates.posY);
      return;
    }

    setImages(prev => prev.map(img => {
      if (img.id === activeImageId) {
        return {
          ...img,
          scale: updates.scale !== undefined ? updates.scale : (img.scale ?? globalScale),
          posX: updates.posX !== undefined ? updates.posX : (img.posX ?? globalPosX),
          posY: updates.posY !== undefined ? updates.posY : (img.posY ?? globalPosY),
          hasCustomPosition: true
        };
      }
      return img;
    }));
  };

  // Apply current position to all images in batch
  const handleApplyPositionToAll = () => {
    if (!activeImage) return;
    const s = activeImage.scale ?? globalScale;
    const x = activeImage.posX ?? globalPosX;
    const y = activeImage.posY ?? globalPosY;

    setGlobalScale(s);
    setGlobalPosX(x);
    setGlobalPosY(y);

    setImages(prev => prev.map(img => ({
      ...img,
      scale: s,
      posX: x,
      posY: y,
      hasCustomPosition: false
    })));
  };

  // Reset current image positioning
  const handleResetPosition = () => {
    updateActivePosition({ scale: 100, posX: 50, posY: 50 });
  };

  // Delete single image from batch
  const handleDeleteImage = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      if (activeImageId === id) {
        setActiveImageId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  // Download Single Image
  const handleDownloadSingle = () => {
    if (!activeImage || !previewUrl) return;
    const canvas = renderProcessedCanvas(activeImage, width, height);

    let mime = 'image/png';
    let qual = 1.0;
    let ext = 'png';
    
    if (exportQuality === 'MEDIUM_WEBP') {
      mime = 'image/webp'; qual = 0.8; ext = 'webp';
    } else if (exportQuality === 'LOW_WEBP') {
      mime = 'image/webp'; qual = 0.5; ext = 'webp';
    }

    const url = canvas.toDataURL(mime, qual);
    const link = document.createElement('a');
    link.download = `${activeImage.name || 'processed_image'}_custom.${ext}`;
    link.href = url;
    link.click();
  };

  // Download All Images as ZIP (Batch Processing)
  const handleDownloadBatchZip = async () => {
    if (images.length === 0) return;
    setIsExportingZip(true);
    setExportProgress({ current: 0, total: images.length });

    try {
      const zip = new JSZip();
      let mime = 'image/png';
      let qual = 1.0;
      let ext = 'png';
      
      if (exportQuality === 'MEDIUM_WEBP') {
        mime = 'image/webp'; qual = 0.8; ext = 'webp';
      } else if (exportQuality === 'LOW_WEBP') {
        mime = 'image/webp'; qual = 0.5; ext = 'webp';
      }

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        setExportProgress({ current: i + 1, total: images.length });
        
        const canvas = renderProcessedCanvas(item, width, height);
        
        // Convert to Blob or Base64
        const dataUrl = canvas.toDataURL(mime, qual);
        const base64Data = dataUrl.split(',')[1];
        
        const fileName = `${String(i + 1).padStart(2, '0')}_${item.name || 'image'}.${ext}`;
        zip.file(fileName, base64Data, { base64: true });

        // Short yield for smooth UI progress
        await new Promise(res => setTimeout(res, 20));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.download = `batch_images_${images.length}_items_${Date.now()}.zip`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate ZIP:", err);
      alert("حدث خطأ أثناء تصدير حزمة الصور. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsExportingZip(false);
      setExportProgress(null);
    }
  };

  // Drag & Pan handlers on Canvas Preview
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (!activeImage) return;
    setIsDraggingCanvas(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: currentPosX,
      startPosY: currentPosY
    };
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!isDraggingCanvas || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Convert pixel delta to percentage offset based on width/height
    const deltaXPercent = (dx / (width * 0.7)) * 50;
    const deltaYPercent = (dy / (height * 0.7)) * 50;

    const newX = Math.max(0, Math.min(100, Math.round(dragStartRef.current.startPosX + deltaXPercent)));
    const newY = Math.max(0, Math.min(100, Math.round(dragStartRef.current.startPosY + deltaYPercent)));

    updateActivePosition({ posX: newX, posY: newY });
  };

  const handleMouseUpCanvas = () => {
    setIsDraggingCanvas(false);
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f1c] flex flex-col font-sans transition-colors duration-300 select-none">
      
      {/* Top Header Bar */}
      <div className="h-16 bg-[#040812] border-b border-indigo-500/10 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black tracking-wide text-base">Smart Batch Image Studio</h1>
              {images.length > 0 && (
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-black rounded-full border border-indigo-500/30">
                  {images.length} {images.length === 1 ? 'صورة' : 'صور'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-indigo-400 font-medium tracking-wide">
              معالجة جماعية للصور، ضبط وتطبيق الأشكال والتأثيرات، وتحديد موضع الجزء المطلوب لكل صورة بدقة
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {images.length > 1 && (
            <button 
              onClick={handleDownloadBatchZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
            >
              {isExportingZip ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري تصدير {exportProgress?.current}/{exportProgress?.total}...</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>تصدير الكل (ZIP)</span>
                </>
              )}
            </button>
          )}

          <button 
            onClick={onCancel} 
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-colors border border-white/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 md:p-6 gap-6 justify-center items-start max-w-[1700px] mx-auto w-full">
        
        {/* Left Sidebar - Properties & Controls Panel */}
        <div className="w-[440px] bg-[#0d1425] border border-white/5 flex flex-col shrink-0 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar h-[calc(100vh-100px)]">
            
            {/* 1. Batch Upload & Main Image */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  <span>1. رفع الصور (Batch Upload)</span>
                </span>
                <button 
                  onClick={() => setAutoTransparent(!autoTransparent)} 
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors border cursor-pointer ${
                    autoTransparent 
                      ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-glow-indigo' 
                      : 'bg-[#1a233a] text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3" /> شفافية تلقائية
                </button>
              </div>

              {/* Upload Multi-Files Button & Drop Area */}
              <div className="flex items-center gap-2 bg-[#0a0f1c] p-2.5 rounded-2xl border border-white/5">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files) handleFilesUpload(e.target.files);
                  }} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white rounded-xl transition-all shadow-md shadow-indigo-600/30 whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>رفع مجموعة صور</span>
                </button>
                <div className="flex-1 min-w-0 text-left px-2">
                  <span className="text-[11px] text-slate-300 font-bold block truncate">
                    {images.length > 0 ? `${images.length} صورة محملة` : 'لم يتم اختيار ملفات'}
                  </span>
                  <span className="text-[9px] text-slate-500 block truncate">
                    يدعم رفع عدد كبير معاً
                  </span>
                </div>
                {images.length > 0 && (
                  <button
                    onClick={() => {
                      setImages([]);
                      setActiveImageId(null);
                    }}
                    title="حذف جميع الصور"
                    className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Target Dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 text-right">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">الارتفاع (Height px)</label>
                  <input 
                    type="number" 
                    value={height} 
                    onChange={e => setHeight(Math.max(50, Number(e.target.value)))} 
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-right text-white font-mono focus:border-indigo-500 outline-none transition-colors" 
                  />
                </div>
                <div className="space-y-1 text-right">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">العرض (Width px)</label>
                  <input 
                    type="number" 
                    value={width} 
                    onChange={e => setWidth(Math.max(50, Number(e.target.value)))} 
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-right text-white font-mono focus:border-indigo-500 outline-none transition-colors" 
                  />
                </div>
              </div>

              {/* Individual Image Part / Crop / Framing Selector */}
              {activeImage && (
                <div className="space-y-3.5 pt-3 bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5">
                      <Crop className="w-3.5 h-3.5" />
                      <span>تحديد الجزء المعين في الصورة:</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                      {activeImage.name}
                    </span>
                  </div>

                  {/* Zoom / Scale */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1.5 text-slate-300">
                      <span>التقريب والتكبير (Zoom / Scale)</span>
                      <span className="font-mono text-emerald-400">{currentScale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="20" 
                      max="400" 
                      value={currentScale} 
                      onChange={e => updateActivePosition({ scale: Number(e.target.value) })} 
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full" 
                    />
                  </div>

                  {/* X and Y Position */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1 text-slate-300">
                        <span>الموضع الأفقي X</span>
                        <span className="font-mono text-emerald-400">{currentPosX}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={currentPosX} 
                        onChange={e => updateActivePosition({ posX: Number(e.target.value) })} 
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1 text-slate-300">
                        <span>الموضع الرأسي Y</span>
                        <span className="font-mono text-emerald-400">{currentPosY}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={currentPosY} 
                        onChange={e => updateActivePosition({ posY: Number(e.target.value) })} 
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                      />
                    </div>
                  </div>

                  {/* Action Buttons for Crop / Framing */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResetPosition}
                      className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-black rounded-lg transition-colors border border-white/5 cursor-pointer flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>إعادة للتوسيط</span>
                    </button>
                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={handleApplyPositionToAll}
                        className="flex-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg transition-colors border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>تطبيق الموضع للكل</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-white/5 w-full"></div>

            {/* 2. Shape & Edges (Applied across ALL images) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-pink-400" />
                  <span>2. الشكل والحواف (Shape & Edges)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-bold">يطبق على كل الصور</span>
              </div>
              
              {/* Shape Presets */}
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => { setBorderRadius(0); setEdgeSoftness(0); }} 
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-xl border transition-all cursor-pointer ${
                    borderRadius === 0 && edgeSoftness === 0
                      ? 'bg-pink-500/20 border-pink-500/50 text-white font-black'
                      : 'bg-[#0a0f1c] hover:bg-[#1a233a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Square className="w-4 h-4" /> 
                  <span className="text-[9px] font-bold">مربع (Square)</span>
                </button>
                <button 
                  onClick={() => { setBorderRadius(25); setEdgeSoftness(0); }} 
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-xl border transition-all cursor-pointer ${
                    borderRadius === 25 && edgeSoftness === 0
                      ? 'bg-pink-500/20 border-pink-500/50 text-white font-black'
                      : 'bg-[#0a0f1c] hover:bg-[#1a233a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="w-4 h-4 border-2 border-current rounded-md"></div> 
                  <span className="text-[9px] font-bold">منحني (Rounded)</span>
                </button>
                <button 
                  onClick={() => { setBorderRadius(100); setEdgeSoftness(0); }} 
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-xl border transition-all cursor-pointer ${
                    borderRadius === 100 && edgeSoftness === 0
                      ? 'bg-pink-500/20 border-pink-500/50 text-white font-black'
                      : 'bg-[#0a0f1c] hover:bg-[#1a233a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Circle className="w-4 h-4" /> 
                  <span className="text-[9px] font-bold">دائري (Circle)</span>
                </button>
                <button 
                  onClick={() => { setBorderRadius(100); setEdgeSoftness(15); }} 
                  className={`py-2 flex flex-col items-center justify-center gap-1 rounded-xl border transition-all cursor-pointer ${
                    edgeSoftness > 0
                      ? 'bg-pink-500/20 border-pink-500/50 text-white font-black'
                      : 'bg-[#0a0f1c] hover:bg-[#1a233a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-4 h-4" /> 
                  <span className="text-[9px] font-bold">ناعم (Soft)</span>
                </button>
              </div>

              {/* Border Radius Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-slate-200">تدوير الحواف (Border Radius)</span>
                  <span className="text-pink-400 font-mono">{borderRadius}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={borderRadius} 
                  onChange={(e) => setBorderRadius(Number(e.target.value))} 
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer accent-pink-500" 
                />
              </div>
              
              {/* Edge Softness / Feathering Blur */}
              <div>
                <div className="flex justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-slate-200">تنعيم وتلاشي الأطراف (Edge Softness)</span>
                  <span className="text-pink-400 font-mono">{edgeSoftness}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={edgeSoftness} 
                  onChange={(e) => setEdgeSoftness(Number(e.target.value))} 
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer accent-pink-500" 
                />
              </div>
            </div>

            <div className="h-px bg-white/5 w-full"></div>

            {/* 3. Smart Shadow */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>3. الظل الذكي (Smart Shadow)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3.5">
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-1.5 text-cyan-400">
                    <span className="text-slate-300">قوة وشفافية الظل (Strength)</span>
                    <span className="font-mono">{shadowStrength}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={shadowStrength} 
                    onChange={e => setShadowStrength(Number(e.target.value))} 
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1 text-cyan-400">
                      <span className="text-slate-300">انتشار (Blur)</span>
                      <span className="font-mono">{shadowBlur}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={shadowBlur} 
                      onChange={e => setShadowBlur(Number(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-cyan-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1 text-cyan-400">
                      <span className="text-slate-300">المسافة (Distance)</span>
                      <span className="font-mono">{shadowDistance}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="-50" 
                      max="50" 
                      value={shadowDistance} 
                      onChange={e => setShadowDistance(Number(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-cyan-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5 w-full"></div>

            {/* 4. Overlay (Optional) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>4. طبقة مضافة (Overlay Optional)</span>
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#0a0f1c] p-2 rounded-xl border border-white/5 flex-wrap">
                <input 
                  type="file" 
                  ref={overlayInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleOverlayUpload} 
                />
                <button 
                  onClick={() => overlayInputRef.current?.click()} 
                  className="px-4 py-2 bg-[#1a233a] hover:bg-[#222e4a] text-xs font-bold text-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  اختيار ملف
                </button>
                <span className="text-[11px] text-slate-400 truncate flex-1" dir="auto">
                  {overlayImage ? 'تم تحميل الطبقة' : 'لا يوجد ملف'}
                </span>
                {overlayImage && (
                  <button 
                    onClick={() => setOverlayImage(null)} 
                    className="p-1 px-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {overlayImage && (
                <div className="space-y-3.5 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1 text-purple-400">
                      <span className="text-slate-300">الشفافية (Opacity)</span>
                      <span className="font-mono">{overlayOpacity}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={overlayOpacity} 
                      onChange={e => setOverlayOpacity(Number(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full" 
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1 text-purple-400">
                      <span className="text-slate-300">الحجم (Scale)</span>
                      <span className="font-mono">{overlayScale}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="300" 
                      value={overlayScale} 
                      onChange={e => setOverlayScale(Number(e.target.value))} 
                      className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1 text-purple-400">
                        <span className="text-slate-300">موضع X</span>
                        <span className="font-mono">{overlayLeft}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={overlayLeft} 
                        onChange={e => setOverlayLeft(Number(e.target.value))} 
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-bold mb-1 text-purple-400">
                        <span className="text-slate-300">موضع Y</span>
                        <span className="font-mono">{overlayTop}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={overlayTop} 
                        onChange={e => setOverlayTop(Number(e.target.value))} 
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-purple-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-white/5 w-full"></div>

            {/* 5. Export & Download Controls */}
            <div className="space-y-4 pb-4">
              <div className="flex justify-between items-center text-sm font-black text-white">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>5. التصدير والتحميل (Export)</span>
                </span>
              </div>
              
              <div className="flex bg-[#0a0f1c] rounded-2xl p-1 border border-white/5 gap-1">
                <button 
                  onClick={() => setExportQuality('HIGH_PNG')} 
                  className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                    exportQuality === 'HIGH_PNG' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' 
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  HIGH (PNG)
                </button>
                <button 
                  onClick={() => setExportQuality('MEDIUM_WEBP')} 
                  className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                    exportQuality === 'MEDIUM_WEBP' 
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm' 
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  MEDIUM (WEBP)
                </button>
                <button 
                  onClick={() => setExportQuality('LOW_WEBP')} 
                  className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all cursor-pointer ${
                    exportQuality === 'LOW_WEBP' 
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm' 
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  LOW (WEBP)
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                {/* Download Single Image */}
                <button 
                  onClick={handleDownloadSingle} 
                  disabled={!previewUrl} 
                  className={`w-full py-3.5 text-xs font-black tracking-wide rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                    previewUrl 
                      ? 'bg-[#1e293b] hover:bg-[#334155] text-white cursor-pointer active:scale-98 border border-white/10' 
                      : 'bg-[#1a233a] text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Download className="w-4 h-4 text-slate-300" />
                  <span>تحميل الصورة الحالية ({exportQuality.includes('PNG') ? 'PNG' : 'WEBP'})</span>
                </button>

                {/* Download All as ZIP */}
                {images.length > 1 && (
                  <button 
                    onClick={handleDownloadBatchZip} 
                    disabled={isExportingZip} 
                    className="w-full py-4 text-xs font-black tracking-wide rounded-2xl transition-all shadow-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                  >
                    {isExportingZip ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري ضغط وتنزيل {exportProgress?.current}/{exportProgress?.total} صورة...</span>
                      </>
                    ) : (
                      <>
                        <FolderArchive className="w-4 h-4" />
                        <span>تحميل جميع الصور ({images.length}) كملف مضغوط ZIP</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
          </div>
        </div>

        {/* Center Main Stage / Canvas Viewport */}
        <div className="flex-1 bg-[#0d1425] rounded-3xl border border-white/5 overflow-hidden relative flex flex-col items-center justify-between shadow-2xl p-6 h-[calc(100vh-100px)]">
          
          {/* Top Canvas Toolbar */}
          <div className="w-full flex items-center justify-between z-20 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">
                {activeImage ? activeImage.name : 'مساحة المعاينة'}
              </span>
              {activeImage?.hasCustomPosition && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/30">
                  تحديد مخصص للموضع
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-white/5 rounded-xl border border-white/5">
                📐 {width} × {height} px
              </span>
            </div>
          </div>

          {/* Interactive Canvas Canvas Area */}
          <div 
            className="w-full flex-1 flex flex-col items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDownCanvas}
            onMouseMove={handleMouseMoveCanvas}
            onMouseUp={handleMouseUpCanvas}
            onMouseLeave={handleMouseUpCanvas}
            title={activeImage ? "اضغط واسحب داخل مساحة المعاينة لتحريك وموضع الصورة داخل الشكل" : undefined}
          >
            <div className="absolute inset-2 bg-[#0a0f1c]/50 rounded-2xl border border-white/5"></div>
            
            {images.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 z-10 cursor-pointer hover:text-slate-400 transition-colors"
              >
                <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 border-dashed group hover:scale-105 transition-transform shadow-inner">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="text-center font-medium">
                  <p className="text-base font-bold text-white mb-1">ارفع دفعة صور لبدء المعالجة والتعديل</p>
                  <p className="text-xs text-slate-400">سحب وإفلات أو اضغط لاختيار عدد غير محدود من الصور</p>
                </div>
              </div>
            )}
            
            {previewUrl && (
              <div 
                className="relative max-w-[92%] max-h-[92%] object-contain rounded-2xl drop-shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-20 checker-bg-div flex items-center justify-center" 
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h10v10H0zm10 10h10v10H10z\' fill=\'%231a233a\'/%3E%3Cpath d=\'M10 0h10v10H10zM0 10h10v10H0z\' fill=\'%230f172a\'/%3E%3C/svg%3E")'
                }}
              >
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-[55vh] object-contain pointer-events-none rounded" 
                  style={{ animation: 'fadeIn 0.25s ease-out forwards' }} 
                />

                {/* Move Hint Overlay on Hover */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-bold text-slate-300 pointer-events-none flex items-center gap-1 border border-white/10 opacity-75">
                  <Move className="w-3 h-3 text-emerald-400" />
                  <span>اسحب لتحريك الموضع</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Thumbnails Carousel Strip for Batch Selection */}
          {images.length > 0 && (
            <div className="w-full bg-[#0a0f1c]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3 z-20 flex flex-col gap-2 mt-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-slate-300">
                    مكتبة الصور المرفوعة ({images.length})
                  </span>
                  <span className="text-[9px] text-slate-500">
                    (انقر على أي صورة لتحديد الجزء الخاص بها)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    ref={addMoreInputRef} 
                    className="hidden" 
                    multiple 
                    accept="image/*" 
                    onChange={(e) => {
                      if (e.target.files) handleFilesUpload(e.target.files);
                    }} 
                  />
                  <button
                    onClick={() => addMoreInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg transition-colors border border-white/5 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة المزيد</span>
                  </button>
                </div>
              </div>

              {/* Thumbnails Row */}
              <div className="flex items-center gap-2.5 overflow-x-auto custom-scrollbar py-1">
                {images.map((imgItem, idx) => {
                  const isSelected = imgItem.id === activeImageId;
                  return (
                    <div
                      key={imgItem.id}
                      onClick={() => setActiveImageId(imgItem.id)}
                      className={`relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected 
                          ? 'border-indigo-500 shadow-glow-indigo scale-105 bg-indigo-950/40' 
                          : 'border-white/10 hover:border-white/30 bg-slate-900'
                      }`}
                    >
                      <img 
                        src={imgItem.previewDataUrl} 
                        alt={imgItem.name} 
                        className="w-full h-full object-cover" 
                      />
                      
                      {/* Index badge */}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[8px] font-mono font-bold text-white pointer-events-none">
                        {idx + 1}
                      </div>

                      {/* Custom position indicator badge */}
                      {imgItem.hasCustomPosition && (
                        <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-emerald-400 shadow-glow-emerald" title="موضع مخصص"></div>
                      )}

                      {/* Delete icon */}
                      <button
                        onClick={(e) => handleDeleteImage(imgItem.id, e)}
                        className="absolute top-1 right-1 p-1 bg-rose-500/80 hover:bg-rose-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="حذف هذه الصورة"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <style>{`
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            .checker-bg-div { box-shadow: 0 0 0 1px rgba(255,255,255,0.05); }
          `}</style>
          
        </div>
      </div>
    </div>
  );
};
