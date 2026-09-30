import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowRight, Upload, Download, Copy, RefreshCw, Trash2, Eye, 
  Grid, LayoutGrid, Layers, Shield, Sparkles, Sliders, Palette, 
  Type, Check, Image as ImageIcon, Plus, Move, RotateCw, ZoomIn, 
  ZoomOut, Maximize2, Minimize2, AlertCircle, CheckCircle2, 
  ArrowUp, ArrowDown, Shuffle, FileText, Smartphone, Monitor,
  SlidersHorizontal, X, Lock, Unlock, HelpCircle
} from 'lucide-react';

export interface CollageImageItem {
  id: string;
  file?: File;
  dataUrl: string;
  name: string;
  label?: string;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
}

export type LayoutMode = 
  | 'catalog_grid'      // Reference screenshot style: configurable columns with numbers/labels
  | 'auto_grid'         // Auto responsive square grid
  | 'hero_showcase'     // 1 big image + surrounding small images
  | 'horizontal_strip'  // Single horizontal row
  | 'vertical_stack'    // Single vertical column
  | 'masonry'           // Cascading column heights
  | 'side_by_side'      // 2 or 3 equal comparison columns
  | 'matrix_2x2'
  | 'matrix_3x3'
  | 'matrix_4x4'
  | 'matrix_6x6';

export type AspectRatioMode = '1:1' | '4:3' | '16:9' | '9:16' | '3:4' | '2:1' | 'auto';
export type ImageFitMode = 'contain' | 'cover' | 'fill';
export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type WatermarkPatternMode = 'diagonal_repeat' | 'single_position' | 'horizontal_bands';
export type WatermarkPosition = 
  | 'top_left' | 'top_center' | 'top_right'
  | 'center_left' | 'center' | 'center_right'
  | 'bottom_left' | 'bottom_center' | 'bottom_right';

interface ImageCollageStudioProps {
  onBack: () => void;
  initialFiles?: File[] | null;
}

