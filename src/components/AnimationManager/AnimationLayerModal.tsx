import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Layers, Eye, EyeOff, Trash2, Download, Play, Pause, RefreshCw, 
  Sparkles, Check, Search, Sliders, FileCode2, Image as ImageIcon, 
  Type as TypeIcon, Box, ArrowUp, ArrowDown, ShieldCheck, Film, Video
} from 'lucide-react';
import { AnimationItem, ExportFormat } from './types';
import { exportItem } from './utils/exportEngine';
import { getPAG } from '../../utils/pagEngine';

interface LayerInfo {
  id: string;
  index: number;
  name: string;
  type: string; // 'image' | 'text' | 'shape' | 'precompose' | 'solid' | 'null' | 'unknown'
  visible: boolean;
  thumbnailUrl?: string;
  rawLayer?: any;
  parentContainer?: any;
}

interface AnimationLayerModalProps {
  item: AnimationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: (updatedItem: AnimationItem) => void;
}

const extractPagLayersSafely = (PAG: any, pagFile: any): LayerInfo[] => {
  const result: LayerInfo[] = [];
  const visitedIds = new Set<string>();

  // 1. Recursive Composition Child Layers
  const traverseComposition = (container: any, path = '') => {
    if (!container || typeof container.numChildren !== 'function') return;
    try {
      const count = container.numChildren();
      for (let i = 0; i < count; i++) {
        try {
          const layer = typeof container.getLayerAt === 'function' ? container.getLayerAt(i) : null;
          if (!layer) continue;

          const rawName = (typeof layer.layerName === 'function' ? layer.layerName() : layer.layerName) || `Layer_${i + 1}`;
          const fullName = path ? `${path} / ${rawName}` : rawName;
          const lTypeNum = typeof layer.layerType === 'function' ? layer.layerType() : 0;

          let typeStr = 'layer';
          if (lTypeNum === 1) typeStr = 'null';
          else if (lTypeNum === 2) typeStr = 'solid';
          else if (lTypeNum === 3) typeStr = 'text';
          else if (lTypeNum === 4) typeStr = 'shape';
          else if (lTypeNum === 5) typeStr = 'image';
          else if (lTypeNum === 6) typeStr = 'precompose';

          const layerId = `pag-${result.length}-${i}`;
          if (!visitedIds.has(layerId)) {
            visitedIds.add(layerId);
            result.push({
              id: layerId,
              index: i,
              name: fullName,
              type: typeStr,
              visible: typeof layer.visible === 'function' ? layer.visible() : true,
              rawLayer: layer,
              parentContainer: container
            });
          }

          // If child is a composition (PreCompose), recurse inside it
          if (typeof layer.numChildren === 'function' && layer.numChildren() > 0) {
            traverseComposition(layer, fullName);
          }
        } catch (e) {
          console.warn('Error reading PAG child layer', i, e);
        }
      }
    } catch (e) {
      console.warn('Error reading composition numChildren', e);
    }
  };

  try {
    traverseComposition(pagFile, '');
  } catch (e) {
    console.warn('Traverse composition failed:', e);
  }

  // 2. Editable Text Layers (numTexts)
  try {
    if (typeof pagFile.numTexts === 'function') {
      const numT = pagFile.numTexts();
      for (let t = 0; t < numT; t++) {
        let textName = `Text_Object_${t + 1}`;
        try {
          const textData = pagFile.getTextData(t);
          if (textData?.text) textName = textData.text;
        } catch {}

        let layersArr: any[] = [];
        try {
          if (PAG?.LayerType && typeof pagFile.getLayersByEditableIndex === 'function') {
            layersArr = pagFile.getLayersByEditableIndex(t, PAG.LayerType.Text) || [];
          }
        } catch {}

        if (layersArr.length > 0) {
          layersArr.forEach((l: any, idx: number) => {
            const lId = `pag-editable-text-${t}-${idx}`;
            if (!visitedIds.has(lId)) {
              visitedIds.add(lId);
              result.push({
                id: lId,
                index: t,
                name: textName,
                type: 'text',
                visible: typeof l.visible === 'function' ? l.visible() : true,
                rawLayer: l,
                parentContainer: pagFile
              });
            }
          });
        } else {
          const lId = `pag-text-${t}`;
          if (!visitedIds.has(lId)) {
            visitedIds.add(lId);
            result.push({
              id: lId,
              index: t,
              name: textName,
              type: 'text',
              visible: true,
              rawLayer: pagFile,
              parentContainer: pagFile
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Editable text extraction failed:', e);
  }

  // 3. Editable Image Layers (numImages)
  try {
    if (typeof pagFile.numImages === 'function') {
      const numI = pagFile.numImages();
      for (let img = 0; img < numI; img++) {
        const imageName = `Image_Object_${img + 1}`;

        let layersArr: any[] = [];
        try {
          if (PAG?.LayerType && typeof pagFile.getLayersByEditableIndex === 'function') {
            layersArr = pagFile.getLayersByEditableIndex(img, PAG.LayerType.Image) || [];
          }
        } catch {}

        if (layersArr.length > 0) {
          layersArr.forEach((l: any, idx: number) => {
            const lId = `pag-editable-img-${img}-${idx}`;
            if (!visitedIds.has(lId)) {
              visitedIds.add(lId);
              result.push({
                id: lId,
                index: img,
                name: imageName,
                type: 'image',
                visible: typeof l.visible === 'function' ? l.visible() : true,
                rawLayer: l,
                parentContainer: pagFile
              });
            }
          });
        } else {
          const lId = `pag-image-${img}`;
          if (!visitedIds.has(lId)) {
            visitedIds.add(lId);
            result.push({
              id: lId,
              index: img,
              name: imageName,
              type: 'image',
              visible: true,
              rawLayer: pagFile,
              parentContainer: pagFile
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Editable image extraction failed:', e);
  }

  // 4. Guaranteed Fallback if 0 layers detected
  if (result.length === 0) {
    result.push({
      id: 'pag-main-comp-0',
      index: 0,
      name: 'PAG Composition Root Layer',
      type: 'precompose',
      visible: true,
      rawLayer: pagFile,
      parentContainer: pagFile
    });
  }

  return result;
};

export const AnimationLayerModal: React.FC<AnimationLayerModalProps> = ({
  item,
  isOpen,
  onClose,
  onItemUpdated
}) => {
  if (!isOpen || !item) return null;

  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [backdrop, setBackdrop] = useState<'checkerboard' | 'dark' | 'green' | 'white'>('checkerboard');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('mp4');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [exportResultUrl, setExportResultUrl] = useState<string | null>(null);
  const [exportResultFileName, setExportResultFileName] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pagPlayerRef = useRef<any>(null);
  const pagFileRef = useRef<any>(null);
  const svgaProjectRef = useRef<any>(null);

  const cleanupPag = () => {
    if (pagPlayerRef.current) {
      const p = pagPlayerRef.current;
      pagPlayerRef.current = null;
      try {
        if (!p.isDestroyed) {
          if (typeof p.stop === 'function') p.stop();
          if (typeof p.pause === 'function') p.pause();
          if (typeof p.destroy === 'function') p.destroy();
        }
      } catch (e) {
        console.warn('pagPlayer cleanup warning:', e);
      }
    }
    if (pagFileRef.current) {
      const f = pagFileRef.current;
      pagFileRef.current = null;
      try {
        if (!f.isDestroyed && typeof f.destroy === 'function') {
          f.destroy();
        }
      } catch (e) {
        console.warn('pagFile cleanup warning:', e);
      }
    }
  };

  // Load animation and parse layers
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setExportResultUrl(null);
    cleanupPag();

    const parseLayers = async () => {
      try {
        const itemFormat = (item.format || '').toLowerCase();

        if (itemFormat === 'pag') {
          // Parse PAG File Layers via libpag with getPAG() WASM initialization
          const PAG = await getPAG();
          const buffer = await item.file.arrayBuffer();
          const pagFile = await PAG.PAGFile.load(buffer);
          pagFileRef.current = pagFile;

          if (isCancelled) return;

          if (pagFile) {
            const parsed = extractPagLayersSafely(PAG, pagFile);
            setLayers(parsed);

            if (canvasRef.current) {
              try {
                const pagView = await PAG.PAGView.init(pagFile, canvasRef.current);
                pagPlayerRef.current = pagView;
                pagView.setRepeatCount(0);
                await pagView.play();
              } catch (e) {
                console.warn('PAGView init warning:', e);
                // Draw fallback image
                const ctx = canvasRef.current.getContext('2d');
                if (ctx && item.previewUrl) {
                  const img = new Image();
                  img.src = item.previewUrl;
                  img.onload = () => {
                    if (canvasRef.current) {
                      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                      ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                    }
                  };
                }
              }
            }
          }
        } else if (itemFormat === 'svga') {
          // Parse SVGA File Layers via svgaParserEngine
          const { parseSvgaToProject } = await import('../SvgaLayerEditor/svgaParserEngine');
          const res = await parseSvgaToProject(item.file);
          const parsedLayers = res?.layers || [];
          svgaProjectRef.current = res;

          if (isCancelled) return;

          let parsed: LayerInfo[] = parsedLayers.map((l, idx) => ({
            id: l.id || `svga-layer-${idx}`,
            index: idx,
            name: l.name || `Layer_${idx + 1}`,
            type: l.thumbnailUrl ? 'image' : 'shape',
            visible: l.visible !== false,
            thumbnailUrl: l.thumbnailUrl,
            rawLayer: l
          }));

          if (parsed.length === 0) {
            parsed.push({
              id: 'svga-root-0',
              index: 0,
              name: 'SVGA Root Animation Layer',
              type: 'image',
              visible: true,
              thumbnailUrl: item.previewUrl
            });
          }

          setLayers(parsed);

          // Render SVGA to Canvas
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const img = new Image();
              img.src = item.previewUrl;
              img.onload = () => {
                if (canvasRef.current) {
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }
              };
            }
          }
        } else if (itemFormat === 'lottie' || itemFormat === 'dotlottie') {
          const lData = item.lottieData;
          if (lData && Array.isArray(lData.layers)) {
            const parsed: LayerInfo[] = lData.layers.map((l: any, idx: number) => ({
              id: `lottie-layer-${idx}`,
              index: idx,
              name: l.nm || `Layer_${idx + 1}`,
              type: l.ty === 2 ? 'image' : l.ty === 4 ? 'shape' : l.ty === 5 ? 'text' : 'solid',
              visible: l.hd !== true,
              rawLayer: l
            }));
            setLayers(parsed.length > 0 ? parsed : [{
              id: 'lottie-root-0',
              index: 0,
              name: 'Lottie Main Layer',
              type: 'shape',
              visible: true
            }]);
          } else {
            setLayers([{
              id: 'lottie-root-0',
              index: 0,
              name: 'Lottie Composition Layer',
              type: 'shape',
              visible: true
            }]);
          }
        } else {
          // General image/video frame layer
          setLayers([
            {
              id: 'main-layer-0',
              index: 0,
              name: item.name,
              type: 'image',
              visible: true,
              thumbnailUrl: item.previewUrl
            }
          ]);
        }
      } catch (err) {
        console.warn('Failed to parse layers:', err);
        // Fallback layer to ensure UI never shows 0 layers
        setLayers([
          {
            id: 'fallback-layer-0',
            index: 0,
            name: item.name || 'Main Animation Layer',
            type: 'precompose',
            visible: true,
            thumbnailUrl: item.previewUrl
          }
        ]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    parseLayers();

    return () => {
      isCancelled = true;
      cleanupPag();
    };
  }, [item]);

  // Toggle Layer Visibility
  const handleToggleVisibility = async (layerId: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layerId) {
        const nextVis = !l.visible;
        if ((item.format || '').toLowerCase() === 'pag' && l.rawLayer) {
          try {
            if (typeof l.rawLayer.setVisible === 'function') {
              l.rawLayer.setVisible(nextVis);
            }
          } catch (e) { console.warn('PAG setVisible error:', e); }
        } else if ((item.format || '').toLowerCase() === 'svga' && l.rawLayer) {
          l.rawLayer.visible = nextVis;
        } else if (((item.format || '').toLowerCase() === 'lottie' || (item.format || '').toLowerCase() === 'dotlottie') && l.rawLayer) {
          l.rawLayer.hd = !nextVis;
        }
        return { ...l, visible: nextVis };
      }
      return l;
    }));

    if ((item.format || '').toLowerCase() === 'pag' && pagPlayerRef.current && !pagPlayerRef.current.isDestroyed) {
      try {
        if (typeof pagPlayerRef.current.flush === 'function') {
          await pagPlayerRef.current.flush();
        }
      } catch (e) {}
    }
  };

  // Delete Layer
  const handleDeleteLayer = async (layerId: string) => {
    const layerToDelete = layers.find(l => l.id === layerId);
    if (!layerToDelete) return;

    if ((item.format || '').toLowerCase() === 'pag' && layerToDelete.rawLayer) {
      try {
        const parent = layerToDelete.parentContainer || pagFileRef.current;
        if (parent && typeof parent.removeLayer === 'function') {
          parent.removeLayer(layerToDelete.rawLayer);
        } else if (typeof layerToDelete.rawLayer.removeFromParent === 'function') {
          layerToDelete.rawLayer.removeFromParent();
        }
      } catch (e) {
        console.warn('PAG removeLayer error:', e);
      }
    } else if ((item.format || '').toLowerCase() === 'svga' && svgaProjectRef.current?.layers) {
      svgaProjectRef.current.layers = svgaProjectRef.current.layers.filter((l: any) => l.id !== layerToDelete.id);
    } else if (((item.format || '').toLowerCase() === 'lottie' || (item.format || '').toLowerCase() === 'dotlottie') && item.lottieData?.layers) {
      item.lottieData.layers = item.lottieData.layers.filter((l: any, idx: number) => idx !== layerToDelete.index);
    }

    setLayers(prev => prev.filter(l => l.id !== layerId));

    if ((item.format || '').toLowerCase() === 'pag' && pagPlayerRef.current && !pagPlayerRef.current.isDestroyed) {
      try {
        if (typeof pagPlayerRef.current.flush === 'function') {
          await pagPlayerRef.current.flush();
        }
      } catch (e) {}
    }
  };

  // Bulk Visibility Actions
  const handleToggleAll = async (visible: boolean) => {
    setLayers(prev => prev.map(l => {
      if ((item.format || '').toLowerCase() === 'pag' && l.rawLayer) {
        try {
          if (typeof l.rawLayer.setVisible === 'function') {
            l.rawLayer.setVisible(visible);
          }
        } catch {}
      } else if ((item.format || '').toLowerCase() === 'svga' && l.rawLayer) {
        l.rawLayer.visible = visible;
      }
      return { ...l, visible };
    }));

    if ((item.format || '').toLowerCase() === 'pag' && pagPlayerRef.current && !pagPlayerRef.current.isDestroyed) {
      try {
        if (typeof pagPlayerRef.current.flush === 'function') {
          await pagPlayerRef.current.flush();
        }
      } catch {}
    }
  };

  // Export Modified Animation
  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(10);
    setExportStatusText('جاري إعداد الطبقات والمعالجة...');

    try {
      const exportRes = await exportItem(
        item,
        selectedFormat,
        {
          fps: item.fps || 30,
          quality: 90,
          backgroundColor: 'transparent',
          onProgress: (pct, status) => {
            setExportProgress(pct);
            if (status) setExportStatusText(status);
          }
        }
      );

      const targetBlob = (exportRes && (exportRes as any).blob) ? (exportRes as any).blob : exportRes;
      const url = URL.createObjectURL(targetBlob as Blob);
      const ext = (exportRes && (exportRes as any).extension) ? (exportRes as any).extension : (selectedFormat === 'png_frames' ? 'zip' : selectedFormat);
      const cleanName = item.name.replace(/\.[^/.]+$/, "");
      const fileName = (exportRes && (exportRes as any).filename) ? (exportRes as any).filename : `${cleanName}_modified_layers.${ext}`;

      setExportResultUrl(url);
      setExportResultFileName(fileName);
      setExportProgress(100);
      setExportStatusText('تم التصدير بنجاح!');
    } catch (err: any) {
      console.error('Export error in layer modal:', err);
      alert('حدث خطأ أثناء التصدير: ' + (err.message || String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Layers
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return layers;
    const q = searchQuery.toLowerCase();
    return layers.filter(l => l.name.toLowerCase().includes(q) || l.type.toLowerCase().includes(q));
  }, [layers, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-md">{item.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.format.toUpperCase()}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {layers.length} طبقة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                محرر وإدارة الطبقات التفصيلي - قم بإخفاء أو حذف أي طبقة وإعادة التصدير بأي صيغة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Column: Interactive Live Preview & Controls (5 Cols) */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-l border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto">
            
            {/* Live Canvas Preview */}
            <div className={`relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center ${
              backdrop === 'checkerboard' 
                ? 'bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950' 
                : backdrop === 'dark' 
                ? 'bg-slate-950' 
                : backdrop === 'green' 
                ? 'bg-emerald-600' 
                : 'bg-white'
            }`}>
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-400" />
                  <span className="text-xs font-medium">جاري تفكيك وقراءة جميع طبقات الملف...</span>
                </div>
              ) : (
                <canvas 
                  ref={canvasRef} 
                  width={item.dimensions.width || 500} 
                  height={item.dimensions.height || 500}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>

            {/* Backdrop Controls */}
            <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">خلفية العرض:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBackdrop('checkerboard')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${backdrop === 'checkerboard' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  مربعات
                </button>
                <button
                  onClick={() => setBackdrop('dark')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${backdrop === 'dark' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  داكن
                </button>
                <button
                  onClick={() => setBackdrop('green')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${backdrop === 'green' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  كروما
                </button>
              </div>
            </div>

            {/* Quick Export Panel */}
            <div className="mt-auto bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 p-4 rounded-2xl border border-indigo-500/30 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>تصدير النتيجة المعدلة</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  All Formats Supported
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {(['mp4', 'webm', 'vap', 'yyeva', 'svga', 'gif', 'webp', 'apng', 'lottie', 'png_frames'] as ExportFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all uppercase border ${
                      selectedFormat === fmt 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-md' 
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {fmt === 'png_frames' ? 'PNG ZIP' : fmt}
                  </button>
                ))}
              </div>

              {exportResultUrl ? (
                <div className="space-y-2 pt-1">
                  <a
                    href={exportResultUrl}
                    download={exportResultFileName}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل الملف المعدل ({exportResultFileName})</span>
                  </a>
                  <button
                    onClick={() => setExportResultUrl(null)}
                    className="w-full py-1 text-[11px] text-slate-400 hover:text-white text-center"
                  >
                    إعادة التصدير بصيغة أخرى
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{exportStatusText || `جاري التصدير (${exportProgress}%)...`}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>تصدير الآن بصيغة {selectedFormat.toUpperCase()}</span>
                    </>
                  )}
                </button>
              )}
            </div>

          </div>

          {/* Right Column: Layer List & Editing Tools (7 Cols) */}
          <div className="lg:col-span-7 p-4 flex flex-col gap-3 overflow-hidden bg-slate-900">
            
            {/* Search & Bulk Toolbar */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الطبقة أو النوع..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleAll(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إظهار الكل</span>
                </button>
                <button
                  onClick={() => handleToggleAll(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>إخفاء الكل</span>
                </button>
              </div>
            </div>

            {/* Layer List Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {filteredLayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs gap-2">
                  <Layers className="w-8 h-8 text-slate-600" />
                  <span>لا توجد طبقات مطابقة للبحث</span>
                </div>
              ) : (
                filteredLayers.map((layer, idx) => (
                  <div
                    key={layer.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      layer.visible
                        ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    {/* Layer Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[11px] font-mono text-slate-400 shrink-0">
                        {idx + 1}
                      </span>

                      {/* Layer Icon/Thumbnail */}
                      <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                        {layer.thumbnailUrl ? (
                          <img src={layer.thumbnailUrl} alt="" className="w-full h-full object-contain" />
                        ) : layer.type === 'text' ? (
                          <TypeIcon className="w-4 h-4 text-sky-400" />
                        ) : layer.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                        ) : layer.type === 'shape' ? (
                          <Box className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Layers className="w-4 h-4 text-amber-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-200 truncate">{layer.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase border ${
                            layer.type === 'image' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : layer.type === 'text' 
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                          }`}>
                            {layer.type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">ID: {layer.id}</span>
                      </div>
                    </div>

                    {/* Layer Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => handleToggleVisibility(layer.id)}
                        title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                        className={`p-2 rounded-lg border transition-colors ${
                          layer.visible
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        }`}
                      >
                        {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleDeleteLayer(layer.id)}
                        title="حذف هذه الطبقة بالكامل"
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>إجمالي الطبقات: <strong className="text-white">{layers.length}</strong></span>
              <span>الظاهرة: <strong className="text-emerald-400">{layers.filter(l => l.visible).length}</strong></span>
              <span>المخفية: <strong className="text-amber-400">{layers.filter(l => !l.visible).length}</strong></span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
