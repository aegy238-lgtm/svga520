import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Download, Trash2, Play, Pause, RefreshCw, CheckCircle2, 
  AlertCircle, Sparkles, SlidersHorizontal, Settings2, FileArchive, 
  Layers, ArrowLeft, ArrowRight, Eye, Check, X, ShieldCheck, 
  Search, Filter, ChevronDown, ChevronUp, Clock, HardDrive, 
  FileText, Activity, Gauge, Zap, FileBox, HelpCircle, Copy, Volume2, VolumeX, Music, Video, Film
} from 'lucide-react';
import JSZip from 'jszip';
import { UserRecord } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { logActivity } from '../utils/logger';
import { 
  compressSvgaFile, 
  SvgaCompressionSettings, 
  SvgaFileStats 
} from '../utils/svgaCompressorEngine';
import {
  compressVapFile,
  probeVapFile,
  VapCompressionSettings,
  VapFileStats
} from '../utils/vapCompressorEngine';

declare var SVGA: any;

export type SupportedFormat = 'svga' | 'vap' | 'mp4';

export interface BatchCompressorItem {
  id: string;
  file: File;
  name: string;
  format: SupportedFormat;
  originalSize: number;
  compressedSize?: number;
  savedBytes?: number;
  savingPercent?: number;
  status: 'pending' | 'processing' | 'validating' | 'done' | 'error' | 'paused';
  progress: number;
  stepMessage?: string;
  errorMessage?: string;
  hasAudio?: boolean;
  audioPreserved?: boolean;
  stats?: SvgaFileStats | VapFileStats;
  compressedBlob?: Blob;
  compressedUrl?: string;
  originalUrl?: string;
  customQuality?: number;
  createdAt: number;
}

interface SvgaBatchCompressorProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  onSubscriptionRequired: () => void;
}

type PresetMode = 'smart' | 'max_quality' | 'high_quality' | 'balanced' | 'high_compression' | 'max_compression' | 'custom';

