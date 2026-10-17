import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  Scissors,
  Wand2,
  Pipette,
  Download,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Square,
  Circle,
  Lasso,
  Brush,
  Eraser,
  MousePointerClick,
  Sliders,
  FileVideo,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  Maximize2,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { UserRecord } from '../types';
import { SvgaPlayer } from './SvgaPlayer';
import { logActivity } from '../utils/logger';
import {
  DetectedVideoElement,
  SmartChromaSettings,
  DEFAULT_SMART_CHROMA_SETTINGS,
  SmartCompressionConfig,
  DEFAULT_SMART_COMPRESSION,
  ElementExportResult,
  hexToRgb,
  rgbToHex,
  autoDetectBackgroundColor,
  applySmartChromaKeyToFrame,
  analyzeAndSegmentVideoElements,
  exportIsolatedElementToSvga2,
  createBatchSvgaZipArchive,
  generateBuiltInTestMp4Video,
} from '../utils/smartMp4Engine';
import {
  SmartMp4TaskRecord,
  ingestVideoFileChunked,
  reconstructVideoFromChunks,
  saveSmartMp4ProjectState,
  loadSmartMp4ProjectsHistory,
  deleteSmartMp4Project,
} from '../services/smartMp4ProjectService';

interface QueuedVideoItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  url: string;
  status: 'queued' | 'ingesting' | 'ready' | 'processing' | 'done' | 'error';
  ingestProgress: number;
  width: number;
  height: number;
  duration: number;
  fps: number;
}

type StudioTab =
  | 'upload'
  | 'ai_segment'
  | 'manual_mask'
  | 'chroma'
  | 'crop_elements'
  | 'compression'
  | 'export_svga'
  | 'history';

type ManualToolType = 'pointer' | 'magic_wand' | 'rect' | 'ellipse' | 'lasso' | 'brush_add' | 'eraser' | 'eyedropper';

type ViewportDisplayMode = 'processed' | 'original' | 'isolated' | 'mask_overlay' | 'split_compare';

interface SmartMp4StudioProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  initialFile?: File | null;
}