export const ImageCollageStudio: React.FC<ImageCollageStudioProps> = ({ onBack, initialFiles }) => {
  // --- Main State ---
  const [images, setImages] = useState<CollageImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'design' | 'watermark' | 'images' | 'export'>('layout');
  
  // --- Layout Configuration ---
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('catalog_grid');
  const [catalogColumns, setCatalogColumns] = useState<number>(11); // default as in screenshot (11-12 columns)
  const [gap, setGap] = useState<number>(14);
  const [padding, setPadding] = useState<number>(24);
  const [cardRadius, setCardRadius] = useState<number>(10);
  const [itemAspect, setItemAspect] = useState<AspectRatioMode>('16:9');
  const [imageFit, setImageFit] = useState<ImageFitMode>('contain');
  
  // --- Labeling (Numbered Catalog like screenshot: 001, 002, 003...) ---
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [labelType, setLabelType] = useState<'number_3digit' | 'number_simple' | 'filename' | 'custom'>('number_3digit');
  const [labelFontSize, setLabelFontSize] = useState<number>(11);
  const [labelColor, setLabelColor] = useState<string>('#94a3b8');
  const [labelBg, setLabelBg] = useState<string>('transparent');

  // --- Background & Canvas Styling ---
  const [bgType, setBgType] = useState<'dark_obsidian' | 'black' | 'white' | 'transparent' | 'gradient_purple' | 'gradient_cyan' | 'gradient_gold' | 'custom'>('dark_obsidian');
  const [customBgColor, setCustomBgColor] = useState<string>('#0b0f19');
  const [canvasResolutionPreset, setCanvasResolutionPreset] = useState<'auto' | '1080p' | '4k' | 'square' | 'story'>('auto');
  
  // --- Item Border & Card Decor ---
  const [cardBorderWidth, setCardBorderWidth] = useState<number>(0);
  const [cardBorderColor, setCardBorderColor] = useState<string>('#334155');
  const [cardBgColor, setCardBgColor] = useState<string>('transparent');
  const [cardShadow, setCardShadow] = useState<boolean>(false);

  // --- Watermark Engine ---
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(true);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [watermarkText, setWatermarkText] = useState<string>('Ahmed SVGA • SVGA Studio');
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState<string | null>(null);
  const [watermarkPattern, setWatermarkPattern] = useState<WatermarkPatternMode>('diagonal_repeat');
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom_right');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(28);
  const [watermarkFontSize, setWatermarkFontSize] = useState<number>(22);
  const [watermarkColor, setWatermarkColor] = useState<string>('#ffffff');
  const [watermarkAngle, setWatermarkAngle] = useState<number>(-28);
  const [watermarkSpacingX, setWatermarkSpacingX] = useState<number>(220);
  const [watermarkSpacingY, setWatermarkSpacingY] = useState<number>(140);
  const [watermarkShadow, setWatermarkShadow] = useState<boolean>(true);

  // --- Export Settings ---
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportScale, setExportScale] = useState<number>(2); // 2x default for ultra sharp quality
  const [exportQuality, setExportQuality] = useState<number>(95);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  // --- Viewport Interactive Zoom & Pan ---
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Loaded Image elements cache to prevent refetching
  const imageElementsMap = useRef<Map<string, HTMLImageElement>>(new Map());

  // --- Helper to convert files to CollageImageItem ---
  const processFiles = useCallback(async (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|bmp|avif)$/i.test(f.name));
    if (validImageFiles.length === 0) return;

    const newItems: CollageImageItem[] = [];

    for (let i = 0; i < validImageFiles.length; i++) {
      const file = validImageFiles[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Get dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${i}`;
      imageElementsMap.current.set(id, img);

      newItems.push({
        id,
        file,
        dataUrl,
        name: file.name,
        width: img.naturalWidth || 400,
        height: img.naturalHeight || 400,
        rotation: 0,
        flipH: false
      });
    }

    setImages(prev => [...prev, ...newItems]);
  }, []);

  // Handle Initial files if passed
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
    }
  }, [initialFiles, processFiles]);

  // Handle Drag & Drop on whole studio
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // --- Sample Assets Generator (Quick Demo Demoing the Sprite Sheet in Screenshot) ---
  const handleLoadSampleAssets = useCallback(async () => {
    // Generate diamond badges with colors like the screenshot
    const colors = ['#f97316', '#eab308', '#84cc16', '#06b6d4', '#a855f7', '#ec4899', '#ef4444'];
    const sampleItems: CollageImageItem[] = [];

    for (let i = 1; i <= 33; i++) {
      const color = colors[(i - 1) % colors.length];
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;

      // Draw Badge
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(10, 10, 140, 80, 14);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw inner diamond symbol & number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`💎 ${i}`, 80, 52);

      const dataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; });

      const id = `sample_${i}_${Date.now()}`;
      imageElementsMap.current.set(id, img);

      sampleItems.push({
        id,
        dataUrl,
        name: `badge_${String(i).padStart(3, '0')}.png`,
        width: 160,
        height: 100,
        rotation: 0,
        flipH: false
      });
    }

    setImages(sampleItems);
  }, []);

  // --- Sorting & Reordering Utilities ---
  const handleSortByName = () => {
    setImages(prev => [...prev].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  };

  const handleReverseOrder = () => {
    setImages(prev => [...prev].reverse());
  };

  const handleShuffle = () => {
    setImages(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    setImages(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const handleDeleteImage = (id: string) => {
    setImages(prev => prev.filter(item => item.id !== id));
    imageElementsMap.current.delete(id);
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const handleRotateImage = (id: string) => {
    setImages(prev => prev.map(item => item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item));
  };

  // --- Calculate Canvas Dimensions & Cell Layout ---
  const layoutCalculations = useMemo(() => {
    const count = images.length;
    if (count === 0) return { width: 1200, height: 800, items: [] };

    // Aspect ratio ratio for individual cells
    let cellAspectW = 1;
    let cellAspectH = 1;
    if (itemAspect === '16:9') { cellAspectW = 16; cellAspectH = 9; }
    else if (itemAspect === '4:3') { cellAspectW = 4; cellAspectH = 3; }
    else if (itemAspect === '3:4') { cellAspectW = 3; cellAspectH = 4; }
    else if (itemAspect === '9:16') { cellAspectW = 9; cellAspectH = 16; }
    else if (itemAspect === '2:1') { cellAspectW = 2; cellAspectH = 1; }

    const labelHeightExtra = showLabels ? labelFontSize + 14 : 0;

    let cols = 4;
    let rows = Math.ceil(count / cols);
    let cellWidth = 140;
    let cellHeight = (cellWidth * cellAspectH) / cellAspectW;

    if (layoutMode === 'catalog_grid') {
      cols = Math.max(1, catalogColumns);
      rows = Math.ceil(count / cols);
      cellWidth = 140;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'matrix_2x2') {
      cols = 2;
      rows = Math.ceil(count / 2);
      cellWidth = 360;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'matrix_3x3') {
      cols = 3;
      rows = Math.ceil(count / 3);
      cellWidth = 260;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'matrix_4x4') {
      cols = 4;
      rows = Math.ceil(count / 4);
      cellWidth = 200;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'matrix_6x6') {
      cols = 6;
      rows = Math.ceil(count / 6);
      cellWidth = 140;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'horizontal_strip') {
      cols = count;
      rows = 1;
      cellWidth = 180;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'vertical_stack') {
      cols = 1;
      rows = count;
      cellWidth = 400;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'auto_grid') {
      // Balance cols and rows close to square aspect
      cols = Math.ceil(Math.sqrt(count * 1.5));
      rows = Math.ceil(count / cols);
      cellWidth = 160;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    } else if (layoutMode === 'side_by_side') {
      cols = Math.min(count, 3);
      rows = Math.ceil(count / cols);
      cellWidth = 320;
      cellHeight = (cellWidth * cellAspectH) / cellAspectW;
    }

    const totalCellH = cellHeight + labelHeightExtra;
    let canvasW = padding * 2 + cols * cellWidth + (cols - 1) * gap;
    let canvasH = padding * 2 + rows * totalCellH + (rows - 1) * gap;

    // Apply fixed Canvas Presets if chosen
    if (canvasResolutionPreset === '1080p') {
      canvasW = 1920;
      canvasH = 1080;
    } else if (canvasResolutionPreset === '4k') {
      canvasW = 3840;
      canvasH = 2160;
    } else if (canvasResolutionPreset === 'square') {
      const maxDim = Math.max(canvasW, canvasH);
      canvasW = maxDim;
      canvasH = maxDim;
    } else if (canvasResolutionPreset === 'story') {
      canvasW = 1080;
      canvasH = 1920;
    }

    // Position each item
    const positionedItems = images.map((item, index) => {
      let x = 0;
      let y = 0;
      let w = cellWidth;
      let h = cellHeight;

      if (layoutMode === 'hero_showcase' && count > 1) {
        if (index === 0) {
          // Big Hero Item
          w = cellWidth * 2 + gap;
          h = totalCellH * 2 + gap - labelHeightExtra;
          x = padding;
          y = padding;
        } else {
          // Surrounding small items
          const subIdx = index - 1;
          const subCols = Math.max(1, cols - 2);
          const col = subIdx % subCols;
          const row = Math.floor(subIdx / subCols);
          x = padding + (cellWidth * 2 + gap) + gap + col * (cellWidth + gap);
          y = padding + row * (totalCellH + gap);
        }
      } else {
        const col = index % cols;
        const row = Math.floor(index / cols);
        x = padding + col * (cellWidth + gap);
        y = padding + row * (totalCellH + gap);
      }

      // Compute label text
      let labelText = '';
      if (showLabels) {
        if (labelType === 'number_3digit') {
          labelText = String(index + 1).padStart(3, '0');
        } else if (labelType === 'number_simple') {
          labelText = `${index + 1}`;
        } else if (labelType === 'filename') {
          labelText = item.name.replace(/\.[^/.]+$/, '');
        } else if (labelType === 'custom') {
          labelText = item.label || String(index + 1).padStart(3, '0');
        }
      }

      return {
        ...item,
        index,
        x,
        y,
        width: w,
        height: h,
        totalHeight: h + labelHeightExtra,
        labelText
      };
    });

    return {
      width: Math.max(400, canvasW),
      height: Math.max(300, canvasH),
      items: positionedItems
    };
  }, [images, layoutMode, catalogColumns, gap, padding, itemAspect, showLabels, labelType, labelFontSize, canvasResolutionPreset]);

  // --- Render to High-Resolution Canvas ---
  const renderCanvas = useCallback((targetScale: number = 1): HTMLCanvasElement => {
    const { width, height, items } = layoutCalculations;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * targetScale);
    canvas.height = Math.round(height * targetScale);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return canvas;

    ctx.scale(targetScale, targetScale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw Background
    if (bgType === 'dark_obsidian') {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);
      // Subtle ambient gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
      bgGrad.addColorStop(0, '#111827');
      bgGrad.addColorStop(1, '#070a12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'gradient_purple') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#180a22');
      grad.addColorStop(1, '#090e1c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'gradient_cyan') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#042f2e');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'gradient_gold') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#291b00');
      grad.addColorStop(1, '#0c0a09');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'custom') {
      ctx.fillStyle = customBgColor;
      ctx.fillRect(0, 0, width, height);
    } else if (bgType === 'transparent') {
      ctx.clearRect(0, 0, width, height);
    }

    // 2. Draw Items
    items.forEach((item) => {
      ctx.save();

      // Draw Card Background if specified
      if (cardBgColor !== 'transparent' || cardBorderWidth > 0 || cardShadow) {
        ctx.save();
        if (cardShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 4;
        }
        if (cardBgColor !== 'transparent') {
          ctx.fillStyle = cardBgColor;
          ctx.beginPath();
          ctx.roundRect(item.x, item.y, item.width, item.height, cardRadius);
          ctx.fill();
        }
        if (cardBorderWidth > 0) {
          ctx.strokeStyle = cardBorderColor;
          ctx.lineWidth = cardBorderWidth;
          ctx.beginPath();
          ctx.roundRect(item.x, item.y, item.width, item.height, cardRadius);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Clip for rounded corners
      if (cardRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(item.x, item.y, item.width, item.height, cardRadius);
        ctx.clip();
      }

      // Draw Image with Fit logic & Rotation
      const imgEl = imageElementsMap.current.get(item.id);
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;

        ctx.save();
        ctx.translate(cx, cy);
        if (item.rotation) ctx.rotate((item.rotation * Math.PI) / 180);
        if (item.flipH) ctx.scale(-1, 1);

        const imgW = imgEl.naturalWidth;
        const imgH = imgEl.naturalHeight;

        let drawW = item.width;
        let drawH = item.height;

        if (imageFit === 'contain') {
          const ratio = Math.min(item.width / imgW, item.height / imgH);
          drawW = imgW * ratio;
          drawH = imgH * ratio;
        } else if (imageFit === 'cover') {
          const ratio = Math.max(item.width / imgW, item.height / imgH);
          drawW = imgW * ratio;
          drawH = imgH * ratio;
        }

        ctx.drawImage(imgEl, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      ctx.restore();

      // Draw Label under image if enabled (as in reference screenshot)
      if (showLabels && item.labelText) {
        ctx.save();
        ctx.font = `bold ${labelFontSize}px monospace, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelY = item.y + item.height + 6;
        const labelX = item.x + item.width / 2;

        if (labelBg !== 'transparent') {
          const textMetrics = ctx.measureText(item.labelText);
          const bgW = textMetrics.width + 12;
          const bgH = labelFontSize + 6;
          ctx.fillStyle = labelBg;
          ctx.beginPath();
          ctx.roundRect(labelX - bgW / 2, labelY - 2, bgW, bgH, 4);
          ctx.fill();
        }

        ctx.fillStyle = labelColor;
        ctx.fillText(item.labelText, labelX, labelY);
        ctx.restore();
      }
    });

    // 3. Draw Watermark Layer directly onto the output image
    if (watermarkEnabled) {
      ctx.save();
      const alpha = watermarkOpacity / 100;
      ctx.globalAlpha = alpha;

      if (watermarkShadow) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      if (watermarkType === 'text') {
        ctx.font = `900 ${watermarkFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = watermarkColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (watermarkPattern === 'diagonal_repeat') {
          // Diagonal Repeated Pattern covering the entire canvas (Matrix Style)
          const angleRad = (watermarkAngle * Math.PI) / 180;
          const textMetric = ctx.measureText(watermarkText);
          const stepX = Math.max(100, watermarkSpacingX + textMetric.width);
          const stepY = Math.max(60, watermarkSpacingY);

          const diag = Math.sqrt(width * width + height * height) * 1.5;

          ctx.translate(width / 2, height / 2);
          ctx.rotate(angleRad);

          for (let y = -diag; y <= diag; y += stepY) {
            // Alternate horizontal offset for brick layout
            const rowOffset = (Math.abs(Math.floor(y / stepY)) % 2) * (stepX / 2);
            for (let x = -diag; x <= diag; x += stepX) {
              ctx.fillText(watermarkText, x + rowOffset, y);
            }
          }
        } else if (watermarkPattern === 'horizontal_bands') {
          // Horizontal running bands
          const stepY = watermarkSpacingY * 1.5;
          const stepX = watermarkSpacingX * 1.5;
          for (let y = padding; y <= height - padding; y += stepY) {
            for (let x = padding; x <= width - padding; x += stepX) {
              ctx.fillText(watermarkText, x, y);
            }
          }
        } else if (watermarkPattern === 'single_position') {
          // Single Position placement
          let px = width / 2;
          let py = height / 2;
          const margin = 40;

          if (watermarkPosition === 'top_left') { px = margin; py = margin; ctx.textAlign = 'left'; }
          else if (watermarkPosition === 'top_center') { px = width / 2; py = margin; ctx.textAlign = 'center'; }
          else if (watermarkPosition === 'top_right') { px = width - margin; py = margin; ctx.textAlign = 'right'; }
          else if (watermarkPosition === 'center_left') { px = margin; py = height / 2; ctx.textAlign = 'left'; }
          else if (watermarkPosition === 'center') { px = width / 2; py = height / 2; ctx.textAlign = 'center'; }
          else if (watermarkPosition === 'center_right') { px = width - margin; py = height / 2; ctx.textAlign = 'right'; }
          else if (watermarkPosition === 'bottom_left') { px = margin; py = height - margin; ctx.textAlign = 'left'; }
          else if (watermarkPosition === 'bottom_center') { px = width / 2; py = height - margin; ctx.textAlign = 'center'; }
          else if (watermarkPosition === 'bottom_right') { px = width - margin; py = height - margin; ctx.textAlign = 'right'; }

          ctx.fillText(watermarkText, px, py);
        }
      } else if (watermarkType === 'image' && watermarkLogoUrl) {
        // Logo image watermark
        const logoImg = new Image();
        logoImg.src = watermarkLogoUrl;
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const logoW = watermarkFontSize * 3;
          const logoH = (logoW * logoImg.naturalHeight) / logoImg.naturalWidth;

          if (watermarkPattern === 'diagonal_repeat') {
            const angleRad = (watermarkAngle * Math.PI) / 180;
            const stepX = watermarkSpacingX * 1.5;
            const stepY = watermarkSpacingY * 1.5;
            const diag = Math.sqrt(width * width + height * height) * 1.5;

            ctx.translate(width / 2, height / 2);
            ctx.rotate(angleRad);

            for (let y = -diag; y <= diag; y += stepY) {
              const rowOffset = (Math.abs(Math.floor(y / stepY)) % 2) * (stepX / 2);
              for (let x = -diag; x <= diag; x += stepX) {
                ctx.drawImage(logoImg, x + rowOffset - logoW / 2, y - logoH / 2, logoW, logoH);
              }
            }
          } else {
            // Single Logo Corner
            const margin = 30;
            ctx.drawImage(logoImg, width - logoW - margin, height - logoH - margin, logoW, logoH);
          }
        }
      }

      ctx.restore();
    }

    return canvas;
  }, [
    layoutCalculations, bgType, customBgColor, cardBgColor, cardBorderWidth, cardBorderColor,
    cardRadius, cardShadow, imageFit, showLabels, labelFontSize, labelColor, labelBg,
    watermarkEnabled, watermarkType, watermarkText, watermarkLogoUrl, watermarkPattern,
    watermarkPosition, watermarkOpacity, watermarkFontSize, watermarkColor, watermarkAngle,
    watermarkSpacingX, watermarkSpacingY, watermarkShadow
  ]);

  // --- Real-time Preview Render Update ---
  useEffect(() => {
    let isCancelled = false;
    const updatePreview = () => {
      const offscreen = renderCanvas(1);
      if (!isCancelled) {
        try {
          const url = offscreen.toDataURL('image/png');
          setPreviewDataUrl(url);
        } catch (e) {
          console.error('Preview error', e);
        }
      }
    };

    const timer = setTimeout(updatePreview, 60);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [renderCanvas]);

  // --- Copy Image to Clipboard ---
  const handleCopyClipboard = async () => {
    try {
      const highResCanvas = renderCanvas(exportScale);
      highResCanvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopiedSuccess(true);
          setTimeout(() => setCopiedSuccess(false), 2500);
        } catch (err) {
          // Fallback if clipboard API is restricted
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `collage_watermarked_${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          setCopiedSuccess(true);
          setTimeout(() => setCopiedSuccess(false), 2500);
        }
      }, 'image/png');
    } catch (e) {
      alert('تم تحميل الصورة إلى جهازك');
    }
  };

  // --- Download Final High-Res Export ---
  const handleExportDownload = async () => {
    setIsExporting(true);
    setExportProgress(20);

    setTimeout(() => {
      setExportProgress(60);
      try {
        const highResCanvas = renderCanvas(exportScale);
        setExportProgress(85);

        const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : exportFormat === 'webp' ? 'image/webp' : 'image/png';
        const quality = exportQuality / 100;

        const dataUrl = highResCanvas.toDataURL(mimeType, quality);
        const link = document.createElement('a');
        link.download = `Ahmed_SVGA_Collage_${images.length}Items_${Date.now()}.${exportFormat === 'jpeg' ? 'jpg' : exportFormat}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setExportProgress(100);
        setTimeout(() => setIsExporting(false), 500);
      } catch (err: any) {
        alert('حدث خطأ أثناء التصدير: ' + err.message);
        setIsExporting(false);
      }
    }, 100);
  };

  return (
    <div 
      className="min-h-screen bg-[#070a13] text-white flex flex-col font-sans select-none"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      dir="rtl"
    >
      {/* Top Header Bar */}
      <header className="h-16 border-b border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="الرجوع للرئيسية"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/30 text-cyan-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                <span>استوديو تجميع وترتيب الصور وحمايتها</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                  Collage & Watermark Pro
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden md:block">
                ترتيب مئات الصور في شبكة أو كتالوج وتطبيق علامة مائية ذكية مانعة للسرقة وتصدير فائق الدقة
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Quick Actions */}
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <>
              <button
                onClick={handleCopyClipboard}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-xs font-bold"
                title="نسخ الصورة النهائية للحافظة"
              >
                {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                <span className="hidden sm:inline">{copiedSuccess ? 'تم النسخ!' : 'نسخ للحافظة'}</span>
              </button>

              <button
                onClick={handleExportDownload}
                disabled={isExporting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-1.5 active:scale-95"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isExporting ? `جاري التصدير (${exportProgress}%)...` : 'تصدير وتحميل'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-all flex items-center gap-1 text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">إضافة صور</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.png,.jpg,.jpeg,.webp,.svg,.gif"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) processFiles(Array.from(e.target.files));
            }}
          />
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Center Workspace (Interactive Canvas Viewport) */}
        <div className="flex-1 flex flex-col bg-[#050811] relative overflow-hidden order-2 lg:order-1">
          
          {/* Canvas Floating Top Controls */}
          <div className="p-3 bg-[#0a0f1d]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {images.length} صور • {layoutCalculations.width} × {layoutCalculations.height} px
              </span>
              {watermarkEnabled && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>محمي بالعلامة المائية</span>
                </span>
              )}
            </div>

            {/* Zoom Controls & Preview Modes */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.2, prev - 0.15))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-slate-300 px-1 w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.15))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono"
                title="100% حجم أصلي"
              >
                100%
              </button>
              <button
                onClick={() => setIsFullscreenPreview(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                title="معاينة ملء الشاشة"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Canvas Viewport Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center relative custom-scrollbar">
            {images.length === 0 ? (
              // Empty State with Drag & Drop Zone + Sample Assets Button
              <div className="max-w-md w-full p-8 rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center text-center gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Upload className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">اسحب وأفلت الصور هنا للبدء</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    ارفع عشرات أو مئات الصور (PNG, JPG, WebP, SVG) لترتيبها وتجميعها وحمايتها
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full mt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تصفح الصور من جهازك</span>
                  </button>

                  <button
                    onClick={handleLoadSampleAssets}
                    className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    title="تجربة فورية بمجموعة جواهر وشارات مسبقة الصنع"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>تجربة صور توضيحية</span>
                  </button>
                </div>
              </div>
            ) : (
              // Live Interactive Canvas Render
              <div 
                className="transition-transform duration-150 origin-center shadow-[0_25px_70px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden relative border border-white/10"
                style={{
                  transform: `scale(${zoomLevel})`,
                  maxWidth: '100%'
                }}
              >
                {previewDataUrl ? (
                  <img 
                    src={previewDataUrl} 
                    alt="Collage Preview" 
                    className="block max-w-none"
                    style={{
                      width: layoutCalculations.width,
                      height: layoutCalculations.height
                    }}
                  />
                ) : (
                  <div className="w-[600px] h-[400px] flex items-center justify-center bg-slate-900 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Bar Controls for quick layout adjustments */}
          {images.length > 0 && (
            <div className="p-3 bg-[#0a0f1d]/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">الأعمدة (Columns):</span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={catalogColumns}
                  onChange={(e) => {
                    setCatalogColumns(parseInt(e.target.value));
                    if (layoutMode !== 'catalog_grid') setLayoutMode('catalog_grid');
                  }}
                  className="w-24 accent-cyan-400"
                />
                <span className="font-mono font-bold text-cyan-300 w-5">{catalogColumns}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">التباعد (Gap):</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={gap}
                  onChange={(e) => setGap(parseInt(e.target.value))}
                  className="w-20 accent-indigo-400"
                />
                <span className="font-mono font-bold text-indigo-300 w-6">{gap}px</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">ترقيم العناصر:</span>
                <button
                  onClick={() => setShowLabels(!showLabels)}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                    showLabels 
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  {showLabels ? 'مفعل (001, 002...)' : 'معطل'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">العلامة المائية:</span>
                <button
                  onClick={() => setWatermarkEnabled(!watermarkEnabled)}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all flex items-center gap-1 ${
                    watermarkEnabled 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>{watermarkEnabled ? 'مفعلة' : 'معطلة'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Controls Panel */}
        <div className="w-full lg:w-96 bg-[#0c101d] border-t lg:border-t-0 lg:border-r border-white/10 flex flex-col order-1 lg:order-2 z-20">
          
          {/* Sidebar Tabs */}
          <div className="flex items-center border-b border-white/10 bg-[#090d18] overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all shrink-0 ${
                activeTab === 'layout'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>القوالب والترتيب</span>
            </button>

            <button
              onClick={() => setActiveTab('design')}
              className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all shrink-0 ${
                activeTab === 'design'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>المظهر والخلفية</span>
            </button>

            <button
              onClick={() => setActiveTab('watermark')}
              className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all shrink-0 ${
                activeTab === 'watermark'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>العلامة المائية</span>
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all shrink-0 ${
                activeTab === 'images'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>الصور ({images.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-3 px-2 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all shrink-0 ${
                activeTab === 'export'
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>التصدير</span>
            </button>
          </div>

          {/* Sidebar Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar text-xs">
            
            {/* TAB 1: Layouts & Presets */}
            {activeTab === 'layout' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">
                    اختر نمط الترتيب والقالب:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLayoutMode('catalog_grid')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'catalog_grid'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>شبكة كتالوج (مرجعك)</span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        أعمدة مصفوفة مع ترقيم 001, 002 كما بالصورة
                      </div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('auto_grid')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'auto_grid'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold">شبكة متجاوبة تلقائية</div>
                      <div className="text-[10px] text-slate-400 mt-1">توزيع متوازن حسب عدد الصور</div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('hero_showcase')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'hero_showcase'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold">عرض مميز (Hero)</div>
                      <div className="text-[10px] text-slate-400 mt-1">صورة رئيسية كبيرة وحولها البقية</div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('side_by_side')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'side_by_side'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold">مقارنة جنب إلى جنب</div>
                      <div className="text-[10px] text-slate-400 mt-1">صورتين أو 3 بجانب بعض</div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('horizontal_strip')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'horizontal_strip'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold">شريط أفقي (Strip)</div>
                      <div className="text-[10px] text-slate-400 mt-1">صف أفقي ممتد في سطر واحد</div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('vertical_stack')}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        layoutMode === 'vertical_stack'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold">عمود رأسي (Stack)</div>
                      <div className="text-[10px] text-slate-400 mt-1">صور متتالية رأسياً فوق بعض</div>
                    </button>
                  </div>
                </div>

                {/* Columns Slider */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-300">عدد الأعمدة في السطر الواحد:</span>
                    <span className="font-mono font-black text-cyan-300 text-sm">{catalogColumns}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={catalogColumns}
                    onChange={(e) => {
                      setCatalogColumns(parseInt(e.target.value));
                      setLayoutMode('catalog_grid');
                    }}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1 عمود</span>
                    <span>11 (مثل الصورة)</span>
                    <span>20 عمود</span>
                  </div>
                </div>

                {/* Aspect Ratio per Item */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-300">أبعاد كل خانة صورة (Aspect Ratio):</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '16:9', label: '16:9 (عريض)' },
                      { id: '1:1', label: '1:1 (مربع)' },
                      { id: '4:3', label: '4:3 (كلاسيكي)' },
                      { id: '2:1', label: '2:1 (بانورامي)' },
                      { id: '3:4', label: '3:4 (طولي)' },
                      { id: '9:16', label: '9:16 (ستوري)' }
                    ].map(aspect => (
                      <button
                        key={aspect.id}
                        onClick={() => setItemAspect(aspect.id as any)}
                        className={`p-2 rounded-xl border text-center font-bold transition-all ${
                          itemAspect === aspect.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {aspect.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Fit Mode */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-300">طريقة ملاءمة الصورة داخل الخلية:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'contain', label: 'Contain (كاملة بدون قص)' },
                      { id: 'cover', label: 'Cover (ملء الخلية)' },
                      { id: 'fill', label: 'Fill (تمدد)' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setImageFit(mode.id as any)}
                        className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                          imageFit === mode.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Labeling / Numbering Section */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">عرض أرقام / نصوص أسفل الصور:</span>
                    <input
                      type="checkbox"
                      checked={showLabels}
                      onChange={(e) => setShowLabels(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 rounded"
                    />
                  </div>

                  {showLabels && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">صيغة الترقيم:</label>
                        <select
                          value={labelType}
                          onChange={(e) => setLabelType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="number_3digit">001, 002, 003... (مثل مرجعك تماماً)</option>
                          <option value="number_simple">1, 2, 3... (أرقام بسيطة)</option>
                          <option value="filename">اسم الملف الأصلي بدون الامتداد</option>
                          <option value="custom">نص مخصص لكل صورة</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="block text-[11px] text-slate-400 mb-1">حجم خط الرقم:</label>
                          <input
                            type="range"
                            min="8"
                            max="24"
                            value={labelFontSize}
                            onChange={(e) => setLabelFontSize(parseInt(e.target.value))}
                            className="w-full accent-cyan-400"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 pt-4">
                          <input
                            type="color"
                            value={labelColor}
                            onChange={(e) => setLabelColor(e.target.value)}
                            className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-400 font-mono">{labelColor}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Design & Styling */}
            {activeTab === 'design' && (
              <div className="space-y-5 animate-fade-in">
                {/* Background Selector */}
                <div>
                  <label className="block font-bold text-slate-300 mb-2">لون وخلفية اللوحة (Canvas):</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dark_obsidian', label: 'أسود مائل للزرقة (فاخر)', color: '#0b0f19' },
                      { id: 'black', label: 'أسود نقي (#000000)', color: '#000000' },
                      { id: 'transparent', label: 'شفاف بدون خلفية (PNG)', color: 'transparent' },
                      { id: 'white', label: 'أبيض ناصع (#FFFFFF)', color: '#ffffff' },
                      { id: 'gradient_purple', label: 'تدرج بنفسجي ملكي', color: '#180a22' },
                      { id: 'gradient_cyan', label: 'تدرج سيان مستقبلي', color: '#042f2e' },
                      { id: 'gradient_gold', label: 'تدرج ذهبي داكن', color: '#291b00' },
                      { id: 'custom', label: 'لون مخصص...', color: customBgColor }
                    ].map(bg => (
                      <button
                        key={bg.id}
                        onClick={() => setBgType(bg.id as any)}
                        className={`p-2.5 rounded-xl border text-right flex items-center gap-2 transition-all ${
                          bgType === bg.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0" 
                          style={{ backgroundColor: bg.color === 'transparent' ? 'transparent' : bg.color }} 
                        />
                        <span className="truncate">{bg.label}</span>
                      </button>
                    ))}
                  </div>

                  {bgType === 'custom' && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between">
                      <span className="text-slate-400 font-bold">اختر لونك الخاص:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customBgColor}
                          onChange={(e) => setCustomBgColor(e.target.value)}
                          className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                        />
                        <span className="font-mono text-white text-xs">{customBgColor}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Spacing Sliders */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-bold">المسافة بين الصور (Gap):</span>
                      <span className="font-mono text-cyan-300">{gap}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      value={gap}
                      onChange={(e) => setGap(parseInt(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-bold">الهامش المحيط باللوحة (Padding):</span>
                      <span className="font-mono text-cyan-300">{padding}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      value={padding}
                      onChange={(e) => setPadding(parseInt(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-bold">استدارة حواف الصور (Border Radius):</span>
                      <span className="font-mono text-cyan-300">{cardRadius}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={cardRadius}
                      onChange={(e) => setCardRadius(parseInt(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Card Border & Shadows */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">إطار حول كل صورة:</span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={cardBorderWidth}
                      onChange={(e) => setCardBorderWidth(parseInt(e.target.value))}
                      className="w-24 accent-cyan-400"
                    />
                    <span className="font-mono text-xs text-cyan-300">{cardBorderWidth}px</span>
                  </div>

                  {cardBorderWidth > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-slate-400">لون الإطار:</span>
                      <input
                        type="color"
                        value={cardBorderColor}
                        onChange={(e) => setCardBorderColor(e.target.value)}
                        className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="font-bold text-slate-300">ظل عميق خلف كل صورة:</span>
                    <input
                      type="checkbox"
                      checked={cardShadow}
                      onChange={(e) => setCardShadow(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Watermark & Anti-Theft Protection */}
            {activeTab === 'watermark' && (
              <div className="space-y-5 animate-fade-in">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="font-black text-amber-300 text-xs">حماية الصور بالعلامة المائية</h4>
                      <p className="text-[10px] text-amber-400/80">تطبيق علامة مائية مدمجة في التصدير لمنع السرقة</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={watermarkEnabled}
                    onChange={(e) => setWatermarkEnabled(e.target.checked)}
                    className="w-5 h-5 accent-amber-400 rounded cursor-pointer"
                  />
                </div>

                {watermarkEnabled && (
                  <div className="space-y-4">
                    {/* Watermark Type Selector */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setWatermarkType('text')}
                        className={`p-2.5 rounded-xl border text-center font-bold flex items-center justify-center gap-2 ${
                          watermarkType === 'text'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <Type className="w-4 h-4" />
                        <span>نص كتابي</span>
                      </button>

                      <button
                        onClick={() => setWatermarkType('image')}
                        className={`p-2.5 rounded-xl border text-center font-bold flex items-center justify-center gap-2 ${
                          watermarkType === 'image'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>شعار / صورة PNG</span>
                      </button>
                    </div>

                    {/* Text Watermark Input */}
                    {watermarkType === 'text' ? (
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">نص العلامة المائية:</label>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="مثلاً: Ahmed SVGA • SVGA Studio"
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {['Ahmed SVGA • SVGA Studio', 'DESIGNER • AHMED', 'SVGA EXCLUSIVE 👑', 'SAMPLE PREVIEW'].map(t => (
                            <button
                              key={t}
                              onClick={() => setWatermarkText(t)}
                              className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-slate-400 hover:text-amber-300"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Logo Image Upload */
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">رفع شعار أو لوجو مائي (PNG شفاف):</label>
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 flex items-center justify-center gap-2 text-xs font-bold"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{watermarkLogoUrl ? 'تغيير الشعار المرفوع' : 'اختيار شعار PNG'}</span>
                        </button>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const reader = new FileReader();
                              reader.onload = () => setWatermarkLogoUrl(reader.result as string);
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Pattern Distribution Style */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-2">طريقة توزيع العلامة المائية:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setWatermarkPattern('diagonal_repeat')}
                          className={`p-2.5 rounded-xl border text-right ${
                            watermarkPattern === 'diagonal_repeat'
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                              : 'bg-white/5 border-white/10 text-slate-400'
                          }`}
                        >
                          <div className="font-black">نمط مائل متكرر كامل (موصى به)</div>
                          <div className="text-[10px] text-slate-400">تكرار شبكي على كامل التصميم لحماية 100%</div>
                        </button>

                        <button
                          onClick={() => setWatermarkPattern('single_position')}
                          className={`p-2.5 rounded-xl border text-right ${
                            watermarkPattern === 'single_position'
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                              : 'bg-white/5 border-white/10 text-slate-400'
                          }`}
                        >
                          <div className="font-black">موضع فردي (ركن أو زاوية)</div>
                          <div className="text-[10px] text-slate-400">وضع علامة واحدة في زاوية معينة</div>
                        </button>
                      </div>
                    </div>

                    {/* Watermark Tuning Sliders */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-300">الشفافية (Opacity):</span>
                          <span className="font-mono text-amber-300 font-bold">{watermarkOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseInt(e.target.value))}
                          className="w-full accent-amber-400"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-300">حجم الخط / الشعار:</span>
                          <span className="font-mono text-amber-300 font-bold">{watermarkFontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="80"
                          value={watermarkFontSize}
                          onChange={(e) => setWatermarkFontSize(parseInt(e.target.value))}
                          className="w-full accent-amber-400"
                        />
                      </div>

                      {watermarkPattern === 'diagonal_repeat' && (
                        <>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-300">زاوية الميلان (Rotation Angle):</span>
                              <span className="font-mono text-amber-300 font-bold">{watermarkAngle}°</span>
                            </div>
                            <input
                              type="range"
                              min="-90"
                              max="90"
                              value={watermarkAngle}
                              onChange={(e) => setWatermarkAngle(parseInt(e.target.value))}
                              className="w-full accent-amber-400"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between mb-1">
                              <span className="text-slate-300">المسافة بين العلامات المائية:</span>
                              <span className="font-mono text-amber-300 font-bold">{watermarkSpacingX}px</span>
                            </div>
                            <input
                              type="range"
                              min="80"
                              max="400"
                              value={watermarkSpacingX}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setWatermarkSpacingX(val);
                                setWatermarkSpacingY(Math.round(val * 0.65));
                              }}
                              className="w-full accent-amber-400"
                            />
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-slate-300">لون العلامة المائية:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={watermarkColor}
                            onChange={(e) => setWatermarkColor(e.target.value)}
                            className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                          />
                          <span className="font-mono text-xs text-slate-400">{watermarkColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Uploaded Images Management */}
            {activeTab === 'images' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-200">الصور المرفوعة ({images.length})</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSortByName}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold"
                      title="ترتيب حسب الاسم (001 إلى 999 أو أ-ي)"
                    >
                      ترتيب A-Z
                    </button>
                    <button
                      onClick={handleReverseOrder}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold"
                      title="عكس الترتيب"
                    >
                      عكس
                    </button>
                    <button
                      onClick={handleShuffle}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold"
                      title="عشوائي"
                    >
                      <Shuffle className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setImages([])}
                      className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold"
                      title="مسح كافة الصور"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Add More Images Box */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صور أخرى دفعة واحدة</span>
                </button>

                {/* Images List */}
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                  {images.map((img, index) => (
                    <div
                      key={img.id}
                      className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 flex items-center justify-between gap-2.5 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-mono text-[10px] font-black text-cyan-400 shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          <img src={img.dataUrl} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-200 truncate">{img.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{img.width} × {img.height} px</p>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveImage(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveImage(index, 'down')}
                          disabled={index === images.length - 1}
                          className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 disabled:opacity-30"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRotateImage(img.id)}
                          className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300"
                          title="تدوير 90 درجة"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: Export & Download */}
            {activeTab === 'export' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block font-bold text-slate-300 mb-2">صيغة الملف النهائي:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'png', label: 'PNG (شفاف وعالي الدقة)' },
                      { id: 'jpeg', label: 'JPG / JPEG (صغير الحجم)' },
                      { id: 'webp', label: 'WebP (حديث وسريع)' }
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        onClick={() => setExportFormat(fmt.id as any)}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs ${
                          exportFormat === fmt.id
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution Multiplier */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
                  <label className="block font-bold text-slate-300">مضاعف الدقة وجودة التصدير (Scaling):</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { scale: 1, label: '1x قياسي', desc: 'سريع' },
                      { scale: 2, label: '2x فائق الدقة (UHD)', desc: 'موصى به' },
                      { scale: 3, label: '3x ماستر 8K', desc: 'للطباعة والمشاريع' }
                    ].map(item => (
                      <button
                        key={item.scale}
                        onClick={() => setExportScale(item.scale)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          exportScale === item.scale
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 font-black'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs">{item.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-400 pt-2 font-mono text-center">
                    دقة الصورة الناتجة: <strong className="text-cyan-300">{Math.round(layoutCalculations.width * exportScale)} × {Math.round(layoutCalculations.height * exportScale)} px</strong>
                  </div>
                </div>

                {/* Big Action Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={handleExportDownload}
                    disabled={isExporting || images.length === 0}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isExporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    <span>{isExporting ? `جاري المعالجة والتصدير...` : 'تحميل الصورة المجمعة كاملة'}</span>
                  </button>

                  <button
                    onClick={handleCopyClipboard}
                    disabled={images.length === 0}
                    className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    {copiedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                    <span>{copiedSuccess ? 'تم نسخ الصورة إلى الحافظة بنجاح!' : 'نسخ الصورة المجمعة للحافظة'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen High-Res Modal Preview */}
      {isFullscreenPreview && previewDataUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col p-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">معاينة ملء الشاشة بجودة فائقة</span>
              <span className="text-xs text-slate-400 font-mono">({layoutCalculations.width} × {layoutCalculations.height} px)</span>
            </div>
            <button
              onClick={() => setIsFullscreenPreview(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img 
              src={previewDataUrl} 
              alt="Fullscreen Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10" 
            />
          </div>

          <div className="flex justify-center gap-3 pt-3 border-t border-white/10">
            <button
              onClick={handleCopyClipboard}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2"
            >
              <Copy className="w-4 h-4 text-cyan-400" />
              <span>نسخ للحافظة</span>
            </button>
            <button
              onClick={handleExportDownload}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              <Download className="w-4 h-4" />
              <span>تحميل الصورة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default ImageCollageStudio;