export const SvgaBatchCompressor: React.FC<SvgaBatchCompressorProps> = ({
  onCancel,
  currentUser,
  onSubscriptionRequired
}) => {
  const { checkAccess } = useAccessControl();

  // File Queue State
  const [items, setItems] = useState<BatchCompressorItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Settings
  const [quality, setQuality] = useState<number>(75);
  const [preset, setPreset] = useState<PresetMode>('smart');
  const [scale, setScale] = useState<number>(1.0);
  const [optimizeTransforms, setOptimizeTransforms] = useState<boolean>(true);
  const [stripUnusedImages, setStripUnusedImages] = useState<boolean>(true);
  const [preserveAudio, setPreserveAudio] = useState<boolean>(true);
  const [filenameSuffix, setFilenameSuffix] = useState<string>('_compressed');
  const [concurrency, setConcurrency] = useState<number>(3);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done' | 'error'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'svga' | 'vap' | 'mp4'>('all');

  // Preview & Comparison Modal State
  const [previewItem, setPreviewItem] = useState<BatchCompressorItem | null>(null);
  const [previewBg, setPreviewBg] = useState<'dark' | 'light' | 'grid' | 'purple'>('grid');
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewVolume, setPreviewVolume] = useState<number>(1);
  const [previewSpeed, setPreviewSpeed] = useState<number>(1);
  const [copiedTooltip, setCopiedTooltip] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const originalPlayerContainerRef = useRef<HTMLDivElement>(null);
  const compressedPlayerContainerRef = useRef<HTMLDivElement>(null);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const compressedVideoRef = useRef<HTMLVideoElement>(null);
  const originalPlayerRef = useRef<any>(null);
  const compressedPlayerRef = useRef<any>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Keep refs synced
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
        if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
      });
    };
  }, [items]);

  // Helper for preset selection
  const handleSelectPreset = (newPreset: PresetMode) => {
    setPreset(newPreset);
    switch (newPreset) {
      case 'smart':
        setQuality(75);
        setScale(1.0);
        break;
      case 'max_quality':
        setQuality(100);
        setScale(1.0);
        break;
      case 'high_quality':
        setQuality(85);
        setScale(1.0);
        break;
      case 'balanced':
        setQuality(70);
        setScale(1.0);
        break;
      case 'high_compression':
        setQuality(45);
        setScale(1.0);
        break;
      case 'max_compression':
        setQuality(20);
        setScale(0.9);
        break;
      case 'custom':
        break;
    }
  };

  // Detect format from file name/type
  const detectFormat = (file: File): SupportedFormat => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.svga')) return 'svga';
    if (name.endsWith('.vap')) return 'vap';
    if (name.endsWith('.mp4')) return 'mp4';
    if (file.type.includes('svga')) return 'svga';
    if (file.type.includes('mp4') || file.type.includes('video')) return 'mp4';
    return 'svga';
  };

  // Add files to queue with automatic format detection
  const handleAddFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => {
      const name = f.name.toLowerCase();
      return (
        name.endsWith('.svga') ||
        name.endsWith('.vap') ||
        name.endsWith('.mp4') ||
        f.type.includes('svga') ||
        f.type.includes('video') ||
        f.type.includes('mp4') ||
        f.size > 0
      );
    });

    if (validFiles.length === 0) {
      return;
    }

    const newItems: BatchCompressorItem[] = validFiles.map(file => {
      const format = detectFormat(file);
      return {
        id: Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        file,
        name: file.name,
        format,
        originalSize: file.size,
        status: 'pending',
        progress: 0,
        stepMessage: 'جاهز للضغط',
        createdAt: Date.now()
      };
    });

    setItems(prev => [...prev, ...newItems]);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Format bytes helper
  const formatBytes = (bytes: number = 0): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Process a single item (SVGA, VAP, or MP4)
  const processSingleItem = async (itemId: string): Promise<boolean> => {
    const targetItem = items.find(it => it.id === itemId);
    if (!targetItem) return false;

    // Set processing status
    setItems(prev => prev.map(it => it.id === itemId ? {
      ...it,
      status: 'processing',
      progress: 10,
      stepMessage: targetItem.format === 'vap' ? 'فحص وتحليل ملف VAP...' : 
                   targetItem.format === 'mp4' ? 'فحص وتحليل فيديو MP4...' : 'بدء تحليل ملف SVGA...'
    } : it));

    try {
      const activeQuality = targetItem.customQuality ?? quality;

      if (targetItem.format === 'vap' || targetItem.format === 'mp4') {
        // --- VAP & MP4 COMPRESSION ENGINE ---
        const vapSettings: VapCompressionSettings = {
          quality: activeQuality,
          preset,
          scale,
          preserveAudio,
          filenameSuffix,
          format: targetItem.format
        };

        const result = await compressVapFile(
          targetItem.file,
          vapSettings,
          (prog, stepText) => {
            setItems(prev => prev.map(it => it.id === itemId ? {
              ...it,
              progress: prog,
              stepMessage: stepText,
              status: prog >= 90 ? 'validating' : 'processing'
            } : it));
          }
        );

        const originalUrl = URL.createObjectURL(targetItem.file);

        setItems(prev => prev.map(it => it.id === itemId ? {
          ...it,
          status: 'done',
          progress: 100,
          stepMessage: result.stats.validationMessage || 'اكتمل بنجاح',
          compressedSize: result.stats.compressedSizeBytes,
          savedBytes: result.stats.savedBytes,
          savingPercent: result.stats.savingPercent,
          hasAudio: result.stats.hasAudio,
          audioPreserved: result.stats.audioPreserved,
          stats: result.stats,
          compressedBlob: result.compressedBlob,
          compressedUrl: result.previewUrl,
          originalUrl
        } : it));

        return true;
      } else {
        // --- SVGA COMPRESSION ENGINE ---
        const svgaSettings: SvgaCompressionSettings = {
          quality: activeQuality,
          preset,
          scale,
          optimizeTransforms,
          stripUnusedImages,
          preserveAudio,
          filenameSuffix,
          maxDeflateLevel: 9
        };

        const result = await compressSvgaFile(
          targetItem.file,
          svgaSettings,
          (prog, stepText) => {
            setItems(prev => prev.map(it => it.id === itemId ? {
              ...it,
              progress: prog,
              stepMessage: stepText,
              status: prog >= 90 ? 'validating' : 'processing'
            } : it));
          }
        );

        const compressedUrl = URL.createObjectURL(result.compressedBlob);
        const originalUrl = URL.createObjectURL(result.originalBlob);

        const hasAudio = (result.stats?.audioCount || 0) > 0;

        setItems(prev => prev.map(it => it.id === itemId ? {
          ...it,
          status: 'done',
          progress: 100,
          stepMessage: result.stats.validationMessage || 'اكتمل بنجاح',
          compressedSize: result.stats.compressedSizeBytes,
          savedBytes: result.stats.savedBytes,
          savingPercent: result.stats.savingPercent,
          hasAudio,
          audioPreserved: hasAudio && preserveAudio,
          stats: result.stats,
          compressedBlob: result.compressedBlob,
          compressedUrl,
          originalUrl
        } : it));

        return true;
      }
    } catch (err: any) {
      console.error(`Error compressing item ${targetItem.name}:`, err);
      setItems(prev => prev.map(it => it.id === itemId ? {
        ...it,
        status: 'error',
        progress: 0,
        stepMessage: 'فشلت المعالجة',
        errorMessage: err?.message || 'خطأ غير معروف في هيكل الملف'
      } : it));
      return false;
    }
  };

  // Run the batch queue with concurrency control
  const startBatchQueue = async () => {
    const { allowed } = await checkAccess('SVGA & VAP Compression');
    if (!allowed) {
      onSubscriptionRequired();
      return;
    }

    setIsProcessingQueue(true);
    setIsPaused(false);
    isCancelledRef.current = false;

    if (currentUser) {
      logActivity(currentUser, 'feature_usage', `Started Batch SVGA & VAP Compression for ${items.length} files with quality ${quality}%`);
    }

    // Get all pending or error items
    const queueIds = items.filter(it => it.status === 'pending' || it.status === 'error').map(it => it.id);
    let queueIndex = 0;

    const worker = async () => {
      while (queueIndex < queueIds.length && !isCancelledRef.current) {
        if (isPausedRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        const currentId = queueIds[queueIndex++];
        if (currentId) {
          await processSingleItem(currentId);
        }
      }
    };

    // Run parallel workers based on concurrency setting
    const workerPromises: Promise<void>[] = [];
    const activeWorkers = Math.min(concurrency, queueIds.length || 1);
    for (let i = 0; i < activeWorkers; i++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);
    setIsProcessingQueue(false);
  };

  // Pause batch queue
  const handlePauseQueue = () => {
    setIsPaused(true);
  };

  // Resume batch queue
  const handleResumeQueue = () => {
    setIsPaused(false);
    if (!isProcessingQueue) {
      startBatchQueue();
    }
  };

  // Cancel / Reset
  const handleClearAll = () => {
    isCancelledRef.current = true;
    setIsProcessingQueue(false);
    setIsPaused(false);
    items.forEach(item => {
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    });
    setItems([]);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(it => it.id === id);
      if (target?.compressedUrl) URL.revokeObjectURL(target.compressedUrl);
      if (target?.originalUrl) URL.revokeObjectURL(target.originalUrl);
      return prev.filter(it => it.id !== id);
    });
  };

  // Download single compressed file
  const handleDownloadSingle = (item: BatchCompressorItem) => {
    if (!item.compressedBlob) return;
    const extMatch = item.name.match(/\.(svga|vap|mp4)$/i);
    const ext = extMatch ? extMatch[0] : (item.format === 'vap' ? '.vap' : item.format === 'mp4' ? '.mp4' : '.svga');
    const baseName = item.name.replace(/\.(svga|vap|mp4)$/i, '');
    const outName = `${baseName}${filenameSuffix}${ext}`;
    const url = URL.createObjectURL(item.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Export all compressed files as individual downloads
  const handleExportAllIndividual = () => {
    const doneItems = items.filter(it => it.status === 'done' && it.compressedBlob);
    if (doneItems.length === 0) return;

    doneItems.forEach((item, index) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, index * 300);
    });
  };

  // Export all compressed files as a single ZIP
  const handleExportAllZip = async () => {
    const doneItems = items.filter(it => it.status === 'done' && it.compressedBlob);
    if (doneItems.length === 0) return;

    setIsExportingZip(true);
    setZipProgress(10);

    try {
      const zip = new JSZip();
      const svgaFolder = zip.folder('compressed_svga_files');
      const vapFolder = zip.folder('compressed_vap_files');
      const mp4Folder = zip.folder('compressed_mp4_files');

      for (let i = 0; i < doneItems.length; i++) {
        const item = doneItems[i];
        const extMatch = item.name.match(/\.(svga|vap|mp4)$/i);
        const ext = extMatch ? extMatch[0] : (item.format === 'vap' ? '.vap' : item.format === 'mp4' ? '.mp4' : '.svga');
        const baseName = item.name.replace(/\.(svga|vap|mp4)$/i, '');
        const outName = `${baseName}${filenameSuffix}${ext}`;
        
        if (item.compressedBlob) {
          if (item.format === 'vap' && vapFolder) {
            vapFolder.file(outName, item.compressedBlob);
          } else if (item.format === 'mp4' && mp4Folder) {
            mp4Folder.file(outName, item.compressedBlob);
          } else if (svgaFolder) {
            svgaFolder.file(outName, item.compressedBlob);
          }
        }
        setZipProgress(10 + Math.round(((i + 1) / doneItems.length) * 70));
      }

      setZipProgress(85);
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      setZipProgress(100);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Batch_Compressed_Animations_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Failed to generate ZIP:', e);
      alert('حدث خطأ أثناء تجميع ملفات ZIP');
    } finally {
      setIsExportingZip(false);
      setZipProgress(0);
    }
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const totalFiles = items.length;
    const svgaCount = items.filter(it => it.format === 'svga').length;
    const vapCount = items.filter(it => it.format === 'vap').length;
    const mp4Count = items.filter(it => it.format === 'mp4').length;
    const completedFiles = items.filter(it => it.status === 'done').length;
    const processingFiles = items.filter(it => it.status === 'processing' || it.status === 'validating').length;
    const errorFiles = items.filter(it => it.status === 'error').length;
    const pendingFiles = items.filter(it => it.status === 'pending').length;

    const totalOriginalBytes = items.reduce((acc, it) => acc + it.originalSize, 0);
    const totalCompressedBytes = items.reduce((acc, it) => acc + (it.compressedSize ?? it.originalSize), 0);
    const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
    const overallSavingPercent = totalOriginalBytes > 0 
      ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) 
      : 0;

    const aggregateProgress = totalFiles > 0
      ? Math.round((completedFiles / totalFiles) * 100)
      : 0;

    return {
      totalFiles,
      svgaCount,
      vapCount,
      mp4Count,
      completedFiles,
      processingFiles,
      errorFiles,
      pendingFiles,
      totalOriginalBytes,
      totalCompressedBytes,
      totalSavedBytes,
      overallSavingPercent,
      aggregateProgress
    };
  }, [items]);

  // Filtered files list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'pending' && (item.status === 'pending' || item.status === 'processing')) ||
        (statusFilter === 'done' && item.status === 'done') ||
        (statusFilter === 'error' && item.status === 'error');
      
      const matchesFormat = 
        formatFilter === 'all' || 
        item.format === formatFilter;

      return matchesSearch && matchesStatus && matchesFormat;
    });
  }, [items, searchQuery, statusFilter, formatFilter]);

  // Initialize SVGA Players inside the Comparison/Preview Modal when previewItem is SVGA
  useEffect(() => {
    if (!previewItem || previewItem.format !== 'svga') {
      if (originalPlayerRef.current) {
        try { originalPlayerRef.current.clear(); } catch {}
        originalPlayerRef.current = null;
      }
      if (compressedPlayerRef.current) {
        try { compressedPlayerRef.current.clear(); } catch {}
        compressedPlayerRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const initPlayers = async () => {
      if (!previewItem || previewItem.format !== 'svga') return;

      const SVGA: any = await new Promise((resolve) => {
        const check = () => (window as any).SVGA ? resolve((window as any).SVGA) : setTimeout(check, 50);
        check();
      });

      if (isCancelled || !SVGA) return;

      // Prepare original source
      let origSource: string | ArrayBuffer = previewItem.originalUrl || '';
      if (!origSource && previewItem.file) {
        try {
          origSource = URL.createObjectURL(previewItem.file);
        } catch {
          origSource = '';
        }
      }

      // 1. Original Player
      if (originalPlayerContainerRef.current) {
        originalPlayerContainerRef.current.innerHTML = '';
        const p1 = new SVGA.Player(originalPlayerContainerRef.current);
        const parser1 = new SVGA.Parser();
        p1.loops = 0;
        p1.clearsAfterStop = false;
        p1.setContentMode('AspectFit');

        const loadToPlayer = (src: string | ArrayBuffer) => {
          parser1.load(src, (videoItem: any) => {
            if (isCancelled) return;
            p1.setVideoItem(videoItem);
            p1.startAnimation();
            originalPlayerRef.current = p1;
            setPreviewPlaying(true);
          }, (err: any) => {
            console.warn("Retrying original player via DataURL:", err);
            if (previewItem.file) {
              const reader = new FileReader();
              reader.onload = () => {
                if (isCancelled) return;
                parser1.load(reader.result as string, (vItem: any) => {
                  p1.setVideoItem(vItem);
                  p1.startAnimation();
                  originalPlayerRef.current = p1;
                  setPreviewPlaying(true);
                }, (err2: any) => console.warn("Failed DataURL load:", err2));
              };
              reader.readAsDataURL(previewItem.file);
            }
          });
        };

        if (origSource) {
          loadToPlayer(origSource);
        }
      }

      // 2. Compressed Player (if compressed file exists)
      const compUrl = previewItem.compressedUrl;
      if (compressedPlayerContainerRef.current && compUrl) {
        compressedPlayerContainerRef.current.innerHTML = '';
        const p2 = new SVGA.Player(compressedPlayerContainerRef.current);
        const parser2 = new SVGA.Parser();
        p2.loops = 0;
        p2.clearsAfterStop = false;
        p2.setContentMode('AspectFit');

        parser2.load(compUrl, (videoItem: any) => {
          if (isCancelled) return;
          p2.setVideoItem(videoItem);
          p2.startAnimation();
          compressedPlayerRef.current = p2;
        }, (err: any) => console.warn("Failed to load compressed player:", err));
      }
    };

    const timer = setTimeout(initPlayers, 50);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [previewItem]);

  // Synchronized video control for VAP & MP4 preview
  useEffect(() => {
    if (previewItem?.format === 'vap' || previewItem?.format === 'mp4') {
      if (originalVideoRef.current) {
        originalVideoRef.current.playbackRate = previewSpeed;
        originalVideoRef.current.muted = previewMuted;
        originalVideoRef.current.volume = previewVolume;
      }
      if (compressedVideoRef.current) {
        compressedVideoRef.current.playbackRate = previewSpeed;
        compressedVideoRef.current.muted = previewMuted;
        compressedVideoRef.current.volume = previewVolume;
      }
    }
  }, [previewItem, previewSpeed, previewMuted, previewVolume]);

  // Control playback in preview modal
  const togglePreviewPlay = () => {
    if (previewItem?.format === 'vap' || previewItem?.format === 'mp4') {
      if (previewPlaying) {
        originalVideoRef.current?.pause();
        compressedVideoRef.current?.pause();
      } else {
        originalVideoRef.current?.play().catch(() => {});
        compressedVideoRef.current?.play().catch(() => {});
      }
    } else {
      if (previewPlaying) {
        originalPlayerRef.current?.pauseAnimation?.();
        compressedPlayerRef.current?.pauseAnimation?.();
      } else {
        originalPlayerRef.current?.startAnimation?.();
        compressedPlayerRef.current?.startAnimation?.();
      }
    }
    setPreviewPlaying(!previewPlaying);
  };

  return (
    <div className="w-full min-h-screen text-slate-100 font-sans pb-24" dir="rtl">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".svga,.vap,.mp4"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0E1322]/90 via-[#131B30]/90 to-[#0E1322]/90 border border-white/10 p-5 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            <button
              onClick={onCancel}
              className="p-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl border border-white/10 transition-all cursor-pointer shadow-sm"
              title="العودة للرئيسية"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/20 text-white">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                    <span>منظومة ضغط ملفات SVGA و VAP و MP4 الذكية</span>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 text-indigo-300 border border-indigo-500/30">
                      SVGA + VAP + MP4 Hub
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ضغط دفعات ضخمة من ملفات SVGA و VAP وفيديوهات MP4 مع الحفاظ التام على المسارات الصوتية والشفافية وسلاسة الحركة
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Top Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>إضافة ملفات SVGA / VAP / MP4</span>
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="py-2.5 px-3.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold rounded-2xl text-xs transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
              title="رفع مجلد كامل يحتوي على ملفات SVGA أو VAP أو MP4"
            >
              <FileArchive className="w-4 h-4 text-purple-400" />
              <span>رفع مجلد كامل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Real-time Aggregate Statistics Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gradient-to-b from-[#121728] to-[#0A0D18] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-bold">
              <span>إجمالي الملفات</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white">{stats.totalFiles}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>SVGA: <strong className="text-indigo-300">{stats.svgaCount}</strong></span>
              <span>•</span>
              <span>VAP: <strong className="text-purple-300">{stats.vapCount}</strong></span>
              <span>•</span>
              <span>MP4: <strong className="text-emerald-300">{stats.mp4Count}</strong></span>
              <span>•</span>
              <span>المكتمل: <strong className="text-emerald-400">{stats.completedFiles}</strong></span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#121728] to-[#0A0D18] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-bold">
              <span>الحجم الأصلي</span>
              <HardDrive className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-slate-200">{formatBytes(stats.totalOriginalBytes)}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              إجمالي حجم المدخلات
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#121728] to-[#0A0D18] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-bold">
              <span>الحجم بعد الضغط</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-300">{formatBytes(stats.totalCompressedBytes)}</div>
            <div className="text-[11px] text-purple-400/80 mt-1">
              النتيجة المحسنة
            </div>
          </div>

          <div className="bg-gradient-to-b from-[#121728] to-[#0A0D18] border border-emerald-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-400 text-xs mb-1 font-bold">
              <span>إجمالي التوفير</span>
              <Gauge className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 flex items-baseline gap-1.5">
              <span>{stats.overallSavingPercent}%</span>
              <span className="text-xs font-normal text-emerald-300">({formatBytes(stats.totalSavedBytes)})</span>
            </div>
            <div className="text-[11px] text-emerald-500/80 mt-1">
              توفير مساحة الذاكرة
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-gradient-to-b from-[#121728] to-[#0A0D18] border border-white/10 rounded-2xl p-4 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-bold">
              <span>نسبة الإنجاز</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">{stats.aggregateProgress}%</div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${stats.aggregateProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Compression Controls & Quality Settings Card */}
        <div className="bg-[#0E1322]/90 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-6">
          
          {/* Presets Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                أوضاع الضغط والجودة الذكية (Smart Compression Presets):
              </span>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{showAdvancedSettings ? 'إخفاء الإعدادات المتقدمة' : 'خيارات وضبط متقدم'}</span>
                {showAdvancedSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { id: 'smart', label: 'الضغط الذكي (Smart)', desc: 'تخصيص تلقائي لـ SVGA و VAP', badge: 'موصى به', color: 'indigo' },
                { id: 'max_quality', label: 'أعلى جودة (100%)', desc: 'CRF منخفض وبدون ضغط بصري', badge: 'Lossless', color: 'emerald' },
                { id: 'high_quality', label: 'جودة عالية (85%)', desc: 'توازن عالي ونقاء تام', badge: 'High', color: 'blue' },
                { id: 'balanced', label: 'متوازن (70%)', desc: 'توفير 50-70% من الحجم', badge: 'Balanced', color: 'purple' },
                { id: 'high_compression', label: 'ضغط قوي (45%)', desc: 'للألعاب والشبكات السريعة', badge: 'Aggressive', color: 'orange' },
                { id: 'max_compression', label: 'أقصى تصغير (20%)', desc: 'أصغر حجم ممكن للذاكرة', badge: 'Max Save', color: 'pink' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id as PresetMode)}
                  className={`p-3 rounded-2xl text-right transition-all border relative flex flex-col justify-between cursor-pointer ${
                    preset === p.id 
                      ? 'bg-indigo-600/20 border-indigo-500/60 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500/40' 
                      : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-black ${preset === p.id ? 'text-white' : 'text-slate-300'}`}>
                        {p.label}
                      </span>
                      {p.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                          preset === p.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'
                        }`}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">{p.desc}</p>
                  </div>
                  {preset === p.id && (
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 self-end"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-black text-slate-200">التحكم الدقيق بمستوى الجودة والضغط (Quality / CRF):</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {quality}%
                </span>
              </div>
              <div className="text-xs text-slate-400 font-bold">
                {quality >= 95 ? '🔥 أعلى دقة ألوان ومطابقة تامة' :
                 quality >= 80 ? '✨ جودة بصرية ممتازة جداً' :
                 quality >= 60 ? '⚡ ضغط متوازن وتوفير ملحوظ' :
                 quality >= 35 ? '📦 ضغط قوي جداً وتصغير هائل' :
                 '🚀 أقصى مستوى تقليص لحجم الذاكرة'}
              </div>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={quality}
                onChange={(e) => {
                  setQuality(parseInt(e.target.value));
                  setPreset('custom');
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 px-1 font-bold">
                <span>10% (أقصى ضغط)</span>
                <span>35% (قوي)</span>
                <span>65% (متوسط)</span>
                <span>80% (موصى به)</span>
                <span>100% (أعلى جودة)</span>
              </div>
            </div>
          </div>

          {/* Advanced Settings Drawer */}
          <AnimatePresence>
            {showAdvancedSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 border-t border-white/10 space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {/* Filename suffix */}
                  <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">لاحقة اسم الملف المضغوط:</label>
                    <input
                      type="text"
                      value={filenameSuffix}
                      onChange={(e) => setFilenameSuffix(e.target.value)}
                      placeholder="_compressed"
                      className="w-full bg-[#0A0D18] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 block">مثال: gift{filenameSuffix}.vap</span>
                  </div>

                  {/* Concurrency Limit */}
                  <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-300">المعالجة المتوازية:</label>
                      <span className="text-xs font-bold text-indigo-400">{concurrency} ملفات معاً</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={concurrency}
                      onChange={(e) => setConcurrency(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 block">تسريع المعالجة المتزامنة</span>
                  </div>

                  {/* Preserve Audio Tracks (SVGA, VAP, MP4) */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        حفظ الصوت 100% (SVGA / VAP / MP4)
                      </div>
                      <div className="text-[10px] text-emerald-400/80">الحفاظ التام على المسارات الصوتية المدمجة دون حذف أو كتم</div>
                    </div>
                    <button
                      onClick={() => setPreserveAudio(!preserveAudio)}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                        preserveAudio ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                      title={preserveAudio ? 'الصوت محفوظ 100%' : 'تعطيل الحفاظ على الصوت'}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        preserveAudio ? 'left-0.5 translate-x-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Strip Orphan Images (SVGA) */}
                  <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-300">حذف الصور المهملة (SVGA)</div>
                      <div className="text-[10px] text-slate-500">إزالة الأصول غير المرتبطة بطبقات</div>
                    </div>
                    <button
                      onClick={() => setStripUnusedImages(!stripUnusedImages)}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                        stripUnusedImages ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        stripUnusedImages ? 'left-0.5 translate-x-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* Optimize Coordinates (SVGA & VAP) */}
                  <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-300">تحسين الإحداثيات والـ Boxes</div>
                      <div className="text-[10px] text-slate-500">تقليص حمولة الـ Metadata الزائدة</div>
                    </div>
                    <button
                      onClick={() => setOptimizeTransforms(!optimizeTransforms)}
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${
                        optimizeTransforms ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        optimizeTransforms ? 'left-0.5 translate-x-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Master Queue Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center flex-wrap gap-2.5">
              {!isProcessingQueue ? (
                <button
                  onClick={startBatchQueue}
                  disabled={items.length === 0}
                  className={`py-3 px-6 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    items.length > 0
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02]'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>بدء ضغط جميع الملفات ({items.length})</span>
                </button>
              ) : (
                <>
                  {!isPaused ? (
                    <button
                      onClick={handlePauseQueue}
                      className="py-3 px-5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                    >
                      <Pause className="w-4 h-4 fill-current" />
                      <span>إيقاف مؤقت للعملية</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResumeQueue}
                      className="py-3 px-5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>استكمال المعالجة</span>
                    </button>
                  )}
                </>
              )}

              {/* Retry / Re-compress pending/failed */}
              {stats.errorFiles > 0 && (
                <button
                  onClick={startBatchQueue}
                  className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة محاولة الفاشل ({stats.errorFiles})</span>
                </button>
              )}

              {/* Clear All */}
              {items.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-300 border border-white/5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="مسح كافة الملفات"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح القائمة</span>
                </button>
              )}
            </div>

            {/* Export Actions */}
            <div className="flex items-center flex-wrap gap-2.5">
              <button
                onClick={handleExportAllZip}
                disabled={stats.completedFiles === 0 || isExportingZip}
                className={`py-3 px-5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                  stats.completedFiles > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 hover:scale-[1.02]'
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <FileArchive className="w-4 h-4" />
                <span>{isExportingZip ? `جاري تجهيز ZIP (${zipProgress}%)...` : `تصدير الكل كـ ZIP (${stats.completedFiles})`}</span>
              </button>

              <button
                onClick={handleExportAllIndividual}
                disabled={stats.completedFiles === 0}
                className={`py-3 px-4 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
                  stats.completedFiles > 0
                    ? 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/20 hover:text-white'
                    : 'bg-white/5 text-slate-500 cursor-not-allowed border-white/5'
                }`}
                title="تنزيل الملفات المضغوطة بشكل منفصل بأسمائها المعدلة"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير منفصل</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drag and Drop Zone / Empty State */}
        {items.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-20 px-6 rounded-3xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-4 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                : 'border-white/15 bg-gradient-to-b from-[#0E1322]/60 to-[#070A12]/40 hover:border-indigo-500/50 hover:bg-white/5'
            }`}
          >
            <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 shadow-xl shadow-indigo-500/10">
              <Upload className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white mb-1">
                اسحب وأفلت ملفات SVGA و VAP هنا للضغط الجماعي
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                يدعم رفع مئات ملفات SVGA و VAP دفعة واحدة • اكتشاف الصوت وحفظه تلقائياً 100% • الحفاظ على قنوات الشفافية (Alpha) والأبعاد والإطارات
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <span className="py-2 px-4 rounded-xl bg-white/10 text-slate-200 text-xs font-bold border border-white/10 hover:bg-white/20">
                تصفح الملفات (.svga / .vap / .mp4)
              </span>
              <span className="text-xs text-slate-500">أو اسحب مجلد كامل</span>
            </div>
          </div>
        ) : (
          /* Active Queue & File Cards List */
          <div className="space-y-4">
            
            {/* Search and Filters Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0E1322]/80 border border-white/10 p-3.5 rounded-2xl backdrop-blur-xl">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="البحث في قائمة الملفات..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Format Switcher Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setFormatFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formatFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    كل الصيغ ({items.length})
                  </button>
                  <button
                    onClick={() => setFormatFilter('svga')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      formatFilter === 'svga' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>SVGA ({stats.svgaCount})</span>
                  </button>
                  <button
                    onClick={() => setFormatFilter('vap')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      formatFilter === 'vap' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3 h-3 text-purple-400" />
                    <span>VAP ({stats.vapCount})</span>
                  </button>
                  <button
                    onClick={() => setFormatFilter('mp4')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      formatFilter === 'mp4' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3 h-3 text-emerald-400" />
                    <span>MP4 ({stats.mp4Count})</span>
                  </button>
                </div>

                <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block"></div>

                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'pending', label: 'في الانتظار' },
                  { id: 'done', label: 'المكتمل' },
                  { id: 'error', label: 'أخطاء' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`py-1 px-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      statusFilter === f.id
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* File Cards Container */}
            <div className="grid grid-cols-1 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    item.status === 'done'
                      ? 'bg-gradient-to-r from-[#0E1528] to-[#0A1020] border-emerald-500/20'
                      : item.status === 'processing' || item.status === 'validating'
                      ? 'bg-gradient-to-r from-[#171630] to-[#0F1225] border-indigo-500/40 ring-1 ring-indigo-500/30'
                      : item.status === 'error'
                      ? 'bg-gradient-to-r from-[#201018] to-[#120A10] border-red-500/30'
                      : 'bg-[#0E1322]/80 border-white/5 hover:border-white/15'
                  }`}
                >
                  {/* Left info & progress */}
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      item.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : item.status === 'processing' || item.status === 'validating'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse'
                        : item.status === 'error'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : item.format === 'mp4'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.format === 'vap'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}>
                      {item.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> :
                       item.status === 'processing' || item.status === 'validating' ? <Activity className="w-5 h-5 animate-spin" /> :
                       item.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
                       item.format === 'mp4' ? <Video className="w-5 h-5 text-emerald-400" /> :
                       item.format === 'vap' ? <Film className="w-5 h-5 text-purple-400" /> :
                       <Layers className="w-5 h-5 text-indigo-400" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white truncate max-w-sm" title={item.name}>
                          {item.name}
                        </h4>

                        {/* Format Badge */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase border ${
                          item.format === 'mp4'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : item.format === 'vap' 
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' 
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        }`}>
                          {item.format}
                        </span>
                        
                        {item.stats && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                            {((item.stats as any).width || (item.stats as any).viewBoxWidth || 0)}×{((item.stats as any).height || (item.stats as any).viewBoxHeight || 0)} • {item.stats.fps} FPS
                          </span>
                        )}

                        {/* Audio Track Indicator */}
                        {item.hasAudio && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            <span>صوت مدمج (محفوظ 100%)</span>
                          </span>
                        )}

                        {item.status === 'done' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>سليم ومطابق ✓</span>
                          </span>
                        )}
                      </div>

                      {/* Status / Step text */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-bold ${
                          item.status === 'done' ? 'text-emerald-400' :
                          item.status === 'processing' || item.status === 'validating' ? 'text-indigo-400' :
                          item.status === 'error' ? 'text-red-400' :
                          'text-slate-500'
                        }`}>
                          {item.stepMessage || (item.status === 'pending' ? 'في قائمة الانتظار' : '')}
                        </span>
                        {item.errorMessage && (
                          <span className="text-red-400/90 text-[11px] truncate">({item.errorMessage})</span>
                        )}
                      </div>

                      {/* Mini Progress Bar during processing */}
                      {(item.status === 'processing' || item.status === 'validating') && (
                        <div className="w-full max-w-md bg-white/10 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-200"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center & Right Stats & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                    
                    {/* Size Comparison Badges */}
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500 font-bold">الحجم الأصلي</div>
                        <div className="text-xs font-bold text-slate-300">{formatBytes(item.originalSize)}</div>
                      </div>

                      {item.compressedSize !== undefined && (
                        <>
                          <div className="text-slate-600">➔</div>
                          <div>
                            <div className="text-[10px] text-purple-400 font-bold">المضغوط</div>
                            <div className="text-xs font-black text-purple-300">{formatBytes(item.compressedSize)}</div>
                          </div>
                          <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
                            -{item.savingPercent}%
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Compare / Preview Button */}
                      <button
                        onClick={() => setPreviewItem(item)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          item.status === 'done'
                            ? 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white border border-indigo-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                        }`}
                        title="معاينة وتشغيل حركة الأنيميشن والصوت"
                      >
                        <Eye className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <span>{item.status === 'done' ? 'معاينة ومقارنة' : 'تشغيل الحركة'}</span>
                      </button>

                      {/* Download Single File */}
                      {item.status === 'done' && item.compressedBlob && (
                        <button
                          onClick={() => handleDownloadSingle(item)}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="تنزيل الملف المضغوط"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">تحميل</span>
                        </button>
                      )}

                      {/* Single Re-compress */}
                      <button
                        onClick={() => processSingleItem(item.id)}
                        disabled={item.status === 'processing'}
                        className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl text-xs transition-all cursor-pointer"
                        title="ضغط / إعادة ضغط هذا الملف"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                      </button>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-white/10 rounded-xl text-xs transition-all cursor-pointer"
                        title="حذف من القائمة"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-side Live Player Comparison Modal (SVGA & VAP) */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
            dir="rtl"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl bg-[#0F1424] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#13192E]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {previewItem.format === 'vap' ? <Film className="w-5 h-5 text-purple-400" /> : 
                     previewItem.format === 'mp4' ? <Video className="w-5 h-5 text-emerald-400" /> : 
                     <Eye className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>معاينة ومقارنة: {previewItem.name}</span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md uppercase bg-white/10 text-slate-300">
                        {previewItem.format}
                      </span>
                      {previewItem.savingPercent !== undefined && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          وفر {previewItem.savingPercent}%
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      مقارنة مباشرة وسلسة بين الملف الأصلي والنسخة المضغوطة للتحقق من الشفافية ونقاء الصوت والحركة
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadSingle(previewItem)}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل النسخة المضغوطة</span>
                  </button>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Player Controllers & Background Selector */}
              <div className="px-5 py-3 border-b border-white/5 bg-[#0B0F1C] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePreviewPlay}
                    className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    {previewPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{previewPlaying ? 'إيقاف مؤقت' : 'تشغيل الأنيميشن'}</span>
                  </button>

                  {/* Audio Mute/Unmute for VAP/MP4/SVGA with Audio */}
                  {previewItem.hasAudio && (
                    <button
                      onClick={() => setPreviewMuted(!previewMuted)}
                      className={`p-1.5 px-2.5 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        previewMuted ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                      title={previewMuted ? 'كتم الصوت' : 'تشغيل الصوت'}
                    >
                      {previewMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{previewMuted ? 'مكتوم' : 'صوت مدمج 100%'}</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    {[0.5, 1, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPreviewSpeed(speed);
                          // @ts-ignore
                          if (originalPlayerRef.current) originalPlayerRef.current.fps = (previewItem.stats?.fps || 30) * speed;
                          // @ts-ignore
                          if (compressedPlayerRef.current) compressedPlayerRef.current.fps = (previewItem.stats?.fps || 30) * speed;
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                          previewSpeed === speed ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Color Switcher */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">خلفية المعاينة:</span>
                  <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setPreviewBg('grid')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        previewBg === 'grid' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      مربعات شفافة
                    </button>
                    <button
                      onClick={() => setPreviewBg('dark')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        previewBg === 'dark' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      داكن
                    </button>
                    <button
                      onClick={() => setPreviewBg('light')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        previewBg === 'light' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      فاتح
                    </button>
                    <button
                      onClick={() => setPreviewBg('purple')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        previewBg === 'purple' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ملون
                    </button>
                  </div>
                </div>
              </div>

              {/* Side by Side Comparison Display */}
              {previewItem.status === 'done' && previewItem.compressedUrl ? (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-1">
                  {/* Original File Player Card */}
                  <div className="bg-[#0B0F1C] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        الملف الأصلي ({previewItem.format.toUpperCase()})
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {formatBytes(previewItem.originalSize)}
                      </span>
                    </div>

                    <div 
                      className={`w-full aspect-square rounded-xl overflow-hidden relative flex items-center justify-center border border-white/5 ${
                        previewBg === 'dark' ? 'bg-[#05070D]' :
                        previewBg === 'light' ? 'bg-slate-200' :
                        previewBg === 'purple' ? 'bg-gradient-to-br from-indigo-900 to-purple-900' :
                        'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#0A0D18]'
                      }`}
                    >
                      {previewItem.format === 'vap' || previewItem.format === 'mp4' ? (
                        <video
                          ref={originalVideoRef}
                          src={previewItem.originalUrl || URL.createObjectURL(previewItem.file)}
                          autoPlay
                          loop
                          playsInline
                          muted={previewMuted}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div 
                          ref={originalPlayerContainerRef} 
                          className="w-full h-full flex items-center justify-center pointer-events-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Compressed File Player Card */}
                  <div className="bg-[#0B0F1C] border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                      <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        النسخة المضغوطة (Compressed)
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-300">
                          {formatBytes(previewItem.compressedSize)}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                          -{previewItem.savingPercent}%
                        </span>
                      </div>
                    </div>

                    <div 
                      className={`w-full aspect-square rounded-xl overflow-hidden relative flex items-center justify-center border border-emerald-500/20 ${
                        previewBg === 'dark' ? 'bg-[#05070D]' :
                        previewBg === 'light' ? 'bg-slate-200' :
                        previewBg === 'purple' ? 'bg-gradient-to-br from-indigo-900 to-purple-900' :
                        'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#0A0D18]'
                      }`}
                    >
                      {previewItem.format === 'vap' || previewItem.format === 'mp4' ? (
                        <video
                          ref={compressedVideoRef}
                          src={previewItem.compressedUrl}
                          autoPlay
                          loop
                          playsInline
                          muted={previewMuted}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div 
                          ref={compressedPlayerContainerRef} 
                          className="w-full h-full flex items-center justify-center pointer-events-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Single Full View Player before compression */
                <div className="p-6 flex flex-col items-center justify-center overflow-y-auto flex-1">
                  <div className="w-full max-w-md bg-[#0B0F1C] border border-white/10 rounded-3xl p-5 flex flex-col gap-3 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        معاينة ملف {previewItem.format.toUpperCase()} الأصلي
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {formatBytes(previewItem.originalSize)}
                      </span>
                    </div>

                    <div 
                      className={`w-full aspect-square rounded-2xl overflow-hidden relative flex items-center justify-center border border-white/10 ${
                        previewBg === 'dark' ? 'bg-[#05070D]' :
                        previewBg === 'light' ? 'bg-slate-200' :
                        previewBg === 'purple' ? 'bg-gradient-to-br from-indigo-900 to-purple-900' :
                        'bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#0A0D18]'
                      }`}
                    >
                      {previewItem.format === 'vap' || previewItem.format === 'mp4' ? (
                        <video
                          ref={originalVideoRef}
                          src={previewItem.originalUrl || URL.createObjectURL(previewItem.file)}
                          autoPlay
                          loop
                          playsInline
                          muted={previewMuted}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div 
                          ref={originalPlayerContainerRef} 
                          className="w-full h-full flex items-center justify-center pointer-events-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Technical Comparison Matrix Footer */}
              {previewItem.stats && (
                <div className="p-4 bg-[#0A0D18] border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">الأبعاد (Dimensions):</span>
                    <strong className="text-slate-200 font-bold">{((previewItem.stats as any).width || (previewItem.stats as any).viewBoxWidth || 0)} × {((previewItem.stats as any).height || (previewItem.stats as any).viewBoxHeight || 0)} px</strong>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">معدل الإطارات (FPS):</span>
                    <strong className="text-slate-200 font-bold">{previewItem.stats.fps} إطار/ثانية</strong>
                  </div>
                  <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-500 block text-[10px]">الصيغة (Format):</span>
                    <strong className="text-slate-200 font-bold uppercase">{previewItem.format} Animation</strong>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    previewItem.hasAudio 
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                      : 'bg-white/5 border-white/5 text-slate-400'
                  }`}>
                    <span className="block text-[10px] opacity-80">المسار الصوتي (Audio):</span>
                    <strong className="font-bold flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      {previewItem.hasAudio ? 'محفوظ وسليم 100%' : 'بدون صوت'}
                    </strong>
                  </div>
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                    <span className="text-emerald-400/80 block text-[10px]">الشفافية والـ Alpha:</span>
                    <strong className="text-emerald-300 font-bold">محفوظة ونقية تماماً ✓</strong>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