export const SmartMp4Studio: React.FC<SmartMp4StudioProps> = ({
  currentUser,
  onCancel,
  initialFile,
}) => {
  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<StudioTab>('upload');

  // Queue & Active Video State
  const [videoQueue, setVideoQueue] = useState<QueuedVideoItem[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState<boolean>(false);

  // Playback & Trim State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [videoWidth, setVideoWidth] = useState<number>(960);
  const [videoHeight, setVideoHeight] = useState<number>(540);
  const [sourceFps, setSourceFps] = useState<number>(24);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // Viewport & Canvas Interaction State
  const [viewMode, setViewMode] = useState<ViewportDisplayMode>('processed');
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);

  // AI Segmentation & Detected Elements State
  const [elements, setElements] = useState<DetectedVideoElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [minAreaPercent, setMinAreaPercent] = useState<number>(0.35);
  const [splitMultiRows, setSplitMultiRows] = useState<boolean>(true);
  const [useAiPersonModel, setUseAiPersonModel] = useState<boolean>(true);

  // Manual Mask Tools State
  const [manualTool, setManualTool] = useState<ManualToolType>('pointer');
  const [maskCombineMode, setMaskCombineMode] = useState<'add' | 'subtract'>('add');
  const [brushSize, setBrushSize] = useState<number>(18);
  const [isDrawingMask, setIsDrawingMask] = useState<boolean>(false);
  const [dragStartPt, setDragStartPt] = useState<{ x: number; y: number } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<Array<{ x: number; y: number }>>([]);

  // Chroma Key & Despill State
  const [chroma, setChroma] = useState<SmartChromaSettings>(DEFAULT_SMART_CHROMA_SETTINGS);

  // Smart Compression State
  const [compression, setCompression] = useState<SmartCompressionConfig>(DEFAULT_SMART_COMPRESSION);

  // Task / Job Progress State
  const [taskState, setTaskState] = useState<{
    active: boolean;
    phase: string;
    percent: number;
    error: string | null;
  }>({ active: false, phase: '', percent: 0, error: null });

  // Exported SVGA Results & Live Preview Modal
  const [exportResults, setExportResults] = useState<ElementExportResult[]>([]);
  const [batchZipInfo, setBatchZipInfo] = useState<{ zipUrl: string; zipFileName: string; sizeBytes: number } | null>(null);
  const [previewSvgaResult, setPreviewSvgaResult] = useState<ElementExportResult | null>(null);

  // Saved Projects History (IndexedDB + Firestore)
  const [savedProjects, setSavedProjects] = useState<
    Array<{ record: SmartMp4TaskRecord; elements: DetectedVideoElement[] }>
  >([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevAlphaRef = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number | null>(null);

  const activeQueueItem = videoQueue.find((q) => q.id === activeQueueId) || null;
  const selectedElement = elements.find((e) => e.id === selectedElementId) || elements[0] || null;
  const currentFrameIndex = Math.max(0, Math.round((currentTime - trimStart) * (sourceFps || 24)));
  const totalTrimmedFrames = Math.max(1, Math.round(Math.max(0.1, trimEnd - trimStart) * (sourceFps || 24)));

  // Load saved projects history on mount
  const refreshHistory = useCallback(async () => {
    const list = await loadSmartMp4ProjectsHistory();
    setSavedProjects(list);
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Enqueue and chunk-ingest uploaded files without mutating original files
  const handleFilesSelected = useCallback(
    async (filesList: File[]) => {
      if (!filesList || filesList.length === 0) return;

      const validFiles = filesList.filter((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith('.mp4') ||
          name.endsWith('.webm') ||
          name.endsWith('.mov') ||
          name.endsWith('.avi') ||
          f.type.startsWith('video/')
        );
      });

      if (validFiles.length === 0) {
        setTaskState({
          active: false,
          phase: '',
          percent: 0,
          error: 'يرجى اختيار ملف فيديو صالح بصيغة MP4 أو WebM أو MOV.',
        });
        return;
      }

      const newItems: QueuedVideoItem[] = validFiles.map((file, idx) => ({
        id: `vid_${Date.now()}_${idx}`,
        file,
        name: file.name,
        sizeBytes: file.size,
        url: URL.createObjectURL(file),
        status: 'ingesting',
        ingestProgress: 0,
        width: 960,
        height: 540,
        duration: 0,
        fps: 24,
      }));

      setVideoQueue((prev) => [...prev, ...newItems]);
      if (!activeQueueId && newItems.length > 0) {
        setActiveQueueId(newItems[0].id);
      }

      // Chunked ingestion into IndexedDB for each queued video
      for (const item of newItems) {
        try {
          await ingestVideoFileChunked(item.file, item.id, (loaded, total) => {
            const pct = Math.round((loaded / Math.max(1, total)) * 100);
            setVideoQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, ingestProgress: pct } : q))
            );
          });
          setVideoQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: 'ready', ingestProgress: 100 } : q))
          );
        } catch {
          setVideoQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, status: 'ready', ingestProgress: 100 } : q))
          );
        }
      }
    },
    [activeQueueId]
  );

  // Load initialFile if passed via props
  const initialLoadedRef = useRef<File | null>(null);
  useEffect(() => {
    if (initialFile && initialLoadedRef.current !== initialFile) {
      initialLoadedRef.current = initialFile;
      handleFilesSelected([initialFile]);
    }
  }, [initialFile, handleFilesSelected]);

  // Handle Built-in Test Video Generation
  const handleGenerateTestVideo = async (preset: 'multi_row' | 'single_hero' | 'overlapping') => {
    setIsGeneratingDemo(true);
    setTaskState({
      active: true,
      phase: 'جاري إنشاء فيديو اختباري متعدد الشخصيات بخلفية خضراء...',
      percent: 10,
      error: null,
    });

    try {
      const demoFile = await generateBuiltInTestMp4Video(preset, (pct, msg) => {
        setTaskState({ active: true, phase: msg, percent: pct, error: null });
      });
      await handleFilesSelected([demoFile]);
      setTaskState({ active: false, phase: '', percent: 100, error: null });
      setActiveTab('ai_segment');
    } catch (err: any) {
      setTaskState({
        active: false,
        phase: '',
        percent: 0,
        error: `تعذر إنشاء فيديو الاختبار: ${err?.message || 'خطأ غير معروف'}`,
      });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  // When activeQueueItem changes, load metadata into <video>
  const handleVideoLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const vw = v.videoWidth || 960;
    const vh = v.videoHeight || 540;
    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 2.5;

    setVideoWidth(vw);
    setVideoHeight(vh);
    setDuration(dur);
    setTrimStart(0);
    setTrimEnd(Number(dur.toFixed(2)));
    setCurrentTime(0);

    if (activeQueueId) {
      setVideoQueue((prev) =>
        prev.map((q) =>
          q.id === activeQueueId ? { ...q, width: vw, height: vh, duration: dur } : q
        )
      );
    }

    // Auto-detect background color on initial frame load if chroma mode is 'auto'
    setTimeout(() => {
      if (!videoRef.current) return;
      const tempC = document.createElement('canvas');
      tempC.width = vw;
      tempC.height = vh;
      const tCtx = tempC.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(videoRef.current, 0, 0, vw, vh);
        const imgData = tCtx.getImageData(0, 0, vw, vh);
        const detected = autoDetectBackgroundColor(imgData);
        if (chroma.mode === 'auto') {
          setChroma((prev) => ({
            ...prev,
            keyColor: detected.hex,
            keyRgb: detected.rgb,
            tolerance: detected.recommendedTolerance,
          }));
        }
      }
      renderCurrentFrameToCanvas();
    }, 120);
  };

  // Real-time Frame Renderer onto displayCanvasRef
  const renderCurrentFrameToCanvas = useCallback(() => {
    const v = videoRef.current;
    const canvas = displayCanvasRef.current;
    if (!v || !canvas || v.readyState < 2) return;

    const vw = v.videoWidth || videoWidth || 960;
    const vh = v.videoHeight || videoHeight || 540;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 1. Draw raw video frame to offscreen buffer
    const offCanvas = document.createElement('canvas');
    offCanvas.width = vw;
    offCanvas.height = vh;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;
    offCtx.drawImage(v, 0, 0, vw, vh);

    if (viewMode === 'original') {
      ctx.clearRect(0, 0, vw, vh);
      ctx.drawImage(offCanvas, 0, 0);
    } else {
      const frameImgData = offCtx.getImageData(0, 0, vw, vh);

      // Determine if we are isolating a single selected element or showing all visible elements
      let activeElementMask: Uint8Array | null = null;
      let maskW: number | undefined;
      let maskH: number | undefined;

      if (viewMode === 'isolated' && selectedElement) {
        activeElementMask =
          selectedElement.frameMasks?.[currentFrameIndex] || selectedElement.manualMask || null;
        maskW = selectedElement.maskWidth;
        maskH = selectedElement.maskHeight;
      } else if (elements.length > 0) {
        // Combine masks of all visible elements
        const firstWithMask = elements.find((e) => e.manualMask && e.maskWidth && e.maskHeight);
        if (firstWithMask && firstWithMask.maskWidth && firstWithMask.maskHeight) {
          maskW = firstWithMask.maskWidth;
          maskH = firstWithMask.maskHeight;
          const combined = new Uint8Array(maskW * maskH);
          for (const el of elements) {
            if (!el.visible) continue;
            const m = el.frameMasks?.[currentFrameIndex] || el.manualMask;
            if (m && m.length === combined.length) {
              for (let i = 0; i < combined.length; i++) {
                if (m[i] > combined[i]) combined[i] = m[i];
              }
            }
          }
          activeElementMask = combined;
        }
      }

      prevAlphaRef.current = applySmartChromaKeyToFrame(
        frameImgData,
        chroma,
        activeElementMask,
        maskW,
        maskH,
        prevAlphaRef.current
      );

      const processedCanvas = document.createElement('canvas');
      processedCanvas.width = vw;
      processedCanvas.height = vh;
      processedCanvas.getContext('2d')!.putImageData(frameImgData, 0, 0);

      ctx.clearRect(0, 0, vw, vh);

      if (viewMode === 'split_compare') {
        const splitX = Math.round((splitPercent / 100) * vw);
        // Left side: Processed (Chroma removed)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, vh);
        ctx.clip();
        ctx.drawImage(processedCanvas, 0, 0);
        ctx.restore();

        // Right side: Original video
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, vw - splitX, vh);
        ctx.clip();
        ctx.drawImage(offCanvas, 0, 0);
        ctx.restore();

        // Split divider line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, vh);
        ctx.stroke();
      } else {
        ctx.drawImage(processedCanvas, 0, 0);
      }

      // If mask_overlay mode or Manual Mask tab is active, render semi-transparent mask tint for selected element
      if ((viewMode === 'mask_overlay' || activeTab === 'manual_mask') && selectedElement) {
        const m = selectedElement.frameMasks?.[currentFrameIndex] || selectedElement.manualMask;
        const mw = selectedElement.maskWidth;
        const mh = selectedElement.maskHeight;
        if (m && mw && mh) {
          const maskOverlayCanvas = document.createElement('canvas');
          maskOverlayCanvas.width = mw;
          maskOverlayCanvas.height = mh;
          const mCtx = maskOverlayCanvas.getContext('2d')!;
          const mImg = mCtx.createImageData(mw, mh);
          for (let i = 0; i < m.length; i++) {
            if (m[i] > 0) {
              mImg.data[i * 4] = 16;
              mImg.data[i * 4 + 1] = 185;
              mImg.data[i * 4 + 2] = 129;
              mImg.data[i * 4 + 3] = 95;
            }
          }
          mCtx.putImageData(mImg, 0, 0);
          ctx.drawImage(maskOverlayCanvas, 0, 0, vw, vh);
        }
      }
    }

    // Draw bounding boxes & element labels if enabled
    if (showBoundingBoxes && elements.length > 0) {
      elements.forEach((el) => {
        if (!el.visible) return;
        const isSelected = el.id === selectedElement?.id;
        const box = el.frameBBoxes?.[currentFrameIndex] || el.motionBounds;
        const pad = el.customPadding || 0;
        const bx = Math.max(0, box.x - pad);
        const by = Math.max(0, box.y - pad);
        const bw = Math.min(vw - bx, box.width + pad * 2);
        const bh = Math.min(vh - by, box.height + pad * 2);

        ctx.save();
        ctx.strokeStyle = el.overlapWarning
          ? '#f59e0b'
          : isSelected
          ? '#10b981'
          : 'rgba(99, 102, 241, 0.75)';
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.setLineDash(isSelected ? [] : [6, 4]);
        ctx.strokeRect(bx, by, bw, bh);

        // Label tag
        ctx.fillStyle = el.overlapWarning
          ? 'rgba(245, 158, 11, 0.92)'
          : isSelected
          ? 'rgba(16, 185, 129, 0.92)'
          : 'rgba(15, 23, 42, 0.85)';
        const labelText = `#${el.index} ${el.name}`;
        ctx.font = 'bold 12px sans-serif';
        const textW = ctx.measureText(labelText).width + 12;
        ctx.fillRect(bx, Math.max(0, by - 22), textW, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, bx + 6, Math.max(14, by - 8));
        ctx.restore();
      });
    }

    // Draw active manual selection drag preview (rect / ellipse / lasso)
    if (isDrawingMask && dragStartPt && lassoPoints.length > 0) {
      const lastPt = lassoPoints[lassoPoints.length - 1];
      ctx.save();
      ctx.strokeStyle = maskCombineMode === 'add' ? '#10b981' : '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 3]);

      if (manualTool === 'rect') {
        ctx.strokeRect(
          dragStartPt.x,
          dragStartPt.y,
          lastPt.x - dragStartPt.x,
          lastPt.y - dragStartPt.y
        );
      } else if (manualTool === 'ellipse') {
        const rx = Math.abs(lastPt.x - dragStartPt.x) / 2;
        const ry = Math.abs(lastPt.y - dragStartPt.y) / 2;
        const cx = (dragStartPt.x + lastPt.x) / 2;
        const cy = (dragStartPt.y + lastPt.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (manualTool === 'lasso' && lassoPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
        for (let i = 1; i < lassoPoints.length; i++) {
          ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [
    videoWidth,
    videoHeight,
    viewMode,
    splitPercent,
    chroma,
    elements,
    selectedElement,
    currentFrameIndex,
    showBoundingBoxes,
    activeTab,
    isDrawingMask,
    dragStartPt,
    lassoPoints,
    manualTool,
    maskCombineMode,
  ]);

  // Playback Animation Loop
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const tick = () => {
      if (v && !v.paused) {
        const nowTime = v.currentTime;
        if (trimEnd > trimStart && nowTime >= trimEnd) {
          v.currentTime = trimStart;
        }
        setCurrentTime((prev) => (Math.abs(prev - nowTime) > 0.03 ? nowTime : prev));
        renderCurrentFrameToCanvas();
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, trimStart, trimEnd, renderCurrentFrameToCanvas]);

  // Re-render canvas whenever settings or frame change while paused
  useEffect(() => {
    if (!isPlaying) {
      renderCurrentFrameToCanvas();
    }
  }, [isPlaying, currentTime, chroma, elements, selectedElementId, viewMode, splitPercent, showBoundingBoxes, renderCurrentFrameToCanvas]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const stepFrame = (deltaFrames: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
    const frameDur = 1 / (sourceFps || 24);
    const nextTime = Math.max(trimStart, Math.min(trimEnd || duration, v.currentTime + deltaFrames * frameDur));
    v.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  // Run AI Multi-Element Detection & Segmentation
  const handleRunSmartAiSegmentation = async () => {
    const v = videoRef.current;
    if (!v || !activeQueueItem) return;

    v.pause();
    setIsPlaying(false);
    setTaskState({
      active: true,
      phase: 'جاري تشغيل التحليل الذكي وفصل الشخصيات والعناصر المستقلة...',
      percent: 5,
      error: null,
    });

    try {
      const detected = await analyzeAndSegmentVideoElements(v, chroma, {
        trimStart,
        trimEnd: trimEnd || duration || 2.5,
        fps: sourceFps || 24,
        minElementAreaPercent: minAreaPercent,
        splitMultiRows,
        useAiPersonModel,
        onProgress: (pct, msg) => {
          setTaskState({ active: true, phase: msg, percent: pct, error: null });
        },
      });

      setElements(detected);
      if (detected.length > 0) {
        setSelectedElementId(detected[0].id);
      }

      // Persist project state to IndexedDB + Firestore
      const taskRecord: SmartMp4TaskRecord = {
        id: activeQueueItem.id,
        userId: currentUser?.id || 'guest',
        fileName: activeQueueItem.name,
        fileSize: activeQueueItem.sizeBytes,
        width: videoWidth,
        height: videoHeight,
        duration,
        fps: sourceFps,
        trimStart,
        trimEnd: trimEnd || duration,
        elementsCount: detected.length,
        exportedCount: 0,
        status: 'ready',
        progress: 100,
        statusMessage: `تم فصل ${detected.length} عنصر بنجاح`,
        chromaSettings: chroma,
        compressionSettings: compression,
        elementsSummary: detected.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          width: d.motionBounds.width,
          height: d.motionBounds.height,
          frames: d.frameCount,
          estimatedSizeKb: d.estimatedSizeKb,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveSmartMp4ProjectState(taskRecord, detected);
      await refreshHistory();

      setTaskState({ active: false, phase: '', percent: 100, error: null });
      setActiveTab('crop_elements');
    } catch (err: any) {
      setTaskState({
        active: false,
        phase: '',
        percent: 0,
        error: `فشل تحليل العناصر: ${err?.message || 'خطأ غير معروف'}`,
      });
    }
  };

  // Interactive Canvas Mouse Handlers for Manual Mask Editing & Eyedropper
  const getCanvasPixelCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: Math.max(0, Math.min(canvas.width - 1, Math.round((e.clientX - rect.left) * scaleX))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.round((e.clientY - rect.top) * scaleY))),
    };
  };

  const applyBrushStrokeAtPoint = (canvasX: number, canvasY: number, isAdd: boolean) => {
    if (!selectedElement) return;
    const mw = selectedElement.maskWidth || 240;
    const mh = selectedElement.maskHeight || 135;
    const gx = Math.round((canvasX / Math.max(1, videoWidth)) * mw);
    const gy = Math.round((canvasY / Math.max(1, videoHeight)) * mh);
    const gRadius = Math.max(1, Math.round((brushSize / Math.max(1, videoWidth)) * mw));

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id) return el;
        const baseMask = el.frameMasks?.[currentFrameIndex] || el.manualMask || new Uint8Array(mw * mh).fill(255);
        const updatedMask = new Uint8Array(baseMask);

        for (let dy = -gRadius; dy <= gRadius; dy++) {
          const ny = gy + dy;
          if (ny < 0 || ny >= mh) continue;
          for (let dx = -gRadius; dx <= gRadius; dx++) {
            const nx = gx + dx;
            if (nx < 0 || nx >= mw) continue;
            if (dx * dx + dy * dy <= gRadius * gRadius) {
              updatedMask[ny * mw + nx] = isAdd ? 255 : 0;
            }
          }
        }

        return {
          ...el,
          manualMask: updatedMask,
          frameMasks: {
            ...(el.frameMasks || {}),
            [currentFrameIndex]: updatedMask,
          },
        };
      })
    );
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPixelCoords(e);
    const v = videoRef.current;

    // 1. Eyedropper tool: sample raw video color at clicked coordinate
    if (manualTool === 'eyedropper' && v) {
      const tempC = document.createElement('canvas');
      tempC.width = videoWidth;
      tempC.height = videoHeight;
      const tCtx = tempC.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(v, 0, 0, videoWidth, videoHeight);
        const pixel = tCtx.getImageData(pt.x, pt.y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        setChroma((prev) => ({
          ...prev,
          enabled: true,
          mode: 'manual',
          keyColor: hex,
          keyRgb: { r: pixel[0], g: pixel[1], b: pixel[2] },
        }));
      }
      setManualTool('pointer');
      return;
    }

    // 2. Smart Click-to-Select Element or Region
    if (manualTool === 'pointer' || manualTool === 'magic_wand') {
      const hitElement = elements.find((el) => {
        if (!el.visible) return false;
        const b = el.frameBBoxes?.[currentFrameIndex] || el.motionBounds;
        return pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height;
      });
      if (hitElement) {
        setSelectedElementId(hitElement.id);
      }
      return;
    }

    // 3. Brush / Eraser
    if (manualTool === 'brush_add' || manualTool === 'eraser') {
      setIsDrawingMask(true);
      applyBrushStrokeAtPoint(pt.x, pt.y, manualTool === 'brush_add');
      return;
    }

    // 4. Rect / Ellipse / Lasso
    if (manualTool === 'rect' || manualTool === 'ellipse' || manualTool === 'lasso') {
      setIsDrawingMask(true);
      setDragStartPt(pt);
      setLassoPoints([pt]);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMask) return;
    const pt = getCanvasPixelCoords(e);

    if (manualTool === 'brush_add' || manualTool === 'eraser') {
      applyBrushStrokeAtPoint(pt.x, pt.y, manualTool === 'brush_add');
      return;
    }

    if (manualTool === 'rect' || manualTool === 'ellipse' || manualTool === 'lasso') {
      setLassoPoints((prev) => [...prev, pt]);
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingMask) return;
    setIsDrawingMask(false);

    if (
      selectedElement &&
      dragStartPt &&
      lassoPoints.length > 1 &&
      (manualTool === 'rect' || manualTool === 'ellipse' || manualTool === 'lasso')
    ) {
      const mw = selectedElement.maskWidth || 240;
      const mh = selectedElement.maskHeight || 135;
      const endPt = lassoPoints[lassoPoints.length - 1];

      // Rasterize shape onto a mw x mh mask canvas
      const shapeCanvas = document.createElement('canvas');
      shapeCanvas.width = mw;
      shapeCanvas.height = mh;
      const sCtx = shapeCanvas.getContext('2d')!;
      sCtx.fillStyle = '#ffffff';

      const sx = (dragStartPt.x / Math.max(1, videoWidth)) * mw;
      const sy = (dragStartPt.y / Math.max(1, videoHeight)) * mh;
      const ex = (endPt.x / Math.max(1, videoWidth)) * mw;
      const ey = (endPt.y / Math.max(1, videoHeight)) * mh;

      sCtx.beginPath();
      if (manualTool === 'rect') {
        sCtx.rect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
      } else if (manualTool === 'ellipse') {
        sCtx.ellipse(
          (sx + ex) / 2,
          (sy + ey) / 2,
          Math.abs(ex - sx) / 2,
          Math.abs(ey - sy) / 2,
          0,
          0,
          Math.PI * 2
        );
      } else if (manualTool === 'lasso') {
        lassoPoints.forEach((p, idx) => {
          const lx = (p.x / Math.max(1, videoWidth)) * mw;
          const ly = (p.y / Math.max(1, videoHeight)) * mh;
          if (idx === 0) sCtx.moveTo(lx, ly);
          else sCtx.lineTo(lx, ly);
        });
        sCtx.closePath();
      }
      sCtx.fill();

      const shapeData = sCtx.getImageData(0, 0, mw, mh).data;
      const targetVal = maskCombineMode === 'add' ? 255 : 0;

      // Also compute pixel bounding box if adding a new region
      const minPxX = Math.max(0, Math.min(dragStartPt.x, endPt.x));
      const minPxY = Math.max(0, Math.min(dragStartPt.y, endPt.y));
      const maxPxX = Math.min(videoWidth, Math.max(dragStartPt.x, endPt.x));
      const maxPxY = Math.min(videoHeight, Math.max(dragStartPt.y, endPt.y));

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedElement.id) return el;
          const baseMask = el.frameMasks?.[currentFrameIndex] || el.manualMask || new Uint8Array(mw * mh);
          const nextMask = new Uint8Array(baseMask);
          for (let i = 0; i < mw * mh; i++) {
            if (shapeData[i * 4 + 3] > 128) {
              nextMask[i] = targetVal;
            }
          }
          return {
            ...el,
            manualMask: nextMask,
            motionBounds:
              maskCombineMode === 'add' && maxPxX - minPxX > 15 && maxPxY - minPxY > 15
                ? {
                    x: Math.min(el.motionBounds.x, minPxX),
                    y: Math.min(el.motionBounds.y, minPxY),
                    width: Math.max(el.motionBounds.x + el.motionBounds.width, maxPxX) - Math.min(el.motionBounds.x, minPxX),
                    height: Math.max(el.motionBounds.y + el.motionBounds.height, maxPxY) - Math.min(el.motionBounds.y, minPxY),
                  }
                : el.motionBounds,
            overlapWarning: false,
            frameMasks: {
              ...(el.frameMasks || {}),
              [currentFrameIndex]: nextMask,
            },
          };
        })
      );
    }

    setDragStartPt(null);
    setLassoPoints([]);
  };

  // Manual Mask Actions: Invert, Save Snapshot, Restore Snapshot, Propagate to Following Frames, Add Custom Manual Layer
  const handleInvertSelectedMask = () => {
    if (!selectedElement) return;
    const mw = selectedElement.maskWidth || 240;
    const mh = selectedElement.maskHeight || 135;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id) return el;
        const curr = el.frameMasks?.[currentFrameIndex] || el.manualMask || new Uint8Array(mw * mh);
        const inv = new Uint8Array(curr.length);
        for (let i = 0; i < curr.length; i++) {
          inv[i] = curr[i] > 127 ? 0 : 255;
        }
        return {
          ...el,
          manualMask: inv,
          frameMasks: { ...(el.frameMasks || {}), [currentFrameIndex]: inv },
        };
      })
    );
  };

  const handleSaveMaskSnapshot = () => {
    if (!selectedElement) return;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id) return el;
        const curr = el.frameMasks?.[currentFrameIndex] || el.manualMask;
        return curr ? { ...el, savedMaskSnapshot: new Uint8Array(curr) } : el;
      })
    );
  };

  const handleRestoreMaskSnapshot = () => {
    if (!selectedElement?.savedMaskSnapshot) return;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id || !el.savedMaskSnapshot) return el;
        const snap = new Uint8Array(el.savedMaskSnapshot);
        return {
          ...el,
          manualMask: snap,
          frameMasks: { ...(el.frameMasks || {}), [currentFrameIndex]: snap },
        };
      })
    );
  };

  const handlePropagateMaskToFollowingFrames = () => {
    if (!selectedElement) return;
    const activeMask = selectedElement.frameMasks?.[currentFrameIndex] || selectedElement.manualMask;
    if (!activeMask) return;

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== selectedElement.id) return el;
        const nextFrameMasks: Record<number, Uint8Array> = { ...(el.frameMasks || {}) };
        for (let f = currentFrameIndex; f < totalTrimmedFrames; f++) {
          nextFrameMasks[f] = new Uint8Array(activeMask);
        }
        return {
          ...el,
          manualMask: new Uint8Array(activeMask),
          frameMasks: nextFrameMasks,
          overlapWarning: false,
        };
      })
    );
  };

  const handleDuplicateSelectedElement = () => {
    if (!selectedElement) return;
    const newId = `elem_dup_${Date.now().toString(36)}`;
    const copy: DetectedVideoElement = {
      ...selectedElement,
      id: newId,
      index: elements.length + 1,
      name: `${selectedElement.name} (نسخة)`,
      manualMask: selectedElement.manualMask ? new Uint8Array(selectedElement.manualMask) : undefined,
    };
    setElements((prev) => [...prev, copy]);
    setSelectedElementId(newId);
  };

  const handleDeleteElement = (id: string) => {
    setElements((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      if (selectedElementId === id) {
        setSelectedElementId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleAddEmptyManualLayer = () => {
    const mw = 240;
    const mh = Math.max(135, Math.round((videoHeight / Math.max(1, videoWidth)) * mw));
    const newId = `elem_manual_${Date.now().toString(36)}`;
    const newEl: DetectedVideoElement = {
      id: newId,
      index: elements.length + 1,
      name: `طبقة يدوية #${elements.length + 1}`,
      category: 'character',
      categoryLabelAr: 'تحديد يدوي مخصص',
      thumbnailDataUrl: '',
      bounds: { x: Math.round(videoWidth * 0.2), y: Math.round(videoHeight * 0.2), width: Math.round(videoWidth * 0.6), height: Math.round(videoHeight * 0.6) },
      motionBounds: { x: Math.round(videoWidth * 0.15), y: Math.round(videoHeight * 0.15), width: Math.round(videoWidth * 0.7), height: Math.round(videoHeight * 0.7) },
      frameBBoxes: {},
      areaPercent: 25,
      frameCount: totalTrimmedFrames,
      durationSec: Number(Math.max(0.1, trimEnd - trimStart).toFixed(2)),
      estimatedSizeKb: 65,
      visible: true,
      locked: false,
      customPadding: 8,
      cropMode: 'tight',
      manualMask: new Uint8Array(mw * mh),
      maskWidth: mw,
      maskHeight: mh,
      frameMasks: {},
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newId);
    setManualTool('rect');
    setMaskCombineMode('add');
  };

  // Export Single Element to SVGA 2.0
  const handleExportSingleElementSvga = async (targetEl: DetectedVideoElement) => {
    const v = videoRef.current;
    if (!v) return;

    v.pause();
    setIsPlaying(false);
    setTaskState({
      active: true,
      phase: `جاري تصدير (${targetEl.name}) إلى ملف SVGA 2.0 وفحصه...`,
      percent: 5,
      error: null,
    });

    try {
      const res = await exportIsolatedElementToSvga2(
        v,
        targetEl,
        chroma,
        compression,
        trimStart,
        trimEnd || duration || 2.5,
        (pct, phase) => {
          setTaskState({ active: true, phase, percent: pct, error: null });
        }
      );

      setExportResults((prev) => [res, ...prev.filter((r) => r.elementId !== res.elementId)]);
      setPreviewSvgaResult(res);
      setTaskState({ active: false, phase: '', percent: 100, error: null });
      setActiveTab('export_svga');

      if (currentUser) {
        logActivity(currentUser, 'export_svga', `Smart MP4 Studio: Exported ${res.fileName} (${(res.compressedBytes / 1024).toFixed(1)} KB)`);
      }
    } catch (err: any) {
      setTaskState({
        active: false,
        phase: '',
        percent: 0,
        error: `فشل تصدير SVGA: ${err?.message || 'خطأ غير معروف'}`,
      });
    }
  };

  // Export All Visible Elements to SVGA 2.0 + Batch ZIP Archive
  const handleExportAllElementsBatchSvga = async () => {
    const v = videoRef.current;
    const visibleEls = elements.filter((e) => e.visible);
    if (!v || visibleEls.length === 0) return;

    v.pause();
    setIsPlaying(false);

    const results: ElementExportResult[] = [];
    try {
      for (let i = 0; i < visibleEls.length; i++) {
        const el = visibleEls[i];
        const res = await exportIsolatedElementToSvga2(
          v,
          el,
          chroma,
          compression,
          trimStart,
          trimEnd || duration || 2.5,
          (pct, phase) => {
            const overallPct = Math.round(((i + pct / 100) / visibleEls.length) * 90);
            setTaskState({
              active: true,
              phase: `[${i + 1}/${visibleEls.length}] ${phase}`,
              percent: overallPct,
              error: null,
            });
          }
        );
        results.push(res);
      }

      setTaskState({
        active: true,
        phase: 'جاري تجميع جميع ملفات SVGA 2.0 وتقرير الفحص في حزمة ZIP موحدة...',
        percent: 95,
        error: null,
      });

      const zipInfo = await createBatchSvgaZipArchive(
        results,
        activeQueueItem?.name || 'smart_video.mp4'
      );

      setExportResults(results);
      setBatchZipInfo({
        zipUrl: zipInfo.zipUrl,
        zipFileName: zipInfo.zipFileName,
        sizeBytes: zipInfo.zipBlob.size,
      });
      if (results.length > 0) {
        setPreviewSvgaResult(results[0]);
      }

      setTaskState({ active: false, phase: '', percent: 100, error: null });
      setActiveTab('export_svga');
    } catch (err: any) {
      setTaskState({
        active: false,
        phase: '',
        percent: 0,
        error: `حدث خطأ أثناء التصدير الجماعي: ${err?.message || 'خطأ غير معروف'}`,
      });
    }
  };

  // Resume a project from History
  const handleResumeSavedProject = async (proj: {
    record: SmartMp4TaskRecord;
    elements: DetectedVideoElement[];
  }) => {
    setTaskState({
      active: true,
      phase: 'جاري استرجاع ملف الفيديو وحالة المشروع من الذاكرة المحلية...',
      percent: 40,
      error: null,
    });

    const restoredFile = await reconstructVideoFromChunks(proj.record.id, proj.record.fileName);
    if (restoredFile) {
      const url = URL.createObjectURL(restoredFile);
      const item: QueuedVideoItem = {
        id: proj.record.id,
        file: restoredFile,
        name: proj.record.fileName,
        sizeBytes: proj.record.fileSize,
        url,
        status: 'ready',
        ingestProgress: 100,
        width: proj.record.width,
        height: proj.record.height,
        duration: proj.record.duration,
        fps: proj.record.fps,
      };
      setVideoQueue((prev) => [item, ...prev.filter((q) => q.id !== item.id)]);
      setActiveQueueId(item.id);
    }

    if (proj.record.chromaSettings?.keyColor) {
      setChroma(proj.record.chromaSettings);
    }
    if (proj.record.compressionSettings?.preset) {
      setCompression(proj.record.compressionSettings);
    }
    if (proj.elements && proj.elements.length > 0) {
      setElements(proj.elements);
      setSelectedElementId(proj.elements[0].id);
    }

    setTaskState({ active: false, phase: '', percent: 100, error: null });
    setActiveTab('crop_elements');
  };

  const applyCompressionPreset = (preset: 'light' | 'balanced' | 'strong' | 'custom') => {
    if (preset === 'light') {
      setCompression({
        preset: 'light',
        imageQuality: 95,
        pngColors: 0,
        targetFps: sourceFps || 30,
        dimensionScale: 1.0,
        deduplicateFrames: true,
        stripMetadata: true,
        similarityThreshold: 1,
      });
    } else if (preset === 'balanced') {
      setCompression({
        preset: 'balanced',
        imageQuality: 85,
        pngColors: 256,
        targetFps: 24,
        dimensionScale: 1.0,
        deduplicateFrames: true,
        stripMetadata: true,
        similarityThreshold: 3,
      });
    } else if (preset === 'strong') {
      setCompression({
        preset: 'strong',
        imageQuality: 65,
        pngColors: 128,
        targetFps: 20,
        dimensionScale: 0.75,
        deduplicateFrames: true,
        stripMetadata: true,
        similarityThreshold: 6,
      });
    } else {
      setCompression((prev) => ({ ...prev, preset: 'custom' }));
    }
  };

  const navTabs: Array<{ id: StudioTab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'upload', label: '1. رفع الفيديو والانتظار', icon: <Upload className="w-4 h-4" />, count: videoQueue.length },
    { id: 'ai_segment', label: '2. الفصل الذكي AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'manual_mask', label: '3. التحديد اليدوي', icon: <Brush className="w-4 h-4" /> },
    { id: 'chroma', label: '4. إزالة الخلفية الخضراء', icon: <Pipette className="w-4 h-4" /> },
    { id: 'crop_elements', label: '5. قص واستخراج العناصر', icon: <Scissors className="w-4 h-4" />, count: elements.length },
    { id: 'compression', label: '6. الضغط الاحترافي', icon: <Sliders className="w-4 h-4" /> },
    { id: 'export_svga', label: '7. تصدير ومعاينة SVGA', icon: <Download className="w-4 h-4" />, count: exportResults.length },
    { id: 'history', label: '8. سجل العمليات', icon: <History className="w-4 h-4" />, count: savedProjects.length },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none" dir="rtl">
      {/* Hidden Master Video Element */}
      <video
        ref={videoRef}
        src={activeQueueItem?.url || undefined}
        muted={isMuted}
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={handleVideoLoadedMetadata}
        onTimeUpdate={() => {
          if (videoRef.current && !isPlaying) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi"
        multiple
        onChange={(e) => {
          if (e.target.files) {
            handleFilesSelected(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Top Studio Header Bar */}
      <div className="bg-[#0b1120] border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للرئيسية</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              Smart MP4 Studio — AI + SVGA 2.0
            </h1>
            <p className="text-xs text-slate-400">
              فصل الشخصيات والعناصر تلقائيًا ويدويًا · إزالة الخلفية الخضراء · تصدير وضغط SVGA 2.0
            </p>
          </div>
        </div>

        {/* Quick Studio Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>رفع فيديو MP4</span>
          </button>

          <button
            onClick={handleRunSmartAiSegmentation}
            disabled={!activeQueueItem || taskState.active}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>تحليل ذكي وفصل العناصر</span>
          </button>

          <button
            onClick={handleExportAllElementsBatchSvga}
            disabled={elements.filter((e) => e.visible).length === 0 || taskState.active}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير SVGA ({elements.filter((e) => e.visible).length})</span>
          </button>
        </div>
      </div>

      {/* Active Task / Progress Banner */}
      {(taskState.active || taskState.error) && (
        <div
          className={`px-4 py-2.5 border-b flex items-center justify-between gap-4 text-xs ${
            taskState.error
              ? 'bg-red-950/60 border-red-800/60 text-red-200'
              : 'bg-indigo-950/60 border-indigo-800/60 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-1">
            {taskState.error ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            )}
            <span className="font-bold">{taskState.error || taskState.phase}</span>
          </div>
          {taskState.active && (
            <div className="flex items-center gap-3 w-48 sm:w-64">
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-150"
                  style={{ width: `${taskState.percent}%` }}
                />
              </div>
              <span className="font-mono tabular-nums font-bold">{taskState.percent}%</span>
            </div>
          )}
          {taskState.error && (
            <button
              onClick={() => setTaskState({ active: false, phase: '', percent: 0, error: null })}
              className="px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-bold cursor-pointer"
            >
              إغلاق
            </button>
          )}
        </div>
      )}

      {/* Navigation Tabs Strip (Responsive for Mobile & Desktop) */}
      <div className="bg-[#090e1a] border-b border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="font-mono tabular-nums text-[11px] opacity-85">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Studio Split Layout: Viewport & Timeline (Center/Left) + Active Tool Panel (Right) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 max-w-[1600px] w-full mx-auto">
        {/* Main Video Stage + Timeline (7 columns on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Viewport Toolbar */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
            {/* Display Mode Switcher */}
            <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-slate-800/80 flex-wrap">
              {[
                { id: 'processed', label: 'بدون خلفية' },
                { id: 'original', label: 'الأصلي' },
                { id: 'isolated', label: 'العنصر المعزول' },
                { id: 'mask_overlay', label: 'القناع' },
                { id: 'split_compare', label: 'مقارنة قبل/بعد' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id as ViewportDisplayMode)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === m.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Zoom & Bounds Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowBoundingBoxes((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  showBoundingBoxes
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                حدود العناصر
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono tabular-nums text-slate-300 px-1.5">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(250, z + 25))}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setZoom(100);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                title="إعادة ضبط العرض"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Canvas Stage */}
          <div
            className="relative min-h-[340px] sm:min-h-[420px] rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center"
            style={
              chroma.bgPreviewMode === 'checker'
                ? {
                    backgroundImage:
                      'linear-gradient(45deg, #161f33 25%, transparent 25%), linear-gradient(-45deg, #161f33 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #161f33 75%), linear-gradient(-45deg, transparent 75%, #161f33 75%)',
                    backgroundSize: '24px 24px',
                    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                    backgroundColor: '#0b1120',
                  }
                : chroma.bgPreviewMode === 'dark'
                ? { backgroundColor: '#0b1120' }
                : chroma.bgPreviewMode === 'black'
                ? { backgroundColor: '#000000' }
                : chroma.bgPreviewMode === 'white'
                ? { backgroundColor: '#ffffff' }
                : { backgroundColor: chroma.customBgColor }
            }
          >
            {!activeQueueItem ? (
              <div className="p-8 text-center max-w-md flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-sky-400">
                  <FileVideo className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    ارفع فيديو MP4 أو جرب فيديو الاختبار الفوري
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    يدعم الاستوديو فصل عدة شخصيات أو هدايا داخل الفيديو بالذكاء الاصطناعي ويدويًا، مع إزالة الخلفية الخضراء وتصدير كل عنصر لملف SVGA 2.0 مستقل.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>اختيار فيديو MP4 من جهازك</span>
                  </button>
                  <button
                    onClick={() => handleGenerateTestVideo('multi_row')}
                    disabled={isGeneratingDemo}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>توليد فيديو اختبار (6 شخصيات بخلفية خضراء)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="relative flex items-center justify-center p-2 transition-transform duration-100"
                style={{
                  transform: `scale(${zoom / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                }}
              >
                <canvas
                  ref={displayCanvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className={`max-w-full max-h-[420px] object-contain rounded-lg shadow-2xl ${
                    manualTool === 'eyedropper'
                      ? 'cursor-crosshair'
                      : manualTool !== 'pointer'
                      ? 'cursor-cell'
                      : 'cursor-pointer'
                  }`}
                />
              </div>
            )}

            {/* Split Compare Slider Overlay */}
            {activeQueueItem && viewMode === 'split_compare' && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 px-4 py-1.5 rounded-xl flex items-center gap-3 text-xs">
                <span className="text-slate-300 font-bold">مؤشر المقارنة:</span>
                <input
                  type="range"
                  min={5}
                  max={95}
                  value={splitPercent}
                  onChange={(e) => setSplitPercent(Number(e.target.value))}
                  className="w-32 accent-sky-400 cursor-pointer"
                />
                <span className="font-mono tabular-nums text-sky-400">{splitPercent}%</span>
              </div>
            )}
          </div>

          {/* Frame-Accurate Timeline & Playback Controls */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  disabled={!activeQueueItem}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}</span>
                </button>
                <button
                  onClick={() => stepFrame(-1)}
                  disabled={!activeQueueItem}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 cursor-pointer"
                  title="الإطار السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => stepFrame(1)}
                  disabled={!activeQueueItem}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-800 cursor-pointer"
                  title="الإطار التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Audio Volume Control */}
                <button
                  onClick={() => setIsMuted((m) => !m)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setVolume(val);
                    setIsMuted(val === 0);
                    if (videoRef.current) videoRef.current.volume = val;
                  }}
                  className="w-16 accent-indigo-500 cursor-pointer"
                />
              </div>

              {/* Video Telemetry Specs (Unboxed clean metadata with separators & tabular-nums) */}
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                <span>
                  الإطار: <strong className="text-white">{currentFrameIndex + 1}</strong>/{totalTrimmedFrames}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  الزمن: <strong className="text-white">{currentTime.toFixed(2)}s</strong>/{duration.toFixed(2)}s
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {videoWidth}×{videoHeight}px
                </span>
                <span aria-hidden="true">·</span>
                <span>{sourceFps} FPS</span>
              </div>
            </div>

            {/* Scrubber Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={trimStart}
                max={Math.max(trimStart + 0.1, trimEnd || duration || 1)}
                step={0.02}
                value={currentTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                disabled={!activeQueueItem}
                className="w-full accent-indigo-500 cursor-pointer"
              />

              {/* Start & End Trim Inputs */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span>بداية المقطع (ثانية):</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, (trimEnd || duration) - 0.1)}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                    className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono tabular-nums"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>نهاية المقطع (ثانية):</span>
                  <input
                    type="number"
                    min={trimStart + 0.1}
                    max={duration || 60}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Math.min(duration || 60, Number(e.target.value)))}
                    className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono tabular-nums"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>معدل الإطارات (FPS):</span>
                  <select
                    value={sourceFps}
                    onChange={(e) => setSourceFps(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono tabular-nums"
                  >
                    {[15, 20, 24, 30, 60].map((f) => (
                      <option key={f} value={f}>
                        {f} FPS
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Studio Control Panel (5 columns on desktop) */}
        <div className="lg:col-span-5 bg-[#0b1120] border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 max-h-[820px] overflow-y-auto">
          {/* TAB 1: UPLOAD & QUEUE */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">1. رفع ملفات الفيديو وقائمة الانتظار</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  يدعم الرفع المجزأ للملفات الكبيرة دون تعديل الملف الأصلي، مع إمكانية اختبار النظام فوراً.
                </p>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files) {
                    handleFilesSelected(Array.from(e.dataTransfer.files));
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[#070b14]/60 space-y-2"
              >
                <Upload className="w-8 h-8 text-indigo-400 mx-auto" />
                <div className="text-xs font-bold text-white">
                  اسحب وأفلت ملفات فيديو MP4 هنا أو اضغط للاختيار
                </div>
                <div className="text-[11px] text-slate-400">
                  يدعم رفع ملف واحد أو عدة فيديوهات في قائمة انتظار مع الحفظ التلقائي للاستئناف
                </div>
              </div>

              {/* Built-in Test Scenarios */}
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-slate-200">
                  مختبر الفيديوهات التجريبية الفوري (لاختبار الفصل والـ Chroma والـ SVGA):
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleGenerateTestVideo('multi_row')}
                    disabled={isGeneratingDemo}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/50 text-emerald-200 text-xs font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>1. فيديو 6 شخصيات كرتونية في صفين (خلفية خضراء)</span>
                    <Sparkles className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    onClick={() => handleGenerateTestVideo('single_hero')}
                    disabled={isGeneratingDemo}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-700/50 text-indigo-200 text-xs font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>2. فيديو شخصية واحدة بتفاصيل دقيقة وتاج ذهبي</span>
                    <Play className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    onClick={() => handleGenerateTestVideo('overlapping')}
                    disabled={isGeneratingDemo}
                    className="w-full py-2 px-3 rounded-xl bg-amber-950/60 hover:bg-amber-900/70 border border-amber-700/50 text-amber-200 text-xs font-bold flex items-center justify-between cursor-pointer"
                  >
                    <span>3. فيديو عنصرين متداخلين (لاختبار تحذير التداخل والتصحيح اليدوي)</span>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Queue List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300">
                  قائمة انتظار الفيديوهات ({videoQueue.length}):
                </div>
                {videoQueue.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center border border-slate-800/80 rounded-xl">
                    لا توجد ملفات في قائمة الانتظار حالياً
                  </div>
                ) : (
                  videoQueue.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setActiveQueueId(item.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        item.id === activeQueueId
                          ? 'bg-indigo-950/40 border-indigo-500/60'
                          : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB · {item.width}×{item.height} ·{' '}
                          {item.duration.toFixed(1)}s
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                          {item.status === 'ingesting' ? `${item.ingestProgress}%` : 'جاهز'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVideoQueue((prev) => prev.filter((q) => q.id !== item.id));
                            if (activeQueueId === item.id) {
                              setActiveQueueId(null);
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-950/60 text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI SMART ELEMENT SEPARATION */}
          {activeTab === 'ai_segment' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  2. الفصل الذكي للعناصر باستخدام AI والتتبع البصري
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  يكتشف الشخصيات والكرتون والهدايا المستقلة ويتتبع كل عنصر عبر الإطارات دون تبديل هويته.
                </p>
              </div>

              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 space-y-3">
                <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                  <span>فصل الصفوف المتعددة والشخصيات المتجاورة تلقائياً</span>
                  <input
                    type="checkbox"
                    checked={splitMultiRows}
                    onChange={(e) => setSplitMultiRows(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
                  <span>دمج نموذج AI لتقسيم الأشخاص (عند عدم وجود خلفية خضراء)</span>
                  <input
                    type="checkbox"
                    checked={useAiPersonModel}
                    onChange={(e) => setUseAiPersonModel(e.target.checked)}
                    className="accent-indigo-500 w-4 h-4"
                  />
                </label>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">الحد الأدنى لمساحة العنصر المكتشف:</span>
                    <span className="font-mono tabular-nums text-indigo-400">{minAreaPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={5}
                    step={0.05}
                    value={minAreaPercent}
                    onChange={(e) => setMinAreaPercent(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <button
                onClick={handleRunSmartAiSegmentation}
                disabled={!activeQueueItem || taskState.active}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>بدء التحليل الذكي وفصل العناصر الآن</span>
              </button>

              {/* Overlap Warning Box if any element has overlapWarning */}
              {elements.some((e) => e.overlapWarning) && (
                <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>تنبيه تداخل بصري بين بعض العناصر المتحركة</span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    رصد النظام تقارباً أو تداخلاً بين عنصرين أثناء الحركة. يمكنك فتح محرر التحديد اليدوي لتصحيح القناع بدقة بدلاً من الاعتماد على الفصل الآلي وحده.
                  </p>
                  <button
                    onClick={() => setActiveTab('manual_mask')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                  >
                    فتح التحديد اليدوي للتصحيح
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL MASK STUDIO */}
          {activeTab === 'manual_mask' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">3. محرر التحديد اليدوي والأقنعة</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ارسم مباشرة فوق الفيديو لإضافة أو إزالة مناطق من قناع العنصر المحدد.
                  </p>
                </div>
                <button
                  onClick={handleAddEmptyManualLayer}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>طبقة يدوية جديدة</span>
                </button>
              </div>

              {/* Active Element Selector */}
              {elements.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-bold">العنصر قيد التعديل اليدوي:</label>
                  <select
                    value={selectedElement?.id || ''}
                    onChange={(e) => setSelectedElementId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070b14] border border-slate-800 text-xs text-white font-bold"
                  >
                    {elements.map((el) => (
                      <option key={el.id} value={el.id}>
                        #{el.index} - {el.name} ({el.motionBounds.width}×{el.motionBounds.height}px)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selection Tools Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'magic_wand', label: 'تحديد بالنقر', icon: <MousePointerClick className="w-4 h-4" /> },
                  { id: 'rect', label: 'تحديد مستطيل', icon: <Square className="w-4 h-4" /> },
                  { id: 'ellipse', label: 'تحديد دائري', icon: <Circle className="w-4 h-4" /> },
                  { id: 'lasso', label: 'قلم حر / لاسو', icon: <Lasso className="w-4 h-4" /> },
                  { id: 'brush_add', label: 'فرشاة تحديد', icon: <Brush className="w-4 h-4" /> },
                  { id: 'eraser', label: 'ممحاة إزالة', icon: <Eraser className="w-4 h-4" /> },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setManualTool(t.id as ManualToolType)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      manualTool === t.id
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Add / Subtract Mode & Brush Size */}
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMaskCombineMode('add')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      maskCombineMode === 'add'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    + إضافة إلى القناع
                  </button>
                  <button
                    onClick={() => setMaskCombineMode('subtract')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      maskCombineMode === 'subtract'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    - طرح من القناع
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">حجم الفرشاة / الممحاة:</span>
                    <span className="font-mono tabular-nums text-indigo-400">{brushSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={80}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Mask Operations: Invert, Save, Restore, Propagate, Duplicate, Delete */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleInvertSelectedMask}
                  disabled={!selectedElement}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  عكس التحديد
                </button>
                <button
                  onClick={handlePropagateMaskToFollowingFrames}
                  disabled={!selectedElement}
                  className="py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/50 text-xs font-bold text-emerald-300 cursor-pointer"
                >
                  نسخ القناع للإطارات التالية
                </button>
                <button
                  onClick={handleSaveMaskSnapshot}
                  disabled={!selectedElement}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  حفظ التحديد للرجوع إليه
                </button>
                <button
                  onClick={handleRestoreMaskSnapshot}
                  disabled={!selectedElement?.savedMaskSnapshot}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  استعادة التحديد المحفوظ
                </button>
                <button
                  onClick={handleDuplicateSelectedElement}
                  disabled={!selectedElement}
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>تكرار الطبقة</span>
                </button>
                <button
                  onClick={() => selectedElement && handleDeleteElement(selectedElement.id)}
                  disabled={!selectedElement}
                  className="py-2 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-800/50 text-xs font-bold text-red-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الطبقة</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CHROMA KEY & GREEN SPILL SUPPRESSION */}
          {activeTab === 'chroma' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">4. إزالة الخلفية الخضراء الاحترافية (Chroma Key)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    معالجة لونية متقدمة مع إزالة الانعكاس الأخضر (Spill Suppression) وتثبيت الإطارات.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={chroma.enabled}
                  onChange={(e) => setChroma((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Auto vs Manual Mode */}
              <div className="flex items-center gap-2 bg-[#070b14] p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      const c = document.createElement('canvas');
                      c.width = videoWidth;
                      c.height = videoHeight;
                      const cx = c.getContext('2d');
                      if (cx) {
                        cx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
                        const auto = autoDetectBackgroundColor(cx.getImageData(0, 0, videoWidth, videoHeight));
                        setChroma((prev) => ({
                          ...prev,
                          mode: 'auto',
                          keyColor: auto.hex,
                          keyRgb: auto.rgb,
                          tolerance: auto.recommendedTolerance,
                        }));
                      }
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    chroma.mode === 'auto' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  الوضع التلقائي الذكي
                </button>
                <button
                  onClick={() => setChroma((prev) => ({ ...prev, mode: 'manual' }))}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    chroma.mode === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  التحكم اليدوي الدقيق
                </button>
              </div>

              {/* Key Color Picker & Eyedropper */}
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={chroma.keyColor}
                    onChange={(e) =>
                      setChroma((prev) => ({
                        ...prev,
                        mode: 'manual',
                        keyColor: e.target.value,
                        keyRgb: hexToRgb(e.target.value),
                      }))
                    }
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">لون الخلفية المستهدف</div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-400">
                      {chroma.keyColor.toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setManualTool(manualTool === 'eyedropper' ? 'pointer' : 'eyedropper')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                    manualTool === 'eyedropper'
                      ? 'bg-amber-600 border-amber-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Pipette className="w-4 h-4" />
                  <span>{manualTool === 'eyedropper' ? 'انقر على الفيديو...' : 'أداة القطارة'}</span>
                </button>
              </div>

              {/* Chroma Sliders */}
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 space-y-3">
                {[
                  {
                    label: 'نطاق اللون والتسامح اللوني (Tolerance)',
                    val: chroma.tolerance,
                    min: 1,
                    max: 90,
                    onChange: (v: number) => setChroma((p) => ({ ...p, mode: 'manual', tolerance: v })),
                  },
                  {
                    label: 'التشابه والانتشار (Smoothness / Spread)',
                    val: chroma.smoothness,
                    min: 1,
                    max: 50,
                    onChange: (v: number) => setChroma((p) => ({ ...p, mode: 'manual', smoothness: v })),
                  },
                  {
                    label: 'إزالة التلوث والانعكاس الأخضر (Green Spill Suppression)',
                    val: chroma.spillSuppression,
                    min: 0,
                    max: 100,
                    onChange: (v: number) => setChroma((p) => ({ ...p, spillSuppression: v })),
                  },
                  {
                    label: 'إزالة الظلال الخضراء غير المرغوبة',
                    val: chroma.shadowRemoval,
                    min: 0,
                    max: 100,
                    onChange: (v: number) => setChroma((p) => ({ ...p, shadowRemoval: v })),
                  },
                  {
                    label: 'تنعيم الحواف (Edge Feather)',
                    val: chroma.edgeFeather,
                    min: 0,
                    max: 10,
                    onChange: (v: number) => setChroma((p) => ({ ...p, edgeFeather: v })),
                  },
                  {
                    label: 'تقليص الهالات الخارجية (Edge Choke)',
                    val: chroma.edgeChoke,
                    min: -4,
                    max: 4,
                    onChange: (v: number) => setChroma((p) => ({ ...p, edgeChoke: v })),
                  },
                  {
                    label: 'ضبط شفافية الحواف والشعر الدقيق',
                    val: chroma.edgeOpacity,
                    min: 20,
                    max: 100,
                    onChange: (v: number) => setChroma((p) => ({ ...p, edgeOpacity: v })),
                  },
                  {
                    label: 'تثبيت اللون بين الإطارات (منع الوميض)',
                    val: chroma.temporalStabilization,
                    min: 0,
                    max: 80,
                    onChange: (v: number) => setChroma((p) => ({ ...p, temporalStabilization: v })),
                  },
                ].map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{s.label}</span>
                      <span className="font-mono tabular-nums text-emerald-400">{s.val}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={s.val}
                      onChange={(e) => s.onChange(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              {/* Background Preview Selector */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-300">خلفية المعاينة:</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'checker', label: 'شفاف' },
                    { id: 'dark', label: 'داكن' },
                    { id: 'black', label: 'أسود' },
                    { id: 'white', label: 'أبيض' },
                    { id: 'custom', label: 'مخصص' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setChroma((p) => ({ ...p, bgPreviewMode: bg.id as any }))}
                      className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        chroma.bgPreviewMode === bg.id
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-[#070b14] border-slate-800 text-slate-400'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ELEMENT CROPPING & EXTRACTION PANEL */}
          {activeTab === 'crop_elements' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    5. لوحة قص واستخراج العناصر المكتشفة ({elements.length})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحكم في اسم وحدود قص كل عنصر أو صدّره منفرداً أو دفعة واحدة.
                  </p>
                </div>
                {elements.length > 0 && (
                  <button
                    onClick={handleExportAllElementsBatchSvga}
                    disabled={taskState.active}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>تصدير الكل دفعة واحدة</span>
                  </button>
                )}
              </div>

              {elements.length === 0 ? (
                <div className="p-6 text-center bg-[#070b14] border border-slate-800 rounded-xl space-y-3">
                  <Layers className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-xs text-slate-400">
                    لم يتم تحليل العناصر بعد. اضغط على زر التحليل الذكي لاكتشاف الشخصيات والعناصر داخل الفيديو.
                  </div>
                  <button
                    onClick={handleRunSmartAiSegmentation}
                    disabled={!activeQueueItem || taskState.active}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    تشغيل التحليل الذكي الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {elements.map((el) => {
                    const isSelected = el.id === selectedElement?.id;
                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer space-y-2.5 ${
                          isSelected
                            ? 'bg-indigo-950/35 border-indigo-500/70'
                            : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Element Isolated Thumbnail */}
                          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                            {el.thumbnailDataUrl ? (
                              <img
                                src={el.thumbnailDataUrl}
                                alt={el.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Layers className="w-5 h-5 text-slate-500" />
                            )}
                          </div>

                          {/* Editable Name & Telemetry */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <input
                              type="text"
                              value={el.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setElements((prev) =>
                                  prev.map((item) => (item.id === el.id ? { ...item, name: val } : item))
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-white"
                            />
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums flex flex-wrap items-center gap-1.5">
                              <span>{el.categoryLabelAr}</span>
                              <span>·</span>
                              <span>
                                {el.motionBounds.width}×{el.motionBounds.height}px
                              </span>
                              <span>·</span>
                              <span>{el.frameCount} إطار</span>
                              <span>·</span>
                              <span>{el.durationSec}s</span>
                              <span>·</span>
                              <span className="text-emerald-400">~{el.estimatedSizeKb} KB</span>
                            </div>
                          </div>

                          {/* Visibility & Export Single Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, visible: !item.visible } : item
                                  )
                                );
                              }}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                              title={el.visible ? 'إخفاء العنصر' : 'إظهار العنصر'}
                            >
                              {el.visible ? (
                                <Eye className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-slate-500" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportSingleElementSvga(el);
                              }}
                              disabled={taskState.active}
                              className="px-2.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                              title="تصدير هذا العنصر منفرداً إلى SVGA 2.0"
                            >
                              تصدير SVGA
                            </button>
                          </div>
                        </div>

                        {/* Per-Element Crop Mode & Margin Controls (Shown when element is selected) */}
                        {isSelected && (
                          <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400 block mb-1">نظام القص والإحداثيات:</span>
                              <select
                                value={el.cropMode}
                                onChange={(e) => {
                                  const mode = e.target.value as 'tight' | 'scene';
                                  setElements((prev) =>
                                    prev.map((item) =>
                                      item.id === el.id ? { ...item, cropMode: mode } : item
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                              >
                                <option value="tight">قص محكم لتقليل الحجم (Tight Crop)</option>
                                <option value="scene">حفظ أبعاد وإحداثيات المشهد الأصلي</option>
                              </select>
                            </div>

                            <div>
                              <div className="flex justify-between text-slate-400 mb-1">
                                <span>هامش الأمان حول العنصر:</span>
                                <span className="font-mono tabular-nums text-indigo-400">
                                  {el.customPadding} px
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={48}
                                value={el.customPadding}
                                onChange={(e) => {
                                  const pad = Number(e.target.value);
                                  setElements((prev) =>
                                    prev.map((item) =>
                                      item.id === el.id ? { ...item, customPadding: pad } : item
                                    )
                                  );
                                }}
                                className="w-full accent-indigo-500 cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SMART COMPRESSION */}
          {activeTab === 'compression' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">6. نظام الضغط الاحترافي (Smart Compression)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  تقليل حجم ملفات SVGA 2.0 مع الحفاظ التام على قناة الشفافية Alpha والحركة.
                </p>
              </div>

              {/* Presets */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'light', title: 'ضغط خفيف', desc: 'أعلى جودة (95%)' },
                  { id: 'balanced', title: 'ضغط متوازن', desc: 'جودة ممتازة وحجم مثالي' },
                  { id: 'strong', title: 'ضغط قوي', desc: 'أقصى توفير في الحجم' },
                  { id: 'custom', title: 'وضع مخصص', desc: 'تحكم يدوي كامل' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyCompressionPreset(p.id as any)}
                    className={`p-3 rounded-xl border text-right transition-colors cursor-pointer ${
                      compression.preset === p.id
                        ? 'bg-indigo-600/25 border-indigo-500 text-white'
                        : 'bg-[#070b14] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{p.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>

              {/* Detailed Compression Controls */}
              <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">جودة الصور والأصول الشفافة:</span>
                    <span className="font-mono tabular-nums text-indigo-400">
                      {compression.imageQuality}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    value={compression.imageQuality}
                    onChange={(e) =>
                      setCompression((p) => ({
                        ...p,
                        preset: 'custom',
                        imageQuality: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">تكميم ألوان PNG الشفافة (UPNG Alpha):</span>
                    <span className="font-mono tabular-nums text-indigo-400">
                      {compression.pngColors === 0 ? 'بدون ضغط لوني (Lossless)' : `${compression.pngColors} لون`}
                    </span>
                  </div>
                  <select
                    value={compression.pngColors}
                    onChange={(e) =>
                      setCompression((p) => ({
                        ...p,
                        preset: 'custom',
                        pngColors: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value={0}>بدون ضغط لوني (Full RGBA 32-bit)</option>
                    <option value={256}>256 لون مع شفافية كاملة (موصى به)</option>
                    <option value={128}>128 لون (توفير عالي)</option>
                    <option value={64}>64 لون (أقصى ضغط)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-300 block mb-1">معدل إطارات التصدير:</label>
                    <select
                      value={compression.targetFps}
                      onChange={(e) =>
                        setCompression((p) => ({
                          ...p,
                          preset: 'custom',
                          targetFps: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono tabular-nums"
                    >
                      {[12, 15, 20, 24, 30, 60].map((fps) => (
                        <option key={fps} value={fps}>
                          {fps} FPS
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 block mb-1">مقياس الأبعاد:</label>
                    <select
                      value={compression.dimensionScale}
                      onChange={(e) =>
                        setCompression((p) => ({
                          ...p,
                          preset: 'custom',
                          dimensionScale: Number(e.target.value),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono tabular-nums"
                    >
                      <option value={1.0}>100% (الأصلي)</option>
                      <option value={0.75}>75% (متوسط)</option>
                      <option value={0.5}>50% (نصف الحجم)</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center justify-between text-xs text-slate-200 pt-1 cursor-pointer">
                  <span>دمج الإطارات المتطابقة دون حذف التوقيت (Frame Deduplication)</span>
                  <input
                    type="checkbox"
                    checked={compression.deduplicateFrames}
                    onChange={(e) =>
                      setCompression((p) => ({ ...p, deduplicateFrames: e.target.checked }))
                    }
                    className="accent-indigo-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 7: SVGA 2.0 EXPORT & LIVE VERIFICATION */}
          {activeTab === 'export_svga' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  7. التصدير الفعلي إلى SVGA 2.0 والمعاينة المباشرة
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ملفات SVGA 2.0 حقيقية متوافقة مع SVGAPlayer مع فحص البنية وتقرير التوفير.
                </p>
              </div>

              {/* Batch ZIP Download Banner */}
              {batchZipInfo && (
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-700/60 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      حزمة ZIP الجماعية جاهزة للتنزيل ({exportResults.length} ملفات SVGA + تقرير JSON)
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-emerald-200/80 mt-0.5">
                      الحجم الإجمالي: {(batchZipInfo.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <a
                    href={batchZipInfo.zipUrl}
                    download={batchZipInfo.zipFileName}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>تنزيل ZIP</span>
                  </a>
                </div>
              )}

              {/* Live SVGA 2.0 Player Preview Box */}
              {previewSvgaResult && (
                <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      معاينة حية بمشغل SVGA 2.0: {previewSvgaResult.elementName}
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>تم التحقق (SVGA {previewSvgaResult.verification.version})</span>
                    </span>
                  </div>

                  <div className="h-48 rounded-xl bg-[#0b1120] border border-slate-800 overflow-hidden flex items-center justify-center">
                    <SvgaPlayer
                      src={previewSvgaResult.url}
                      autoPlay={true}
                      loop={true}
                      backdrop="checker"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                    <span>
                      الأبعاد: {previewSvgaResult.verification.viewBoxWidth}×
                      {previewSvgaResult.verification.viewBoxHeight}
                    </span>
                    <span>·</span>
                    <span>الإطارات: {previewSvgaResult.verification.frames}</span>
                    <span>·</span>
                    <span>
                      قبل الضغط: {(previewSvgaResult.originalRawBytes / 1024).toFixed(1)} KB
                    </span>
                    <span>·</span>
                    <span className="text-emerald-400 font-bold">
                      بعد الضغط: {(previewSvgaResult.compressedBytes / 1024).toFixed(1)} KB (توفير{' '}
                      {previewSvgaResult.savingsPercent}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Exported Files List */}
              {exportResults.length === 0 ? (
                <div className="p-6 text-center bg-[#070b14] border border-slate-800 rounded-xl space-y-3">
                  <Download className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-xs text-slate-400">
                    لم يتم تصدير عناصر بعد. يمكنك تصدير أي عنصر منفرداً أو تصدير جميع العناصر دفعة واحدة.
                  </div>
                  <button
                    onClick={handleExportAllElementsBatchSvga}
                    disabled={elements.length === 0 || taskState.active}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                  >
                    تصدير جميع العناصر المكتشفة إلى SVGA 2.0
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {exportResults.map((res) => (
                    <div
                      key={res.elementId}
                      className="p-3 rounded-xl bg-[#070b14] border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{res.fileName}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {(res.compressedBytes / 1024).toFixed(1)} KB · توفير {res.savingsPercent}% ·{' '}
                          {res.verification.frames} إطار
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setPreviewSvgaResult(res)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          معاينة
                        </button>
                        <a
                          href={res.url}
                          download={res.fileName}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تنزيل</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: HISTORY & SAVED PROJECTS */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">8. سجل العمليات والمشاريع المحفوظة</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  يتم حفظ حالة المهام والفيديوهات تلقائياً لاستئناف العمل في أي وقت دون فقدان المشروع.
                </p>
              </div>

              {savedProjects.length === 0 ? (
                <div className="p-6 text-center bg-[#070b14] border border-slate-800 rounded-xl text-xs text-slate-500">
                  لا توجد مشاريع محفوظة في السجل حتى الآن
                </div>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map((item) => (
                    <div
                      key={item.record.id}
                      className="p-3 rounded-xl bg-[#070b14] border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {item.record.fileName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                          {item.record.elementsCount} عنصر مكتشف · {item.record.width}×{item.record.height} ·{' '}
                          {new Date(item.record.updatedAt).toLocaleTimeString('ar-EG')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleResumeSavedProject(item)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                        >
                          استئناف المشروع
                        </button>
                        <button
                          onClick={async () => {
                            await deleteSmartMp4Project(item.record.id);
                            await refreshHistory();
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-950/60 text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartMp4Studio;
