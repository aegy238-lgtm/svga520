import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { parseSvgaToProject } from './SvgaLayerEditor/svgaParserEngine';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Copy, 
  Upload, 
  Image as ImageIcon, 
  Settings, 
  Maximize2, 
  Square, 
  FileCode, 
  FolderArchive, 
  Check, 
  Loader2, 
  X, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  GripVertical,
  Clock,
  Sliders,
  Grid,
  Palette,
  Layers,
  Film,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Hand,
  RotateCw,
  FolderOpen,
  Save,
  HelpCircle,
  Key,
  Sun,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import * as UPNG from 'upng-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import JSZip from 'jszip';
import { SVGAFileExtended } from '../types';
import { exportAsVap, downloadBlob } from './AnimationManager/utils/exportEngine';
import { backgroundExportManager } from '../services/backgroundExportManager';

// Additional Layer / Child Overlay Config (دمج كقناع Alpha Matte / مسح ضوئي متواصل)
export interface AdditionalLayerConfig {
  id: string;
  name: string;
  imageSrc: string;
  imageElement?: HTMLImageElement | null;
  enabled: boolean;
  clipToParent: boolean; // default true: source-atop (Alpha Matte clipping)
  blendMode: 'source-atop' | 'screen' | 'lighter' | 'overlay' | 'source-over';
  scale: number; // percentage (10 to 300, default 75)
  opacity: number; // percentage (0 to 100, default 100)
  motionMode: 'continuous_sweep' | 'loop_bounce' | 'custom_offset';
  sweepDirection: 'diagonal' | 'horizontal' | 'vertical';
  sweepSpeed: number; // duration in frames (default 30)
  offsetX: number;
  offsetY: number;
  rotation: number;
}

// Keyframe interface for animatable properties
const PRESET_RESOLUTIONS = [
  { label: '500 × 500 (SVGA قياسي)', width: 500, height: 500 },
  { label: '1080 × 1080 (مربع - إنستغرام)', width: 1080, height: 1080 },
  { label: '1080 × 1920 (عمودي - ريلز/تيك توك/ستوري)', width: 1080, height: 1920 },
  { label: '1920 × 1080 (أفقي - Full HD)', width: 1920, height: 1080 },
  { label: '3840 × 2160 (4K Ultra HD)', width: 3840, height: 2160 },
  { label: '720 × 1280 (عمودي - HD)', width: 720, height: 1280 },
  { label: '750 × 1334 (شاشات / بنر)', width: 750, height: 1334 },
  { label: '512 × 512 (ملصق / استيكر)', width: 512, height: 512 },
  { label: '300 × 300 (أيقونة / شعار)', width: 300, height: 300 },
];

export interface Keyframe<T = number> {
  frame: number;
  value: T;
  easing?: 'linear' | 'ease-in-out';
}

export type LayerKind = 'shape' | 'text' | 'image' | 'solid';
export type ShapeKind = 'ring' | 'circle' | 'rectangle' | 'polygon' | 'star';

export interface AELayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  colorLabel: string; // AE color label (red, yellow, cyan, purple, etc.)
  expanded: boolean; // Twirl-down in timeline

  // Static / Fallback Transform values
  position: { x: number; y: number };
  scale: number; // percentage (100 = 1.0)
  rotation: number; // degrees
  opacity: number; // 0 to 100

  // Keyframes for Transforms (After Effects stopwatch feature)
  animatingPosition: boolean;
  positionKeyframes: Keyframe<{ x: number; y: number }>[];

  animatingScale: boolean;
  scaleKeyframes: Keyframe<number>[];

  animatingRotation: boolean;
  rotationKeyframes: Keyframe<number>[];

  animatingOpacity: boolean;
  opacityKeyframes: Keyframe<number>[];

  // Shape Specific Properties
  shapeKind?: ShapeKind;
  width?: number;
  height?: number;
  innerRadius?: number; // for ring
  outerRadius?: number; // for ring / circle
  points?: number; // for star or polygon
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  glowRadius?: number;
  glowColor?: string;

  // Text Specific Properties
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;

  // Alpha Matte Masking & Parent Relationship (دمج كقناع داخل قطعة أخرى)
  clipToLayerId?: string; // If set, this layer is clipped inside the specified parent layer
  blendMode?: 'source-atop' | 'screen' | 'lighter' | 'overlay' | 'source-over';

  // Image Specific Properties
  imageSrc?: string;
  imageElement?: HTMLImageElement | null;
  tintColor?: string;
  tintOpacity?: number;
}

export interface CompositionSettings {
  name: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  backgroundColor: string;
}

