import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  EditableLayer, SVGAProjectData, CanvasTool, LayerKeyframe,
  FadeConfig, CropConfig, CropFeather, ShineEffectConfig, SVGAAudioTrack,
  ProjectSession
} from './types';
import { 
  DEFAULT_FADE_CONFIG, 
  DEFAULT_CROP_CONFIG, 
  DEFAULT_CROP_FEATHER, 
  isTransparencyActive 
} from './transparencyEngine';
import { parseSvgaToProject, createNewSvgaProject, convertImageToSvgaProject } from './svgaParserEngine';
import { loadUniversalProject } from './universalProjectLoader';
import { convertMp4ToSvgaProject, createFastMp4Project } from './mp4SvgaEngine';
import { exportEditedSvga } from './svgaExportEngine';
import { mergeSvgaFileIntoProject, transformLayerGroup, mergeLayersIntoSingleLayer, ungroupMergedLayer, syncLayerMotionWithReference } from './svgaMergeEngine';
import { 
  transformSelectedLayers, 
  reorderSelectedLayers, 
  moveSelectedLayersToTarget, 
  duplicateSelectedLayers, 
  deleteSelectedLayers 
} from './svgaMultiSelectEngine';
import { fileToImageBuffer, getFlippedImageBuffer, createImageLayer, createShapeLayer } from './layerFactory';
import { convertImageData, SupportedImageFormat } from './imageConverter';
import { SvgaDesignCanvas } from './SvgaDesignCanvas';
import { SvgaLayersList } from './SvgaLayersList';
import { SvgaPropertiesPanel } from './SvgaPropertiesPanel';
import { SvgaMotionTimeline } from './SvgaMotionTimeline';
import { SvgaAudioEditorModal } from './SvgaAudioEditorModal';
import { SvgaExportModal } from './SvgaExportModal';
import { SvgaMp4ImportModal } from './SvgaMp4ImportModal';
import { SvgaMergeCanvasModal } from './SvgaMergeCanvasModal';
import { SvgaChromaPenStudio } from './SvgaChromaPenStudio';
import { SvgaProjectsTabBar } from './SvgaProjectsTabBar';
import { SvgaMultiProjectOverview } from './SvgaMultiProjectOverview';
import { SvgaMultiCanvasStage } from './SvgaMultiCanvasStage';
import { SvgaBatchExportModal } from './SvgaBatchExportModal';
import { SvgaBackgroundLibraryModal, downloadImageUrl } from './SvgaBackgroundLibraryModal';
import { ChromaTargetColor, identifyColorType, applySmartChromaToSingleImage, isAudioSource } from './svgaSmartChromaEngine';
import { ErrorBoundary } from '../ErrorBoundary';
import { 
  Upload, Layers, Download, ArrowLeft, RotateCcw, 
  Sparkles, MousePointer, Hand, ZoomIn, Grid, Compass, 
  FileCode, Check, AlertCircle, RefreshCw, X, Shield, Eye,
  Sliders, Play, Film, CheckCircle2, Music, Plus, FilePlus, Package,
  Image as ImageIcon, Pipette, LayoutGrid, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Lightweight snapshot interface for Undo/Redo history to prevent memory explosion on 200+ layer files
interface LayerHistorySnapshot {
  id: string;
  name: string;
  originalIndex: number;
  imageKey: string;
  type: 'image' | 'shape' | 'composite';
  visible: boolean;
  locked: boolean;
  transform: EditableLayer['transform'];
  initialBounds: { x: number; y: number; width: number; height: number };
  aspectRatioLocked: boolean;
  keyframes?: LayerKeyframe[];
  inFrame?: number;
  outFrame?: number;
  trackColor?: string;
  groupId?: string;
  groupName?: string;
  sequenceGroupId?: string;
  sequenceIndex?: number;
  sequenceTotal?: number;
  matteKey?: string;
  blendMode?: string;
  isMatteMask?: boolean;
  isMerged?: boolean;
  motionReferenceLayerId?: string;
  isMotionSynced?: boolean;
  shineConfig?: ShineEffectConfig;
  mergedLayersSnapshot?: LayerHistorySnapshot[];
}

const MAX_HISTORY_STEPS = 12;

function createLayersSnapshot(layersList: EditableLayer[]): LayerHistorySnapshot[] {
  return layersList.map(layer => ({
    id: layer.id,
    name: layer.name,
    originalIndex: layer.originalIndex,
    imageKey: layer.imageKey,
    type: layer.type,
    visible: layer.visible,
    locked: layer.locked,
    transform: { ...layer.transform },
    initialBounds: { ...layer.initialBounds },
    aspectRatioLocked: layer.aspectRatioLocked,
    keyframes: layer.keyframes ? layer.keyframes.map(k => ({ ...k })) : undefined,
    inFrame: layer.inFrame,
    outFrame: layer.outFrame,
    trackColor: layer.trackColor,
    groupId: layer.groupId,
    groupName: layer.groupName,
    sequenceGroupId: layer.sequenceGroupId,
    sequenceIndex: layer.sequenceIndex,
    sequenceTotal: layer.sequenceTotal,
    matteKey: layer.matteKey,
    blendMode: layer.blendMode,
    isMatteMask: layer.isMatteMask,
    isMerged: layer.isMerged,
    motionReferenceLayerId: layer.motionReferenceLayerId,
    isMotionSynced: layer.isMotionSynced,
    shineConfig: layer.shineConfig ? { ...layer.shineConfig } : undefined,
    mergedLayersSnapshot: layer.mergedLayers ? createLayersSnapshot(layer.mergedLayers) : undefined
  }));
}

function restoreLayersFromSnapshot(
  snapshot: LayerHistorySnapshot[],
  currentLayers: EditableLayer[],
  masterLayerMap: Map<string, EditableLayer>
): EditableLayer[] {
  return snapshot.map(snap => {
    const existing = masterLayerMap.get(snap.id) || currentLayers.find(l => l.id === snap.id);
    const restoredMerged = snap.mergedLayersSnapshot 
      ? restoreLayersFromSnapshot(snap.mergedLayersSnapshot, existing?.mergedLayers || [], masterLayerMap)
      : existing?.mergedLayers;

    if (existing) {
      return {
        ...existing,
        name: snap.name,
        visible: snap.visible,
        locked: snap.locked,
        transform: { ...snap.transform },
        initialBounds: { ...snap.initialBounds },
        aspectRatioLocked: snap.aspectRatioLocked,
        keyframes: snap.keyframes ? snap.keyframes.map(k => ({ ...k })) : undefined,
        inFrame: snap.inFrame,
        outFrame: snap.outFrame,
        trackColor: snap.trackColor,
        groupId: snap.groupId,
        groupName: snap.groupName,
        sequenceGroupId: snap.sequenceGroupId,
        sequenceIndex: snap.sequenceIndex,
        sequenceTotal: snap.sequenceTotal,
        matteKey: snap.matteKey,
        blendMode: snap.blendMode,
        isMatteMask: snap.isMatteMask,
        isMerged: snap.isMerged,
        motionReferenceLayerId: snap.motionReferenceLayerId,
        isMotionSynced: snap.isMotionSynced,
        shineConfig: snap.shineConfig ? { ...snap.shineConfig } : undefined,
        mergedLayers: restoredMerged
      };
    }
    return snap as any as EditableLayer;
  });
}

interface SvgaLayerEditorProps {
  initialFile?: File;
  initialProject?: SVGAProjectData;
  initialLayers?: EditableLayer[];
  onClose: () => void;
  onOpenViewer?: (file: File) => void;
}

export const SvgaLayerEditor: React.FC<SvgaLayerEditorProps> = ({
  initialFile,
  initialProject,
  initialLayers,
  onClose,
  onOpenViewer
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);
  const mp4FileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Project Compositions State (supports multiple files SVGA/MP4/Images side-by-side)
  const [projects, setProjects] = useState<ProjectSession[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [canvasViewMode, setCanvasViewMode] = useState<'multi' | 'single'>('multi');
  const [isOverviewMode, setIsOverviewMode] = useState<boolean>(false);
  const [showBatchExportModal, setShowBatchExportModal] = useState<boolean>(false);

  // Project Data & Layers
  const [project, setProject] = useState<SVGAProjectData | null>(null);
  const [layers, setLayers] = useState<EditableLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  // Persistent reference map for full layer objects (sprites & thumbnails) so history only stores lightweight metadata
  const masterLayersMapRef = useRef<Map<string, EditableLayer>>(new Map());

  // Undo / Redo History Stack (using lightweight LayerHistorySnapshot to prevent OOM)
  const [history, setHistory] = useState<LayerHistorySnapshot[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Canvas Viewport State
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [zoom, setZoom] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>('transparent');
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Animation & Timeline State
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(true);

  // Status & Export State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [showAudioStudioModal, setShowAudioStudioModal] = useState<boolean>(false);
  const [showMergeCanvasModal, setShowMergeCanvasModal] = useState<boolean>(false);
  const [showMp4ImportModal, setShowMp4ImportModal] = useState<boolean>(false);
  const [showBgLibraryModal, setShowBgLibraryModal] = useState<boolean>(false);
  const [mp4InitialFiles, setMp4InitialFiles] = useState<File[]>([]);
  const [newProjectConfig, setNewProjectConfig] = useState({
    name: 'مشروع SVGA جديد',
    width: 750,
    height: 1334,
    fps: 30,
    durationSec: 2
  });
  const [exportFileName, setExportFileName] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'canvas' | 'layers' | 'properties'>('canvas');
  const [isTimelineOpenMobile, setIsTimelineOpenMobile] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [lastExportedBlob, setLastExportedBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edge Fade & Advanced Crop State
  const [fadeConfig, setFadeConfig] = useState<FadeConfig>(DEFAULT_FADE_CONFIG);
  const [cropConfig, setCropConfig] = useState<CropConfig>(DEFAULT_CROP_CONFIG);
  const [cropFeather, setCropFeather] = useState<CropFeather>(DEFAULT_CROP_FEATHER);

  // Interactive Click-to-Place Shine Vector Points State
  const [shinePointStep, setShinePointStep] = useState<'idle' | 'place-start' | 'place-end'>('idle');

  // Smart Chroma Key Pen State
  const [isChromaPenActive, setIsChromaPenActive] = useState<boolean>(false);
  const [chromaActiveColor, setChromaActiveColor] = useState<ChromaTargetColor | null>(null);
  const [chromaTargetColors, setChromaTargetColors] = useState<ChromaTargetColor[]>([]);
  const [chromaTolerance, setChromaTolerance] = useState<number>(30);
  const [chromaSmoothness, setChromaSmoothness] = useState<number>(12);
  const [chromaDespill, setChromaDespill] = useState<number>(85);
  const [chromaScope, setChromaScope] = useState<'all' | 'selected' | 'current'>('all');
  const [isChromaProcessing, setIsChromaProcessing] = useState<boolean>(false);
  const [chromaProgress, setChromaProgress] = useState<number>(0);
  const [chromaStatus, setChromaStatus] = useState<string>('');
  const [chromaUndoStack, setChromaUndoStack] = useState<Array<{
    imagesMap: Record<string, string>;
    rawImages: Record<string, Uint8Array>;
  }>>([]);

  const handleToggleChromaPen = useCallback(() => {
    setIsChromaPenActive(prev => {
      const next = !prev;
      if (next) {
        setActiveTool('chroma-pen');
        setIsPlaying(false);
      } else {
        setActiveTool('select');
      }
      return next;
    });
  }, []);

  const handleChromaPickColor = useCallback((color: ChromaTargetColor) => {
    setChromaTargetColors(prev => {
      const exists = prev.some(c => {
        const dr = c.r - color.r;
        const dg = c.g - color.g;
        const db = c.b - color.b;
        return Math.sqrt(dr * dr + dg * dg + db * db) < 14;
      });
      if (exists) return prev;
      return [...prev, color];
    });

    const info = identifyColorType(color.r, color.g, color.b);
    if (info.isChroma) {
      if (info.label.includes('Green') || info.label.includes('خضراء')) {
        setChromaTolerance(32);
        setChromaDespill(90);
      } else if (info.label.includes('Blue') || info.label.includes('زرقاء')) {
        setChromaTolerance(30);
        setChromaDespill(85);
      } else if (info.label.includes('Black') || info.label.includes('سوداء')) {
        setChromaTolerance(22);
        setChromaDespill(50);
      } else if (info.label.includes('White') || info.label.includes('بيضاء')) {
        setChromaTolerance(20);
        setChromaDespill(40);
      }
    }
  }, []);

  const handleAddTargetColor = useCallback((color: ChromaTargetColor) => {
    setChromaTargetColors(prev => [...prev, color]);
  }, []);

  const handleRemoveTargetColor = useCallback((index: number) => {
    setChromaTargetColors(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearTargetColors = useCallback(() => {
    setChromaTargetColors([]);
  }, []);

  const handleUndoChroma = useCallback(() => {
    if (chromaUndoStack.length === 0) return;
    const previous = chromaUndoStack[chromaUndoStack.length - 1];
    setChromaUndoStack(prev => prev.slice(0, prev.length - 1));
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        imagesMap: { ...previous.imagesMap },
        rawImages: { ...previous.rawImages }
      };
    });
    setSuccessToast('تم التراجع عن حذف اللون واستعادة الإطارات السابقة بنجاح');
  }, [chromaUndoStack]);

  const handleApplyChroma = useCallback(async () => {
    if (!project || chromaTargetColors.length === 0) return;

    setIsChromaProcessing(true);
    setChromaProgress(0);
    setChromaStatus('بدء معالجة واستخراج الكروما...');

    try {
      const currentImagesMapSnapshot = { ...(project.imagesMap || {}) };
      const currentRawImagesSnapshot: Record<string, Uint8Array> = {};
      if (project.rawImages) {
        for (const [k, v] of Object.entries(project.rawImages)) {
          if (v instanceof Uint8Array) {
            currentRawImagesSnapshot[k] = new Uint8Array(v);
          }
        }
      }
      setChromaUndoStack(prev => [...prev.slice(-4), {
        imagesMap: currentImagesMapSnapshot,
        rawImages: currentRawImagesSnapshot
      }]);

      let targetKeys: string[] = [];
      if (chromaScope === 'all') {
        targetKeys = Object.keys(project.imagesMap || {});
      } else if (chromaScope === 'selected') {
        const selectedLayer = layers.find(l => l.id === selectedLayerId);
        if (selectedLayer && selectedLayer.imageKey) {
          targetKeys = [selectedLayer.imageKey];
        } else {
          targetKeys = Object.keys(project.imagesMap || {});
        }
      } else {
        const activeKeys = layers
          .filter(l => {
            const inF = l.inFrame ?? 0;
            const outF = l.outFrame ?? (project.totalFrames - 1);
            return currentFrame >= inF && currentFrame <= outF;
          })
          .map(l => l.imageKey)
          .filter(Boolean) as string[];
        if (activeKeys.length > 0) {
          targetKeys = Array.from(new Set(activeKeys));
        } else {
          targetKeys = Object.keys(project.imagesMap || {});
        }
      }

      // Filter out audio and invalid sources
      targetKeys = targetKeys.filter(key => {
        const imgUrl = project.imagesMap?.[key];
        return !isAudioSource(key, imgUrl);
      });

      if (targetKeys.length === 0) {
        setErrorMessage('لم يتم العثور على صور لمعالجتها في هذا النطاق');
        setIsChromaProcessing(false);
        return;
      }

      const newImagesMap: Record<string, string> = {};
      const newRawImages: Record<string, Uint8Array> = {};

      const total = targetKeys.length;
      let successCount = 0;

      for (let i = 0; i < total; i++) {
        const key = targetKeys[i];
        const rawBytes = project.rawImages?.[key];
        const imgUrl = project.imagesMap?.[key];
        const source = rawBytes || imgUrl;
        if (!source) continue;

        setChromaProgress(Math.round(((i + 0.2) / total) * 100));
        setChromaStatus(`معالجة الإطار ${i + 1} من ${total}...`);

        try {
          const result = await applySmartChromaToSingleImage(source, {
            targets: chromaTargetColors,
            tolerance: chromaTolerance,
            smoothness: chromaSmoothness,
            despill: chromaDespill
          });

          newImagesMap[key] = result.dataUrl;
          newRawImages[key] = result.bytes;
          successCount++;
        } catch (itemErr) {
          console.warn(`Could not process chroma on key ${key}:`, itemErr);
        }
      }

      if (successCount === 0) {
        throw new Error('فشلت معالجة الصور المحددة، يرجى التأكد من اختيار إطار أو طبقة تحتوي على صورة');
      }

      setChromaProgress(100);
      setChromaStatus('اكتمال الحذف وحفظ التغييرات...');

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          imagesMap: {
            ...(prev.imagesMap || {}),
            ...newImagesMap
          },
          rawImages: {
            ...(prev.rawImages || {}),
            ...newRawImages
          }
        };
      });

      setSuccessToast(`تمت إزالة الكروما وحذف اللون بنجاح من ${successCount} إطار بدون أي بقايا!`);
    } catch (err: any) {
      console.error('Error applying chroma keying:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الكروما');
    } finally {
      setIsChromaProcessing(false);
      setChromaStatus('');
    }
  }, [project, layers, selectedLayerId, currentFrame, chromaTargetColors, chromaTolerance, chromaSmoothness, chromaDespill, chromaScope]);

  const handleBackgroundUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setBgImageUrl(result);
        // Apply background to all open projects in multi-project view
        setProjects(prev => prev.map(p => ({
          ...p,
          bgImageUrl: result
        })));
        setSuccessToast(`تم رفع وتثبيت صورة الخلفية بنجاح على جميع المشاريع (${projects.length || 1}) للمعاينة الموحدة!`);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [projects.length]);

  const handleSelectBackground = useCallback((url: string | null, applyToAll: boolean) => {
    setBgImageUrl(url);
    if (applyToAll) {
      setProjects(prev => prev.map(p => ({
        ...p,
        bgImageUrl: url
      })));
      if (url) {
        setSuccessToast(`تم تطبيق الخلفية وتثبيتها بنجاح على جميع المشاريع (${projects.length || 1}) للمعاينة الموحدة`);
      } else {
        setSuccessToast('تمت إزالة صورة الخلفية والعودة للوضع الافتراضي في جميع المشاريع');
      }
    } else {
      if (activeProjectId) {
        setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, bgImageUrl: url } : p));
      }
      if (url) {
        setSuccessToast('تم تطبيق الخلفية على المشروع الحالي');
      } else {
        setSuccessToast('تمت إزالة صورة الخلفية عن المشروع الحالي');
      }
    }
  }, [activeProjectId, projects.length]);

  const handleResetTransparency = useCallback(() => {
    setFadeConfig({ top: 0, bottom: 0, left: 0, right: 0 });
    setCropConfig({ top: 0, bottom: 0, left: 0, right: 0, shape: 'rect', cornerRadius: 25 });
    setCropFeather({ top: 0, bottom: 0, left: 0, right: 0 });
  }, []);

  // Synchronized Audio Playback Cache & Nodes
  const activeAudioMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Clean and sync audio during animation playback
  useEffect(() => {
    if (!isPlaying || !project || !project.audios || project.audios.length === 0) {
      activeAudioMapRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      activeAudioMapRef.current.clear();
      return;
    }

    const fps = project.fps || 30;
    const currentSec = currentFrame / fps;

    project.audios.forEach((track) => {
      let audio = activeAudioMapRef.current.get(track.audioKey);
      
      if (!audio) {
        let src = track.dataUrl;
        if (!src && project.imagesMap && project.imagesMap[track.audioKey] && !project.imagesMap[track.audioKey].startsWith('data:image/')) {
          src = project.imagesMap[track.audioKey];
        }
        if (!src && project.rawImages && project.rawImages[track.audioKey]) {
          const blob = new Blob([project.rawImages[track.audioKey]], { type: 'audio/mp3' });
          src = URL.createObjectURL(blob);
        }
        if (!src && project.imagesMap && project.imagesMap[track.audioKey]) {
          src = project.imagesMap[track.audioKey].replace(/^data:[^;]+;base64,/, 'data:audio/mp3;base64,');
        }

        if (!src) return;

        audio = new Audio(src);
        audio.preload = 'auto';
        activeAudioMapRef.current.set(track.audioKey, audio);
      }

      const startSec = (track.startFrame || 0) / fps;
      const endSec = (track.endFrame || project.totalFrames) / fps;

      if (currentSec >= startSec && currentSec <= endSec) {
        const startOffset = (track.startTime ? track.startTime / 1000 : 0);
        const expectedOffset = Math.max(0, currentSec - startSec + startOffset);

        if (audio.paused) {
          audio.currentTime = expectedOffset;
          audio.play().catch((e) => console.warn('Audio auto-play error or blocked:', e));
        } else {
          // If frame looped back to 0 or drifted
          if (Math.abs(audio.currentTime - expectedOffset) > 0.15) {
            audio.currentTime = expectedOffset;
          }
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });
  }, [isPlaying, currentFrame, project]);

  // Push State to History (Memory-Safe Snapshot)
  const pushHistory = useCallback((newLayers: EditableLayer[]) => {
    // Cache layer references in master map to preserve sprite entities and image assets
    newLayers.forEach(l => {
      masterLayersMapRef.current.set(l.id, l);
      if (l.mergedLayers) {
        l.mergedLayers.forEach(sub => masterLayersMapRef.current.set(sub.id, sub));
      }
    });

    const snapshot = createLayersSnapshot(newLayers);
    setHistory(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      const updated = [...upToCurrent, snapshot];
      if (updated.length > MAX_HISTORY_STEPS) {
        return updated.slice(updated.length - MAX_HISTORY_STEPS);
      }
      return updated;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_STEPS - 1));
  }, [historyIndex]);

  // Load File (Universal Multi-Format Support)
  const loadSvgaFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await loadUniversalProject(file);
      const parsedProject = res.project;
      const parsedLayers = res.layers;

      // Check localStorage for persisted shine configuration as safety net
      try {
        const localShineStr = localStorage.getItem(`svga_shine_${file.name}`);
        if (localShineStr) {
          const localShineMap = JSON.parse(localShineStr);
          parsedLayers.forEach(l => {
            if (!l.shineConfig && localShineMap[l.id]) {
              l.shineConfig = localShineMap[l.id].shineConfig;
              if (localShineMap[l.id].shineExportMode) l.shineExportMode = localShineMap[l.id].shineExportMode;
              if (localShineMap[l.id].isShineLayer !== undefined) l.isShineLayer = localShineMap[l.id].isShineLayer;
            }
          });
        }
      } catch (e) {
        console.warn('Could not restore local shine config:', e);
      }

      setProject(parsedProject);
      setLayers(parsedLayers);
      setSelectedLayerId(parsedLayers[0]?.id || null);
      setSelectedLayerIds(parsedLayers[0]?.id ? [parsedLayers[0].id] : []);
      setCurrentFrame(0);
      setIsPlaying(true); // Automatically play as requested!
      setExportFileName(file.name.replace(/\.[^.]+$/, '') + '_edited.svga');

      // Initialize Edge Fade & Crop configs from project if present, or reset to 0
      setFadeConfig(parsedProject.fadeConfig ? { ...parsedProject.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 });
      setCropConfig(parsedProject.cropConfig ? { ...parsedProject.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 });
      setCropFeather(parsedProject.cropFeather ? { ...parsedProject.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 });
      
      // Auto-fit zoom based on screen size
      const maxW = window.innerWidth - 700;
      const maxH = window.innerHeight - 200;
      const scaleW = maxW / (parsedProject.width || 1);
      const scaleH = maxH / (parsedProject.height || 1);
      const fitZoom = Math.min(100, Math.max(25, Math.floor(Math.min(scaleW, scaleH) * 100)));
      setZoom(fitZoom);
      setPanOffset({ x: 0, y: 0 });

      // Init history memory-safely without deep-cloning heavy sprite refs & base64 thumbnails
      masterLayersMapRef.current.clear();
      parsedLayers.forEach(l => masterLayersMapRef.current.set(l.id, l));
      setHistory([createLayersSnapshot(parsedLayers)]);
      setHistoryIndex(0);

      const newSessionId = `proj_${Date.now()}`;
      const newSession: ProjectSession = {
        id: newSessionId,
        name: file.name.replace(/\.[^.]+$/, ''),
        originalFileName: file.name,
        fileType: (res.fileType as any) || 'svga',
        videoUrl: res.videoUrl,
        videoFile: res.videoFile,
        project: parsedProject,
        layers: parsedLayers,
        history: [createLayersSnapshot(parsedLayers)],
        historyIndex: 0,
        selectedLayerId: parsedLayers[0]?.id || null,
        selectedLayerIds: parsedLayers[0]?.id ? [parsedLayers[0].id] : [],
        currentFrame: 0,
        zoom: fitZoom,
        panOffset: { x: 0, y: 0 },
        fadeConfig: parsedProject.fadeConfig ? { ...parsedProject.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
        cropConfig: parsedProject.cropConfig ? { ...parsedProject.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
        cropFeather: parsedProject.cropFeather ? { ...parsedProject.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 },
        bgColor: 'transparent',
        bgImageUrl: bgImageUrl || null,
        exportFileName: file.name.replace(/\.[^.]+$/, '') + '_edited.svga',
        modifiedAt: Date.now()
      };
      setProjects(prev => {
        const filtered = prev.filter(p => p.originalFileName !== file.name);
        return [...filtered, newSession];
      });
      setActiveProjectId(newSessionId);

      setSuccessToast(`🎉 تم فتح وتشغيل المشروع بنجاح في سكريبت أفتر افكت (${parsedLayers.length} طبقة - ${parsedProject.totalFrames} إطار)`);
    } catch (err: any) {
      console.error("Failed to load project file:", err);
      setErrorMessage(err.message || 'حدث خطأ أثناء قراءة وتفكيك ملف المشروع.');
    } finally {
      setIsLoading(false);
    }
  }, [bgImageUrl]);

  // Handle Import MP4 as Full SVGA Project
  const handleImportMp4AsProject = useCallback((newProject: SVGAProjectData, newLayers: EditableLayer[], videoFile?: File) => {
    setProject(newProject);
    setLayers(newLayers);
    setSelectedLayerId(newLayers[0]?.id || null);
    setSelectedLayerIds(newLayers[0]?.id ? [newLayers[0].id] : []);
    setCurrentFrame(0);
    setIsPlaying(false);
    setExportFileName(newProject.fileName.replace(/\.svga$/i, '') + '_edited.svga');

    setFadeConfig(newProject.fadeConfig ? { ...newProject.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 });
    setCropConfig(newProject.cropConfig ? { ...newProject.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 });
    setCropFeather(newProject.cropFeather ? { ...newProject.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 });

    const maxW = window.innerWidth - 700;
    const maxH = window.innerHeight - 200;
    const scaleW = maxW / (newProject.width || 1);
    const scaleH = maxH / (newProject.height || 1);
    const fitZoom = Math.min(100, Math.max(25, Math.floor(Math.min(scaleW, scaleH) * 100)));
    setZoom(fitZoom);
    setPanOffset({ x: 0, y: 0 });

    masterLayersMapRef.current.clear();
    newLayers.forEach(l => masterLayersMapRef.current.set(l.id, l));
    setHistory([createLayersSnapshot(newLayers)]);
    setHistoryIndex(0);

    const videoUrl = videoFile ? URL.createObjectURL(videoFile) : undefined;
    const newSessionId = `proj_${Date.now()}`;
    const newSession: ProjectSession = {
      id: newSessionId,
      name: newProject.fileName.replace(/\.[^.]+$/, ''),
      originalFileName: newProject.fileName,
      fileType: 'mp4',
      videoUrl,
      videoFile,
      project: newProject,
      layers: newLayers,
      history: [createLayersSnapshot(newLayers)],
      historyIndex: 0,
      selectedLayerId: newLayers[0]?.id || null,
      selectedLayerIds: newLayers[0]?.id ? [newLayers[0].id] : [],
      currentFrame: 0,
      zoom: fitZoom,
      panOffset: { x: 0, y: 0 },
      fadeConfig: newProject.fadeConfig ? { ...newProject.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
      cropConfig: newProject.cropConfig ? { ...newProject.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
      cropFeather: newProject.cropFeather ? { ...newProject.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 },
      bgColor: 'transparent',
      bgImageUrl: bgImageUrl || null,
      exportFileName: newProject.fileName.replace(/\.svga$/i, '') + '_edited.svga',
      modifiedAt: Date.now()
    };
    setProjects(prev => {
      const filtered = prev.filter(p => p.originalFileName !== newProject.fileName);
      const updated = [...filtered, newSession];
      if (updated.length > 1) {
        setCanvasViewMode('multi');
      }
      return updated;
    });
    setActiveProjectId(newSessionId);

    setSuccessToast(`تم استدعاء فيديو MP4 بنجاح كملف SVGA كامل (${newProject.totalFrames} إطار)`);
  }, []);

  // Handle Import Multiple MP4 Projects concurrently
  const handleImportMultipleProjects = useCallback((items: { project: SVGAProjectData; layers: EditableLayer[]; file?: File; videoUrl?: string }[]) => {
    if (!items || items.length === 0) return;
    
    const newSessions: ProjectSession[] = items.map((item, idx) => {
      const sessionId = `proj_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const fileName = item.file?.name || item.project.fileName;
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const isVid = (item.file?.name.toLowerCase().endsWith('.mp4') || item.file?.type.startsWith('video/'));
      const videoUrl = item.videoUrl || (item.file ? URL.createObjectURL(item.file) : undefined);

      return {
        id: sessionId,
        name: baseName,
        originalFileName: fileName,
        fileType: isVid ? 'mp4' : 'svga',
        videoUrl,
        videoFile: item.file,
        project: item.project,
        layers: item.layers,
        history: [createLayersSnapshot(item.layers)],
        historyIndex: 0,
        selectedLayerId: item.layers[0]?.id || null,
        selectedLayerIds: item.layers[0]?.id ? [item.layers[0].id] : [],
        currentFrame: 0,
        zoom: 100,
        panOffset: { x: 0, y: 0 },
        fadeConfig: item.project.fadeConfig ? { ...item.project.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
        cropConfig: item.project.cropConfig ? { ...item.project.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
        cropFeather: item.project.cropFeather ? { ...item.project.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 },
        bgColor: 'transparent',
        bgImageUrl: bgImageUrl || null,
        exportFileName: baseName + '_edited.svga',
        modifiedAt: Date.now()
      };
    });

    setProjects(prev => {
      const updated = [...prev, ...newSessions];
      if (updated.length > 1) {
        setCanvasViewMode('multi');
      }
      return updated;
    });

    if (newSessions.length > 0) {
      const first = newSessions[0];
      setActiveProjectId(first.id);
      setProject(first.project);
      setLayers(first.layers);
      setSelectedLayerId(first.selectedLayerId);
      setSelectedLayerIds(first.selectedLayerIds);
      setCurrentFrame(0);
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
      setFadeConfig(first.fadeConfig);
      setCropConfig(first.cropConfig);
      setCropFeather(first.cropFeather);
      setExportFileName(first.exportFileName);
      masterLayersMapRef.current.clear();
      first.layers.forEach(l => masterLayersMapRef.current.set(l.id, l));
      setHistory([createLayersSnapshot(first.layers)]);
      setHistoryIndex(0);
    }

    setSuccessToast(`🎉 تم استدعاء وتحويل ${newSessions.length} فيديوهات إلى مشاريع SVGA وعرضها معاً بنجاح!`);
  }, []);

  // Handle Import Multiple MP4 Layers into existing project
  const handleImportMultipleLayers = useCallback((newLayers: EditableLayer[], addedAudios: SVGAAudioTrack[]) => {
    if (!newLayers || newLayers.length === 0) return;
    setLayers(prev => {
      const updated = [...newLayers, ...prev];
      pushHistory(updated);
      return updated;
    });

    if (addedAudios && addedAudios.length > 0) {
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          audios: [...(prev.audios || []), ...addedAudios]
        };
      });
    }

    setSelectedLayerId(newLayers[0].id);
    setSelectedLayerIds(newLayers.map(l => l.id));
    setSuccessToast(`تمت إضافة ${newLayers.length} طبقات فيديو MP4 إلى المشروع بنجاح`);
  }, [pushHistory]);

  // Handle Load Multiple Files (SVGA / MP4 / Images) at once into parallel project compositions
  const handleLoadMultipleFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);

    const newSessions: ProjectSession[] = [];
    let count = 0;

    for (const f of files) {
      count++;
      try {
        const res = await loadUniversalProject(f);
        const loadedProject: SVGAProjectData = res.project;
        const loadedLayers: EditableLayer[] = res.layers;
        const fileType: 'svga' | 'mp4' | 'image' | 'custom' = (res.fileType as any) || 'svga';
        const videoUrl: string | undefined = res.videoUrl;
        const videoFile: File | undefined = res.videoFile;

        const sessionId = `proj_${Date.now()}_${count}`;
        const sessionName = f.name.replace(/\.[^.]+$/, '');
        const session: ProjectSession = {
          id: sessionId,
          name: sessionName,
          originalFileName: f.name,
          fileType,
          videoUrl,
          videoFile,
          project: loadedProject,
          layers: loadedLayers,
          history: [createLayersSnapshot(loadedLayers)],
          historyIndex: 0,
          selectedLayerId: loadedLayers[0]?.id || null,
          selectedLayerIds: loadedLayers[0]?.id ? [loadedLayers[0].id] : [],
          currentFrame: 0,
          zoom: 100,
          panOffset: { x: 0, y: 0 },
          fadeConfig: loadedProject.fadeConfig ? { ...loadedProject.fadeConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
          cropConfig: loadedProject.cropConfig ? { ...loadedProject.cropConfig } : { top: 0, bottom: 0, left: 0, right: 0 },
          cropFeather: loadedProject.cropFeather ? { ...loadedProject.cropFeather } : { top: 0, bottom: 0, left: 0, right: 0 },
          bgColor: 'transparent',
          bgImageUrl: bgImageUrl || null,
          exportFileName: f.name.replace(/\.[^.]+$/, '') + '_edited.svga',
          modifiedAt: Date.now()
        };
        newSessions.push(session);
      } catch (err: any) {
        console.error(`Failed to load file ${f.name}:`, err);
      }
    }

    if (newSessions.length > 0) {
      setProjects(prev => [...prev, ...newSessions]);
      const first = newSessions[0];
      setActiveProjectId(first.id);
      setProject(first.project);
      setLayers(first.layers);
      setSelectedLayerId(first.selectedLayerId);
      setSelectedLayerIds(first.selectedLayerIds);
      setCurrentFrame(0);
      setIsPlaying(true);
      setZoom(100);
      setPanOffset({ x: 0, y: 0 });
      setFadeConfig(first.fadeConfig);
      setCropConfig(first.cropConfig);
      setCropFeather(first.cropFeather);
      setExportFileName(first.exportFileName);

      masterLayersMapRef.current.clear();
      first.layers.forEach(l => masterLayersMapRef.current.set(l.id, l));
      setHistory([createLayersSnapshot(first.layers)]);
      setHistoryIndex(0);

      setIsOverviewMode(false);
      setCanvasViewMode('multi');
      setSuccessToast(`🎉 تم فتح وعرض ${newSessions.length} مشاريع وفيديوهات بنجاح على الشاشة!`);
    } else {
      setErrorMessage('تعذر قراءة الملفات المحددة. يرجى التأكد من سلامة صيغ الملفات.');
    }
    setIsLoading(false);
  }, []);

  // Multi-Project Switching & Management Handlers
  const handleSwitchProject = useCallback((targetId: string) => {
    if (targetId === activeProjectId) {
      setIsOverviewMode(false);
      return;
    }

    // Save current active state into projects array before switching
    if (activeProjectId && project) {
      setProjects(prev => prev.map(p => {
        if (p.id === activeProjectId) {
          return {
            ...p,
            project,
            layers,
            fadeConfig,
            cropConfig,
            cropFeather,
            bgColor,
            bgImageUrl,
            currentFrame,
            selectedLayerId,
            selectedLayerIds,
            history,
            historyIndex,
            modifiedAt: Date.now()
          };
        }
        return p;
      }));
    }

    const targetSession = projects.find(p => p.id === targetId);
    if (!targetSession) return;

    setIsPlaying(false);
    setActiveProjectId(targetId);
    setProject(targetSession.project);
    setLayers(targetSession.layers);
    setHistory(targetSession.history && targetSession.history.length > 0 ? targetSession.history : [createLayersSnapshot(targetSession.layers)]);
    setHistoryIndex(targetSession.historyIndex >= 0 ? targetSession.historyIndex : 0);
    setSelectedLayerId(targetSession.selectedLayerId);
    setSelectedLayerIds(targetSession.selectedLayerIds || (targetSession.selectedLayerId ? [targetSession.selectedLayerId] : []));
    setCurrentFrame(targetSession.currentFrame || 0);
    setZoom(targetSession.zoom || 100);
    setPanOffset(targetSession.panOffset || { x: 0, y: 0 });
    setFadeConfig(targetSession.fadeConfig || { top: 0, bottom: 0, left: 0, right: 0 });
    setCropConfig(targetSession.cropConfig || { top: 0, bottom: 0, left: 0, right: 0 });
    setCropFeather(targetSession.cropFeather || { top: 0, bottom: 0, left: 0, right: 0 });
    setBgColor(targetSession.bgColor || 'transparent');
    setBgImageUrl(targetSession.bgImageUrl || null);
    setExportFileName(targetSession.exportFileName || targetSession.project.fileName.replace(/\.svga$/i, '') + '_edited.svga');

    masterLayersMapRef.current.clear();
    targetSession.layers.forEach(l => masterLayersMapRef.current.set(l.id, l));

    setIsOverviewMode(false);
    setSuccessToast(`المشروع النشط للتعديل: ${targetSession.name}`);
  }, [activeProjectId, project, layers, fadeConfig, cropConfig, cropFeather, bgColor, bgImageUrl, currentFrame, selectedLayerId, selectedLayerIds, history, historyIndex, projects]);

  // Merge another project's layers into the active project canvas
  const handleMergeProjectIntoActive = useCallback((sourceProjId: string) => {
    if (!project) return;
    const sourceProj = projects.find(p => p.id === sourceProjId);
    if (!sourceProj) return;

    const randKey = Math.random().toString(36).substring(2, 6);
    const prefix = `m_${randKey}_`;

    const updatedImagesMap = { ...project.imagesMap };
    const updatedRawImages = { ...project.rawImages };
    const keyTranslation: Record<string, string> = {};

    for (const [key, dataUrl] of Object.entries(sourceProj.project.imagesMap)) {
      const namespaced = `${prefix}${key}`;
      keyTranslation[key] = namespaced;
      updatedImagesMap[namespaced] = dataUrl;
      if (sourceProj.project.rawImages?.[key]) {
        updatedRawImages[namespaced] = sourceProj.project.rawImages[key];
      }
    }

    const clonedLayers: EditableLayer[] = sourceProj.layers.map((l, idx) => ({
      ...l,
      id: `mrg_${randKey}_${l.id}`,
      name: `[${sourceProj.name}] ${l.name}`,
      imageKey: l.imageKey && keyTranslation[l.imageKey] ? keyTranslation[l.imageKey] : l.imageKey,
      transform: {
        ...l.transform,
        x: l.transform.x + 20 * (idx + 1),
        y: l.transform.y + 20 * (idx + 1)
      }
    }));

    const newLayers = [...clonedLayers, ...layers];
    clonedLayers.forEach(l => masterLayersMapRef.current.set(l.id, l));
    setLayers(newLayers);
    setProject({
      ...project,
      imagesMap: updatedImagesMap,
      rawImages: updatedRawImages
    });
    pushHistory(newLayers);
    setSuccessToast(`تم دمج طبقات "${sourceProj.name}" بنجاح في المشروع النشط!`);
  }, [project, projects, layers, pushHistory]);

  // Merge all open projects and videos into a single master canvas as layers
  const handleMergeAllProjectsIntoSingleCanvas = useCallback(() => {
    if (!project || projects.length <= 1) return;

    let mergedImagesMap = { ...project.imagesMap };
    let mergedRawImages = { ...project.rawImages };
    let allAdditionalLayers: EditableLayer[] = [];

    projects.forEach((proj, pIdx) => {
      if (proj.id === activeProjectId) return;
      const randKey = Math.random().toString(36).substring(2, 6);
      const prefix = `m_${randKey}_`;
      const keyTranslation: Record<string, string> = {};

      for (const [key, dataUrl] of Object.entries(proj.project.imagesMap)) {
        const namespaced = `${prefix}${key}`;
        keyTranslation[key] = namespaced;
        mergedImagesMap[namespaced] = dataUrl;
        if (proj.project.rawImages?.[key]) {
          mergedRawImages[namespaced] = proj.project.rawImages[key];
        }
      }

      const clonedLayers: EditableLayer[] = proj.layers.map((l, idx) => ({
        ...l,
        id: `mrg_${randKey}_${l.id}`,
        name: `[${proj.name}] ${l.name}`,
        imageKey: l.imageKey && keyTranslation[l.imageKey] ? keyTranslation[l.imageKey] : l.imageKey,
        transform: {
          ...l.transform,
          x: l.transform.x + 30 * (pIdx + 1),
          y: l.transform.y + 30 * (pIdx + 1)
        }
      }));

      clonedLayers.forEach(l => masterLayersMapRef.current.set(l.id, l));
      allAdditionalLayers.push(...clonedLayers);
    });

    const finalLayers = [...allAdditionalLayers, ...layers];
    setLayers(finalLayers);
    setProject({
      ...project,
      imagesMap: mergedImagesMap,
      rawImages: mergedRawImages
    });
    pushHistory(finalLayers);
    setCanvasViewMode('single');
    setSuccessToast(`🎉 تم دمج جميع المشاريع والفيديوهات المفتوحة كطبقات في كانفاس واحد!`);
  }, [project, projects, activeProjectId, layers, pushHistory]);

  const handleCloseProject = useCallback((id: string) => {
    setProjects(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (id === activeProjectId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setTimeout(() => handleSwitchProject(next.id), 0);
        } else {
          setActiveProjectId(null);
          setProject(null);
          setLayers([]);
          setSelectedLayerId(null);
          setSelectedLayerIds([]);
        }
      }
      return remaining;
    });
  }, [activeProjectId, handleSwitchProject]);

  const handleDuplicateProject = useCallback((id: string) => {
    const target = projects.find(p => p.id === id);
    if (!target) return;
    const newId = `proj_${Date.now()}_copy`;
    const copySession: ProjectSession = {
      ...target,
      id: newId,
      name: `${target.name} (نسخة)`,
      modifiedAt: Date.now()
    };
    setProjects(prev => [...prev, copySession]);
    setSuccessToast(`تم إنشاء نسخة من المشروع: ${copySession.name}`);
  }, [projects]);

  const handleRenameProject = useCallback((id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  }, []);

  // Synchronize active project changes to projects session state (excluding currentFrame to prevent infinite loop & re-render spam during 60fps playback)
  useEffect(() => {
    if (!activeProjectId || !project) return;
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          project,
          layers,
          history,
          historyIndex,
          selectedLayerId,
          selectedLayerIds,
          zoom,
          panOffset,
          fadeConfig,
          cropConfig,
          cropFeather,
          bgColor,
          bgImageUrl,
          exportFileName,
          modifiedAt: Date.now()
        };
      }
      return p;
    }));
  }, [activeProjectId, project, layers, fadeConfig, cropConfig, cropFeather, exportFileName]);

  // Handle Import MP4 as Layer into Existing SVGA Project
  const handleImportMp4AsLayer = useCallback((newLayer: EditableLayer, addedAudios: SVGAAudioTrack[]) => {
    setLayers(prev => {
      const updated = [newLayer, ...prev];
      pushHistory(updated);
      return updated;
    });

    if (addedAudios && addedAudios.length > 0) {
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          audios: [...(prev.audios || []), ...addedAudios]
        };
      });
    }

    setSelectedLayerId(newLayer.id);
    setSelectedLayerIds([newLayer.id]);
    setSuccessToast(`تمت إضافة طبقة فيديو MP4 (${newLayer.name}) إلى المشروع بنجاح`);
  }, [pushHistory]);

  // Handle Initial File or Direct Transferred Project
  useEffect(() => {
    if (initialProject && initialLayers && initialLayers.length > 0) {
      handleImportMp4AsProject(initialProject, initialLayers);
    } else if (initialFile) {
      loadSvgaFile(initialFile);
    }
  }, [initialFile, initialProject, initialLayers, handleImportMp4AsProject, loadSvgaFile]);

  // Smooth Animation Frame Playback Loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || !project || project.totalFrames <= 1) return;

    let animId: number;
    let lastTime = performance.now();
    const frameDuration = 1000 / (project.fps || 30);
    let accumulatedTime = 0;

    const loop = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;
      accumulatedTime += delta;

      if (accumulatedTime >= frameDuration) {
        const framesToAdvance = Math.floor(accumulatedTime / frameDuration);
        accumulatedTime %= frameDuration;

        setCurrentFrame(prev => {
          const next = prev + framesToAdvance;
          if (next >= project.totalFrames) {
            if (isLoop) {
              return next % project.totalFrames;
            } else {
              setIsPlaying(false);
              return project.totalFrames - 1;
            }
          }
          return next;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, project, isLoop]);

  // Auto-dismiss toast
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [successToast]);
  // Layer Update Handlers
  const handleUpdateLayerTransform = useCallback((layerId: string, deltaTransform: Partial<EditableLayer['transform']>) => {
    setLayers(prev => {
      const target = prev.find(l => l.id === layerId);
      if (!target) return prev;

      const isSequence = Boolean(target.sequenceGroupId || (target.keyframeSummary?.isSequenceOrRepeated && target.imageKey));
      const targetSeqGroupId = target.sequenceGroupId;
      const targetImageKey = target.imageKey;

      const dx = deltaTransform.x !== undefined ? deltaTransform.x - target.transform.x : 0;
      const dy = deltaTransform.y !== undefined ? deltaTransform.y - target.transform.y : 0;
      const dScaleX = deltaTransform.scaleX !== undefined ? deltaTransform.scaleX - target.transform.scaleX : 0;
      const dScaleY = deltaTransform.scaleY !== undefined ? deltaTransform.scaleY - target.transform.scaleY : 0;
      const dRot = deltaTransform.rotation !== undefined ? deltaTransform.rotation - target.transform.rotation : 0;

      return prev.map(l => {
        if (l.id === layerId) {
          return {
            ...l,
            transform: {
              ...l.transform,
              ...deltaTransform
            }
          };
        }
        // If part of sequence/repeated group, propagate delta so sequential images move together like SVGA 2.0
        if (isSequence && (
          (targetSeqGroupId && l.sequenceGroupId === targetSeqGroupId) ||
          (targetImageKey && l.imageKey === targetImageKey && l.keyframeSummary?.isSequenceOrRepeated)
        )) {
          return {
            ...l,
            transform: {
              ...l.transform,
              x: l.transform.x + dx,
              y: l.transform.y + dy,
              scaleX: Math.max(0.01, l.transform.scaleX + dScaleX),
              scaleY: Math.max(0.01, l.transform.scaleY + dScaleY),
              rotation: l.transform.rotation + dRot,
              opacity: deltaTransform.opacity !== undefined ? deltaTransform.opacity : l.transform.opacity
            }
          };
        }
        return l;
      });
    });
  }, []);

  const handleUpdateLayerShineConfig = useCallback((layerId: string, shineDelta: Partial<ShineEffectConfig>) => {
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id === layerId) {
          const currentShine: ShineEffectConfig = l.shineConfig || {
            enabled: true,
            beamWidth: 50,
            angleDeg: 90,
            opacity: 0.85,
            featherSides: 0.85,
            featherTopBottom: 0.7,
            maskToAlpha: true,
            color: '255, 255, 255',
            keyframeStart: 0.0,
            keyframeEnd: 1.0,
            durationSeconds: 2.0
          };
          const newShine = {
            ...currentShine,
            ...shineDelta
          };
          return {
            ...l,
            shineExportMode: newShine.exportMode || l.shineExportMode,
            shineConfig: newShine
          };
        }
        return l;
      });
      pushHistory(updated);

      // Persist to localStorage for project
      try {
        if (project?.fileName) {
          const shineMap: Record<string, any> = {};
          updated.forEach(layerItem => {
            if (layerItem.shineConfig && layerItem.shineConfig.enabled) {
              shineMap[layerItem.id] = {
                shineConfig: layerItem.shineConfig,
                shineExportMode: layerItem.shineExportMode,
                isShineLayer: layerItem.isShineLayer
              };
            }
          });
          localStorage.setItem(`svga_shine_${project.fileName}`, JSON.stringify(shineMap));
        }
      } catch (e) {}

      return updated;
    });
  }, [pushHistory, project]);

  const handleResetShine = useCallback((layerId: string) => {
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id === layerId) {
          return {
            ...l,
            shineConfig: {
              enabled: true,
              beamWidth: 50,
              angleDeg: 90,
              opacity: 0.85,
              featherSides: 0.85,
              featherTopBottom: 0.7,
              maskToAlpha: true,
              color: '255, 255, 255',
              keyframeStart: 0.0,
              keyframeEnd: 1.0,
              durationSeconds: 2.0
            }
          };
        }
        return l;
      });
      pushHistory(updated);
      return updated;
    });
  }, [pushHistory]);

  const handleCreateShineLayer = useCallback(() => {
    if (!project) return;
    const shineLayerId = `shine_layer_${Date.now()}`;
    const newLayer: EditableLayer = {
      id: shineLayerId,
      originalIndex: 0,
      aspectRatioLocked: false,
      spriteRef: { imageKey: '', frames: [] },
      name: `✨ طبقة لمعة مستمرة ${layers.filter(l => l.isShineLayer).length + 1}`,
      type: 'shape',
      imageKey: '',
      isShineLayer: true,
      visible: true,
      locked: false,
      blendMode: 'screen',
      inFrame: 0,
      outFrame: project.totalFrames - 1,
      framesCount: project.totalFrames,
      keyframeSummary: {
        startFrame: 0,
        endFrame: project.totalFrames - 1,
        hasTransform: false,
        hasShapes: true,
        isSequenceOrRepeated: false
      },
      initialBounds: {
        x: 0,
        y: 0,
        width: project.width,
        height: project.height
      },
      transform: {
        x: 0,
        y: 0,
        width: project.width,
        height: project.height,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 100
      },
      shineConfig: {
        enabled: true,
        beamWidth: 80,
        angleDeg: 45,
        opacity: 0.9,
        featherSides: 0.85,
        featherTopBottom: 0.7,
        maskToAlpha: false,
        color: '#ffffff',
        speedMultiplier: 1.0,
        durationSeconds: 2.0,
        repeatInterval: 0.5,
        style: 'soft',
        direction: 'forward',
        exportMode: 'separate',
        editPathOnCanvas: true,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: project.width, y: project.height }
      }
    };
    setLayers(prev => {
      const updated = [newLayer, ...prev];
      pushHistory(updated);
      return updated;
    });
    setSelectedLayerId(shineLayerId);
    setSelectedLayerIds([shineLayerId]);
    setSuccessToast('تم إنشاء طبقة لمعة مستقلة جديدة بنجاح ✨');
  }, [project, layers, pushHistory]);

  const handleExportShineLayerOnly = useCallback(async () => {
    if (!project) return;
    try {
      setIsExporting(true);
      const shineLayers = layers.filter(l => l.isShineLayer || l.shineConfig?.enabled);
      if (shineLayers.length === 0) {
        alert('لا توجد طبقات لمعة مفعلة لتصديرها وحدها');
        setIsExporting(false);
        return;
      }
      
      const { blob, fileName } = await exportEditedSvga(
        project,
        shineLayers,
        `${project.fileName.replace(/\.svga$/i, '')}_shine_only.svga`,
        { fadeConfig, cropConfig, cropFeather }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccessToast(`تم تصدير طبقة اللمعة وحدها بنجاح: ${fileName} (${(blob.size / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.error('Error exporting shine layer only:', err);
      alert(err?.message || 'فشل تصدير طبقة اللمعة');
    } finally {
      setIsExporting(false);
    }
  }, [project, layers, fadeConfig, cropConfig, cropFeather]);

  // Synchronize motion path across all layers in a sequence/repeated group (SVGA 2.0 Motion Sync)
  const handleSyncSequenceMotion = useCallback((layerIdOrGroupId: string) => {
    if (!project) return;
    const targetLayer = layers.find(l => l.id === layerIdOrGroupId || l.sequenceGroupId === layerIdOrGroupId);
    if (!targetLayer) return;

    const seqGroup = layers.filter(l => 
      (targetLayer.sequenceGroupId && l.sequenceGroupId === targetLayer.sequenceGroupId) ||
      (l.imageKey && l.imageKey === targetLayer.imageKey && (l.keyframeSummary?.isSequenceOrRepeated || l.sequenceGroupId))
    );

    if (seqGroup.length <= 1) {
      setSuccessToast('لا توجد طبقات تسلسلية متكررة أخرى مرتبطة بهذه الطبقة');
      return;
    }

    const refLayer = seqGroup.find(l => l.id === targetLayer.id) || seqGroup[0];
    const totalFrames = project.totalFrames || 60;

    const updatedLayers = layers.map(l => {
      if (seqGroup.some(member => member.id === l.id) && l.id !== refLayer.id) {
        return syncLayerMotionWithReference(l, refLayer, totalFrames);
      }
      return l;
    });

    setLayers(updatedLayers);
    pushHistory(updatedLayers);
    setSuccessToast(`تمت مزامنة مسار الحركة بدقة SVGA 2.0 عبر جميع طبقات التسلسل (${seqGroup.length} طبقات)`);
  }, [project, layers, pushHistory]);

  // Bulk Transforms Handler (e.g. from Canvas mouse drag or Properties Panel)
  const handleBulkUpdateTransforms = useCallback((updates: Array<{ id: string; transform: Partial<EditableLayer['transform']> }>) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.transform]));
    setLayers(prev => prev.map(l => {
      const delta = updatesMap.get(l.id);
      if (delta) {
        return {
          ...l,
          transform: {
            ...l.transform,
            ...delta
          }
        };
      }
      return l;
    }));
  }, []);

  // Multi-Selection Bulk Math Transformer
  const handleBulkTransform = useCallback((deltas: {
    dx?: number;
    dy?: number;
    scaleMultiplier?: number;
    scaleMultiplierX?: number;
    scaleMultiplierY?: number;
    flipHorizontally?: boolean;
    flipVertically?: boolean;
    rotationDelta?: number;
    setRotation?: number;
    opacityDelta?: number;
    setOpacity?: number;
    alignToCanvas?: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'centerAll';
    canvasWidth?: number;
    canvasHeight?: number;
  }) => {
    if (selectedLayerIds.length === 0) return;
    setLayers(prev => {
      const fullDeltas = {
        ...deltas,
        canvasWidth: deltas.canvasWidth || project?.width || 500,
        canvasHeight: deltas.canvasHeight || project?.height || 500
      };
      const updated = transformSelectedLayers(prev, selectedLayerIds, fullDeltas);
      pushHistory(updated);
      return updated;
    });
  }, [selectedLayerIds, pushHistory, project?.width, project?.height]);

  // Select Single or Multi Layer Handler
  const handleSelectLayer = useCallback((layerId: string | null, isMulti?: boolean) => {
    if (!layerId) {
      if (!isMulti) {
        setSelectedLayerId(null);
        setSelectedLayerIds([]);
      }
      return;
    }

    if (isMulti) {
      setSelectedLayerIds(prev => {
        if (prev.includes(layerId)) {
          const filtered = prev.filter(id => id !== layerId);
          setSelectedLayerId(filtered[0] || null);
          return filtered;
        } else {
          setSelectedLayerId(layerId);
          return [...prev, layerId];
        }
      });
    } else {
      setSelectedLayerId(layerId);
      setSelectedLayerIds([layerId]);
    }
  }, []);

  // Toggle specific layer selection (locked layers cannot be selected)
  const handleToggleLayerSelection = useCallback((layerId: string) => {
    const target = layers.find(l => l.id === layerId);
    if (target?.locked) {
      setErrorMessage(`الطبقة "${target.name}" مقفلة بقفل. قم بإلغاء القفل أولاً لتحديدها.`);
      return;
    }

    setSelectedLayerIds(prev => {
      if (prev.includes(layerId)) {
        const filtered = prev.filter(id => id !== layerId);
        if (selectedLayerId === layerId) {
          setSelectedLayerId(filtered[0] || null);
        }
        return filtered;
      } else {
        setSelectedLayerId(layerId);
        return [...prev, layerId];
      }
    });
  }, [selectedLayerId, layers]);

  // Select All, Range, or Subsets of Layers (e.g. Merged File or Base Layers)
  // CRITICAL RULE: Layers with locked: true MUST NEVER be selected when selecting all layers!
  const handleSelectAllLayers = useCallback((allSelected: boolean, filterScope?: 'all' | 'bundles' | 'base' | string[]) => {
    if (!allSelected) {
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
      setSuccessToast('تم إلغاء التحديد الجماعي');
      return;
    }

    let targetIds: string[] = [];

    // Filter out locked layers strictly
    if (Array.isArray(filterScope)) {
      targetIds = filterScope.filter(id => {
        const l = layers.find(layer => layer.id === id);
        return l && !l.locked;
      });
    } else if (filterScope === 'bundles') {
      targetIds = layers
        .filter(l => !l.locked && Boolean(l.groupId || l.id.startsWith('mrg_') || l.imageKey.startsWith('mrg_') || (l.name && l.name.includes('(مدمج)'))))
        .map(l => l.id);
    } else if (filterScope === 'base') {
      targetIds = layers
        .filter(l => !l.locked && !l.groupId && !l.id.startsWith('mrg_') && !l.imageKey.startsWith('mrg_') && !(l.name && l.name.includes('(مدمج)')))
        .map(l => l.id);
    } else {
      // 'all' or undefined: ONLY select unlocked layers
      targetIds = layers.filter(l => !l.locked).map(l => l.id);
    }

    const lockedLayersCount = layers.filter(l => l.locked).length;

    if (targetIds.length > 0) {
      setSelectedLayerIds(targetIds);
      setSelectedLayerId(targetIds[0]);
      const lockedSuffix = lockedLayersCount > 0 ? ` (تم استثناء ${lockedLayersCount} طبقات مقفلة)` : '';
      if (filterScope === 'bundles') {
        setSuccessToast(`تم تحديد طبقات الملف المدمج غير المقفلة (${targetIds.length} طبقة)${lockedSuffix}`);
      } else if (filterScope === 'base') {
        setSuccessToast(`تم تحديد طبقات الملف الأساسي غير المقفلة (${targetIds.length} طبقة)${lockedSuffix}`);
      } else {
        setSuccessToast(`تم تحديد جميع الطبقات غير المقفلة (${targetIds.length} طبقة)${lockedSuffix}`);
      }
    } else {
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
      if (lockedLayersCount > 0) {
        setSuccessToast(`جميع الطبقات المستهدفة مقفلة بقفل (${lockedLayersCount} طبقة)، افتح القفل لتحديدها`);
      }
    }
  }, [layers]);

  // Keyframes Update Handler
  const handleUpdateLayerKeyframes = useCallback((layerId: string, keyframes: LayerKeyframe[]) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layerId) {
        return {
          ...l,
          keyframes
        };
      }
      return l;
    }));
  }, []);

  const handleUpdateProjectDuration = useCallback((durationSec: number) => {
    setProject(prev => {
      if (!prev) return prev;
      const validDuration = Math.max(0.1, Math.min(60, durationSec));
      const totalFrames = Math.max(1, Math.min(3600, Math.round(validDuration * prev.fps)));
      
      setCurrentFrame(curr => Math.min(curr, totalFrames - 1));

      return {
        ...prev,
        durationSec: validDuration,
        totalFrames
      };
    });
  }, []);

  const handleUpdateProjectDimensions = useCallback((newWidth: number, newHeight: number, scaleLayers: boolean = false) => {
    setProject(prev => {
      if (!prev) return prev;
      const validW = Math.max(10, Math.min(8192, Math.round(newWidth)));
      const validH = Math.max(10, Math.min(8192, Math.round(newHeight)));

      const oldW = prev.width || 500;
      const oldH = prev.height || 500;

      if (scaleLayers && oldW > 0 && oldH > 0 && (oldW !== validW || oldH !== validH)) {
        const scaleX = validW / oldW;
        const scaleY = validH / oldH;

        setLayers(currentLayers => {
          const updated = currentLayers.map(l => ({
            ...l,
            transform: {
              ...l.transform,
              x: Math.round(l.transform.x * scaleX * 10) / 10,
              y: Math.round(l.transform.y * scaleY * 10) / 10,
              width: Math.round(l.transform.width * scaleX),
              height: Math.round(l.transform.height * scaleY),
              scaleX: Math.round(l.transform.scaleX * scaleX * 1000) / 1000,
              scaleY: Math.round(l.transform.scaleY * scaleY * 1000) / 1000
            }
          }));
          pushHistory(updated);
          return updated;
        });
      }

      setSuccessToast(`تم تغيير مقاس المشروع إلى ${validW} × ${validH} بكسل`);

      return {
        ...prev,
        width: validW,
        height: validH
      };
    });
  }, [pushHistory]);

  const handleToggleVisibility = useCallback((layerId: string) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
      pushHistory(updated);
      return updated;
    });
  }, [pushHistory]);

  const handleToggleAllVisibility = useCallback((makeVisible?: boolean) => {
    setLayers(prev => {
      const targetState = makeVisible !== undefined 
        ? makeVisible 
        : !prev.every(l => l.visible);
      const updated = prev.map(l => ({ ...l, visible: targetState }));
      pushHistory(updated);
      setSuccessToast(targetState ? 'تم إظهار جميع الطبقات' : 'تم إخفاء جميع الطبقات');
      return updated;
    });
  }, [pushHistory]);

  const handleToggleLock = useCallback((layerId: string) => {
    setLayers(prev => {
      const target = prev.find(l => l.id === layerId);
      const willBeLocked = target ? !target.locked : false;
      const updated = prev.map(l => l.id === layerId ? { ...l, locked: willBeLocked } : l);
      pushHistory(updated);

      // If locking, remove immediately from active selection
      if (willBeLocked) {
        setSelectedLayerIds(curr => curr.filter(id => id !== layerId));
        setSelectedLayerId(curr => curr === layerId ? null : curr);
        setSuccessToast(`تم قفل الطبقة "${target?.name || ''}" واستثناؤها من التحديد`);
      } else {
        setSuccessToast(`تم فتح قفل الطبقة "${target?.name || ''}"`);
      }
      return updated;
    });
  }, [pushHistory]);

  const handleToggleAllLock = useCallback((makeLocked?: boolean) => {
    setLayers(prev => {
      const targetState = makeLocked !== undefined 
        ? makeLocked 
        : !prev.every(l => l.locked);
      const updated = prev.map(l => ({ ...l, locked: targetState }));
      pushHistory(updated);
      setSuccessToast(targetState ? 'تم قفل جميع الطبقات واستثناؤها من التحديد' : 'تم فتح قفل جميع الطبقات');
      if (targetState) {
        setSelectedLayerIds([]);
        setSelectedLayerId(null);
      }
      return updated;
    });
  }, [pushHistory]);

  const handleToggleAspectLock = useCallback(() => {
    if (!selectedLayerId) return;
    setLayers(prev => {
      const updated = prev.map(l => l.id === selectedLayerId ? { ...l, aspectRatioLocked: !l.aspectRatioLocked } : l);
      pushHistory(updated);
      return updated;
    });
  }, [selectedLayerId, pushHistory]);

  const handleReorderLayer = useCallback((layerId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setLayers(prev => {
      const activeIds = selectedLayerIds.length > 1 && selectedLayerIds.includes(layerId)
        ? selectedLayerIds
        : [layerId];

      const newLayers = reorderSelectedLayers(prev, activeIds, direction);
      pushHistory(newLayers);

      const directionLabels = {
        top: 'إلى أعلى المقدمة',
        bottom: 'إلى أسفل الخلفية',
        up: 'للأعلى خطوة',
        down: 'للأسفل خطوة'
      };

      if (activeIds.length > 1) {
        setSuccessToast(`تم نقل ${activeIds.length} طبقة ${directionLabels[direction]} معاً`);
      }

      return newLayers;
    });
  }, [selectedLayerIds, pushHistory]);

  // Direct move / Drag and drop layer above or below any target layer
  const handleMoveLayer = useCallback((sourceId: string, targetId: string, position: 'above' | 'below') => {
    setLayers(prev => {
      const activeIds = selectedLayerIds.length > 1 && selectedLayerIds.includes(sourceId)
        ? selectedLayerIds
        : [sourceId];

      const newLayers = moveSelectedLayersToTarget(prev, activeIds, targetId, position);
      pushHistory(newLayers);

      const targetLayer = prev.find(l => l.id === targetId);
      if (activeIds.length > 1) {
        setSuccessToast(`تم نقل ${activeIds.length} طبقة محددة معاً ${position === 'above' ? 'فوق' : 'تحت'} "${targetLayer?.name || 'الطبقة المستهدفة'}"`);
      } else {
        const movedLayer = prev.find(l => l.id === sourceId);
        setSuccessToast(`تم نقل الطبقة "${movedLayer?.name || ''}" ${position === 'above' ? 'فوق' : 'تحت'} "${targetLayer?.name || ''}"`);
      }

      return newLayers;
    });
  }, [selectedLayerIds, pushHistory]);

  const handleDuplicateLayer = useCallback((layerId: string, mirror: boolean = false) => {
    setLayers(prev => {
      const activeIds = selectedLayerIds.length > 1 && selectedLayerIds.includes(layerId)
        ? selectedLayerIds
        : [layerId];

      if (activeIds.length > 1) {
        const { updatedLayers, newSelectedIds } = duplicateSelectedLayers(prev, activeIds, mirror, project?.width || 500);
        setSelectedLayerIds(newSelectedIds);
        setSelectedLayerId(newSelectedIds[0] || null);
        pushHistory(updatedLayers);
        setSuccessToast(mirror ? `تم تكرار وعكس ${activeIds.length} طبقة أفقياً معاً` : `تم تكرار ${activeIds.length} طبقة معاً`);
        return updatedLayers;
      }

      const targetIndex = prev.findIndex(l => l.id === layerId);
      const target = prev[targetIndex];
      if (!target || targetIndex === -1) return prev;

      const newId = `layer_${Date.now()}_copy`;
      const cloned: EditableLayer = JSON.parse(JSON.stringify(target));
      cloned.id = newId;
      cloned.locked = false;
      cloned.name = `${target.name} (نسخة ${mirror ? 'معكوسة' : ''})`;
      cloned.isDuplicate = true;
      cloned.sourceLayerId = target.id;
      cloned.isMirroredLayer = mirror;
      cloned.linkedMirroredLayerId = target.id;
      cloned.autoSyncMirroredAsset = true;
      cloned.autoFlipMirroredAsset = mirror;
      cloned.isMotionSynced = false;
      cloned.motionReferenceLayerId = undefined;

      const layerW = target.transform.width || target.initialBounds?.width || 100;
      if (mirror && project) {
        // Mirror horizontally across the canvas center with exact bounding box alignment
        cloned.transform.x = project.width - (target.transform.x + layerW);
        cloned.transform.scaleX = -target.transform.scaleX;
        if (cloned.transform.rotation) {
          cloned.transform.rotation = -cloned.transform.rotation;
        }

        // Mirror all keyframes
        if (cloned.keyframes) {
          cloned.keyframes.forEach(kf => {
            if (kf.x !== undefined) kf.x = project.width - (kf.x + layerW);
            if (kf.scaleX !== undefined) kf.scaleX = -kf.scaleX;
            if (kf.rotation !== undefined) kf.rotation = -kf.rotation;
          });
        }
      } else {
        // Just offset slightly for normal duplicate
        cloned.transform.x = target.transform.x + 20;
        cloned.transform.y = target.transform.y + 20;
        if (cloned.keyframes) {
          cloned.keyframes.forEach(kf => {
            if (kf.x !== undefined) kf.x += 20;
            if (kf.y !== undefined) kf.y += 20;
          });
        }
      }

      // Configure duplicated layer's own isolated snapshot
      cloned.originalInitialBounds = {
        x: cloned.transform.x,
        y: cloned.transform.y,
        width: cloned.transform.width,
        height: cloned.transform.height
      };
      cloned.initialBounds = { ...cloned.originalInitialBounds };
      cloned.originalTransform = JSON.parse(JSON.stringify(cloned.transform));
      cloned.originalSpriteFrames = JSON.parse(JSON.stringify(cloned.spriteRef?.frames || []));
      cloned.originalKeyframes = cloned.keyframes ? JSON.parse(JSON.stringify(cloned.keyframes)) : undefined;

      // Update source target layer to link back to twin
      const updatedTarget: EditableLayer = {
        ...target,
        linkedMirroredLayerId: newId,
        autoSyncMirroredAsset: true
      };

      masterLayersMapRef.current.set(newId, cloned);
      masterLayersMapRef.current.set(target.id, updatedTarget);

      const updated = [
        ...prev.slice(0, targetIndex),
        updatedTarget,
        cloned,
        ...prev.slice(targetIndex + 1)
      ];
      setSelectedLayerId(newId);
      setSelectedLayerIds([newId]);
      pushHistory(updated);
      setSuccessToast(mirror ? `تم تكرار الطبقة وعكسها أفقياً وربطها توأماً مع الأصلية` : `تم تكرار الطبقة: ${target.name}`);
      return updated;
    });
  }, [selectedLayerIds, pushHistory, project]);

  const handleDeleteLayer = useCallback((layerId: string) => {
    setLayers(prev => {
      const activeIds = selectedLayerIds.length > 1 && selectedLayerIds.includes(layerId)
        ? selectedLayerIds
        : [layerId];

      if (activeIds.length > 1) {
        const updated = deleteSelectedLayers(prev, activeIds);
        setSelectedLayerId(updated[0]?.id || null);
        setSelectedLayerIds(updated[0]?.id ? [updated[0].id] : []);
        pushHistory(updated);
        setSuccessToast(`تم حذف ${activeIds.length} طبقة محددة معاً بنجاح`);
        return updated;
      }

      const updated = prev.filter(l => l.id !== layerId);
      if (selectedLayerId === layerId) {
        setSelectedLayerId(updated[0]?.id || null);
        setSelectedLayerIds(updated[0]?.id ? [updated[0].id] : []);
      }
      pushHistory(updated);
      setSuccessToast('تم حذف الطبقة بنجاح');
      return updated;
    });
  }, [selectedLayerIds, selectedLayerId, pushHistory]);

  const handleRenameLayer = useCallback((layerId: string, newName: string) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, name: newName } : l);
      pushHistory(updated);
      return updated;
    });
  }, [pushHistory]);

  const handleResetTransform = useCallback((layerId?: string) => {
    const targetIds = layerId 
      ? [layerId] 
      : selectedLayerIds.length > 1 
      ? selectedLayerIds 
      : selectedLayerId ? [selectedLayerId] : [];

    if (targetIds.length === 0) return;

    setLayers(prev => {
      let targetNames: string[] = [];
      const updated = prev.map(l => {
        if (targetIds.includes(l.id)) {
          targetNames.push(l.name);
          
          // Absolute original native coordinates (completely independent of duplicate or merged copies)
          const origX = l.originalInitialBounds?.x ?? l.initialBounds.x;
          const origY = l.originalInitialBounds?.y ?? l.initialBounds.y;
          const origW = l.originalInitialBounds?.width ?? l.initialBounds.width;
          const origH = l.originalInitialBounds?.height ?? l.initialBounds.height;

          // Restore native original sprite frames (purging all cross-layer synced matrix transforms)
          let restoredSpriteRef = l.spriteRef;
          if (l.originalSpriteFrames && l.originalSpriteFrames.length > 0) {
            restoredSpriteRef = {
              ...l.spriteRef,
              frames: JSON.parse(JSON.stringify(l.originalSpriteFrames))
            };
          }

          // Restore native keyframes if layer was originally animated, otherwise clear keyframes
          const restoredKeyframes = l.originalKeyframes && l.originalKeyframes.length > 0
            ? JSON.parse(JSON.stringify(l.originalKeyframes))
            : undefined;

          return {
            ...l,
            isMotionSynced: false,
            motionReferenceLayerId: undefined,
            spriteRef: restoredSpriteRef,
            initialBounds: {
              x: origX,
              y: origY,
              width: origW,
              height: origH
            },
            transform: {
              ...l.transform,
              x: origX,
              y: origY,
              width: origW,
              height: origH,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 100
            },
            keyframes: restoredKeyframes
          };
        }
        return l;
      });
      pushHistory(updated);
      if (targetIds.length === 1 && targetNames[0]) {
        setSuccessToast(`تمت استعادة الطبقة "${targetNames[0]}" لمكانها الأصلي وتجريدها من أي ارتباط بنجاح`);
      } else {
        setSuccessToast(`تمت استعادة ${targetIds.length} طبقات إلى مواضعها الأصلية بنجاح`);
      }
      return updated;
    });
  }, [selectedLayerId, selectedLayerIds, pushHistory]);

  const handleReplaceAsset = useCallback(async (file: File) => {
    if (!selectedLayerId || !project) return;
    try {
      const { dataUrl, bytes, width: newWidth, height: newHeight } = await fileToImageBuffer(file);
      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      const imgKey = layer.imageKey;

      // Determine previous base layout / frame dimensions
      const prevLayoutW = layer.spriteRef?.frames?.[0]?.layout?.width || layer.initialBounds?.width || layer.transform?.width || newWidth;
      const prevLayoutH = layer.spriteRef?.frames?.[0]?.layout?.height || layer.initialBounds?.height || layer.transform?.height || newHeight;

      // Calculate scale compensation factor to automatically adopt and maintain original layer dimensions
      const scaleRatioX = (newWidth > 0 && prevLayoutW > 0) ? (prevLayoutW / newWidth) : 1;
      const scaleRatioY = (newHeight > 0 && prevLayoutH > 0) ? (prevLayoutH / newHeight) : 1;

      const targetW = layer.transform.width;
      const targetH = layer.transform.height;

      // Find twin / mirrored / duplicate layers linked to this layer or sharing the same image
      const checkIsLayerMirrored = (l: EditableLayer) => {
        if (l.isMirroredLayer) return true;
        if (l.transform.scaleX < 0) return true;
        if (Boolean(l.autoFlipMirroredAsset)) return true;
        if (l.spriteRef?.frames?.some((fr: any) => fr?.transform && ((fr.transform.a !== undefined && fr.transform.a < -0.01) || (fr.transform.a * fr.transform.d - fr.transform.b * fr.transform.c < -0.01)))) {
          return true;
        }
        if (l.originalSpriteFrames?.some((fr: any) => fr?.transform && ((fr.transform.a !== undefined && fr.transform.a < -0.01) || (fr.transform.a * fr.transform.d - fr.transform.b * fr.transform.c < -0.01)))) {
          return true;
        }
        const nameLower = (l.name || '').toLowerCase();
        return nameLower.includes('mirror') || nameLower.includes('معكوس') || nameLower.includes('twin') || nameLower.includes('عكس');
      };

      const twinLayers = layers.filter(other => 
        other.id !== layer.id && (
          other.id === layer.linkedMirroredLayerId ||
          other.linkedMirroredLayerId === layer.id ||
          other.sourceLayerId === layer.id ||
          layer.sourceLayerId === other.id ||
          other.imageKey === imgKey ||
          (other.spriteRef?.imageKey && other.spriteRef.imageKey === imgKey)
        )
      );

      const shouldSyncTwin = layer.autoSyncMirroredAsset !== false;
      let flippedBuffer: { dataUrl: string; bytes: Uint8Array; width: number; height: number } | null = null;

      if (shouldSyncTwin && twinLayers.length > 0) {
        const needsFlip = twinLayers.some(t => {
          const hasNegativeMatrix = t.spriteRef?.frames?.some((fr: any) => fr?.transform && fr.transform.a !== undefined && fr.transform.a < -0.01);
          // If the SVGA sprite frame itself already has negative scale matrix a < 0, it flips natively.
          // Otherwise, if it's marked as mirrored or scaleX < 0, it needs pixel flipping.
          return checkIsLayerMirrored(t) && !hasNegativeMatrix;
        });

        if (needsFlip) {
          try {
            flippedBuffer = await getFlippedImageBuffer(bytes, true, false);
          } catch (e) {
            console.warn('Could not generate flipped buffer for mirrored twin:', e);
          }
        }
      }

      const projectUpdatesRaw: Record<string, Uint8Array> = { [imgKey]: bytes };
      const projectUpdatesMap: Record<string, string> = { [imgKey]: dataUrl };

      const twinKeyMap = new Map<string, string>();
      const twinUrlMap = new Map<string, string>();

      if (shouldSyncTwin && twinLayers.length > 0) {
        for (const twin of twinLayers) {
          const isMirrored = checkIsLayerMirrored(twin);
          const hasNegativeMatrix = twin.spriteRef?.frames?.some((fr: any) => fr?.transform && fr.transform.a !== undefined && fr.transform.a < -0.01);
          
          // If frame matrix already flips (a < 0), use un-flipped bytes so SVGA matrix flips it once;
          // if it doesn't have matrix flip, use flippedBuffer.
          const willFlip = isMirrored && !hasNegativeMatrix && flippedBuffer !== null;
          const assignedDataUrl = willFlip ? flippedBuffer!.dataUrl : dataUrl;
          const assignedBytes = willFlip ? flippedBuffer!.bytes : bytes;

          let targetTwinKey = twin.imageKey;
          if (willFlip && targetTwinKey === imgKey) {
            targetTwinKey = `${imgKey}_mirrored_${Date.now()}_${twin.id.slice(-4)}`;
          }

          twinKeyMap.set(twin.id, targetTwinKey);
          twinUrlMap.set(twin.id, assignedDataUrl);

          projectUpdatesRaw[targetTwinKey] = assignedBytes;
          projectUpdatesMap[targetTwinKey] = assignedDataUrl;
        }
      }

      // Update in project imagesMap and rawImages (ensures both canvas preview and SVGA binary export update immediately)
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rawImages: {
            ...prev.rawImages,
            ...projectUpdatesRaw
          },
          imagesMap: {
            ...prev.imagesMap,
            ...projectUpdatesMap
          }
        };
      });

      // Update layer thumbnail, dimensions, and sprite frames for target layer AND all linked/copied layers
      setLayers(prev => {
        const updated = prev.map(l => {
          if (l.id === selectedLayerId) {
            let updatedSpriteRef = l.spriteRef;
            if (l.spriteRef && l.spriteRef.frames) {
              const updatedFrames = l.spriteRef.frames.map((fr: any) => {
                if (!fr) return fr;
                const t = fr.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                return {
                  ...fr,
                  layout: {
                    ...(fr.layout || {}),
                    width: newWidth,
                    height: newHeight
                  },
                  transform: {
                    ...t,
                    a: (t.a ?? 1) * scaleRatioX,
                    b: (t.b ?? 0) * scaleRatioY,
                    c: (t.c ?? 0) * scaleRatioX,
                    d: (t.d ?? 1) * scaleRatioY,
                    tx: t.tx ?? 0,
                    ty: t.ty ?? 0
                  }
                };
              });
              updatedSpriteRef = {
                ...l.spriteRef,
                frames: updatedFrames
              };
            }

            const updatedLayer: EditableLayer = {
              ...l,
              thumbnailUrl: dataUrl,
              spriteRef: updatedSpriteRef,
              transform: {
                ...l.transform,
                width: targetW,
                height: targetH
              },
              initialBounds: {
                ...l.initialBounds,
                width: targetW,
                height: targetH
              }
            };
            masterLayersMapRef.current.set(l.id, updatedLayer);
            return updatedLayer;
          }

          // If layer is in twinLayers or shares imgKey
          if (twinLayers.some(t => t.id === l.id) || l.imageKey === imgKey) {
            const twinKey = twinKeyMap.get(l.id) || l.imageKey;
            const twinUrl = twinUrlMap.get(l.id) || dataUrl;

            const twinLayoutW = l.spriteRef?.frames?.[0]?.layout?.width || l.initialBounds?.width || l.transform?.width || newWidth;
            const twinLayoutH = l.spriteRef?.frames?.[0]?.layout?.height || l.initialBounds?.height || l.transform?.height || newHeight;
            const twinScaleX = (newWidth > 0 && twinLayoutW > 0) ? (twinLayoutW / newWidth) : 1;
            const twinScaleY = (newHeight > 0 && twinLayoutH > 0) ? (twinLayoutH / newHeight) : 1;

            let updatedTwinSprite = l.spriteRef;
            if (l.spriteRef && l.spriteRef.frames) {
              const updatedFrames = l.spriteRef.frames.map((fr: any) => {
                if (!fr) return fr;
                const t = fr.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                return {
                  ...fr,
                  layout: {
                    ...(fr.layout || {}),
                    width: newWidth,
                    height: newHeight
                  },
                  transform: {
                    ...t,
                    a: (t.a ?? 1) * twinScaleX,
                    b: (t.b ?? 0) * twinScaleY,
                    c: (t.c ?? 0) * twinScaleX,
                    d: (t.d ?? 1) * twinScaleY,
                    tx: t.tx ?? 0,
                    ty: t.ty ?? 0
                  }
                };
              });
              updatedTwinSprite = {
                ...l.spriteRef,
                imageKey: twinKey,
                frames: updatedFrames
              };
            }

            const updatedTwin: EditableLayer = {
              ...l,
              imageKey: twinKey,
              thumbnailUrl: twinUrl,
              spriteRef: updatedTwinSprite,
              transform: {
                ...l.transform,
                width: targetW,
                height: targetH
              },
              initialBounds: {
                ...l.initialBounds,
                width: targetW,
                height: targetH
              }
            };
            masterLayersMapRef.current.set(l.id, updatedTwin);
            return updatedTwin;
          }

          return l;
        });
        pushHistory(updated);
        return updated;
      });

      const syncedMsg = (shouldSyncTwin && twinLayers.length > 0)
        ? ` وتمت مزامنة الطبقات المنسوخة والمعكوسة المقترنة (${twinLayers.map(t => t.name).join(', ')}) وحفظها تلقائياً للتصدير بنجاح ✓`
        : '';
      setSuccessToast(`تم استبدال صورة الطبقة وتحديث الطبقات المنسوخة والمعكوسة بنجاح (${targetW}×${targetH}): ${layer.name}${syncedMsg}`);
    } catch (err: any) {
      console.error('Failed to replace image asset:', err);
    }
  }, [selectedLayerId, project, layers, pushHistory]);

  // Link or unlink a mirrored twin layer
  const handleLinkMirroredLayer = useCallback((layerId: string, twinLayerId: string | null) => {
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id === layerId) {
          return {
            ...l,
            linkedMirroredLayerId: twinLayerId || undefined,
            autoSyncMirroredAsset: true
          };
        }
        if (twinLayerId && l.id === twinLayerId) {
          return {
            ...l,
            linkedMirroredLayerId: layerId,
            isMirroredLayer: true,
            autoSyncMirroredAsset: true,
            autoFlipMirroredAsset: true
          };
        }
        // If unlinking previous twin
        if (!twinLayerId && l.linkedMirroredLayerId === layerId) {
          return {
            ...l,
            linkedMirroredLayerId: undefined
          };
        }
        return l;
      });
      pushHistory(updated);
      setSuccessToast(twinLayerId ? 'تم ربط الطبقة المعكوسة بنجاح وتفعيل المزامنة التلقائية' : 'تم إلغاء ربط الطبقة المعكوسة');
      return updated;
    });
  }, [pushHistory]);

  // Toggle auto sync / auto flip on mirrored twin
  const handleToggleAutoSyncMirrored = useCallback((layerId: string, enabled: boolean) => {
    setLayers(prev => {
      const updated = prev.map(l => (l.id === layerId ? { ...l, autoSyncMirroredAsset: enabled } : l));
      pushHistory(updated);
      return updated;
    });
  }, [pushHistory]);

  const handleToggleAutoFlipMirrored = useCallback((layerId: string, enabled: boolean) => {
    setLayers(prev => {
      const updated = prev.map(l => (l.id === layerId ? { ...l, autoFlipMirroredAsset: enabled } : l));
      pushHistory(updated);
      return updated;
    });
  }, [pushHistory]);

  // Manually sync current layer's image to twin right now
  const handleSyncMirroredLayerAsset = useCallback(async (layerId: string, customTwinId?: string) => {
    if (!project) return;
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !layer.imageKey) return;

    const twinId = customTwinId || layer.linkedMirroredLayerId;
    if (!twinId) return;

    const twin = layers.find(l => l.id === twinId);
    if (!twin) return;

    const rawSrcBytes = project.rawImages?.[layer.imageKey];
    const dataUrlSrc = project.imagesMap?.[layer.imageKey] || layer.thumbnailUrl;
    if (!rawSrcBytes && !dataUrlSrc) return;

    try {
      const isMirrored = twin.isMirroredLayer || twin.transform.scaleX < 0 || Boolean(twin.autoFlipMirroredAsset);
      const shouldFlip = isMirrored && twin.autoFlipMirroredAsset !== false;

      let finalBytes = rawSrcBytes;
      let finalDataUrl = dataUrlSrc;

      if (shouldFlip) {
        const flipped = await getFlippedImageBuffer(rawSrcBytes || dataUrlSrc!, true, false);
        finalBytes = flipped.bytes;
        finalDataUrl = flipped.dataUrl;
      }

      let twinKey = twin.imageKey;
      if (shouldFlip && twinKey === layer.imageKey) {
        twinKey = `${layer.imageKey}_mirrored_${Date.now()}`;
      }

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rawImages: { ...prev.rawImages, [twinKey]: finalBytes! },
          imagesMap: { ...prev.imagesMap, [twinKey]: finalDataUrl! }
        };
      });

      setLayers(prev => {
        const updated = prev.map(l => {
          if (l.id === twin.id) {
            const updatedTwin: EditableLayer = {
              ...l,
              imageKey: twinKey,
              thumbnailUrl: finalDataUrl,
              spriteRef: {
                ...l.spriteRef,
                imageKey: twinKey
              }
            };
            masterLayersMapRef.current.set(l.id, updatedTwin);
            return updatedTwin;
          }
          return l;
        });
        pushHistory(updated);
        return updated;
      });

      setSuccessToast(`تمت مزامنة صورة الطبقة المعكوسة (${twin.name}) بنجاح`);
    } catch (e: any) {
      console.error('Failed to sync mirrored layer asset:', e);
      alert('تعذر مزامنة صورة الطبقة المعكوسة');
    }
  }, [project, layers, pushHistory]);

  // Convert layer image format and/or bake current size & dimensions
  const handleConvertLayerFormat = useCallback(async (layerId: string, targetMime: SupportedImageFormat, forceResizeToLayer: boolean = true) => {
    if (!project) return;
    const targetLayer = layers.find(l => l.id === layerId);
    if (!targetLayer || !targetLayer.imageKey) return;

    const imgKey = targetLayer.imageKey;
    const sourceDataUrl = project.imagesMap?.[imgKey] || targetLayer.thumbnailUrl;
    const sourceBytes = project.rawImages?.[imgKey];
    const source = sourceBytes || sourceDataUrl;

    if (!source) {
      alert('لم يتم العثور على بيانات الصورة الأصلية لتحويلها');
      return;
    }

    try {
      const targetW = forceResizeToLayer ? Math.round((targetLayer.initialBounds?.width || targetLayer.transform.width) * (targetLayer.transform.scaleX || 1)) : undefined;
      const targetH = forceResizeToLayer ? Math.round((targetLayer.initialBounds?.height || targetLayer.transform.height) * (targetLayer.transform.scaleY || 1)) : undefined;

      const { dataUrl, bytes, width: newW, height: newH } = await convertImageData(source, targetMime, 0.95, targetW, targetH);

      const formatLabel = targetMime === 'image/png' ? 'PNG' : targetMime === 'image/webp' ? 'WEBP' : 'JPEG';

      // Update project rawImages and imagesMap
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rawImages: {
            ...prev.rawImages,
            [imgKey]: bytes
          },
          imagesMap: {
            ...prev.imagesMap,
            [imgKey]: dataUrl
          }
        };
      });

      // Update layer thumbnailUrl, sprite frames, initialBounds, and transform for target and twin layers
      setLayers(prev => {
        const updated = prev.map(l => {
          if (l.id === layerId) {
            let updatedSpriteRef = l.spriteRef;
            if (forceResizeToLayer && l.spriteRef && l.spriteRef.frames) {
              const updatedFrames = l.spriteRef.frames.map((fr: any) => {
                if (!fr) return fr;
                const t = fr.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                return {
                  ...fr,
                  layout: {
                    ...(fr.layout || {}),
                    width: newW,
                    height: newH
                  },
                  transform: {
                    ...t,
                    a: 1,
                    d: 1
                  }
                };
              });
              updatedSpriteRef = {
                ...l.spriteRef,
                frames: updatedFrames
              };
            }

            const updatedMain: EditableLayer = {
              ...l,
              thumbnailUrl: dataUrl,
              spriteRef: updatedSpriteRef,
              initialBounds: forceResizeToLayer ? {
                ...l.initialBounds,
                width: newW,
                height: newH
              } : l.initialBounds,
              transform: forceResizeToLayer ? {
                ...l.transform,
                width: newW,
                height: newH,
                scaleX: 1,
                scaleY: 1
              } : l.transform
            };
            masterLayersMapRef.current.set(l.id, updatedMain);
            return updatedMain;
          }

          // Also synchronize any layer that shares the same imageKey or is a mirrored twin
          if (l.imageKey === imgKey || l.linkedMirroredLayerId === layerId || targetLayer.linkedMirroredLayerId === l.id) {
            const isMirrored = l.isMirroredLayer || l.transform.scaleX < 0 || Boolean(l.autoFlipMirroredAsset);
            let updatedTwinSprite = l.spriteRef;
            if (forceResizeToLayer && l.spriteRef && l.spriteRef.frames) {
              const updatedFrames = l.spriteRef.frames.map((fr: any) => {
                if (!fr) return fr;
                const t = fr.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
                // Preserve negative sign if mirrored via matrix
                const keepSignX = (t.a !== undefined && t.a < -0.01) ? -1 : 1;
                const keepSignY = (t.d !== undefined && t.d < -0.01) ? -1 : 1;
                return {
                  ...fr,
                  layout: {
                    ...(fr.layout || {}),
                    width: newW,
                    height: newH
                  },
                  transform: {
                    ...t,
                    a: keepSignX,
                    d: keepSignY
                  }
                };
              });
              updatedTwinSprite = {
                ...l.spriteRef,
                frames: updatedFrames
              };
            }

            const updatedTwin: EditableLayer = {
              ...l,
              thumbnailUrl: dataUrl,
              spriteRef: updatedTwinSprite,
              initialBounds: forceResizeToLayer ? {
                ...l.initialBounds,
                width: newW,
                height: newH
              } : l.initialBounds,
              transform: forceResizeToLayer ? {
                ...l.transform,
                width: newW,
                height: newH,
                scaleX: isMirrored ? -1 : 1,
                scaleY: l.transform.scaleY < 0 ? -1 : 1
              } : l.transform
            };
            masterLayersMapRef.current.set(l.id, updatedTwin);
            return updatedTwin;
          }

          return l;
        });
        pushHistory(updated);
        return updated;
      });

      setSuccessToast(forceResizeToLayer ? `تم تثبيت المقاس (${newW}×${newH}) وضغط الحجم بصيغة ${formatLabel} بنجاح ولن يتضخم حجم الملف! ✨` : `تم تحويل صيغة الصورة بنجاح إلى ${formatLabel} بدقة وجودة فائقة! ✨`);
    } catch (err: any) {
      console.error('Failed to convert layer image format:', err);
      alert(`فشل تحويل صيغة الصورة: ${err.message || 'خطأ غير معروف'}`);
    }
  }, [project, layers, pushHistory]);

  // Add New Image Layer
  const handleAddImageLayer = useCallback(async (file: File) => {
    if (!project) return;
    try {
      const { dataUrl, bytes, width, height } = await fileToImageBuffer(file);
      const imageKey = `img_custom_${Date.now()}`;
      const layerName = file.name.replace(/\.[^/.]+$/, '') || 'صورة مخصصة';

      // Update project images
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rawImages: {
            ...prev.rawImages,
            [imageKey]: bytes
          },
          imagesMap: {
            ...prev.imagesMap,
            [imageKey]: dataUrl
          }
        };
      });

      // Create new layer
      const newLayer = createImageLayer(
        imageKey,
        layerName,
        dataUrl,
        width,
        height,
        project.width,
        project.height,
        project.totalFrames
      );

      setLayers(prev => {
        const updated = [newLayer, ...prev];
        pushHistory(updated);
        return updated;
      });

      setSelectedLayerId(newLayer.id);
      setSuccessToast(`تمت إضافة طبقة جديدة بنجاح: ${layerName}`);
    } catch (err: any) {
      console.error("Failed to add image layer:", err);
      alert(`فشل إضافة الصورة: ${err.message || 'خطأ غير متوقع'}`);
    }
  }, [project, pushHistory]);

  // Add New Shape / Text Layer
  const handleAddShapeLayer = useCallback(async (shapeType: 'rect' | 'circle' | 'star' | 'badge' | 'text', customText?: string) => {
    if (!project) return;
    try {
      const { layer, dataUrl, bytes } = await createShapeLayer(
        shapeType,
        project.width,
        project.height,
        project.totalFrames,
        customText
      );

      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          rawImages: {
            ...prev.rawImages,
            [layer.imageKey]: bytes
          },
          imagesMap: {
            ...prev.imagesMap,
            [layer.imageKey]: dataUrl
          }
        };
      });

      setLayers(prev => {
        const updated = [layer, ...prev];
        pushHistory(updated);
        return updated;
      });

      setSelectedLayerId(layer.id);
      setSuccessToast(`تمت إضافة طبقة جديدة: ${layer.name}`);
    } catch (err: any) {
      console.error("Failed to add shape layer:", err);
      alert(`فشل إضافة الشكل: ${err.message || 'خطأ غير متوقع'}`);
    }
  }, [project, pushHistory]);

  // Merge another SVGA animation into the current project
  const handleMergeSvgaFile = useCallback(async (file: File) => {
    if (!project) {
      // If no project is open, just open this file as the main project
      loadSvgaFile(file);
      return;
    }

    setIsLoading(true);
    try {
      const result = await mergeSvgaFileIntoProject(file, project, layers, {
        placement: 'center',
        scaleMode: 'fit',
        loopFrames: true,
        layerPosition: 'top'
      });

      setProject(result.updatedProject);
      setLayers(result.updatedLayers);
      pushHistory(result.updatedLayers);

      const firstMergedLayer = result.updatedLayers.find(l => l.groupId === result.importedGroupId);
      if (firstMergedLayer) {
        setSelectedLayerId(firstMergedLayer.id);
      }

      setSuccessToast(`تم دمج أنيميشن "${file.name}" بنجاح (${result.importedLayersCount} طبقة مدمجة كحزمة موحدة)`);
    } catch (err: any) {
      console.error("Failed to merge SVGA file:", err);
      alert(`فشل دمج ملف SVGA: ${err.message || 'خطأ غير معروف'}`);
    } finally {
      setIsLoading(false);
    }
  }, [project, layers, pushHistory, loadSvgaFile]);

  const [isMergingLayers, setIsMergingLayers] = useState(false);

  // Merge All Layers into a single Layer
  const handleMergeAllLayers = useCallback(async () => {
    if (!project) return;
    if (layers.length < 2) {
      if (layers.length === 1 && layers[0].isMerged) {
        setSuccessToast('تم دمج جميع الطبقات مسبقاً في Layer واحد');
        return;
      }
      if (layers.length === 0) {
        setErrorMessage('لا توجد طبقات متاحة للدمج');
        return;
      }
    }

    setIsMergingLayers(true);
    try {
      const { updatedLayers, mergedLayer, newImagesMap } = await mergeLayersIntoSingleLayer(
        layers,
        layers,
        project,
        { isAll: true }
      );

      if (newImagesMap && Object.keys(newImagesMap).length > 0) {
        setProject(prev => prev ? {
          ...prev,
          imagesMap: { ...prev.imagesMap, ...newImagesMap }
        } : prev);
      }

      setLayers(updatedLayers);
      setSelectedLayerId(mergedLayer.id);
      setSelectedLayerIds([mergedLayer.id]);
      pushHistory(updatedLayers);
      setSuccessToast(`تم دمج جميع الطبقات (${mergedLayer.mergedLayersCount || layers.length} طبقة) بنجاح في Layer واحد!`);
    } catch (err: any) {
      console.error("Failed to merge all layers:", err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء دمج الطبقات');
    } finally {
      setIsMergingLayers(false);
    }
  }, [project, layers, pushHistory]);

  // Merge Selected Layers into a single Layer
  const handleMergeSelectedLayers = useCallback(async () => {
    if (!project) return;
    const targetLayers = layers.filter(l => selectedLayerIds.includes(l.id));
    if (targetLayers.length < 2) {
      setErrorMessage('يرجى تحديد طبقتين على الأقل للدمج');
      return;
    }

    setIsMergingLayers(true);
    try {
      const { updatedLayers, mergedLayer, newImagesMap } = await mergeLayersIntoSingleLayer(
        targetLayers,
        layers,
        project,
        { isAll: false }
      );

      if (newImagesMap && Object.keys(newImagesMap).length > 0) {
        setProject(prev => prev ? {
          ...prev,
          imagesMap: { ...prev.imagesMap, ...newImagesMap }
        } : prev);
      }

      setLayers(updatedLayers);
      setSelectedLayerId(mergedLayer.id);
      setSelectedLayerIds([mergedLayer.id]);
      pushHistory(updatedLayers);
      setSuccessToast(`تم دمج ${targetLayers.length} طبقات محددة بنجاح في Layer واحد!`);
    } catch (err: any) {
      console.error("Failed to merge selected layers:", err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء دمج الطبقات المحددة');
    } finally {
      setIsMergingLayers(false);
    }
  }, [project, layers, selectedLayerIds, pushHistory]);

  // Merge Two Specific Layers together (with motion synchronization and isolated separation)
  const handleMergeTwoLayers = useCallback(async (
    sourceLayerId: string, 
    targetLayerId: string, 
    options: { syncMotion?: boolean } = {}
  ) => {
    if (!project) return;
    const l1 = layers.find(l => l.id === sourceLayerId);
    const l2 = layers.find(l => l.id === targetLayerId);
    if (!l1 || !l2) {
      setErrorMessage('الطبقات المحددة للربط والدمج غير موجودة');
      return;
    }

    setIsMergingLayers(true);
    try {
      let updatedSource = { ...l1 };
      if (options.syncMotion !== false) {
        const { syncLayerMotionWithReference } = await import('./svgaMergeEngine');
        updatedSource = syncLayerMotionWithReference(l1, l2, project.totalFrames || 60);
      } else {
        updatedSource.isMotionSynced = true;
        updatedSource.motionReferenceLayerId = l2.id;
      }

      const updatedLayers = layers.map(l => l.id === sourceLayerId ? updatedSource : l);
      
      setLayers(updatedLayers);
      setSelectedLayerId(updatedSource.id);
      setSelectedLayerIds([updatedSource.id, l2.id]);
      pushHistory(updatedLayers);
      
      setSuccessToast(`تم ربط حركة "${l1.name}" لتتبع "${l2.name}" بنجاح!`);
    } catch (err: any) {
      console.error("Failed to merge two layers:", err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء ربط الطبقتين');
    } finally {
      setIsMergingLayers(false);
    }
  }, [project, layers, pushHistory]);

  // Ungroup a merged layer back into its original sublayers
  const handleUngroupMergedLayer = useCallback((layerId: string) => {
    const target = layers.find(l => l.id === layerId);
    if (!target || !target.isMerged) return;

    try {
      const updatedLayers = ungroupMergedLayer(layerId, layers);
      setLayers(updatedLayers);
      const firstUnbundledId = updatedLayers.find(l => !layers.some(old => old.id === l.id))?.id || null;
      setSelectedLayerId(firstUnbundledId);
      setSelectedLayerIds(firstUnbundledId ? [firstUnbundledId] : []);
      pushHistory(updatedLayers);
      setSuccessToast(`تم فك دمج الطبقة واسترجاع ${target.mergedLayersCount || target.mergedLayers?.length || ''} طبقات منفصلة بنجاح`);
    } catch (err: any) {
      console.error("Failed to ungroup merged layer:", err);
      setErrorMessage('حدث خطأ أثناء فك الدمج');
    }
  }, [layers, pushHistory]);

  // Synchronize a layer's motion with a reference layer
  const handleSyncLayerMotion = useCallback((targetLayerId: string, referenceLayerId: string) => {
    if (!project) return;
    const targetLayer = layers.find(l => l.id === targetLayerId);
    const referenceLayer = layers.find(l => l.id === referenceLayerId);
    if (!targetLayer || !referenceLayer) {
      setErrorMessage('الطبقة المحددة غير موجودة');
      return;
    }

    try {
      const totalFrames = project.totalFrames || 60;
      let updatedLayer: EditableLayer;

      if (targetLayer.isMerged && targetLayer.mergedLayers) {
        const syncedSublayers = targetLayer.mergedLayers.map(sub => 
          syncLayerMotionWithReference(sub, referenceLayer, totalFrames)
        );
        updatedLayer = {
          ...targetLayer,
          mergedLayers: syncedSublayers,
          isMotionSynced: true,
          motionReferenceLayerId: referenceLayer.id,
          keyframes: referenceLayer.keyframes ? JSON.parse(JSON.stringify(referenceLayer.keyframes)) : undefined
        };
      } else {
        updatedLayer = syncLayerMotionWithReference(targetLayer, referenceLayer, totalFrames);
      }

      const updatedLayers = layers.map(l => l.id === targetLayerId ? updatedLayer : l);
      setLayers(updatedLayers);
      pushHistory(updatedLayers);
      setSuccessToast(`تمت مزامنة حركة "${targetLayer.name}" لتتبع حركة "${referenceLayer.name}" بنجاح!`);
    } catch (err: any) {
      console.error("Failed to sync layer motion:", err);
      setErrorMessage('حدث خطأ أثناء مزامنة الحركة');
    }
  }, [project, layers, pushHistory]);

  // Group / Bundle Collective Transformations
  const handleTransformGroup = useCallback((
    groupId: string,
    deltas: {
      dx?: number;
      dy?: number;
      scaleMultiplier?: number;
      rotationDelta?: number;
      opacityDelta?: number;
      setOpacity?: number;
    }
  ) => {
    if (!project) return;
    setLayers(prev => {
      const updated = transformLayerGroup(prev, groupId, deltas);
      pushHistory(updated);
      return updated;
    });
  }, [project, pushHistory]);

  // Ungroup bundle into independent regular layers
  const handleUngroup = useCallback((groupId: string) => {
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.groupId === groupId) {
          return {
            ...l,
            groupId: undefined,
            groupName: undefined
          };
        }
        return l;
      });
      pushHistory(updated);
      setSuccessToast('تم فك ارتباط حزمة الطبقات لتصبح طبقات عادية مستقلة');
      return updated;
    });
  }, [pushHistory]);

  // Delete all layers in group
  const handleDeleteGroup = useCallback((groupId: string) => {
    setLayers(prev => {
      const updated = prev.filter(l => l.groupId !== groupId);
      if (selectedLayerId && prev.find(l => l.id === selectedLayerId)?.groupId === groupId) {
        setSelectedLayerId(updated[0]?.id || null);
      }
      pushHistory(updated);
      setSuccessToast('تم حذف حزمة SVGA المدمجة بالكامل');
      return updated;
    });
  }, [selectedLayerId, pushHistory]);

  // Toggle lock for all layers in group
  const handleToggleGroupLock = useCallback((groupId: string) => {
    setLayers(prev => {
      const groupLayers = prev.filter(l => l.groupId === groupId);
      const allLocked = groupLayers.every(l => l.locked);
      const targetState = !allLocked;
      const updated = prev.map(l => l.groupId === groupId ? { ...l, locked: targetState } : l);
      pushHistory(updated);
      setSuccessToast(targetState ? 'تم قفل كامل حزمة SVGA واستثناؤها من التحديد' : 'تم فتح قفل كامل حزمة SVGA');
      if (targetState) {
        const groupLayerIds = groupLayers.map(l => l.id);
        setSelectedLayerIds(curr => curr.filter(id => !groupLayerIds.includes(id)));
        setSelectedLayerId(curr => (curr && groupLayerIds.includes(curr)) ? null : curr);
      }
      return updated;
    });
  }, [pushHistory]);

  // Toggle visibility for all layers in group
  const handleToggleGroupVisibility = useCallback((groupId: string) => {
    setLayers(prev => {
      const groupLayers = prev.filter(l => l.groupId === groupId);
      const allVisible = groupLayers.every(l => l.visible);
      const targetState = !allVisible;
      const updated = prev.map(l => l.groupId === groupId ? { ...l, visible: targetState } : l);
      pushHistory(updated);
      setSuccessToast(targetState ? 'تم إظهار حزمة SVGA' : 'تم إخفاء حزمة SVGA');
      return updated;
    });
  }, [pushHistory]);

  // Update Layer Active Frame Range
  const handleUpdateFrameRange = useCallback((startFrame: number, endFrame: number) => {
    if (!selectedLayerId || !project) return;
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id !== selectedLayerId) return l;

        const updatedFrames = l.spriteRef?.frames ? l.spriteRef.frames.map((fr: any, idx: number) => {
          const isVisible = idx >= startFrame && idx <= endFrame;
          return {
            ...fr,
            alpha: isVisible ? (fr.alpha && fr.alpha > 0 ? fr.alpha : 1.0) : 0.0
          };
        }) : [];

        return {
          ...l,
          inFrame: startFrame,
          outFrame: endFrame,
          keyframeSummary: {
            ...l.keyframeSummary,
            startFrame,
            endFrame
          },
          spriteRef: {
            ...l.spriteRef,
            frames: updatedFrames
          }
        };
      });
      pushHistory(updated);
      return updated;
    });
  }, [selectedLayerId, project, pushHistory]);

  // Update Layer In/Out duration frame range & track color (timeline visual red bar)
  const handleUpdateLayerTimeRange = useCallback((
    layerId: string,
    inFrame: number,
    outFrame: number,
    trackColor?: string,
    commitHistory = true
  ) => {
    if (!project) return;
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id !== layerId) return l;

        const updatedFrames = l.spriteRef?.frames ? l.spriteRef.frames.map((fr: any, idx: number) => {
          const isVisible = idx >= inFrame && idx <= outFrame;
          return {
            ...fr,
            alpha: isVisible ? (fr.alpha && fr.alpha > 0 ? fr.alpha : 1.0) : 0.0
          };
        }) : [];

        return {
          ...l,
          inFrame,
          outFrame,
          trackColor: trackColor || l.trackColor || '#ef4444',
          keyframeSummary: {
            ...l.keyframeSummary,
            startFrame: inFrame,
            endFrame: outFrame
          },
          spriteRef: {
            ...l.spriteRef,
            frames: updatedFrames
          }
        };
      });
      if (commitHistory) {
        pushHistory(updated);
      }
      return updated;
    });
  }, [project, pushHistory]);

  // Trim Project Range (Cut Start & End, recalculate totalFrames, layers keyframes and duration)
  const handleTrimProject = useCallback((startFrame: number, endFrame: number) => {
    if (!project) return;
    const clampedStart = Math.max(0, Math.min(startFrame, project.totalFrames - 1));
    const clampedEnd = Math.max(clampedStart, Math.min(endFrame, project.totalFrames - 1));
    const newTotalFrames = clampedEnd - clampedStart + 1;
    const newDurationSec = Math.max(0.1, +(newTotalFrames / project.fps).toFixed(2));

    const updatedLayers = layers.map(layer => {
      // Slice sprite frames if present
      let updatedSprite = layer.spriteRef;
      if (layer.spriteRef && Array.isArray(layer.spriteRef.frames)) {
        const slicedFrames = layer.spriteRef.frames.slice(clampedStart, clampedEnd + 1);
        updatedSprite = {
          ...layer.spriteRef,
          frames: slicedFrames
        };
      }

      // Remap inFrame and outFrame
      const oldIn = layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0);
      const oldOut = layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (project.totalFrames - 1));
      const newIn = Math.max(0, Math.min(newTotalFrames - 1, oldIn - clampedStart));
      const newOut = Math.max(0, Math.min(newTotalFrames - 1, oldOut - clampedStart));

      // Remap keyframes
      const newKeyframes = (layer.keyframes || [])
        .filter(k => k.frame >= clampedStart && k.frame <= clampedEnd)
        .map(k => ({
          ...k,
          frame: k.frame - clampedStart
        }));

      return {
        ...layer,
        inFrame: newIn,
        outFrame: newOut,
        keyframes: newKeyframes,
        spriteRef: updatedSprite,
        framesCount: newTotalFrames,
        keyframeSummary: {
          ...layer.keyframeSummary,
          startFrame: newIn,
          endFrame: newOut
        }
      };
    });

    // Remap audios if present
    const updatedAudios = (project.audios || []).map(audio => {
      const audioStartSec = audio.startTime || 0;
      const trimStartSec = clampedStart / project.fps;
      const newAudioStartSec = Math.max(0, audioStartSec - trimStartSec);
      return {
        ...audio,
        startTime: newAudioStartSec
      };
    });

    setProject(prev => prev ? {
      ...prev,
      totalFrames: newTotalFrames,
      durationSec: newDurationSec,
      audios: updatedAudios
    } : prev);

    setLayers(updatedLayers);
    setCurrentFrame(0);
    pushHistory(updatedLayers);
    setSuccessToast(`تم قص وحفظ المشروع بنجاح من الفريم ${clampedStart} إلى الفريم ${clampedEnd} (المدة: ${newDurationSec} ثانية) ✓`);
  }, [project, layers, pushHistory]);

  // Undo / Redo Actions (using lightweight snapshots)
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setLayers(prev => restoreLayersFromSnapshot(history[newIdx], prev, masterLayersMapRef.current));
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setLayers(prev => restoreLayersFromSnapshot(history[newIdx], prev, masterLayersMapRef.current));
    }
  }, [history, historyIndex]);

  // Perform SVGA Export and Download
  const handleExport = async () => {
    if (!project) return;
    setIsExporting(true);
    try {
      const { blob, fileName } = await exportEditedSvga(project, layers, exportFileName, {
        fadeConfig,
        cropConfig,
        cropFeather
      });
      setLastExportedBlob({ blob, fileName });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      setSuccessToast(`تم تصدير وحفظ ملف SVGA بنجاح: ${fileName}`);
      setShowExportModal(false);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(`فشل تصدير الملف: ${err.message || 'خطأ غير متوقع'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Preview Exported File in SVGA Viewer
  const handlePreviewExported = async () => {
    if (!project) return;
    setIsExporting(true);
    try {
      const { blob, fileName } = await exportEditedSvga(project, layers, exportFileName, {
        fadeConfig,
        cropConfig,
        cropFeather
      });
      const exportedFile = new File([blob], fileName, { type: 'application/octet-stream' });
      if (onOpenViewer) {
        onOpenViewer(exportedFile);
      }
    } catch (err: any) {
      console.error("Preview error:", err);
      alert(`فشل إعداد المعاينة: ${err.message || 'خطأ'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Create New Project Handler
  const handleCreateNewProject = () => {
    try {
      const { project: newProj, layers: newLayers } = createNewSvgaProject(newProjectConfig);
      const newSessionId = `proj_${Date.now()}`;
      const exportName = (newProjectConfig.name || 'custom_svga_animation').replace(/\.svga$/i, '') + '_edited.svga';
      const newSession: ProjectSession = {
        id: newSessionId,
        name: newProjectConfig.name || `مشروع ${projects.length + 1}`,
        originalFileName: newProj.fileName,
        fileType: 'custom',
        project: newProj,
        layers: newLayers,
        history: [createLayersSnapshot(newLayers)],
        historyIndex: 0,
        selectedLayerId: null,
        selectedLayerIds: [],
        currentFrame: 0,
        zoom: 100,
        panOffset: { x: 0, y: 0 },
        fadeConfig: { top: 0, bottom: 0, left: 0, right: 0 },
        cropConfig: { top: 0, bottom: 0, left: 0, right: 0 },
        cropFeather: { top: 0, bottom: 0, left: 0, right: 0 },
        bgColor: 'transparent',
        bgImageUrl: bgImageUrl || null,
        exportFileName: exportName,
        modifiedAt: Date.now()
      };

      setProjects(prev => [...prev, newSession]);
      setActiveProjectId(newSessionId);
      setProject(newProj);
      setLayers(newLayers);
      setSelectedLayerId(null);
      setSelectedLayerIds([]);
      setCurrentFrame(0);
      setHistory([createLayersSnapshot(newLayers)]);
      setHistoryIndex(0);
      setExportFileName(exportName);
      setIsOverviewMode(false);
      setShowNewProjectModal(false);
      setSuccessToast(`تم إنشاء المشروع "${newProjectConfig.name}" بمقاس ${newProjectConfig.width}×${newProjectConfig.height} بنجاح!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      console.error("Failed to create new project:", err);
      alert(`فشل إنشاء المشروع: ${err.message || 'خطأ'}`);
    }
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  // Background Swatches
  const bgSwatches = [
    { label: 'Transparent', value: 'transparent', isChecker: true },
    { label: 'Dark Slate', value: '#070b14' },
    { label: 'Pitch Black', value: '#000000' },
    { label: 'Pure White', value: '#ffffff' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col font-sans overflow-hidden" dir="ltr">
      <input
        type="file"
        ref={fileInputRef}
        accept=".svga,.SVGA,.json,.JSON,.lottie,.LOTTIE,.pag,.PAG,.gif,.GIF,.webp,.WEBP,.apng,.APNG,.png,.PNG,.zip,.ZIP,.mp4,.MP4,.mov,.MOV,.webm,.WEBM,.vap,.VAP,.svg,.SVG,video/*,image/*,*/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 1) {
            handleLoadMultipleFiles(files);
          } else if (files.length === 1) {
            loadSvgaFile(files[0]);
          }
          e.target.value = '';
        }}
      />

      <input
        type="file"
        ref={multiFileInputRef}
        accept=".svga,video/mp4,video/*,image/*,.gif,.webp,.png,.jpg,.jpeg"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleLoadMultipleFiles(Array.from(e.target.files));
          }
          e.target.value = '';
        }}
      />

      <input
        type="file"
        ref={mp4FileInputRef}
        accept="video/mp4,video/quicktime,video/webm,.mp4"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            setMp4InitialFiles(Array.from(e.target.files));
            setShowMp4ImportModal(true);
          }
          e.target.value = '';
        }}
      />

      <input
        type="file"
        ref={mergeFileInputRef}
        accept=".svga"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleMergeSvgaFile(f);
          e.target.value = '';
        }}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 border border-indigo-400/50 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2"
          >
            <Check size={14} className="text-white" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar */}
      <header className="h-14 bg-[#0a0f1d] border-b border-white/10 px-3 lg:px-6 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand & Back */}
        <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1.5 lg:px-3 lg:py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">خروج</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow-indigo">
              <Layers size={16} />
            </div>
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 lg:gap-2">
                <span className="font-black text-xs lg:text-sm tracking-tight text-white truncate">
                  {isMobile ? 'الاستوديو Pro' : 'تحرير طبقات SVGA'}
                </span>
                <span className="hidden sm:inline text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0">
                  Pro Layer Studio
                </span>
              </div>
              {project && (
                <p className="text-[9px] lg:text-[10px] text-slate-400 font-mono truncate">
                  {project.fileName.length > 15 ? project.fileName.substr(0, 12) + '...' : project.fileName} • {(project.fileSize / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Center: Canvas View Controls & Tools */}
        {project && !isMobile && (
          <div className="hidden lg:flex items-center gap-3 bg-white/5 p-1 rounded-2xl border border-white/5">
            {/* Tool Modes */}
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <button
                onClick={() => setActiveTool('select')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="أداة التحديد والتحريك (Select Tool)"
              >
                <MousePointer size={14} />
              </button>
              <button
                onClick={() => setActiveTool('hand')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTool === 'hand' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title="أداة تحريك مساحة العمل (Hand Tool)"
              >
                <Hand size={14} />
              </button>
            </div>

            {/* Grid & Guides Toggles */}
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  showGrid ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
                }`}
                title="إظهار/إخفاء الشبكة (Grid)"
              >
                <Grid size={14} />
              </button>
              <button
                onClick={() => setShowGuides(!showGuides)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  showGuides ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white'
                }`}
                title="إظهار/إخفاء خطوط المحاذاة الذكية (Smart Guides)"
              >
                <Compass size={14} />
              </button>
            </div>

              {/* Background Color Swatches, Library & Custom Image Upload */}
              <div className="flex items-center gap-1.5 pl-1">
                {bgSwatches.map(swatch => (
                  <button
                    key={swatch.label}
                    onClick={() => {
                      setBgColor(swatch.value);
                      if (bgImageUrl) {
                        setBgImageUrl(null);
                        setProjects(prev => prev.map(p => ({ ...p, bgImageUrl: null, bgColor: swatch.value })));
                      }
                    }}
                    className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                      bgColor === swatch.value && !bgImageUrl ? 'scale-125 border-white ring-2 ring-indigo-500/50' : 'border-white/20 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: swatch.isChecker ? '#1e293b' : swatch.value,
                      backgroundImage: swatch.isChecker ? 'radial-gradient(circle, #475569 20%, transparent 20%)' : 'none',
                      backgroundSize: '4px 4px'
                    }}
                    title={swatch.label}
                  />
                ))}

                <div className="h-3 w-px bg-white/10 mx-0.5" />

                {/* Upload Background Image for Gift Preview (Fixed & Uncropped) */}
                <input
                  type="file"
                  ref={bgFileInputRef}
                  onChange={handleBackgroundUpload}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />

                {/* Open Background Library Button (Dashboard + Presets) */}
                <button
                  onClick={() => setShowBgLibraryModal(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer shadow-sm hover:scale-105 ${
                    bgImageUrl 
                      ? 'bg-indigo-600/30 text-cyan-300 border-indigo-400/50 hover:bg-indigo-600/50'
                      : 'bg-white/5 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 border-white/10 hover:border-indigo-500/40'
                  }`}
                  title="مكتبة خلفيات المنصة والداشبورد (تطبيق أو تنزيل الخلفيات المرفوعة على جميع المشاريع)"
                >
                  <ImageIcon size={12} className="text-cyan-400" />
                  <span>مكتبة الخلفيات</span>
                </button>

                {bgImageUrl ? (
                  <div className="flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/50 rounded-xl px-1.5 py-0.5 shadow-sm">
                    <button
                      onClick={() => setShowBgLibraryModal(true)}
                      className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white font-bold cursor-pointer"
                      title="فتح مكتبة الخلفيات لتغيير أو استعراض الخلفيات"
                    >
                      <img
                        src={bgImageUrl}
                        alt="Background Preview"
                        className="w-4 h-4 rounded object-cover border border-cyan-400/50"
                      />
                      <span className="hidden xl:inline text-[9px]">خلفية موحدة ✓</span>
                    </button>
                    {/* Direct Download Active Background */}
                    <button
                      onClick={() => downloadImageUrl(bgImageUrl, 'background_preview')}
                      className="p-1 text-slate-400 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                      title="تحميل وتنزيل صورة الخلفية الحالية على جهازك"
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={() => {
                        handleSelectBackground(null, true);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                      title="إزالة صورة الخلفية من جميع المشاريع"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => bgFileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-200 rounded-xl text-[10px] font-medium border border-white/10 hover:border-indigo-500/40 transition-all cursor-pointer"
                    title="رفع صورة خلفية جديدة من جهازك وتطبيقها على جميع المشاريع المعروضة"
                  >
                    <Upload size={11} className="text-indigo-400" />
                    <span className="hidden lg:inline text-[9px] font-bold">رفع للكل</span>
                  </button>
                )}
              </div>
          </div>
        )}

        {/* Right Actions: Undo, Redo, Open, Export */}
        <div className="flex items-center gap-2">
        {/* Right Actions: Desktop only */}
        <div className="hidden lg:flex items-center gap-2">
          {project && (
            <>
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
                title="تراجع (Undo - Ctrl+Z)"
              >
                <RotateCcw size={14} />
              </button>

              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 rounded-xl transition-all cursor-pointer"
                title="إعادة (Redo - Ctrl+Y)"
              >
                <RotateCcw size={14} className="scale-x-[-1]" />
              </button>
            </>
          )}

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 transition-all cursor-pointer shadow-sm hover:scale-105"
            title="إنشاء مشروع SVGA جديد وتحديد المقاسات"
          >
            <Plus size={14} className="text-emerald-400" /> مشروع جديد
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <Upload size={13} className="text-indigo-400" /> فتح SVGA
          </button>

          <button
            onClick={() => {
              setMp4InitialFiles([]);
              setShowMp4ImportModal(true);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-pink-300 hover:text-white bg-pink-500/10 hover:bg-pink-500/25 px-3.5 py-1.5 rounded-xl border border-pink-500/30 transition-all cursor-pointer shadow-sm hover:scale-105"
            title="استدعاء فيديو MP4 والتحكم به كملف SVGA كامل أو كطبقة فيديو وتصديره لأي صيغة"
          >
            <Film size={13} className="text-pink-400" />
            <span>استدعاء MP4</span>
          </button>

          {project && (
            <button
              onClick={() => setShowAudioStudioModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-200 hover:text-white bg-indigo-600/25 hover:bg-indigo-600/40 px-3.5 py-1.5 rounded-xl border border-indigo-500/40 transition-all cursor-pointer shadow-sm hover:scale-105"
              title="استوديو قص وتعديل الصوت ودمجه في ملف SVGA"
            >
              <Music size={13} className="text-indigo-400" />
              <span>قص ودمج الصوت</span>
              {project.audios && project.audios.length > 0 && (
                <span className="text-[10px] bg-indigo-500 text-white font-mono px-1.5 py-0.2 rounded-full">
                  {project.audios.length}
                </span>
              )}
            </button>
          )}

          {project && (
            <button
              onClick={() => mergeFileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-200 hover:text-white bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 px-3.5 py-1.5 rounded-xl border border-purple-500/40 transition-all cursor-pointer shadow-lg shadow-purple-900/20 hover:scale-105"
              title="استدعاء ملف SVGA آخر ودمجه فوق المشروع الحالي مع التحكم الجماعي الكامل في حركته ومقاساته"
            >
              <Sparkles size={13} className="text-purple-300" /> دمج SVGA +
            </button>
          )}

          {project && layers.length > 1 && (
            <button
              onClick={handleMergeAllLayers}
              disabled={isMergingLayers}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-200 hover:text-white bg-purple-600/30 hover:bg-purple-600/50 px-3.5 py-1.5 rounded-xl border border-purple-500/40 transition-all cursor-pointer shadow-sm hover:scale-105 disabled:opacity-50"
              title="دمج كافة Layers في Layer واحد موحد مع الحفاظ على الحركة"
            >
              <Layers size={13} className="text-purple-300" />
              <span>دمج الطبقات</span>
            </button>
          )}

          {project && (
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-4 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:scale-105"
            >
              <Download size={13} /> {isExporting ? 'جاري المعالجة...' : 'تصدير SVGA'}
            </button>
          )}
        </div>

        {/* Mobile Actions Header Bar */}
        <div className="lg:hidden flex items-center gap-2">
          {project && (
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-indigo-600 px-3.5 py-1.5 rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Download size={12} />
              <span>{isExporting ? 'جاري...' : 'تصدير'}</span>
            </button>
          )}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 hover:text-white cursor-pointer"
            title="خيارات إضافية"
          >
            <Sliders size={14} />
          </button>
        </div>
        </div>
      </header>

      {/* Compositions / Projects Tab Bar */}
      {projects.length > 0 && (
        <SvgaProjectsTabBar
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={handleSwitchProject}
          onCloseProject={handleCloseProject}
          onDuplicateProject={handleDuplicateProject}
          onRenameProject={handleRenameProject}
          onAddNewProject={() => setShowNewProjectModal(true)}
          onOpenFiles={() => multiFileInputRef.current?.click()}
          onBatchExport={() => setShowBatchExportModal(true)}
          isOverviewMode={projects.length > 1 && canvasViewMode === 'multi'}
          onToggleOverviewMode={() => setCanvasViewMode(prev => prev === 'multi' ? 'single' : 'multi')}
        />
      )}

      {/* Main Workspace Body */}
      {project ? (
        <div className="flex flex-1 overflow-hidden relative pb-16 lg:pb-0">
          {/* Left Panel: Layers */}
          <aside className={`h-full shrink-0 border-r border-white/10 z-10 flex-col ${
            activeMobileTab === 'layers' ? 'w-full flex' : 'hidden lg:flex lg:w-[360px] lg:2xl:w-[400px]'
          }`}>
            <SvgaLayersList
              layers={layers}
              selectedLayerId={selectedLayerId}
              selectedLayerIds={selectedLayerIds}
              currentFrame={currentFrame}
              totalFrames={project.totalFrames}
              onSelectLayer={(id, isMulti) => handleSelectLayer(id, isMulti)}
              onToggleLayerSelection={handleToggleLayerSelection}
              onSelectAllLayers={handleSelectAllLayers}
              onToggleVisibility={handleToggleVisibility}
              onToggleAllVisibility={handleToggleAllVisibility}
              onToggleLock={handleToggleLock}
              onToggleAllLock={handleToggleAllLock}
              onResetLayerTransform={handleResetTransform}
              onReorderLayer={handleReorderLayer}
              onMoveLayer={handleMoveLayer}
              onDuplicateLayer={handleDuplicateLayer}
              onDeleteLayer={handleDeleteLayer}
              onRenameLayer={handleRenameLayer}
              onAddImageLayer={handleAddImageLayer}
              onAddShapeLayer={handleAddShapeLayer}
              onMergeSvga={() => mergeFileInputRef.current?.click()}
              onOpenAudioStudio={() => setShowAudioStudioModal(true)}
              onOpenMp4Import={() => {
                setMp4InitialFiles([]);
                setShowMp4ImportModal(true);
              }}
              onMergeAllLayers={handleMergeAllLayers}
              onMergeSelectedLayers={handleMergeSelectedLayers}
              onMergeTwoLayers={handleMergeTwoLayers}
              onUngroupLayer={handleUngroupMergedLayer}
              onSyncSequenceMotion={handleSyncSequenceMotion}
              isMerging={isMergingLayers}
            />
          </aside>

          {/* Center Viewport: Interactive Canvas + Timeline */}
          <main className={`h-full overflow-hidden bg-[#070b14] flex-col ${
            activeMobileTab === 'canvas' ? 'w-full flex flex-1' : 'hidden lg:flex lg:flex-1'
          }`}>
            <div className="flex-1 relative overflow-hidden flex flex-col">
              {projects.length > 1 && canvasViewMode === 'multi' ? (
                <SvgaMultiCanvasStage
                  projects={projects}
                  activeProjectId={activeProjectId}
                  activeFadeConfig={fadeConfig}
                  activeCropConfig={cropConfig}
                  activeCropFeather={cropFeather}
                  onSelectProject={handleSwitchProject}
                  onFocusProjectSingleView={(id) => {
                    handleSwitchProject(id);
                    setCanvasViewMode('single');
                  }}
                  onCloseProject={handleCloseProject}
                  onDuplicateProject={handleDuplicateProject}
                  onRenameProject={handleRenameProject}
                  onOpenFiles={() => multiFileInputRef.current?.click()}
                  onOpenMp4Import={() => {
                    setMp4InitialFiles([]);
                    setShowMp4ImportModal(true);
                  }}
                  onBatchExport={() => setShowBatchExportModal(true)}
                  onExportSingleProject={(proj) => {
                    handleSwitchProject(proj.id);
                    setShowExportModal(true);
                  }}
                  onMergeProjectIntoActive={handleMergeProjectIntoActive}
                  onMergeAllProjectsIntoSingleCanvas={handleMergeAllProjectsIntoSingleCanvas}
                  isMasterPlaying={isPlaying}
                  onToggleMasterPlay={() => setIsPlaying(prev => !prev)}
                  masterCurrentFrame={currentFrame}
                  onFilesDrop={handleLoadMultipleFiles}
                  globalBgImageUrl={bgImageUrl}
                  onOpenBgLibrary={() => setShowBgLibraryModal(true)}
                />
              ) : (
                <>
                  {projects.length > 1 && (
                    <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-slate-900/95 border border-white/20 rounded-xl px-3 py-1.5 backdrop-blur-md shadow-xl animate-in fade-in duration-150">
                      <span className="text-[11px] font-bold text-slate-300">وضع الكانفاس الفردي</span>
                      <button
                        onClick={() => setCanvasViewMode('multi')}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 px-2.5 py-1 rounded-lg border border-indigo-500/40 transition-all cursor-pointer shadow-sm hover:scale-105"
                        title="عرض جميع المشاريع والفيديوهات المفتوحة جنباً إلى جنب على الشاشة"
                      >
                        <LayoutGrid size={12} className="text-indigo-400" />
                        <span>عرض الكل على الشاشة ({projects.length})</span>
                      </button>
                    </div>
                  )}

                  <SvgaDesignCanvas
                    project={project}
                    layers={layers}
                    selectedLayerId={selectedLayerId}
                    selectedLayerIds={selectedLayerIds}
                    currentFrame={currentFrame}
                    activeTool={activeTool}
                    zoom={zoom}
                    panOffset={panOffset}
                    showGrid={showGrid}
                    showRulers={showRulers}
                    showGuides={showGuides}
                    bgColor={bgColor}
                    onSelectLayer={handleSelectLayer}
                    onUpdateLayerTransform={handleUpdateLayerTransform}
                    onBulkUpdateTransforms={handleBulkUpdateTransforms}
                    onZoomChange={setZoom}
                    onPanChange={setPanOffset}
                    onDeleteLayer={handleDeleteLayer}
                    onUpdateProjectDimensions={handleUpdateProjectDimensions}
                    fadeConfig={fadeConfig}
                    cropConfig={cropConfig}
                    cropFeather={cropFeather}
                    bgImageUrl={bgImageUrl}
                    onChromaPickColor={handleChromaPickColor}
                    onChromaHoverColor={setChromaActiveColor}
                    onUpdateShineConfig={handleUpdateLayerShineConfig}
                    shinePointStep={shinePointStep}
                    onShinePointStepChange={setShinePointStep}
                  />

                  {/* Floating Timeline Toggle on Mobile */}
                  {isMobile && (
                    <button
                      onClick={() => setIsTimelineOpenMobile(!isTimelineOpenMobile)}
                      className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900/95 border border-white/20 px-3.5 py-2 rounded-2xl backdrop-blur-md shadow-lg cursor-pointer"
                    >
                      <Film size={12} className="text-indigo-400" />
                      <span>{isTimelineOpenMobile ? 'إخفاء التايم لاين' : 'تعديل التايم لاين والتدريج'}</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Smart Chroma Key Pen Studio Control Panel */}
            <SvgaChromaPenStudio
              isActive={isChromaPenActive}
              activeColor={chromaActiveColor}
              targetColors={chromaTargetColors}
              onAddTargetColor={handleAddTargetColor}
              onRemoveTargetColor={handleRemoveTargetColor}
              onClearTargetColors={handleClearTargetColors}
              tolerance={chromaTolerance}
              onToleranceChange={setChromaTolerance}
              smoothness={chromaSmoothness}
              onSmoothnessChange={setChromaSmoothness}
              despill={chromaDespill}
              onDespillChange={setChromaDespill}
              scope={chromaScope}
              onScopeChange={setChromaScope}
              onApplyChroma={handleApplyChroma}
              onUndoChroma={handleUndoChroma}
              canUndo={chromaUndoStack.length > 0}
              isProcessing={isChromaProcessing}
              processingProgress={chromaProgress}
              processingStatus={chromaStatus}
              onClose={() => {
                setIsChromaPenActive(false);
                setActiveTool('select');
              }}
            />

            {/* Bottom Keyframe & Motion Timeline */}
            {(!isMobile || isTimelineOpenMobile) && (
              <SvgaMotionTimeline
                totalFrames={project.totalFrames}
                currentFrame={currentFrame}
                fps={project.fps}
                isPlaying={isPlaying}
                isLoop={isLoop}
                selectedLayer={selectedLayer}
                layers={layers}
                projectAudios={project.audios}
                onOpenAudioStudio={() => setShowAudioStudioModal(true)}
                onSelectLayer={(id) => handleSelectLayer(id, false)}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onStepFrame={(delta) => {
                  setIsPlaying(false);
                  setCurrentFrame(prev => Math.max(0, Math.min(project.totalFrames - 1, prev + delta)));
                }}
                onSeekFrame={(f) => {
                  setIsPlaying(false);
                  setCurrentFrame(Math.max(0, Math.min(project.totalFrames - 1, f)));
                }}
                onToggleLoop={() => setIsLoop(!isLoop)}
                onUpdateLayerTransform={handleUpdateLayerTransform}
                onUpdateLayerKeyframes={handleUpdateLayerKeyframes}
                onUpdateProjectDuration={handleUpdateProjectDuration}
                onUpdateLayerTimeRange={handleUpdateLayerTimeRange}
                onTrimProject={handleTrimProject}
                onMergeSvga={() => mergeFileInputRef.current?.click()}
                onOpenMergeCanvasStudio={() => setShowMergeCanvasModal(true)}
                onToggleChromaPen={handleToggleChromaPen}
                isChromaPenActive={isChromaPenActive}
                onExport={() => setShowExportModal(true)}
                isExporting={isExporting}
                isMerging={isMergingLayers}
              />
            )}
          </main>

          {/* Right Panel: Properties */}
          <aside className={`h-full shrink-0 ${
            activeMobileTab === 'properties' ? 'w-full flex flex-col' : 'hidden lg:flex lg:w-[320px]'
          }`}>
            <SvgaPropertiesPanel
              project={project}
              layer={selectedLayer}
              selectedLayers={layers.filter(l => selectedLayerIds.includes(l.id))}
              selectedLayerIds={selectedLayerIds}
              currentFrame={currentFrame}
              onUpdateTransform={(t) => selectedLayerId && handleUpdateLayerTransform(selectedLayerId, t)}
              onUpdateLayerKeyframes={handleUpdateLayerKeyframes}
              onBulkTransform={handleBulkTransform}
              onToggleAspectLock={handleToggleAspectLock}
              onReplaceAsset={handleReplaceAsset}
              onConvertLayerFormat={handleConvertLayerFormat}
              onResetTransform={handleResetTransform}
              onUpdateFrameRange={handleUpdateFrameRange}
              onMergeSelectedLayers={handleMergeSelectedLayers}
              onMergeTwoLayers={handleMergeTwoLayers}
              onUngroupMergedLayer={handleUngroupMergedLayer}
              allLayers={layers}
              onSyncLayerMotion={handleSyncLayerMotion}
              onReorderLayer={handleReorderLayer}
              onTransformGroup={handleTransformGroup}
              onUngroup={handleUngroup}
              onDeleteGroup={handleDeleteGroup}
              onToggleGroupLock={handleToggleGroupLock}
              onToggleGroupVisibility={handleToggleGroupVisibility}
              groupLayersCount={selectedLayer?.groupId ? layers.filter(l => l.groupId === selectedLayer.groupId).length : 0}
              onUpdateProjectDimensions={handleUpdateProjectDimensions}
              onSyncSequenceMotion={handleSyncSequenceMotion}
              fadeConfig={fadeConfig}
              cropConfig={cropConfig}
              cropFeather={cropFeather}
              onUpdateFadeConfig={setFadeConfig}
              onUpdateCropConfig={setCropConfig}
              onUpdateCropFeather={setCropFeather}
              onResetTransparency={handleResetTransparency}
              onUpdateShineConfig={handleUpdateLayerShineConfig}
              onResetShine={handleResetShine}
              onCreateShineLayer={handleCreateShineLayer}
              onExportShineLayerOnly={handleExportShineLayerOnly}
              shinePointStep={shinePointStep}
              onStartPickShinePoints={() => setShinePointStep('place-start')}
              onCancelPickShinePoints={() => setShinePointStep('idle')}
              onLinkMirroredLayer={handleLinkMirroredLayer}
              onSyncMirroredLayerAsset={handleSyncMirroredLayerAsset}
              onToggleAutoSyncMirrored={handleToggleAutoSyncMirrored}
              onToggleAutoFlipMirrored={handleToggleAutoFlipMirrored}
              onDuplicateLayer={handleDuplicateLayer}
            />
          </aside>
        </div>
      ) : (
        /* Empty State / Initial Options */
        <div 
          className="flex-1 flex flex-col items-center justify-center p-6 bg-[#070b14]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
            if (files.length > 1) {
              handleLoadMultipleFiles(files);
            } else if (files.length === 1) {
              const f = files[0];
              if (f.name.toLowerCase().endsWith('.mp4') || f.type.startsWith('video/')) {
                setMp4InitialFiles([f]);
                setShowMp4ImportModal(true);
              } else if (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.gif') || f.name.toLowerCase().endsWith('.webp') || f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg')) {
                handleLoadMultipleFiles([f]);
              } else {
                loadSvgaFile(f);
              }
            }
          }}
        >
          <div className="max-w-4xl w-full bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl" dir="rtl">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-glow-indigo">
              <Layers size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">محرر وفك طبقات SVGA الاحترافي</h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-xl mx-auto">
                يمكنك رفع 3 إلى 4 مشاريع من أي صيغة (SVGA، MP4، صور) والعمل عليها في تكوينات مستقلة والتنقل بينها وتصديرها معاً دفعة واحدة بنقرة واحدة!
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 text-right">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Quick Actions Cards: 1. Multi-Files (3-4 Projects), 2. New Project, 3. Open SVGA, 4. Import MP4 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right">
              {/* Option 1: Multi-Files (3-4 Projects) */}
              <button
                onClick={() => multiFileInputRef.current?.click()}
                className="p-5 bg-gradient-to-b from-teal-600/20 via-emerald-600/15 to-transparent hover:from-teal-600/30 hover:via-emerald-600/25 border border-emerald-500/40 hover:border-emerald-400 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg shadow-emerald-600/10 hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/40 group-hover:scale-110 transition-transform">
                    <Package size={20} />
                  </div>
                  <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40">
                    مشاريع متعددة (3-4)
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">رفع عدة ملفات (3-4 مشاريع)</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    رفع ملفات متعددة (SVGA / MP4 / صور) في تبويبات مستقلة وتصديرها معاً دفعة واحدة
                  </p>
                </div>
              </button>

              {/* Option 2: Create New Project */}
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="p-5 bg-gradient-to-b from-indigo-600/20 via-purple-600/15 to-transparent hover:from-indigo-600/30 hover:via-purple-600/25 border border-indigo-500/40 hover:border-indigo-400 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg shadow-indigo-600/10 hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/40 group-hover:scale-110 transition-transform">
                    <Sparkles size={20} />
                  </div>
                  <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-full border border-indigo-500/40">
                    تصميم جديد
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">إنشاء مشروع من الصفر</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    حدد مقاس الكانفاس (750×1334، 1080×1920...) وابدأ إضافة الصور والطبقات وتصميم الحركة
                  </p>
                </div>
              </button>

              {/* Option 3: Open / Decompress SVGA File */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/40 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white group-hover:bg-indigo-600/30 group-hover:border-indigo-500/40 transition-all shadow-md">
                    <Upload size={20} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    فك ضغط وتحرير
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">فتح ملف SVGA موجود</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    فك ضغط ملف SVGA واستيراد جميع طبقاته وعناصره لتحريرها وتعديل مساراتها
                  </p>
                </div>
              </button>

              {/* Option 4: Import MP4 Video as SVGA */}
              <button
                onClick={() => {
                  setMp4InitialFiles([]);
                  setShowMp4ImportModal(true);
                }}
                className="p-5 bg-gradient-to-b from-pink-600/20 via-rose-600/15 to-transparent hover:from-pink-600/30 hover:via-rose-600/25 border border-pink-500/40 hover:border-pink-400 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg shadow-pink-600/10 hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-600/40 group-hover:scale-110 transition-transform">
                    <Film size={20} />
                  </div>
                  <span className="text-[10px] font-black text-pink-300 bg-pink-500/20 px-2.5 py-1 rounded-full border border-pink-500/40">
                    استدعاء MP4
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-white group-hover:text-pink-300 transition-colors">استدعاء فيديو MP4</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    استدعاء أي فيديو MP4 للتحكم به كـ SVGA (تغيير الحجم والمدة والصوت) وتصديره لأي صيغة
                  </p>
                </div>
              </button>
            </div>

            {/* Drop Zone Strip */}
            <div
              onClick={() => multiFileInputRef.current?.click()}
              className="border border-dashed border-white/15 hover:border-emerald-500/40 bg-black/20 hover:bg-black/40 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200"
            >
              <Upload size={15} className="text-emerald-400" />
              <span>أو اسحب وأفلت 3 إلى 4 ملفات (SVGA / MP4 / صور) هنا مباشرة للفتح المتوازي الفوري</span>
            </div>
          </div>
        </div>
      )}

      {/* New Project Configuration Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0b1020] border border-white/15 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">إنشاء مشروع SVGA جديد</h3>
                    <p className="text-[11px] text-slate-400">حدد المقاسات ومعدل الإطارات للبدء بالتصميم</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Project Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">اسم المشروع:</label>
                <input
                  type="text"
                  value={newProjectConfig.name}
                  onChange={(e) => setNewProjectConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مشروع SVGA جديد"
                  className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-xs text-white outline-none"
                />
              </div>

              {/* Dimension Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">اختر قالباً جاهزاً للمقاس:</label>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '📱 ستوري / لايف', w: 750, h: 1334, desc: '750×1334' },
                    { label: '📱 Full HD عمودي', w: 1080, h: 1920, desc: '1080×1920' },
                    { label: '⏹️ هدية قياسية', w: 750, h: 750, desc: '750×750' },
                    { label: '⏹️ صندوق هدية', w: 500, h: 500, desc: '500×500' },
                    { label: '💫 إيموجي / شارة', w: 300, h: 300, desc: '300×300' },
                    { label: '🖥️ عريض HD', w: 1280, h: 720, desc: '1280×720' },
                  ].map(preset => {
                    const isSelected = newProjectConfig.width === preset.w && newProjectConfig.height === preset.h;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setNewProjectConfig(prev => ({ ...prev, width: preset.w, height: preset.h }))}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer text-right flex flex-col justify-between ${
                          isSelected 
                            ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md' 
                            : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-[11px] font-bold block">{preset.label}</span>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold mt-1">{preset.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Width & Height Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">العرض (Width - px):</label>
                  <input
                    type="number"
                    min={50}
                    max={3840}
                    value={newProjectConfig.width}
                    onChange={(e) => setNewProjectConfig(prev => ({ ...prev, width: Math.max(10, parseInt(e.target.value) || 750) }))}
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 rounded-2xl px-4 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">الارتفاع (Height - px):</label>
                  <input
                    type="number"
                    min={50}
                    max={3840}
                    value={newProjectConfig.height}
                    onChange={(e) => setNewProjectConfig(prev => ({ ...prev, height: Math.max(10, parseInt(e.target.value) || 1334) }))}
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 rounded-2xl px-4 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              {/* Frames & FPS Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">مدة المشروع (بالثواني):</label>
                  <input
                    type="number"
                    min={0.1}
                    max={60}
                    step={0.1}
                    value={newProjectConfig.durationSec}
                    onChange={(e) => setNewProjectConfig(prev => ({ ...prev, durationSec: parseFloat(e.target.value) || 2 }))}
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 rounded-2xl px-3 py-2 text-xs font-mono text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">معدل الإطارات (FPS):</label>
                  <select
                    value={newProjectConfig.fps}
                    onChange={(e) => setNewProjectConfig(prev => ({ ...prev, fps: parseInt(e.target.value) || 30 }))}
                    className="w-full bg-slate-900 border border-white/10 focus:border-indigo-500 rounded-2xl px-3 py-2 text-xs font-mono text-white outline-none cursor-pointer"
                  >
                    <option value={15}>15 FPS (خفيف جداً)</option>
                    <option value={20}>20 FPS (قياسي)</option>
                    <option value={24}>24 FPS (سينمائي)</option>
                    <option value={30}>30 FPS (موصى به)</option>
                    <option value={60}>60 FPS (سلس فائق)</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCreateNewProject}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Sparkles size={16} />
                  <span>إنشاء والبدء بالتصميم الآن</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Confirmation & Download Modal */}
      <AnimatePresence>
        {showExportModal && project && (
          <ErrorBoundary fallbackTitle="حدث خطأ في واجهة التصدير" onReset={() => setShowExportModal(false)}>
            <SvgaExportModal
              isOpen={showExportModal}
              onClose={() => setShowExportModal(false)}
              project={project}
              layers={layers}
              fadeConfig={fadeConfig}
              cropConfig={cropConfig}
              cropFeather={cropFeather}
              onOpenViewer={onOpenViewer}
              onSuccessToast={(msg) => setSuccessToast(msg)}
            />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {/* Advanced SVGA Audio Studio & Waveform Trimmer Modal */}
      {project && showAudioStudioModal && (
        <ErrorBoundary fallbackTitle="حدث خطأ أثناء فتح استوديو الصوت" onReset={() => setShowAudioStudioModal(false)}>
          <SvgaAudioEditorModal
            isOpen={showAudioStudioModal}
            project={project}
            onClose={() => setShowAudioStudioModal(false)}
            onUpdateProject={(updatedProj) => {
              setProject(updatedProj);
              // Clean previous audio cache so newly added audio plays cleanly
              activeAudioMapRef.current.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0;
              });
              activeAudioMapRef.current.clear();
              // Reset frame and auto-play in the workspace interface
              setCurrentFrame(0);
              setIsPlaying(true);
              setSuccessToast('🎵 تم دمج الصوت وتشغيله في الواجهة للاستماع مباشرة!');
            }}
            onShowToast={(msg) => setSuccessToast(msg)}
          />
        </ErrorBoundary>
      )}

      {/* MP4 to SVGA Import Modal */}
      <AnimatePresence>
        {showMp4ImportModal && (
          <ErrorBoundary fallbackTitle="حدث خطأ في واجهة استدعاء فيديو MP4" onReset={() => setShowMp4ImportModal(false)}>
            <SvgaMp4ImportModal
              isOpen={showMp4ImportModal}
              onClose={() => setShowMp4ImportModal(false)}
              initialFiles={mp4InitialFiles}
              hasExistingProject={!!project}
              existingProject={project}
              onImportAsProject={handleImportMp4AsProject}
              onImportMultipleProjects={handleImportMultipleProjects}
              onImportAsLayer={handleImportMp4AsLayer}
              onImportMultipleLayers={handleImportMultipleLayers}
            />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      {/* Unified Merge & Canvas Transform Studio Modal */}
      {project && showMergeCanvasModal && (
        <ErrorBoundary fallbackTitle="حدث خطأ في واجهة دمج وتحريك الطبقات" onReset={() => setShowMergeCanvasModal(false)}>
          <SvgaMergeCanvasModal
            isOpen={showMergeCanvasModal}
            onClose={() => setShowMergeCanvasModal(false)}
            project={project}
            layers={layers}
            onMergeAllLayers={handleMergeAllLayers}
            onUngroupLayers={handleUngroupMergedLayer}
            onBulkTransform={handleBulkTransform}
            onSelectAllLayers={handleSelectAllLayers}
            isMergingLayers={isMergingLayers}
            selectedLayerIds={selectedLayerIds}
            setSuccessToast={(msg) => setSuccessToast(msg)}
          />
        </ErrorBoundary>
      )}

      {/* Batch Multi-Project Export Modal (Export all open 3-4 projects at once) */}
      {showBatchExportModal && (
        <ErrorBoundary fallbackTitle="حدث خطأ في واجهة التصدير الجماعي" onReset={() => setShowBatchExportModal(false)}>
          <SvgaBatchExportModal
            isOpen={showBatchExportModal}
            onClose={() => setShowBatchExportModal(false)}
            projects={projects}
            onSuccessToast={(msg) => setSuccessToast(msg)}
          />
        </ErrorBoundary>
      )}

      {/* Platform & Dashboard Backgrounds Library Modal */}
      {showBgLibraryModal && (
        <ErrorBoundary fallbackTitle="حدث خطأ في مكتبة الخلفيات" onReset={() => setShowBgLibraryModal(false)}>
          <SvgaBackgroundLibraryModal
            isOpen={showBgLibraryModal}
            onClose={() => setShowBgLibraryModal(false)}
            activeBgUrl={bgImageUrl}
            onSelectBackground={handleSelectBackground}
            projectsCount={projects.length}
          />
        </ErrorBoundary>
      )}

      {/* Mobile Bottom Tab Bar */}
      {isMobile && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0f1d]/95 backdrop-blur-md border-t border-white/10 grid grid-cols-3 z-[45] select-none pb-safe">
          <button
            onClick={() => setActiveMobileTab('layers')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeMobileTab === 'layers' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={18} />
            <span className="text-[10px]">الطبقات ({layers.length})</span>
          </button>

          <button
            onClick={() => setActiveMobileTab('canvas')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeMobileTab === 'canvas' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass size={18} />
            <span className="text-[10px]">الكانفاس والتايم لاين</span>
          </button>

          <button
            onClick={() => setActiveMobileTab('properties')}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
              activeMobileTab === 'properties' ? 'text-indigo-400 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders size={18} />
            <span className="text-[10px]">خصائص الطبقة {selectedLayerId ? '✓' : ''}</span>
          </button>
        </div>
      )}

      {/* Mobile Actions Drawer Menu */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center"
            onClick={() => setShowMobileMenu(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-h-[85vh] bg-[#0c1224] rounded-t-[2.5rem] border-t border-white/15 p-6 overflow-y-auto flex flex-col gap-5 pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-400" />
                  <span className="font-black text-sm text-slate-200">الأدوات والإعدادات المتقدمة</span>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grid of Mobile Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowNewProjectModal(true);
                    setShowMobileMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl gap-2 text-emerald-300 transition-all font-bold cursor-pointer"
                >
                  <Plus size={20} />
                  <span className="text-[11px]">مشروع جديد</span>
                </button>

                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMobileMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl gap-2 text-slate-200 transition-all font-bold cursor-pointer"
                >
                  <Upload size={20} className="text-indigo-400" />
                  <span className="text-[11px]">فتح SVGA</span>
                </button>

                <button
                  onClick={() => {
                    setMp4InitialFiles([]);
                    setShowMp4ImportModal(true);
                    setShowMobileMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-4 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-2xl gap-2 text-pink-300 transition-all font-bold cursor-pointer"
                >
                  <Film size={20} className="text-pink-400" />
                  <span className="text-[11px]">استدعاء MP4</span>
                </button>

                {project && (
                  <button
                    onClick={() => {
                      setShowAudioStudioModal(true);
                      setShowMobileMenu(false);
                    }}
                    className="flex flex-col items-center justify-center p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl gap-2 text-indigo-200 transition-all font-bold cursor-pointer"
                  >
                    <Music size={20} className="text-indigo-400" />
                    <span className="text-[11px]">دمج وقص الصوت</span>
                  </button>
                )}

                {project && (
                  <button
                    onClick={() => {
                      mergeFileInputRef.current?.click();
                      setShowMobileMenu(false);
                    }}
                    className="flex flex-col items-center justify-center p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl gap-2 text-purple-200 transition-all font-bold cursor-pointer"
                  >
                    <Sparkles size={20} className="text-purple-400" />
                    <span className="text-[11px]">دمج SVGA +</span>
                  </button>
                )}

                {project && layers.length > 1 && (
                  <button
                    onClick={() => {
                      handleMergeAllLayers();
                      setShowMobileMenu(false);
                    }}
                    disabled={isMergingLayers}
                    className="flex flex-col items-center justify-center p-4 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-2xl gap-2 text-purple-200 transition-all font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <Layers size={20} className="text-purple-400" />
                    <span className="text-[11px]">دمج كافة الطبقات</span>
                  </button>
                )}

                {project && (
                  <button
                    onClick={() => {
                      setShowBgLibraryModal(true);
                      setShowMobileMenu(false);
                    }}
                    className="flex flex-col items-center justify-center p-4 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-2xl gap-2 text-sky-200 transition-all font-bold cursor-pointer"
                  >
                    <ImageIcon size={20} className="text-sky-400" />
                    <span className="text-[11px]">مكتبة الخلفيات</span>
                  </button>
                )}

                {project && (
                  <button
                    onClick={() => {
                      handleToggleChromaPen();
                      setShowMobileMenu(false);
                    }}
                    className={`flex flex-col items-center justify-center p-4 border rounded-2xl gap-2 transition-all font-bold cursor-pointer ${
                      isChromaPenActive 
                        ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200' 
                        : 'bg-white/5 border-white/10 text-slate-200'
                    }`}
                  >
                    <Pipette size={20} className="text-indigo-400" />
                    <span className="text-[11px]">أداة كروما بن (Chroma)</span>
                  </button>
                )}
              </div>

              {/* Undo / Redo Row */}
              {project && (
                <div className="flex gap-2 border-t border-white/10 pt-4">
                  <button
                    onClick={() => {
                      handleUndo();
                      setShowMobileMenu(false);
                    }}
                    disabled={historyIndex <= 0}
                    className="flex-1 py-3 bg-white/5 disabled:opacity-30 rounded-xl flex items-center justify-center gap-2 border border-white/10 font-bold text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>تراجع</span>
                  </button>
                  <button
                    onClick={() => {
                      handleRedo();
                      setShowMobileMenu(false);
                    }}
                    disabled={historyIndex >= history.length - 1}
                    className="flex-1 py-3 bg-white/5 disabled:opacity-30 rounded-xl flex items-center justify-center gap-2 border border-white/10 font-bold text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RotateCcw size={14} className="scale-x-[-1]" />
                    <span>إعادة</span>
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
