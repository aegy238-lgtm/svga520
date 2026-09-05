import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scissors, 
  Upload, 
  X, 
  Download, 
  Check, 
  Square, 
  CheckSquare, 
  Trash2, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  Sliders, 
  SlidersHorizontal,
  Plus, 
  Move, 
  Eye, 
  Sparkles, 
  FileArchive, 
  Layers, 
  ArrowUpDown,
  Search,
  Settings2,
  Info,
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { UserRecord } from '../types';
import { 
  DetectedElement, 
  DetectionOptions, 
  BackgroundInfo,
  detectObjectsInImage, 
  applyPaddingToElements, 
  cropElementToBlob, 
  generateThumbnailUrl,
  sortElementsNaturalReadingOrder
} from '../utils/smartImageSegmentation';
import { SmartCropperPdfModal } from './SmartCropperPdfModal';
import { SmartCropperHelpModal, HelpTooltipButton, HelpTopicKey } from './SmartCropperHelpModal';
import { SmartComplexSlicerModal } from './SmartComplexSlicerModal';
import { sliceBoxWithKnifeLine } from '../utils/complexImageSlicer';

interface SmartAutoCropperProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  onSwitchToManual?: () => void;
}

type ToolMode = 'select' | 'move' | 'draw' | 'knife';

interface GalleryItemRowProps {
  element: DetectedElement;
  isActive: boolean;
  isHovered: boolean;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string, e: React.MouseEvent) => void;
  onHover: (id: string | null) => void;
  onExportSingle: (el: DetectedElement, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDecompose: (el: DetectedElement, e: React.MouseEvent) => void;
}

