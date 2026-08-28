import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers, FolderOpen as FileFolder, Plus, Eye, EyeOff, Lock, Unlock,
  Play, Pause, RotateCcw, Download, Sparkles, Move, Type, Square, Circle,
  Image as ImageIcon, RefreshCw, X, ChevronRight, ChevronDown, Sliders,
  Info, Search, Trash2, Copy, Combine, FileCode, Check, ShieldCheck, ArrowLeft,
  MousePointer, Grid, Settings, Film, Maximize2, Minimize2, Undo2, Redo2,
  Box, Hash, Edit2, FileVideo
} from 'lucide-react';
import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { UserRecord } from '../types';
import { logActivity } from '../utils/logger';

// Setup Protobuf MovieEntity
const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

interface SvgaStudioEditorProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onSubscriptionRequired?: () => void;
}

export interface SVGALayerItem {
  id: string;
  imageKey: string;
  name: string;
  type: 'image' | 'shape' | 'text';
  visible: boolean;
  locked: boolean;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    opacity: number;
  };
  customImage?: string;
  shapeData?: {
    type: 'rect' | 'circle' | 'polygon';
    fill: string;
    width: number;
    height: number;
  };
  frames?: any[];
}

export const SvgaStudioEditor: React.FC<SvgaStudioEditorProps> = ({
  currentUser,
  onCancel,
  onSubscriptionRequired
}) => {
  // File & Project state
  const [appMode, setAppMode] = useState<'landing' | 'editor'>('landing');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('sds.svga');
  const [movieData, setMovieData] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Scene metadata
  const [sceneWidth, setSceneWidth] = useState<number>(500);
  const [sceneHeight, setSceneHeight] = useState<number>(500);
  const [fps, setFps] = useState<number>(20);
  const [totalFrames, setTotalFrames] = useState<number>(61);
  const [durationSec, setDurationSec] = useState<number>(3.05);
  const [lastAction, setLastAction] = useState<string>('Document initialized');

  // Animation playback
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Layers & Assets
  const [layers, setLayers] = useState<SVGALayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [searchLayer, setSearchLayer] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'layers' | 'shapes' | 'text' | 'assets'>('layers');
  const [assetFilter, setAssetFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [imagesMap, setImagesMap] = useState<Record<string, string>>({});

  // Canvas interaction
  const [zoom, setZoom] = useState<number>(100);
  const [activeShapeTool, setActiveShapeTool] = useState<'rectangle' | 'ellipse' | 'polygon' | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Timeline expanded tracks
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>({});

  // Cubic Bezier Easing state
  const [easingBezier, setEasingBezier] = useState<[number, number, number, number]>([0.25, 0.1, 0.25, 1.0]);

  // Canvas element ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Parse SVGA File
  const parseSvgaFile = async (uploadedFile: File) => {
    setIsLoading(true);
    try {
      const buffer = await uploadedFile.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      
      let inflated: Uint8Array;
      try {
        inflated = pako.inflate(uint8Array);
      } catch (e) {
        try {
          inflated = pako.inflateRaw(uint8Array);
        } catch (e2) {
          inflated = uint8Array;
        }
      }

      const decoded = MovieEntity.decode(inflated);
      const obj = MovieEntity.toObject(decoded, {
        keepCase: true,
        longs: Number,
        enums: Number,
        bytes: Uint8Array,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true
      } as any);

      setMovieData(obj);
      setFile(uploadedFile);
      setFileName(uploadedFile.name);

      const w = obj.params?.viewBoxWidth || 500;
      const h = obj.params?.viewBoxHeight || 500;
      const fCount = obj.params?.frames || 60;
      const fFps = obj.params?.fps || 30;

      setSceneWidth(w);
      setSceneHeight(h);
      setTotalFrames(fCount);
      setFps(fFps);
      setDurationSec(parseFloat((fCount / fFps).toFixed(2)));

      // Extract images map
      const extractedImages: Record<string, string> = {};
      if (obj.images) {
        for (const [key, val] of Object.entries(obj.images)) {
          if (typeof val === 'string') {
            extractedImages[key] = (val as string).startsWith('data:') ? (val as string) : `data:image/png;base64,${val}`;
          } else if (val instanceof Uint8Array || Array.isArray(val)) {
            const bytes = val instanceof Uint8Array ? val : new Uint8Array(val);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            extractedImages[key] = `data:image/png;base64,${base64}`;
          }
        }
      }
      setImagesMap(extractedImages);

      // Build initial layers list from sprites
      const spriteLayers: SVGALayerItem[] = (obj.sprites || []).map((sprite: any, idx: number) => {
        const imageKey = sprite.imageKey || `img_${idx}`;
        return {
          id: `sprite_${idx}_${imageKey}`,
          imageKey: imageKey,
          name: sprite.imageKey || `img_${idx}`,
          type: 'image',
          visible: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 100
          },
          frames: sprite.frames || []
        };
      });

      setLayers(spriteLayers);
      if (spriteLayers.length > 0) {
        setSelectedLayerId(spriteLayers[0].id);
      }
      setIsLoaded(true);
      setLastAction('SVGA document loaded successfully');

      if (currentUser) {
        logActivity(currentUser, 'upload', `Opened SVGA in Studio Editor: ${uploadedFile.name}`);
      }
    } catch (err) {
      console.error("Failed to parse SVGA:", err);
      alert("تعذر قراءة ملف SVGA. تأكد أن الملف بصيغة SVGA 2.0 صالحة.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new custom image layer
  const handleAddImageLayer = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const uploadedImg = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const newKey = `added_img_${Date.now()}`;

      // Update images map
      setImagesMap(prev => ({ ...prev, [newKey]: dataUrl }));

      // Append image bytes to movieData if present
      if (movieData) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        if (!movieData.images) movieData.images = {};
        movieData.images[newKey] = bytes;
      }

      const newLayer: SVGALayerItem = {
        id: `custom_${newKey}`,
        imageKey: newKey,
        name: uploadedImg.name.replace(/\.[^/.]+$/, ""),
        type: 'image',
        visible: true,
        locked: false,
        transform: {
          x: sceneWidth / 4,
          y: sceneHeight / 4,
          scaleX: 0.5,
          scaleY: 0.5,
          rotation: 0,
          opacity: 100
        },
        customImage: dataUrl
      };

      setLayers(prev => [newLayer, ...prev]);
      setSelectedLayerId(newLayer.id);
      setLastAction(`Added image layer: ${uploadedImg.name}`);
    };

    reader.readAsDataURL(uploadedImg);
  };

  // Merge another SVGA file into current scene
  const handleMergeSvga = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !movieData) return;
    const mergeFile = event.target.files[0];

    try {
      const buffer = await mergeFile.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      let inflated: Uint8Array;
      try {
        inflated = pako.inflate(uint8Array);
      } catch (e) {
        inflated = pako.inflateRaw(uint8Array);
      }

      const decoded = MovieEntity.decode(inflated);
      const mergeObj = MovieEntity.toObject(decoded, {
        keepCase: true,
        longs: Number,
        enums: Number,
        bytes: Uint8Array,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true
      } as any);

      // Merge images
      const mergedExtractedImages: Record<string, string> = { ...imagesMap };
      if (mergeObj.images) {
        for (const [key, val] of Object.entries(mergeObj.images)) {
          const uniqueKey = `merge_${key}_${Date.now()}`;
          let dataUrl = '';
          if (typeof val === 'string') {
            dataUrl = (val as string).startsWith('data:') ? (val as string) : `data:image/png;base64,${val}`;
          } else if (val instanceof Uint8Array || Array.isArray(val)) {
            const bytes = val instanceof Uint8Array ? val : new Uint8Array(val);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            dataUrl = `data:image/png;base64,${btoa(binary)}`;
          }
          mergedExtractedImages[uniqueKey] = dataUrl;
          if (movieData.images) {
            const base64 = dataUrl.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            movieData.images[uniqueKey] = bytes;
          }
        }
      }
      setImagesMap(mergedExtractedImages);

      // Merge sprites
      const mergedSpriteLayers: SVGALayerItem[] = (mergeObj.sprites || []).map((sprite: any, idx: number) => {
        const mergeKey = `merge_${sprite.imageKey || idx}_${Date.now()}`;
        return {
          id: `sprite_merge_${idx}_${Date.now()}`,
          imageKey: mergeKey,
          name: `merge_${sprite.imageKey || idx}`,
          type: 'image',
          visible: true,
          locked: false,
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 100
          },
          frames: sprite.frames || []
        };
      });

      setLayers(prev => [...mergedSpriteLayers, ...prev]);
      setLastAction(`Merged SVGA file: ${mergeFile.name}`);
      alert(`تم دمج ${mergedSpriteLayers.length} طبقة من ملف ${mergeFile.name} بنجاح!`);
    } catch (err) {
      console.error("Merge error:", err);
      alert("فشل دمج ملف SVGA. يرجى التأكد من سلامة الملف.");
    }
  };

  // Add shape layer
  const handleAddShape = (shapeType: 'rectangle' | 'ellipse' | 'polygon') => {
    const shapeId = `shape_${shapeType}_${Date.now()}`;
    const newShapeLayer: SVGALayerItem = {
      id: shapeId,
      imageKey: shapeId,
      name: `shape_${shapeType}`,
      type: 'shape',
      visible: true,
      locked: false,
      transform: {
        x: sceneWidth / 3,
        y: sceneHeight / 3,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 100
      },
      shapeData: {
        type: shapeType === 'ellipse' ? 'circle' : shapeType === 'polygon' ? 'polygon' : 'rect',
        fill: '#a855f7',
        width: 120,
        height: 120
      }
    };

    setLayers(prev => [newShapeLayer, ...prev]);
    setSelectedLayerId(newShapeLayer.id);
    setLastAction(`Added shape: ${shapeType}`);
  };

  // Export updated SVGA file
  const handleExportSvga = async () => {
    if (!movieData) return;
    setIsLoading(true);

    try {
      const exportMovieObj = JSON.parse(JSON.stringify(movieData));
      
      // Update image bytes in export object
      const imagesObj: Record<string, Uint8Array> = {};
      for (const [key, rawDataUrl] of Object.entries(imagesMap)) {
        const dataUrl = rawDataUrl as string;
        if (dataUrl) {
          const base64 = dataUrl.startsWith('data:') ? dataUrl.split(',')[1] : dataUrl;
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          imagesObj[key] = bytes;
        }
      }
      exportMovieObj.images = imagesObj;

      // Encode using MovieEntity protobuf
      const errMsg = MovieEntity.verify(exportMovieObj);
      if (errMsg) throw new Error(errMsg);

      const message = MovieEntity.fromObject(exportMovieObj);
      const encodedBuffer = MovieEntity.encode(message).finish();
      const deflated = pako.deflate(encodedBuffer, { level: 9 });

      const blob = new Blob([deflated], { type: 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName ? fileName.replace(/\.svga$/i, '_edited.svga') : 'edited_animation.svga';
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setLastAction('Exported SVGA file successfully');
      if (currentUser) {
        logActivity(currentUser, 'export', `Exported SVGA file: ${fileName}`);
      }
    } catch (err) {
      console.error("Failed to export SVGA:", err);
      alert("حدث خطأ أثناء تصدير ملف SVGA.");
    } finally {
      setIsLoading(false);
    }
  };

  // Render loop for interactive canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render background grid
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render layers from bottom to top
    const renderOrder = [...layers].reverse();

    for (const layer of renderOrder) {
      if (!layer.visible) continue;

      const frame = layer.frames?.[currentFrame];
      if (layer.type === 'image' && layer.frames && layer.frames.length > 0 && !frame) {
        continue; // Frame doesn't exist at this point in time
      }

      ctx.save();
      
      // Base layer custom transform
      const { x, y, scaleX, scaleY, rotation, opacity } = layer.transform;
      
      ctx.globalAlpha = opacity / 100;
      
      // Apply user transform first (global position offset)
      ctx.translate(x + (sceneWidth * scaleX) / 2, y + (sceneHeight * scaleY) / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // If it's a built-in SVGA layer with frames, apply frame transform
      if (frame && frame.transform) {
        const { a, b, c, d, tx, ty } = frame.transform;
        if (a !== undefined) {
           ctx.transform(a, b, c, d, tx, ty);
        }
      }
      if (frame && frame.alpha !== undefined) {
        ctx.globalAlpha *= frame.alpha;
      }

      if (layer.type === 'shape' && layer.shapeData) {
        ctx.fillStyle = layer.shapeData.fill || '#a855f7';
        if (layer.shapeData.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, (layer.shapeData.width / 2) * scaleX, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(
            (-layer.shapeData.width / 2) * scaleX,
            (-layer.shapeData.height / 2) * scaleY,
            layer.shapeData.width * scaleX,
            layer.shapeData.height * scaleY
          );
        }
      } else {
        const imgSrc = layer.customImage || imagesMap[layer.imageKey];
        if (imgSrc) {
          const img = new Image();
          img.src = imgSrc;
          if (img.complete && img.naturalWidth > 0) {
            let drawW = img.naturalWidth * scaleX;
            let drawH = img.naturalHeight * scaleY;
            
            // If it's a native frame, we don't need to manually center it using naturalWidth unless layout is missing
            let drawX = -drawW / 2;
            let drawY = -drawH / 2;
            
            if (frame && frame.layout) {
              drawW = frame.layout.width * scaleX;
              drawH = frame.layout.height * scaleY;
              drawX = 0; // SVGA layout is usually top-left inside the transform
              drawY = 0;
            }

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        }
      }

      // Draw bounding box if selected
      if (layer.id === selectedLayerId) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        
        let boxW = 100 * scaleX;
        let boxH = 100 * scaleY;
        let boxX = -boxW / 2;
        let boxY = -boxH / 2;
        
        if (frame && frame.layout) {
          boxW = frame.layout.width * scaleX;
          boxH = frame.layout.height * scaleY;
          boxX = 0;
          boxY = 0;
        } else if (layer.type === 'shape' && layer.shapeData) {
          boxW = layer.shapeData.width * scaleX;
          boxH = layer.shapeData.height * scaleY;
        } else {
           const imgSrc = layer.customImage || imagesMap[layer.imageKey];
           if (imgSrc) {
              const img = new Image();
              img.src = imgSrc;
              if (img.complete) {
                 boxW = img.naturalWidth * scaleX;
                 boxH = img.naturalHeight * scaleY;
              }
           }
        }
        
        ctx.strokeRect(boxX - 4, boxY - 4, boxW + 8, boxH + 8);

        // Corner handles
        ctx.fillStyle = '#ffffff';
        const handles = [
          [boxX - 4, boxY - 4],
          [boxX + boxW + 4, boxY - 4],
          [boxX - 4, boxY + boxH + 4],
          [boxX + boxW + 4, boxY + boxH + 4],
        ];
        handles.forEach(([hx, hy]) => {
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
          ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        });
      }

      ctx.restore();
    }
  }, [layers, imagesMap, selectedLayerId, sceneWidth, sceneHeight, currentFrame]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, currentFrame]);

  // Animation Playback loop
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentFrame(prev => {
          if (prev >= totalFrames - 1) {
            return isLooping ? 0 : prev;
          }
          return prev + 1;
        });
      }, 1000 / fps);
      return () => clearInterval(interval);
    }
  }, [isPlaying, totalFrames, fps, isLooping]);

  const selectedLayer = useMemo(() => {
    return layers.find(l => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  const filteredLayers = useMemo(() => {
    if (!searchLayer.trim()) return layers;
    return layers.filter(l => l.name.toLowerCase().includes(searchLayer.toLowerCase()));
  }, [layers, searchLayer]);

  // Toggle track expand
  const toggleTrackExpand = (layerId: string) => {
    setExpandedTracks(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  if (appMode === 'landing') {
    return (
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0A0A0A] h-full w-full font-sans absolute inset-0 z-50">
        <header className="h-14 bg-[#0a0a0a] px-4 flex items-center justify-between shrink-0 select-none z-30">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 flex items-center justify-center bg-[#8b5cf6] rounded-md text-white font-bold text-lg cursor-pointer" onClick={onCancel}>M</div>
               <span className="text-white font-bold tracking-tight">Motion Tools</span>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium text-slate-400">
               <span className="text-white cursor-pointer" onClick={() => setAppMode('landing')}>Motion Processing</span>
               <span className="hover:text-white cursor-pointer">Image Processing</span>
               <span className="hover:text-white cursor-pointer">AI Generation</span>
               <span className="hover:text-white cursor-pointer">Product Docs</span>
               <span className="hover:text-white cursor-pointer text-white" onClick={() => setAppMode('editor')}>SVGA Editor</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-300">
             <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">A</span>
             <div className="flex flex-col gap-0.5">
               <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pro</span>
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center relative p-8">
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mb-8 select-none">
            {['PAG', 'SVGA', 'Lottie', 'SVF', '2VEC', 'Quad Channel', 'GIF', 'WebP', 'MP4', 'MOV', 'PRO Sequence ZIP'].map((fmt) => (
              <span 
                key={fmt} 
                className="px-2.5 py-0.5 bg-white/10 rounded text-[11px] font-bold text-white shadow-sm"
              >
                {fmt}
              </span>
            ))}
          </div>

          <div className="text-center relative z-10 flex flex-col items-center max-w-2xl">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">Start Processing Your Animation</h2>
            <p className="text-slate-400 text-sm mb-12">Upload a file to preview, compress, convert and more</p>

            <label className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-all group">
              <input 
                type="file" 
                accept=".svga" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    parseSvgaFile(e.target.files[0]);
                    setAppMode('editor');
                  }
                }}
              />
              <Combine className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            </label>

            {isLoading && (
              <div className="mt-8 flex items-center gap-3 text-purple-400 font-medium text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0F14] text-white flex flex-col font-sans overflow-hidden">
      
      {/* Top Header Navigation Bar */}
      <header className="h-14 bg-[#0a0a0a] border-b border-white/10 px-4 flex items-center justify-between shrink-0 select-none z-30">
        {/* Left Tools */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center bg-[#8b5cf6] rounded-md text-white hover:bg-purple-500 transition-colors">
               {/* Replace with generic logo icon */}
               <Box className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-4 text-slate-400">
               <button className="hover:text-white transition-colors"><Hash className="w-4 h-4" /></button>
               <button className="hover:text-white transition-colors"><Square className="w-4 h-4" /></button>
               <button className="hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
               <button className="hover:text-white transition-colors"><Type className="w-4 h-4" /></button>
               <button className="hover:text-white transition-colors"><Search className="w-4 h-4" /></button>
               <button className="hover:text-white transition-colors flex items-center gap-1.5"><MousePointer className="w-4 h-4" /> <span className="text-[11px] font-medium">Move</span></button>
             </div>
          </div>
        </div>

        {/* Middle Status */}
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 text-[12px] text-slate-400 cursor-pointer">
             <span>Local drafts</span>
             <span>/</span>
             <span className="text-white font-medium flex items-center gap-1">
               {fileName || 'SVGA Editor Pro'}
               <ChevronDown className="w-3 h-3" />
             </span>
           </div>
           
           <div className="flex items-center gap-1">
              <button className="p-1 text-slate-500 hover:text-slate-300 rounded"><Undo2 className="w-4 h-4" /></button>
              <button className="p-1 text-slate-500 hover:text-slate-300 rounded"><Redo2 className="w-4 h-4" /></button>
           </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1 text-[12px] font-medium">
          <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded text-slate-300 cursor-pointer transition-all">
            <FileFolder className="w-4 h-4" />
            <span>Open SVGA</span>
            <input 
              type="file" 
              accept=".svga" 
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  parseSvgaFile(e.target.files[0]);
                }
              }}
            />
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded text-slate-300 cursor-pointer transition-all">
            <ImageIcon className="w-4 h-4" />
            <span>Add image layer</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAddImageLayer} 
              disabled={!isLoaded}
            />
          </label>

          <label className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded text-slate-300 cursor-pointer transition-all">
            <Combine className="w-4 h-4" />
            <span>Merge SVGA</span>
            <input 
              type="file" 
              accept=".svga" 
              className="hidden" 
              onChange={handleMergeSvga} 
              disabled={!isLoaded}
            />
          </label>

          <div className="w-px h-4 bg-white/10 mx-2"></div>

          <button 
            onClick={() => alert("Syncing to Motion Tools...")}
            disabled={!isLoaded}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded text-slate-300 transition-all disabled:opacity-40"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync to Motion Tools</span>
          </button>

          <button 
            onClick={handleExportSvga}
            disabled={!isLoaded}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8b5cf6] hover:bg-purple-500 text-white rounded transition-all disabled:opacity-40 ml-2"
          >
            <Download className="w-4 h-4" />
            <span>Export SVGA</span>
          </button>
        </div>
      </header>

      {!isLoaded ? (
        /* Empty Editor State */
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Left Vertical Dock Navigation */}
          <div className="w-12 bg-[#12141D] border-r border-white/10 flex flex-col items-center py-3 gap-4 shrink-0 z-20">
            <button className="p-2.5 rounded-xl transition-all bg-purple-600/30 text-purple-400 border border-purple-500/30">
              <Layers className="w-5 h-5" />
            </button>
            <button className="p-2.5 rounded-xl transition-all text-slate-400 hover:text-white hover:bg-white/5">
              <Square className="w-5 h-5" />
            </button>
            <button className="p-2.5 rounded-xl transition-all text-slate-400 hover:text-white hover:bg-white/5">
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Left Drawer Panel */}
          <div className="w-64 bg-[#141622] border-r border-white/10 flex flex-col shrink-0 z-10">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">Layers</span>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-medium">
              No document loaded
            </div>
          </div>

          {/* Center Canvas */}
          <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden relative items-center justify-center p-8">
            <label className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 border-dashed hover:border-purple-500/50 hover:bg-white/10 max-w-sm w-full mx-4 shadow-xl cursor-pointer transition-all group">
               <input 
                  type="file" 
                  accept=".svga" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      parseSvgaFile(e.target.files[0]);
                    }
                  }}
               />
               <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <FileFolder className="w-6 h-6 text-slate-400 group-hover:text-purple-400" />
               </div>
               <h3 className="text-sm font-bold text-white mb-2">Drop an SVGA file</h3>
               <p className="text-slate-400 text-xs">
                 Import a file to inspect layers, timeline, frame data, edit, and export
               </p>
            </label>
            
            {isLoading && (
              <div className="mt-8 flex items-center gap-3 text-purple-400 font-medium text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>

          {/* Right Inspector */}
          <div className="w-72 bg-[#141622] border-l border-white/10 flex flex-col p-4 shrink-0 z-10 text-xs">
            <div className="flex items-start gap-3 border-b border-white/10 pb-4 mb-6 mt-1">
               <div className="w-9 h-11 bg-white/5 rounded border border-white/10 flex items-center justify-center shrink-0">
                  <FileVideo className="w-5 h-5 text-slate-400" />
               </div>
               <div className="min-w-0">
                  <h3 className="font-bold text-white text-[13px] break-all leading-tight">No document</h3>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">Open an SVGA file</div>
               </div>
            </div>
            <div className="text-slate-500 text-[10px]">
              Open or drop an SVGA file to inspect it
            </div>
          </div>
        </div>
      ) : (
        /* Main 3-Panel Editor Workspace */
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* Left Vertical Dock Navigation */}
          <div className="w-12 bg-[#12141D] border-r border-white/10 flex flex-col items-center py-3 gap-4 shrink-0 z-20">
            <button 
              onClick={() => setActiveTab('layers')}
              className={`p-2.5 rounded-xl transition-all ${activeTab === 'layers' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Layers"
            >
              <Layers className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setActiveTab('shapes')}
              className={`p-2.5 rounded-xl transition-all ${activeTab === 'shapes' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Shapes & Objects"
            >
              <Square className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setActiveTab('assets')}
              className={`p-2.5 rounded-xl transition-all ${activeTab === 'assets' ? 'bg-purple-600/30 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Assets Library"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Left Drawer Panel */}
          <div className="w-64 bg-[#141622] border-r border-white/10 flex flex-col shrink-0 z-10">
            {activeTab === 'layers' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    <span className="text-sm font-medium text-white">Layers</span>
                  </div>
                  <button className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                
                <div className="p-3 flex justify-between items-center text-[10px] text-slate-500 font-medium pb-2 border-b border-white/10">
                  <span>{layers.length} editable layers</span>
                  <span>virtualized</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-10">
                  {/* File Group Header */}
                  {fileName && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/5 cursor-pointer border-b border-white/5">
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate flex-1 font-medium">{fileName}</span>
                      <span className="text-[9px] border border-white/20 px-1 rounded text-slate-400 font-mono">FRAME</span>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto p-1 space-y-px">
                    {filteredLayers.map((layer) => (
                      <div 
                        key={layer.id}
                        onClick={() => setSelectedLayerId(layer.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors ml-4 ${selectedLayerId === layer.id ? 'bg-[#8b5cf6]/20 text-white font-medium' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{layer.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shapes' && (
              <div className="p-4 space-y-3">
                <span className="font-extrabold text-xs text-white block mb-2">Shapes & Objects</span>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => handleAddShape('rectangle')}
                    className="p-3 bg-slate-900/80 border border-white/10 hover:border-purple-500/50 rounded-xl flex flex-col items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-all"
                  >
                    <Square className="w-5 h-5 text-purple-400" />
                    <span>Rectangle</span>
                  </button>

                  <button 
                    onClick={() => handleAddShape('ellipse')}
                    className="p-3 bg-slate-900/80 border border-white/10 hover:border-purple-500/50 rounded-xl flex flex-col items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-all"
                  >
                    <Circle className="w-5 h-5 text-purple-400" />
                    <span>Ellipse</span>
                  </button>

                  <button 
                    onClick={() => handleAddShape('polygon')}
                    className="p-3 bg-slate-900/80 border border-white/10 hover:border-purple-500/50 rounded-xl flex flex-col items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-all"
                  >
                    <Square className="w-5 h-5 rotate-45 text-purple-400" />
                    <span>Polygon</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'assets' && (
              <div className="flex-1 flex flex-col p-3 overflow-hidden">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl mb-3 border border-white/10">
                  {(['all', 'used', 'unused'] as const).map(tab => (
                    <button 
                      key={tab} 
                      onClick={() => setAssetFilter(tab)}
                      className={`flex-1 py-1 text-[10px] font-extrabold uppercase rounded-lg transition-all ${assetFilter === tab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {Object.entries(imagesMap).map(([key, src]) => (
                    <div key={key} className="p-2 bg-slate-900/80 border border-white/10 rounded-xl flex items-center gap-3">
                      <img src={src} alt={key} className="w-10 h-10 object-contain rounded bg-slate-950 border border-white/10" />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[11px] font-bold text-white truncate">{key}</span>
                        <span className="block text-[9px] text-slate-500">Used by {layers.filter(l => l.imageKey === key).length} layers</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Stage & Bottom Timeline Area */}
          <div className="flex-1 flex flex-col bg-[#0B0C10] overflow-hidden relative">
            
            {/* Center Live Canvas Stage */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
              <div className="relative border border-white/10 shadow-2xl rounded-xl overflow-hidden bg-[#181B26]">
                <canvas 
                  ref={canvasRef} 
                  width={sceneWidth} 
                  height={sceneHeight}
                  className="block max-w-full max-h-[60vh] object-contain"
                />
              </div>

              {/* View zoom overlay */}
              <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-3 text-xs text-slate-300 backdrop-blur-md">
                <button onClick={() => setZoom(z => Math.max(25, z - 25))}>-</button>
                <span className="font-mono font-bold text-white">{zoom}%</span>
                <button onClick={() => setZoom(z => Math.min(200, z + 25))}>+</button>
              </div>
            </div>

            {/* Bottom Multi-Track Keyframe Timeline */}
            <div className="h-64 bg-[#141622] border-t border-white/10 flex flex-col shrink-0 z-20">
              <div className="flex h-full">
                
                {/* Left track headers */}
                <div className="w-64 border-r border-white/10 flex flex-col shrink-0 bg-[#141622]">
                  <div className="h-10 border-b border-white/10 flex items-center gap-4 px-4 bg-[#0a0a0a]">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-white text-slate-400">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="text-[11px] font-mono text-slate-300">
                      <span className="text-white font-bold">{((currentFrame / fps)).toFixed(2)}s</span> <span className="text-slate-500 mx-1">/</span> {durationSec}s
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto flex flex-col pt-2 pb-10 custom-scrollbar">
                    {fileName && (
                      <div className="flex items-center gap-2 px-3 py-1 text-[11px] text-white hover:bg-white/5 cursor-pointer">
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate flex-1 font-medium">{fileName}</span>
                      </div>
                    )}
                    {filteredLayers.map(layer => (
                      <div key={layer.id} className="text-[11px]">
                        <div 
                          onClick={() => toggleTrackExpand(layer.id)}
                          className="px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 cursor-pointer text-slate-300 ml-4"
                        >
                          {expandedTracks[layer.id] ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                          <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{layer.name}</span>
                        </div>

                        {expandedTracks[layer.id] && (
                          <div className="pl-[52px] py-1 space-y-2 text-[10px] text-slate-500">
                            <div>Transform</div>
                            <div>Opacity</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline Axis Right Side */}
                <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#0a0a0a] custom-scrollbar">
                  <div className="sticky top-0 h-10 border-b border-white/10 bg-[#0a0a0a] z-30 flex text-[10px] font-mono text-white/70">
                    {Array.from({length: 12}).map((_, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end pb-1 border-l border-white/10 relative">
                         <span className="absolute -left-3 top-2.5">{(i * (durationSec / 10)).toFixed(2)}s</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="relative min-w-[800px] h-full pt-2 pb-10">
                    {/* Playhead indicator line */}
                    <div 
                      className="absolute top-0 bottom-0 w-[1px] bg-[#8b5cf6] z-20 pointer-events-none shadow-[0_0_8px_#8b5cf6]"
                      style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
                    >
                      <div className="w-[11px] h-4 bg-[#8b5cf6] rounded-sm absolute -top-4 -left-[5px] flex items-center justify-center">
                         <div className="w-0.5 h-2 bg-white/50 rounded-full" />
                      </div>
                    </div>

                    {/* Timeline rows */}
                    <div className="space-y-[5px]">
                      {fileName && <div className="h-6" />}
                      {filteredLayers.map(layer => (
                        <div key={layer.id} className="h-6 px-2 relative group">
                          <div className="absolute inset-y-0.5 inset-x-2 bg-[#3a3d4f] rounded-sm hover:brightness-110 cursor-pointer" />
                          {expandedTracks[layer.id] && (
                            <div className="h-[46px] mt-6 relative">
                               <div className="absolute top-1 left-2 right-2 h-4 bg-white/5 rounded-sm" />
                               <div className="absolute top-6 left-2 right-2 h-4 bg-white/5 rounded-sm" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Inspector Panel */}
          <div className="w-72 bg-[#141622] border-l border-white/10 flex flex-col p-4 overflow-y-auto shrink-0 z-10 text-xs">
            {selectedLayer ? (
              /* Selected Layer Properties */
              <div className="space-y-5">
                <div className="border-b border-white/10 pb-3">
                  <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block mb-1">Layer Inspector</span>
                  <h3 className="font-mono font-bold text-white text-sm truncate">{selectedLayer.name}</h3>
                </div>

                {/* Transform Box */}
                <div className="space-y-3">
                  <span className="font-extrabold text-slate-300 block">Transform</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Position X</label>
                      <input 
                        type="number" 
                        value={Math.round(selectedLayer.transform.x)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, x: val } } : l));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Position Y</label>
                      <input 
                        type="number" 
                        value={Math.round(selectedLayer.transform.y)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, y: val } } : l));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Scale X %</label>
                      <input 
                        type="number" 
                        value={Math.round(selectedLayer.transform.scaleX * 100)}
                        onChange={(e) => {
                          const val = (parseFloat(e.target.value) || 100) / 100;
                          setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, scaleX: val } } : l));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Scale Y %</label>
                      <input 
                        type="number" 
                        value={Math.round(selectedLayer.transform.scaleY * 100)}
                        onChange={(e) => {
                          const val = (parseFloat(e.target.value) || 100) / 100;
                          setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, scaleY: val } } : l));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Rotation (deg)</label>
                    <input 
                      type="number" 
                      value={selectedLayer.transform.rotation}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, rotation: val } } : l));
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-white font-mono"
                    />
                  </div>
                </div>

                {/* Layer Opacity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-300">Opacity</span>
                    <span className="text-purple-400 font-mono font-bold">{selectedLayer.transform.opacity}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={selectedLayer.transform.opacity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, transform: { ...l.transform, opacity: val } } : l));
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Easing Cubic Bezier Graph */}
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <span className="font-extrabold text-slate-300 block">Easing Curve</span>
                  <div className="h-28 bg-slate-950 border border-white/10 rounded-xl p-2 relative flex items-center justify-center">
                    <svg className="w-full h-full text-purple-500 overflow-visible" viewBox="0 0 100 100">
                      <path 
                        d={`M 0 100 C ${easingBezier[0]*100} ${100 - easingBezier[1]*100}, ${easingBezier[2]*100} ${100 - easingBezier[3]*100}, 100 0`} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="3" 
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-purple-300 font-mono block text-center">
                    cubic-bezier({easingBezier.join(', ')})
                  </span>
                </div>
              </div>
            ) : (
              /* Scene Document Summary */
              <div className="space-y-0">
                <div className="flex items-start gap-3 border-b border-white/10 pb-4 mb-6 mt-1">
                   <div className="w-9 h-11 bg-white/5 rounded border border-white/10 flex items-center justify-center shrink-0">
                      <FileVideo className="w-5 h-5 text-slate-400" />
                   </div>
                   <div className="min-w-0">
                      <h3 className="font-bold text-white text-[13px] break-all leading-tight" title={fileName}>{fileName}</h3>
                      <div className="text-[10px] text-slate-500 font-medium mt-1">Document</div>
                   </div>
                </div>

                {/* Last action badge */}
                <div className="mb-6">
                  <span className="font-bold text-white text-[13px] block mb-3">Last action</span>
                  <div className="bg-[#1c1d27] border border-[#8b5cf6]/30 px-3 py-2.5 rounded-lg">
                    <span className="text-[11px] text-[#8b5cf6] font-semibold block mb-0.5">{lastAction}</span>
                    <span className="text-[10px] text-[#8b5cf6]/70 truncate block">{fileName}</span>
                  </div>
                </div>

                {/* Scene stats */}
                <div className="mb-6">
                  <span className="font-bold text-white text-[13px] block mb-3">Scene</span>
                  <div className="space-y-2.5 text-[11px] text-slate-400 pr-1">
                    <div className="flex justify-between items-center"><span>Canvas</span> <span className="text-white font-medium">{sceneWidth} x {sceneHeight}</span></div>
                    <div className="flex justify-between items-center"><span>Frame rate</span> <span className="text-white font-medium">{fps} fps</span></div>
                    <div className="flex justify-between items-center"><span>Frames</span> <span className="text-white font-medium">{totalFrames}</span></div>
                    <div className="flex justify-between items-center"><span>Duration</span> <span className="text-white font-medium">{durationSec}s</span></div>
                  </div>
                </div>

                {/* Content stats */}
                <div className="mb-6">
                  <span className="font-bold text-white text-[13px] block mb-3">Content</span>
                  <div className="space-y-2.5 text-[11px] text-slate-400 pr-1">
                    <div className="flex justify-between items-center"><span>Layers</span> <span className="text-white font-medium">{layers.length}</span></div>
                    <div className="flex justify-between items-center"><span>Assets</span> <span className="text-white font-medium">{Object.keys(imagesMap).length}</span></div>
                    <div className="flex justify-between items-center"><span>Images</span> <span className="text-white font-medium">{(file ? file.size / 1024 : 438).toFixed(1)} KB</span></div>
                    <div className="flex justify-between items-center"><span>Audio</span> <span className="text-white font-medium">0</span></div>
                    <div className="flex justify-between items-center"><span>Sequences</span> <span className="text-white font-medium">0</span></div>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-white text-[13px] block mb-3">Signals</span>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
