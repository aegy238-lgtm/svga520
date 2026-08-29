import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  EditableLayer, SVGAProjectData, CanvasTool, LayerKeyframe 
} from './types';
import { parseSvgaToProject, createNewSvgaProject } from './svgaParserEngine';
import { exportEditedSvga } from './svgaExportEngine';
import { mergeSvgaFileIntoProject, transformLayerGroup } from './svgaMergeEngine';
import { 
  transformSelectedLayers, 
  reorderSelectedLayers, 
  moveSelectedLayersToTarget, 
  duplicateSelectedLayers, 
  deleteSelectedLayers 
} from './svgaMultiSelectEngine';
import { fileToImageBuffer, createImageLayer, createShapeLayer } from './layerFactory';
import { SvgaDesignCanvas } from './SvgaDesignCanvas';
import { SvgaLayersList } from './SvgaLayersList';
import { SvgaPropertiesPanel } from './SvgaPropertiesPanel';
import { SvgaMotionTimeline } from './SvgaMotionTimeline';
import { 
  Upload, Layers, Download, ArrowLeft, RotateCcw, 
  Sparkles, MousePointer, Hand, ZoomIn, Grid, Compass, 
  FileCode, Check, AlertCircle, RefreshCw, X, Shield, Eye,
  Sliders, Play, Film, CheckCircle2, Music, Plus, FilePlus, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SvgaLayerEditorProps {
  initialFile?: File;
  onClose: () => void;
  onOpenViewer?: (file: File) => void;
}

export const SvgaLayerEditor: React.FC<SvgaLayerEditorProps> = ({
  initialFile,
  onClose,
  onOpenViewer
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergeFileInputRef = useRef<HTMLInputElement>(null);

  // Project Data & Layers
  const [project, setProject] = useState<SVGAProjectData | null>(null);
  const [layers, setLayers] = useState<EditableLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<EditableLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Canvas Viewport State
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [zoom, setZoom] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>('transparent');

  // Animation & Timeline State
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(true);

  // Status & Export State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [newProjectConfig, setNewProjectConfig] = useState({
    name: 'مشروع SVGA جديد',
    width: 750,
    height: 1334,
    fps: 30,
    durationSec: 2
  });
  const [exportFileName, setExportFileName] = useState<string>('');
  const [lastExportedBlob, setLastExportedBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Push State to History
  const pushHistory = useCallback((newLayers: EditableLayer[]) => {
    setHistory(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, JSON.parse(JSON.stringify(newLayers))];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Load File
  const loadSvgaFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { project: parsedProject, layers: parsedLayers } = await parseSvgaToProject(file);
      setProject(parsedProject);
      setLayers(parsedLayers);
      setSelectedLayerId(parsedLayers[0]?.id || null);
      setCurrentFrame(0);
      setIsPlaying(false);
      setExportFileName(file.name.replace(/\.svga$/i, '') + '_edited.svga');
      
      // Auto-fit zoom based on screen size
      const maxW = window.innerWidth - 700;
      const maxH = window.innerHeight - 200;
      const scaleW = maxW / (parsedProject.width || 1);
      const scaleH = maxH / (parsedProject.height || 1);
      const fitZoom = Math.min(100, Math.max(25, Math.floor(Math.min(scaleW, scaleH) * 100)));
      setZoom(fitZoom);
      setPanOffset({ x: 0, y: 0 });

      // Init history
      setHistory([JSON.parse(JSON.stringify(parsedLayers))]);
      setHistoryIndex(0);

      setSuccessToast(`تم فتح الملف بنجاح (${parsedLayers.length} طبقة)`);
    } catch (err: any) {
      console.error("Failed to parse SVGA file:", err);
      setErrorMessage(err.message || 'حدث خطأ أثناء قراءة ملف SVGA.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle Initial File
  useEffect(() => {
    if (initialFile) {
      loadSvgaFile(initialFile);
    }
  }, [initialFile, loadSvgaFile]);

  // Animation Frame Playback Loop
  useEffect(() => {
    if (!isPlaying || !project || project.totalFrames <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= project.totalFrames - 1) {
          if (isLoop) return 0;
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / (project.fps || 30));

    return () => clearInterval(interval);
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
    setLayers(prev => prev.map(l => {
      if (l.id === layerId) {
        return {
          ...l,
          transform: {
            ...l.transform,
            ...deltaTransform
          }
        };
      }
      return l;
    }));
  }, []);

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

  // Toggle specific layer selection
  const handleToggleLayerSelection = useCallback((layerId: string) => {
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
  }, [selectedLayerId]);

  // Select All, Range, or Subsets of Layers (e.g. Merged File or Base Layers)
  const handleSelectAllLayers = useCallback((allSelected: boolean, filterScope?: 'all' | 'bundles' | 'base' | string[]) => {
    if (!allSelected) {
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
      setSuccessToast('تم إلغاء التحديد الجماعي');
      return;
    }

    let targetIds: string[] = [];

    if (Array.isArray(filterScope)) {
      targetIds = filterScope;
    } else if (filterScope === 'bundles') {
      targetIds = layers
        .filter(l => Boolean(l.groupId || l.id.startsWith('mrg_') || l.imageKey.startsWith('mrg_') || (l.name && l.name.includes('(مدمج)'))))
        .map(l => l.id);
    } else if (filterScope === 'base') {
      targetIds = layers
        .filter(l => !l.groupId && !l.id.startsWith('mrg_') && !l.imageKey.startsWith('mrg_') && !(l.name && l.name.includes('(مدمج)')))
        .map(l => l.id);
    } else {
      // 'all' or undefined
      targetIds = layers.map(l => l.id);
    }

    if (targetIds.length > 0) {
      setSelectedLayerIds(targetIds);
      setSelectedLayerId(targetIds[0]);
      if (filterScope === 'bundles') {
        setSuccessToast(`تم تحديد جميع طبقات الملف المدمج (${targetIds.length} طبقة) للتحكم الجماعي`);
      } else if (filterScope === 'base') {
        setSuccessToast(`تم تحديد جميع طبقات الملف الأساسي (${targetIds.length} طبقة) للتحكم الجماعي`);
      } else {
        setSuccessToast(`تم تحديد كافة الطبقات (${targetIds.length} طبقة) للتحكم الجماعي`);
      }
    } else {
      setSelectedLayerIds([]);
      setSelectedLayerId(null);
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
      const updated = prev.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l);
      pushHistory(updated);
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
      setSuccessToast(targetState ? 'تم قفل جميع الطبقات' : 'تم فتح قفل جميع الطبقات');
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

      const target = prev.find(l => l.id === layerId);
      if (!target) return prev;

      const newId = `layer_${Date.now()}_copy`;
      const cloned: EditableLayer = JSON.parse(JSON.stringify(target));
      cloned.id = newId;
      cloned.name = `${target.name} (نسخة ${mirror ? 'معكوسة' : ''})`;
      
      if (mirror && project) {
        // Mirror horizontally across the canvas center
        cloned.transform.x = project.width - target.transform.x;
        cloned.transform.scaleX = -target.transform.scaleX;
        if (cloned.transform.rotation) {
          cloned.transform.rotation = -cloned.transform.rotation;
        }

        // Mirror all keyframes
        if (cloned.keyframes) {
          cloned.keyframes.forEach(kf => {
            if (kf.x !== undefined) kf.x = project.width - kf.x;
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

      const updated = [cloned, ...prev];
      setSelectedLayerId(newId);
      setSelectedLayerIds([newId]);
      pushHistory(updated);
      setSuccessToast(mirror ? `تم تكرار الطبقة وعكسها أفقياً` : `تم تكرار الطبقة: ${target.name}`);
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

  const handleResetTransform = useCallback(() => {
    if (!selectedLayerId) return;
    setLayers(prev => {
      const updated = prev.map(l => {
        if (l.id === selectedLayerId) {
          return {
            ...l,
            transform: {
              ...l.transform,
              x: l.initialBounds.x,
              y: l.initialBounds.y,
              width: l.initialBounds.width,
              height: l.initialBounds.height,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
              opacity: 100
            }
          };
        }
        return l;
      });
      pushHistory(updated);
      setSuccessToast('تمت استعادة الإحداثيات الأصلية للطبقة');
      return updated;
    });
  }, [selectedLayerId, pushHistory]);

  const handleReplaceAsset = useCallback((file: File) => {
    if (!selectedLayerId || !project) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const layer = layers.find(l => l.id === selectedLayerId);
      if (!layer) return;

      // Update in project imagesMap
      setProject(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          imagesMap: {
            ...prev.imagesMap,
            [layer.imageKey]: dataUrl
          }
        };
      });

      // Update layer thumbnail
      setLayers(prev => {
        const updated = prev.map(l => l.id === selectedLayerId ? { ...l, thumbnailUrl: dataUrl } : l);
        pushHistory(updated);
        return updated;
      });

      setSuccessToast(`تم استبدال أصل الصورة للطبقة: ${layer.name}`);
    };
    reader.readAsDataURL(file);
  }, [selectedLayerId, project, layers, pushHistory]);

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
      setSuccessToast(targetState ? 'تم قفل كامل حزمة SVGA' : 'تم فتح قفل كامل حزمة SVGA');
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

  // Undo / Redo Actions
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setLayers(JSON.parse(JSON.stringify(history[newIdx])));
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setLayers(JSON.parse(JSON.stringify(history[newIdx])));
    }
  }, [history, historyIndex]);

  // Perform SVGA Export and Download
  const handleExport = async () => {
    if (!project) return;
    setIsExporting(true);
    try {
      const { blob, fileName } = await exportEditedSvga(project, layers, exportFileName);
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
      const { blob, fileName } = await exportEditedSvga(project, layers, exportFileName);
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
      setProject(newProj);
      setLayers(newLayers);
      setSelectedLayerId(null);
      setCurrentFrame(0);
      setHistory([JSON.parse(JSON.stringify(newLayers))]);
      setHistoryIndex(0);
      setExportFileName(newProjectConfig.name || 'custom_svga_animation');
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
    <div className="fixed inset-0 z-50 bg-[#070b14] text-white flex flex-col font-sans overflow-hidden select-none" dir="ltr">
      <input
        type="file"
        ref={fileInputRef}
        accept=".svga"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadSvgaFile(f);
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
      <header className="h-14 bg-[#0a0f1d] border-b border-white/10 px-6 flex items-center justify-between shrink-0 z-30">
        {/* Left: Brand & Back */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> خروج
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-glow-indigo">
              <Layers size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-white">تحرير طبقات SVGA</span>
                <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Pro Layer Studio
                </span>
              </div>
              {project && (
                <p className="text-[10px] text-slate-400 font-mono">
                  {project.fileName} • {(project.fileSize / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Center: Canvas View Controls & Tools */}
        {project && (
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

            {/* Background Color Swatches */}
            <div className="flex items-center gap-1.5 pl-1">
              {bgSwatches.map(swatch => (
                <button
                  key={swatch.label}
                  onClick={() => setBgColor(swatch.value)}
                  className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                    bgColor === swatch.value ? 'scale-125 border-white ring-2 ring-indigo-500/50' : 'border-white/20 hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: swatch.isChecker ? '#1e293b' : swatch.value,
                    backgroundImage: swatch.isChecker ? 'radial-gradient(circle, #475569 20%, transparent 20%)' : 'none',
                    backgroundSize: '4px 4px'
                  }}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>
        )}

        {/* Right Actions: Undo, Redo, Open, Export */}
        <div className="flex items-center gap-2">
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

          {project && (
            <button
              onClick={() => mergeFileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-200 hover:text-white bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 px-3.5 py-1.5 rounded-xl border border-purple-500/40 transition-all cursor-pointer shadow-lg shadow-purple-900/20 hover:scale-105"
              title="استدعاء ملف SVGA آخر ودمجه فوق المشروع الحالي مع التحكم الجماعي الكامل في حركته ومقاساته"
            >
              <Sparkles size={13} className="text-purple-300" /> دمج SVGA +
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
      </header>

      {/* Main Workspace Body */}
      {project ? (
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Panel: Layers */}
          <aside className="w-[360px] 2xl:w-[400px] h-full shrink-0 border-r border-white/10 z-10 flex flex-col">
            <SvgaLayersList
              layers={layers}
              selectedLayerId={selectedLayerId}
              selectedLayerIds={selectedLayerIds}
              currentFrame={currentFrame}
              onSelectLayer={(id, isMulti) => handleSelectLayer(id, isMulti)}
              onToggleLayerSelection={handleToggleLayerSelection}
              onSelectAllLayers={handleSelectAllLayers}
              onToggleVisibility={handleToggleVisibility}
              onToggleAllVisibility={handleToggleAllVisibility}
              onToggleLock={handleToggleLock}
              onToggleAllLock={handleToggleAllLock}
              onReorderLayer={handleReorderLayer}
              onMoveLayer={handleMoveLayer}
              onDuplicateLayer={handleDuplicateLayer}
              onDeleteLayer={handleDeleteLayer}
              onRenameLayer={handleRenameLayer}
              onAddImageLayer={handleAddImageLayer}
              onAddShapeLayer={handleAddShapeLayer}
              onMergeSvga={() => mergeFileInputRef.current?.click()}
            />
          </aside>

          {/* Center Viewport: Interactive Canvas + Timeline */}
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#070b14]">
            <div className="flex-1 relative overflow-hidden">
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
              />
            </div>

            {/* Bottom Keyframe & Motion Timeline */}
            <SvgaMotionTimeline
              totalFrames={project.totalFrames}
              currentFrame={currentFrame}
              fps={project.fps}
              isPlaying={isPlaying}
              isLoop={isLoop}
              selectedLayer={selectedLayer}
              layers={layers}
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
            />
          </main>

          {/* Right Panel: Properties */}
          <aside className="w-[320px] h-full shrink-0">
            <SvgaPropertiesPanel
              project={project}
              layer={selectedLayer}
              selectedLayers={layers.filter(l => selectedLayerIds.includes(l.id))}
              selectedLayerIds={selectedLayerIds}
              currentFrame={currentFrame}
              onUpdateTransform={(t) => selectedLayerId && handleUpdateLayerTransform(selectedLayerId, t)}
              onBulkTransform={handleBulkTransform}
              onToggleAspectLock={handleToggleAspectLock}
              onReplaceAsset={handleReplaceAsset}
              onResetTransform={handleResetTransform}
              onUpdateFrameRange={handleUpdateFrameRange}
              onTransformGroup={handleTransformGroup}
              onUngroup={handleUngroup}
              onDeleteGroup={handleDeleteGroup}
              onToggleGroupLock={handleToggleGroupLock}
              onToggleGroupVisibility={handleToggleGroupVisibility}
              groupLayersCount={selectedLayer?.groupId ? layers.filter(l => l.groupId === selectedLayer.groupId).length : 0}
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
            const f = e.dataTransfer.files?.[0];
            if (f) loadSvgaFile(f);
          }}
        >
          <div className="max-w-xl w-full bg-slate-900/60 border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl" dir="rtl">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto shadow-glow-indigo">
              <Layers size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">محرر وفك طبقات SVGA الاحترافي</h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                أنشئ مشروعاً جديداً بمقاسات مخصصة وصمم من الصفر، أو افتح وفك ضغط أي ملف SVGA لتعديل الطبقات وإضافة حركات احترافية.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 text-right">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Quick Actions Cards: 1. New Project from Scratch, 2. Open / Decompress SVGA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
              {/* Option 1: Create New Project */}
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="p-6 bg-gradient-to-b from-indigo-600/20 via-purple-600/15 to-transparent hover:from-indigo-600/30 hover:via-purple-600/25 border border-indigo-500/40 hover:border-indigo-400 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg shadow-indigo-600/10 hover:scale-[1.02]"
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
                  <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">إنشاء مشروع جديد من الصفر</h3>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    حدد مقاس الكانفاس (750×1334، 1080×1920...) وابدأ إضافة الصور والطبقات وتصميم الحركة
                  </p>
                </div>
              </button>

              {/* Option 2: Open / Decompress SVGA File */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-6 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/40 rounded-2xl transition-all cursor-pointer group flex flex-col justify-between text-right shadow-lg hover:scale-[1.02]"
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
            </div>

            {/* Drop Zone Strip */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-white/15 hover:border-indigo-500/40 bg-black/20 hover:bg-black/40 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-200"
            >
              <Upload size={15} className="text-indigo-400" />
              <span>أو اسحب وأفلت أي ملف SVGA هنا مباشرة للفتح الفوري</span>
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
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">تصدير ملف SVGA المعدل</h3>
                    <p className="text-[11px] text-slate-400">تصدير الأنميشن بصيغة SVGA 2.0 مع كامل الحركات والأصوات</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* File details summary cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">الأبعاد</span>
                  <span className="text-xs font-mono font-bold text-white">{project.width} × {project.height}</span>
                </div>
                <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">عدد الفريمات / FPS</span>
                  <span className="text-xs font-mono font-bold text-white">{project.totalFrames} F @ {project.fps} fps</span>
                </div>
                <div className="bg-slate-900/80 border border-white/5 rounded-2xl p-3">
                  <span className="text-[10px] text-slate-400 block mb-1">عدد الطبقات</span>
                  <span className="text-xs font-mono font-bold text-indigo-400">{layers.filter(l => l.visible).length} طبقة</span>
                </div>
              </div>

              {/* File Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">اسم الملف عند الحفظ:</label>
                <div className="bg-slate-900 border border-white/10 focus-within:border-indigo-500 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                  <FileCode size={16} className="text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    placeholder="my_animation_edited.svga"
                    className="w-full bg-transparent text-xs font-mono text-white outline-none"
                  />
                </div>
              </div>

              {/* Features preserved pill */}
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-3 space-y-1.5 text-[11px] text-indigo-200">
                <div className="flex items-center gap-2 font-bold text-indigo-300">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>الميزات المحفوظة في التصدير:</span>
                </div>
                <ul className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 pr-5 list-disc">
                  <li>مسارات وتحولات الحركة الأصلية</li>
                  <li>المسارات الصوتية المدمجة ({project.audios?.length || 0})</li>
                  <li>الشفافية والتأثيرات النواقل (Shapes)</li>
                  <li>الصور والطبقات المستبدلة</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] disabled:opacity-50"
                >
                  <Download size={15} /> {isExporting ? 'جاري إنشاء الملف...' : 'تصدير وتحميل الآن'}
                </button>

                {onOpenViewer && (
                  <button
                    onClick={handlePreviewExported}
                    disabled={isExporting}
                    className="px-4 py-3 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs font-bold rounded-2xl border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="معاينة الملف المعدل في مشغل SVGA"
                  >
                    <Play size={14} /> معاينة في المشغل
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