const GalleryItemRow = React.memo<GalleryItemRowProps>(({
  element: el,
  isActive,
  isHovered,
  onSelect,
  onToggleCheck,
  onHover,
  onExportSingle,
  onDelete,
  onDecompose
}) => {
  return (
    <div
      onClick={() => onSelect(el.id)}
      onMouseEnter={() => onHover(el.id)}
      onMouseLeave={() => onHover(null)}
      className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
        isActive
          ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-600/20'
          : el.selected
          ? 'bg-white/[0.03] border-emerald-500/40 hover:border-emerald-500/80'
          : 'bg-white/[0.01] border-white/5 opacity-60 hover:opacity-100 hover:border-white/20'
      }`}
    >
      {/* Checkbox & Thumbnail */}
      <div className="flex items-center gap-3">
        <button
          onClick={(e) => onToggleCheck(el.id, e)}
          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {el.selected ? (
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Thumbnail Image */}
        <div 
          className="w-14 h-12 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 p-1"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '8px 8px'
          }}
        >
          {el.thumbnailUrl ? (
            <img
              src={el.thumbnailUrl}
              alt={el.label}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          ) : (
            <Scissors className="w-4 h-4 text-slate-600" />
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              رقم {el.index}
            </span>
            {el.selected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
            {el.width} × {el.height} px
          </span>
        </div>
      </div>

      {/* Quick Item Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => onDecompose(el, e)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-600/30 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          title="تفكيك وقص هذا العنصر المعقد إلى أجزائه"
        >
          <Scissors className="w-3.5 h-3.5 text-amber-400" />
        </button>
        <button
          onClick={(e) => onExportSingle(el, e)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
          title="تحميل هذا العنصر منفصلاً"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => onDelete(el.id, e)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
          title="حذف العنصر"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

GalleryItemRow.displayName = 'GalleryItemRow';

export const SmartAutoCropper: React.FC<SmartAutoCropperProps> = ({
  currentUser,
  onCancel,
  onLoginRequired,
  onSubscriptionRequired,
  onSwitchToManual
}) => {
  // Image State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Detection & Elements State
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [elements, setElements] = useState<DetectedElement[]>([]);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [bgInfo, setBgInfo] = useState<BackgroundInfo | null>(null);
  const [processTime, setProcessTime] = useState<number>(0);

  // Settings State
  const [sensitivity, setSensitivity] = useState<number>(35);
  const [padding, setPadding] = useState<number>(2);
  const [minSize, setMinSize] = useState<number>(14);
  const [bgMode, setBgMode] = useState<'auto' | 'white' | 'black' | 'transparent'>('auto');
  const [exportFormat, setExportFormat] = useState<'png' | 'webp' | 'jpeg'>('png');
  const [namingPrefix, setNamingPrefix] = useState<string>('');

  // Canvas View State (Zoom, Pan, Tool)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState<boolean>(false);

  // Manual Drawing & Resizing State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ mouseX: number; mouseY: number; box: DetectedElement } | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');

  // UI Panels
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'selected' | 'unselected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // PDF Export & Help Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [activeHelpTopic, setActiveHelpTopic] = useState<HelpTopicKey | null>(null);

  // Complex Image Slicer & Knife Tool State
  const [isComplexModalOpen, setIsComplexModalOpen] = useState<boolean>(false);
  const [targetComplexElement, setTargetComplexElement] = useState<DetectedElement | null>(null);
  const [isKnifing, setIsKnifing] = useState<boolean>(false);
  const [knifeStart, setKnifeStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knifeCurrent, setKnifeCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleOpenHelp = (topicKey: HelpTopicKey) => {
    setActiveHelpTopic(topicKey);
    setIsHelpModalOpen(true);
  };

  // Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: selected count
  const selectedCount = elements.filter(el => el.selected).length;

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  // Load and analyze an image
  const handleLoadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPEG, WEBP)');
      return;
    }

    if (imageSrc) URL.revokeObjectURL(imageSrc);
    const url = URL.createObjectURL(file);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      setImageFile(file);
      setImageSrc(url);
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      originalImageRef.current = img;

      // Fit zoom nicely to viewport
      if (canvasContainerRef.current) {
        const containerW = canvasContainerRef.current.clientWidth - 40;
        const containerH = canvasContainerRef.current.clientHeight - 40;
        const scale = Math.min(1, Math.min(containerW / img.naturalWidth, containerH / img.naturalHeight));
        setZoom(scale > 0.1 ? scale : 1);
        setPan({ x: 0, y: 0 });
      }

      // Run automatic detection
      await runAutoDetection(img, {
        sensitivity,
        minWidth: minSize,
        minHeight: minSize,
        padding,
        backgroundMode: bgMode
      });
    };
    img.src = url;
  }, [imageSrc, sensitivity, minSize, padding, bgMode]);

  // Run Object Detection Engine
  const runAutoDetection = async (
    img: HTMLImageElement,
    opts: Partial<DetectionOptions>
  ) => {
    setIsDetecting(true);
    try {
      const result = await detectObjectsInImage(img, opts);
      setBgInfo(result.background);
      setProcessTime(result.processTimeMs);

      // Ensure strict natural reading order: Top-to-Bottom, Left-to-Right
      const naturalSorted = sortElementsNaturalReadingOrder(result.elements);
      const padDigits = Math.max(3, String(naturalSorted.length).length);
      const elementsWithThumbs = naturalSorted.map((el, idx) => ({
        ...el,
        index: idx + 1,
        label: String(idx + 1).padStart(padDigits, '0'),
        thumbnailUrl: generateThumbnailUrl(img, el, 100)
      }));

      setElements(elementsWithThumbs);
      setActiveElementId(elementsWithThumbs.length > 0 ? elementsWithThumbs[0].id : null);
    } catch (err) {
      console.error('Detection failed:', err);
      alert('حدث خطأ أثناء تحليل واكتشاف عناصر الصورة');
    } finally {
      setIsDetecting(false);
    }
  };

  // Re-run detection on demand
  const handleRerunDetection = () => {
    if (!originalImageRef.current) return;
    runAutoDetection(originalImageRef.current, {
      sensitivity,
      minWidth: minSize,
      minHeight: minSize,
      padding,
      backgroundMode: bgMode
    });
  };

  const debounceThumbTimeoutRef = useRef<any>(null);

  // Non-blocking debounced thumbnail refresh in slices of 25 using requestAnimationFrame
  const triggerDebouncedThumbnailRefresh = useCallback(() => {
    if (debounceThumbTimeoutRef.current) {
      clearTimeout(debounceThumbTimeoutRef.current);
    }
    debounceThumbTimeoutRef.current = setTimeout(() => {
      if (!originalImageRef.current) return;
      const img = originalImageRef.current;

      setElements(curr => {
        if (!curr.length) return curr;
        const copy = [...curr];
        let idx = 0;
        const total = copy.length;

        const processBatch = () => {
          const limit = Math.min(idx + 25, total);
          for (let i = idx; i < limit; i++) {
            copy[i] = {
              ...copy[i],
              thumbnailUrl: generateThumbnailUrl(img, copy[i], 100)
            };
          }
          idx = limit;
          if (idx < total) {
            requestAnimationFrame(processBatch);
          } else {
            setElements([...copy]);
          }
        };

        requestAnimationFrame(processBatch);
        return curr;
      });
    }, 350);
  }, []);

  // Update padding without re-running full pixel segmentation - INSTANT 60 FPS
  const handlePaddingChange = (newPad: number) => {
    const validPad = Math.max(0, Math.min(80, newPad));
    setPadding(validPad);
    if (!originalImageRef.current || elements.length === 0) return;

    // Instant bounds calculation (takes 0.05ms)
    const updated = applyPaddingToElements(
      elements,
      validPad,
      imageDimensions.width,
      imageDimensions.height
    );
    setElements(updated);

    // Schedule background thumbnail refresh without blocking slider or canvas
    triggerDebouncedThumbnailRefresh();
  };

  // Selection Handlers
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElements(prev => prev.map(el => el.id === id ? { ...el, selected: !el.selected } : el));
    setActiveElementId(id);
  };

  const handleSelectAll = () => {
    setElements(prev => prev.map(el => ({ ...el, selected: true })));
  };

  const handleDeselectAll = () => {
    setElements(prev => prev.map(el => ({ ...el, selected: false })));
  };

  const handleInvertSelection = () => {
    setElements(prev => prev.map(el => ({ ...el, selected: !el.selected })));
  };

  const handleDeleteElement = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setElements(prev => prev.filter(el => el.id !== id));
    if (activeElementId === id) setActiveElementId(null);
  };

  const handleDeleteSelected = () => {
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedCount} عنصر محدد؟`)) return;
    setElements(prev => prev.filter(el => !el.selected));
    setActiveElementId(null);
  };

  // Re-sort and re-number from top-to-bottom and left-to-right
  const handleReNumber = () => {
    if (elements.length === 0) return;
    const sorted = sortElementsNaturalReadingOrder([...elements]);

    const padDigits = Math.max(3, String(sorted.length).length);
    const renumbered = sorted.map((el, idx) => ({
      ...el,
      index: idx + 1,
      label: String(idx + 1).padStart(padDigits, '0')
    }));

    setElements(renumbered);
  };

  // Convert client coordinates to image native coordinates
  const clientToImageCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasContainerRef.current) return { x: 0, y: 0 };
    const rect = canvasContainerRef.current.getBoundingClientRect();
    
    // Canvas container center
    const cx = rect.left + rect.width / 2 + pan.x;
    const cy = rect.top + rect.height / 2 + pan.y;

    const imgDisplayW = imageDimensions.width * zoom;
    const imgDisplayH = imageDimensions.height * zoom;

    const imgLeft = cx - imgDisplayW / 2;
    const imgTop = cy - imgDisplayH / 2;

    const relX = (clientX - imgLeft) / zoom;
    const relY = (clientY - imgTop) / zoom;

    return {
      x: Math.max(0, Math.min(imageDimensions.width, Math.round(relX))),
      y: Math.max(0, Math.min(imageDimensions.height, Math.round(relY)))
    };
  }, [pan, zoom, imageDimensions]);

  // State for spacebar pan shortcut
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setZoom(prev => {
      const factor = delta > 0 ? 1.25 : 0.8;
      const next = Number((prev * factor).toFixed(3));
      return Math.max(0.05, Math.min(15, next));
    });
  };

  const handleSetExactZoom = (targetZoom: number) => {
    setZoom(Math.max(0.05, Math.min(15, Number(targetZoom.toFixed(3)))));
  };

  const handleFitToScreen = () => {
    if (!canvasContainerRef.current || !imageDimensions.width) return;
    const containerW = canvasContainerRef.current.clientWidth - 40;
    const containerH = canvasContainerRef.current.clientHeight - 40;
    const scale = Math.min(containerW / imageDimensions.width, containerH / imageDimensions.height);
    setZoom(Math.max(0.05, Math.min(3, Number(scale.toFixed(3)))));
    setPan({ x: 0, y: 0 });
  };

  const handleActualSize = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom anchored directly to the mouse cursor position
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.05, Math.min(15, zoom * zoomFactor));
    if (Math.abs(newZoom - zoom) < 0.0005) return;

    if (canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const mouseOffsetX = e.clientX - (rect.left + rect.width / 2);
      const mouseOffsetY = e.clientY - (rect.top + rect.height / 2);

      const scaleChange = newZoom / zoom;
      const newPanX = mouseOffsetX - (mouseOffsetX - pan.x) * scaleChange;
      const newPanY = mouseOffsetY - (mouseOffsetY - pan.y) * scaleChange;

      setZoom(newZoom);
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    } else {
      setZoom(newZoom);
    }
  };

  // Global Keyboard shortcuts for zoom and pan (+, -, 0, 1, Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoom(0.2);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoom(-0.2);
      } else if (e.key === '0') {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === '1') {
        e.preventDefault();
        handleActualSize();
      } else if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoom, pan, imageDimensions]);

  // Canvas Mouse Down: Pan or Draw or Select
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click, move tool, or holding spacebar = Pan
    if (e.button === 1 || toolMode === 'move' || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button === 0 && toolMode === 'draw') {
      const coords = clientToImageCoords(e.clientX, e.clientY);
      setIsDrawing(true);
      setDrawStart(coords);
      setDrawCurrent(coords);
    }

    if (e.button === 0 && toolMode === 'knife') {
      const coords = clientToImageCoords(e.clientX, e.clientY);
      setIsKnifing(true);
      setKnifeStart(coords);
      setKnifeCurrent(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (isKnifing) {
      const coords = clientToImageCoords(e.clientX, e.clientY);
      setKnifeCurrent(coords);
      return;
    }

    if (isDrawing) {
      const coords = clientToImageCoords(e.clientX, e.clientY);
      setDrawCurrent(coords);
      return;
    }

    if (isResizing && resizeStart && activeElementId) {
      const currentCoords = clientToImageCoords(e.clientX, e.clientY);
      const origBox = resizeStart.box;
      let newX = origBox.x;
      let newY = origBox.y;
      let newW = origBox.width;
      let newH = origBox.height;

      switch (resizeHandle) {
        case 'se':
          newW = Math.max(8, currentCoords.x - origBox.x);
          newH = Math.max(8, currentCoords.y - origBox.y);
          break;
        case 'sw':
          newX = Math.min(origBox.x + origBox.width - 8, currentCoords.x);
          newW = origBox.x + origBox.width - newX;
          newH = Math.max(8, currentCoords.y - origBox.y);
          break;
        case 'ne':
          newY = Math.min(origBox.y + origBox.height - 8, currentCoords.y);
          newW = Math.max(8, currentCoords.x - origBox.x);
          newH = origBox.y + origBox.height - newY;
          break;
        case 'nw':
          newX = Math.min(origBox.x + origBox.width - 8, currentCoords.x);
          newY = Math.min(origBox.y + origBox.height - 8, currentCoords.y);
          newW = origBox.x + origBox.width - newX;
          newH = origBox.y + origBox.height - newY;
          break;
      }

      setElements(prev => prev.map(el => el.id === activeElementId ? {
        ...el,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
        rawX: Math.round(newX),
        rawY: Math.round(newY),
        rawWidth: Math.round(newW),
        rawHeight: Math.round(newH)
      } : el));
    }
  };

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false);

    if (isDrawing) {
      setIsDrawing(false);
      const minX = Math.min(drawStart.x, drawCurrent.x);
      const minY = Math.min(drawStart.y, drawCurrent.y);
      const maxX = Math.max(drawStart.x, drawCurrent.x);
      const maxY = Math.max(drawStart.y, drawCurrent.y);
      const w = maxX - minX;
      const h = maxY - minY;

      if (w >= 10 && h >= 10) {
        const index = elements.length + 1;
        const padDigits = Math.max(3, String(index).length);
        const newEl: DetectedElement = {
          id: `elem_manual_${Date.now()}`,
          index,
          label: String(index).padStart(padDigits, '0'),
          rawX: minX,
          rawY: minY,
          rawWidth: w,
          rawHeight: h,
          x: minX,
          y: minY,
          width: w,
          height: h,
          selected: true,
          thumbnailUrl: originalImageRef.current ? generateThumbnailUrl(originalImageRef.current, {
            id: '', index, label: '', rawX: minX, rawY: minY, rawWidth: w, rawHeight: h,
            x: minX, y: minY, width: w, height: h, selected: true
          }) : ''
        };
        setElements(prev => [...prev, newEl]);
        setActiveElementId(newEl.id);
        setToolMode('select');
      }
    }

    if (isKnifing) {
      setIsKnifing(false);
      if (originalImageRef.current) {
        const p1 = knifeStart;
        const p2 = knifeCurrent;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist >= 12) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const target = elements.find(el => 
            midX >= el.x && midX <= el.x + el.width &&
            midY >= el.y && midY <= el.y + el.height
          ) || elements.find(el => el.id === activeElementId);

          if (target) {
            const sliced = sliceBoxWithKnifeLine(originalImageRef.current, target, p1, p2, target.index);
            if (sliced.length >= 2) {
              const slicedWithThumbs = sliced.map(s => ({
                ...s,
                thumbnailUrl: generateThumbnailUrl(originalImageRef.current!, s, 100)
              }));
              setElements(prev => {
                const filtered = prev.filter(e => e.id !== target.id);
                const combined = [...filtered, ...slicedWithThumbs];
                const reSorted = sortElementsNaturalReadingOrder(combined);
                const padDigits = Math.max(3, String(reSorted.length).length);
                return reSorted.map((el, idx) => ({
                  ...el,
                  index: idx + 1,
                  label: String(idx + 1).padStart(padDigits, '0')
                }));
              });
              setToolMode('select');
            }
          }
        }
      }
    }

    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
      // Refresh thumbnail for active element
      if (activeElementId && originalImageRef.current) {
        const current = elements.find(e => e.id === activeElementId);
        if (current) {
          const thumb = generateThumbnailUrl(originalImageRef.current, current);
          setElements(prev => prev.map(e => e.id === activeElementId ? { ...e, thumbnailUrl: thumb } : e));
        }
      }
    }
  };

  // Start Resizing an active box
  const startResize = (handle: string, box: DetectedElement, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({ mouseX: e.clientX, mouseY: e.clientY, box });
  };

  // Apply decomposed complex parts
  const handleApplyComplexParts = (newParts: DetectedElement[], replaceOriginalId?: string) => {
    if (!originalImageRef.current || newParts.length === 0) return;

    // Attach thumbnails to new parts
    const partsWithThumbs = newParts.map(part => ({
      ...part,
      thumbnailUrl: generateThumbnailUrl(originalImageRef.current!, part, 100)
    }));

    setElements(prev => {
      const remaining = replaceOriginalId ? prev.filter(e => e.id !== replaceOriginalId) : prev;
      const combined = [...remaining, ...partsWithThumbs];
      const reSorted = sortElementsNaturalReadingOrder(combined);
      const padDigits = Math.max(3, String(reSorted.length).length);
      return reSorted.map((el, idx) => ({
        ...el,
        index: idx + 1,
        label: String(idx + 1).padStart(padDigits, '0')
      }));
    });

    if (partsWithThumbs.length > 0) {
      setActiveElementId(partsWithThumbs[0].id);
    }
  };

  // Export Single Item directly
  const handleExportSingle = async (element: DetectedElement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!originalImageRef.current) return;

    try {
      const blob = await cropElementToBlob(originalImageRef.current, element, exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const prefix = namingPrefix ? `${namingPrefix}_` : '';
      a.download = `${prefix}${element.label}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export single failed:', err);
      alert('فشل تصدير العنصر');
    }
  };

  // Export Batch (Selected or All) as ZIP in strict sequential order
  const handleExportBatch = async (onlySelected: boolean) => {
    if (!originalImageRef.current) return;
    const rawItems = onlySelected ? elements.filter(e => e.selected) : elements;
    // Strict sequential sort by index
    const itemsToExport = [...rawItems].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    if (itemsToExport.length === 0) {
      alert('لا توجد عناصر محددة للتصدير');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText(`جاري قص ومعالجة ${itemsToExport.length} عنصر...`);

    try {
      const zip = new JSZip();
      const prefix = namingPrefix ? `${namingPrefix}_` : '';
      const total = itemsToExport.length;

      for (let i = 0; i < total; i++) {
        const item = itemsToExport[i];
        const blob = await cropElementToBlob(originalImageRef.current, item, exportFormat);
        const fileName = `${prefix}${item.label}.${exportFormat}`;
        zip.file(fileName, blob);

        const progressPercent = Math.round(((i + 1) / total) * 85);
        setExportProgress(progressPercent);
        setExportStatusText(`تمت معالجة ${i + 1} من ${total} عنصر...`);
        // Yield to prevent UI freeze
        if (i % 8 === 0) {
          await new Promise(r => setTimeout(r, 4));
        }
      }

      setExportStatusText('جاري إنشاء أرشيف ZIP وتحزيمه...');
      setExportProgress(90);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (metadata) => {
        setExportProgress(90 + Math.round(metadata.percent * 0.1));
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const zipName = `${imageFile?.name.replace(/\.[^/.]+$/, '') || 'Smart_Crops'}_${onlySelected ? 'Selected' : 'All'}_${itemsToExport.length}_elements.zip`;
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStatusText('تم التصدير والتحميل بنجاح!');
      setTimeout(() => {
        setIsExporting(false);
      }, 1200);
    } catch (err) {
      console.error('Batch export failed:', err);
      alert('حدث خطأ أثناء إنشاء ملف الـ ZIP');
      setIsExporting(false);
    }
  };

  // Filtered elements for gallery
  const filteredElements = elements.filter(el => {
    if (galleryFilter === 'selected' && !el.selected) return false;
    if (galleryFilter === 'unselected' && el.selected) return false;
    if (searchQuery.trim() && !el.label.includes(searchQuery.trim()) && !String(el.index).includes(searchQuery.trim())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#080d1a] text-slate-100 flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/10 bg-[#0b1222]/90 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-cyan-500 to-emerald-400 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0b1222] rounded-2xl flex items-center justify-center">
              <Scissors className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-base font-black text-white tracking-wide">
                نظام القص والتحديد الذكي التلقائي
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Smart Object Detection
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              اكتشاف وقص العناصر المتكررة والمنفصلة (Labels, Sprites, Stickers, Icons) تلقائياً وبدقة فائقة
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-3">
          {/* Help Guide Button */}
          <button
            onClick={() => {
              setActiveHelpTopic(null);
              setIsHelpModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white text-xs font-bold transition-all border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="شرح مفصل لكافة وظائف وأدوات القص الذكي"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">دليل الأدوات</span>
            <span className="w-4 h-4 rounded-full bg-cyan-500/30 text-cyan-200 text-[10px] flex items-center justify-center font-bold font-mono">?</span>
          </button>

          {imageSrc && elements.length > 0 && (
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500/20 to-indigo-500/20 hover:from-rose-500/30 hover:to-indigo-500/30 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="تصدير كتالوج PDF احترافي بالترتيب التسلسلي من 1 إلى N"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>تصدير PDF</span>
            </button>
          )}

          {imageSrc && (
            <button
              onClick={() => {
                setTargetComplexElement(activeElementId ? elements.find(el => el.id === activeElementId) || null : null);
                setIsComplexModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 hover:text-white text-xs font-bold transition-all border border-amber-500/40 flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="أمر ذكي لقص وتفكيك الصور المعقدة والمتداخلة مع خيارات متعددة"
            >
              <Scissors className="w-4 h-4 text-amber-400" />
              <span>تفكيك الصور المعقدة</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenHelp('complexSlice');
                }}
                className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] flex items-center justify-center font-bold"
                title="شرح أمر تفكيك الصور المعقدة"
              >
                ?
              </span>
            </button>
          )}

          {imageSrc && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-400">العناصر:</span>
              <span className="font-bold text-emerald-400 font-mono">{selectedCount}</span>
              <span className="text-slate-500">/</span>
              <span className="font-bold text-white font-mono">{elements.length}</span>
              {processTime > 0 && (
                <span className="text-[10px] text-slate-500 border-r border-white/10 pr-2 mr-2 font-mono">
                  ⚡ {processTime}ms
                </span>
              )}
            </div>
          )}

          {onSwitchToManual && (
            <button
              onClick={onSwitchToManual}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
              title="التبديل إلى نمط القص الجماعي اليدوي"
            >
              <Scissors className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">القص الجماعي اليدوي</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{imageSrc ? 'تغيير الصورة' : 'رفع صورة للتحليل'}</span>
          </button>

          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            handleLoadImage(e.target.files[0]);
          }
        }}
      />

      {/* Main App Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {!imageSrc ? (
          /* Empty / Upload State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#080d1a] to-[#0d162b]">
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleLoadImage(e.dataTransfer.files[0]);
                }
              }}
              className="max-w-xl w-full p-12 rounded-[2.5rem] border-2 border-dashed border-indigo-500/40 hover:border-indigo-400 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col items-center justify-center cursor-pointer group shadow-2xl"
            >
              <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Scissors className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">اسحب الصورة هنا أو اضغط للاختيار</h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                ارفع أي صورة تحتوي على عناصر مكررة ومنفصلة (مثل شيتات الـ Labels، الأيقونات، الاستيكرات، أزرار الألعاب، أو الرموز) ليقوم النظام بتحليلها وقص كل عنصر بدقة فائقة وبشكل فوري.
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">يدعم حتى مئات العناصر المتكررة</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">فصل تلقائي دقيق للمسافات</span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">تصدير مجمع ZIP فائق الجودة</span>
              </div>
            </div>
          </div>
        ) : (
          /* Active Workspace: Left Sidebar Settings, Center Canvas, Right Gallery */
          <>
            {/* Left Controls & Settings Bar */}
            <div className="w-72 border-l border-white/10 bg-[#0a101f]/95 flex flex-col shrink-0 z-20 overflow-y-auto custom-scrollbar">
              <div className="p-4 space-y-6">
                
                {/* Section 1: Selection Controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        التحكم بالتحديد الذكي
                      </span>
                      <HelpTooltipButton topicId="selection" onClick={handleOpenHelp} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {selectedCount}/{elements.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تحديد الكل</span>
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      <span>إلغاء الكل</span>
                    </button>
                    <button
                      onClick={handleInvertSelection}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                      <span>عكس التحديد</span>
                    </button>
                    <div className="relative flex items-center">
                      <button
                        onClick={handleReNumber}
                        title="إعادة الترقيم من أعلى لأسفل ومن اليسار لليمين بالتسلسل من 1 إلى N"
                        className="w-full py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>إعادة الترقيم</span>
                      </button>
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
                        <HelpTooltipButton topicId="renumber" onClick={handleOpenHelp} size="sm" />
                      </div>
                    </div>
                  </div>

                  {selectedCount > 0 && selectedCount < elements.length && (
                    <button
                      onClick={handleDeleteSelected}
                      className="w-full py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف العناصر المحددة ({selectedCount})</span>
                    </button>
                  )}
                </div>

                {/* Section 2: Padding Controls */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Maximize2 className="w-4 h-4 text-indigo-400" />
                        الهامش المحيط (Padding)
                      </span>
                      <HelpTooltipButton topicId="padding" onClick={handleOpenHelp} />
                    </div>
                    <div className="flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={padding}
                        onChange={e => handlePaddingChange(Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)))}
                        className="w-8 bg-transparent font-mono text-xs font-bold text-indigo-400 text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-indigo-400/80 font-mono">px</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">إضافة مسافة أمان حول كل عنصر مقصوص بدون أي تعليق</p>

                  {/* Fast Presets */}
                  <div className="grid grid-cols-6 gap-1">
                    {[0, 2, 5, 10, 15, 20].map(pad => (
                      <button
                        key={pad}
                        onClick={() => handlePaddingChange(pad)}
                        className={`py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                          padding === pad
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                        }`}
                      >
                        {pad}px
                      </button>
                    ))}
                  </div>

                  {/* Smooth Range Slider */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={padding}
                      onChange={e => handlePaddingChange(Number(e.target.value))}
                      onMouseUp={triggerDebouncedThumbnailRefresh}
                      onTouchEnd={triggerDebouncedThumbnailRefresh}
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-white/10 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0px</span>
                      <span>25px</span>
                      <span>50px</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Detection Parameters */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        ضبط حساسية الاكتشاف
                      </span>
                      <HelpTooltipButton topicId="sensitivity" onClick={handleOpenHelp} />
                    </div>
                    <button
                      onClick={handleRerunDetection}
                      disabled={isDetecting}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
                      <span>إعادة التحليل</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">حساسية التباين:</span>
                        <HelpTooltipButton topicId="sensitivity" onClick={handleOpenHelp} size="sm" />
                      </div>
                      <span className="font-mono text-cyan-400">{sensitivity}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="90"
                      value={sensitivity}
                      onChange={e => setSensitivity(Number(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">الحد الأدنى للحجم:</span>
                        <HelpTooltipButton topicId="minSize" onClick={handleOpenHelp} size="sm" />
                      </div>
                      <span className="font-mono text-cyan-400">{minSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="80"
                      value={minSize}
                      onChange={e => setMinSize(Number(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">وضع الخلفية:</span>
                      <HelpTooltipButton topicId="bgMode" onClick={handleOpenHelp} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {[
                        { id: 'auto', label: 'تلقائي (Auto)' },
                        { id: 'white', label: 'بيضاء (White)' },
                        { id: 'black', label: 'سوداء (Black)' },
                        { id: 'transparent', label: 'شفافة (Alpha)' }
                      ].map(m => (
                        <button
                          key={m.id}
                          onClick={() => setBgMode(m.id as any)}
                          className={`py-1.5 px-2 rounded-xl font-bold transition-all text-center cursor-pointer ${
                            bgMode === m.id
                              ? 'bg-cyan-600 text-white shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {bgInfo && (
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-[11px] flex items-center justify-between">
                      <span className="text-slate-400">الخلفية المكتشفة:</span>
                      <div className="flex items-center gap-1.5 font-mono text-slate-300">
                        <div 
                          className="w-3.5 h-3.5 rounded border border-white/20" 
                          style={{ backgroundColor: bgInfo.isTransparent ? 'transparent' : bgInfo.hex }} 
                        />
                        <span>{bgInfo.isTransparent ? 'شفافة' : bgInfo.hex}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section: Complex Image Decomposition & Smart Slicer */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-amber-400" />
                      قص وتفكيك الصور المعقدة
                    </span>
                    <HelpTooltipButton topicId="complexSlice" onClick={handleOpenHelp} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    أمر ذكي لتفكيك الأطر المتداخلة (مثل شارات Top 1 ذات التيجان والأجنحة) وفصلها لعناصر منفصلة مع خيارات متعددة.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setTargetComplexElement(activeElementId ? elements.find(el => el.id === activeElementId) || null : null);
                        setIsComplexModalOpen(true);
                      }}
                      className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>خيارات التفكيك</span>
                    </button>
                    <button
                      onClick={() => setToolMode('knife')}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        toolMode === 'knife'
                          ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                      }`}
                      title="تفعيل سكين القص بالكانفاس"
                    >
                      <Scissors className="w-3.5 h-3.5 text-rose-400" />
                      <span>سكين القطع ✂️</span>
                    </button>
                  </div>
                </div>

                {/* Section 4: Export Configuration */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-emerald-400" />
                      خيارات التصدير والحفظ
                    </span>
                    <HelpTooltipButton topicId="exportZip" onClick={handleOpenHelp} />
                  </div>

                  {/* Professional PDF Export Button (Prominent) */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-teal-500/10 border border-rose-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-rose-400" />
                        تصدير كتالوج PDF احترافي
                      </span>
                      <HelpTooltipButton topicId="exportPdf" onClick={handleOpenHelp} />
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      حفظ العناصر بالترتيب التسلسلي الصارم من 1 إلى {elements.length} مع ترقيم أنيق وبدون أرقام وهمية.
                    </p>
                    <button
                      onClick={() => setIsPdfModalOpen(true)}
                      disabled={elements.length === 0}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 via-indigo-600 to-teal-600 hover:from-rose-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01]"
                    >
                      <FileText className="w-4 h-4" />
                      <span>توليد وتحميل كتالوج الـ PDF</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">صيغة ملفات الصور:</span>
                      <HelpTooltipButton topicId="formats" onClick={handleOpenHelp} size="sm" />
                    </div>
                    <div className="flex gap-1.5">
                      {(['png', 'webp', 'jpeg'] as const).map(fmt => (
                        <button
                          key={fmt}
                          onClick={() => setExportFormat(fmt)}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                            exportFormat === fmt
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-white/5 hover:bg-white/10 text-slate-400'
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">بادئة التسمية (اختياري):</span>
                      <HelpTooltipButton topicId="namingPrefix" onClick={handleOpenHelp} size="sm" />
                    </div>
                    <input
                      type="text"
                      placeholder="مثال: Label أو Item"
                      value={namingPrefix}
                      onChange={e => setNamingPrefix(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500 font-mono">
                      النتيجة: {namingPrefix ? `${namingPrefix}_` : ''}1.{exportFormat}
                    </p>
                  </div>

                  {/* Export Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => handleExportBatch(true)}
                      disabled={selectedCount === 0 || isExporting}
                      className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedCount === 0 || isExporting
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      <FileArchive className="w-4 h-4" />
                      <span>تصدير المحدد فقط ({selectedCount}) ZIP</span>
                    </button>

                    <button
                      onClick={() => handleExportBatch(false)}
                      disabled={elements.length === 0 || isExporting}
                      className={`w-full py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        elements.length === 0 || isExporting
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                    >
                      <FileArchive className="w-4 h-4" />
                      <span>تصدير الكل ({elements.length}) ZIP</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Center Canvas Area with Zoom & Pan */}
            <div className="flex-1 flex flex-col bg-[#060a14] relative overflow-hidden">
              {/* Floating Canvas Toolbar */}
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#0b1222]/90 border border-white/10 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl">
                {/* Tool Selection */}
                <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                  <button
                    onClick={() => setToolMode('select')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      toolMode === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="أداة التحديد والنقر (Select Box)"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToolMode('move')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      toolMode === 'move' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="أداة تحريك وتصفح الكانفاس (Pan Canvas)"
                  >
                    <Move className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToolMode('draw')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      toolMode === 'draw' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="أداة رسم عنصر جديد يدوياً (Draw Custom Box)"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setToolMode('knife')}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      toolMode === 'knife' ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    title="سكين القطع الذكي: اسحب خطاً عبر أي عنصر متداخل لفصله فوراً"
                  >
                    <Scissors className="w-4 h-4 text-rose-400" />
                  </button>
                  <button
                    onClick={() => {
                      setTargetComplexElement(activeElementId ? elements.find(el => el.id === activeElementId) || null : null);
                      setIsComplexModalOpen(true);
                    }}
                    className="p-2 rounded-xl transition-all cursor-pointer text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                    title="أمر قص وتفكيك الصور المعقدة المتداخلة (فتح الخيارات الذكية)"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <HelpTooltipButton topicId="toolKnife" onClick={handleOpenHelp} size="sm" />
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 relative">
                  <button
                    onClick={() => handleZoom(0.2)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                    title="تكبير (أو زر +)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setIsZoomMenuOpen(prev => !prev)}
                      className="text-[11px] font-mono font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-xl border border-white/5 flex items-center gap-1 transition-all cursor-pointer"
                      title="خيارات نسبة التكبير"
                    >
                      <span>{Math.round(zoom * 100)}%</span>
                    </button>

                    {/* Quick Zoom Presets Popover */}
                    {isZoomMenuOpen && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#0b1222] border border-white/15 rounded-2xl p-1.5 shadow-2xl z-40 w-32 flex flex-col gap-0.5 backdrop-blur-xl">
                        {[
                          { label: 'ملاءمة (Fit)', val: 'fit' },
                          { label: '100% (أصلي)', val: 1 },
                          { label: '25%', val: 0.25 },
                          { label: '50%', val: 0.5 },
                          { label: '200%', val: 2 },
                          { label: '400%', val: 4 },
                          { label: '800%', val: 8 },
                          { label: '1200%', val: 12 },
                        ].map(item => (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.val === 'fit') {
                                handleFitToScreen();
                              } else {
                                handleSetExactZoom(item.val as number);
                              }
                              setIsZoomMenuOpen(false);
                            }}
                            className="text-right px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-indigo-600/30 transition-all cursor-pointer"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleZoom(-0.2)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                    title="تصغير (أو زر -)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleActualSize}
                    className="p-1.5 px-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-[11px] font-mono font-bold transition-all cursor-pointer"
                    title="الحجم الفعلي 100% (زر 1)"
                  >
                    1:1
                  </button>

                  <button
                    onClick={handleFitToScreen}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                    title="ملاءمة الشاشة (زر 0)"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <HelpTooltipButton topicId="zoomControls" onClick={handleOpenHelp} size="sm" />
                </div>
              </div>

              {/* Status Banner when detecting */}
              {isDetecting && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-indigo-600/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span className="text-xs font-bold">جاري الفحص والتحليل الذكي واكتشاف العناصر...</span>
                </div>
              )}

              {/* Canvas Viewport */}
              <div
                ref={canvasContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                className={`flex-1 w-full h-full flex items-center justify-center relative select-none overflow-hidden ${
                  toolMode === 'move' || isPanning || isSpacePressed ? 'cursor-grab active:cursor-grabbing' : toolMode === 'draw' ? 'cursor-crosshair' : toolMode === 'knife' ? 'cursor-crosshair' : 'cursor-default'
                }`}
                style={{
                  backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }}
              >
                {/* Scaled & Panned Image Container - instantaneous 60fps transform without CSS animation latency */}
                <div
                  className="relative will-change-transform origin-center"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    width: imageDimensions.width,
                    height: imageDimensions.height
                  }}
                >
                  {/* Original Image */}
                  <img
                    src={imageSrc}
                    alt="Original"
                    className="block w-full h-full pointer-events-none max-w-none shadow-2xl rounded-sm"
                    draggable={false}
                  />

                  {/* SVG Overlay for Bounding Boxes */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                  >
                    {elements.map((el) => {
                      const isActive = activeElementId === el.id;
                      const isHovered = hoveredElementId === el.id;
                      const isSelected = el.selected;

                      return (
                        <g 
                          key={el.id} 
                          className="pointer-events-auto cursor-pointer"
                          onClick={(e) => {
                            if (toolMode === 'select') {
                              toggleSelect(el.id, e);
                            }
                          }}
                          onMouseEnter={() => setHoveredElementId(el.id)}
                          onMouseLeave={() => setHoveredElementId(null)}
                        >
                          {/* Box Fill & Stroke */}
                          <rect
                            x={el.x}
                            y={el.y}
                            width={el.width}
                            height={el.height}
                            fill={
                              isSelected
                                ? isActive
                                  ? 'rgba(16, 185, 129, 0.28)'
                                  : 'rgba(16, 185, 129, 0.15)'
                                : isHovered
                                ? 'rgba(99, 102, 241, 0.2)'
                                : 'rgba(148, 163, 184, 0.05)'
                            }
                            stroke={
                              isSelected
                                ? isActive
                                  ? '#10b981'
                                  : '#34d399'
                                : isHovered
                                ? '#818cf8'
                                : 'rgba(148, 163, 184, 0.5)'
                            }
                            strokeWidth={isActive ? Math.max(2, 3 / zoom) : Math.max(1.2, 1.8 / zoom)}
                            strokeDasharray={isSelected ? undefined : '4 3'}
                            rx={Math.max(2, 4 / zoom)}
                          />

                          {/* ID Badge Tag */}
                          <g transform={`translate(${el.x}, ${Math.max(0, el.y - (18 / zoom))})`}>
                            {(() => {
                              const numStr = String(el.index);
                              const badgeW = Math.max(22, (numStr.length * 8 + 12) / zoom);
                              const badgeH = Math.max(15, 17 / zoom);
                              return (
                                <>
                                  <rect
                                    x={0}
                                    y={0}
                                    width={badgeW}
                                    height={badgeH}
                                    fill={isSelected ? '#059669' : '#1e293b'}
                                    stroke={isSelected ? '#34d399' : '#475569'}
                                    strokeWidth={Math.max(0.7, 1 / zoom)}
                                    rx={Math.max(2, 3 / zoom)}
                                  />
                                  <text
                                    x={badgeW / 2}
                                    y={badgeH * 0.72}
                                    fill="#ffffff"
                                    fontSize={Math.max(9, 11 / zoom)}
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {numStr}
                                  </text>
                                </>
                              );
                            })()}
                          </g>

                          {/* Resize Handles on Active Box */}
                          {isActive && (
                            <>
                              {/* NW Handle */}
                              <rect
                                x={el.x - Math.max(3, 4 / zoom)}
                                y={el.y - Math.max(3, 4 / zoom)}
                                width={Math.max(6, 8 / zoom)}
                                height={Math.max(6, 8 / zoom)}
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth={Math.max(1, 1.5 / zoom)}
                                className="cursor-nwse-resize pointer-events-auto"
                                onMouseDown={(e) => startResize('nw', el, e)}
                              />
                              {/* NE Handle */}
                              <rect
                                x={el.x + el.width - Math.max(3, 4 / zoom)}
                                y={el.y - Math.max(3, 4 / zoom)}
                                width={Math.max(6, 8 / zoom)}
                                height={Math.max(6, 8 / zoom)}
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth={Math.max(1, 1.5 / zoom)}
                                className="cursor-nesw-resize pointer-events-auto"
                                onMouseDown={(e) => startResize('ne', el, e)}
                              />
                              {/* SE Handle */}
                              <rect
                                x={el.x + el.width - Math.max(3, 4 / zoom)}
                                y={el.y + el.height - Math.max(3, 4 / zoom)}
                                width={Math.max(6, 8 / zoom)}
                                height={Math.max(6, 8 / zoom)}
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth={Math.max(1, 1.5 / zoom)}
                                className="cursor-nwse-resize pointer-events-auto"
                                onMouseDown={(e) => startResize('se', el, e)}
                              />
                              {/* SW Handle */}
                              <rect
                                x={el.x - Math.max(3, 4 / zoom)}
                                y={el.y + el.height - Math.max(3, 4 / zoom)}
                                width={Math.max(6, 8 / zoom)}
                                height={Math.max(6, 8 / zoom)}
                                fill="#ffffff"
                                stroke="#10b981"
                                strokeWidth={Math.max(1, 1.5 / zoom)}
                                className="cursor-nesw-resize pointer-events-auto"
                                onMouseDown={(e) => startResize('sw', el, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    })}

                    {/* Active Manual Drawing Box */}
                    {isDrawing && (
                      <rect
                        x={Math.min(drawStart.x, drawCurrent.x)}
                        y={Math.min(drawStart.y, drawCurrent.y)}
                        width={Math.abs(drawCurrent.x - drawStart.x)}
                        height={Math.abs(drawCurrent.y - drawStart.y)}
                        fill="rgba(59, 130, 246, 0.25)"
                        stroke="#3b82f6"
                        strokeWidth={Math.max(2, 2.5 / zoom)}
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Active Knife Cutting Line */}
                    {isKnifing && (
                      <g>
                        <line
                          x1={knifeStart.x}
                          y1={knifeStart.y}
                          x2={knifeCurrent.x}
                          y2={knifeCurrent.y}
                          stroke="#ef4444"
                          strokeWidth={Math.max(2.5, 3.5 / zoom)}
                          strokeDasharray="6 3"
                        />
                        <circle cx={knifeStart.x} cy={knifeStart.y} r={Math.max(3.5, 5 / zoom)} fill="#ef4444" />
                        <circle cx={knifeCurrent.x} cy={knifeCurrent.y} r={Math.max(3.5, 5 / zoom)} fill="#f59e0b" />
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              {/* Bottom Canvas Footer Info */}
              <div className="h-10 border-t border-white/10 bg-[#0b1222]/80 px-6 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-4">
                  <span>أبعاد الصورة الأصلية: <strong className="text-slate-200 font-mono">{imageDimensions.width} × {imageDimensions.height} px</strong></span>
                  <span>العنصر النشط: <strong className="text-emerald-400 font-mono">{activeElementId ? elements.find(e => e.id === activeElementId)?.label : 'لا يوجد'}</strong></span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span>💡 انقر على أي عنصر للتحديد/الإلغاء</span>
                  <span>•</span>
                  <span>اسحب الحواف لتعديل الحجم</span>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Cropped Elements Live Gallery */}
            <div className="w-80 border-r border-white/10 bg-[#0a101f]/95 flex flex-col shrink-0 z-20">
              {/* Gallery Header */}
              <div className="p-4 border-b border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black text-white">معاينة العناصر المقصوصة</h3>
                    <HelpTooltipButton topicId="galleryFilter" onClick={handleOpenHelp} size="sm" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-slate-400">
                    {filteredElements.length}
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex bg-white/5 p-1 rounded-xl gap-1 text-[11px]">
                  <button
                    onClick={() => setGalleryFilter('all')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      galleryFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    الكل ({elements.length})
                  </button>
                  <button
                    onClick={() => setGalleryFilter('selected')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      galleryFilter === 'selected' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    المحددة ({selectedCount})
                  </button>
                  <button
                    onClick={() => setGalleryFilter('unselected')}
                    className={`flex-1 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      galleryFilter === 'unselected' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    غير المحددة
                  </button>
                </div>

                {/* Search / Filter Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="بحث بالرقم (مثال: 045 أو 12)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Gallery Grid */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                {filteredElements.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    <span>لا توجد عناصر مطابقة للفلتر</span>
                  </div>
                ) : (
                  filteredElements.map((el) => (
                    <GalleryItemRow
                      key={el.id}
                      element={el}
                      isActive={activeElementId === el.id}
                      isHovered={hoveredElementId === el.id}
                      onSelect={setActiveElementId}
                      onToggleCheck={toggleSelect}
                      onHover={setHoveredElementId}
                      onExportSingle={handleExportSingle}
                      onDelete={handleDeleteElement}
                      onDecompose={(targetEl, e) => {
                        e.stopPropagation();
                        setTargetComplexElement(targetEl);
                        setIsComplexModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Exporting Progress Overlay Modal */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-[#0b1222] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                <FileArchive className="w-8 h-8 animate-bounce" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white mb-1">جاري تجهيز وتصدير الملفات</h3>
                <p className="text-xs text-slate-400 font-mono">{exportStatusText}</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>التقدم</span>
                  <span className="font-bold text-white">{exportProgress}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional PDF Export Modal */}
      <SmartCropperPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        elements={elements}
        selectedCount={selectedCount}
        originalImage={originalImageRef.current}
        imageFileName={imageFile?.name?.replace(/\.[^/.]+$/, '') || 'Smart_Crops'}
        onOpenHelp={handleOpenHelp}
      />

      {/* Interactive Tooltips & Help Guide Modal */}
      <SmartCropperHelpModal
        isOpen={isHelpModalOpen}
        activeTopicId={activeHelpTopic}
        onClose={() => setIsHelpModalOpen(false)}
        onSelectTopic={(topicId) => setActiveHelpTopic(topicId)}
      />

      {/* Complex Image Decomposition Modal with Multiple Smart Options */}
      <SmartComplexSlicerModal
        isOpen={isComplexModalOpen}
        onClose={() => {
          setIsComplexModalOpen(false);
          setTargetComplexElement(null);
        }}
        originalImage={originalImageRef.current}
        targetElement={targetComplexElement}
        allElements={elements}
        onApplyParts={handleApplyComplexParts}
        onSelectKnifeTool={() => setToolMode('knife')}
        onOpenHelp={handleOpenHelp}
      />
    </div>
  );
};