interface AfterEffectsStudioProps {
  initialFile?: File | null;
  initialMetadata?: any;
  initialDimensions?: { width: number; height: number } | null;
  onOpenInViewer?: (file: SVGAFileExtended) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

interface NumericInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  placeholder?: string;
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  className,
  min,
  max,
  step = 1,
  defaultValue = 0,
  placeholder
}) => {
  const [text, setText] = useState<string>(() => (isNaN(value) ? '' : String(value)));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(isNaN(value) ? '' : String(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    // Allow user to clear the field completely or type minus sign without forcing 0
    if (raw === '' || raw === '-' || raw === '+') {
      return;
    }

    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      let finalVal = parsed;
      if (min !== undefined && finalVal < min) finalVal = min;
      if (max !== undefined && finalVal > max) finalVal = max;
      onChange(finalVal);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (text === '' || text === '-' || text === '+' || isNaN(parseFloat(text))) {
      setText(String(defaultValue));
      onChange(defaultValue);
    } else {
      const parsed = parseFloat(text);
      let finalVal = parsed;
      if (min !== undefined && finalVal < min) finalVal = min;
      if (max !== undefined && finalVal > max) finalVal = max;
      setText(String(finalVal));
      onChange(finalVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
};

export const AfterEffectsStudio: React.FC<AfterEffectsStudioProps> = ({ 
  initialFile,
  initialMetadata,
  initialDimensions,
  onOpenInViewer, 
  onCancel, 
  onClose 
}) => {
  // Project State: whether a composition is currently open
  const [hasProject, setHasProject] = useState<boolean>(false);
  const [showCompSettingsModal, setShowCompSettingsModal] = useState<boolean>(!initialFile);

  // Composition Settings
  const [compSettings, setCompSettings] = useState<CompositionSettings>({
    name: initialFile ? initialFile.name.replace(/\.[^/.]+$/, "") : 'Comp 1',
    width: initialDimensions?.width || 750,
    height: initialDimensions?.height || 750,
    fps: 30,
    totalFrames: 90, // 3 seconds at 30 fps
    backgroundColor: '#000000'
  });

  // Auto load initialFile if provided
  useEffect(() => {
    if (initialFile) {
      let isMounted = true;
      (async () => {
        try {
          if (initialFile.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(initialFile.name)) {
            const url = URL.createObjectURL(initialFile);
            const img = new Image();
            img.src = url;
            img.onload = () => {
              if (!isMounted) return;
              const w = initialDimensions?.width || img.naturalWidth || 750;
              const h = initialDimensions?.height || img.naturalHeight || 750;
              setCompSettings({
                name: initialFile.name.replace(/\.[^/.]+$/, "") || 'Comp 1',
                width: w,
                height: h,
                fps: 30,
                totalFrames: 90,
                backgroundColor: '#000000'
              });
              setModalWidth(w);
              setModalHeight(h);
              const baseLayer: AELayer = {
                id: `layer-${Date.now()}`,
                name: initialFile.name.replace(/\.[^/.]+$/, ''),
                kind: 'image',
                visible: true,
                locked: false,
                colorLabel: 'orange',
                expanded: false,
                position: { x: 0, y: 0 },
                scale: 100,
                rotation: 0,
                opacity: 100,
                animatingPosition: false,
                positionKeyframes: [],
                animatingScale: false,
                scaleKeyframes: [],
                animatingRotation: false,
                rotationKeyframes: [],
                animatingOpacity: false,
                opacityKeyframes: [],
                width: w,
                height: h,
                imageSrc: url,
                imageElement: img
              };
              setLayers([baseLayer]);
              setSelectedLayerId(baseLayer.id);
              setHasProject(true);
              setShowCompSettingsModal(false);
              setIsPlaying(true);
              setTimeout(() => {
                fitToView();
              }, 150);
            };
            return;
          }

          const project = await parseSvgaToProject(initialFile);
          if (!isMounted || !project) return;
          
          setCompSettings({
            name: initialFile.name.replace(/\.[^/.]+$/, "") || 'Comp 1',
            width: project.width || 750,
            height: project.height || 750,
            fps: project.fps || 30,
            totalFrames: project.totalFrames || 90,
            backgroundColor: '#000000'
          });

          // Map layers
          const loadedLayers: AELayer[] = [];
          for (let idx = 0; idx < (project.layers || []).length; idx++) {
            const l = project.layers[idx];
            const src = l.thumbnailUrl || (l.imageKey && project.imagesMap ? project.imagesMap[l.imageKey] : undefined);
            let imgEl: HTMLImageElement | null = null;
            if (src) {
              imgEl = new Image();
              imgEl.crossOrigin = 'anonymous';
              imgEl.src = src;
              await new Promise(r => { imgEl!.onload = r; imgEl!.onerror = r; });
            }

            loadedLayers.push({
              id: l.id || `layer-${Date.now()}-${idx}`,
              name: l.name || `Layer ${idx + 1}`,
              kind: src ? 'image' : 'shape',
              visible: l.visible !== false,
              locked: !!l.locked,
              position: { x: l.transform?.x || 0, y: l.transform?.y || 0 },
              scale: (l.transform?.scaleX || 1) * 100,
              rotation: l.transform?.rotation || 0,
              opacity: l.transform?.opacity !== undefined ? l.transform.opacity : 100,
              width: l.transform?.width || imgEl?.naturalWidth || 200,
              height: l.transform?.height || imgEl?.naturalHeight || 200,
              imageSrc: src,
              imageElement: imgEl,
              positionKeyframes: l.keyframes?.map(k => ({ frame: k.frame, value: { x: k.x ?? 0, y: k.y ?? 0 } })),
              scaleKeyframes: l.keyframes?.map(k => ({ frame: k.frame, value: (k.scaleX ?? 1) * 100 })),
              rotationKeyframes: l.keyframes?.map(k => ({ frame: k.frame, value: k.rotation ?? 0 })),
              opacityKeyframes: l.keyframes?.map(k => ({ frame: k.frame, value: k.opacity ?? 100 }))
            });
          }

          if (isMounted) {
            setLayers(loadedLayers);
            if (loadedLayers.length > 0) {
              setSelectedLayerId(loadedLayers[0].id);
            }
            setHasProject(true);
            setShowCompSettingsModal(false);
          }
        } catch (err) {
          console.warn("Could not parse initialFile for After Effects Studio:", err);
          if (isMounted) {
            setHasProject(true);
            setShowCompSettingsModal(false);
          }
        }
      })();

      return () => {
        isMounted = false;
      };
    }
  }, [initialFile]);

  // Modal temporary state for Comp Settings
  const [modalName, setModalName] = useState('Comp 1');
  const [modalWidth, setModalWidth] = useState<number | ''>('');
  const [modalHeight, setModalHeight] = useState<number | ''>('');
  const [modalFps, setModalFps] = useState(30);
  const [modalTotalFrames, setModalTotalFrames] = useState<number | ''>(90);
  const [modalDurationSec, setModalDurationSec] = useState(3);
  const [modalDurationMode, setModalDurationMode] = useState<'frames' | 'seconds'>('frames');
  const [modalBg, setModalBg] = useState('#000000');
  const [compSettingsError, setCompSettingsError] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsReadingFile(true);
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");
    setModalName(baseName);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setModalWidth(img.naturalWidth || 500);
        setModalHeight(img.naturalHeight || 500);
        setIsReadingFile(false);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else if (file.name.toLowerCase().endsWith('.svga')) {
      try {
        const proj = await parseSvgaToProject(file);
        if (proj) {
          setModalWidth(proj.width || 500);
          setModalHeight(proj.height || 500);
          setModalFps(proj.fps || 30);
          setModalTotalFrames(proj.totalFrames || 90);
          setModalDurationSec(Number(((proj.totalFrames || 90) / (proj.fps || 30)).toFixed(2)));
        }
      } catch (err) {
        console.error("Failed to parse SVGA in After Effects Studio Settings:", err);
      } finally {
        setIsReadingFile(false);
      }
    } else {
      setIsReadingFile(false);
    }
  };

  // Layers stack (User builds from scratch! Zero pre-loaded templates)
  const [layers, setLayers] = useState<AELayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Image Import modal state for configuring custom/original size upon upload
  const [imageImportPending, setImageImportPending] = useState<{
    file: File;
    url: string;
    naturalWidth: number;
    naturalHeight: number;
    img: HTMLImageElement;
  } | null>(null);
  const [imageImportWidth, setImageImportWidth] = useState<string>('');
  const [imageImportHeight, setImageImportHeight] = useState<string>('');

  // Drag and Drop Layer Stacking / Reorder State
  const [draggedLayerIdx, setDraggedLayerIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

  // Timeline / Playback State
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const rulerRef = useRef<HTMLDivElement>(null);
  const layerListScrollRef = useRef<HTMLDivElement>(null);
  const tracksScrollRef = useRef<HTMLDivElement>(null);

  // Viewport Settings
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%
  const [showTransparencyGrid, setShowTransparencyGrid] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'rotate' | 'shape' | 'text'>('select');

  // Mobile Responsiveness State
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [aeMobileTab, setAeMobileTab] = useState<'viewport' | 'layers' | 'properties' | 'timeline'>('viewport');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Export State
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportCategory, setExportCategory] = useState<'primary' | 'secondary'>('primary');
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [lastExportedSVGA, setLastExportedSVGA] = useState<SVGAFileExtended | null>(null);
  const [svgaExportMode, setSvgaExportMode] = useState<'pieces' | 'render'>('pieces');

  // Container ref for viewport stage auto-sizing
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Layer dragging interaction state on canvas
  const [isDraggingLayer, setIsDraggingLayer] = useState<boolean>(false);
  const dragInfoRef = useRef<{
    layerId: string;
    startCanvasX: number;
    startCanvasY: number;
    startLayerPos: { x: number; y: number };
  } | null>(null);

  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'hand' && stageContainerRef.current) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: stageContainerRef.current.scrollLeft,
        scrollTop: stageContainerRef.current.scrollTop
      };
    } else {
      // Check if click was on a scrollbar anywhere
      const target = e.target as HTMLElement | null;
      if (target) {
        // If clicking on an input, button, select, or scrubber, keep selection
        if (target.closest('input, button, select, textarea, label, .timeline-scrubber, .timeline-keyframe, .properties-inspector, .layer-row-item')) {
          return;
        }

        // Check if click was on scrollbar of stage or any container
        const rect = target.getBoundingClientRect();
        const isVerticalScrollbar = e.clientX >= rect.left + target.clientWidth && e.clientX <= rect.right;
        const isHorizontalScrollbar = e.clientY >= rect.top + target.clientHeight && e.clientY <= rect.bottom;
        if (isVerticalScrollbar || isHorizontalScrollbar) {
          return;
        }
      }

      // If clicked on empty area outside canvas (the stage canvas work area), deselect layer
      setSelectedLayerId(null);
    }
  };

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && activeTool === 'hand' && stageContainerRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      stageContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      stageContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    }
  };

  const handleStageMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Auto-fit helper to fit composition perfectly within viewport without scrolling or clipping
  const fitToView = useCallback(() => {
    if (!stageContainerRef.current) return;
    const stageW = stageContainerRef.current.clientWidth - 48; // account for p-6 padding
    const stageH = stageContainerRef.current.clientHeight - 48;
    if (stageW <= 0 || stageH <= 0) return;
    const scaleW = stageW / compSettings.width;
    const scaleH = stageH / compSettings.height;
    // In After Effects, "Fit" scales up or down to comfortably fill the viewport window
    const bestScale = Math.min(scaleW, scaleH);
    // Best scale capped at 1.0 (100% original size maximum)
    const clampedScale = Math.max(0.15, Math.min(1.0, bestScale));
    setZoomLevel(Number(clampedScale.toFixed(2)));
  }, [compSettings.width, compSettings.height]);

  // Mouse wheel zoom on stage container (smooth desktop After Effects zoom experience)
  useEffect(() => {
    const container = stageContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      setZoomLevel(prev => {
        const next = Number((prev * zoomFactor).toFixed(2));
        return Math.max(0.15, Math.min(1.0, next));
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Synchronized scroll handlers between layer list and keyframe tracks
  const handleTracksScroll = useCallback(() => {
    if (tracksScrollRef.current && layerListScrollRef.current) {
      layerListScrollRef.current.scrollTop = tracksScrollRef.current.scrollTop;
    }
  }, []);

  const handleLayerListScroll = useCallback(() => {
    if (tracksScrollRef.current && layerListScrollRef.current) {
      tracksScrollRef.current.scrollTop = layerListScrollRef.current.scrollTop;
    }
  }, []);

  // Helper to calculate timeline horizontal position percentage with inset so diamonds (10px wide) are never clipped at 0 or 100%
  const getTimelineLeftPercent = useCallback((frame: number) => {
    const total = Math.max(1, compSettings.totalFrames);
    const ratio = Math.max(0, Math.min(1, frame / total));
    return `calc(8px + (100% - 16px) * ${ratio})`;
  }, [compSettings.totalFrames]);

  // Scrub timeline to frame from mouse clientX (accounting for the 8px inset so start/end frame match precisely)
  const updateScrubFrame = useCallback((clientX: number) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const padding = 8;
    const usableWidth = Math.max(1, rect.width - padding * 2);
    const clickX = clientX - rect.left - padding;
    const pct = Math.max(0, Math.min(1, clickX / usableWidth));
    const targetF = Math.round(pct * compSettings.totalFrames);
    setCurrentFrame(Math.max(0, Math.min(compSettings.totalFrames, targetF)));
  }, [compSettings.totalFrames]);

  // Global mouse move & up listeners for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;
    const onMouseMove = (e: MouseEvent) => {
      updateScrubFrame(e.clientX);
    };
    const onMouseUp = () => {
      setIsScrubbing(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isScrubbing, updateScrubFrame]);

  // Keyframe moving & dragging state (Double-click or drag to reposition)
  const [draggingKeyframe, setDraggingKeyframe] = useState<{
    layerId: string;
    property: 'position' | 'scale' | 'rotation' | 'opacity';
    originalFrame: number;
    currentDragFrame: number;
    isConfirmedDrag: boolean;
    startX: number;
    mode: 'drag' | 'double_click';
    startTime: number;
  } | null>(null);

  // Calculate frame number from clientX coordinate
  const calculateFrameFromClientX = useCallback((clientX: number) => {
    const el = tracksScrollRef.current || rulerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const padding = 8;
    const usableWidth = Math.max(1, rect.width - padding * 2);
    const clickX = clientX - rect.left - padding;
    const pct = Math.max(0, Math.min(1, clickX / usableWidth));
    const targetF = Math.round(pct * compSettings.totalFrames);
    return Math.max(0, Math.min(compSettings.totalFrames, targetF));
  }, [compSettings.totalFrames]);

  // Move a keyframe to a new frame position
  const moveKeyframe = useCallback((
    layerId: string,
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    originalFrame: number,
    newFrame: number
  ) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id !== layerId) return layer;

      const propKey = 
        property === 'position' ? 'positionKeyframes' :
        property === 'scale' ? 'scaleKeyframes' :
        property === 'rotation' ? 'rotationKeyframes' :
        'opacityKeyframes';

      const currentList: Keyframe<any>[] = [...(layer[propKey] as Keyframe<any>[])];
      const targetKf = currentList.find(k => k.frame === originalFrame);
      if (!targetKf) return layer;

      // Filter out original frame and any keyframe already at newFrame
      const filtered = currentList.filter(k => k.frame !== originalFrame && k.frame !== newFrame);
      
      // Insert updated keyframe at newFrame
      filtered.push({
        ...targetKf,
        frame: newFrame
      });

      // Keep sorted by frame ascending
      filtered.sort((a, b) => a.frame - b.frame);

      return {
        ...layer,
        [propKey]: filtered
      };
    }));

    setCurrentFrame(newFrame);
    setSelectedLayerId(layerId);
  }, []);

  // Handle mousedown on a keyframe
  const handleKeyframeMouseDown = useCallback((
    layerId: string,
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    frame: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setSelectedLayerId(layerId);
    setDraggingKeyframe({
      layerId,
      property,
      originalFrame: frame,
      currentDragFrame: frame,
      isConfirmedDrag: false,
      startX: e.clientX,
      mode: 'drag',
      startTime: Date.now()
    });
  }, []);

  // Handle double-click on a keyframe to activate positioning mode
  const handleKeyframeDoubleClick = useCallback((
    layerId: string,
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    frame: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedLayerId(layerId);
    setDraggingKeyframe({
      layerId,
      property,
      originalFrame: frame,
      currentDragFrame: frame,
      isConfirmedDrag: true,
      startX: e.clientX,
      mode: 'double_click',
      startTime: Date.now()
    });
  }, []);

  // Window listeners for moving/dropping keyframes
  useEffect(() => {
    if (!draggingKeyframe) return;

    const onMouseMove = (e: MouseEvent) => {
      const newFrame = calculateFrameFromClientX(e.clientX);
      setDraggingKeyframe(prev => {
        if (!prev) return null;
        const dist = Math.abs(e.clientX - prev.startX);
        const isConfirmed = prev.isConfirmedDrag || dist > 4 || prev.mode === 'double_click';
        return {
          ...prev,
          currentDragFrame: newFrame,
          isConfirmedDrag: isConfirmed
        };
      });
    };

    const onMouseUp = () => {
      setDraggingKeyframe(prev => {
        if (!prev) return null;
        // In double-click mode, if mouseup happened immediately after the double click (< 200ms), keep it active so the user can move freely and click to drop
        if (prev.mode === 'double_click' && Date.now() - prev.startTime < 200) {
          return prev;
        }

        if (prev.isConfirmedDrag) {
          moveKeyframe(prev.layerId, prev.property, prev.originalFrame, prev.currentDragFrame);
        } else {
          setCurrentFrame(prev.originalFrame);
          setSelectedLayerId(prev.layerId);
        }
        return null;
      });
    };

    const onClick = () => {
      setDraggingKeyframe(prev => {
        if (!prev) return null;
        if (prev.mode === 'double_click' && Date.now() - prev.startTime >= 200) {
          moveKeyframe(prev.layerId, prev.property, prev.originalFrame, prev.currentDragFrame);
          return null;
        }
        return prev;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraggingKeyframe(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [draggingKeyframe, calculateFrameFromClientX, moveKeyframe]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animReqRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get current selected layer
  const selectedLayer = useMemo(() => {
    return layers.find(l => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  // Additional Masked Child Layer State (دمج طبقة إضافية مباشرة من الجهاز كقناع Alpha Matte كامل الحركة)
  const additionalLayerFileInputRef = useRef<HTMLInputElement | null>(null);
  const importGeneralLayerInputRef = useRef<HTMLInputElement | null>(null);

  // Upload an icon/piece directly from user device and attach as a masked layer (Alpha Matte)
  const handleUploadMaskedChildLayer = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedLayerId || !e.target.files || !e.target.files[0]) return;
    const parentLayer = layers.find(l => l.id === selectedLayerId);
    if (!parentLayer) return;

    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    const pieceName = file.name.replace(/\.[^/.]+$/, '');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const childLayerId = `layer-masked-${Date.now()}`;
      
      const newLayer: AELayer = {
        id: childLayerId,
        name: `${parentLayer.name} - ${pieceName}`,
        kind: 'image',
        visible: true,
        locked: false,
        colorLabel: 'purple',
        expanded: true,
        // Start centered inside the parent layer (local 0,0 relative to parent)
        position: { x: 0, y: 0 },
        scale: 75,
        rotation: 0,
        opacity: 100,
        // Keyframing only enabled when user clicks clock icon
        animatingPosition: false,
        positionKeyframes: [],
        animatingScale: false,
        scaleKeyframes: [],
        animatingRotation: false,
        rotationKeyframes: [],
        animatingOpacity: false,
        opacityKeyframes: [],
        imageSrc: url,
        imageElement: img,
        width: img.naturalWidth || 150,
        height: img.naturalHeight || 150,
        clipToLayerId: parentLayer.id, // MASKED INSIDE PARENT!
        blendMode: 'source-atop'
      };

      setLayers(prev => {
        // Place right above parent in layer stack
        const pIdx = prev.findIndex(l => l.id === parentLayer.id);
        const next = [...prev];
        if (pIdx >= 0) {
          next.splice(pIdx, 0, newLayer);
        } else {
          next.unshift(newLayer);
        }
        return next;
      });

      // Select it immediately so handles & bounding box appear in viewport
      setSelectedLayerId(childLayerId);
    };
    img.src = url;
    e.target.value = '';
  }, [selectedLayerId, layers]);

  // Handle Duration & Frame calculations in Modal
  const handleFpsChange = (newFps: number) => {
    setModalFps(newFps);
    if (modalDurationMode === 'seconds') {
      setModalTotalFrames(Math.round(modalDurationSec * newFps));
    } else {
      setModalDurationSec(Number((modalTotalFrames / newFps).toFixed(2)));
    }
  };

  const handleTotalFramesChange = (frames: number) => {
    const val = Math.max(1, Math.round(frames));
    setModalTotalFrames(val);
    setModalDurationSec(Number((val / modalFps).toFixed(2)));
  };

  const handleDurationSecChange = (sec: number) => {
    const val = Math.max(0.1, Number(sec));
    setModalDurationSec(val);
    setModalTotalFrames(Math.round(val * modalFps));
  };

  // Commit and Open Composition
  const handleCreateComposition = () => {
    const widthNum = modalWidth === '' ? NaN : Number(modalWidth);
    const heightNum = modalHeight === '' ? NaN : Number(modalHeight);

    if (modalWidth === '' || isNaN(widthNum) || widthNum <= 0 || modalHeight === '' || isNaN(heightNum) || heightNum <= 0) {
      setCompSettingsError('يرجى تحديد العرض والارتفاع أولاً');
      return;
    }

    setCompSettingsError(null);

    const finalWidth = Math.max(10, Math.round(widthNum));
    const finalHeight = Math.max(10, Math.round(heightNum));
    const finalFrames = modalTotalFrames === '' || isNaN(Number(modalTotalFrames)) ? 90 : Math.max(1, Number(modalTotalFrames));

    setCompSettings({
      name: modalName || 'Comp 1',
      width: finalWidth,
      height: finalHeight,
      fps: modalFps,
      totalFrames: finalFrames,
      backgroundColor: modalBg
    });
    setHasProject(true);
    setShowCompSettingsModal(false);
    setCurrentFrame(0);
    setIsPlaying(false);
    // Open directly at 100% Original Size (1:1) as requested!
    setZoomLevel(1);
  };

  // Sync modal state whenever opening composition settings
  useEffect(() => {
    if (showCompSettingsModal) {
      setCompSettingsError(null);
      if (hasProject) {
        setModalName(compSettings.name);
        setModalWidth(compSettings.width);
        setModalHeight(compSettings.height);
        setModalFps(compSettings.fps);
        setModalTotalFrames(compSettings.totalFrames);
        setModalDurationSec(Number((compSettings.totalFrames / compSettings.fps).toFixed(2)));
        setModalBg(compSettings.backgroundColor);
      }
    }
  }, [showCompSettingsModal]);

  // Keyboard shortcut Ctrl+K to toggle composition settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCompSettingsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Keyframe Interpolation Math
  const interpolateNumber = (keyframes: Keyframe<number>[], frame: number, defaultValue: number): number => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (frame >= k1.frame && frame <= k2.frame) {
        const span = k2.frame - k1.frame;
        if (span === 0) return k1.value;
        const t = (frame - k1.frame) / span;
        return k1.value + (k2.value - k1.value) * t;
      }
    }
    return defaultValue;
  };

  const interpolatePoint = (
    keyframes: Keyframe<{ x: number; y: number }>[], 
    frame: number, 
    defaultValue: { x: number; y: number }
  ): { x: number; y: number } => {
    if (!keyframes || keyframes.length === 0) return defaultValue;
    if (keyframes.length === 1) return keyframes[0].value;

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0].value;
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

    for (let i = 0; i < sorted.length - 1; i++) {
      const k1 = sorted[i];
      const k2 = sorted[i + 1];
      if (frame >= k1.frame && frame <= k2.frame) {
        const span = k2.frame - k1.frame;
        if (span === 0) return k1.value;
        const t = (frame - k1.frame) / span;
        return {
          x: k1.value.x + (k2.value.x - k1.value.x) * t,
          y: k1.value.y + (k2.value.y - k1.value.y) * t
        };
      }
    }
    return defaultValue;
  };

  // Evaluate Layer transform at a given frame
  const evaluateLayerAtFrame = useCallback((layer: AELayer, frame: number) => {
    const pos = layer.animatingPosition
      ? interpolatePoint(layer.positionKeyframes, frame, layer.position)
      : layer.position;

    const scale = layer.animatingScale
      ? interpolateNumber(layer.scaleKeyframes, frame, layer.scale)
      : layer.scale;

    const rotation = layer.animatingRotation
      ? interpolateNumber(layer.rotationKeyframes, frame, layer.rotation)
      : layer.rotation;

    const opacity = layer.animatingOpacity
      ? interpolateNumber(layer.opacityKeyframes, frame, layer.opacity)
      : layer.opacity;

    return { pos, scale, rotation, opacity };
  }, []);

  // Get evaluated transform in world canvas coordinate space (handles parent-child Alpha Matte relationship)
  const getLayerWorldTransform = useCallback((layer: AELayer, frame: number) => {
    const local = evaluateLayerAtFrame(layer, frame);
    if (!layer.clipToLayerId) {
      return local;
    }
    const parent = layers.find(l => l.id === layer.clipToLayerId);
    if (!parent) {
      return local;
    }
    const pTrans = evaluateLayerAtFrame(parent, frame);
    const pRad = (pTrans.rotation * Math.PI) / 180;
    const ps = pTrans.scale / 100;

    // Transform local pos by parent rotation & scale
    const rx = (local.pos.x * Math.cos(pRad) - local.pos.y * Math.sin(pRad)) * ps;
    const ry = (local.pos.x * Math.sin(pRad) + local.pos.y * Math.cos(pRad)) * ps;

    return {
      pos: {
        x: pTrans.pos.x + rx,
        y: pTrans.pos.y + ry
      },
      scale: (local.scale * pTrans.scale) / 100,
      rotation: pTrans.rotation + local.rotation,
      opacity: (local.opacity * pTrans.opacity) / 100
    };
  }, [evaluateLayerAtFrame, layers]);

  // Helper to determine intrinsic / configured bounds for any layer
  const getLayerDimensions = useCallback((layer: AELayer, compW: number, compH: number) => {
    switch (layer.kind) {
      case 'image': {
        const w = layer.width || (layer.imageElement ? layer.imageElement.width : 250);
        const h = layer.height || (layer.imageElement ? layer.imageElement.height : 250);
        return { width: w, height: h };
      }
      case 'shape': {
        if (layer.shapeKind === 'rectangle') {
          return { width: layer.width || 200, height: layer.height || 200 };
        }
        const r = (layer.outerRadius || 180) + (layer.strokeWidth || 8) / 2;
        return { width: r * 2, height: r * 2 };
      }
      case 'text': {
        const fontSize = layer.fontSize || 32;
        const textLen = (layer.text || 'AFTER EFFECTS').length;
        return {
          width: Math.max(60, textLen * fontSize * 0.65),
          height: Math.max(30, fontSize * 1.3)
        };
      }
      case 'solid': {
        return { width: layer.width || compW, height: layer.height || compH };
      }
      default:
        return { width: 200, height: 200 };
    }
  }, []);

  // Draw Adobe After Effects Style Selection Bounding Box with 8 Transform Handles & Anchor Point
  const drawSelectionBox = useCallback((
    ctx: CanvasRenderingContext2D,
    layer: AELayer,
    frame: number,
    compW: number,
    compH: number
  ) => {
    const { pos, scale, rotation } = getLayerWorldTransform(layer, frame);
    const { width: lw, height: lh } = getLayerDimensions(layer, compW, compH);
    const halfW = lw / 2;
    const halfH = lh / 2;

    ctx.save();
    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    const s = scale / 100;
    ctx.scale(s, s);

    const invScale = 1 / Math.max(0.05, s);

    // 1. Neon Cyan Bounding Box Outline with drop shadow for clarity on all backgrounds
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4 * invScale;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5 * invScale;
    ctx.setLineDash([]);
    ctx.strokeRect(-halfW, -halfH, lw, lh);
    ctx.restore();

    // 2. 8 Transform Handles (Corners and Midpoints)
    const handleSize = 7 * invScale;
    const hsHalf = handleSize / 2;
    const handlePositions: [number, number][] = [
      [-halfW, -halfH], // Top-Left
      [0, -halfH],      // Top-Center
      [halfW, -halfH],  // Top-Right
      [halfW, 0],       // Middle-Right
      [halfW, halfH],   // Bottom-Right
      [0, halfH],       // Bottom-Center
      [-halfW, halfH],  // Bottom-Left
      [-halfW, 0]       // Middle-Left
    ];

    handlePositions.forEach(([hx, hy]) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(hx - hsHalf, hy - hsHalf, handleSize, handleSize);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1 * invScale;
      ctx.strokeRect(hx - hsHalf, hy - hsHalf, handleSize, handleSize);
    });

    // 3. Center Anchor Point Marker (classic After Effects red crosshair + circle)
    const ancR = 5 * invScale;
    ctx.strokeStyle = '#f43f5e';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
    ctx.lineWidth = 1.2 * invScale;

    ctx.beginPath();
    ctx.arc(0, 0, ancR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-ancR - (3 * invScale), 0);
    ctx.lineTo(ancR + (3 * invScale), 0);
    ctx.moveTo(0, -ancR - (3 * invScale));
    ctx.lineTo(0, ancR + (3 * invScale));
    ctx.stroke();

    ctx.restore();
  }, [getLayerWorldTransform, getLayerDimensions]);

  // Hit-test a layer in canvas coordinate space
  const hitTestLayer = useCallback((
    layer: AELayer,
    canvasX: number,
    canvasY: number,
    frame: number,
    compW: number,
    compH: number
  ): boolean => {
    if (!layer.visible || layer.locked) return false;

    const { pos, scale, rotation, opacity } = getLayerWorldTransform(layer, frame);
    if (opacity <= 0) return false;

    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;

    const dx = canvasX - cx;
    const dy = canvasY - cy;

    // Inverse rotate
    const rad = (-rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;

    // Inverse scale
    const s = (scale || 100) / 100;
    if (s <= 0.001) return false;
    const lx = rx / s;
    const ly = ry / s;

    const { width, height } = getLayerDimensions(layer, compW, compH);
    const halfW = width / 2;
    const halfH = height / 2;

    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH;
  }, [getLayerWorldTransform, getLayerDimensions]);

  // Hit-test handles of a layer in canvas coordinate space
  const hitTestHandles = useCallback((
    layer: AELayer,
    canvasX: number,
    canvasY: number,
    frame: number,
    compW: number,
    compH: number
  ): string | null => {
    const { pos, scale, rotation } = getLayerWorldTransform(layer, frame);
    const { width: lw, height: lh } = getLayerDimensions(layer, compW, compH);
    const halfW = lw / 2;
    const halfH = lh / 2;

    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;

    const handles = [
      { name: 'tl', x: -halfW, y: -halfH },
      { name: 'tc', x: 0, y: -halfH },
      { name: 'tr', x: halfW, y: -halfH },
      { name: 'mr', x: halfW, y: 0 },
      { name: 'br', x: halfW, y: halfH },
      { name: 'bc', x: 0, y: halfH },
      { name: 'bl', x: -halfW, y: halfH },
      { name: 'ml', x: -halfW, y: 0 }
    ];

    const s = scale / 100;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (const h of handles) {
      const rx = h.x * s;
      const ry = h.y * s;
      const hCanvasX = cx + (rx * cos - ry * sin);
      const hCanvasY = cy + (rx * sin + ry * cos);

      const dx = canvasX - hCanvasX;
      const dy = canvasY - hCanvasY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 14) {
        return h.name;
      }
    }

    return null;
  }, [getLayerWorldTransform, getLayerDimensions]);

  // Draw a masked child layer inside its parent's coordinate space (Alpha Matte)
  const drawChildLayerInsideParent = useCallback((
    ctx: CanvasRenderingContext2D,
    child: AELayer,
    parent: AELayer,
    frame: number,
    compW: number,
    compH: number
  ) => {
    if (!child.visible) return;
    const pTrans = evaluateLayerAtFrame(parent, frame);
    const cTrans = evaluateLayerAtFrame(child, frame);
    if (cTrans.opacity <= 0 || pTrans.opacity <= 0) return;

    ctx.save();

    // 1. Position at parent layer origin and orientation
    const pcx = compW / 2 + pTrans.pos.x;
    const pcy = compH / 2 + pTrans.pos.y;
    ctx.translate(pcx, pcy);
    ctx.rotate((pTrans.rotation * Math.PI) / 180);
    const ps = pTrans.scale / 100;
    ctx.scale(ps, ps);

    // 2. Apply child layer's local position, rotation, and scale inside parent
    ctx.translate(cTrans.pos.x, cTrans.pos.y);
    ctx.rotate((cTrans.rotation * Math.PI) / 180);
    const cs = cTrans.scale / 100;
    ctx.scale(cs, cs);
    ctx.globalAlpha = Math.max(0, Math.min(1, (cTrans.opacity / 100) * (pTrans.opacity / 100)));

    if (child.glowRadius && child.glowRadius > 0) {
      ctx.shadowColor = child.glowColor || '#fbbf24';
      ctx.shadowBlur = child.glowRadius;
    }

    // 3. Draw child image content
    if (child.kind === 'image' && child.imageElement && child.imageElement.complete) {
      const cw = child.width || child.imageElement.width;
      const ch = child.height || child.imageElement.height;
      ctx.drawImage(child.imageElement, -cw / 2, -ch / 2, cw, ch);
    } else if (child.kind === 'shape') {
      const r = child.outerRadius || 50;
      ctx.fillStyle = child.fillColor || '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [evaluateLayerAtFrame]);

  // Draw Layer into Canvas Context
  const drawLayer = useCallback((
    ctx: CanvasRenderingContext2D,
    layer: AELayer,
    frame: number,
    compW: number,
    compH: number
  ) => {
    if (!layer.visible) return;

    const { pos, scale, rotation, opacity } = evaluateLayerAtFrame(layer, frame);
    if (opacity <= 0) return;

    ctx.save();

    // Center origin is composition center + layer position
    const cx = compW / 2 + pos.x;
    const cy = compH / 2 + pos.y;

    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    const s = scale / 100;
    ctx.scale(s, s);
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity / 100));

    // Optional Glow Effect
    if (layer.glowRadius && layer.glowRadius > 0) {
      ctx.shadowColor = layer.glowColor || '#f59e0b';
      ctx.shadowBlur = layer.glowRadius;
    }

    // Render by Layer Kind
    switch (layer.kind) {
      case 'shape': {
        const outerR = layer.outerRadius || 180;
        const innerR = layer.innerRadius || 150;
        const strokeW = layer.strokeWidth || 8;

        ctx.fillStyle = layer.fillColor || 'transparent';
        ctx.strokeStyle = layer.strokeColor || '#fbbf24';
        ctx.lineWidth = strokeW;

        if (layer.shapeKind === 'ring') {
          // Double Ring / Donut
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.stroke();

          if (innerR > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, innerR, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Accent studs on the ring
          const studs = 8;
          for (let i = 0; i < studs; i++) {
            const a = (i * Math.PI * 2) / studs;
            const sx = Math.cos(a) * ((outerR + innerR) / 2);
            const sy = Math.sin(a) * ((outerR + innerR) / 2);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, strokeW * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = layer.strokeColor || '#ffffff';
            ctx.fill();
          }
        } else if (layer.shapeKind === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'rectangle') {
          const w = layer.width || 300;
          const h = layer.height || 300;
          ctx.beginPath();
          ctx.rect(-w / 2, -h / 2, w, h);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'polygon') {
          const sides = layer.points || 6;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
            const x = Math.cos(angle) * outerR;
            const y = Math.sin(angle) * outerR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'star') {
          const pts = layer.points || 5;
          const r1 = outerR;
          const r2 = innerR || outerR * 0.45;
          ctx.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const r = i % 2 === 0 ? r1 : r2;
            const angle = (i * Math.PI) / pts - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        ctx.font = `bold ${layer.fontSize || 36}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = layer.fontColor || '#ffffff';
        ctx.fillText(txt, 0, 0);

        if (layer.strokeWidth && layer.strokeWidth > 0) {
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.strokeText(txt, 0, 0);
        }
        break;
      }

      case 'image': {
        if (layer.imageElement && layer.imageElement.complete) {
          const w = layer.width || layer.imageElement.width;
          const h = layer.height || layer.imageElement.height;
          ctx.drawImage(layer.imageElement, -w / 2, -h / 2, w, h);

          if (layer.tintColor) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = layer.tintColor;
            ctx.globalAlpha = layer.tintOpacity !== undefined ? layer.tintOpacity / 100 : 0.5;
            ctx.fillRect(-w / 2, -h / 2, w, h);
            ctx.restore();
          }
        }
        break;
      }

      case 'solid': {
        const w = layer.width || compW;
        const h = layer.height || compH;
        ctx.fillStyle = layer.fillColor || '#ffffff';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        break;
      }
    }

    ctx.restore();
  }, [evaluateLayerAtFrame]);

  // Main Canvas Render loop for Viewport
  const renderCompositionToCanvas = useCallback((
    targetCanvas: HTMLCanvasElement, 
    frame: number, 
    forExport = false
  ) => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const w = compSettings.width;
    const h = compSettings.height;

    ctx.clearRect(0, 0, w, h);

    // If exporting with transparent background, keep canvas completely clean.
    // If viewing in viewport and transparency grid is active, show AE checkerboard pattern!
    if (!forExport) {
      if (showTransparencyGrid) {
        // After Effects classic grey checkerboard
        const sq = 16;
        for (let y = 0; y < h; y += sq) {
          for (let x = 0; x < w; x += sq) {
            ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#28303f' : '#1e2430';
            ctx.fillRect(x, y, sq, sq);
          }
        }
      } else {
        ctx.fillStyle = compSettings.backgroundColor || '#000000';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Render layers from bottom to top (like After Effects)
    const reversed = [...layers].reverse();
    reversed.forEach(layer => {
      // Child layers that are clipped/masked inside a parent are rendered with their parent
      if (layer.clipToLayerId) {
        const parentExists = layers.some(l => l.id === layer.clipToLayerId);
        if (parentExists) return;
        // If parent layer was deleted, render as standalone
        drawLayer(ctx, layer, frame, w, h);
        return;
      }

      // Check if this parent layer has any visible child layers
      const childLayers = layers.filter(l => l.clipToLayerId === layer.id && l.visible);

      if (childLayers.length === 0) {
        drawLayer(ctx, layer, frame, w, h);
      } else {
        // Render on offscreen canvas for exact Alpha Matte clipping (source-atop)
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        const offCanvas = offscreenCanvasRef.current;
        if (offCanvas.width !== w || offCanvas.height !== h) {
          offCanvas.width = w;
          offCanvas.height = h;
        }
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.clearRect(0, 0, w, h);

          // 1. Draw parent layer
          drawLayer(offCtx, layer, frame, w, h);

          // 2. Draw each child layer clipped inside parent layer with Alpha Matte
          childLayers.forEach(child => {
            offCtx.save();
            offCtx.globalCompositeOperation = (child.blendMode as any) || 'source-atop';
            drawChildLayerInsideParent(offCtx, child, layer, frame, w, h);
            offCtx.restore();
          });

          // 3. Composite onto main canvas
          ctx.drawImage(offCanvas, 0, 0);
        }
      }
    });

    // Viewport-only Guides & Handles
    if (!forExport) {
      // Render Adobe After Effects Selection Bounding Box & Handles
      if (selectedLayerId) {
        const selLayer = layers.find(l => l.id === selectedLayerId);
        if (selLayer && selLayer.visible) {
          drawSelectionBox(ctx, selLayer, frame, w, h);
        }
      }
    }
  }, [compSettings, layers, showTransparencyGrid, selectedLayerId, drawLayer, drawSelectionBox]);

  // Update canvas on frame change or selection change
  useEffect(() => {
    if (canvasRef.current && hasProject) {
      renderCompositionToCanvas(canvasRef.current, currentFrame, false);
    }
  }, [currentFrame, hasProject, renderCompositionToCanvas, selectedLayerId]);

  // Canvas Mouse Down: Select layer on canvas or initiate mouse drag
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'hand') return; // Hand tool handled by viewport container
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const canvasX = (clientX / rect.width) * compSettings.width;
    const canvasY = (clientY / rect.height) * compSettings.height;

    // 0. Check if clicked on any of the 8 selection handles of the currently selected layer
    if (selectedLayerId) {
      const currentSelected = layers.find(l => l.id === selectedLayerId);
      if (currentSelected) {
        const hitHandle = hitTestHandles(currentSelected, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height);
        if (hitHandle) {
          e.stopPropagation();
          const { width: lw, height: lh } = getLayerDimensions(currentSelected, compSettings.width, compSettings.height);
          const currentPos = evaluateLayerAtFrame(currentSelected, currentFrame).pos;
          dragInfoRef.current = {
            layerId: currentSelected.id,
            startCanvasX: canvasX,
            startCanvasY: canvasY,
            startLayerPos: { ...currentPos },
            resizeHandle: hitHandle,
            startWidth: lw,
            startHeight: lh,
            startScale: currentSelected.scale || 100
          };
          setIsDraggingLayer(true);
          return;
        }
      }
    }

    // 1. Check if the currently selected layer was clicked first, or if a child layer of it was clicked
    let hitLayer: AELayer | null = null;
    if (selectedLayerId) {
      const childOfSelected = layers.find(l => l.clipToLayerId === selectedLayerId && hitTestLayer(l, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height));
      if (childOfSelected) {
        hitLayer = childOfSelected;
      } else {
        const currentSelected = layers.find(l => l.id === selectedLayerId);
        if (currentSelected && hitTestLayer(currentSelected, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height)) {
          hitLayer = currentSelected;
        }
      }
    }

    // 2. If not, check all layers top-to-bottom
    if (!hitLayer) {
      for (const layer of layers) {
        if (hitTestLayer(layer, canvasX, canvasY, currentFrame, compSettings.width, compSettings.height)) {
          hitLayer = layer;
          break;
        }
      }
    }

    if (hitLayer) {
      e.stopPropagation();
      setSelectedLayerId(hitLayer.id);

      const currentPos = evaluateLayerAtFrame(hitLayer, currentFrame).pos;
      dragInfoRef.current = {
        layerId: hitLayer.id,
        startCanvasX: canvasX,
        startCanvasY: canvasY,
        startLayerPos: { ...currentPos }
      };
      setIsDraggingLayer(true);
    } else {
      // Clicked on empty canvas space: deselect
      e.stopPropagation();
      setSelectedLayerId(null);
    }
  };

  // Global mouse move & mouse up for smooth layer dragging across canvas and window
  useEffect(() => {
    if (!isDraggingLayer) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragInfoRef.current || !canvasRef.current) return;
      const { layerId, startCanvasX, startCanvasY, startLayerPos, resizeHandle, startWidth, startHeight, startScale } = dragInfoRef.current;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const currentCanvasX = (clientX / rect.width) * compSettings.width;
      const currentCanvasY = (clientY / rect.height) * compSettings.height;

      const deltaX = currentCanvasX - startCanvasX;
      const deltaY = currentCanvasY - startCanvasY;

      // Handle direct handle resizing/stretching
      if (resizeHandle) {
        setLayers(prev => prev.map(l => {
          if (l.id !== layerId) return l;
          if (l.locked) return l;

          // Project delta into local rotated coordinate space
          const rad = (-l.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const localDeltaX = deltaX * cos - deltaY * sin;
          const localDeltaY = deltaX * sin + deltaY * cos;

          const s = (startScale || 100) / 100;
          const scaledDeltaX = localDeltaX / Math.max(0.01, s);
          const scaledDeltaY = localDeltaY / Math.max(0.01, s);

          let nextWidth = startWidth || 200;
          let nextHeight = startHeight || 200;

          if (resizeHandle === 'mr') {
            nextWidth = Math.max(10, nextWidth + scaledDeltaX * 2);
          } else if (resizeHandle === 'ml') {
            nextWidth = Math.max(10, nextWidth - scaledDeltaX * 2);
          } else if (resizeHandle === 'bc') {
            nextHeight = Math.max(10, nextHeight + scaledDeltaY * 2);
          } else if (resizeHandle === 'tc') {
            nextHeight = Math.max(10, nextHeight - scaledDeltaY * 2);
          } else if (resizeHandle === 'br') {
            nextWidth = Math.max(10, nextWidth + scaledDeltaX * 2);
            nextHeight = Math.max(10, nextHeight + scaledDeltaY * 2);
          } else if (resizeHandle === 'tl') {
            nextWidth = Math.max(10, nextWidth - scaledDeltaX * 2);
            nextHeight = Math.max(10, nextHeight - scaledDeltaY * 2);
          } else if (resizeHandle === 'tr') {
            nextWidth = Math.max(10, nextWidth + scaledDeltaX * 2);
            nextHeight = Math.max(10, nextHeight - scaledDeltaY * 2);
          } else if (resizeHandle === 'bl') {
            nextWidth = Math.max(10, nextWidth - scaledDeltaX * 2);
            nextHeight = Math.max(10, nextHeight + scaledDeltaY * 2);
          }

          return {
            ...l,
            width: Math.round(nextWidth),
            height: Math.round(nextHeight)
          };
        }));
        return;
      }

      setLayers(prev => prev.map(l => {
        if (l.id !== layerId) return l;
        if (l.locked) return l;

        let localDeltaX = deltaX;
        let localDeltaY = deltaY;
        if (l.clipToLayerId) {
          const parent = prev.find(p => p.id === l.clipToLayerId);
          if (parent) {
            const pTrans = evaluateLayerAtFrame(parent, currentFrame);
            const pRad = (-pTrans.rotation * Math.PI) / 180;
            const ps = pTrans.scale / 100;
            if (ps > 0.001) {
              localDeltaX = (deltaX * Math.cos(pRad) - deltaY * Math.sin(pRad)) / ps;
              localDeltaY = (deltaX * Math.sin(pRad) + deltaY * Math.cos(pRad)) / ps;
            }
          }
        }

        const newPos = {
          x: Math.round(startLayerPos.x + localDeltaX),
          y: Math.round(startLayerPos.y + localDeltaY)
        };

        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: newPos };
          } else {
            nextKfs.push({ frame: currentFrame, value: newPos });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: newPos, positionKeyframes: nextKfs };
        } else {
          return { ...l, position: newPos };
        }
      }));
    };

    const handleWindowMouseUp = () => {
      setIsDraggingLayer(false);
      dragInfoRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingLayer, currentFrame, compSettings.width, compSettings.height]);

  // Keyboard Arrow Keys Nudge Listener (1px, Shift=10px) like Adobe After Effects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is typing in form inputs, textareas, or contentEditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
          return;
        }
      }

      if (!selectedLayerId) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedLayerId(null);
        return;
      }

      // Layer Reorder Shortcuts: Ctrl+] (Bring Forward), Ctrl+[ (Send Backward)
      if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '}')) {
        e.preventDefault();
        setLayers(prev => {
          const idx = prev.findIndex(l => l.id === selectedLayerId);
          if (idx <= 0) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          if (e.shiftKey) {
            updated.unshift(moved);
          } else {
            updated.splice(idx - 1, 0, moved);
          }
          return updated;
        });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '[' || e.key === '{')) {
        e.preventDefault();
        setLayers(prev => {
          const idx = prev.findIndex(l => l.id === selectedLayerId);
          if (idx < 0 || idx >= prev.length - 1) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          if (e.shiftKey) {
            updated.push(moved);
          } else {
            updated.splice(idx + 1, 0, moved);
          }
          return updated;
        });
        return;
      }

      const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!isArrow) return;

      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;

      setLayers(prev => prev.map(l => {
        if (l.id !== selectedLayerId) return l;
        if (l.locked) return l;

        const currentPos = evaluateLayerAtFrame(l, currentFrame).pos;
        const newPos = {
          x: Math.round(currentPos.x + dx),
          y: Math.round(currentPos.y + dy)
        };

        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: newPos };
          } else {
            nextKfs.push({ frame: currentFrame, value: newPos });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: newPos, positionKeyframes: nextKfs };
        } else {
          return { ...l, position: newPos };
        }
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, currentFrame, evaluateLayerAtFrame]);

  // Ensure layer selection remains robust:
  // Selection will ONLY clear if explicitly clicking on empty space directly inside the canvas,
  // or by pressing the Escape key, or when deleting a layer.
  // Using scrollbars (horizontal/vertical on page, panels, properties, or timeline) will never clear selection.

  // Animation Playback Engine
  useEffect(() => {
    if (!hasProject) return;

    let lastTimestamp = performance.now();
    const frameDuration = 1000 / compSettings.fps;

    const tick = (now: number) => {
      if (isPlayingRef.current) {
        const elapsed = now - lastTimestamp;
        if (elapsed >= frameDuration) {
          lastTimestamp = now - (elapsed % frameDuration);
          setCurrentFrame(prev => (prev + 1) % compSettings.totalFrames);
        }
      }
      animReqRef.current = requestAnimationFrame(tick);
    };

    animReqRef.current = requestAnimationFrame(tick);
    return () => {
      if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    };
  }, [hasProject, compSettings.fps, compSettings.totalFrames]);

  // -------------------------------------------------------------
  // LAYER MANAGEMENT & KEYFRAME SYSTEM
  // -------------------------------------------------------------

  const addNewLayer = (kind: LayerKind, subType?: string) => {
    const newId = `layer-${Date.now()}`;
    const count = layers.length + 1;
    let newLayer: AELayer;

    if (kind === 'shape') {
      if (subType === 'ring') {
        newLayer = {
          id: newId,
          name: `Ring Frame ${count}`,
          kind: 'shape',
          shapeKind: 'ring',
          visible: true,
          locked: false,
          colorLabel: 'yellow',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: Math.round(compSettings.width * 0.36),
          innerRadius: Math.round(compSettings.width * 0.32),
          strokeWidth: 8,
          strokeColor: '#f59e0b',
          glowRadius: 15,
          glowColor: '#fbbf24'
        };
      } else if (subType === 'star') {
        newLayer = {
          id: newId,
          name: `Star ${count}`,
          kind: 'shape',
          shapeKind: 'star',
          visible: true,
          locked: false,
          colorLabel: 'purple',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: 60,
          innerRadius: 28,
          points: 5,
          fillColor: '#ec4899',
          strokeWidth: 2,
          strokeColor: '#ffffff',
          glowRadius: 12,
          glowColor: '#f43f5e'
        };
      } else {
        // Circle default
        newLayer = {
          id: newId,
          name: `Circle Shape ${count}`,
          kind: 'shape',
          shapeKind: 'circle',
          visible: true,
          locked: false,
          colorLabel: 'blue',
          expanded: false,
          position: { x: 0, y: 0 },
          scale: 100,
          rotation: 0,
          opacity: 100,
          animatingPosition: false,
          positionKeyframes: [],
          animatingScale: false,
          scaleKeyframes: [],
          animatingRotation: false,
          rotationKeyframes: [],
          animatingOpacity: false,
          opacityKeyframes: [],
          outerRadius: 120,
          strokeWidth: 4,
          strokeColor: '#38bdf8',
          fillColor: 'transparent',
          glowRadius: 10,
          glowColor: '#0ea5e9'
        };
      }
    } else if (kind === 'text') {
      newLayer = {
        id: newId,
        name: `Text ${count}`,
        kind: 'text',
        visible: true,
        locked: false,
        colorLabel: 'red',
        expanded: false,
        position: { x: 0, y: 0 },
        scale: 100,
        rotation: 0,
        opacity: 100,
        animatingPosition: false,
        positionKeyframes: [],
        animatingScale: false,
        scaleKeyframes: [],
        animatingRotation: false,
        rotationKeyframes: [],
        animatingOpacity: false,
        opacityKeyframes: [],
        text: 'MOTION FRAME',
        fontSize: 32,
        fontColor: '#ffffff',
        strokeWidth: 2,
        strokeColor: '#000000',
        glowRadius: 10,
        glowColor: '#3b82f6'
      };
    } else {
      // Solid Layer
      newLayer = {
        id: newId,
        name: `Solid ${count}`,
        kind: 'solid',
        visible: true,
        locked: false,
        colorLabel: 'gray',
        expanded: false,
        position: { x: 0, y: 0 },
        scale: 100,
        rotation: 0,
        opacity: 50,
        animatingPosition: false,
        positionKeyframes: [],
        animatingScale: false,
        scaleKeyframes: [],
        animatingRotation: false,
        rotationKeyframes: [],
        animatingOpacity: false,
        opacityKeyframes: [],
        width: compSettings.width,
        height: compSettings.height,
        fillColor: '#1e293b'
      };
    }

    setLayers(prev => [newLayer, ...prev]);
    setSelectedLayerId(newId);
  };

  // Upload custom asset as an Image Layer
  const handleUploadAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setImageImportPending({
          file,
          url,
          naturalWidth: img.naturalWidth || img.width,
          naturalHeight: img.naturalHeight || img.height,
          img
        });
        setImageImportWidth(String(img.naturalWidth || img.width));
        setImageImportHeight(String(img.naturalHeight || img.height));
      };
    }
  };

  const updateSelectedLayer = (updates: Partial<AELayer>) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, ...updates } : l));
  };

  const duplicateLayer = (layer: AELayer) => {
    const copy: AELayer = {
      ...layer,
      id: `layer-${Date.now()}`,
      name: `${layer.name} Copy`,
      position: { x: layer.position.x + 15, y: layer.position.y + 15 }
    };
    setLayers(prev => [copy, ...prev]);
    setSelectedLayerId(copy.id);
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id && l.clipToLayerId !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
    }
  };

  // Reorder layers by indices (HTML5 Drag & Drop)
  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setLayers(prev => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  // Move layer up one position (bring forward in workspace)
  const moveLayerUp = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx <= 0) return prev; // Already at the top
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      return updated;
    });
  }, []);

  // Move layer down one position (send backward in workspace)
  const moveLayerDown = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0 || idx >= prev.length - 1) return prev; // Already at the bottom
      const updated = [...prev];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      return updated;
    });
  }, []);

  // Bring layer to front (top of layers list, renders over all other layers)
  const bringLayerToFront = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx <= 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.unshift(moved);
      return updated;
    });
  }, []);

  // Send layer to back (bottom of layers list, renders behind all other layers)
  const sendLayerToBack = useCallback((layerId: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0 || idx === prev.length - 1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.push(moved);
      return updated;
    });
  }, []);

  // Toggle Stopwatch (Enable/Disable Keyframing like Adobe After Effects)
  // When turned on, After Effects places EXACTLY ONE keyframe at the current playhead frame.
  // The layer remains completely static until the user moves the playhead and modifies values!
  const toggleStopwatch = (property: 'position' | 'scale' | 'rotation' | 'opacity') => {
    if (!selectedLayer) return;
    const l = selectedLayer;
    const f = currentFrame;
    const evaluated = evaluateLayerAtFrame(l, f);

    if (property === 'rotation') {
      const nextState = !l.animatingRotation;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        // Place single keyframe at current playhead frame with current value (static hold)
        kfs = [{ frame: f, value: Math.round(evaluated.rotation) }];
      }
      updateSelectedLayer({ animatingRotation: nextState, rotationKeyframes: kfs, rotation: Math.round(evaluated.rotation) });
    } else if (property === 'scale') {
      const nextState = !l.animatingScale;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: Math.round(evaluated.scale) }];
      }
      updateSelectedLayer({ animatingScale: nextState, scaleKeyframes: kfs, scale: Math.round(evaluated.scale) });
    } else if (property === 'position') {
      const nextState = !l.animatingPosition;
      let kfs: Keyframe<{ x: number; y: number }>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) } }];
      }
      updateSelectedLayer({ animatingPosition: nextState, positionKeyframes: kfs, position: { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) } });
    } else if (property === 'opacity') {
      const nextState = !l.animatingOpacity;
      let kfs: Keyframe<number>[] = [];
      if (nextState) {
        kfs = [{ frame: f, value: Math.round(evaluated.opacity) }];
      }
      updateSelectedLayer({ animatingOpacity: nextState, opacityKeyframes: kfs, opacity: Math.round(evaluated.opacity) });
    }
  };

  // Add / Toggle a Keyframe Diamond at Current Frame (like After Effects ◇ button)
  const toggleKeyframeAtCurrentFrame = (property: 'rotation' | 'scale' | 'position' | 'opacity') => {
    if (!selectedLayer) return;
    const l = selectedLayer;
    const f = currentFrame;
    const evaluated = evaluateLayerAtFrame(l, f);

    if (property === 'rotation') {
      const existingIdx = l.rotationKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.rotationKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.rotation);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingRotation: true, rotationKeyframes: nextKfs });
    } else if (property === 'scale') {
      const existingIdx = l.scaleKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.scaleKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.scale);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingScale: true, scaleKeyframes: nextKfs });
    } else if (property === 'position') {
      const existingIdx = l.positionKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.positionKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = { x: Math.round(evaluated.pos.x), y: Math.round(evaluated.pos.y) };
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingPosition: true, positionKeyframes: nextKfs });
    } else if (property === 'opacity') {
      const existingIdx = l.opacityKeyframes.findIndex(k => k.frame === f);
      let nextKfs = [...l.opacityKeyframes];
      if (existingIdx >= 0) {
        nextKfs.splice(existingIdx, 1);
      } else {
        const val = Math.round(evaluated.opacity);
        nextKfs.push({ frame: f, value: val });
        nextKfs.sort((a, b) => a.frame - b.frame);
      }
      updateSelectedLayer({ animatingOpacity: true, opacityKeyframes: nextKfs });
    }
  };

  // Check if a layer has a keyframe at the current frame for a given property
  const hasKeyframeAtCurrentFrame = (
    property: 'rotation' | 'scale' | 'position' | 'opacity',
    layer?: AELayer | null
  ): boolean => {
    const l = layer || selectedLayer;
    if (!l) return false;
    const f = currentFrame;
    if (property === 'rotation') return l.rotationKeyframes.some(k => k.frame === f);
    if (property === 'scale') return l.scaleKeyframes.some(k => k.frame === f);
    if (property === 'position') return l.positionKeyframes.some(k => k.frame === f);
    if (property === 'opacity') return l.opacityKeyframes.some(k => k.frame === f);
    return false;
  };

  // Update a property value: if animating, updates or creates a keyframe at currentFrame
  const updateLayerPropertyValue = (
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    value: any
  ) => {
    if (!selectedLayerId) return;

    setLayers(prev => prev.map(l => {
      if (l.id !== selectedLayerId) return l;

      if (property === 'rotation') {
        const numVal = Number(value);
        if (l.animatingRotation) {
          const existingIdx = l.rotationKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.rotationKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, rotation: numVal, rotationKeyframes: nextKfs };
        }
        return { ...l, rotation: numVal };
      }

      if (property === 'scale') {
        const numVal = Number(value);
        if (l.animatingScale) {
          const existingIdx = l.scaleKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.scaleKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, scale: numVal, scaleKeyframes: nextKfs };
        }
        return { ...l, scale: numVal };
      }

      if (property === 'opacity') {
        const numVal = Number(value);
        if (l.animatingOpacity) {
          const existingIdx = l.opacityKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.opacityKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: numVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: numVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, opacity: numVal, opacityKeyframes: nextKfs };
        }
        return { ...l, opacity: numVal };
      }

      if (property === 'position') {
        const posVal = value as { x: number; y: number };
        if (l.animatingPosition) {
          const existingIdx = l.positionKeyframes.findIndex(k => k.frame === currentFrame);
          let nextKfs = [...l.positionKeyframes];
          if (existingIdx >= 0) {
            nextKfs[existingIdx] = { ...nextKfs[existingIdx], value: posVal };
          } else {
            nextKfs.push({ frame: currentFrame, value: posVal });
            nextKfs.sort((a, b) => a.frame - b.frame);
          }
          return { ...l, position: posVal, positionKeyframes: nextKfs };
        }
        return { ...l, position: posVal };
      }

      return l;
    }));
  };

  // Add / Toggle keyframe for the layer at current playhead position
  const addOrToggleKeyframeForLayer = (layerId: string) => {
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer) return;

    const f = currentFrame;
    const evalResult = evaluateLayerAtFrame(targetLayer, f);

    setLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;

      const hasAnyAnim = l.animatingRotation || l.animatingPosition || l.animatingScale || l.animatingOpacity;

      if (!hasAnyAnim) {
        return l;
      }

      let updated = { ...l };

      if (l.animatingRotation) {
        const existIdx = l.rotationKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.rotationKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.rotation) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.rotationKeyframes = nextKfs;
      }

      if (l.animatingPosition) {
        const existIdx = l.positionKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.positionKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: { x: Math.round(evalResult.pos.x), y: Math.round(evalResult.pos.y) } });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.positionKeyframes = nextKfs;
      }

      if (l.animatingScale) {
        const existIdx = l.scaleKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.scaleKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.scale) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.scaleKeyframes = nextKfs;
      }

      if (l.animatingOpacity) {
        const existIdx = l.opacityKeyframes.findIndex(k => k.frame === f);
        let nextKfs = [...l.opacityKeyframes];
        if (existIdx >= 0) {
          nextKfs.splice(existIdx, 1);
        } else {
          nextKfs.push({ frame: f, value: Math.round(evalResult.opacity) });
          nextKfs.sort((a, b) => a.frame - b.frame);
        }
        updated.opacityKeyframes = nextKfs;
      }

      return updated;
    }));
  };

  // Keyframe navigation helpers (J / K shortcuts like AE)
  const getAllKeyframeFrames = (layer?: AELayer | null): number[] => {
    const l = layer || selectedLayer;
    if (!l) return [];
    const frames = new Set<number>();
    if (l.animatingPosition) l.positionKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingScale) l.scaleKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingRotation) l.rotationKeyframes.forEach(k => frames.add(k.frame));
    if (l.animatingOpacity) l.opacityKeyframes.forEach(k => frames.add(k.frame));
    return Array.from(frames).sort((a, b) => a - b);
  };

  const goToPrevKeyframe = () => {
    const all = getAllKeyframeFrames(selectedLayer);
    const prevs = all.filter(f => f < currentFrame);
    if (prevs.length > 0) {
      setCurrentFrame(prevs[prevs.length - 1]);
    }
  };

  const goToNextKeyframe = () => {
    const all = getAllKeyframeFrames(selectedLayer);
    const nexts = all.filter(f => f > currentFrame);
    if (nexts.length > 0) {
      setCurrentFrame(nexts[0]);
    }
  };

  // -------------------------------------------------------------
  // EXPORT PIPELINE (SVGA, APNG, GIF, JSX AFTER EFFECTS SCRIPT)
  // -------------------------------------------------------------

  const captureAllFrames = async (progressCb: (percent: number, msg: string) => void) => {
    const w = compSettings.width;
    const h = compSettings.height;
    const total = compSettings.totalFrames;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;

    const canvases: HTMLCanvasElement[] = [];
    const dataUrls: string[] = [];

    for (let f = 0; f < total; f++) {
      renderCompositionToCanvas(offCanvas, f, true);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = w;
      frameCanvas.height = h;
      const fCtx = frameCanvas.getContext('2d')!;
      fCtx.drawImage(offCanvas, 0, 0);

      canvases.push(frameCanvas);
      dataUrls.push(frameCanvas.toDataURL('image/png'));

      const p = Math.round(((f + 1) / total) * 50);
      progressCb(p, `رندرة الإطار ${f + 1} من ${total}...`);
      await new Promise(r => setTimeout(r, 0));
    }

    return { canvases, dataUrls };
  };

  // Helper to render an individual layer as an isolated piece/sprite asset
  const renderLayerPiece = useCallback((layer: AELayer): {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    anchorX: number;
    anchorY: number;
  } => {
    let pw = 256;
    let ph = 256;

    const strokeW = layer.strokeWidth || 0;
    const glow = (layer.glowRadius && layer.glowRadius > 0) ? layer.glowRadius : 0;
    const margin = Math.ceil(strokeW + glow + 16);

    switch (layer.kind) {
      case 'shape': {
        if (layer.shapeKind === 'rectangle') {
          const rw = layer.width || 300;
          const rh = layer.height || 300;
          pw = Math.ceil(rw + margin * 2);
          ph = Math.ceil(rh + margin * 2);
        } else {
          // ring, circle, polygon, star
          const outerR = layer.outerRadius || 180;
          const dim = Math.ceil((outerR + margin) * 2);
          pw = dim;
          ph = dim;
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        const fontSize = layer.fontSize || 36;
        const fontFamily = layer.fontFamily || 'sans-serif';
        const tempCanvas = document.createElement('canvas');
        const tctx = tempCanvas.getContext('2d')!;
        tctx.font = `bold ${fontSize}px ${fontFamily}`;
        const metrics = tctx.measureText(txt);
        pw = Math.ceil(metrics.width + margin * 2);
        ph = Math.ceil(fontSize * 1.8 + margin * 2);
        break;
      }

      case 'image': {
        const iw = layer.width || (layer.imageElement ? layer.imageElement.width : 256);
        const ih = layer.height || (layer.imageElement ? layer.imageElement.height : 256);
        pw = Math.ceil(iw + margin * 2);
        ph = Math.ceil(ih + margin * 2);
        break;
      }

      case 'solid': {
        pw = layer.width || compSettings.width;
        ph = layer.height || compSettings.height;
        break;
      }
    }

    // Ensure even dimensions
    if (pw % 2 !== 0) pw += 1;
    if (ph % 2 !== 0) ph += 1;
    const anchorX = pw / 2;
    const anchorY = ph / 2;

    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d')!;

    // Move to center anchor point
    ctx.translate(anchorX, anchorY);

    // Apply glow if active
    if (glow > 0) {
      ctx.shadowColor = layer.glowColor || '#f59e0b';
      ctx.shadowBlur = glow;
    }

    // Draw the layer graphic at local origin (0, 0)
    switch (layer.kind) {
      case 'shape': {
        const outerR = layer.outerRadius || 180;
        const innerR = layer.innerRadius || 150;
        ctx.fillStyle = layer.fillColor || 'transparent';
        ctx.strokeStyle = layer.strokeColor || '#fbbf24';
        ctx.lineWidth = strokeW;

        if (layer.shapeKind === 'ring') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.stroke();

          if (innerR > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, innerR, 0, Math.PI * 2);
            ctx.stroke();
          }

          const studs = 8;
          for (let i = 0; i < studs; i++) {
            const a = (i * Math.PI * 2) / studs;
            const sx = Math.cos(a) * ((outerR + innerR) / 2);
            const sy = Math.sin(a) * ((outerR + innerR) / 2);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(2, strokeW * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = layer.strokeColor || '#ffffff';
            ctx.fill();
          }
        } else if (layer.shapeKind === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'rectangle') {
          const rw = layer.width || 300;
          const rh = layer.height || 300;
          ctx.beginPath();
          ctx.rect(-rw / 2, -rh / 2, rw, rh);
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'polygon') {
          const sides = layer.points || 6;
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
            const x = Math.cos(angle) * outerR;
            const y = Math.sin(angle) * outerR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        } else if (layer.shapeKind === 'star') {
          const pts = layer.points || 5;
          const r1 = outerR;
          const r2 = innerR || outerR * 0.45;
          ctx.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const r = i % 2 === 0 ? r1 : r2;
            const angle = (i * Math.PI) / pts - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          if (layer.fillColor && layer.fillColor !== 'transparent') ctx.fill();
          if (strokeW > 0) ctx.stroke();
        }
        break;
      }

      case 'text': {
        const txt = layer.text || 'AFTER EFFECTS';
        ctx.font = `bold ${layer.fontSize || 36}px ${layer.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = layer.fontColor || '#ffffff';
        ctx.fillText(txt, 0, 0);

        if (strokeW > 0) {
          ctx.lineWidth = strokeW;
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.strokeText(txt, 0, 0);
        }
        break;
      }

      case 'image': {
        if (layer.imageElement && layer.imageElement.complete) {
          const iw = layer.width || layer.imageElement.width;
          const ih = layer.height || layer.imageElement.height;
          ctx.drawImage(layer.imageElement, -iw / 2, -ih / 2, iw, ih);

          if (layer.tintColor) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = layer.tintColor;
            ctx.globalAlpha = layer.tintOpacity !== undefined ? layer.tintOpacity / 100 : 0.5;
            ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
            ctx.restore();
          }
        }
        break;
      }

      case 'solid': {
        const sw = layer.width || compSettings.width;
        const sh = layer.height || compSettings.height;
        ctx.fillStyle = layer.fillColor || '#ffffff';
        ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
        break;
      }
    }

    return { canvas, width: pw, height: ph, anchorX, anchorY };
  }, [compSettings.width, compSettings.height]);

  // 1. Export as SVGA 2.0 (Piece-based Sprites or Full-frame Sequence)
  const exportAsSVGA = async () => {
    try {
      setExporting(true);
      setExportProgress(10);

      const root = parse(svgaSchema).root;
      const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');
      const total = compSettings.totalFrames;

      const images: Record<string, Uint8Array> = {};
      const sprites: any[] = [];

      if (svgaExportMode === 'pieces') {
        // --- PIECE-BASED SPRITES (قطع عادي ومصفوفات تحريك أصلية مع دعم الأقنعة matteKey) ---
        setExportStatusText('جاري تقطيع الطبقات إلى أصول شفافة (Sprites)...');

        // Order from bottom to top so top layer is drawn last in SVGA Player
        const activeLayers = [...layers].filter(l => l.visible).reverse();
        if (activeLayers.length === 0) {
          throw new Error('لا توجد طبقات مرئية في المشروع لتصديرها.');
        }

        // Identify parent layers that have clipped children
        const parentIdsWithClippedChildren = new Set(
          activeLayers.filter(l => l.clipToLayerId).map(l => l.clipToLayerId!)
        );
        const parentMatteKeys: Record<string, string> = {};

        for (let idx = 0; idx < activeLayers.length; idx++) {
          const layer = activeLayers[idx];
          const piece = renderLayerPiece(layer);

          // Convert piece canvas to PNG byte array
          const dataUrl = piece.canvas.toDataURL('image/png');
          const base64 = dataUrl.split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) {
            bytes[b] = binaryStr.charCodeAt(b);
          }

          const cleanName = layer.name.replace(/[^a-zA-Z0-9_]/g, '_');
          const imageKey = `piece_${idx}_${cleanName || 'layer'}`;
          images[imageKey] = bytes;

          // Check if this layer is a clipped child layer (e.g. shine inside parent piece)
          const isChild = !!layer.clipToLayerId;
          const parentLayer = isChild ? layers.find(p => p.id === layer.clipToLayerId) : undefined;

          // Build sprite frame transformations across all frames
          const spriteFrames = [];
          for (let f = 0; f < total; f++) {
            if (isChild && parentLayer) {
              // Compute child's world coordinates by composing parent transform and child local transform
              const pTrans = evaluateLayerAtFrame(parentLayer, f);
              const cTrans = evaluateLayerAtFrame(layer, f);
              const pAlpha = !parentLayer.visible ? 0.0 : Math.max(0, Math.min(1, pTrans.opacity / 100));
              const cAlpha = !layer.visible ? 0.0 : Math.max(0, Math.min(1, cTrans.opacity / 100));
              const alpha = pAlpha * cAlpha;

              const ps = pTrans.scale / 100;
              const pRad = (pTrans.rotation * Math.PI) / 180;
              const pa = ps * Math.cos(pRad);
              const pb = ps * Math.sin(pRad);
              const pc = -ps * Math.sin(pRad);
              const pd = ps * Math.cos(pRad);

              const pcx = compSettings.width / 2 + pTrans.pos.x;
              const pcy = compSettings.height / 2 + pTrans.pos.y;

              const worldCx = pcx + (cTrans.pos.x * pa + cTrans.pos.y * pc);
              const worldCy = pcy + (cTrans.pos.x * pb + cTrans.pos.y * pd);

              const totalScale = (pTrans.scale / 100) * (cTrans.scale / 100);
              const totalRad = ((pTrans.rotation + cTrans.rotation) * Math.PI) / 180;
              const a = totalScale * Math.cos(totalRad);
              const b = totalScale * Math.sin(totalRad);
              const c = -totalScale * Math.sin(totalRad);
              const d = totalScale * Math.cos(totalRad);

              const tx = worldCx - (piece.anchorX * a + piece.anchorY * c);
              const ty = worldCy - (piece.anchorX * b + piece.anchorY * d);

              spriteFrames.push({
                alpha: Number(alpha.toFixed(4)),
                layout: {
                  x: 0,
                  y: 0,
                  width: piece.width,
                  height: piece.height
                },
                transform: {
                  a: Number(a.toFixed(5)),
                  b: Number(b.toFixed(5)),
                  c: Number(c.toFixed(5)),
                  d: Number(d.toFixed(5)),
                  tx: Number(tx.toFixed(3)),
                  ty: Number(ty.toFixed(3))
                }
              });
            } else {
              // Standard Layer
              const { pos, scale, rotation, opacity } = evaluateLayerAtFrame(layer, f);
              const alpha = !layer.visible ? 0.0 : Math.max(0, Math.min(1, opacity / 100));

              const s = scale / 100;
              const rad = (rotation * Math.PI) / 180;
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);

              const a = s * cos;
              const b = s * sin;
              const c = -s * sin;
              const d = s * cos;

              const cx = compSettings.width / 2 + pos.x;
              const cy = compSettings.height / 2 + pos.y;

              const tx = cx - (piece.anchorX * a + piece.anchorY * c);
              const ty = cy - (piece.anchorX * b + piece.anchorY * d);

              spriteFrames.push({
                alpha: Number(alpha.toFixed(4)),
                layout: {
                  x: 0,
                  y: 0,
                  width: piece.width,
                  height: piece.height
                },
                transform: {
                  a: Number(a.toFixed(5)),
                  b: Number(b.toFixed(5)),
                  c: Number(c.toFixed(5)),
                  d: Number(d.toFixed(5)),
                  tx: Number(tx.toFixed(3)),
                  ty: Number(ty.toFixed(3))
                }
              });
            }
          }

          // If this layer is a parent with clipped children, generate a dedicated matte sprite with .matte in imageKey
          if (parentIdsWithClippedChildren.has(layer.id)) {
            const matteKey = `matte_${idx}_${cleanName || 'layer'}.matte`;
            parentMatteKeys[layer.id] = matteKey;
            images[matteKey] = bytes;
            sprites.push({
              imageKey: matteKey,
              frames: spriteFrames
            });
          }

          // Associate matteKey if this is a child layer
          const assignedMatteKey = (isChild && parentLayer) ? parentMatteKeys[parentLayer.id] : undefined;

          sprites.push({
            imageKey: imageKey,
            frames: spriteFrames,
            ...(assignedMatteKey ? { matteKey: assignedMatteKey } : {})
          });

          setExportProgress(10 + Math.round(((idx + 1) / activeLayers.length) * 60));
          setExportStatusText(`تم تجهيز القطعة ${idx + 1} من ${activeLayers.length}: ${layer.name}`);
          await new Promise(r => setTimeout(r, 0));
        }
      } else {
        // Fallback: Full Frame Bitmap Sequence Render
        setExportStatusText('جاري رندرة الإطارات المتتابعة...');
        const { dataUrls } = await captureAllFrames((p, msg) => {
          setExportProgress(Math.round(p * 0.7));
          setExportStatusText(msg);
        });

        for (let i = 0; i < total; i++) {
          const imageKey = `frame_${i}`;
          const base64 = dataUrls[i].split(',')[1];
          const binaryStr = atob(base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let b = 0; b < binaryStr.length; b++) {
            bytes[b] = binaryStr.charCodeAt(b);
          }
          images[imageKey] = bytes;

          const spriteFrames = [];
          for (let j = 0; j < total; j++) {
            spriteFrames.push({
              alpha: i === j ? 1.0 : 0.0,
              layout: { x: 0, y: 0, width: compSettings.width, height: compSettings.height },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
            });
          }

          sprites.push({
            imageKey: imageKey,
            frames: spriteFrames
          });
        }
      }

      setExportProgress(80);
      setExportStatusText('جاري ضغط وترميز ملف الـ SVGA...');

      const movie = {
        version: '2.0',
        params: {
          viewBoxWidth: compSettings.width,
          viewBoxHeight: compSettings.height,
          fps: compSettings.fps,
          frames: total
        },
        images: images,
        sprites: sprites
      };

      const errMsg = MovieEntity.verify(movie);
      if (errMsg) throw new Error(errMsg);

      const message = MovieEntity.create(movie);
      const encoded = MovieEntity.encode(message).finish();
      const compressed = pako.deflate(encoded, { level: 9 });

      const blob = new Blob([compressed], { type: 'application/octet-stream' });
      const filename = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.svga`;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();

      const rawFile = new File([blob], filename, { type: 'application/octet-stream' });
      const svgaFileExt: SVGAFileExtended = {
        name: filename,
        size: blob.size,
        type: 'application/octet-stream',
        lastModified: Date.now(),
        url: downloadUrl,
        rawFile: rawFile
      };
      setLastExportedSVGA(svgaFileExt);

      setExportProgress(100);
      setExportStatusText(
        svgaExportMode === 'pieces'
          ? 'تم تصدير ملف الـ SVGA (قطع عادي أصلي) بنجاح!'
          : 'تم تصدير ملف الـ SVGA (رندر إطارات) بنجاح!'
      );
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير SVGA: ' + err.message);
      setExporting(false);
    }
  };

  // 1.5. Export as Tencent VAP1.0 (True MP4 with Alpha mask & vapc box)
  const exportAsVAP10 = async () => {
    try {
      setExporting(true);
      setExportProgress(10);
      setExportStatusText('جاري رندرة إطارات المشروع لتصدير VAP1.0...');

      const { canvases } = await captureAllFrames((p, msg) => {
        setExportProgress(Math.round(p * 0.7));
        setExportStatusText(msg);
      });

      setExportProgress(75);
      setExportStatusText('جاري ترميز فيديو Tencent VAP1.0 مع قناع الشفافية وصندوق vapc...');

      const delays = new Array(canvases.length).fill(Math.round(1000 / compSettings.fps));
      const vapBlob = await exportAsVap(
        canvases,
        delays,
        compSettings.width,
        compSettings.height,
        compSettings.fps,
        '1.0',
        null,
        (p, msg) => {
          setExportProgress(75 + Math.round(p * 20));
          if (msg) setExportStatusText(msg);
        },
        100,
        'left-right' // Matches user screenshot: Left is full color RGB, Right is Alpha mask ("الحته البيضاء باليمين بجانب الهدية")
      );

      const filename = `${compSettings.name.replace(/\s+/g, '_')}_VAP1.0_${Date.now()}.mp4`;
      downloadBlob(vapBlob, filename);

      backgroundExportManager.registerCompletedJob({
        title: `تصدير VAP1.0 (${compSettings.name})`,
        fileName: filename,
        blob: vapBlob
      });

      setExportProgress(100);
      setExportStatusText('تم تصدير ملف VAP1.0 بنجاح!');
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير VAP1.0: ' + err.message);
      setExporting(false);
    }
  };

  // 2. Export as Transparent APNG
  const exportAsAPNG = async () => {
    try {
      setExporting(true);
      setExportProgress(5);
      setExportStatusText('جاري رندرة الإطارات لـ APNG...');

      const { canvases } = await captureAllFrames((p, msg) => {
        setExportProgress(p);
        setExportStatusText(msg);
      });

      setExportProgress(65);
      setExportStatusText('جاري تجميع فريمات APNG مع قنوات الشفافية...');

      const buffers: ArrayBuffer[] = [];
      const delays: number[] = [];
      const frameDelay = Math.round(1000 / compSettings.fps);

      for (let i = 0; i < canvases.length; i++) {
        const ctx = canvases[i].getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, compSettings.width, compSettings.height);
        buffers.push(imgData.data.buffer);
        delays.push(frameDelay);
      }

      setExportProgress(85);
      setExportStatusText('جاري تشفير ملف APNG...');

      const apngBuffer = UPNG.encode(buffers, compSettings.width, compSettings.height, 0, delays);
      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.click();

      setExportProgress(100);
      setExportStatusText('تم تصدير APNG الشفاف بنجاح!');
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير APNG: ' + err.message);
      setExporting(false);
    }
  };

  // 3. Export as Transparent GIF
  const exportAsGIF = async () => {
    try {
      setExporting(true);
      setExportProgress(5);
      setExportStatusText('جاري رندرة الإطارات للـ GIF...');

      const { canvases } = await captureAllFrames((p, msg) => {
        setExportProgress(p);
        setExportStatusText(msg);
      });

      setExportProgress(65);
      setExportStatusText('جاري تشفير ألوان الـ GIF الشفاف...');

      const gif = GIFEncoder();
      const delayMs = Math.round(1000 / compSettings.fps);
      const w = compSettings.width;
      const h = compSettings.height;

      for (let i = 0; i < canvases.length; i++) {
        const ctx = canvases[i].getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, w, h);
        const { data } = imgData;

        const palette = quantize(data, 256, { format: 'rgba4444' });
        const index = applyPalette(data, palette, 'rgba4444');

        gif.writeFrame(index, w, h, {
          palette,
          delay: delayMs,
          transparent: true,
          dispose: 2
        });
      }

      gif.finish();
      const bytes = gif.bytes();
      const blob = new Blob([bytes], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${compSettings.name.replace(/\s+/g, '_')}_${Date.now()}.gif`;
      link.click();

      setExportProgress(100);
      setExportStatusText('تم تصدير GIF بنجاح!');
      setTimeout(() => setExporting(false), 1200);
    } catch (err: any) {
      console.error(err);
      alert('خطأ أثناء تصدير GIF: ' + err.message);
      setExporting(false);
    }
  };

  // 4. Export AE ExtendScript (.jsx) with Full Alpha Matte & Keyframes Support
  const exportAsAEJSX = () => {
    const duration = (compSettings.totalFrames / compSettings.fps).toFixed(2);
    let jsx = `// Adobe After Effects Script Generated by After Effects Studio\n`;
    jsx += `app.beginUndoGroup("Create ${compSettings.name}");\n\n`;
    jsx += `var comp = app.project.items.addComp("${compSettings.name}", ${compSettings.width}, ${compSettings.height}, 1, ${duration}, ${compSettings.fps});\n`;
    jsx += `comp.bgColor = [0, 0, 0];\n`;
    jsx += `var layerMap = {};\n\n`;

    // 1. Create all layers in reverse order so stacking matches comp
    const reversedLayers = [...layers].reverse();

    reversedLayers.forEach((layer, idx) => {
      const sanitizedName = (layer.name || `Layer_${idx + 1}`).replace(/"/g, '\\"');
      const varName = `layer_${idx}`;
      const lw = layer.width || compSettings.width;
      const lh = layer.height || compSettings.height;

      jsx += `// --- Layer ${idx + 1}: ${sanitizedName} (${layer.kind}) ---\n`;
      if (layer.kind === 'shape') {
        jsx += `var ${varName} = comp.layers.addShape();\n`;
      } else if (layer.kind === 'text') {
        const textVal = (layer.text || 'TEXT').replace(/"/g, '\\"');
        jsx += `var ${varName} = comp.layers.addText("${textVal}");\n`;
      } else {
        // Image or Solid
        jsx += `var ${varName} = comp.layers.addSolid([0.8, 0.8, 0.8], "${sanitizedName}", ${lw}, ${lh}, 1);\n`;
      }

      jsx += `${varName}.name = "${sanitizedName}";\n`;
      jsx += `${varName}.enabled = ${layer.visible ? 'true' : 'false'};\n`;
      jsx += `${varName}.locked = ${layer.locked ? 'true' : 'false'};\n`;

      // Position Keyframes
      if (layer.positionKeyframes && layer.positionKeyframes.length > 0) {
        layer.positionKeyframes.forEach(kf => {
          const t = (kf.frame / compSettings.fps).toFixed(3);
          const px = (compSettings.width / 2 + kf.value.x).toFixed(1);
          const py = (compSettings.height / 2 + kf.value.y).toFixed(1);
          jsx += `${varName}.property("Transform").property("Position").setValueAtTime(${t}, [${px}, ${py}]);\n`;
        });
      } else {
        const px = (compSettings.width / 2 + layer.position.x).toFixed(1);
        const py = (compSettings.height / 2 + layer.position.y).toFixed(1);
        jsx += `${varName}.property("Transform").property("Position").setValue([${px}, ${py}]);\n`;
      }

      // Scale Keyframes
      if (layer.scaleKeyframes && layer.scaleKeyframes.length > 0) {
        layer.scaleKeyframes.forEach(kf => {
          const t = (kf.frame / compSettings.fps).toFixed(3);
          jsx += `${varName}.property("Transform").property("Scale").setValueAtTime(${t}, [${kf.value}, ${kf.value}]);\n`;
        });
      } else {
        jsx += `${varName}.property("Transform").property("Scale").setValue([${layer.scale}, ${layer.scale}]);\n`;
      }

      // Rotation Keyframes
      if (layer.rotationKeyframes && layer.rotationKeyframes.length > 0) {
        layer.rotationKeyframes.forEach(kf => {
          const t = (kf.frame / compSettings.fps).toFixed(3);
          jsx += `${varName}.property("Transform").property("Rotation").setValueAtTime(${t}, ${kf.value});\n`;
        });
      } else if (layer.animatingRotation) {
        jsx += `${varName}.property("Transform").property("Rotation").setValueAtTime(0, ${layer.rotation});\n`;
        jsx += `${varName}.property("Transform").property("Rotation").setValueAtTime(${duration}, ${layer.rotation + 360});\n`;
      } else {
        jsx += `${varName}.property("Transform").property("Rotation").setValue(${layer.rotation});\n`;
      }

      // Opacity Keyframes
      if (layer.opacityKeyframes && layer.opacityKeyframes.length > 0) {
        layer.opacityKeyframes.forEach(kf => {
          const t = (kf.frame / compSettings.fps).toFixed(3);
          jsx += `${varName}.property("Transform").property("Opacity").setValueAtTime(${t}, ${kf.value});\n`;
        });
      } else {
        jsx += `${varName}.property("Transform").property("Opacity").setValue(${layer.opacity});\n`;
      }

      jsx += `layerMap["${layer.id}"] = ${varName};\n\n`;
    });

    // 2. Set Track Matte for Alpha Matte masked pieces & Parent linking
    layers.forEach(layer => {
      if (layer.clipToLayerId) {
        jsx += `// Set Alpha Track Matte for Masked Layer: ${layer.name}\n`;
        jsx += `if (layerMap["${layer.id}"] && layerMap["${layer.clipToLayerId}"]) {\n`;
        jsx += `    try {\n`;
        jsx += `        layerMap["${layer.id}"].setTrackMatte(layerMap["${layer.clipToLayerId}"], TrackMatteType.ALPHA);\n`;
        jsx += `        layerMap["${layer.id}"].parent = layerMap["${layer.clipToLayerId}"];\n`;
        jsx += `    } catch (e) {}\n`;
        jsx += `}\n\n`;
      }
    });

    jsx += `app.endUndoGroup();\n`;

    const blob = new Blob([jsx], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${compSettings.name}.jsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Render Composition Settings Window
  const renderCompSettingsContent = (isInitial: boolean) => (
    <div className="w-full max-w-xl bg-slate-900/65 border border-slate-800/80 rounded-3xl p-6 sm:p-7 text-slate-200 flex flex-col gap-5 relative shadow-2xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5 relative z-10">
        <div className="flex items-center gap-2.5 font-bold text-base text-violet-300">
          <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-lg font-mono text-xs border border-violet-500/30">
            Ae
          </span>
          <span>Composition Settings</span>
        </div>
        {!isInitial ? (
          <button
            type="button"
            onClick={() => setShowCompSettingsModal(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        ) : (
          (onCancel || onClose) && (
            <button
              type="button"
              onClick={onCancel || onClose}
              className="px-2.5 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer border border-white/10"
              title="الرجوع للرئيسية"
            >
              <span>الرئيسية</span>
              <X size={14} />
            </button>
          )
        )}
      </div>

      {/* Validation Error Message */}
      {compSettingsError && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold relative z-10 animate-shake">
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <span>{compSettingsError}</span>
        </div>
      )}

      {/* Inputs Form */}
      <div className="flex flex-col gap-3 text-xs relative z-10">
        {/* File Upload Dropzone for auto dimensions & naming */}
        <div className="p-4 bg-purple-950/20 hover:bg-purple-950/30 border-2 border-dashed border-purple-500/40 hover:border-purple-400 rounded-2xl flex flex-col items-center justify-center text-center gap-2 transition-all group relative cursor-pointer min-h-[90px]">
          <input
            type="file"
            accept=".svga,image/*"
            onChange={handleFileImport}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            title=""
          />
          {isReadingFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
              <span className="text-[11px] font-bold text-purple-300">جاري قراءة الملف وتحديد المقاسات...</span>
            </div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
              <div className="text-xs font-black text-purple-200">
                اسحب وأسقط أو اختر ملف (.svga) أو صورة (.png, .jpg)
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                سيتم قراءة الأبعاد والاسم تلقائياً من الملف المرفوع وتطبيقها فوراً في الإعدادات
              </div>
            </>
          )}
        </div>

        {/* Name */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-slate-300 w-32 font-medium">اسم الكومبوزيشن:</label>
          <input
            type="text"
            value={modalName}
            onChange={(e) => setModalName(e.target.value)}
            className="flex-1 bg-slate-800/40 border border-slate-700/50 px-3 py-2 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-violet-500/60"
          />
        </div>

        {/* Width & Height + Presets */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-300 font-bold text-xs">الأبعاد والمقاسات القياسية المعتادة:</label>
            <span className="text-[10px] text-violet-300 font-bold">اختر من المقاسات الجاهزة المرتبة</span>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {PRESET_RESOLUTIONS.map((preset, idx) => {
              const isSelected = Number(modalWidth) === preset.width && Number(modalHeight) === preset.height;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setModalWidth(preset.width);
                    setModalHeight(preset.height);
                    if (compSettingsError) setCompSettingsError(null);
                  }}
                  className={`p-2 rounded-xl text-right transition-all border ${
                    isSelected
                      ? 'bg-violet-600/30 border-violet-500 text-white font-bold shadow-sm'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="font-mono text-xs font-black text-white">{preset.width} × {preset.height}</div>
                  <div className="text-[9px] text-slate-400 truncate">{preset.label.split('(')[1]?.replace(')', '') || preset.label}</div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="text-slate-300 w-32 font-medium">أبعاد مخصصة:</label>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="number"
                value={modalWidth}
                onChange={(e) => {
                  const val = e.target.value;
                  setModalWidth(val === '' ? '' : Number(val));
                  if (compSettingsError) setCompSettingsError(null);
                }}
                className={`w-full bg-slate-800/40 border px-3 py-2 rounded-xl text-slate-100 text-xs font-mono focus:outline-none transition-all ${
                  compSettingsError && (modalWidth === '' || Number(modalWidth) <= 0)
                    ? 'border-red-500/70 focus:border-red-500 ring-1 ring-red-500/30'
                    : 'border-slate-700/50 focus:border-violet-500/60'
                }`}
                placeholder="العرض (px)"
              />
              <span className="text-slate-500">×</span>
              <input
                type="number"
                value={modalHeight}
                onChange={(e) => {
                  const val = e.target.value;
                  setModalHeight(val === '' ? '' : Number(val));
                  if (compSettingsError) setCompSettingsError(null);
                }}
                className={`w-full bg-slate-800/40 border px-3 py-2 rounded-xl text-slate-100 text-xs font-mono focus:outline-none transition-all ${
                  compSettingsError && (modalHeight === '' || Number(modalHeight) <= 0)
                    ? 'border-red-500/70 focus:border-red-500 ring-1 ring-red-500/30'
                    : 'border-slate-700/50 focus:border-violet-500/60'
                }`}
                placeholder="الارتفاع (px)"
              />
              <span className="text-slate-400 font-mono text-[11px]">px</span>
            </div>
          </div>
        </div>

        {/* Frame Rate (FPS) */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-slate-300 w-32 font-medium">معدل الفريمات (FPS):</label>
          <div className="flex-1 flex items-center gap-2">
            {[24, 30, 60].map(rate => (
              <button
                key={rate}
                type="button"
                onClick={() => handleFpsChange(rate)}
                className={`flex-1 py-1.5 rounded-lg font-mono text-xs transition-all border ${
                  modalFps === rate
                    ? 'bg-violet-600/30 border-violet-500/50 text-violet-200 font-bold'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {rate} FPS
              </button>
            ))}
          </div>
        </div>

        {/* Duration in Seconds & Total Frames Box */}
        <div className="p-3.5 bg-slate-800/40 rounded-2xl border border-slate-700/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Duration in Seconds */}
            <div>
              <label className="text-emerald-300 font-bold block text-xs mb-1">
                مدة المشروع بالثواني (Duration Sec):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={modalDurationSec}
                  onChange={(e) => handleDurationSecChange(Number(e.target.value))}
                  className="w-full bg-slate-900/80 border border-emerald-500/40 px-3 py-1.5 rounded-xl text-emerald-300 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute left-3 top-2 text-[10px] text-emerald-400 font-bold">ثانية</span>
              </div>
            </div>

            {/* Total Frames */}
            <div>
              <label className="text-violet-300 font-bold block text-xs mb-1">
                عدد الفريمات (Total Frames):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={modalTotalFrames}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setModalTotalFrames('');
                    } else {
                      handleTotalFramesChange(Number(val));
                    }
                  }}
                  className="w-full bg-slate-900/80 border border-violet-500/40 px-3 py-1.5 rounded-xl text-violet-200 text-xs font-mono font-bold focus:outline-none focus:border-violet-400"
                />
                <span className="absolute left-3 top-2 text-[10px] text-violet-400 font-bold">فريم</span>
              </div>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-violet-950/30 border border-violet-500/20 text-[11px] font-bold text-violet-200 flex items-center justify-between">
            <span>المدة الإجمالية:</span>
            <span className="font-mono text-emerald-300 font-black">
              {modalDurationSec} ثانية • {modalTotalFrames} فريم (@ {modalFps} fps)
            </span>
          </div>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 relative z-10">
        {!isInitial && (
          <button
            type="button"
            onClick={() => setShowCompSettingsModal(false)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
          >
            إلغاء
          </button>
        )}
        <button
          type="button"
          onClick={handleCreateComposition}
          className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/45 border border-violet-500/50 hover:border-violet-400/70 text-violet-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          <Check size={16} className="text-emerald-300" />
          <span>تطبيق التعديلات ونقل المشروع 🚀</span>
        </button>
      </div>
    </div>
  );

  // Render an individual keyframe diamond in timeline tracks with double-click / drag repositioning
  const renderKeyframeDiamond = (
    layer: AELayer,
    property: 'position' | 'scale' | 'rotation' | 'opacity',
    kf: Keyframe<any>,
    index: number,
    colorBg: string,
    label: string
  ) => {
    const isDragging = Boolean(
      draggingKeyframe &&
      draggingKeyframe.layerId === layer.id &&
      draggingKeyframe.property === property &&
      draggingKeyframe.originalFrame === kf.frame
    );
    const displayFrame = isDragging && draggingKeyframe ? draggingKeyframe.currentDragFrame : kf.frame;

    return (
      <div
        key={`${property}-${index}-${kf.frame}`}
        style={{ left: getTimelineLeftPercent(displayFrame) }}
        title={isDragging ? `تحريك إلى فريم ${displayFrame}` : `انقر مرتين أو اسحب لتحريك المفتاح (فريم ${kf.frame} - ${label})`}
        className={`absolute -translate-x-1/2 select-none ${
          isDragging
            ? 'z-30 cursor-grabbing'
            : 'z-10 cursor-grab'
        }`}
        onMouseDown={(e) => handleKeyframeMouseDown(layer.id, property, kf.frame, e)}
        onDoubleClick={(e) => handleKeyframeDoubleClick(layer.id, property, kf.frame, e)}
      >
        <div className={`w-2.5 h-2.5 rotate-45 border border-slate-900 shadow-md ${colorBg}`} />
      </div>
    );
  };

  // When no project is loaded yet, show ONLY the popup window itself without black backdrop!
  if (!hasProject) {
    return (
      <div className="w-full flex items-start justify-center pt-6 sm:pt-10 pb-16 px-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-xl"
        >
          {renderCompSettingsContent(true)}
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-[1360px] mx-auto flex flex-col min-h-[85vh] lg:h-[calc(100vh-84px)] lg:min-h-[720px] lg:max-h-[860px] bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden shadow-2xl text-slate-200 select-none pb-14 lg:pb-0 relative"
    >
      
      {/* ----------------- TOP AE MENU BAR & TOOLBAR ----------------- */}
      <div className="h-11 border-b border-slate-800/50 bg-slate-900/50 px-2 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 text-xs overflow-x-auto no-scrollbar">
        {/* Left Side: Logo & AE Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {(onCancel || onClose) && (
            <button
              onClick={onCancel || onClose}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="الرجوع إلى الصفحة الرئيسية للموقع"
            >
              <ArrowLeft size={13} className="text-violet-400" />
              <span className="hidden sm:inline">الرئيسية</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2 font-bold text-violet-400 shrink-0">
            <span className="bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded font-mono text-[11px] border border-violet-500/40">Ae</span>
            <span className="font-semibold tracking-wide text-slate-200 text-[11px] sm:text-xs">AFTER EFFECTS STUDIO</span>
          </div>
        </div>

        {/* Right Side: Export Action & Layers Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Hidden general layer import input */}
          <input 
            ref={importGeneralLayerInputRef}
            type="file" 
            accept="image/*,.svga" 
            onChange={handleUploadAsset} 
            className="hidden" 
          />

          {/* زر استدعاء طبقات */}
          <button
            type="button"
            onClick={() => importGeneralLayerInputRef.current?.click()}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 hover:text-white border border-violet-500/40 text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
            title="استدعاء واستيراد طبقات إضافية إلى المشروع"
          >
            <Upload size={13} className="text-violet-300" />
            <span className="hidden sm:inline">استدعاء طبقات</span>
          </button>

          {/* زر الطبقات */}
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                setAeMobileTab('layers');
              } else {
                const el = document.querySelector('.layers-panel-container');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
            title="إدارة وقائمة الطبقات"
          >
            <Layers size={13} className="text-amber-400" />
            <span>طبقات ({layers.length})</span>
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            disabled={!hasProject}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-bold transition-all disabled:opacity-40 active:scale-[0.98] shrink-0"
          >
            <Download size={13} />
            <span className="hidden sm:inline">تصدير (Export)</span>
            <span className="sm:hidden">تصدير</span>
          </button>
        </div>
      </div>

      {/* ----------------- MAIN WORKSPACE (VIEWPORT & SIDEBARS) ----------------- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Project & Layer Controls */}
        <div className={`border-r border-slate-800/50 bg-slate-900/20 flex-col text-xs ${isMobile ? (aeMobileTab === 'layers' ? 'flex w-full flex-1 overflow-y-auto' : 'hidden') : 'flex w-64'}`}>
          {/* Panel Header */}
          <div className="p-2.5 border-b border-slate-800/60 flex items-center justify-between text-slate-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Film size={13} className="text-violet-400" />
              <span>Project</span>
            </div>
            <button 
              onClick={() => setShowCompSettingsModal(true)}
              className="p-1 hover:text-white rounded"
              title="Settings"
            >
              <Settings size={13} />
            </button>
          </div>

          {/* Project Info Card */}
          <div className="p-3 bg-slate-800/25 border-b border-slate-800/50 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الاسم:</span>
              <span className="font-bold text-slate-200">{compSettings.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الأبعاد:</span>
              <span className="font-mono text-emerald-400">{compSettings.width} × {compSettings.height} px</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">الفريمات:</span>
              <span className="font-mono text-cyan-400">{compSettings.totalFrames} f ({compSettings.fps} fps)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">المدة:</span>
              <span className="font-mono text-amber-400">{(compSettings.totalFrames / compSettings.fps).toFixed(2)} ثانية</span>
            </div>
          </div>

          {/* Add Layer Quick Bar */}
          <div className="p-2 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-slate-400 font-bold text-[11px]">إضافة طبقة:</span>
            <div className="flex items-center gap-1.5">
              <label
                title="استدعاء واستيراد طبقات جديدة"
                className="p-1 px-2.5 rounded bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 hover:text-white border border-violet-500/40 cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-all shadow-sm"
              >
                <Upload size={11} className="text-violet-300" />
                <span>استدعاء طبقات</span>
                <input type="file" accept="image/*,.svga" onChange={handleUploadAsset} className="hidden" />
              </label>
              <label
                title="استيراد صورة كطبقة"
                className="p-1 px-2 rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white cursor-pointer flex items-center gap-1 text-[10px]"
              >
                <Upload size={11} className="text-emerald-400" />
                <span>صورة</span>
                <input type="file" accept="image/*" onChange={handleUploadAsset} className="hidden" />
              </label>
            </div>
          </div>

          {/* Layer List (Quick Selection & Drag Reorder) */}
          <div 
            className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-1 layers-panel-container"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
          >
            {layers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
                <Layers size={24} className="opacity-40" />
                <span>لا توجد طبقات بعد.</span>
                <span className="text-[10px]">اضغط على استيراد صورة للبدء في تصميم وتحريك إطارك.</span>
              </div>
            ) : (
              <>
                {layers.map((layer, idx) => {
                  const isDragging = draggedLayerIdx === idx;
                  const isDropTarget = dropTargetIdx === idx;

                  return (
                    <div
                      key={layer.id}
                      draggable={!layer.locked}
                      onDragStart={(e) => {
                        setDraggedLayerIdx(idx);
                        e.dataTransfer.setData('text/plain', String(idx));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        const rect = e.currentTarget.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const pos = e.clientY < midY ? 'above' : 'below';
                        if (dropTargetIdx !== idx || dropPosition !== pos) {
                          setDropTargetIdx(idx);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          if (dropTargetIdx === idx) {
                            setDropTargetIdx(null);
                            setDropPosition(null);
                          }
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (draggedLayerIdx !== null) {
                          let targetIndex = idx;
                          if (dropPosition === 'below') {
                            targetIndex = idx + 1;
                          }
                          if (draggedLayerIdx < targetIndex) {
                            targetIndex -= 1;
                          }
                          reorderLayers(draggedLayerIdx, targetIndex);
                        }
                        setDraggedLayerIdx(null);
                        setDropTargetIdx(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedLayerIdx(null);
                        setDropTargetIdx(null);
                        setDropPosition(null);
                      }}
                      onClick={() => setSelectedLayerId(layer.id)}
                      data-interactive="true"
                      className={`layer-row-item relative group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all border ${
                        isDragging
                          ? 'opacity-30 border-dashed border-cyan-400 bg-slate-800/40'
                          : selectedLayerId === layer.id
                            ? 'bg-violet-600/20 border-violet-500/40 text-violet-200 shadow-sm'
                            : 'bg-slate-800/25 border-transparent hover:bg-slate-800/40 text-slate-400'
                      }`}
                    >
                      {/* Visual Drop Indicators */}
                      {isDropTarget && dropPosition === 'above' && (
                        <div className="absolute -top-0.5 left-1 right-1 h-0.5 bg-cyan-400 rounded-full z-30 pointer-events-none"></div>
                      )}
                      {isDropTarget && dropPosition === 'below' && (
                        <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-cyan-400 rounded-full z-30 pointer-events-none"></div>
                      )}

                      <div className="flex items-center gap-1.5 truncate">
                        {/* Drag Handle Grip */}
                        <div 
                          className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5 shrink-0"
                          title="اسحب لتغيير ترتيب الطبقة في مساحة العمل"
                        >
                          <GripVertical size={12} />
                        </div>

                        {/* Stacking Order Number */}
                        <span className="text-[10px] text-slate-500 font-mono w-3.5 text-center shrink-0">
                          {idx + 1}
                        </span>

                        {/* Thumbnail Image / Shape Icon */}
                        <div className="w-5 h-5 rounded bg-slate-950/80 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                          {layer.kind === 'image' && layer.imageSrc ? (
                            <img src={layer.imageSrc} alt="" className="w-full h-full object-contain pointer-events-none" />
                          ) : layer.kind === 'shape' ? (
                            <div className="w-2.5 h-2.5 rounded-full border border-amber-400 bg-amber-400/30" />
                          ) : (
                            <Layers size={10} className="text-slate-400" />
                          )}
                        </div>

                        {/* Visibility Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                          }}
                          className="p-0.5 text-slate-500 hover:text-slate-200 shrink-0"
                          title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                        >
                          {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-slate-400" />}
                        </button>

                        <span className="truncate font-medium text-[11px] select-none">{layer.name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateLayer(layer);
                          }}
                          title="مضاعفة الطبقة"
                          className="p-1 hover:text-white opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLayer(layer.id);
                          }}
                          title="حذف الطبقة"
                          className="p-1 hover:text-red-400 opacity-40 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Drop target at bottom of list */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTargetIdx !== layers.length - 1 || dropPosition !== 'below') {
                      setDropTargetIdx(layers.length - 1);
                      setDropPosition('below');
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedLayerIdx !== null) {
                      reorderLayers(draggedLayerIdx, layers.length - 1);
                    }
                    setDraggedLayerIdx(null);
                    setDropTargetIdx(null);
                    setDropPosition(null);
                  }}
                  className="h-3"
                />
              </>
            )}
          </div>
        </div>

        {/* CENTER VIEWPORT (Composition Monitor) */}
        <div className={`bg-transparent relative overflow-hidden ${isMobile ? (aeMobileTab === 'viewport' ? 'flex flex-col flex-1 w-full min-h-[50vh]' : 'hidden') : 'flex flex-col flex-1'}`}>
          {/* Monitor Header Toolbar */}
          <div className="h-9 border-b border-slate-800/50 bg-slate-900/30 px-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-slate-300 font-bold bg-slate-800/50 px-2 py-0.5 rounded">
                {compSettings.name}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {compSettings.width} × {compSettings.height} px
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTool('select')}
                title="أداة التحديد / السهم (V)"
                className={`p-1.5 rounded transition-all ${activeTool === 'select' ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'text-slate-500 hover:text-white'}`}
              >
                <MousePointer size={13} />
              </button>

              <button
                onClick={() => setActiveTool(activeTool === 'hand' ? 'select' : 'hand')}
                title="أداة اليد لتحريك العرض (H)"
                className={`p-1.5 rounded transition-all ${activeTool === 'hand' ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40' : 'text-slate-500 hover:text-white'}`}
              >
                <Hand size={13} />
              </button>

              <button
                onClick={() => setShowTransparencyGrid(!showTransparencyGrid)}
                title="تبديل رقعة الشفافية (Transparency Grid)"
                className={`p-1.5 rounded transition-all ${showTransparencyGrid ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30' : 'text-slate-500 hover:text-white'}`}
              >
                <Grid size={13} />
              </button>

              <div className="w-px h-3.5 bg-slate-800"></div>

              {/* After Effects Style Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60">
                <button
                  onClick={fitToView}
                  title="ملاءمة الشاشة بالكامل (Fit) - يملأ مساحة العمل بوضوح مثل After Effects"
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 border border-violet-500/30 transition-all flex items-center gap-1"
                >
                  <Maximize2 size={11} />
                  <span>Fit</span>
                </button>

                {(() => {
                  const roundedZoom = Math.round(zoomLevel * 100);
                  const standardZooms = [25, 50, 75, 100];
                  const isStandard = standardZooms.includes(roundedZoom);
                  return (
                    <select
                      value={isStandard ? roundedZoom : 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'fit') {
                          fitToView();
                        } else {
                          setZoomLevel(Math.min(1.0, Number(val) / 100));
                        }
                      }}
                      title="قائمة نسب التكبير (Zoom %)"
                      className="bg-slate-900/80 border border-slate-700/80 rounded px-1.5 py-0.5 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="fit">Fit (ملاءمة)</option>
                      {!isStandard && (
                        <option value="custom">{roundedZoom}%</option>
                      )}
                      <option value="25">25%</option>
                      <option value="50">50%</option>
                      <option value="75">75%</option>
                      <option value="100">100% (أصلي 1:1)</option>
                    </select>
                  );
                })()}

                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.15, Number((prev * 0.8).toFixed(2))))}
                  className="p-1 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded transition-colors"
                  title="تصغير (Zoom Out)"
                >
                  <ZoomOut size={13} />
                </button>

                <button
                  onClick={() => setZoomLevel(1)}
                  title="الحجم الأصلي الفعلي 100% (1:1)"
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    Math.round(zoomLevel * 100) === 100
                      ? 'bg-violet-600/30 text-violet-200 font-bold border border-violet-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  100%
                </button>

                <button
                  onClick={() => setZoomLevel(prev => Math.min(1.0, Number((prev * 1.25).toFixed(2))))}
                  disabled={zoomLevel >= 1}
                  className={`p-1 rounded transition-colors ${
                    zoomLevel >= 1
                      ? 'text-slate-600 cursor-not-allowed opacity-40'
                      : 'hover:text-white text-slate-400 hover:bg-slate-700/50'
                  }`}
                  title="تكبير (Zoom In - بحد أقصى 100%)"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Work Area Stage */}
          <div 
            ref={stageContainerRef} 
            className={`flex-1 flex items-center justify-center p-6 overflow-auto bg-transparent ${activeTool === 'hand' ? (isPanning ? 'cursor-grabbing select-none' : 'cursor-grab') : ''}`}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
          >
            <div 
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease-out',
                width: compSettings.width,
                height: compSettings.height
              }}
              className="relative shadow-2xl border border-slate-700/60 rounded-lg overflow-hidden shrink-0 bg-black"
            >
              <canvas
                ref={canvasRef}
                width={compSettings.width}
                height={compSettings.height}
                onMouseDown={handleCanvasMouseDown}
                className={`w-full h-full block bg-black ${
                  activeTool === 'select'
                    ? (isDraggingLayer ? 'cursor-grabbing select-none' : (selectedLayerId ? 'cursor-move' : 'cursor-default'))
                    : ''
                }`}
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Properties / Transform Inspector */}
        <div data-interactive="true" className={`properties-inspector border-l border-slate-800/50 bg-slate-900/20 text-xs overflow-y-auto ${isMobile ? (aeMobileTab === 'properties' ? 'flex flex-col flex-1 w-full' : 'hidden') : 'flex flex-col w-72'}`}>
          <div className="p-2.5 border-b border-slate-800/60 flex items-center justify-between text-slate-400 font-bold">
            <div className="flex items-center gap-1.5">
              <Sliders size={13} className="text-violet-400" />
              <span>خصائص الطبقة (Properties)</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
            {selectedLayer ? (
              <>
                {/* Layer Name & Kind */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400">اسم الطبقة</label>
                  <input
                    type="text"
                    value={selectedLayer.name}
                    onChange={(e) => updateSelectedLayer({ name: e.target.value })}
                    className="w-full bg-slate-800/40 border border-slate-700/50 px-2.5 py-1.5 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>



                {/* Clipped Layer Status Info */}
                {selectedLayer.clipToLayerId && (
                  <div className="p-2.5 rounded-lg bg-violet-950/20 border border-violet-500/30 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-violet-300 font-bold">
                      <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
                      <span>مدمجة كقناع داخل: <strong className="text-white">{layers.find(l => l.id === selectedLayer.clipToLayerId)?.name || 'الطبقة الأصلية'}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ clipToLayerId: undefined, blendMode: 'source-over' })}
                      className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                      title="فك ارتباط القناع"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Layer Stacking Order */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>ترتيب الظهور (Stacking Order)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      #{layers.findIndex(l => l.id === selectedLayer.id) + 1} من {layers.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => bringLayerToFront(selectedLayer.id)}
                      disabled={layers[0]?.id === selectedLayer.id}
                      title="نقل للأمام تماماً (أعلى كل الطبقات)"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ChevronsUp size={12} className="text-violet-400" />
                      <span>في المقدمة</span>
                    </button>
                    <button
                      onClick={() => moveLayerUp(selectedLayer.id)}
                      disabled={layers[0]?.id === selectedLayer.id}
                      title="تقديم خطوة واحدة للأمام"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ArrowUp size={12} className="text-cyan-400" />
                      <span>خطوة للأمام</span>
                    </button>
                    <button
                      onClick={() => moveLayerDown(selectedLayer.id)}
                      disabled={layers[layers.length - 1]?.id === selectedLayer.id}
                      title="تأخير خطوة واحدة للخلف"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ArrowDown size={12} className="text-amber-400" />
                      <span>خطوة للخلف</span>
                    </button>
                    <button
                      onClick={() => sendLayerToBack(selectedLayer.id)}
                      disabled={layers[layers.length - 1]?.id === selectedLayer.id}
                      title="نقل للخلفية تماماً (أسفل كل الطبقات)"
                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-slate-800/60 hover:bg-violet-600/30 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-slate-700/40 hover:border-violet-500/40 text-[11px]"
                    >
                      <ChevronsDown size={12} className="text-pink-400" />
                      <span>في الخلفية</span>
                    </button>
                  </div>
                </div>

                {/* Transform Section */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span>التحويل (Transform)</span>
                  </div>

                  {/* Position */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('position')}
                        title="تفعيل/تعطيل التحريك بالساعة (Position Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingPosition ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingPosition && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('position')}
                          title={hasKeyframeAtCurrentFrame('position') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('position') ? 'bg-emerald-400 border-emerald-300' : 'border-slate-500 hover:border-emerald-400'
                          }`} />
                        </button>
                      )}
                      <span>الموضع (X, Y)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumericInput
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).pos.x)}
                        onChange={(val) => {
                          const curY = evaluateLayerAtFrame(selectedLayer, currentFrame).pos.y;
                          updateLayerPropertyValue('position', { x: val, y: curY });
                        }}
                        defaultValue={0}
                        placeholder="X"
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <NumericInput
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).pos.y)}
                        onChange={(val) => {
                          const curX = evaluateLayerAtFrame(selectedLayer, currentFrame).pos.x;
                          updateLayerPropertyValue('position', { x: curX, y: val });
                        }}
                        defaultValue={0}
                        placeholder="Y"
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('scale')}
                        title="تفعيل التحريك بالحجم (Scale Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingScale ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingScale && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('scale')}
                          title={hasKeyframeAtCurrentFrame('scale') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('scale') ? 'bg-cyan-400 border-cyan-300' : 'border-slate-500 hover:border-cyan-400'
                          }`} />
                        </button>
                      )}
                      <span>الحجم (Scale %)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumericInput
                        min={1}
                        max={500}
                        defaultValue={100}
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).scale)}
                        onChange={(val) => updateLayerPropertyValue('scale', val)}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Rotation */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('rotation')}
                        title="تفعيل الدوران بالساعة (Rotation Stopwatch)"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingRotation ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingRotation && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('rotation')}
                          title={hasKeyframeAtCurrentFrame('rotation') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('rotation') ? 'bg-amber-400 border-amber-300' : 'border-slate-500 hover:border-amber-400'
                          }`} />
                        </button>
                      )}
                      <span>الدوران (Rotation)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumericInput
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).rotation)}
                        onChange={(val) => updateLayerPropertyValue('rotation', val)}
                        defaultValue={0}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-[10px]">°</span>
                    </div>
                  </div>

                  {/* Opacity */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => toggleStopwatch('opacity')}
                        title="تفعيل الشفافية بالساعة"
                        className={`p-1 rounded transition-colors ${selectedLayer.animatingOpacity ? 'text-amber-400 bg-amber-500/20' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Clock size={12} />
                      </button>
                      {selectedLayer.animatingOpacity && (
                        <button
                          onClick={() => toggleKeyframeAtCurrentFrame('opacity')}
                          title={hasKeyframeAtCurrentFrame('opacity') ? "إزالة نقطة الكي فريم في هذا الفريم" : "إضافة نقطة كي فريم في موضع الخط الحالي"}
                          className="p-0.5 rounded hover:bg-slate-800/60 transition-colors"
                        >
                          <div className={`w-2 h-2 rotate-45 border transition-colors ${
                            hasKeyframeAtCurrentFrame('opacity') ? 'bg-purple-400 border-purple-300' : 'border-slate-500 hover:border-purple-400'
                          }`} />
                        </button>
                      )}
                      <span>الشفافية (Opacity)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <NumericInput
                        min={0}
                        max={100}
                        defaultValue={100}
                        value={Math.round(evaluateLayerAtFrame(selectedLayer, currentFrame).opacity)}
                        onChange={(val) => updateLayerPropertyValue('opacity', val)}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-[10px]">%</span>
                    </div>
                  </div>
                </div>

                {/* Specific Shape / Text Styling */}
                {selectedLayer.kind === 'shape' && (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-300 font-bold">محددات الإطار والشكل</span>
                    
                    {selectedLayer.shapeKind === 'ring' && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">نصف القطر الخارجي</span>
                          <NumericInput
                            value={selectedLayer.outerRadius || 180}
                            defaultValue={180}
                            min={10}
                            onChange={(val) => updateSelectedLayer({ outerRadius: val })}
                            className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">نصف القطر الداخلي</span>
                          <NumericInput
                            value={selectedLayer.innerRadius || 150}
                            defaultValue={150}
                            min={5}
                            onChange={(val) => updateSelectedLayer({ innerRadius: val })}
                            className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">سماكة الخط (Stroke)</span>
                      <NumericInput
                        value={selectedLayer.strokeWidth || 8}
                        defaultValue={8}
                        min={1}
                        max={100}
                        onChange={(val) => updateSelectedLayer({ strokeWidth: val })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون الإطار</span>
                      <input
                        type="color"
                        value={selectedLayer.strokeColor || '#f59e0b'}
                        onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">توهج النيون (Glow)</span>
                      <NumericInput
                        min={0}
                        max={80}
                        defaultValue={0}
                        value={selectedLayer.glowRadius || 0}
                        onChange={(val) => updateSelectedLayer({ glowRadius: val })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون التوهج</span>
                      <input
                        type="color"
                        value={selectedLayer.glowColor || '#fbbf24'}
                        onChange={(e) => updateSelectedLayer({ glowColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {selectedLayer.kind === 'text' && (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-300 font-bold">خصائص النص</span>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">المحتوى</label>
                      <input
                        type="text"
                        value={selectedLayer.text || ''}
                        onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                        className="w-full bg-slate-800/40 border border-slate-700/50 px-2 py-1 rounded text-slate-200 text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">حجم الخط</span>
                      <NumericInput
                        value={selectedLayer.fontSize || 32}
                        defaultValue={32}
                        min={8}
                        max={200}
                        onChange={(val) => updateSelectedLayer({ fontSize: val })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">لون النص</span>
                      <input
                        type="color"
                        value={selectedLayer.fontColor || '#ffffff'}
                        onChange={(e) => updateSelectedLayer({ fontColor: e.target.value })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {selectedLayer.kind === 'image' && (
                  <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-800/60">
                    <span className="text-slate-300 font-bold">تلوين وتظليل الطبقة (Image Tint)</span>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">تفعيل التلوين (Tint Color)</span>
                      <input
                        type="color"
                        value={selectedLayer.tintColor || '#ffd700'}
                        onChange={(e) => updateSelectedLayer({ tintColor: e.target.value, tintOpacity: selectedLayer.tintOpacity !== undefined ? selectedLayer.tintOpacity : 60 })}
                        className="w-8 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">قوة اللون (Opacity %)</span>
                      <NumericInput
                        min={0}
                        max={100}
                        defaultValue={60}
                        value={selectedLayer.tintOpacity !== undefined ? selectedLayer.tintOpacity : 60}
                        onChange={(val) => updateSelectedLayer({ tintOpacity: val })}
                        className="w-16 bg-slate-800/40 border border-slate-700/50 px-1.5 py-1 rounded text-right text-[11px] font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {/* Quick color preset chips */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <span className="text-[10px] text-slate-500">ألوان وتوهجات سريعة:</span>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { name: 'ذهب 👑', hex: '#ffd700' },
                          { name: 'ياقوت 🔴', hex: '#ef4444' },
                          { name: 'زمرد 🟢', hex: '#10b981' },
                          { name: 'ياقوت أزرق 🔵', hex: '#3b82f6' },
                          { name: 'بنفسجي 🟣', hex: '#a855f7' },
                          { name: 'وردي 💖', hex: '#ec4899' },
                          { name: 'برتقالي 🟧', hex: '#f97316' }
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => updateSelectedLayer({ tintColor: preset.hex, tintOpacity: 60 })}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-white/5 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.hex }} />
                            <span>{preset.name}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => updateSelectedLayer({ tintColor: undefined, tintOpacity: undefined })}
                          className="px-2 py-1 rounded bg-red-950/20 hover:bg-red-900/30 text-[10px] text-red-300 border border-red-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          إلغاء التلوين ❌
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ⭐️ كارت طبقة إضافية مدمجة (Alpha Matte) ⭐️ */}
                <div className="flex flex-col gap-2.5 p-3.5 bg-gradient-to-b from-[#1e1338]/90 to-[#120b24]/95 rounded-2xl border border-violet-500/40 shadow-lg shadow-violet-950/40 mt-1">
                  <input
                    ref={additionalLayerFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadMaskedChildLayer}
                    className="hidden"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300">
                      <Layers size={13} className="text-violet-400" />
                      <span>طبقة إضافية مدمجة (Alpha Matte)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => additionalLayerFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-600/30 cursor-pointer"
                  >
                    <span>إضافة قطعة مدمجة</span>
                    <Upload size={14} />
                  </button>

                  {/* قائمة بالقطع المدمجة داخل هذه الطبقة إن وجدت */}
                  {layers.filter(l => l.clipToLayerId === selectedLayer.id).length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-violet-500/20">
                      <span className="text-[10px] text-violet-300 font-bold">القطع المدمجة بالداخل:</span>
                      {layers.filter(l => l.clipToLayerId === selectedLayer.id).map(child => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-violet-500/20 text-xs"
                        >
                          <span className="truncate text-slate-200 text-[11px] max-w-[140px]">{child.name}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedLayerId(child.id)}
                              className="text-violet-400 hover:text-violet-300 text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-violet-500/10 cursor-pointer"
                            >
                              تحديد
                            </button>
                            <button
                              type="button"
                              onClick={() => setLayers(prev => prev.filter(l => l.id !== child.id))}
                              className="text-rose-400 hover:text-rose-300 text-[10px] font-bold px-1 py-0.5 rounded hover:bg-rose-500/10 cursor-pointer"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 gap-2">
                <Sliders size={20} className="opacity-40" />
                <span>حدد طبقة من القائمة لتعديل خصائصها.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------------- BOTTOM AE TIMELINE & KEYFRAME SEQUENCER ----------------- */}
      <div className={`border-t border-slate-800/50 bg-slate-900/30 text-xs ${isMobile ? (aeMobileTab === 'timeline' ? 'flex flex-col flex-1 w-full min-h-[55vh]' : 'hidden') : 'flex flex-col h-56'}`}>
        {/* Timeline Header & Transport Controls */}
        <div className="h-9 border-b border-slate-800/60 bg-slate-800/25 px-4 flex items-center justify-between">
          {/* Timecode & Frame counter */}
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <div className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50 text-slate-400 font-bold">
              <span>{String(Math.floor(currentFrame / compSettings.fps)).padStart(2, '0')}:</span>
              <span>{String(currentFrame % compSettings.fps).padStart(2, '0')}</span>
            </div>
            <span className="text-slate-400">
              فريم: <strong className="text-slate-400 font-bold">{currentFrame}</strong> / {compSettings.totalFrames}
            </span>
          </div>

          {/* Transport Buttons & Keyframe Controls (Play, Pause, Step, J/K, Add Keyframe) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/60">
              <button
                onClick={() => setCurrentFrame(0)}
                title="إلى البداية (Home)"
                className="p-1 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={goToPrevKeyframe}
                title="الانتقال للمفتاح السابق (J)"
                className="px-1.5 py-0.5 hover:text-cyan-300 text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ◀◀
              </button>
              <button
                onClick={() => setCurrentFrame(prev => Math.max(0, prev - 1))}
                title="فريم سابق"
                className="px-1.5 py-0.5 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ◀-1
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                title="تشغيل / إيقاف (Space)"
                className="px-3 py-1 rounded-md bg-violet-600/40 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 flex items-center gap-1 font-bold text-[11px] transition-all"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
              </button>
              <button
                onClick={() => setCurrentFrame(prev => Math.min(compSettings.totalFrames, prev + 1))}
                title="فريم تالٍ"
                className="px-1.5 py-0.5 hover:text-white text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                +1▶
              </button>
              <button
                onClick={goToNextKeyframe}
                title="الانتقال للمفتاح التالي (K)"
                className="px-1.5 py-0.5 hover:text-cyan-300 text-slate-400 hover:bg-slate-700/50 rounded font-mono text-[10px]"
              >
                ▶▶
              </button>
            </div>


          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>{compSettings.fps} FPS</span>
          </div>
        </div>

        {/* Timeline Tracks & Keyframe Ruler */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Layer Names & Keyframe Toggles */}
          <div 
            ref={layerListScrollRef}
            onScroll={handleLayerListScroll}
            className="w-64 border-r border-slate-800/60 bg-slate-900/20 overflow-y-auto flex flex-col [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0"
          >
            {/* Column Header */}
            <div className="h-6 px-3 border-b border-slate-800/60 bg-slate-800/40 flex items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
              <span className="flex items-center gap-1">
                <Layers size={11} className="text-violet-400" />
                <span>اسم الطبقة (Layer Name)</span>
              </span>
            </div>
            {layers.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-[11px]">
                لا توجد طبقات في التايم لاين
              </div>
            ) : (
              layers.map((layer, idx) => {
                const isDragging = draggedLayerIdx === idx;
                const isDropTarget = dropTargetIdx === idx;

                return (
                  <div 
                    key={layer.id}
                    draggable={!layer.locked}
                    onDragStart={(e) => {
                      setDraggedLayerIdx(idx);
                      e.dataTransfer.setData('text/plain', String(idx));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const midY = rect.top + rect.height / 2;
                      const pos = e.clientY < midY ? 'above' : 'below';
                      if (dropTargetIdx !== idx || dropPosition !== pos) {
                        setDropTargetIdx(idx);
                        setDropPosition(pos);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dropTargetIdx === idx) {
                          setDropTargetIdx(null);
                          setDropPosition(null);
                        }
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedLayerIdx !== null) {
                        let targetIndex = idx;
                        if (dropPosition === 'below') {
                          targetIndex = idx + 1;
                        }
                        if (draggedLayerIdx < targetIndex) {
                          targetIndex -= 1;
                        }
                        reorderLayers(draggedLayerIdx, targetIndex);
                      }
                      setDraggedLayerIdx(null);
                      setDropTargetIdx(null);
                      setDropPosition(null);
                    }}
                    onDragEnd={() => {
                      setDraggedLayerIdx(null);
                      setDropTargetIdx(null);
                      setDropPosition(null);
                    }}
                    onClick={() => setSelectedLayerId(layer.id)}
                    data-interactive="true"
                    className={`layer-row-item relative h-8 px-2 border-b border-slate-800/40 flex items-center cursor-pointer text-[11px] transition-colors shrink-0 ${
                      isDragging
                        ? 'opacity-30 border-dashed border-cyan-400 bg-slate-800/40'
                        : selectedLayerId === layer.id
                          ? 'bg-violet-900/30 text-violet-200 font-bold border-l-2 border-l-violet-500'
                          : 'text-slate-400 hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Visual Drop Indicators */}
                    {isDropTarget && dropPosition === 'above' && (
                      <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-cyan-400 z-30 pointer-events-none"></div>
                    )}
                    {isDropTarget && dropPosition === 'below' && (
                      <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-cyan-400 z-30 pointer-events-none"></div>
                    )}

                    <div className="flex items-center gap-1.5 truncate flex-1">
                      <div 
                        className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5 shrink-0"
                        title="اسحب لتغيير ترتيب الطبقة"
                      >
                        <GripVertical size={11} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono w-3 text-center shrink-0">{idx + 1}</span>
                      <div className="w-4 h-4 rounded bg-slate-950 border border-slate-700/60 overflow-hidden flex items-center justify-center shrink-0">
                        {layer.kind === 'image' && layer.imageSrc ? (
                          <img src={layer.imageSrc} alt="" className="w-full h-full object-contain pointer-events-none" />
                        ) : layer.kind === 'shape' ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        ) : (
                          <Layers size={9} className="text-slate-400" />
                        )}
                      </div>
                      {layer.clipToLayerId && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-violet-600/30 text-violet-300 border border-violet-500/40 shrink-0 font-bold" title="طبقة مدمجة كقناع داخل القطعة">
                          قناع ↳
                        </span>
                      )}
                      <span className="truncate">{layer.name}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Time Ruler & Keyframe Track Canvas */}
          <div className="flex-1 flex flex-col overflow-x-hidden relative bg-slate-900/20">
            {/* Frame Tick Ruler */}
            <div 
              ref={rulerRef}
              data-interactive="true"
              className="timeline-scrubber h-6 border-b border-slate-800/60 bg-slate-800/30 relative cursor-ew-resize select-none"
              onMouseDown={(e) => {
                setIsScrubbing(true);
                updateScrubFrame(e.clientX);
              }}
            >
              {/* Ticks every 5/10 frames */}
              {Array.from({ length: Math.ceil(compSettings.totalFrames / 5) + 1 }).map((_, i) => {
                const f = i * 5;
                if (f > compSettings.totalFrames) return null;
                const isMajor = f % 15 === 0;
                return (
                  <div
                    key={f}
                    style={{ left: getTimelineLeftPercent(f) }}
                    className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
                  >
                    <span className="text-[9px] text-slate-500 font-mono -translate-x-1/2">
                      {isMajor ? `${f}f` : ''}
                    </span>
                    <div className={`w-px ${isMajor ? 'h-2.5 bg-slate-500' : 'h-1.5 bg-slate-700'}`}></div>
                  </div>
                );
              })}

              {/* Blue Playhead / CTI Marker */}
              <div
                style={{ left: getTimelineLeftPercent(currentFrame) }}
                className="absolute top-0 bottom-0 w-2.5 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center"
              >
                <div className="w-2.5 h-2.5 bg-cyan-400 rotate-45 -mt-1 shadow-sm"></div>
              </div>
            </div>

            {/* Layer Tracks & Diamond Keyframes - Single Main Scrollbar */}
            <div 
              ref={tracksScrollRef}
              onScroll={handleTracksScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden relative"
            >
              {/* Playhead vertical guide line extending through tracks */}
              <div
                style={{ left: getTimelineLeftPercent(currentFrame) }}
                className="absolute top-0 bottom-0 w-px bg-cyan-400/70 z-10 pointer-events-none"
              ></div>

              {layers.map(layer => {
                const isSelected = selectedLayerId === layer.id;
                const hasAnyStopwatchActive = Boolean(
                  layer.animatingRotation ||
                  layer.animatingPosition ||
                  layer.animatingScale ||
                  layer.animatingOpacity
                );
                const hasKfHere = (
                  hasKeyframeAtCurrentFrame('rotation', layer) ||
                  hasKeyframeAtCurrentFrame('position', layer) ||
                  hasKeyframeAtCurrentFrame('scale', layer) ||
                  hasKeyframeAtCurrentFrame('opacity', layer)
                );

                return (
                  <div 
                    key={layer.id}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const padding = 8;
                      const usableWidth = Math.max(1, rect.width - padding * 2);
                      const clickX = e.clientX - rect.left - padding;
                      const pct = Math.max(0, Math.min(1, clickX / usableWidth));
                      const targetF = Math.round(pct * compSettings.totalFrames);
                      setCurrentFrame(Math.max(0, Math.min(compSettings.totalFrames, targetF)));
                      setSelectedLayerId(layer.id);
                    }}
                    className={`h-8 border-b border-slate-800/40 relative flex items-center transition-colors cursor-pointer ${
                      isSelected ? 'bg-violet-950/20' : 'hover:bg-slate-800/20'
                    }`}
                  >
                    {/* Interactive After Effects Keyframe Diamond at playhead position - only when stopwatch is active */}
                    {isSelected && hasAnyStopwatchActive && (
                      <div
                        style={{ left: getTimelineLeftPercent(currentFrame) }}
                        className={`absolute -translate-x-1/2 z-20 flex items-center justify-center ${hasKfHere ? 'pointer-events-none' : 'pointer-events-auto'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerId(layer.id);
                          addOrToggleKeyframeForLayer(layer.id);
                        }}
                        title={
                          hasKfHere
                            ? `نقطة كي فريم عند فريم ${currentFrame}`
                            : `إضافة نقطة كي فريم (◇) عند فريم ${currentFrame} موضع هذا الخط بالضبط`
                        }
                      >
                        <div className={`w-2.5 h-2.5 rotate-45 flex items-center justify-center transition-all ${
                          hasKfHere
                            ? `${
                                layer.animatingRotation && layer.rotationKeyframes.some(k => k.frame === currentFrame) ? 'bg-amber-400' :
                                layer.animatingPosition && layer.positionKeyframes.some(k => k.frame === currentFrame) ? 'bg-emerald-400' :
                                layer.animatingScale && layer.scaleKeyframes.some(k => k.frame === currentFrame) ? 'bg-cyan-400' :
                                layer.animatingOpacity && layer.opacityKeyframes.some(k => k.frame === currentFrame) ? 'bg-purple-400' :
                                'bg-amber-400'
                              } border border-slate-900 shadow-md`
                            : 'bg-slate-900/90 border border-cyan-400 hover:bg-cyan-500'
                        }`}>
                          {!hasKfHere && (
                            <span className="text-[7px] font-black text-cyan-300 -rotate-45 leading-none select-none">+</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Keyframes for Position */}
                    {layer.animatingPosition && layer.positionKeyframes.map((kf, i) =>
                      renderKeyframeDiamond(layer, 'position', kf, i, 'bg-emerald-400', 'موضع')
                    )}

                    {/* Keyframes for Scale */}
                    {layer.animatingScale && layer.scaleKeyframes.map((kf, i) =>
                      renderKeyframeDiamond(layer, 'scale', kf, i, 'bg-cyan-400', 'حجم')
                    )}

                    {/* Keyframes for Rotation */}
                    {layer.animatingRotation && layer.rotationKeyframes.map((kf, i) =>
                      renderKeyframeDiamond(layer, 'rotation', kf, i, 'bg-amber-400', 'دوران')
                    )}

                    {/* Keyframes for Opacity */}
                    {layer.animatingOpacity && layer.opacityKeyframes.map((kf, i) =>
                      renderKeyframeDiamond(layer, 'opacity', kf, i, 'bg-purple-400', 'شفافية')
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- MODAL: COMPOSITION SETTINGS (Ctrl+K) ----------------- */}
      {showCompSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-16 p-4 bg-slate-950/50 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl"
          >
            {renderCompSettingsContent(false)}
          </motion.div>
        </div>
      )}

      {/* ----------------- MODAL: EXPORT ENGINE ----------------- */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="w-full max-w-md bg-slate-900/70 border border-slate-700/60 rounded-3xl shadow-2xl p-6 text-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-violet-300">
                <Download size={16} />
                <span>تصدير الإطار (Export Queue)</span>
              </div>
              <button 
                onClick={() => setExportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            {exporting ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                <Loader2 size={32} className="animate-spin text-violet-400" />
                <span className="text-xs font-bold text-slate-200">{exportStatusText}</span>
                <div className="w-full bg-slate-800/60 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    style={{ width: `${exportProgress}%` }}
                    className="bg-violet-500 h-full transition-all duration-300"
                  ></div>
                </div>
                <span className="text-[11px] font-mono text-cyan-400">{exportProgress}%</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* SVGA Export Mode Selector */}
                <div className="p-2.5 rounded-2xl bg-slate-800/30 border border-slate-700/50 flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-300">طريقة تصدير SVGA:</span>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <button
                      type="button"
                      onClick={() => setSvgaExportMode('pieces')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                        svgaExportMode === 'pieces'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>قطع عادي (Sprites)</span>
                      <span className="text-[8px] font-normal opacity-80">أصول منفصلة + Transforms</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSvgaExportMode('render')}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                        svgaExportMode === 'render'
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>رندر إطارات (Render)</span>
                      <span className="text-[8px] font-normal opacity-80">تسلسل صور متتالية</span>
                    </button>
                  </div>
                </div>

                {/* Format Category Switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/60 border border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setExportCategory('primary')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      exportCategory === 'primary'
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>صيغ أساسية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportCategory('secondary')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                      exportCategory === 'secondary'
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <span>صيغ جانبية</span>
                  </button>
                </div>

                {exportCategory === 'primary' ? (
                  <div className="flex flex-col gap-2.5">
                    {/* VAP1.0 Option */}
                    <button
                      onClick={exportAsVAP10}
                      className="p-3 rounded-xl bg-slate-800/40 hover:bg-cyan-600/20 border border-cyan-500/40 hover:border-cyan-500/70 flex items-center justify-between text-left transition-all group cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">فيديو VAP1.0</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-600/40 text-cyan-300 border border-cyan-500/50">
                            Alpha Mask + vapc
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          تصدير فيديو MP4 مع قناع الشفافية وصندوق VAP1.0 المتوافق
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-cyan-600/30 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/40 group-hover:bg-cyan-600 group-hover:text-white transition-all">
                        VAP1.0
                      </span>
                    </button>

                    {/* SVGA Option */}
                    <button
                      onClick={exportAsSVGA}
                      className="p-3 rounded-xl bg-slate-800/40 hover:bg-violet-600/20 border border-violet-500/40 hover:border-violet-500/70 flex items-center justify-between text-left transition-all group cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">ملف SVGA 2.0</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-violet-600/40 text-violet-300 border border-violet-500/50">
                            {svgaExportMode === 'pieces' ? 'قطع عادي (Sprites)' : 'رندر فريمات'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {svgaExportMode === 'pieces'
                            ? 'تصدير كقطع مستقلة مع مصفوفات الحركة ومحاور التحريك (موصى به)'
                            : 'تصدير كرندر تسلسلي لجميع الفريمات'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-violet-600/30 text-violet-300 text-[10px] font-mono font-bold border border-violet-500/40 group-hover:bg-violet-600 group-hover:text-white transition-all">
                        .SVGA
                      </span>
                    </button>

                    {lastExportedSVGA && onOpenInViewer && (
                      <button
                        onClick={() => {
                          onOpenInViewer(lastExportedSVGA);
                          setExportModalOpen(false);
                        }}
                        className="mt-1 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
                      >
                        <Eye size={14} />
                        <span>معاينة ملف الـ SVGA المصدّر في العارض مباشرة</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {/* APNG Option */}
                    <button
                      onClick={exportAsAPNG}
                      className="p-3 rounded-xl bg-slate-800/40 hover:bg-emerald-600/20 border border-slate-700/60 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all group"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-white">صورة APNG متحركة وشفافة</span>
                        <span className="text-[10px] text-slate-400">أعلى دقة 24-bit مع شفافية ألفا نقية</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        .PNG
                      </span>
                    </button>

                    {/* GIF Option */}
                    <button
                      onClick={exportAsGIF}
                      className="p-3 rounded-xl bg-slate-800/40 hover:bg-amber-600/20 border border-slate-700/60 hover:border-amber-500/50 flex items-center justify-between text-left transition-all group"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-white">صورة GIF متحركة شفافة</span>
                        <span className="text-[10px] text-slate-400">متوافقة مع كافة المواقع وتطبيقات الويب</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40 group-hover:bg-amber-600 group-hover:text-white transition-all">
                        .GIF
                      </span>
                    </button>

                    {/* VAP 1.0 Option */}
                    <button
                      onClick={exportAsVap10}
                      className="p-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-600/20 border border-cyan-500/40 hover:border-cyan-400 flex items-center justify-between text-left transition-all group shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>فيديو Tencent VAP1.0 شفاف</span>
                          <span className="px-1.5 py-0.2 rounded text-[8px] bg-cyan-500 text-black font-black">VAP1.0</span>
                        </span>
                        <span className="text-[10px] text-cyan-300/80">فيديو MP4 شفاف مع قناع ألفا بالأعلى وصندوق vapc القياسي</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-cyan-600/30 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/40 group-hover:bg-cyan-600 group-hover:text-white transition-all">
                        .MP4
                      </span>
                    </button>


                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔴 Image Custom Dimensions Import Selector Modal */}
      {imageImportPending && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" onClick={() => setImageImportPending(null)} />
          <div className="relative w-full max-w-md bg-[#090e1c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 text-right" dir="rtl">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>تهيئة أبعاد الصورة المستوردة</span>
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              يمكنك استيراد الصورة بمقاساتها الأساسية الأصلية مباشرة أو تحديد المقاس الذي تريده.
            </p>

            <div className="flex justify-center mb-4 p-2 bg-slate-900/40 rounded-2xl border border-white/5">
              <img src={imageImportPending.url} alt="Preview" className="max-h-36 object-contain rounded-lg shadow-inner" />
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-violet-600/10 border border-violet-500/20 rounded-2xl flex items-center justify-between">
                <span className="text-slate-300 font-bold text-xs">الأبعاد الأصلية الأساسية:</span>
                <span className="font-mono text-emerald-400 font-black text-sm">
                  {imageImportPending.naturalWidth} × {imageImportPending.naturalHeight} px
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block text-xs mb-1 font-bold">العرض (px):</label>
                  <input
                    type="number"
                    value={imageImportWidth}
                    onChange={(e) => setImageImportWidth(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-violet-500 text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-xs mb-1 font-bold">الارتفاع (px):</label>
                  <input
                    type="number"
                    value={imageImportHeight}
                    onChange={(e) => setImageImportHeight(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-none focus:border-violet-500 text-center"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setImageImportWidth(String(imageImportPending.naturalWidth));
                    setImageImportHeight(String(imageImportPending.naturalHeight));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  استعادة المقاس الأصلي
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-6">
              <button
                type="button"
                onClick={() => setImageImportPending(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalWidth = Number(imageImportWidth) || imageImportPending.naturalWidth;
                  const finalHeight = Number(imageImportHeight) || imageImportPending.naturalHeight;
                  
                  const newId = `layer-${Date.now()}`;
                  const newLayer: AELayer = {
                    id: newId,
                    name: imageImportPending.file.name.replace(/\.[^/.]+$/, ''),
                    kind: 'image',
                    visible: true,
                    locked: false,
                    colorLabel: 'orange',
                    expanded: false,
                    position: { x: 0, y: 0 },
                    scale: 100,
                    rotation: 0,
                    opacity: 100,
                    animatingPosition: false,
                    positionKeyframes: [],
                    animatingScale: false,
                    scaleKeyframes: [],
                    animatingRotation: false,
                    rotationKeyframes: [],
                    animatingOpacity: false,
                    opacityKeyframes: [],
                    width: finalWidth,
                    height: finalHeight,
                    imageSrc: imageImportPending.url,
                    imageElement: imageImportPending.img
                  };
                  setLayers(prev => [newLayer, ...prev]);
                  setSelectedLayerId(newId);
                  setImageImportPending(null);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
              >
                <Check size={14} className="text-emerald-300" />
                <span>إتمام الاستدعاء وإدراج الطبقة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Dock Bar for Android & Small Screens */}
      {isMobile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0f1d]/95 backdrop-blur-md border-t border-slate-700/60 grid grid-cols-4 z-[45] select-none pb-safe">
          <button
            type="button"
            onClick={() => setAeMobileTab('viewport')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              aeMobileTab === 'viewport' ? 'text-violet-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film size={18} />
            <span className="text-[10px]">الكانفاس</span>
          </button>

          <button
            type="button"
            onClick={() => setAeMobileTab('layers')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              aeMobileTab === 'layers' ? 'text-violet-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={18} />
            <span className="text-[10px]">الطبقات ({layers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAeMobileTab('properties')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              aeMobileTab === 'properties' ? 'text-violet-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders size={18} />
            <span className="text-[10px]">الخصائص {selectedLayerId ? '✓' : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setAeMobileTab('timeline')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              aeMobileTab === 'timeline' ? 'text-violet-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock size={18} />
            <span className="text-[10px]">التايم لاين</span>
          </button>
        </div>
      )}

    </motion.div>
  );
};

export default AfterEffectsStudio;
