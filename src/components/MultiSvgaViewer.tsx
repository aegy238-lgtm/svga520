import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Play, Pause, RotateCcw, Trash2, Maximize2, Info, Upload, FolderUp, X, Download, Image as ImageIcon, ShieldCheck, Monitor, Smartphone, Loader2, Camera, Video, Film, FileVideo, Volume2, Music , SquareCheck, Gift, Sparkles, FileText, Lock, Unlock, Key, Square, CheckSquare, Check, SlidersHorizontal, Sliders } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { PresetBackground, UserRecord } from '../types';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebMMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { loadFFmpegWithFallbacks } from '../utils/ffmpegLoader';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { createStreamingZip } from '../utils/streamZip';
import { calculateSafeDimensions } from '../utils/dimensions';
import { getPAG, convertPagToSvga } from '../utils/pagEngine';
import { normalizeSvgaFile } from "../utils/svgaNormalizer";
import { ensureMp3WithId3, extractAllAudiosFromSvga } from '../utils/svgaAudio';
import {
  extractAllSvgaAudioTracks,
  mixAudioTracksToBuffer,
  encodeAudioBufferToMuxer,
  muxAudioWithFFmpegFallback,
  verifyExportedVideo,
  ExtractedAudioTrack
} from '../utils/svgaVideoAudioExporter';
import Vap from 'video-animation-player';
import { extractVapConfigFromBlob, convertVapToMp4, WebGLVapRenderer, seekVideoToFrame, VapConfig } from '../utils/vapEngine';
import { exportAsVap, exportAsYyeva } from './AnimationManager/utils/exportEngine';
import { downloadDesignerInfoFile } from '../utils/designerInfo';
import { extractSvgaFromPdfFile, PdfUnlockRequest } from '../utils/pdfSvgaExtractor';
import { generateSvgaAllInOnePdf, SvgaPdfItem } from '../utils/svgaAllInOnePdfGenerator';
import { SvgaActionDock } from './SvgaActionDock';

const decodeDataToBytes = (data: any): Uint8Array | null => {
  if (!data) return null;
  if (data instanceof Uint8Array) return ensureMp3WithId3(data);
  if (data instanceof ArrayBuffer) return ensureMp3WithId3(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) return ensureMp3WithId3(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (typeof data === 'string') {
    let binaryStr = '';
    if (data.startsWith('data:')) {
      const parts = data.split(',');
      binaryStr = atob(parts[1] || '');
    } else {
      try {
        binaryStr = atob(data.trim());
      } catch {
        binaryStr = data;
      }
    }
    try {
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return ensureMp3WithId3(bytes);
    } catch (e) {
      console.warn("Failed to decode audio binary string", e);
      return null;
    }
  }
  return null;
};

const WatermarkOverlay: React.FC<{
  watermark: string;
  settings: any;
}> = ({ watermark, settings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    if (!settings.isAnimated || !containerRef.current || !imgRef.current) return;
    
    let animationFrameId: number;
    let startTime: number | null = null;
    
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      // Approximate frame based on 30fps
      const frame = Math.floor((elapsed / 1000) * 30);
      
      const container = containerRef.current;
      if (!container) return;
      
      const wmSize = Math.min(container.clientWidth, container.clientHeight) * (settings.size / 100);
      const speed = settings.animationSpeed || 5;
      const pxPerFrame = speed * 0.8;
      
      const maxX = Math.max(1, container.clientWidth - wmSize);
      const maxY = Math.max(1, container.clientHeight - wmSize);
      
      if (maxX > 0 && maxY > 0) {
        const distX = frame * pxPerFrame;
        const distY = frame * pxPerFrame * 0.75;
        
        const modX = distX % (maxX * 2);
        const modY = distY % (maxY * 2);
        
        const x = modX > maxX ? (maxX * 2) - modX : modX;
        const y = modY > maxY ? (maxY * 2) - modY : modY;
        
        if (imgRef.current) {
          imgRef.current.style.transform = `translate(${x}px, ${y}px)`;
          imgRef.current.style.width = `${wmSize}px`;
          imgRef.current.style.height = `${wmSize}px`;
        }
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [settings]);

  if (!watermark) return null;

  const staticStyle: React.CSSProperties = {
    opacity: settings.opacity,
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 50,
  };

  if (!settings.isAnimated) {
    staticStyle.width = `${settings.size}%`;
    staticStyle.height = `${settings.size}%`;
    staticStyle.objectFit = 'contain';
    
    if (settings.position === 'top-left') { staticStyle.top = '5%'; staticStyle.left = '5%'; }
    else if (settings.position === 'top-right') { staticStyle.top = '5%'; staticStyle.right = '5%'; }
    else if (settings.position === 'bottom-left') { staticStyle.bottom = '5%'; staticStyle.left = '5%'; }
    else if (settings.position === 'bottom-right') { staticStyle.bottom = '5%'; staticStyle.right = '5%'; }
    else if (settings.position === 'center') { 
      staticStyle.top = '50%'; staticStyle.left = '50%'; 
      staticStyle.transform = 'translate(-50%, -50%)';
    }
  } else {
    staticStyle.top = 0;
    staticStyle.left = 0;
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden">
      <img ref={imgRef} src={watermark} style={staticStyle} alt="watermark" />
    </div>
  );
};

const extractAudioData = (item: any): Uint8Array | null => {
  if (!item) return null;
  if (item.type !== 'svga') return null;
  const vi = item.videoItem;
  if (!vi) return null;

  // 1. Check audios array
  if (vi.audios && Array.isArray(vi.audios) && vi.audios.length > 0) {
    for (const a of vi.audios) {
      if (a && a.audioKey && vi.images && vi.images[a.audioKey]) {
        const bytes = decodeDataToBytes(vi.images[a.audioKey]);
        if (bytes && bytes.length > 0) return bytes;
      }
    }
  }

  // 2. Check images dictionary for audio keys
  if (vi.images && typeof vi.images === 'object') {
    for (const key of Object.keys(vi.images)) {
      const lower = key.toLowerCase();
      if (
        lower.endsWith('.mp3') ||
        lower.endsWith('.wav') ||
        lower.endsWith('.ogg') ||
        lower.endsWith('.m4a') ||
        lower.endsWith('.aac') ||
        lower.includes('audio') ||
        lower.includes('sound') ||
        lower.includes('bgm') ||
        lower.includes('music')
      ) {
        const bytes = decodeDataToBytes(vi.images[key]);
        if (bytes && bytes.length > 0) return bytes;
      }
    }
  }

  return null;
};

declare var SVGA: any;

export interface MultiSvgaItem {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
  dimensions?: { width: number; height: number };
  fps?: number;
  frames?: number;
  duration?: number;
  videoItem?: any;
  pagFile?: any;
  vapConfig?: any;
  hasAudio?: boolean;
  type: "svga" | "pag" | "vap";
  presetId: string;
  folderName?: string;
  folderPath?: string;
  opacity?: number;
  scale?: number;
  posX?: number;
  posY?: number;
  avatarWidth?: number;
  avatarHeight?: number;
  lockAvatarAspect?: boolean;
  avatarImgUrl?: string;
}

interface MultiSvgaViewerProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  onSubscriptionRequired?: () => void;
  initialFiles?: File[];
}

interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}

const DEVICE_PRESETS: DevicePreset[] = [
  // Standard Series
  { id: 'ip8', name: '750 × 1334 (iPhone 8)', width: 750, height: 1334, category: 'Standard' },
  { id: 'sq500', name: '500 × 500 (Square)', width: 500, height: 500, category: 'Standard' },
  
  // iPhone Series
  { id: 'ip15pm', name: 'iPhone 15 Max', width: 1290, height: 2796, category: 'iPhone' },
  { id: 'ip15p', name: 'iPhone 15 pro', width: 1179, height: 2556, category: 'iPhone' },
  { id: 'ip13', name: 'iPhone 13', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip12pm', name: 'iPhone 12 Max', width: 1284, height: 2778, category: 'iPhone' },
  { id: 'ip12p', name: 'iPhone 12 pro', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip12', name: 'iPhone 12', width: 1170, height: 2532, category: 'iPhone' },
  { id: 'ip11', name: 'iPhone 11', width: 828, height: 1792, category: 'iPhone' },
  { id: 'ipx', name: 'iPhone X', width: 1125, height: 2436, category: 'iPhone' },
  { id: 's10', name: '三星 S10', width: 1440, height: 3040, category: 'iPhone' },
  { id: 's20', name: '三星 S20', width: 1440, height: 3200, category: 'iPhone' },
  { id: 'mate40p', name: '华为Mate40 pro', width: 1344, height: 2772, category: 'iPhone' },
  { id: 'p40p', name: '华为 P40 pro', width: 1200, height: 2640, category: 'iPhone' },
  
  // Android Series
  { id: 'mate60p', name: 'Mate 60 Pro', width: 1260, height: 2720, category: 'Android' },
  { id: 'p70', name: '华为 P70', width: 1256, height: 2760, category: 'Android' },
  { id: 'mi14', name: '小米14', width: 1200, height: 2670, category: 'Android' },
  { id: 'mi14u', name: 'Xiaomi 14 Ultra', width: 1440, height: 3200, category: 'Android' },
  { id: 's21u', name: 'Galaxy S21 Ultra', width: 1440, height: 3200, category: 'Android' },
  { id: 'oppor17', name: 'OPPO R17', width: 1080, height: 2340, category: 'Android' },
  { id: 'mi10', name: '小米10', width: 1080, height: 2340, category: 'Android' },
  { id: 'mi6', name: '小米6', width: 1080, height: 1920, category: 'Android' },
  { id: 'vivonex3s', name: 'VIVO NEX 3S', width: 1080, height: 2256, category: 'Android' },
  { id: 'vivox50', name: 'VIVO X50', width: 1080, height: 2376, category: 'Android' },
  { id: 'oneplus8t', name: '一加8T', width: 1080, height: 2400, category: 'Android' },

  // Tablet Series
  { id: 'ipadair', name: 'ipad air', width: 1640, height: 2360, category: 'Tablet' },
  { id: 'ipadpro', name: 'ipad pro', width: 2048, height: 2732, category: 'Tablet' },
  { id: 'matepadpro', name: 'MatePad Pro', width: 1600, height: 2560, category: 'Tablet' },
  { id: 'tabs7', name: 'Galaxy Tab S7', width: 1600, height: 2560, category: 'Tablet' },

  // PC Series
  { id: 'pc800', name: '800*600', width: 800, height: 600, category: 'PC' },
  { id: 'pc1280', name: '1280*800', width: 1280, height: 800, category: 'PC' },
  { id: 'pc1920', name: '1920*1080', width: 1920, height: 1080, category: 'PC' },
  { id: 'pc27', name: '27寸', width: 2560, height: 1440, category: 'PC' },
  { id: 'custom750x240', name: '750 × 240', width: 750, height: 240, category: 'Standard' },
];

import { useAccessControl } from '../hooks/useAccessControl';
import { logActivity } from '../utils/logger';

const EmbeddedAudioPlayer: React.FC<{ item: any }> = ({ item }) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let url: string | null = null;
    let isCanceled = false;

    const loadAudio = async () => {
      let data = extractAudioData(item);
      
      if (!data && item.type === 'svga') {
         // Wait for videoItem to be populated by SvgaPlayer
         // Or parse it ourselves
         if (!item.videoItem) {
            try {
              const parser = new SVGA.Parser();
              const vi = await new Promise<any>((resolve, reject) => {
                 parser.load(item.url, (videoItem: any) => resolve(videoItem), reject);
              });
              item.videoItem = vi;
              data = extractAudioData(item);
            } catch (e) {
              console.error("Failed to parse SVGA for audio", e);
            }
         }
      }

      if (isCanceled) return;
      
      if (data) {
        const blob = new Blob([data], { type: 'audio/mpeg' });
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    };

    loadAudio();
    
    return () => {
      isCanceled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  if (!audioUrl) return null;

  return (
    <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-xl border border-white/10">
      <div className="text-xs text-slate-400 font-bold uppercase">الصوت المدمج</div>
      <audio ref={audioRef} src={audioUrl} autoPlay controls className="h-10 w-48" />
    </div>
  );
};

export const MultiSvgaViewer: React.FC<MultiSvgaViewerProps> = ({ onCancel, currentUser, onSubscriptionRequired, initialFiles = [] }) => {
  const { checkAccess } = useAccessControl();
  const [items, setItems] = useState<MultiSvgaItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm' | 'vap' | 'yyeva'>('mp4');
  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [loadProgress, setLoadProgress] = useState<{current: number, total: number} | null>(null);
  const isCanceled = useRef(false);
  const [useNativeDuration, setUseNativeDuration] = useState(true);
  const [exportDuration, setExportDuration] = useState(10);
  const [gridCols, setGridCols] = useState(3);
  const [forceMobileSize, setForceMobileSize] = useState(false);
  const initialFilesLoadedRef = useRef(false);
  const [exportResolution, setExportResolution] = useState<'natural' | '720p' | '1080p'>('natural');
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('auto');
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [isCustomDimensionsActive, setIsCustomDimensionsActive] = useState<boolean>(false);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'fill' | 'native'>('contain');
  const [includePdfCatalog, setIncludePdfCatalog] = useState(false);
  const [isPdfAllInOneExporting, setIsPdfAllInOneExporting] = useState(false);
  const [pdfAllInOneProgress, setPdfAllInOneProgress] = useState(0);
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const preventDuplicatesRef = useRef(true);
  useEffect(() => {
    preventDuplicatesRef.current = preventDuplicates;
  }, [preventDuplicates]);
  const [dedupNotice, setDedupNotice] = useState<{ count: number; names: string[] } | null>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(true);
  const [showSideDock, setShowSideDock] = useState(false);
  
  const selectedPreset = useMemo(() => DEVICE_PRESETS.find(p => p.id === selectedPresetId), [selectedPresetId]);

  const [vapBatchProgress, setVapBatchProgress] = useState<{
    isOpen: boolean;
    total: number;
    completed: number;
    currentFileName: string;
    currentFileIndex: number;
    overallPercent: number;
    currentPercent: number;
    statusMessage: string;
    fileStatuses: { id: string; name: string; status: 'pending' | 'processing' | 'done' | 'error'; errorMsg?: string }[];
  } | null>(null);

  const [wmSettings, setWmSettings] = useState({
    position: 'bottom-right' as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center',
    size: 15,
    opacity: 0.5,
    isAnimated: false,
    animationSpeed: 5
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isFfmpegLoaded, setIsFfmpegLoaded] = useState(false);

  const ensureFFmpeg = async (): Promise<FFmpeg | null> => {
    if (ffmpegRef.current && ffmpegRef.current.loaded) {
      return ffmpegRef.current;
    }
    const ffmpeg = ffmpegRef.current || new FFmpeg();
    ffmpegRef.current = ffmpeg;
    try {
      await loadFFmpegWithFallbacks(ffmpeg);
      setIsFfmpegLoaded(true);
      return ffmpeg;
    } catch (err) {
      console.error("Failed to load FFmpeg on demand:", err);
      return null;
    }
  };

  useEffect(() => {
    const initFfmpeg = async () => {
      const ffmpeg = new FFmpeg();
      try {
        await loadFFmpegWithFallbacks(ffmpeg);
        ffmpegRef.current = ffmpeg;
        setIsFfmpegLoaded(true);
      } catch (err) {
        console.error("Failed to load FFmpeg", err);
      }
    };
    initFfmpeg();
  }, []);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'presetBackgrounds'));
        const presets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresetBackground));
        setPresetBgs(presets);
      } catch (error) {
        console.error("Error fetching presets:", error);
      }
    };
    fetchPresets();
  }, []);

  useEffect(() => {
    // Mute Howler globally so SVGA animations in the grid do not auto-play audio
    if (typeof window !== 'undefined' && (window as any).Howler) {
      (window as any).Howler.mute(true);
    }
    return () => { 
      isCanceled.current = true; 
      if (typeof window !== 'undefined' && (window as any).Howler) {
        (window as any).Howler.mute(false);
      }
    };
  }, []);

  const [pdfPasswordRequest, setPdfPasswordRequest] = useState<PdfUnlockRequest | null>(null);
  const [pdfInputPassword, setPdfInputPassword] = useState('');
  const [pdfPasswordError, setPdfPasswordError] = useState(false);
  const [pdfStatusMessage, setPdfStatusMessage] = useState<string | null>(null);

  const handleUnlockPdf = async () => {
    if (!pdfPasswordRequest) return;
    const success = await pdfPasswordRequest.submitPassword(pdfInputPassword);
    if (!success) {
      setPdfPasswordError(true);
    } else {
      setPdfPasswordRequest(null);
      setPdfInputPassword('');
      setPdfPasswordError(false);
    }
  };

  const handleSkipPdfPassword = () => {
    if (pdfPasswordRequest) {
      pdfPasswordRequest.skip();
      setPdfPasswordRequest(null);
      setPdfInputPassword('');
      setPdfPasswordError(false);
    }
  };

  const handleFiles = useCallback(async (fileObjects: {file: File, folderName?: string, folderPath?: string}[]) => {
    if (!fileObjects || fileObjects.length === 0) return;

    // Expand any ZIP and PDF files
    const expandedList: {file: File, folderName?: string, folderPath?: string}[] = [];

    for (const item of fileObjects) {
      if (!item?.file) continue;
      const lowerName = (item.file.name || '').toLowerCase();
      if (lowerName.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(item.file);
          const entries = Object.keys(zip.files);
          for (const filename of entries) {
            const entry = zip.files[filename];
            if (!entry.dir) {
              const innerLower = filename.toLowerCase();
              if (
                filename.includes('__MACOSX') ||
                filename.startsWith('.') ||
                filename.includes('/.')
              ) {
                continue;
              }
              if (
                innerLower.endsWith('.svga') ||
                innerLower.endsWith('.pag') ||
                innerLower.endsWith('.vap') ||
                innerLower.endsWith('.mp4')
              ) {
                try {
                  const blob = await entry.async('blob');
                  const cleanName = filename.split('/').pop() || filename;
                  if (cleanName.startsWith('._') || cleanName.startsWith('.')) continue;
                  const pathParts = filename.split('/').filter(Boolean);
                  const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : item.folderPath;
                  const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : (item.folderName || '');
                  const extractedFile = new File([blob], cleanName, { type: blob.type || 'application/octet-stream' });
                  expandedList.push({ file: extractedFile, folderName, folderPath });
                } catch (zipErr) {
                  console.warn("Could not extract entry from zip:", filename, zipErr);
                }
              } else if (innerLower.endsWith('.pdf')) {
                try {
                  const blob = await entry.async('blob');
                  const cleanName = filename.split('/').pop() || filename;
                  const tempPdf = new File([blob], cleanName, { type: 'application/pdf' });
                  setPdfStatusMessage(`جاري فحص واستخراج ملفات SVGA من PDF داخل الأرشيف: ${cleanName}...`);
                  const pdfExtracted = await extractSvgaFromPdfFile(tempPdf, {
                    folderName: item.folderName,
                    folderPath: item.folderPath,
                    onPasswordRequired: (req) => setPdfPasswordRequest(req),
                    onProgress: (status) => setPdfStatusMessage(status)
                  });
                  setPdfStatusMessage(null);
                  for (const pRes of pdfExtracted) {
                    expandedList.push({
                      file: pRes.file,
                      folderName: pRes.folderName || item.folderName,
                      folderPath: pRes.folderPath || item.folderPath
                    });
                  }
                } catch (innerPdfErr) {
                  console.warn("Could not extract nested PDF in zip:", filename, innerPdfErr);
                  setPdfStatusMessage(null);
                }
              }
            }
          }
        } catch (e) {
          console.warn("Could not extract ZIP file:", item.file.name, e);
        }
      } else if (lowerName.endsWith('.pdf')) {
        // Direct PDF file (locked or normal or disguised)
        try {
          setPdfStatusMessage(`جاري فحص واستخراج ملفات SVGA من: ${item.file.name}...`);
          const pdfExtracted = await extractSvgaFromPdfFile(item.file, {
            folderName: item.folderName,
            folderPath: item.folderPath,
            onPasswordRequired: (req) => setPdfPasswordRequest(req),
            onProgress: (status) => setPdfStatusMessage(status)
          });
          setPdfStatusMessage(null);
          if (pdfExtracted.length > 0) {
            for (const pRes of pdfExtracted) {
              expandedList.push({
                file: pRes.file,
                folderName: pRes.folderName || item.folderName,
                folderPath: pRes.folderPath || item.folderPath
              });
            }
          }
        } catch (pdfErr) {
          console.warn("Could not extract SVGA from PDF:", item.file.name, pdfErr);
          setPdfStatusMessage(null);
        }
      } else {
        const name = item.file.name || '';
        if (!name.startsWith('._') && !name.startsWith('.') && !item.folderPath?.includes('__MACOSX')) {
          expandedList.push(item);
        }
      }
    }

    const fileArray = expandedList.filter(f => {
      if (!f?.file?.name) return false;
      const name = (f.file.name || '').toLowerCase();
      if (name.startsWith('._') || name.startsWith('.')) return false;
      return name.endsWith('.svga') || name.endsWith('.pag') || name.endsWith('.vap') || name.endsWith('.mp4');
    });
    if (fileArray.length === 0) return;
    
    let loadedCount = 0;
    setLoadProgress({ current: 0, total: fileArray.length });
    isCanceled.current = false;
    
    const BATCH_SIZE = 25;
    for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
      if (isCanceled.current) break;
      const batch = fileArray.slice(i, i + BATCH_SIZE);
      const newItems: MultiSvgaItem[] = (await Promise.all(batch.map(async (item) => {
        try {
          const lowerName = item.file.name.toLowerCase();
          const isPag = lowerName.endsWith('.pag');
          const isVap = lowerName.endsWith('.vap') || lowerName.endsWith('.mp4');
          const itemType: 'svga' | 'pag' | 'vap' = isPag ? 'pag' : (isVap ? 'vap' : 'svga');
          let normalizedFile = item.file;
          if (itemType === 'svga') {
            normalizedFile = await normalizeSvgaFile(item.file);
          }
          const url = URL.createObjectURL(normalizedFile);
          
          let vapConfig: any = null;
          let dimensions: { width: number; height: number } | undefined = undefined;
          let fps: number | undefined = undefined;
          let frames: number | undefined = undefined;
          let duration: number | undefined = undefined;

          if (itemType === 'svga') {
            try {
              const parser = new SVGA.Parser();
              await new Promise<void>((res) => {
                const tid = setTimeout(() => res(), 1000);
                parser.load(url, (videoItem: any) => {
                  clearTimeout(tid);
                  if (videoItem) {
                    fps = videoItem.FPS || videoItem.fps || 30;
                    frames = videoItem.frames || 1;
                    duration = frames / fps;
                    if (videoItem.videoSize) {
                      dimensions = {
                        width: videoItem.videoSize.width || 500,
                        height: videoItem.videoSize.height || 500
                      };
                    }
                  }
                  res();
                }, () => {
                  clearTimeout(tid);
                  res();
                });
              });
            } catch (e) {
              console.warn("SVGA metadata extraction error in handleFiles", e);
            }
          } else if (itemType === 'pag') {
            try {
              const PAG = await getPAG();
              const pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
              if (pagFile) {
                const dur = (pagFile.duration() / 1000000) || 1;
                const pfps = pagFile.frameRate() || 30;
                fps = pfps;
                duration = dur;
                frames = Math.max(1, Math.round(dur * pfps));
                dimensions = { width: pagFile.width() || 500, height: pagFile.height() || 500 };
              }
            } catch (e) {
              console.warn("PAG metadata extraction error in handleFiles", e);
            }
          } else if (itemType === 'vap') {
            try {
              vapConfig = await extractVapConfigFromBlob(item.file);
              if (vapConfig?.info) {
                const w = vapConfig.info.rgbFrame ? vapConfig.info.rgbFrame[2] : (vapConfig.info.w || 750);
                const h = vapConfig.info.rgbFrame ? vapConfig.info.rgbFrame[3] : (vapConfig.info.h || 1334);
                const f = vapConfig.info.f || 24;
                dimensions = { width: w, height: h };
                fps = f;
              }
            } catch (e) {
              console.warn("VAP config extraction failed in handleFiles", e);
            }

            try {
              const tempVid = document.createElement('video');
              tempVid.preload = 'metadata';
              tempVid.src = url;
              await new Promise<void>((res) => {
                tempVid.onloadedmetadata = () => res();
                tempVid.onerror = () => res();
                setTimeout(res, 800);
              });
              duration = tempVid.duration || 3;
              if (!dimensions && tempVid.videoWidth > 0) {
                const vw = tempVid.videoWidth;
                const vh = tempVid.videoHeight;
                dimensions = { width: Math.round(vw / 2), height: vh };
              }
              if (!fps) fps = 24;
              frames = Math.floor(duration * fps);
            } catch (e) {
              console.warn("Video metadata extraction failed", e);
            }
          }

          const resultItem = {
            id: Math.random().toString(36).substr(2, 9),
            file: item.file,
            url,
            name: item.file.name,
            size: item.file.size,
            type: itemType,
            presetId: 'auto',
            folderName: item.folderName,
            folderPath: item.folderPath,
            vapConfig,
            dimensions,
            fps,
            frames,
            duration
          } as MultiSvgaItem;

          loadedCount++;
          setLoadProgress({ current: loadedCount, total: fileArray.length });
          return resultItem;
        } catch (err) {
          console.error("Error processing item in batch:", item.file?.name, err);
          loadedCount++;
          setLoadProgress({ current: loadedCount, total: fileArray.length });
          return null;
        }
      }))).filter(Boolean) as MultiSvgaItem[];
      
      setItems(prev => {
        if (!preventDuplicatesRef.current) {
          return [...prev, ...newItems];
        }
        const existingKeys = new Set(prev.map(p => `${p.name.toLowerCase().trim()}_${p.size}`));
        const filteredNew: MultiSvgaItem[] = [];
        const skippedNames: string[] = [];

        for (const ni of newItems) {
          const key = `${ni.name.toLowerCase().trim()}_${ni.size}`;
          if (existingKeys.has(key)) {
            skippedNames.push(ni.name);
            try { URL.revokeObjectURL(ni.url); } catch (_) {}
          } else {
            existingKeys.add(key);
            filteredNew.push(ni);
          }
        }

        if (skippedNames.length > 0) {
          setDedupNotice({
            count: skippedNames.length,
            names: Array.from(new Set(skippedNames))
          });
        }

        return [...prev, ...filteredNew];
      });
      await new Promise(r => setTimeout(r, 10));
    }
    setLoadProgress(null);
  }, []);

  // Auto load initialFiles passed from Batch SVGA Uploader
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && !initialFilesLoadedRef.current) {
      initialFilesLoadedRef.current = true;
      handleFiles(initialFiles.map(file => ({ file })));
    }
  }, [initialFiles, handleFiles]);

  const traverseFileTree = async (item: any, path: string = '', folderName: string = ''): Promise<{file: File, folderName?: string, folderPath?: string}[]> => {
    return new Promise((resolve) => {
      try {
        if (!item) return resolve([]);
        if (item.isFile) {
          item.file((file: File) => {
            resolve([{ file, folderName, folderPath: path }]);
          }, (err: any) => {
            console.warn("Error reading file entry:", err);
            resolve([]);
          });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          dirReader.readEntries(async (entries: any[]) => {
            try {
              const promises = entries.map(entry => traverseFileTree(entry, path + item.name + '/', folderName || item.name));
              const results = await Promise.all(promises);
              resolve(results.flat());
            } catch (dirErr) {
              console.warn("Error traversing subfolder:", dirErr);
              resolve([]);
            }
          }, (err: any) => {
            console.warn("Error reading directory:", err);
            resolve([]);
          });
        } else {
          resolve([]);
        }
      } catch (e) {
        console.warn("traverseFileTree exception:", e);
        resolve([]);
      }
    });
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      const promises = (items as any[]).map(item => {
        const entry = (item as any).webkitGetAsEntry();
        if (entry) {
          return traverseFileTree(entry);
        }
        return Promise.resolve([]);
      });
      const results = await Promise.all(promises);
      const allFiles = results.flat();
      if (allFiles.length > 0) {
        handleFiles(allFiles);
      }
    } else if (e.dataTransfer.files) {
      const fileObjects = Array.from(e.dataTransfer.files).map(file => ({ file }));
      handleFiles(fileObjects);
    }
  }, [handleFiles]);

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter(i => i.id !== id);
    });
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === items.length && items.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map(i => i.id)));
    }
  };

  const clearAll = () => {
    items.forEach(item => URL.revokeObjectURL(item.url));
    setItems([]);
    setSelectedItemIds(new Set());
  };

  const handleUploadFolders = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.onchange = (e: any) => {
      if (e.target.files) {
        const fileObjects = Array.from(e.target.files as FileList).map(file => ({
          file,
          folderPath: file.webkitRelativePath.split('/').slice(0, -1).join('/'),
          folderName: file.webkitRelativePath.split('/').slice(-2, -1)[0]
        }));
        handleFiles(fileObjects);
      }
    };
    input.click();
  }, [handleFiles]);

  const handleExtractFromPdf = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.PDF,application/pdf,*/*';
    input.onchange = (e: any) => {
      if (e.target.files) {
        const fileObjects = Array.from(e.target.files as FileList).map(file => ({ file }));
        handleFiles(fileObjects);
      }
    };
    input.click();
  }, [handleFiles]);

  const getActiveItems = () => {
    const rawList = selectedItemIds.size > 0 ? items.filter(i => selectedItemIds.has(i.id)) : items;
    if (!preventDuplicates) return rawList;
    const seen = new Set<string>();
    const uniqueList: MultiSvgaItem[] = [];
    for (const item of rawList) {
      const key = `${item.name.toLowerCase().trim()}_${item.size}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(item);
      }
    }
    return uniqueList;
  };

  const runDeduplication = useCallback(() => {
    setItems(prev => {
      const seen = new Set<string>();
      const uniqueList: MultiSvgaItem[] = [];
      const removedNames: string[] = [];

      for (const item of prev) {
        const key = `${item.name.toLowerCase().trim()}_${item.size}`;
        if (seen.has(key)) {
          removedNames.push(item.name);
          try { URL.revokeObjectURL(item.url); } catch (_) {}
        } else {
          seen.add(key);
          uniqueList.push(item);
        }
      }

      if (removedNames.length > 0) {
        setSelectedItemIds(sel => {
          const nextSel = new Set<string>();
          uniqueList.forEach(u => {
            if (sel.has(u.id)) nextSel.add(u.id);
          });
          return nextSel;
        });
        setDedupNotice({
          count: removedNames.length,
          names: Array.from(new Set(removedNames))
        });
      } else {
        setDedupNotice({
          count: 0,
          names: []
        });
      }

      return uniqueList;
    });
  }, []);

  const handleToggleDeduplication = useCallback(() => {
    setPreventDuplicates(prev => {
      const next = !prev;
      if (next) {
        runDeduplication();
      } else {
        setDedupNotice(null);
      }
      return next;
    });
  }, [runDeduplication]);

  const handleExportGrid = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const { allowed } = await checkAccess("Multi SVGA Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    if (currentUser) {
      logActivity(currentUser, "export", `Multi SVGA Grid Export: ${activeItems.length} files`);
    }

    const renderContainer = document.createElement("div");
    renderContainer.style.position = "fixed";
    renderContainer.style.left = "-10000px";
    renderContainer.style.top = "0";
    renderContainer.style.width = "1920px";
    renderContainer.style.height = "1080px";
    renderContainer.style.overflow = "hidden";
    renderContainer.style.zIndex = "-1000";
    renderContainer.style.pointerEvents = "none";
    document.body.appendChild(renderContainer);

    try {
      const targetFps = 30;
      let canvasWidth: number;
      let canvasHeight: number;
      let cols: number;
      let rows: number;

      if (activeItems.length === 1) {
        const item = activeItems[0];
        canvasWidth = DEVICE_PRESETS.find(p => p.id === item.presetId)?.width || item.dimensions?.width || 500;
        canvasHeight = DEVICE_PRESETS.find(p => p.id === item.presetId)?.height || item.dimensions?.height || 500;
        cols = 1;
        rows = 1;
      } else {
        canvasWidth = exportResolution === "1080p" ? 1920 : (exportResolution === "720p" ? 1280 : 1080);
        canvasHeight = exportResolution === "1080p" ? 1080 : (exportResolution === "720p" ? 720 : 1080);
        if (forceMobileSize) {
          canvasWidth = exportResolution === "1080p" ? 1080 : 720;
          canvasHeight = exportResolution === "1080p" ? 1920 : 1280;
        }
        cols = Math.ceil(Math.sqrt(activeItems.length));
        rows = Math.ceil(activeItems.length / cols);
      }

      const padding = activeItems.length === 1 ? 0 : 20;
      const availableWidth = canvasWidth - (padding * (cols + 1));
      const availableHeight = canvasHeight - (padding * (rows + 1));
      const cardW = availableWidth / cols;
      const cardH = availableHeight / rows;

      const finalWidth = Math.round(canvasWidth / 2) * 2;
      const finalHeight = Math.round(canvasHeight / 2) * 2;

      if (activeItems.length === 1 && activeItems[0].type === "vap") {
        const item = activeItems[0];
        const result = await convertVapToMp4({
          file: item.file,
          url: item.url,
          vapConfig: item.vapConfig,
          targetWidth: finalWidth,
          targetHeight: finalHeight,
          exportResolution,
          exportQuality,
          exportDuration: useNativeDuration ? undefined : exportDuration,
          previewBg,
          watermark,
          wmSettings,
          onProgress: (p) => setExportProgress(p)
        });
        const cleanName = item.name.replace(/\.[^/.]+$/, "");
        const blob = new Blob([result.buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanName}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(renderContainer);
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

      // Pre-parse all active items so their true durations, fps, and frame counts are guaranteed
      for (const item of activeItems) {
        try {
          if (item.type === "vap") {
            if (!item.vapConfig) {
              try { item.vapConfig = await extractVapConfigFromBlob(item.file); } catch (e) {}
            }
          } else if (item.type === "pag") {
            const PAG = await getPAG();
            if (!item.pagFile) {
              item.pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
            }
            if (item.pagFile) {
              const pagDur = (item.pagFile.duration() / 1000000) || 1;
              const pagFps = item.pagFile.frameRate() || 30;
              item.fps = pagFps;
              item.duration = pagDur;
              item.frames = Math.max(1, Math.round(pagDur * pagFps));
              item.dimensions = { width: item.pagFile.width() || 500, height: item.pagFile.height() || 500 };
            }
          } else {
            await parseSvgaIfNeeded(item);
          }
        } catch (err) {
          console.warn("Pre-parse error for item in grid export:", item.name, err);
        }
      }

      let maxFrames = 0;
      activeItems.forEach(item => {
        const frames = item.frames || 1;
        const fps = item.fps || 30;
        let duration = item.duration || (frames / fps);
        maxFrames = Math.max(maxFrames, duration * targetFps);
      });
      const totalFrames = (!useNativeDuration && exportDuration && exportDuration > 0)
        ? Math.max(1, Math.round(exportDuration * targetFps))
        : Math.max(1, Math.round(maxFrames));

      let bgImg: HTMLImageElement | null = null;
      if (previewBg) {
        bgImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.src = previewBg;
        });
      }

      let wmImg: HTMLImageElement | null = null;
      if (watermark) {
        wmImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.src = watermark;
        });
      }

      const isWebM = exportFormat === 'webm';
      const durationSec = totalFrames / targetFps;
      let audiosToMux: ExtractedAudioTrack[] = [];
      const offscreenPlayers = [];
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const w = activeItems.length === 1 ? (DEVICE_PRESETS.find(p => p.id === item.presetId)?.width || item.dimensions?.width || 500) : cardW;
        const h = activeItems.length === 1 ? (DEVICE_PRESETS.find(p => p.id === item.presetId)?.height || item.dimensions?.height || 500) : cardH;
        
        const div = document.createElement("div");
        div.style.width = w + "px";
        div.style.height = h + "px";
        div.style.position = "absolute";
        div.style.left = "0";
        div.style.top = "0";
        renderContainer.appendChild(div);

        let player, internalCanvas;
        try {
          if (item.type === "vap") {
            let vapConfig = item.vapConfig;
            if (!vapConfig) {
              try { vapConfig = await extractVapConfigFromBlob(item.file); item.vapConfig = vapConfig; } catch (e) {}
            }
            const vid = document.createElement("video");
            vid.crossOrigin = "anonymous";
            vid.muted = true;
            vid.src = item.url;
            await new Promise<void>((res) => {
              vid.onloadeddata = () => res();
              setTimeout(res, 800);
            });
            const vw = vid.videoWidth || 750;
            const vh = vid.videoHeight || 1334;
            let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
            let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
            if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
              rgbRect = [0, 0, vw, Math.round(vh / 2)];
              alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
            }
            let cfgW = rgbRect[2];
            let cfgH = rgbRect[3];
            const renderer = new WebGLVapRenderer(cfgW, cfgH);
            internalCanvas = renderer.canvas;
            player = { vid, renderer, rgbRect, alphaRect, cfgW, cfgH, duration: vid.duration || 3 };
          } else if (item.type === "pag") {
            const PAG = await getPAG();
            let pagFile = item.pagFile;
            if (!pagFile) {
              pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
              item.pagFile = pagFile;
            }
            internalCanvas = document.createElement("canvas");
            const canvasId = "pag_export_" + Math.random().toString(36).substring(2, 9);
            internalCanvas.id = canvasId;
            internalCanvas.width = item.dimensions?.width || 500;
            internalCanvas.height = item.dimensions?.height || 500;
            internalCanvas.style.width = "100%";
            internalCanvas.style.height = "100%";
            internalCanvas.style.objectFit = "contain";
            div.appendChild(internalCanvas);
            
            player = await PAG.PAGPlayer.create();
            player.setComposition(pagFile);
            const pagSurface = PAG.PAGSurface.fromCanvas('#' + canvasId);
            if (pagSurface) {
              pagSurface.updateSize();
              player.setSurface(pagSurface);
            }
            player.setVideoEnabled(true);
            player.setProgress(0);
            await player.flush();
          } else {
            const videoItem = await parseSvgaIfNeeded(item);
            try {
              const audioData = await extractAllSvgaAudioTracks(videoItem);
              if (audioData.length > 0) {
                audiosToMux.push(...audioData);
              }
            } catch (e) {}
            player = new SVGA.Player(div);
            player.setVideoItem(videoItem);
            player.setContentMode(DEVICE_PRESETS.find(p => p.id === item.presetId) ? 'AspectFill' : 'AspectFit');
            internalCanvas = div.querySelector("canvas");
          }
          
          offscreenPlayers.push({ player, div, item, cardW, cardH, internalCanvas });
        } catch (e) {
          console.warn("Skipping item due to load error in grid export:", e);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      for (let i = 0; i < offscreenPlayers.length; i++) {
        const { player, item } = offscreenPlayers[i];
        if (item.type === "vap") {
          // Ready
        } else if (item.type === "pag") {
          player.setProgress(0);
          await player.flush();
        } else {
          player.stepToFrame(0, false);
        }
      }

      // Mix audio tracks if present
      let mixedAudioBuffer: AudioBuffer | null = null;
      let hasNativeAudioTrack = false;
      if (audiosToMux.length > 0) {
        setExportProgress(4);
        try {
          mixedAudioBuffer = await mixAudioTracksToBuffer(audiosToMux, {
            durationSec,
            fps: targetFps,
            loopShorterAudio: true,
          });
          // @ts-ignore
          if (mixedAudioBuffer && typeof AudioEncoder !== 'undefined') {
            const codec = isWebM ? 'opus' : 'mp4a.40.2';
            // @ts-ignore
            const check = await AudioEncoder.isConfigSupported({
              codec,
              numberOfChannels: 2,
              sampleRate: mixedAudioBuffer.sampleRate,
              bitrate: 128000
            });
            if (check.supported) {
              hasNativeAudioTrack = true;
            }
          }
        } catch (audioErr) {
          console.warn("[SVGA Export] Audio mixing notice:", audioErr);
        }
      }

      const muxer = isWebM 
        ? new WebMMuxer({
            target: new WebmArrayBufferTarget(),
            video: { codec: 'V_VP9', width: finalWidth, height: finalHeight },
            audio: hasNativeAudioTrack && mixedAudioBuffer ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: mixedAudioBuffer.sampleRate } : undefined
          })
        : new Mp4Muxer({
            target: new Mp4ArrayBufferTarget(),
            video: { codec: "avc", width: finalWidth, height: finalHeight },
            audio: hasNativeAudioTrack && mixedAudioBuffer ? { codec: 'aac', numberOfChannels: 2, sampleRate: mixedAudioBuffer.sampleRate } : undefined,
            fastStart: "in-memory"
          });

      let hasEncoderError = false;
      const videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => {
          let safeMetadata: any = undefined;
          if (metadata) {
            safeMetadata = { ...metadata };
            if (safeMetadata.decoderConfig) {
              safeMetadata.decoderConfig = { ...safeMetadata.decoderConfig };
              if (safeMetadata.decoderConfig.colorSpace === null) {
                delete safeMetadata.decoderConfig.colorSpace;
              }
            } else if (safeMetadata.decoderConfig === null) {
              delete safeMetadata.decoderConfig;
            }
          }
          muxer.addVideoChunk(chunk, safeMetadata);
        },
        error: (e) => {
          console.error("Encoder Error:", e);
          hasEncoderError = true;
          if (videoEncoder.state !== "closed") alert("خطأ في ترميز الفيديو: " + e.message);
        }
      });

      if (hasNativeAudioTrack && mixedAudioBuffer) {
        await encodeAudioBufferToMuxer(mixedAudioBuffer, muxer, isWebM);
      }

      try {
        const totalPixels = finalWidth * finalHeight;
        const gridBitrate = exportQuality === 'high'
          ? Math.max(14_000_000, Math.round(totalPixels * 4.5))
          : exportQuality === 'medium'
          ? Math.max(6_000_000, Math.round(totalPixels * 2))
          : Math.max(2_500_000, Math.round(totalPixels * 1));

        videoEncoder.configure({
          codec: exportFormat === 'webm' ? "vp09.00.10.08" : "avc1.4D002A",
          width: finalWidth,
          height: finalHeight,
          bitrate: gridBitrate,
          framerate: targetFps
        });
      } catch (e) {
        console.error("Encoder Configuration Error:", e);
        alert("خطأ في إعدادات ترميز الفيديو: " + (e instanceof Error ? e.message : String(e)));
        document.body.removeChild(renderContainer);
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      for (let frame = 0; frame < totalFrames; frame++) {
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (let index = 0; index < offscreenPlayers.length; index++) {
          const { player, item, cardW, cardH, internalCanvas } = offscreenPlayers[index];
          let x, y;
          if (activeItems.length === 1) {
            x = 0;
            y = 0;
          } else {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const scaleX = canvas.width / canvasWidth;
            const scaleY = canvas.height / canvasHeight;
            x = (padding + col * (cardW + padding)) * scaleX;
            y = (padding + row * (cardH + padding)) * scaleY;
            const scaledCardW = cardW * scaleX;
            const scaledCardH = cardH * scaleY;
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x, y, scaledCardW, scaledCardH, 40 * Math.min(scaleX, scaleY));
            } else {
              ctx.rect(x, y, scaledCardW, scaledCardH);
            }
            ctx.fill();
          }

          const elapsedSeconds = frame / targetFps;
          if (item.type === "vap") {
            const vidDur = player.duration || 3;
            const targetTime = Math.min((elapsedSeconds % vidDur), Math.max(0, vidDur - 0.01));
            await seekVideoToFrame(player.vid, targetTime);
            player.renderer.render(player.vid, player.rgbRect, player.alphaRect, 10, true);
          } else if (item.type === "pag") {
            const durationSec = (item.pagFile?.duration() / 1000000) || 1;
            try {
              player.setProgress((elapsedSeconds % durationSec) / durationSec);
              await player.flush();
            } catch (e) { console.warn("PAG export frame error", e); }
          } else {
            const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);
            try {
              player.stepToFrame(itemFrame, false);
            } catch (e) { console.warn("SVGA export frame error", e); }
          }

          if (internalCanvas) {
            const sw = item.dimensions?.width || 500;
            const sh = item.dimensions?.height || 500;
            const scale = Math.min(cardW / sw, cardH / sh);
            const finalW = sw * scale;
            const finalH = sh * scale;
            const scaleX = canvas.width / canvasWidth;
            const scaleY = canvas.height / canvasHeight;
            const dx = (x + (cardW * scaleX - finalW * scaleX) / 2);
            const dy = (y + (cardH * scaleY - finalH * scaleY) / 2);
            
            ctx.save();
            ctx.beginPath();
            if (activeItems.length > 1) {
              if (ctx.roundRect) {
                ctx.roundRect(x, y, cardW * scaleX, cardH * scaleY, 40 * Math.min(scaleX, scaleY));
              } else {
                ctx.rect(x, y, cardW * scaleX, cardH * scaleY);
              }
            } else {
              ctx.rect(x, y, canvas.width, canvas.height);
            }
            ctx.clip();
            ctx.drawImage(internalCanvas, dx, dy, finalW * scaleX, finalH * scaleY);
            ctx.restore();
          }
        }

        if (wmImg) {
          const wmSize = Math.min(canvas.width, canvas.height) * (wmSettings.size / 100);
          let wx = 0, wy = 0;
          if (wmSettings.isAnimated) {
            const speed = wmSettings.animationSpeed || 5;
            const pxPerFrame = speed * 1.5;
            const maxX = Math.max(1, canvas.width - wmSize);
            const maxY = Math.max(1, canvas.height - wmSize);
            const distX = frame * pxPerFrame;
            const distY = frame * pxPerFrame * 0.75;
            const modX = distX % (maxX * 2);
            const modY = distY % (maxY * 2);
            wx = modX > maxX ? (maxX * 2) - modX : modX;
            wy = modY > maxY ? (maxY * 2) - modY : modY;
          } else {
            switch(wmSettings.position) {
              case "top-left": wx = 40; wy = 40; break;
              case "top-right": wx = canvas.width - wmSize - 40; wy = 40; break;
              case "bottom-left": wx = 40; wy = canvas.height - wmSize - 40; break;
              case "bottom-right": wx = canvas.width - wmSize - 40; wy = canvas.height - wmSize - 40; break;
              case "center": wx = (canvas.width - wmSize) / 2; wy = (canvas.height - wmSize) / 2; break;
            }
          }
          ctx.globalAlpha = wmSettings.opacity;
          ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
          ctx.globalAlpha = 1.0;
        }

        const timestamp = (frame / targetFps) * 1_000_000;
        const videoFrame = new VideoFrame(canvas, { timestamp });

        while (videoEncoder.encodeQueueSize > 30) { await new Promise(r => setTimeout(r, 1)); }

        if (hasEncoderError) break;
        videoEncoder.encode(videoFrame, { keyFrame: frame % 30 === 0 });
        videoFrame.close();

        if (frame % 5 === 0 || frame === totalFrames - 1) {
          await new Promise(r => setTimeout(r, 0));
          setExportProgress(Math.min(88, Math.round(5 + (frame / totalFrames) * 83)));
        }
      }

      if (hasEncoderError) {
        if (videoEncoder.state !== "closed") {
          try { videoEncoder.close(); } catch(e) {}
        }
        throw new Error("حدث خطأ أثناء تشفير الفيديو. يرجى تقليل الجودة أو استخدام متصفح أحدث.");
      } else {
        setExportProgress(89);
        if (videoEncoder.state !== "closed") {
          await videoEncoder.flush();
          videoEncoder.close();
        }
        setExportProgress(92);
        muxer.finalize();
      }

      let { buffer } = muxer.target as any;
      let finalMp4Buffer = buffer;

      // If audio was present but not encoded via native AudioEncoder, run safe FFmpeg fallback
      if (mixedAudioBuffer && !hasNativeAudioTrack) {
        setExportProgress(94);
        finalMp4Buffer = await muxAudioWithFFmpegFallback(buffer, mixedAudioBuffer, isWebM, ensureFFmpeg);
      }

      // Verification stage
      setExportProgress(98);
      const verification = await verifyExportedVideo(finalMp4Buffer, isWebM ? 'webm' : 'mp4');
      console.log("[SVGA Grid Export] Video verified:", verification);

      setExportProgress(100);
      const ext = isWebM ? 'webm' : 'mp4';
      const mime = isWebM ? 'video/webm' : 'video/mp4';
      const blob = new Blob([finalMp4Buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SVGA_Record_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("حدث خطأ أثناء التصدير.");
    } finally {
      document.body.removeChild(renderContainer);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportIndividualVideos = async (itemsToExport?: MultiSvgaItem[]) => {
    const list = itemsToExport || getActiveItems();
    if (list.length === 0) return;

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    list.forEach(item => {
      let folderPrefix = "";
      if (item.folderPath) {
        folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
      }
      const rawName = item.name.replace(/\.[^/.]+$/, "");
      const fullPath = folderPrefix + rawName;
      if (nameCounts[fullPath]) {
        nameCounts[fullPath]++;
        uniqueNames[item.id] = `${rawName}_${nameCounts[fullPath]}`;
      } else {
        nameCounts[fullPath] = 1;
        uniqueNames[item.id] = rawName;
      }
    });


    const { allowed } = await checkAccess("Multi SVGA Individual Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    if (currentUser) {
      logActivity(currentUser, "export", `Individual Video Export: ${list.length} files`);
    }

    const targetFps = 30;

    let bgImg: HTMLImageElement | null = null;
    if (previewBg) {
      bgImg = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = previewBg;
      });
    }

    let wmImg: HTMLImageElement | null = null;
    if (watermark) {
      wmImg = await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = watermark;
      });
    }

    let streamZip: any = null;
    if (list.length > 1) {
      try {
        streamZip = await createStreamingZip(`Individual_Videos_${Date.now()}.zip`);
      } catch (err: any) {
        if (err?.message === "USER_ABORT") {
          setIsExporting(false);
          setExportProgress(0);
          return;
        }
      }
    }

    const renderContainer = document.createElement("div");
    renderContainer.style.position = "fixed";
    renderContainer.style.left = "-10000px";
    renderContainer.style.top = "0";
    renderContainer.style.width = "1920px";
    renderContainer.style.height = "1920px";
    renderContainer.style.overflow = "hidden";
    renderContainer.style.zIndex = "-1000";
    renderContainer.style.pointerEvents = "none";
    document.body.appendChild(renderContainer);

    try {
      
      let completedCount = 0;
      const CONCURRENCY = 1; // Sequential for ffmpeg
      for (let batchStart = 0; batchStart < list.length; batchStart += CONCURRENCY) {
        const batch = list.slice(batchStart, batchStart + CONCURRENCY);
        await Promise.all(batch.map(async (item, batchIdx) => {
          const i = batchStart + batchIdx; try {
          
        
        setExportProgress(Math.round((completedCount / list.length) * 100));

        // Pre-parse the item so dimensions, FPS, frames, and native duration are 100% accurate
        if (item.type === "vap") {
          if (!item.vapConfig) {
            try { item.vapConfig = await extractVapConfigFromBlob(item.file); } catch (e) {}
          }
        } else if (item.type === "pag") {
          try {
            const PAG = await getPAG();
            if (!item.pagFile) {
              item.pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
            }
            if (item.pagFile) {
              const pagDur = (item.pagFile.duration() / 1000000) || 1;
              const pagFps = item.pagFile.frameRate() || 30;
              item.fps = pagFps;
              item.duration = pagDur;
              item.frames = Math.max(1, Math.round(pagDur * pagFps));
              item.dimensions = { width: item.pagFile.width() || 500, height: item.pagFile.height() || 500 };
            }
          } catch (e) {
            console.warn("Failed to pre-parse PAG in export:", e);
          }
        } else {
          try {
            await parseSvgaIfNeeded(item);
          } catch (e) {
            console.warn("Failed to pre-parse SVGA in export:", item.name, e);
          }
        }

        const effectivePresetId = item.presetId && item.presetId !== 'auto' ? item.presetId : selectedPresetId;
        const preset = DEVICE_PRESETS.find(p => p.id === effectivePresetId);
        let itemW = (isCustomDimensionsActive && customWidth) ? customWidth : (preset?.width || item.dimensions?.width || 500);
        let itemH = (isCustomDimensionsActive && customHeight) ? customHeight : (preset?.height || item.dimensions?.height || 500);

        if (forceMobileSize) {
          itemW = exportResolution === "1080p" ? 1080 : 720;
          itemH = exportResolution === "1080p" ? 1920 : 1280;
        } else if (exportResolution === "1080p") {
          if (itemH > itemW) { itemW = 1080; itemH = 1920; }
          else { itemW = 1920; itemH = 1080; }
        } else if (exportResolution === "720p") {
          if (itemH > itemW) { itemW = 720; itemH = 1280; }
          else { itemW = 1280; itemH = 720; }
        }

        const finalWidth = Math.round(itemW / 2) * 2;
        const finalHeight = Math.round(itemH / 2) * 2;

        if (item.type === "vap") {
          const result = await convertVapToMp4({
            file: item.file,
            url: item.url,
            vapConfig: item.vapConfig,
            targetWidth: finalWidth,
            targetHeight: finalHeight,
            exportResolution,
            exportQuality,
            exportDuration: useNativeDuration ? undefined : exportDuration,
            previewBg,
            watermark,
            wmSettings,
            onProgress: (p) => {
              const currentOverall = Math.round(((completedCount + p / 100) / list.length) * 100);
              setExportProgress(Math.min(100, currentOverall));
            }
          });

          const cleanName = uniqueNames[item.id];
          const folderPrefix = item.folderPath ? `${item.folderPath}/` : '';
          const mp4Filename = `${folderPrefix}${cleanName}.mp4`;

          if (streamZip) {
            streamZip.addFile(mp4Filename, new Uint8Array(result.buffer));
          } else {
            const blob = new Blob([result.buffer], { type: "video/mp4" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${cleanName}.mp4`;
            a.click();
            URL.revokeObjectURL(url);
          }
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

        const itemFrames = item.frames || 1;
        const itemFps = item.fps || 30;
        let durationSec = item.duration || (itemFrames / itemFps);
        if (durationSec <= 0.05 && item.videoItem?.frames) {
          durationSec = item.videoItem.frames / (item.videoItem.FPS || item.videoItem.fps || 30);
        }

        const totalFrames = (!useNativeDuration && exportDuration && exportDuration > 0)
          ? Math.max(1, Math.round(exportDuration * targetFps))
          : Math.max(1, Math.round(durationSec * targetFps));

        const isWebM = exportFormat === 'webm';
        const div = document.createElement("div");
        div.style.width = finalWidth + "px";
        div.style.height = finalHeight + "px";
        div.style.position = "absolute";
        div.style.left = "0";
        div.style.top = "0";
        renderContainer.appendChild(div);

        let player: any = null;
        let internalCanvas: HTMLCanvasElement | null = null;
        let audiosToMux: ExtractedAudioTrack[] = [];
        let videoEncoder: VideoEncoder | null = null;

        try {
          if (item.type === "pag") {
            const PAG = await getPAG();
            let pagFile = item.pagFile;
            if (!pagFile) {
              pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
              item.pagFile = pagFile;
            }
            internalCanvas = document.createElement("canvas");
            const canvasId = "pag_indiv_" + Math.random().toString(36).substring(2, 9);
            internalCanvas.id = canvasId;
            internalCanvas.width = item.dimensions?.width || 500;
            internalCanvas.height = item.dimensions?.height || 500;
            internalCanvas.style.width = "100%";
            internalCanvas.style.height = "100%";
            internalCanvas.style.objectFit = "contain";
            div.appendChild(internalCanvas);

            player = await PAG.PAGPlayer.create();
            player.setComposition(pagFile);
            const pagSurface = PAG.PAGSurface.fromCanvas('#' + canvasId);
            if (pagSurface) {
              pagSurface.updateSize();
              player.setSurface(pagSurface);
            }
            player.setVideoEnabled(true);
            player.setProgress(0);
            await player.flush();
          } else {
            const videoItem = await parseSvgaIfNeeded(item);
            try {
              const audioData = await extractAllSvgaAudioTracks(videoItem);
              if (audioData.length > 0) {
                audiosToMux = audioData;
              }
            } catch (e) {
              console.warn("Could not extract audio for export", e);
            }
            player = new SVGA.Player(div);
            player.clearsAfterStop = false;
            player.setVideoItem(videoItem);
            player.setContentMode('AspectFit');
            player.stepToFrame(0, false);
            internalCanvas = div.querySelector("canvas");
          }

          // Mix audio for this item if present
          let mixedAudioBuffer: AudioBuffer | null = null;
          let hasNativeAudioTrack = false;
          if (audiosToMux.length > 0) {
            try {
              mixedAudioBuffer = await mixAudioTracksToBuffer(audiosToMux, {
                durationSec,
                fps: targetFps,
                loopShorterAudio: true,
              });
              // @ts-ignore
              if (mixedAudioBuffer && typeof AudioEncoder !== 'undefined') {
                const codec = isWebM ? 'opus' : 'mp4a.40.2';
                // @ts-ignore
                const check = await AudioEncoder.isConfigSupported({
                  codec,
                  numberOfChannels: 2,
                  sampleRate: mixedAudioBuffer.sampleRate,
                  bitrate: 128000
                });
                if (check.supported) {
                  hasNativeAudioTrack = true;
                }
              }
            } catch (audioErr) {
              console.warn("[SVGA Individual Export] Audio mixing notice:", audioErr);
            }
          }

          // Check if we are exporting as VAP or YYEVA
          if (exportFormat === 'vap' || exportFormat === 'yyeva') {
            const collectedCanvases: HTMLCanvasElement[] = [];
            for (let frame = 0; frame < totalFrames; frame++) {
              const frameCanvas = document.createElement("canvas");
              frameCanvas.width = finalWidth;
              frameCanvas.height = finalHeight;
              const fCtx = frameCanvas.getContext("2d", { alpha: true })!;
              
              const elapsedSeconds = frame / targetFps;
              if (item.type === "pag") {
                const pagDur = (item.pagFile?.duration() / 1000000) || 1;
                try {
                  player.setProgress((elapsedSeconds % pagDur) / pagDur);
                  await player.flush();
                } catch (e) { console.warn("PAG export frame error", e); }
              } else {
                const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);
                try {
                  player.stepToFrame(itemFrame, false);
                } catch (e) { console.warn("SVGA export frame error", e); }
              }

              if (internalCanvas) {
                const sw = internalCanvas.width || item.dimensions?.width || 500;
                const sh = internalCanvas.height || item.dimensions?.height || 500;
                const scale = Math.min(finalWidth / sw, finalHeight / sh);
                const drawW = sw * scale;
                const drawH = sh * scale;
                const dx = (finalWidth - drawW) / 2;
                const dy = (finalHeight - drawH) / 2;

                fCtx.drawImage(internalCanvas, dx, dy, drawW, drawH);
              }

              if (wmImg) {
                const wmSize = Math.min(finalWidth, finalHeight) * (wmSettings.size / 100);
                let wx = 0, wy = 0;
                switch (wmSettings.position) {
                  case "top-left": wx = 20; wy = 20; break;
                  case "top-right": wx = finalWidth - wmSize - 20; wy = 20; break;
                  case "bottom-left": wx = 20; wy = finalHeight - wmSize - 20; break;
                  case "bottom-right": wx = finalWidth - wmSize - 20; wy = finalHeight - wmSize - 20; break;
                  case "center": wx = (finalWidth - wmSize) / 2; wy = (finalHeight - wmSize) / 2; break;
                }
                fCtx.globalAlpha = wmSettings.opacity;
                fCtx.drawImage(wmImg, wx, wy, wmSize, wmSize);
                fCtx.globalAlpha = 1.0;
              }

              collectedCanvases.push(frameCanvas);

              if (frame % 5 === 0 || frame === totalFrames - 1) {
                await new Promise(r => setTimeout(r, 0));
                const baseProg = (i / list.length) * 88;
                const frameProg = (((frame / totalFrames) * 0.4) / list.length) * 88;
                setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + frameProg))));
              }
            }

            const delays = Array(totalFrames).fill(1000 / targetFps);
            const exportQualityNum = exportQuality === 'high' ? 100 : (exportQuality === 'medium' ? 80 : 50);

            let finalBlob: Blob;
            if (exportFormat === 'vap') {
              finalBlob = await exportAsVap(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight,
                targetFps,
                '1.0.5',
                mixedAudioBuffer,
                (p, msg) => {
                  const baseProg = (i / list.length) * 88;
                  const encodeProg = (((0.4 + p * 0.6) / list.length) * 88);
                  setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + encodeProg))));
                },
                exportQualityNum
              );
            } else {
              finalBlob = await exportAsYyeva(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight,
                targetFps,
                mixedAudioBuffer,
                (p, msg) => {
                  const baseProg = (i / list.length) * 88;
                  const encodeProg = (((0.4 + p * 0.6) / list.length) * 88);
                  setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + encodeProg))));
                },
                exportQualityNum
              );
            }

            const cleanName = uniqueNames[item.id];
            const folderPrefix = item.folderPath ? `${item.folderPath}/` : '';
            const videoFilename = `${folderPrefix}${cleanName}.mp4`;

            if (streamZip) {
              const arrayBuffer = await finalBlob.arrayBuffer();
              streamZip.addFile(videoFilename, new Uint8Array(arrayBuffer));
            } else {
              const url = URL.createObjectURL(finalBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${cleanName}.mp4`;
              a.click();
              URL.revokeObjectURL(url);
            }

            collectedCanvases.forEach(c => {
              c.width = 0;
              c.height = 0;
            });
            return;
          }

          const muxer = isWebM 
            ? new WebMMuxer({
                target: new WebmArrayBufferTarget(),
                video: { codec: 'V_VP9', width: finalWidth, height: finalHeight },
                audio: hasNativeAudioTrack && mixedAudioBuffer ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: mixedAudioBuffer.sampleRate } : undefined
              })
            : new Mp4Muxer({
                target: new Mp4ArrayBufferTarget(),
                video: { codec: "avc", width: finalWidth, height: finalHeight },
                audio: hasNativeAudioTrack && mixedAudioBuffer ? { codec: 'aac', numberOfChannels: 2, sampleRate: mixedAudioBuffer.sampleRate } : undefined,
                fastStart: "in-memory"
              });

          let hasEncoderError = false;
          videoEncoder = new VideoEncoder({
            output: (chunk, metadata) => {
              let safeMetadata: any = undefined;
              if (metadata) {
                safeMetadata = { ...metadata };
                if (safeMetadata.decoderConfig) {
                  safeMetadata.decoderConfig = { ...safeMetadata.decoderConfig };
                  if (safeMetadata.decoderConfig.colorSpace === null) {
                    delete safeMetadata.decoderConfig.colorSpace;
                  }
                } else if (safeMetadata.decoderConfig === null) {
                  delete safeMetadata.decoderConfig;
                }
              }
              muxer.addVideoChunk(chunk, safeMetadata);
            },
            error: (e) => {
              console.error("Encoder Error:", e);
              hasEncoderError = true;
            }
          });

          if (hasNativeAudioTrack && mixedAudioBuffer) {
            await encodeAudioBufferToMuxer(mixedAudioBuffer, muxer, isWebM);
          }

          const totalPixels = finalWidth * finalHeight;
          const targetBitrate = exportQuality === 'high'
            ? Math.min(16_000_000, Math.max(8_000_000, Math.round(totalPixels * 3.5)))
            : exportQuality === 'medium'
            ? Math.min(8_000_000, Math.max(3_500_000, Math.round(totalPixels * 1.6)))
            : Math.min(4_000_000, Math.max(1_500_000, Math.round(totalPixels * 0.8)));

          let selectedCodec = isWebM ? "vp09.00.10.08" : (totalPixels > 2200000 ? "avc1.4d0033" : "avc1.4D002A");
          if (!isWebM && typeof (VideoEncoder as any).isConfigSupported === 'function') {
            const testCodecs = totalPixels > 2200000
              ? ["avc1.4d0033", "avc1.640033", "avc1.4D002A", "avc1.42001f"]
              : ["avc1.4D002A", "avc1.42001f", "avc1.4d0033"];
            for (const c of testCodecs) {
              try {
                const res = await (VideoEncoder as any).isConfigSupported({
                  codec: c,
                  width: finalWidth,
                  height: finalHeight,
                  bitrate: targetBitrate,
                  framerate: targetFps
                });
                if (res.supported) {
                  selectedCodec = c;
                  break;
                }
              } catch (e) {}
            }
          }

          videoEncoder.configure({
            codec: selectedCodec,
            width: finalWidth,
            height: finalHeight,
            bitrate: targetBitrate,
            framerate: targetFps,
            bitrateMode: 'constant',
            latencyMode: 'realtime'
          });

          await new Promise(r => setTimeout(r, 40));

          for (let frame = 0; frame < totalFrames; frame++) {
            if (bgImg) {
              ctx.drawImage(bgImg, 0, 0, finalWidth, finalHeight);
            } else {
              ctx.fillStyle = "#0f172a";
              ctx.fillRect(0, 0, finalWidth, finalHeight);
            }

            const elapsedSeconds = frame / targetFps;
            if (item.type === "pag") {
              const pagDur = (item.pagFile?.duration() / 1000000) || 1;
              try {
                player.setProgress((elapsedSeconds % pagDur) / pagDur);
                await player.flush();
              } catch (e) { console.warn("PAG export frame error", e); }
            } else {
              const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);
              try {
                player.stepToFrame(itemFrame, false);
              } catch (e) { console.warn("SVGA export frame error", e); }
            }

            if (internalCanvas) {
              const sw = internalCanvas.width || item.dimensions?.width || 500;
              const sh = internalCanvas.height || item.dimensions?.height || 500;
              const scale = Math.min(finalWidth / sw, finalHeight / sh);
              const drawW = sw * scale;
              const drawH = sh * scale;
              const dx = (finalWidth - drawW) / 2;
              const dy = (finalHeight - drawH) / 2;

              ctx.drawImage(internalCanvas, dx, dy, drawW, drawH);
            }

            if (wmImg) {
              const wmSize = Math.min(finalWidth, finalHeight) * (wmSettings.size / 100);
              let wx = 0, wy = 0;
              if (wmSettings.isAnimated) {
                const speed = wmSettings.animationSpeed || 5;
                const pxPerFrame = speed * 1.5;
                const maxX = Math.max(1, finalWidth - wmSize);
                const maxY = Math.max(1, finalHeight - wmSize);
                const distX = frame * pxPerFrame;
                const distY = frame * pxPerFrame * 0.75;
                const modX = distX % (maxX * 2);
                const modY = distY % (maxY * 2);
                wx = modX > maxX ? (maxX * 2) - modX : modX;
                wy = modY > maxY ? (maxY * 2) - modY : modY;
              } else {
                switch (wmSettings.position) {
                  case "top-left": wx = 20; wy = 20; break;
                  case "top-right": wx = finalWidth - wmSize - 20; wy = 20; break;
                  case "bottom-left": wx = 20; wy = finalHeight - wmSize - 20; break;
                  case "bottom-right": wx = finalWidth - wmSize - 20; wy = finalHeight - wmSize - 20; break;
                  case "center": wx = (finalWidth - wmSize) / 2; wy = (finalHeight - wmSize) / 2; break;
                }
              }
              ctx.globalAlpha = wmSettings.opacity;
              ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
              ctx.globalAlpha = 1.0;
            }

            const timestamp = (frame / targetFps) * 1_000_000;
            const videoFrame = new VideoFrame(canvas, { timestamp });

            try {
              while (videoEncoder.encodeQueueSize > 12 && !hasEncoderError) {
                await new Promise(r => setTimeout(r, 2));
              }

              if (!hasEncoderError && videoEncoder.state === "configured") {
                videoEncoder.encode(videoFrame, { keyFrame: frame % 30 === 0 });
              }
            } finally {
              videoFrame.close();
            }

            if (hasEncoderError) break;

            if (frame % 5 === 0 || frame === totalFrames - 1) {
              await new Promise(r => setTimeout(r, 0));
              const baseProg = (i / list.length) * 88;
              const frameProg = ((frame / totalFrames) / list.length) * 88;
              setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + frameProg))));
            }
          }

          if (hasEncoderError) {
            if (videoEncoder && videoEncoder.state !== "closed") {
              try { videoEncoder.close(); } catch(e) {}
            }
            throw new Error("حدث خطأ أثناء تشفير الفيديو. يرجى تقليل الجودة أو استخدام متصفح أحدث.");
          } else {
            if (videoEncoder && videoEncoder.state !== "closed") {
              await videoEncoder.flush();
              videoEncoder.close();
            }
            muxer.finalize();
          }

          let { buffer } = muxer.target as any;
          let finalMp4Buffer = buffer;

          // If audio was present but not encoded via native AudioEncoder, run safe FFmpeg fallback
          if (mixedAudioBuffer && !hasNativeAudioTrack) {
            finalMp4Buffer = await muxAudioWithFFmpegFallback(buffer, mixedAudioBuffer, isWebM, ensureFFmpeg);
          }

          // Post-export verification
          const verification = await verifyExportedVideo(finalMp4Buffer, isWebM ? 'webm' : 'mp4');
          console.log("[SVGA Individual Export] Video verified:", item.name, verification);

          const ext = isWebM ? 'webm' : 'mp4';
          const mime = isWebM ? 'video/webm' : 'video/mp4';
          const cleanName = uniqueNames[item.id];
          const folderPrefix = item.folderPath ? `${item.folderPath}/` : '';
          const videoFilename = `${folderPrefix}${cleanName}.${ext}`;

          if (streamZip) {
            // Add video file to ZIP archive
            streamZip.addFile(videoFilename, new Uint8Array(finalMp4Buffer));
          } else {
            // Single video direct download
            const blob = new Blob([finalMp4Buffer], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${cleanName}.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
          }
        } finally {
          // Guaranteed resource cleanup after each item
          if (videoEncoder && (videoEncoder as any).state !== "closed") {
            try { (videoEncoder as any).close(); } catch (e) {}
          }
          if (player) {
            try {
              if (item.type === "pag") {
                player.destroy?.();
              } else {
                player.stopAnimation?.();
              }
            } catch (e) {}
          }
          try {
            div.innerHTML = '';
            if (renderContainer.contains(div)) {
              renderContainer.removeChild(div);
            }
          } catch (e) {}
          canvas.width = 0;
          canvas.height = 0;
        }

        // Allow garbage collector and event loop to breathe between items
        await new Promise(r => setTimeout(r, 40));
          } catch (e) { console.warn("Failed individual export", e); } completedCount++;
          setExportProgress(Math.round(88 + (completedCount / list.length) * 12));
        }));
      }


      if (streamZip) {
        await streamZip.close();
      }
    } catch (error) {
      console.error("Individual video export error:", error);
      alert("حدث خطأ أثناء تصدير الفيديوهات المستقلة.");
      if (streamZip) {
        try { await streamZip.abort(); } catch(e) {}
      }
    } finally {
      if (document.body.contains(renderContainer)) {
        document.body.removeChild(renderContainer);
      }
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportSingleVap = async (item: MultiSvgaItem) => {
    const { allowed } = await checkAccess("VAP Export MP4");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    if (currentUser) {
      logActivity(currentUser, 'export', `Single VAP to MP4 Export: ${item.name}`);
    }

    try {
      let finalWidth = item.dimensions?.width || 750;
      let finalHeight = item.dimensions?.height || 1334;
      const preset = DEVICE_PRESETS.find(p => p.id === item.presetId);
      if (preset) {
        finalWidth = preset.width;
        finalHeight = preset.height;
      }

      const result = await convertVapToMp4({
        file: item.file,
        url: item.url,
        vapConfig: item.vapConfig,
        targetWidth: finalWidth,
        targetHeight: finalHeight,
        exportResolution,
        exportQuality,
        exportDuration: useNativeDuration ? undefined : exportDuration,
        previewBg,
        watermark,
        wmSettings,
        onProgress: (pct) => setExportProgress(pct)
      });

      const url = URL.createObjectURL(result.mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name.replace(/\.[^/.]+$/, "") + '.mp4';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Single VAP export error:", err);
      alert("حدث خطأ أثناء تصدير ملف VAP: " + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportAllVapToMp4 = async () => {
    const activeItems = getActiveItems();
    const vapItems = activeItems.filter(i => i.type === 'vap');
    const targetList = vapItems.length > 0 ? vapItems : activeItems;

    if (targetList.length === 0) {
      alert('لا توجد ملفات VAP متاحة للتصدير.');
      return;
    }

    const { allowed } = await checkAccess("VAP Batch Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    const initialStatuses = targetList.map(item => ({
      id: item.id,
      name: item.name,
      status: 'pending' as 'pending' | 'processing' | 'done' | 'error',
    }));

    setVapBatchProgress({
      isOpen: true,
      total: targetList.length,
      completed: 0,
      currentFileName: targetList[0]?.name || '',
      currentFileIndex: 1,
      overallPercent: 0,
      currentPercent: 0,
      statusMessage: 'جاري بدء التصدير المتوازي فائق السرعة لملفات VAP...',
      fileStatuses: initialStatuses,
    });

    if (currentUser) {
      logActivity(currentUser, 'export', `Batch VAP to MP4 Export: ${targetList.length} files`);
    }

    const successfulBlobs: { name: string; blob: Blob; buffer: ArrayBuffer }[] = [];
    let completedCount = 0;

    // Sequential Concurrency (1 export at a time to give 100% GPU/WebCodecs resources without frame dropping or stutter)
    const CONCURRENCY = 1;
    let currentIndex = 0;

    const processItem = async (item: MultiSvgaItem, index: number) => {
      setVapBatchProgress(prev => {
        if (!prev) return null;
        const updatedStatuses = prev.fileStatuses.map(s =>
          s.id === item.id ? { ...s, status: 'processing' as const } : s
        );
        return {
          ...prev,
          currentFileName: item.name,
          currentFileIndex: index + 1,
          statusMessage: `جاري تحويل ومعالجة: ${item.name}`,
          fileStatuses: updatedStatuses,
        };
      });

      try {
        let finalWidth = item.dimensions?.width || 750;
        let finalHeight = item.dimensions?.height || 1334;
        const preset = DEVICE_PRESETS.find(p => p.id === item.presetId);
        if (preset) {
          finalWidth = preset.width;
          finalHeight = preset.height;
        }

        const result = await convertVapToMp4({
          file: item.file,
          url: item.url,
          vapConfig: item.vapConfig,
          targetWidth: finalWidth,
          targetHeight: finalHeight,
          exportResolution,
          exportQuality,
          exportDuration: useNativeDuration ? undefined : exportDuration,
          previewBg,
          watermark,
          wmSettings,
          onProgress: (pct) => {
            setVapBatchProgress(prev => {
              if (!prev) return null;
              const overall = Math.min(99, Math.round(((completedCount + pct / 100) / targetList.length) * 100));
              return {
                ...prev,
                currentPercent: pct,
                overallPercent: overall,
              };
            });
          }
        });

        successfulBlobs.push({
          name: item.name.replace(/\.[^/.]+$/, "") + '.mp4',
          blob: result.mp4Blob,
          buffer: result.buffer,
        });

        completedCount++;

        setVapBatchProgress(prev => {
          if (!prev) return null;
          const updatedStatuses = prev.fileStatuses.map(s =>
            s.id === item.id ? { ...s, status: 'done' as const } : s
          );
          const overall = Math.round((completedCount / targetList.length) * 100);
          return {
            ...prev,
            completed: completedCount,
            overallPercent: overall,
            fileStatuses: updatedStatuses,
            statusMessage: `اكتمل ${completedCount} من ${targetList.length} ملف`,
          };
        });
      } catch (err: any) {
        console.error(`Error converting ${item.name}:`, err);
        completedCount++;
        setVapBatchProgress(prev => {
          if (!prev) return null;
          const updatedStatuses = prev.fileStatuses.map(s =>
            s.id === item.id ? { ...s, status: 'error' as const, errorMsg: err?.message || 'فشل التحويل' } : s
          );
          return {
            ...prev,
            completed: completedCount,
            fileStatuses: updatedStatuses,
          };
        });
      }
    };

    // Run parallel workers
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (currentIndex < targetList.length) {
        const itemIdx = currentIndex++;
        const item = targetList[itemIdx];
        if (item) {
          await processItem(item, itemIdx);
        }
      }
    });

    await Promise.all(workers);

    if (successfulBlobs.length === 1) {
      const item = successfulBlobs[0];
      const url = URL.createObjectURL(item.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (successfulBlobs.length > 1) {
      setVapBatchProgress(prev => prev ? { ...prev, statusMessage: 'جاري إنشاء حزمة التنزيل السريعة (ZIP)...' } : null);
      try {
        const streamZip = await createStreamingZip(`VAP_MP4_Videos_${Date.now()}.zip`);
        for (const sb of successfulBlobs) {
          streamZip.addFile(sb.name, new Uint8Array(sb.buffer));
        }
        await streamZip.close();
      } catch (e) {
        const zip = new JSZip();
        for (const sb of successfulBlobs) {
          zip.file(sb.name, sb.blob);
        }
        // Use STORE (level 0) for instant zip creation without re-compressing MP4s
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VAP_MP4_Videos_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }

    setVapBatchProgress(prev => prev ? {
      ...prev,
      overallPercent: 100,
      currentPercent: 100,
      statusMessage: `تم التصدير والتنزيل بنجاح! اكتمل ${successfulBlobs.length} من ${targetList.length} ملف.`
    } : null);
  };

  const handleDownloadAllVapPng = async () => {
    const activeItems = getActiveItems();
    const vapItems = activeItems.filter(i => i.type === 'vap');
    const targetList = vapItems.length > 0 ? vapItems : activeItems;

    if (targetList.length === 0) {
      alert('لا توجد ملفات VAP متاحة لتنزيل الصور.');
      return;
    }

    const { allowed } = await checkAccess("VAP PNG Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    if (currentUser) {
      logActivity(currentUser, 'export', `VAP to PNG Export: ${targetList.length} files`);
    }

    try {
      if (targetList.length === 1) {
        const item = targetList[0];
        const blob = await captureFrame(item, 0);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = item.name.replace(/\.[^/.]+$/, '');
        a.download = `${cleanName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        let streamZip: any = null;
        try {
          streamZip = await createStreamingZip(`VAP_PNG_Images_${Date.now()}.zip`);
        } catch (e) {
          streamZip = null;
        }

        const BATCH_SIZE = 6;
        let completed = 0;
        const capturedFiles: { name: string; blob: Blob }[] = [];

        for (let i = 0; i < targetList.length; i += BATCH_SIZE) {
          const batch = targetList.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (item) => {
            let folderPrefix = "";
            if (item.folderPath) {
              folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
            }
            const cleanName = item.name.replace(/\.[^/.]+$/, '');
            const filename = `${folderPrefix}${cleanName}.png`;
            const blob = await captureFrame(item, 0);

            if (streamZip) {
              const arrayBuffer = await blob.arrayBuffer();
              streamZip.addFile(filename, new Uint8Array(arrayBuffer));
            } else {
              capturedFiles.push({ name: filename, blob });
            }

            completed++;
            setExportProgress(Math.round((completed / targetList.length) * 100));
          }));
        }

        if (streamZip) {
          await streamZip.close();
        } else {
          const zip = new JSZip();
          for (const cf of capturedFiles) {
            zip.file(cf.name, cf.blob);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `VAP_PNG_Images_${Date.now()}.zip`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err: any) {
      console.error("VAP PNG export error:", err);
      alert("حدث خطأ أثناء تنزيل صور VAP: " + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsZipping(false);
      setExportProgress(0);
    }
  };

  const parseSvgaIfNeeded = async (item: MultiSvgaItem): Promise<any> => {
    // If videoItem is valid and has images, ensure metadata fields are populated before returning
    if (item.videoItem && item.videoItem.images) {
      if (item.videoItem.frames && !item.frames) item.frames = item.videoItem.frames;
      if (!item.fps) item.fps = item.videoItem.FPS || item.videoItem.fps || 30;
      if (!item.duration && item.frames && item.fps) item.duration = item.frames / item.fps;
      if (!item.dimensions && item.videoItem.videoSize) {
        item.dimensions = {
          width: item.videoItem.videoSize.width || 500,
          height: item.videoItem.videoSize.height || 500
        };
      }
      return item.videoItem;
    }
    
    return new Promise((resolve, reject) => {
      const parser = new SVGA.Parser();
      let isDone = false;
      const tid = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          reject(new Error(`SVGA parser timed out for ${item.name}`));
        }
      }, 25000);

      // Bypass cache just in case player.clear() destructed the cached images previously
      const bypassUrl = item.url + '#' + Math.random().toString(36).substr(2, 9);
      parser.load(bypassUrl, (videoItem: any) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(tid);
        if (!videoItem || !videoItem.images) {
          return reject(new Error("Invalid SVGA format - missing images"));
        }
        item.videoItem = videoItem;
        item.dimensions = { 
          width: videoItem.videoSize?.width || 500, 
          height: videoItem.videoSize?.height || 500 
        };
        item.fps = videoItem.FPS || videoItem.fps || 30;
        item.frames = videoItem.frames || 1;
        item.duration = item.frames / item.fps;
        resolve(videoItem);
      }, (err: any) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(tid);
        reject(err);
      });
    });
  };

  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
    let dw = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
    let dh = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    
    // Create context ONCE with alpha: true
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (item.type === 'pag') {
      const PAG = await getPAG();
      let pagFile = item.pagFile;
      if (!pagFile) {
        pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
      }
      
      if (!item.dimensions) {
        item.dimensions = { width: pagFile.width(), height: pagFile.height() };
        if (!selectedPreset) {
          dw = item.dimensions.width;
          dh = item.dimensions.height;
          canvas.width = dw;
          canvas.height = dh;
        }
      }

      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.id = "pag_capture_" + Math.random().toString(36).substring(2, 9);
      tmpCanvas.width = item.dimensions?.width || pagFile.width();
      tmpCanvas.height = item.dimensions?.height || pagFile.height();
      tmpCanvas.style.position = 'fixed';
      tmpCanvas.style.left = '0px';
      tmpCanvas.style.top = '0px';
      tmpCanvas.style.opacity = '0.001';
      tmpCanvas.style.pointerEvents = 'none';
      document.body.appendChild(tmpCanvas);

      try {
        const pagPlayer = await PAG.PAGPlayer.create();
        pagPlayer.setComposition(pagFile);
        const pagSurface = PAG.PAGSurface.fromCanvas('#' + tmpCanvas.id);
        if (pagSurface) {
           pagPlayer.setSurface(pagSurface);
        }
        
        let targetProgress = 0.5;
        if (frameIndex === -1) {
          targetProgress = 0.5;
        } else if (item.frames && frameIndex > 0) {
          targetProgress = Math.min(1, frameIndex / item.frames);
        } else if (frameIndex === 0) {
          targetProgress = 0.5;
        }
        
        pagPlayer.setProgress(targetProgress);
        await pagPlayer.flush();

        const sw = tmpCanvas.width;
        const sh = tmpCanvas.height;
        const scale = Math.min(dw / sw, dh / sh);
        const finalW = sw * scale;
        const finalH = sh * scale;
        const x = (dw - finalW) / 2;
        const y = (dh - finalH) / 2;
        ctx.drawImage(tmpCanvas, x, y, finalW, finalH);

        try { pagPlayer.destroy?.(); } catch (e) {}
        try { pagSurface?.destroy?.(); } catch (e) {}
      } finally {
        document.body.removeChild(tmpCanvas);
      }
    } else if (item.type === 'vap') {
      const config = item.vapConfig || (await extractVapConfigFromBlob(item.file));
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.src = item.url;
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
        setTimeout(resolve, 1500);
      });
      const vw = video.videoWidth || 750;
      const vh = video.videoHeight || 1334;
      let cfgW = config?.info?.w || Math.round(vw / 2);
      let cfgH = config?.info?.h || vh;
      let rgbRect = config?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
      let alphaRect = config?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
      if (!config?.info?.rgbFrame && vh > vw && vw > 0) {
        rgbRect = [0, 0, vw, Math.round(vh / 2)];
        alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
        cfgW = vw;
        cfgH = Math.round(vh / 2);
      }
      const rawVideoW = config?.info?.videoW || vw;
      const rawVideoH = config?.info?.videoH || vh;
      const scaleX = vw / (rawVideoW || vw);
      const scaleY = vh / (rawVideoH || vh);
      const srcRgbX = Math.round(rgbRect[0] * scaleX);
      const srcRgbY = Math.round(rgbRect[1] * scaleY);
      const srcRgbW = Math.round(rgbRect[2] * scaleX);
      const srcRgbH = Math.round(rgbRect[3] * scaleY);
      const srcAlphaX = Math.round(alphaRect[0] * scaleX);
      const srcAlphaY = Math.round(alphaRect[1] * scaleY);
      const srcAlphaW = Math.round(alphaRect[2] * scaleX);
      const srcAlphaH = Math.round(alphaRect[3] * scaleY);

      let targetTime = Math.min((video.duration || 3) * 0.45, Math.max(0, (video.duration || 3) - 0.05));
      if (frameIndex > 0 && item.frames) {
        targetTime = Math.min((frameIndex / item.frames) * (video.duration || 3), Math.max(0, (video.duration || 3) - 0.05));
      }
      video.currentTime = targetTime;
      await seekVideoToFrame(video, video.currentTime);

      try {
        const webgl = new WebGLVapRenderer(cfgW, cfgH);
        const glCanvas = webgl.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], 10, true);
        const scale = Math.min(dw / cfgW, dh / cfgH);
        const finalW = cfgW * scale;
        const finalH = cfgH * scale;
        const x = (dw - finalW) / 2;
        const y = (dh - finalH) / 2;
        ctx.drawImage(glCanvas, x, y, finalW, finalH);
      } catch (e) {
        ctx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, dw, dh);
      }
    } else {
      const videoItem = await parseSvgaIfNeeded(item);
      if (!item.dimensions) item.dimensions = { width: 500, height: 500 };
      
      const div = document.createElement('div');
      div.style.width = `${item.dimensions.width}px`;
      div.style.height = `${item.dimensions.height}px`;
      div.style.position = 'fixed';
      div.style.left = '-10000px';
      div.style.top = '0px';
      div.style.pointerEvents = 'none';
      div.style.backgroundColor = 'transparent';
      document.body.appendChild(div);

      let player: any;
      try {
        player = new SVGA.Player(div);
        player.clearsAfterStop = false;
        player.setVideoItem(videoItem);
        player.setContentMode('AspectFit');
        
        let framesToJump = Math.floor((item.frames || 30) * 0.48);
        if (frameIndex > 0) {
          framesToJump = Math.min(frameIndex, (item.frames || 1) - 1);
        } else if (frameIndex === 0) {
          framesToJump = Math.floor((item.frames || 30) * 0.48);
        }

        player.stepToFrame(framesToJump, false);
        await new Promise(r => setTimeout(r, 40));
        
        const svgaCanvas = div.querySelector('canvas');
        if (svgaCanvas) {
          const sw = item.dimensions.width;
          const sh = item.dimensions.height;
          // Manual AspectFit calculation
          const scale = Math.min(dw / sw, dh / sh);
          const finalW = sw * scale;
          const finalH = sh * scale;
          const x = (dw - finalW) / 2;
          const y = (dh - finalH) / 2;
          ctx.drawImage(svgaCanvas, x, y, finalW, finalH);
        }
      } finally {
        if (player) {
          try { player.stopAnimation?.(); } catch(e) {}
        }
        if (div.parentNode) {
          document.body.removeChild(div);
        }
      }
    }

    // Draw Watermark
    if (watermark) {
      try {
        const wmImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = watermark;
        });
        ctx.globalAlpha = wmSettings.opacity;
        const wmSize = Math.min(canvas.width, canvas.height) * (wmSettings.size / 100);
        let wx = 0, wy = 0;
        
        // For static image capture, if animated we just place it in center or a calculated position
        // Since it's a single frame, we just use a default or frame 0 position
        if (wmSettings.isAnimated) {
           wx = (canvas.width - wmSize) / 2;
           wy = (canvas.height - wmSize) / 2;
        } else {
          switch(wmSettings.position) {
            case 'top-left': wx = 20; wy = 20; break;
            case 'top-right': wx = canvas.width - wmSize - 20; wy = 20; break;
            case 'bottom-left': wx = 20; wy = canvas.height - wmSize - 20; break;
            case 'bottom-right': wx = canvas.width - wmSize - 20; wy = canvas.height - wmSize - 20; break;
            case 'center': wx = (canvas.width - wmSize) / 2; wy = (canvas.height - wmSize) / 2; break;
          }
        }
        
        ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
        ctx.globalAlpha = 1.0;
      } catch (e) {
        console.error("Failed to load watermark for capture", e);
      }
    }

    return new Promise((resolve) => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  };

  const handleDownloadAllImages = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    activeItems.forEach(item => {
      let folderPrefix = "";
      if (item.folderPath) {
        folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
      }
      const rawName = item.name.replace(/\.[^/.]+$/, "");
      const fullPath = folderPrefix + rawName;
      if (nameCounts[fullPath]) {
        nameCounts[fullPath]++;
        uniqueNames[item.id] = `${rawName}_${nameCounts[fullPath]}`;
      } else {
        nameCounts[fullPath] = 1;
        uniqueNames[item.id] = rawName;
      }
    });

    
    let zipStream;
    try {
        zipStream = await createStreamingZip(`SVGA_Images_${Date.now()}.zip`);
    } catch (e: any) {
        if (e.message === "USER_ABORT") return;
        console.error(e);
        return;
    }

    const { allowed } = await checkAccess('Multi SVGA ZIP Export');
    if (!allowed) {
      if (zipStream.abort) await zipStream.abort();
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    
    if (currentUser) {
      logActivity(currentUser, 'export', `Multi SVGA ZIP Export: ${activeItems.length} files`);
    }

    try {
        const BATCH_SIZE = 6;
        let completed = 0;
        for (let i = 0; i < activeItems.length; i += BATCH_SIZE) {
          const batch = activeItems.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (item) => {
            let folderPrefix = "";
            if (item.folderPath) {
              folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
            }
      
            const blob = await captureFrame(item, Math.floor(item.frames / 2));
            const arrayBuffer = await blob.arrayBuffer();
            const baseName = uniqueNames[item.id];
            
            zipStream.addFile(`${folderPrefix}${baseName}.png`, new Uint8Array(arrayBuffer));
            completed++;
            setExportProgress(Math.round((completed / activeItems.length) * 100));
          }));
        }
        await zipStream.close();
    } catch (e) {
        console.error("Export failed", e);
    } finally {
        setIsZipping(false);
    }
  };

  const handleDownloadAllSvga = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    activeItems.forEach(item => {
      let folderPrefix = "";
      if (item.folderPath) {
        folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
      }
      const rawName = item.name.replace(/\.[^/.]+$/, "");
      const fullPath = folderPrefix + rawName;
      if (nameCounts[fullPath]) {
        nameCounts[fullPath]++;
        uniqueNames[item.id] = `${rawName}_${nameCounts[fullPath]}`;
      } else {
        nameCounts[fullPath] = 1;
        uniqueNames[item.id] = rawName;
      }
    });


    let zipStream;
    try {
        zipStream = await createStreamingZip(`SVGA_Files_${Date.now()}.zip`);
    } catch (e: any) {
        if (e.message === "USER_ABORT") return;
        console.error(e);
        return;
    }

    const { allowed } = await checkAccess('Multi SVGA Files Export');
    if (!allowed) {
      if (zipStream.abort) await zipStream.abort();
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    
    if (currentUser) {
      logActivity(currentUser, 'export', `Multi SVGA Files Export: ${activeItems.length} files`);
    }

    try {
        const BATCH_SIZE = 4;
        let completed = 0;
        for (let i = 0; i < activeItems.length; i += BATCH_SIZE) {
          const batch = activeItems.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (item) => {
            let folderPrefix = "";
            if (item.folderPath) {
              folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
            }
      
            const baseName = uniqueNames[item.id];
            const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');
      
            if (item.type === "pag") {
              try {
                const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100 });
                const arrayBuffer = await result.svgaBlob.arrayBuffer();
                zipStream.addFile(`${folderPrefix}${baseName}.svga`, new Uint8Array(arrayBuffer));
              } catch (e) {
                const arrayBuffer = await item.file.arrayBuffer();
                zipStream.addFile(`${folderPrefix}${baseName}.${ext}`, new Uint8Array(arrayBuffer));
              }
            } else {
              const arrayBuffer = await item.file.arrayBuffer();
              zipStream.addFile(`${folderPrefix}${baseName}.${ext}`, new Uint8Array(arrayBuffer));
            }

            // ADD IMAGES AS REQUESTED WITH BEST FRAME
            try {
               const blob = await captureBestGiftFrame(item);
               const pngArrayBuffer = await blob.arrayBuffer();
               zipStream.addFile(`${folderPrefix}${baseName}.png`, new Uint8Array(pngArrayBuffer));
            } catch(err) {
               console.error("Failed to capture PNG for", item.name, err);
            }

            completed++;
            setExportProgress(Math.round((completed / activeItems.length) * 100));
          }));
        }
        await zipStream.close();
    } catch (e) {
        console.error("Export failed", e);
    } finally {
        setIsZipping(false);
    }
  };

  const handleDownloadAllCombined = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) return;

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    activeItems.forEach(item => {
      let folderPrefix = "";
      if (item.folderPath) {
        folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
      }
      const rawName = item.name.replace(/\.[^/.]+$/, "");
      const fullPath = folderPrefix + rawName;
      if (nameCounts[fullPath]) {
        nameCounts[fullPath]++;
        uniqueNames[item.id] = `${rawName}_${nameCounts[fullPath]}`;
      } else {
        nameCounts[fullPath] = 1;
        uniqueNames[item.id] = rawName;
      }
    });

    
    let zipStream;
    try {
        zipStream = await createStreamingZip(`Files_Full_Package_${Date.now()}.zip`);
    } catch (e: any) {
        if (e.message === "USER_ABORT") return;
        console.error(e);
        return;
    }

    const { allowed } = await checkAccess('Multi SVGA Combined Export', { subscriptionOnly: true });
    if (!allowed) {
      if (zipStream.abort) await zipStream.abort();
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);

    try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        let isFirstPage = true;

        for (let i = 0; i < activeItems.length; i++) {
          const item = activeItems[i];
          let folderPrefix = "";
          if (item.folderPath) {
            folderPrefix = item.folderPath.split('/').filter(Boolean).join('/') + "/";
          }
    
          const baseName = uniqueNames[item.id];
          const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');
    
          // 1. Add file (SVGA, VAP, or PAG)
          if (item.type === "pag") {
            try {
              const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / activeItems.length) * 100)) });
              const arrayBuffer = await result.svgaBlob.arrayBuffer();
              zipStream.addFile(`${folderPrefix}${baseName}.svga`, new Uint8Array(arrayBuffer));
            } catch (e) {
              const arrayBuffer = await item.file.arrayBuffer();
              zipStream.addFile(`${folderPrefix}${baseName}.${ext}`, new Uint8Array(arrayBuffer));
            }
          } else {
            const arrayBuffer = await item.file.arrayBuffer();
            zipStream.addFile(`${folderPrefix}${baseName}.${ext}`, new Uint8Array(arrayBuffer));
          }
    
          // 2. Add PNG capture with best quality frame
          const blob = await captureBestGiftFrame(item);
          const pngArrayBuffer = await blob.arrayBuffer();
          const pngUint8 = new Uint8Array(pngArrayBuffer);
          zipStream.addFile(`${folderPrefix}${baseName}.png`, pngUint8);

          // 3. Add to PDF
          let dw = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
          let dh = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const ratio = Math.min(pdfWidth / dw, pdfHeight / dh);
          
          const finalWidth = dw * ratio;
          const finalHeight = dh * ratio;
          const x = (pdfWidth - finalWidth) / 2;
          const y = (pdfHeight - finalHeight) / 2;

          if (!isFirstPage) {
              pdf.addPage();
          }
          
          pdf.addImage(pngUint8, 'PNG', x, y, finalWidth, finalHeight);
          isFirstPage = false;
    
          setExportProgress(Math.round(((i + 1) / activeItems.length) * 100));
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        // Add PDF to Zip
        const pdfArrayBuffer = pdf.output('arraybuffer');
        zipStream.addFile(`All_Images.pdf`, new Uint8Array(pdfArrayBuffer as ArrayBuffer));

        await zipStream.close();
    } catch (e) {
        console.error("Export failed", e);
    } finally {
        setIsZipping(false);
    }
  };

  const handleDownloadSingleImage = async (item: MultiSvgaItem) => {
    if (currentUser) {
      logActivity(currentUser, 'export', `Single SVGA Image Export: ${item.name}`);
    }
    const blob = await captureFrame(item, Math.floor(item.frames / 2));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace(/\.[^/.]+$/, '')}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSvga = async (item: MultiSvgaItem) => {
    if (currentUser) {
      logActivity(currentUser, "export", `Single SVGA/PAG File Download: ${item.name}`);
    }
    let url = "";
    let downloadName = item.name;
    if (item.type === "pag") {
      setIsExporting(true);
      try {
        const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(p) });
        url = URL.createObjectURL(result.svgaBlob);
        downloadName = item.name.replace(/\.[^/.]+$/, "") + ".svga";
      } catch (e) {
        console.error(e);
        alert("Failed to convert");
        setIsExporting(false);
        return;
      }
      setIsExporting(false);
    } else {
      url = URL.createObjectURL(item.file);
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    a.click();
    URL.revokeObjectURL(url);
    downloadDesignerInfoFile(downloadName, {
      format: item.type?.toUpperCase() || 'SVGA',
      fps: item.fps,
      dimensions: item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : undefined
    });
  };

  const evaluateFrameQuality = (canvas: HTMLCanvasElement): number => {
    try {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return 0;

      const sw = Math.min(160, w);
      const sh = Math.min(160, h);
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = sw;
      sampleCanvas.height = sh;
      const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sCtx) return 0;

      sCtx.drawImage(canvas, 0, 0, sw, sh);
      const imgData = sCtx.getImageData(0, 0, sw, sh);
      const data = imgData.data;

      let visiblePixels = 0;
      let centerWeightedCount = 0;
      let minX = sw, maxX = 0, minY = sh, maxY = 0;
      let sumR = 0, sumG = 0, sumB = 0;
      const cx = sw / 2;
      const cy = sh / 2;
      const maxRadius = Math.sqrt(cx * cx + cy * cy) || 1;

      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = (y * sw + x) * 4;
          const a = data[idx + 3];
          if (a > 30) {
            visiblePixels++;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            sumR += r;
            sumG += g;
            sumB += b;

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const centerWeight = Math.max(0.2, 1.0 - (dist / maxRadius) * 0.8);
            centerWeightedCount += centerWeight;
          }
        }
      }

      if (visiblePixels < 25) return 0;

      const totalPixels = sw * sh;
      const density = centerWeightedCount / totalPixels;
      const boxW = Math.max(1, maxX - minX);
      const boxH = Math.max(1, maxY - minY);
      const boxCoverage = (boxW * boxH) / totalPixels;

      // Penalize pure white flash/flare frame
      const avgR = sumR / visiblePixels;
      const avgG = sumG / visiblePixels;
      const avgB = sumB / visiblePixels;
      const isFlash = (avgR > 245 && avgG > 245 && avgB > 245);
      const flashMultiplier = isFlash ? 0.15 : 1.0;

      return (density * 0.6 + boxCoverage * 0.4) * flashMultiplier;
    } catch (e) {
      return 1;
    }
  };

  const captureBestGiftFrame = async (item: MultiSvgaItem): Promise<Blob> => {
    let dw = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
    let dh = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);

    if (item.type === 'svga') {
      const videoItem = await parseSvgaIfNeeded(item);
      const totalFrames = Math.max(1, item.frames || videoItem.frames || 30);
      const candidateRatios = [0.15, 0.25, 0.35, 0.45, 0.52, 0.60, 0.70, 0.80];
      const candidateFrames = Array.from(new Set(
        candidateRatios.map(r => Math.max(0, Math.min(totalFrames - 1, Math.floor(r * totalFrames))))
      ));

      const div = document.createElement('div');
      div.style.width = `${item.dimensions?.width || 500}px`;
      div.style.height = `${item.dimensions?.height || 500}px`;
      div.style.position = 'fixed';
      div.style.left = '-10000px';
      div.style.top = '0px';
      div.style.pointerEvents = 'none';
      div.style.backgroundColor = 'transparent';
      document.body.appendChild(div);

      let player: any;
      let bestFrameIndex = candidateFrames[Math.floor(candidateFrames.length / 2)] || 0;
      let bestScore = -1;

      try {
        player = new SVGA.Player(div);
        player.clearsAfterStop = false;
        player.setVideoItem(videoItem);
        player.setContentMode('AspectFit');

        for (const frameIdx of candidateFrames) {
          player.stepToFrame(frameIdx, false);
          await new Promise(r => setTimeout(r, 20));
          const svgaCanvas = div.querySelector('canvas');
          if (svgaCanvas) {
            const score = evaluateFrameQuality(svgaCanvas);
            if (score > bestScore) {
              bestScore = score;
              bestFrameIndex = frameIdx;
            }
          }
        }

        // Render the chosen clearest, fullest gift frame
        player.stepToFrame(bestFrameIndex, false);
        await new Promise(r => setTimeout(r, 30));
        const winningCanvas = div.querySelector('canvas');

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = dw;
        finalCanvas.height = dh;
        const fCtx = finalCanvas.getContext('2d', { alpha: true })!;

        if (winningCanvas) {
          const sw = item.dimensions?.width || 500;
          const sh = item.dimensions?.height || 500;
          const scale = Math.min(dw / sw, dh / sh);
          const finalW = sw * scale;
          const finalH = sh * scale;
          const x = (dw - finalW) / 2;
          const y = (dh - finalH) / 2;
          fCtx.drawImage(winningCanvas, x, y, finalW, finalH);
        }

        return await new Promise<Blob>((resolve) => finalCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png', 1.0));
      } finally {
        if (player) {
          try { player.stopAnimation?.(); } catch(e) {}
        }
        if (div.parentNode) document.body.removeChild(div);
      }
    } else if (item.type === 'vap') {
      const config = item.vapConfig || (await extractVapConfigFromBlob(item.file));
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.src = item.url;

      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
        video.oncanplay = () => resolve();
        setTimeout(resolve, 2000);
      });

      const vw = video.videoWidth || 750;
      const vh = video.videoHeight || 1334;
      let cfgW = config?.info?.w || Math.round(vw / 2);
      let cfgH = config?.info?.h || vh;
      let rgbRect = config?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
      let alphaRect = config?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
      if (!config?.info?.rgbFrame && vh > vw && vw > 0) {
        rgbRect = [0, 0, vw, Math.round(vh / 2)];
        alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
        cfgW = vw;
        cfgH = Math.round(vh / 2);
      }
      const rawVideoW = config?.info?.videoW || vw;
      const rawVideoH = config?.info?.videoH || vh;
      const scaleX = vw / (rawVideoW || vw);
      const scaleY = vh / (rawVideoH || vh);
      const srcRgbX = Math.round(rgbRect[0] * scaleX);
      const srcRgbY = Math.round(rgbRect[1] * scaleY);
      const srcRgbW = Math.round(rgbRect[2] * scaleX);
      const srcRgbH = Math.round(rgbRect[3] * scaleY);
      const srcAlphaX = Math.round(alphaRect[0] * scaleX);
      const srcAlphaY = Math.round(alphaRect[1] * scaleY);
      const srcAlphaW = Math.round(alphaRect[2] * scaleX);
      const srcAlphaH = Math.round(alphaRect[3] * scaleY);

      const dur = video.duration || 3;
      const candidateRatios = [0.20, 0.35, 0.48, 0.58, 0.68, 0.78];
      const candidateTimes = candidateRatios.map(r => Math.max(0.1, Math.min(dur - 0.05, r * dur)));

      let bestScore = -1;
      let bestTime = candidateTimes[Math.floor(candidateTimes.length / 2)] || (dur * 0.48);
      const webgl = new WebGLVapRenderer(cfgW, cfgH);

      for (const t of candidateTimes) {
        video.currentTime = t;
        await new Promise<void>((res) => {
          const onSeek = () => {
            video.removeEventListener('seeked', onSeek);
            res();
          };
          video.addEventListener('seeked', onSeek, { once: true });
          setTimeout(onSeek, 200);
        });

        try {
          const glCanvas = webgl.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], 10, true);
          const score = evaluateFrameQuality(glCanvas);
          if (score > bestScore) {
            bestScore = score;
            bestTime = t;
          }
        } catch (e) {}
      }

      // Render winning frame
      video.currentTime = bestTime;
      await new Promise<void>((res) => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek);
          res();
        };
        video.addEventListener('seeked', onSeek, { once: true });
        setTimeout(onSeek, 250);
      });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = dw;
      finalCanvas.height = dh;
      const fCtx = finalCanvas.getContext('2d', { alpha: true })!;

      try {
        const glCanvas = webgl.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], 10, true);
        const scale = Math.min(dw / cfgW, dh / cfgH);
        const finalW = cfgW * scale;
        const finalH = cfgH * scale;
        const x = (dw - finalW) / 2;
        const y = (dh - finalH) / 2;
        fCtx.drawImage(glCanvas, x, y, finalW, finalH);
      } catch (e) {
        fCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, dw, dh);
      }

      return await new Promise<Blob>((resolve) => finalCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png', 1.0));
    } else if (item.type === 'pag') {
      const PAG = await getPAG();
      let pagFile = item.pagFile;
      if (!pagFile) {
        pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
      }
      const pw = item.dimensions?.width || pagFile.width();
      const ph = item.dimensions?.height || pagFile.height();

      const tmpCanvas = document.createElement("canvas");
      tmpCanvas.id = "pag_best_" + Math.random().toString(36).substring(2, 9);
      tmpCanvas.width = pw;
      tmpCanvas.height = ph;
      tmpCanvas.style.position = 'fixed';
      tmpCanvas.style.left = '-10000px';
      tmpCanvas.style.top = '0px';
      tmpCanvas.style.pointerEvents = 'none';
      document.body.appendChild(tmpCanvas);

      try {
        const pagPlayer = await PAG.PAGPlayer.create();
        pagPlayer.setComposition(pagFile);
        const pagSurface = PAG.PAGSurface.fromCanvas('#' + tmpCanvas.id);
        if (pagSurface) {
          pagPlayer.setSurface(pagSurface);
        }

        const candidateProgresses = [0.20, 0.35, 0.48, 0.58, 0.68, 0.78];
        let bestProgress = 0.5;
        let bestScore = -1;

        for (const prog of candidateProgresses) {
          pagPlayer.setProgress(prog);
          await pagPlayer.flush();
          const score = evaluateFrameQuality(tmpCanvas);
          if (score > bestScore) {
            bestScore = score;
            bestProgress = prog;
          }
        }

        pagPlayer.setProgress(bestProgress);
        await pagPlayer.flush();

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = dw;
        finalCanvas.height = dh;
        const fCtx = finalCanvas.getContext('2d', { alpha: true })!;

        const scale = Math.min(dw / pw, dh / ph);
        const finalW = pw * scale;
        const finalH = ph * scale;
        const x = (dw - finalW) / 2;
        const y = (dh - finalH) / 2;
        fCtx.drawImage(tmpCanvas, x, y, finalW, finalH);

        try { pagPlayer.destroy?.(); } catch (e) {}
        try { pagSurface?.destroy?.(); } catch (e) {}

        return await new Promise<Blob>((resolve) => finalCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png', 1.0));
      } finally {
        if (tmpCanvas.parentNode) document.body.removeChild(tmpCanvas);
      }
    }

    return await captureFrame(item, 0);
  };

  const handleDownloadSingleGiftBundle = async (item: MultiSvgaItem) => {
    const { allowed } = await checkAccess("Gift Bundle Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    if (currentUser) {
      logActivity(currentUser, 'export', `Gift Bundle Export: ${item.name}`);
    }

    try {
      const cleanName = item.name.replace(/\.[^/.]+$/, '');
      const zip = new JSZip();

      // 1. Add original file
      const fileBuffer = await item.file.arrayBuffer();
      const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');
      zip.file(`${cleanName}.${ext}`, fileBuffer);

      // If PAG, also optionally include converted SVGA for convenience
      if (item.type === 'pag') {
        try {
          const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100 });
          const svgaBuffer = await result.svgaBlob.arrayBuffer();
          zip.file(`${cleanName}.svga`, svgaBuffer);
        } catch (e) {
          console.warn("Could not bundle converted SVGA for PAG", e);
        }
      }

      // 2. Add best/clearest frame image PNG with transparent background
      const bestImgBlob = await captureBestGiftFrame(item);
      const imgBuffer = await bestImgBlob.arrayBuffer();
      zip.file(`${cleanName}_Cover.png`, imgBuffer);

      // 3. Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}_Gift_Bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Gift Bundle download failed:", err);
      alert("حدث خطأ أثناء إنشاء حزمة الهدية: " + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadAllGiftBundles = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert("لا توجد ملفات هدايا محددة.");
      return;
    }

    const { allowed } = await checkAccess("Gift Bundle Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    if (currentUser) {
      logActivity(currentUser, 'export', `All Gift Bundles Export: ${activeItems.length} items`);
    }

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    activeItems.forEach(item => {
      const cleanName = item.name.replace(/\.[^/.]+$/, '');
      if (nameCounts[cleanName]) {
        nameCounts[cleanName]++;
        uniqueNames[item.id] = `${cleanName}_${nameCounts[cleanName]}`;
      } else {
        nameCounts[cleanName] = 1;
        uniqueNames[item.id] = cleanName;
      }
    });

    try {
      let streamZip: any = null;
      try {
        streamZip = await createStreamingZip(`Gift_Bundles_${Date.now()}.zip`);
      } catch (e) {
        streamZip = null;
      }

      const BATCH_SIZE = 4;
      let completed = 0;
      const capturedFiles: { name: string; blob: Blob | ArrayBuffer }[] = [];
      const pdfImages: { name: string; bytes: Uint8Array; width: number; height: number }[] = [];

      for (let i = 0; i < activeItems.length; i += BATCH_SIZE) {
        const batch = activeItems.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item) => {
          const baseName = uniqueNames[item.id] || item.name.replace(/\.[^/.]+$/, '');

          // 1. Add file directly without nested subfolders
          const fileBuffer = await item.file.arrayBuffer();
          const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');
          const fileEntryName = `${baseName}.${ext}`;

          // 2. Add best frame image directly
          const bestImgBlob = await captureBestGiftFrame(item);
          const imgEntryName = `${baseName}_Cover.png`;
          const imgBuffer = await bestImgBlob.arrayBuffer();
          const imgBytes = new Uint8Array(imgBuffer);

          if (includePdfCatalog) {
            let dw = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
            let dh = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);
            pdfImages.push({ name: baseName, bytes: imgBytes, width: dw, height: dh });
          }

          if (streamZip) {
            streamZip.addFile(fileEntryName, new Uint8Array(fileBuffer));
            streamZip.addFile(imgEntryName, imgBytes);
          } else {
            capturedFiles.push({ name: fileEntryName, blob: fileBuffer });
            capturedFiles.push({ name: imgEntryName, blob: bestImgBlob });
          }

          completed++;
          setExportProgress(Math.round((completed / activeItems.length) * 100));
        }));
      }

      // If user enabled PDF Catalog option: create ONE unified PDF file containing all gifts
      if (includePdfCatalog && pdfImages.length > 0) {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        let isFirst = true;

        for (const imgObj of pdfImages) {
          if (!isFirst) {
            pdf.addPage();
          }
          const ratio = Math.min(pdfWidth / imgObj.width, pdfHeight / imgObj.height);
          const finalWidth = imgObj.width * ratio;
          const finalHeight = imgObj.height * ratio;
          const x = (pdfWidth - finalWidth) / 2;
          const y = (pdfHeight - finalHeight) / 2;

          pdf.addImage(imgObj.bytes, 'PNG', x, y, finalWidth, finalHeight);
          isFirst = false;
        }

        const pdfArrayBuffer = pdf.output('arraybuffer');
        const pdfBytes = new Uint8Array(pdfArrayBuffer as ArrayBuffer);

        if (streamZip) {
          streamZip.addFile(`Gifts_Catalog.pdf`, pdfBytes);
        } else {
          capturedFiles.push({ name: `Gifts_Catalog.pdf`, blob: pdfBytes });
        }
      }

      if (streamZip) {
        await streamZip.close();
        downloadDesignerInfoFile(`Gift_Bundles.zip`, {
          format: 'Gift Bundles Batch (ZIP)',
          frames: activeItems.length
        });
      } else {
        const zip = new JSZip();
        for (const cf of capturedFiles) {
          zip.file(cf.name, cf.blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const zipName = `Gift_Bundles_${Date.now()}.zip`;
        a.download = zipName;
        a.click();
        URL.revokeObjectURL(url);
        downloadDesignerInfoFile(zipName, {
          format: 'Gift Bundles Batch (ZIP)',
          frames: activeItems.length
        });
      }
    } catch (err: any) {
      console.error("Batch Gift Bundle export failed:", err);
      alert("حدث خطأ أثناء تصدير حزم الهدايا: " + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsZipping(false);
      setExportProgress(0);
    }
  };

  const handleDownloadAllSvgaInOnePdf = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى رفع ملفات SVGA أولاً لتنزيلها في ملف PDF واحد.');
      return;
    }

    if (currentUser) {
      logActivity(currentUser, 'export', `All SVGA In One PDF Export: ${activeItems.length} items`);
    }

    const nameCounts: Record<string, number> = {};
    const uniqueNames: Record<string, string> = {};
    activeItems.forEach(item => {
      const cleanName = item.name.replace(/\.[^/.]+$/, '');
      if (nameCounts[cleanName]) {
        nameCounts[cleanName]++;
        uniqueNames[item.id] = `${cleanName}_${nameCounts[cleanName]}`;
      } else {
        nameCounts[cleanName] = 1;
        uniqueNames[item.id] = cleanName;
      }
    });

    setIsPdfAllInOneExporting(true);
    setPdfAllInOneProgress(2);

    try {
      const pdfItems: SvgaPdfItem[] = [];
      const BATCH_SIZE = 3;
      let completed = 0;

      for (let i = 0; i < activeItems.length; i += BATCH_SIZE) {
        const batch = activeItems.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item) => {
          try {
            const baseName = uniqueNames[item.id] || item.name.replace(/\.[^/.]+$/, '');
            const fileBuffer = await item.file.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);

            // Capture clearest, highest quality preview frame of the gift
            const bestImgBlob = await captureBestGiftFrame(item);
            const imgBuffer = await bestImgBlob.arrayBuffer();
            const coverBytes = new Uint8Array(imgBuffer);

            const videoItem = item.videoItem;
            const dw = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
            const dh = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);
            const frames = item.frames || videoItem?.frames || 1;
            const fps = item.fps || videoItem?.fps || 30;
            const duration = videoItem ? (videoItem.frames / (videoItem.fps || 30)) : (item.frames ? item.frames / 30 : 0);
            const hasAudio = !!(videoItem?.audios && Object.keys(videoItem.audios).length > 0) || !!item.hasAudio;

            pdfItems.push({
              id: item.id,
              name: baseName,
              fileBytes,
              coverBlob: bestImgBlob,
              coverBytes,
              dimensions: { width: dw, height: dh },
              frames,
              fps,
              duration,
              hasAudio,
              type: item.type
            });
          } catch (err) {
            console.warn(`Error preparing item ${item.name} for PDF package:`, err);
          } finally {
            completed++;
            setPdfAllInOneProgress(Math.min(45, Math.round((completed / activeItems.length) * 45)));
          }
        }));
      }

      if (pdfItems.length === 0) {
        throw new Error('تعذر تجهيز أي ملف من الملفات للـ PDF الموحد');
      }

      // Sort matching active items order in UI
      pdfItems.sort((a, b) => {
        const idxA = activeItems.findIndex(x => x.id === a.id);
        const idxB = activeItems.findIndex(x => x.id === b.id);
        return idxA - idxB;
      });

      const result = await generateSvgaAllInOnePdf({
        items: pdfItems,
        title: 'مكتبة هدايا SVGA الموحدة (جميع الملفات والصور)',
        designerName: currentUser?.displayName || currentUser?.email || 'SVGA Gift Designer',
        onProgress: (pct) => {
          setPdfAllInOneProgress(Math.min(99, Math.round(45 + pct * 0.54)));
        }
      });

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);

      downloadDesignerInfoFile(result.fileName, {
        format: 'All-in-One SVGA PDF Package',
        frames: pdfItems.length
      });

      setPdfAllInOneProgress(100);
    } catch (err: any) {
      console.error('All-in-One SVGA PDF export failed:', err);
      alert('حدث خطأ أثناء تصدير ملف الـ PDF الموحد: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsPdfAllInOneExporting(false);
      setPdfAllInOneProgress(0);
    }
  };


  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 transition-all duration-300 w-full">
      {/* Hidden File Input for SVGA/VAP/PAG/PDF/ZIP Uploads */}
      <input 
        ref={fileInputRef}
        type="file" 
        multiple 
        accept=".svga,.SVGA,.pag,.PAG,.vap,.VAP,.mp4,.MP4,.zip,.ZIP,.pdf,.PDF,application/pdf,*/*" 
        className="hidden" 
        onChange={(e) => {
          if (e.target.files) {
            const fileObjects = Array.from(e.target.files).map(file => ({ file }));
            handleFiles(fileObjects);
            e.target.value = '';
          }
        }}
      />

      {/* TOP HEADER SECTION */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Row 1: Header Title + Primary Quick Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900/90 border border-white/10 p-4 sm:p-5 rounded-3xl backdrop-blur-xl shadow-2xl">
          {/* Right side: Title & Stats */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">نظام العرض الذكي لملفات SVGA</h2>
                {(items as any[]).length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 rounded-full"
                  >
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                    <span className="text-xs font-black text-indigo-300">
                      {(items as any[]).length} {(items as any[]).length === 1 ? 'ملف مرفوع' : 'ملفات مرفوعة'}
                    </span>
                  </motion.div>
                )}
              </div>
              <p className="text-slate-400 font-bold text-xs mt-0.5">
                دعم كامل لجميع المقاسات (500×500, 750×1334, 2000×2000) مع الحفاظ على الجودة وتثبيت الأبعاد
              </p>
            </div>
          </div>

          {/* Center/Left: Master Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملفات</span>
            </button>

            {/* Upload Folders */}
            <button
              onClick={handleUploadFolders}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white rounded-xl font-black text-xs border border-white/15 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="رفع مجلد كامل بالملفات الفرعية"
            >
              <FolderUp className="w-4 h-4 text-sky-400" />
              <span>رفع مجلدات</span>
            </button>

            {/* Extract from PDF */}
            <button
              onClick={handleExtractFromPdf}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white rounded-xl font-black text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-amber-400/40"
              title="فك واستخراج هدايا SVGA من ملفات PDF المحمية والعادية بنقرة واحدة"
            >
              <Lock className="w-4 h-4 text-amber-200" />
              <span>فك من PDF</span>
            </button>

            {/* Deduplication Toggle */}
            <button
              onClick={handleToggleDeduplication}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs border flex items-center gap-2 transition-all cursor-pointer ${
                preventDuplicates 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-500/10' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title={preventDuplicates ? 'منع التكرار مفعل: يتم حذف وتصفية الملفات المكررة تلقائياً' : 'منع التكرار معطل: يسمح بتكرار الملفات'}
            >
              <ShieldCheck className={`w-4 h-4 ${preventDuplicates ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>منع التكرار: {preventDuplicates ? 'مفعل ✓' : 'معطل'}</span>
            </button>

            {/* Select All / Clear All */}
            {(items as any[]).length > 0 && (
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                  title="تحديد كل الملفات"
                >
                  <SquareCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تحديد الكل</span>
                </button>
                <div className="w-px h-4 bg-white/10" />
                <button
                  onClick={clearAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all flex items-center gap-1.5"
                  title="مسح وحذف جميع الملفات المعروضة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح الكل</span>
                </button>
              </div>
            )}

            {/* Optional Side Dock Toggle */}
            <button
              onClick={() => {
                setShowSideDock(prev => !prev);
                if (!showSideDock) setIsDockCollapsed(false);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                showSideDock 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="إظهار أو إخفاء لوحة العمليات الجانبية"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>لوحة جانبية</span>
            </button>
          </div>
        </div>

        {/* Deduplication Notification Banner if any */}
        {dedupNotice && (
          <div className="rounded-2xl p-3 px-4 bg-yellow-400/20 border-2 border-yellow-400 flex items-center justify-between gap-4 font-arabic shadow-xl shadow-yellow-500/10 backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <span className="text-xs font-black text-yellow-300">
                  {dedupNotice.count > 0 
                    ? `تم فحص الملفات وحذف ${dedupNotice.count} ملف مكرر بنجاح! تم الإبقاء على نسخة واحدة فقط.`
                    : 'تم الفحص بنجاح: جميع الملفات فريدة ولا يوجد أي تكرار!'}
                </span>
                {dedupNotice.names.length > 0 && (
                  <span className="text-[11px] text-slate-300">
                    الملفات المكررة:{' '}
                    <span className="text-yellow-200 font-bold">
                      {dedupNotice.names.slice(0, 4).join(', ')}
                      {dedupNotice.names.length > 4 ? ` و ${dedupNotice.names.length - 4} ملفات أخرى` : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setDedupNotice(null)}
              className="p-1 rounded-lg text-yellow-300 hover:text-white hover:bg-yellow-400/20 transition-colors"
              title="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Row 2: All Action & Export Buttons in Top Bar (إرجاع جميع الزرار بالأعلى كما طلب المستخدم) */}
        {(items as any[]).length > 0 && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-3 sm:p-4 rounded-3xl shadow-xl backdrop-blur-md flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            {/* Section 1: Packages, PDF & Bundles */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider pl-2 border-l border-white/10 hidden sm:inline">
                حزم وتصدير:
              </span>

              {/* Download Gift Bundles */}
              <button
                onClick={handleDownloadAllGiftBundles}
                disabled={isZipping || (items as any[]).length === 0}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تنزيل حزم الهدايا كاملة (ملف الهدية + أحلى صورة كادر داخل ZIP)"
              >
                {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                <span>تنزيل حزم الهدايا ZIP</span>
              </button>

              {/* All-in-One PDF */}
              <div className="flex items-center bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl shadow-md shadow-orange-600/20 overflow-hidden">
                <button
                  onClick={handleDownloadAllSvgaInOnePdf}
                  disabled={isPdfAllInOneExporting || (items as any[]).length === 0}
                  className="px-4 py-2 hover:bg-white/10 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer"
                  title="تصدير جميع الملفات في ملف PDF واحد ذكي مدمج"
                >
                  {isPdfAllInOneExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>{isPdfAllInOneExporting ? `جاري التصدير (${pdfAllInOneProgress}%)` : 'ملف PDF واحد موحد'}</span>
                </button>
                <label className="flex items-center gap-1.5 px-2.5 py-2 bg-black/20 hover:bg-black/30 text-amber-100 text-[10px] font-bold cursor-pointer border-r border-white/15" title="تضمين كتالوج PDF موحد داخل الحزمة">
                  <input
                    type="checkbox"
                    checked={includePdfCatalog}
                    onChange={() => setIncludePdfCatalog(!includePdfCatalog)}
                    className="w-3.5 h-3.5 accent-amber-400 rounded"
                  />
                  <span>كتالوج</span>
                </label>
              </div>

              {/* Download All SVGA ZIP */}
              <button
                onClick={handleDownloadAllSvga}
                disabled={isZipping || (items as any[]).length === 0}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تنزيل جميع ملفات SVGA / VAP الأصلية فقط في ملف ZIP"
              >
                <Download className="w-4 h-4" />
                <span>تنزيل كل الملفات (ZIP)</span>
              </button>

              {/* Download All Combined */}
              <button
                onClick={handleDownloadAllCombined}
                disabled={isZipping || (items as any[]).length === 0}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تنزيل شامل لجميع الملفات والصور والكتالوج"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>تنزيل الكل الشامل</span>
              </button>
            </div>

            {/* Section 2: Video Studio */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider pl-2 border-l border-white/10 hidden sm:inline">
                استوديو الفيديو:
              </span>

              {/* Convert VAP to MP4 */}
              <button
                onClick={handleExportAllVapToMp4}
                disabled={vapBatchProgress?.isOpen}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تحويل جميع ملفات VAP إلى MP4 بالصوت المدمج والشفافية"
              >
                {vapBatchProgress?.isOpen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4 text-purple-200" />}
                <span>{vapBatchProgress?.isOpen ? `تحويل (${vapBatchProgress.overallPercent}%)` : 'تحويل VAP ➔ MP4 بالصوت'}</span>
              </button>

              {/* Export Individual Videos ZIP */}
              <button
                onClick={() => handleExportIndividualVideos()}
                disabled={isExporting}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl font-black text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تصدير فيديو منفصل لكل ملف على حدة وتنزيلها مضغوطة في ملف ZIP"
              >
                <Film className="w-4 h-4 text-purple-400" />
                <span>فيديو منفصل لكل ملف (ZIP)</span>
              </button>

              {/* Record Grid Video */}
              <button
                onClick={handleExportGrid}
                disabled={isExporting}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="تسجيل وتصدير فيديو مجمع للشاشة بالكامل"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>{isExporting ? `تسجيل (${exportProgress}%)` : 'تسجيل فيديو مجمع (شاشة)'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Row 3: Display & Dimensions Control Studio (استوديو خانات العرض والمقاسات والتصدير - منظم بدون أي تداخل) */}
        {(items as any[]).length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-900/70 border border-white/10 p-3 sm:p-4 rounded-3xl backdrop-blur-md">
            {/* Box 1: Columns / Grid Slots Selector (خانات وأعمدة العرض) */}
            <div className="lg:col-span-3 bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  خانات العرض في الشاشة:
                </span>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-black">
                  {gridCols} {gridCols === 1 ? 'خانة' : gridCols === 2 ? 'خانتين' : `${gridCols} خانات`}
                </span>
              </div>

              {/* Quick Column Pills 1 to 6 */}
              <div className="flex items-center justify-between gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGridCols(num)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                      gridCols === num 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                    title={`عرض ${num} خانات متوازية بالكامل`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Stepper controls */}
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-400">
                <span>تحديد يدوي:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGridCols(prev => Math.max(1, prev - 1))}
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center font-black"
                    title="تقليل خانة"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={gridCols}
                    onChange={(e) => setGridCols(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                    className="w-10 bg-black/60 border border-white/20 text-white text-center rounded-lg py-1 font-mono font-bold text-xs"
                  />
                  <button
                    onClick={() => setGridCols(prev => Math.min(8, prev + 1))}
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center font-black"
                    title="زيادة خانة"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Box 2: Custom Dimensions, Presets & Aspect Ratio Lock (أبعاد العرض والمقاسات) */}
            <div className="lg:col-span-6 bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-purple-400" />
                  أبعاد ومقاسات العرض (W × H):
                </span>
                {isCustomDimensionsActive && (
                  <button
                    onClick={() => {
                      setIsCustomDimensionsActive(false);
                      setCustomWidth(null);
                      setCustomHeight(null);
                      setSelectedPresetId('auto');
                      setItems(prev => prev.map(i => ({ ...i, presetId: 'auto' })));
                    }}
                    className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                    title="إلغاء المقاس المخصص والعودة للوضع التلقائي"
                  >
                    <X className="w-3 h-3" />
                    <span>إلغاء المخصص</span>
                  </button>
                )}
              </div>

              {/* Inputs row: Width + Aspect Ratio Lock + Height + Fit Mode */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Width */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-purple-500/40 rounded-xl px-2.5 py-1 flex-1 min-w-[100px]">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">عرض (W):</span>
                  <input 
                    type="number" 
                    placeholder="العرض"
                    value={customWidth || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val > 0) {
                        setCustomWidth(val);
                        if (lockAspectRatio && customWidth && customHeight) {
                          const ratio = customHeight / customWidth;
                          setCustomHeight(Math.round(val * ratio));
                        }
                        setIsCustomDimensionsActive(true);
                      } else {
                        setCustomWidth(null);
                        setIsCustomDimensionsActive((customHeight || 0) > 0);
                      }
                    }}
                    className="w-full bg-transparent text-white font-mono font-black text-xs text-center focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500 font-mono">px</span>
                </div>

                {/* Aspect Ratio Lock Toggle */}
                <button
                  type="button"
                  onClick={() => setLockAspectRatio(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 border ${
                    lockAspectRatio 
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md shadow-purple-500/20' 
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                  title={lockAspectRatio ? 'نسبة الأبعاد مقفلة (تغيير العرض يغير الارتفاع تلقائياً)' : 'نسبة الأبعاد حرة'}
                >
                  {lockAspectRatio ? <Lock className="w-3.5 h-3.5 text-purple-300" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-[10px] hidden sm:inline">{lockAspectRatio ? 'نسبة مقفلة' : 'نسبة حرة'}</span>
                </button>

                {/* Height */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-purple-500/40 rounded-xl px-2.5 py-1 flex-1 min-w-[100px]">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">طول (H):</span>
                  <input 
                    type="number" 
                    placeholder="الارتفاع"
                    value={customHeight || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val > 0) {
                        setCustomHeight(val);
                        if (lockAspectRatio && customWidth && customHeight) {
                          const ratio = customWidth / customHeight;
                          setCustomWidth(Math.round(val * ratio));
                        }
                        setIsCustomDimensionsActive(true);
                      } else {
                        setCustomHeight(null);
                        setIsCustomDimensionsActive((customWidth || 0) > 0);
                      }
                    }}
                    className="w-full bg-transparent text-white font-mono font-black text-xs text-center focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-500 font-mono">px</span>
                </div>

                {/* Fit Mode */}
                <select
                  value={fitMode}
                  onChange={(e) => setFitMode(e.target.value as any)}
                  className="bg-slate-900 border border-purple-500/40 rounded-xl text-[10px] font-black text-purple-200 px-2 py-1.5 focus:outline-none"
                  title="طريقة ملاءمة واحتواء العمل داخل الإطار"
                >
                  <option value="contain" className="bg-slate-900 text-white">احتواء كامل (AspectFit)</option>
                  <option value="cover" className="bg-slate-900 text-white">تعبئة وتغطية (Cover)</option>
                  <option value="fill" className="bg-slate-900 text-white">تمدد كامل (Fill)</option>
                </select>
              </div>

              {/* Quick Presets Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button 
                  onClick={() => {
                    setSelectedPresetId('ip8');
                    setCustomWidth(750);
                    setCustomHeight(1334);
                    setIsCustomDimensionsActive(true);
                    setItems(prev => prev.map(i => ({ ...i, presetId: 'ip8' })));
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                    (customWidth === 750 && customHeight === 1334) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  750 × 1334
                </button>
                <button 
                  onClick={() => {
                    setSelectedPresetId('sq500');
                    setCustomWidth(500);
                    setCustomHeight(500);
                    setIsCustomDimensionsActive(true);
                    setItems(prev => prev.map(i => ({ ...i, presetId: 'sq500' })));
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                    (customWidth === 500 && customHeight === 500) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  500 × 500
                </button>
                <button 
                  onClick={() => {
                    setSelectedPresetId('custom750x240');
                    setCustomWidth(750);
                    setCustomHeight(240);
                    setIsCustomDimensionsActive(true);
                    setItems(prev => prev.map(i => ({ ...i, presetId: 'custom750x240' })));
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                    (customWidth === 750 && customHeight === 240) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  750 × 240
                </button>
                <button 
                  onClick={() => {
                    setCustomWidth(200);
                    setCustomHeight(200);
                    setIsCustomDimensionsActive(true);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                    (customWidth === 200 && customHeight === 200) ? 'bg-purple-600 text-white shadow-sm' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  200 × 200 (أفاتار)
                </button>
                <button 
                  onClick={() => {
                    setSelectedPresetId('auto');
                    setCustomWidth(null);
                    setCustomHeight(null);
                    setIsCustomDimensionsActive(false);
                    setItems(prev => prev.map(i => ({ ...i, presetId: 'auto' })));
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                    !isCustomDimensionsActive && selectedPresetId === 'auto' ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  تلقائي
                </button>

                {/* Native Presets Dropdown */}
                <div className="relative inline-block mr-auto">
                  <button 
                    onClick={() => setShowPresetMenu(!showPresetMenu)}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 rounded-lg text-[10px] font-black flex items-center gap-1 transition-colors"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>{selectedPreset ? selectedPreset.name : 'قائمة الأجهزة'}</span>
                  </button>

                  <AnimatePresence>
                    {showPresetMenu && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setShowPresetMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full right-0 mt-2 w-[550px] max-h-[450px] bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden z-[110] flex flex-col"
                        >
                          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <h4 className="text-white font-black text-xs flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-indigo-500" />
                              اختر مقاس العرض المفضل
                            </h4>
                            <button onClick={() => { setSelectedPresetId('auto'); setShowPresetMenu(false); }} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase">
                              إعادة للوضع التلقائي
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {['iPhone', 'Android', 'Tablet', 'PC'].map(cat => (
                              <div key={cat} className="mb-6 last:mb-0">
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                  {cat === 'iPhone' ? 'سلسلة آيفون' : cat === 'Android' ? 'سلسلة أندرويد' : cat === 'Tablet' ? 'الأجهزة اللوحية' : 'الكمبيوتر'}
                                </h5>
                                <div className="grid grid-cols-3 gap-2">
                                  {DEVICE_PRESETS.filter(p => p.category === cat).map(preset => (
                                    <button
                                      key={preset.id}
                                      onClick={() => {
                                        setSelectedPresetId(preset.id);
                                        setShowPresetMenu(false);
                                      }}
                                      className={`px-2.5 py-2 rounded-xl text-[10px] font-bold text-right transition-all border ${selectedPresetId === preset.id ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                    >
                                      <div className="flex flex-col">
                                        <span>{preset.name}</span>
                                        <span className="text-[8px] opacity-50">{preset.width} × {preset.height}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Box 3: Video Export & Encoding Settings (إعدادات تصدير وجودة الفيديو) */}
            <div className="lg:col-span-3 bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  إعدادات وجودة التصدير:
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  {exportFormat.toUpperCase()} • {exportResolution}
                </span>
              </div>

              {/* Dropdowns */}
              <div className="grid grid-cols-3 gap-1.5">
                <select 
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'mp4' | 'webm' | 'vap' | 'yyeva')}
                  className="bg-slate-900 border border-white/15 rounded-xl text-[10px] font-black text-white px-2 py-1.5 focus:outline-none"
                  title="صيغة التصدير"
                >
                  <option value="mp4" className="bg-slate-900 text-white">MP4</option>
                  <option value="webm" className="bg-slate-900 text-white">WebM</option>
                  <option value="vap" className="bg-slate-900 text-white">VAP (.mp4)</option>
                  <option value="yyeva" className="bg-slate-900 text-white">YYEVA (.mp4)</option>
                </select>

                <select 
                  value={exportResolution}
                  onChange={(e) => setExportResolution(e.target.value as 'natural' | '720p' | '1080p')}
                  className="bg-slate-900 border border-white/15 rounded-xl text-[10px] font-black text-white px-2 py-1.5 focus:outline-none"
                  title="دقة التصدير"
                >
                  <option value="natural" className="bg-slate-900 text-white">طبيعي</option>
                  <option value="720p" className="bg-slate-900 text-white">720p</option>
                  <option value="1080p" className="bg-slate-900 text-white">1080p</option>
                </select>

                <select 
                  value={exportQuality}
                  onChange={(e) => setExportQuality(e.target.value as 'high' | 'medium' | 'low')}
                  className="bg-slate-900 border border-white/15 rounded-xl text-[10px] font-black text-amber-300 px-1.5 py-1.5 focus:outline-none"
                  title="حجم وضغط الفيديو"
                >
                  <option value="medium" className="bg-slate-900 text-white">⚡ متوازن</option>
                  <option value="low" className="bg-slate-900 text-white">🚀 فائق الضغط</option>
                  <option value="high" className="bg-slate-900 text-white">💎 أعلى جودة</option>
                </select>
              </div>

              {/* Checkbox Options */}
              <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={forceMobileSize}
                    onChange={(e) => setForceMobileSize(e.target.checked)}
                    className="w-3.5 h-3.5 accent-indigo-500 rounded"
                  />
                  <span>تصدير لمقاس جوال (9:16)</span>
                </label>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useNativeDuration}
                      onChange={(e) => setUseNativeDuration(e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-500 rounded"
                    />
                    <span>بالمدة الأصلية</span>
                  </label>
                  {!useNativeDuration && (
                    <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        min="1" 
                        max="60"
                        value={exportDuration}
                        onChange={(e) => setExportDuration(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-10 bg-slate-900 border border-white/20 text-white text-center rounded py-0.5 font-mono text-[10px]"
                      />
                      <span className="text-[9px] text-slate-500">ثواني</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Toolbar: Background & Watermark */}
      <div className="flex flex-col gap-6 mb-6 bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
        
        {pdfStatusMessage && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 mb-2 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <span className="text-sm font-bold text-amber-200">{pdfStatusMessage}</span>
          </div>
        )}

        {loadProgress && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex flex-col gap-2 mb-4">
            <div className="flex justify-between items-center text-xs font-black">
              <span className="text-white flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                جاري فحص وتحميل الملفات... ({Math.round((loadProgress.current / loadProgress.total) * 100)}%)
              </span>
              <span className="text-indigo-400 font-mono">
                {loadProgress.current} من أصل {loadProgress.total}
              </span>
            </div>
            <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(loadProgress.current / loadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3 border-r border-white/10 pr-6">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الخلفية:</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPreviewBg(null)}
                className={`w-10 h-10 rounded-xl border transition-all ${!previewBg ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10 bg-white/5'}`}
                title="شفاف"
              >
                <X className="w-4 h-4 mx-auto text-slate-400" />
              </button>
              {presetBgs.slice(0, 5).map(bg => (
                <button 
                  key={bg.id}
                  onClick={() => setPreviewBg(bg.url)}
                  className={`w-10 h-10 rounded-xl border relative overflow-hidden transition-all ${previewBg === bg.url ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/10'}`}
                >
                  <img src={bg.url} alt={bg.label || "Background"} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
              <button 
                onClick={() => bgInputRef.current?.click()}
                className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                title="خلفية مخصصة"
              >
                <ImageIcon className="w-4 h-4 text-slate-400" />
              </button>
              <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setPreviewBg(URL.createObjectURL(e.target.files[0]))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">العلامة المائية:</span>
            <button 
              onClick={() => watermarkInputRef.current?.click()}
              className={`px-5 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 ${watermark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              {watermark ? 'تم التحديد' : 'رفع شعار'}
            </button>
            {watermark && (
              <div className="flex items-center gap-4 ml-2">
                <select 
                  value={wmSettings.position}
                  onChange={(e) => setWmSettings(prev => ({ ...prev, position: e.target.value as any }))}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                  disabled={wmSettings.isAnimated}
                >
                  <option value="top-left">أعلى يسار</option>
                  <option value="top-right">أعلى يمين</option>
                  <option value="bottom-left">أسفل يسار</option>
                  <option value="bottom-right">أسفل يمين</option>
                  <option value="center">منتصف</option>
                </select>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase font-black">الحجم</span>
                  <input 
                    type="range" min="5" max="100" value={wmSettings.size} 
                    onChange={(e) => setWmSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                    className="w-16 accent-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 uppercase font-black">الشفافية</span>
                  <input 
                    type="range" min="0.1" max="1" step="0.1" value={wmSettings.opacity} 
                    onChange={(e) => setWmSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-16 accent-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 border-r border-white/10 pr-4 ml-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={wmSettings.isAnimated}
                      onChange={(e) => setWmSettings(prev => ({ ...prev, isAnimated: e.target.checked }))}
                      className="accent-indigo-500"
                    />
                    <span className="text-[10px] text-slate-300 font-bold">متحرك</span>
                  </label>
                  {wmSettings.isAnimated && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[8px] text-slate-500 uppercase font-black">السرعة</span>
                      <input 
                        type="range" min="1" max="10" value={wmSettings.animationSpeed} 
                        onChange={(e) => setWmSettings(prev => ({ ...prev, animationSpeed: parseInt(e.target.value) }))}
                        className="w-16 accent-indigo-500"
                      />
                    </div>
                  )}
                </div>
                <button onClick={() => setWatermark(null)} className="text-red-500 hover:text-red-400 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input type="file" ref={watermarkInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setWatermark(URL.createObjectURL(e.target.files[0]))} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 min-h-[400px] rounded-[3rem] border-2 border-dashed transition-all duration-500 relative overflow-hidden
          ${isDragging ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5 bg-white/2'}
          ${(items as any[]).length === 0 ? 'flex items-center justify-center' : ''}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {(items as any[]).length === 0 ? (
          <div className="text-center p-12 flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 bg-white/5 hover:bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/10 cursor-pointer transition-all hover:scale-105"
            >
              <Upload className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">اسحب الملفات أو المجلدات أو ملفات PDF هنا للبدء</h3>
            <p className="text-slate-400 text-sm font-bold tracking-wide max-w-lg mb-6">يدعم ملفات SVGA, VAP, PAG, ZIP واستدعاء وفك ملفات PDF المقفولة واستخراج الـ SVGA منها</p>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>استعراض واختيار الملفات</span>
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = '.pdf,.PDF,application/pdf,*/*';
                  input.onchange = (e: any) => {
                    if (e.target.files) {
                      const fileObjects = Array.from(e.target.files as FileList).map(file => ({ file }));
                      handleFiles(fileObjects);
                    }
                  };
                  input.click();
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-rose-400/30"
              >
                <Lock className="w-4 h-4 text-amber-200" />
                <span>فك واستخراج من PDF</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar flex flex-col gap-12">
            {Object.entries(
              items.reduce((acc, item) => {
                const folder = item.folderPath || 'الملفات العامة';
                if (!acc[folder]) acc[folder] = [];
                acc[folder].push(item);
                return acc;
              }, {} as Record<string, MultiSvgaItem[]>)
            ).map(([folderPath, folderItems]) => (
              <div key={folderPath} className="flex flex-col gap-4">
                {folderPath !== 'الملفات العامة' && (
                  <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                    <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">{folderPath.split('/').pop()}</h3>
                    <span className="text-xs text-slate-400 font-bold bg-white/5 px-2 py-1 rounded-md">{(folderItems as any[]).length} ملفات</span>
                  </div>
                )}
                <div 
                  className="grid gap-5 sm:gap-6 w-full"
                  style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
                >
                  <AnimatePresence mode="popLayout">
                    {(folderItems as any[]).map((item) => (
                      <SvgaCard 
                        key={`${item.id}-${item.presetId}-${customWidth}-${customHeight}-${gridCols}`} 
                        item={item} 
                        gridCols={gridCols}
                        customDimensions={isCustomDimensionsActive && customWidth && customHeight ? { width: customWidth, height: customHeight } : null}
                        onRemove={() => removeItem(item.id)} 
                        onMaximize={() => setSelectedItemId(item.id)}
                        onDownload={() => handleDownloadSingleImage(item)}
                        onDownloadSvga={() => handleDownloadSvga(item)}
                        onDownloadGiftBundle={() => handleDownloadSingleGiftBundle(item)}
                        onExportVideo={() => handleExportIndividualVideos([item])}
                        previewBg={previewBg}
                        watermark={watermark}
                        wmSettings={wmSettings}
                        onUpdatePreset={(presetId) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, presetId } : i))}
                        isSelected={selectedItemIds.has(item.id)}
                        onToggleSelect={() => handleToggleSelect(item.id)}
                        onUpdateItem={(updates) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...updates } : i))}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {selectedItemId && selectedItem && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItemId(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl aspect-video sm:aspect-auto sm:h-full bg-slate-900 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{selectedItem.name}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">عرض كامل للملف بالمقاس الأصلي</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedItemId(null)}
                  className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 relative flex items-center justify-center p-10 overflow-hidden">
                <div 
                  className="relative shadow-2xl rounded-2xl overflow-hidden flex items-center justify-center"
                  style={{ 
                    width: '100%',
                    height: '100%',
                    maxWidth: selectedItem.dimensions?.width || 500,
                    maxHeight: selectedItem.dimensions?.height || 500,
                    aspectRatio: `${selectedItem.dimensions?.width || 500} / ${selectedItem.dimensions?.height || 500}`
                  }}
                >
                  {previewBg && <img src={previewBg} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0" referrerPolicy="no-referrer" />}
                  <SvgaPlayer item={selectedItem} />
                  {watermark && <WatermarkOverlay watermark={watermark} settings={wmSettings} />}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-white/5 border-t border-white/5 flex flex-col sm:flex-row gap-6 items-center justify-between">
                <div className="flex gap-6">
                  <InfoItem label="المقاس" value={`${selectedItem.dimensions?.width || 500} × ${selectedItem.dimensions?.height || 500}`} />
                  <InfoItem label="الإطارات" value={selectedItem.frames} />
                  <InfoItem label="السرعة" value={`${selectedItem.fps} FPS`} />
                  <InfoItem label="المدة" value={`${(selectedItem.frames / selectedItem.fps).toFixed(2)}s`} />
                </div>
                
                {/* Audio Extractor display and Export Button */}
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => handleDownloadSingleGiftBundle(selectedItem)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
                    title="تنزيل ملف الهدية مع أفضل صورة كادر واضحة للهدية في ملف مضغوط ZIP"
                  >
                    <Gift className="w-5 h-5" />
                    حزمة الهدية (الملف + أحلى صورة)
                  </button>
                  <button
                    onClick={() => {
                      if (selectedItem.type === 'vap') {
                        handleExportSingleVap(selectedItem);
                      } else {
                        handleExportIndividualVideos([selectedItem]);
                      }
                    }}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    <Video className="w-5 h-5" />
                    {selectedItem.type === 'vap' ? 'تصدير VAP إلى MP4' : 'تصدير كفيديو MP4'}
                  </button>
                  <EmbeddedAudioPlayer item={selectedItem} />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VAP Batch Export Progress Modal */}
      <AnimatePresence>
        {vapBatchProgress?.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 text-right"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Video className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">تصدير VAP إلى MP4</h3>
                    <p className="text-xs text-slate-400 font-bold">معالجة وتصدير ملفات VAP مع الصوت والألفا</p>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {vapBatchProgress.completed} / {vapBatchProgress.total}
                </span>
              </div>

              {/* Progress info */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <span>الملف الحالي: <span className="text-white font-black">{vapBatchProgress.currentFileName}</span></span>
                  <span className="text-indigo-400 font-black">{vapBatchProgress.currentPercent}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
                    style={{ width: `${vapBatchProgress.currentPercent}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <p className="text-xs text-slate-400">{vapBatchProgress.statusMessage}</p>
              </div>

              {/* File list status */}
              <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2 p-2 bg-slate-950/60 rounded-2xl border border-white/5">
                {vapBatchProgress.fileStatuses.map((fs) => (
                  <div key={fs.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-white/[0.02]">
                    <span className="text-slate-300 truncate max-w-[200px]">{fs.name}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      fs.status === 'done' ? 'bg-emerald-500/20 text-emerald-300' :
                      fs.status === 'processing' ? 'bg-indigo-500/20 text-indigo-300 animate-pulse' :
                      fs.status === 'error' ? 'bg-red-500/20 text-red-300' :
                      'bg-slate-700/40 text-slate-400'
                    }`}>
                      {fs.status === 'done' ? 'اكتمل' : fs.status === 'processing' ? 'جارِ التصدير...' : fs.status === 'error' ? 'فشل' : 'في الانتظار'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Close Button when done */}
              {vapBatchProgress.completed === vapBatchProgress.total && (
                <button
                  onClick={() => setVapBatchProgress(null)}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-lg transition-all"
                >
                  تم، إغلاق النافذة
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Locked PDF Password Prompt Modal */}
      <AnimatePresence>
        {pdfPasswordRequest && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl shadow-amber-500/10 flex flex-col gap-5 text-right font-arabic"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-lg font-black text-white">ملف PDF محمي بكلمة مرور</h3>
                  <p className="text-xs text-slate-400 font-bold truncate max-w-[280px]">
                    {pdfPasswordRequest.fileName}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-bold">
                هذا الملف مقفول برمز حماية. أدخل كلمة المرور أدناه لفك تشفيره واستخراج جميع ملفات الـ SVGA المضمنة بداخله:
              </p>

              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input
                    type="password"
                    value={pdfInputPassword}
                    onChange={(e) => {
                      setPdfInputPassword(e.target.value);
                      setPdfPasswordError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUnlockPdf();
                    }}
                    placeholder="أدخل كلمة مرور ملف PDF..."
                    className="w-full px-4 py-3 bg-black/50 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    autoFocus
                  />
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                </div>
                {pdfPasswordError && (
                  <span className="text-xs text-rose-400 font-bold">
                    كلمة المرور غير صحيحة، يرجى إعادة المحاولة أو تخطي الملف.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleUnlockPdf}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>فك القفل واستخراج SVGA</span>
                </button>
                <button
                  onClick={handleSkipPdfPassword}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  تخطي
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Right Fixed Action Dock (Optional Overlay) */}
      {showSideDock && (
        <SvgaActionDock 
          itemsCount={(items as any[]).length}
          selectedCount={selectedItemIds.size}
          allSelected={selectedItemIds.size === (items as any[]).length && (items as any[]).length > 0}
          onSelectAll={handleSelectAll}
          onClearAll={clearAll}
          preventDuplicates={preventDuplicates}
          onToggleDeduplication={handleToggleDeduplication}
          includePdfCatalog={includePdfCatalog}
          onToggleIncludePdfCatalog={() => setIncludePdfCatalog(!includePdfCatalog)}
          isZipping={isZipping}
          isExporting={isExporting}
          isPdfAllInOneExporting={isPdfAllInOneExporting}
          exportProgress={exportProgress}
          pdfAllInOneProgress={pdfAllInOneProgress}
          vapBatchProgress={vapBatchProgress}
          onDownloadGiftBundles={handleDownloadAllGiftBundles}
          onDownloadAllSvgaInOnePdf={handleDownloadAllSvgaInOnePdf}
          onDownloadAllCombined={handleDownloadAllCombined}
          onDownloadAllSvga={handleDownloadAllSvga}
          onExportAllVapToMp4={handleExportAllVapToMp4}
          onExportIndividualVideos={() => handleExportIndividualVideos()}
          onExportGrid={handleExportGrid}
          onUploadFiles={() => fileInputRef.current?.click()}
          onUploadFolders={handleUploadFolders}
          onExtractFromPdf={handleExtractFromPdf}
          isCollapsed={isDockCollapsed}
          onToggleCollapse={setIsDockCollapsed}
        />
      )}
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="text-center sm:text-right">
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{label}</p>
    <p className="text-lg text-white font-black">{value}</p>
  </div>
);

const SvgaPlayer: React.FC<{ item: any }> = ({ item }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const selectedPreset = useMemo(() => DEVICE_PRESETS.find(p => p.id === item.presetId), [item.presetId]);

  const pagSurfaceRef = useRef<any>(null);

  useEffect(() => {
    let isCanceled = false;

    const loadAndPlay = async () => {
      if (!containerRef.current || !wrapperRef.current) return;

      if (item.type === "vap") {
        containerRef.current.innerHTML = "";

        let vapConfig = item.vapConfig;
        if (!vapConfig) {
          try {
            vapConfig = await extractVapConfigFromBlob(item.file);
            item.vapConfig = vapConfig;
          } catch(e) {}
        }

        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = false;
        video.playsInline = true;
        video.src = item.url;

        let animId = 0;
        let webgl: WebGLVapRenderer | null = null;

        video.onloadedmetadata = () => {
          if (isCanceled || !containerRef.current) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
          let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

          if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
            rgbRect = [0, 0, vw, Math.round(vh / 2)];
            alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
          }
          let cfgW = rgbRect[2];
          let cfgH = rgbRect[3];

          if (!item.dimensions) {
            item.dimensions = { width: cfgW, height: cfgH };
            item.fps = vapConfig?.info?.f || 24;
            item.frames = Math.floor((video.duration || 3) * item.fps);
          }
          if (!isCanceled) setIsLoaded(true);

          try {
            webgl = new WebGLVapRenderer(cfgW, cfgH);
            webgl.canvas.style.width = '100%';
            webgl.canvas.style.height = '100%';
            webgl.canvas.style.objectFit = 'contain';
            containerRef.current?.appendChild(webgl.canvas);
          } catch (e) {
            console.error("WebGL VAP error", e);
          }

          const rawVideoW = vapConfig?.info?.videoW || vw;
          const rawVideoH = vapConfig?.info?.videoH || vh;
          const scaleX = vw / (rawVideoW || vw);
          const scaleY = vh / (rawVideoH || vh);
          const srcRgbX = Math.round(rgbRect[0] * scaleX);
          const srcRgbY = Math.round(rgbRect[1] * scaleY);
          const srcRgbW = Math.round(rgbRect[2] * scaleX);
          const srcRgbH = Math.round(rgbRect[3] * scaleY);
          const srcAlphaX = Math.round(alphaRect[0] * scaleX);
          const srcAlphaY = Math.round(alphaRect[1] * scaleY);
          const srcAlphaW = Math.round(alphaRect[2] * scaleX);
          const srcAlphaH = Math.round(alphaRect[3] * scaleY);

          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });

          const renderFrame = () => {
            if (isCanceled) return;
            if (webgl && video.readyState >= 2) {
              webgl.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], 10, true);
            }
            animId = requestAnimationFrame(renderFrame);
          };
          animId = requestAnimationFrame(renderFrame);
        };

        playerRef.current = {
          video,
          stopAnimation: () => {
            cancelAnimationFrame(animId);
            video.pause();
          },
          pauseAnimation: () => {
            video.pause();
          },
          startAnimation: () => {
            video.play().catch(() => {});
          },
          destroy: () => {
            cancelAnimationFrame(animId);
            video.pause();
          }
        };

        return;
      }
      
      if (item.type === "pag") {
        let pagFile = item.pagFile;
        if (!pagFile) {
          try {
            const PAG = await getPAG();
            pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
            item.pagFile = pagFile;
            if (!item.dimensions) {
              item.dimensions = { width: pagFile.width(), height: pagFile.height() };
              item.fps = pagFile.frameRate() || 30;
              item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);
            }
            if (!isCanceled) setIsLoaded(true);
          } catch(e) {
            console.error(e);
            return;
          }
        }
        if (isCanceled || !containerRef.current) return;
        
        if (!playerRef.current) {
          containerRef.current.innerHTML = "";
          const canvas = document.createElement("canvas");
          const canvasId = "pag_player_" + Math.random().toString(36).substring(2, 9);
          canvas.id = canvasId;
          canvas.width = item.dimensions?.width || 500;
          canvas.height = item.dimensions?.height || 500;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.objectFit = "contain";
          containerRef.current.appendChild(canvas);
          
          const PAG = await getPAG();
          const pagPlayer = await PAG.PAGPlayer.create();
          pagPlayer.setComposition(pagFile);
          const pagSurface = PAG.PAGSurface.fromCanvas('#' + canvasId);
          if (pagSurface) {
            pagSurface.updateSize();
            pagSurfaceRef.current = pagSurface;
            pagPlayer.setSurface(pagSurface);
          }
          pagPlayer.setVideoEnabled(true);
          pagPlayer.setProgress(0);
          await pagPlayer.flush();
          playerRef.current = pagPlayer;
          
          const durationMs = (pagFile.duration() / 1000) || 3000;
          let accumulatedTime = 0;
          let lastTime = Date.now();
          
          const renderLoop = async () => {
            if (isCanceled) return;
            const now = Date.now();
            const delta = now - lastTime;
            lastTime = now;
            
            if (playerRef.current) {
              accumulatedTime += delta;
              const progress = (accumulatedTime % durationMs) / durationMs;
              playerRef.current.setProgress(progress);
              await playerRef.current.flush();
            }
            requestAnimationFrame(renderLoop);
          };
          renderLoop();
        }
        return;
      }

      let videoItem = item.videoItem;
      if (!videoItem) {
        try {
          videoItem = await new Promise((resolve, reject) => {
            const parser = new SVGA.Parser();
            const bypassUrl = item.url + "#" + Math.random().toString(36).substr(2, 9);
            parser.load(bypassUrl, (vi: any) => {
              if (!vi || !vi.images) return reject(new Error("Invalid SVGA"));
              resolve(vi);
            }, reject);
          });
          item.videoItem = videoItem;
          if (!isCanceled) setIsLoaded(true);
        } catch(e) {
          console.error(e);
          return;
        }
      }

      if (isCanceled || !containerRef.current) return;
      
      if (!playerRef.current) {
        containerRef.current.innerHTML = "";
        const player = new SVGA.Player(containerRef.current);
        playerRef.current = player;
        player.setContentMode("Fill");
        player.setVideoItem(videoItem);
        player.startAnimation();
      }
    };

    loadAndPlay();
    return () => { 
      isCanceled = true; 
      if (playerRef.current) {
        if (item.type === "pag") {
          try { playerRef.current.destroy?.(); } catch (e) {}
          try { pagSurfaceRef.current?.destroy?.(); } catch (e) {}
        }
        else playerRef.current.stopAnimation();
        playerRef.current = null;
        pagSurfaceRef.current = null;
      }
    };
  }, [item.url, item.type]); // Removed isLoaded
  useEffect(() => {
    const updateCanvasStyles = () => {
      if (!wrapperRef.current || !containerRef.current) return;
      
      const wrapperWidth = wrapperRef.current.clientWidth;
      const wrapperHeight = wrapperRef.current.clientHeight;
      const sw = item.dimensions?.width || item.videoItem?.videoSize?.width || 500;
      const sh = item.dimensions?.height || item.videoItem?.videoSize?.height || 500;

      // Fixed container dimensions as requested
      const containerWidth = selectedPreset ? selectedPreset.width : sw;
      const containerHeight = selectedPreset ? selectedPreset.height : sh;

      // 1. Scale the SVGA to fit inside the fixed 1334x750 container
      const svgaScale = Math.min(containerWidth / sw, containerHeight / sh);
      const finalSvgaWidth = sw * svgaScale;
      const finalSvgaHeight = sh * svgaScale;

      // 2. Scale the fixed 1334x750 container to fit inside the screen wrapper
      const wrapperScale = Math.min(wrapperWidth / containerWidth, wrapperHeight / containerHeight);

      // Size the inner container to exactly match the scaled SVGA dimensions
      // and scale it down to fit the wrapper
      Object.assign(containerRef.current.style, {
        width: `${finalSvgaWidth}px`,
        height: `${finalSvgaHeight}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) scale(${wrapperScale})`,
        transformOrigin: 'center center',
        zIndex: '1'
      });

      const canvas = containerRef.current.querySelector('canvas');
      if (canvas) {
        Object.assign(canvas.style, {
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'fill'
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasStyles();
    });

    resizeObserver.observe(wrapperRef.current);

    const mutationObserver = new MutationObserver(() => {
      updateCanvasStyles();
    });
    
    mutationObserver.observe(containerRef.current, { childList: true, subtree: true });

    updateCanvasStyles();
    const timer = setTimeout(updateCanvasStyles, 100);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(timer);
    };
  }, [item.videoItem, selectedPreset, isLoaded]); // Re-run when videoItem is loaded

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden flex items-center justify-center">
      <div ref={containerRef} className="relative" />
    </div>
  );
};

const SvgaCard: React.FC<{ 
  item: MultiSvgaItem; 
  customDimensions?: { width: number; height: number } | null;
  gridCols?: number;
  onRemove: () => void; 
  onMaximize: () => void;
  onDownload: () => void;
  onDownloadSvga: () => void;
  onDownloadGiftBundle?: () => void;
  onExportVideo?: () => void;
  previewBg: string | null;
  watermark: string | null;
  wmSettings: any;
  onUpdatePreset: (presetId: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onUpdateItem?: (updates: Partial<MultiSvgaItem>) => void;
}> = ({ item, customDimensions, gridCols, onRemove, onMaximize, onDownload, onDownloadSvga, onDownloadGiftBundle, onExportVideo, previewBg, watermark, wmSettings, onUpdatePreset, isSelected, onToggleSelect, onUpdateItem }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showItemControls, setShowItemControls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
    
  // Derived properties
  const itemWidth = item.dimensions?.width || 500;
  const itemHeight = item.dimensions?.height || 500;
  const itemFrames = item.frames || 1;
  const itemFps = item.fps || 30;
  const isPortrait = itemHeight > itemWidth;
  const selectedPreset = useMemo(() => DEVICE_PRESETS.find(p => p.id === item.presetId), [item.presetId]);

    const [isVisible, setIsVisible] = useState(false);

  const isPlayingRef = useRef(isPlaying);
  const pagSurfaceRef = useRef<any>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        setIsVisible(entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '300px' });
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCanceled = false;

    const loadAndPlay = async () => {
      if (!isVisible) {
        if (playerRef.current) {
          if (item.type === "pag") {
            try { playerRef.current.destroy?.(); } catch (e) {}
            try { pagSurfaceRef.current?.destroy?.(); } catch (e) {}
          } else if (item.type === "vap") {
            try { playerRef.current.stopAnimation?.(); } catch (e) {}
          }
          else playerRef.current.stopAnimation();
          playerRef.current = null;
          pagSurfaceRef.current = null;
        }
        if (containerRef.current) containerRef.current.innerHTML = "";
        return;
      }

      if (item.type === "vap") {
        let vapConfig = item.vapConfig;
        if (!vapConfig) {
          try {
            vapConfig = await extractVapConfigFromBlob(item.file);
            item.vapConfig = vapConfig;
          } catch(e) {}
        }

        if (isCanceled || !containerRef.current) return;
        setHasAudio(true);

        if (!playerRef.current) {
          containerRef.current.innerHTML = "";

          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.src = item.url;

          let animId = 0;
          let webgl: WebGLVapRenderer | null = null;

          video.onloadedmetadata = () => {
            if (isCanceled || !containerRef.current) return;
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
            let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

            if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
              rgbRect = [0, 0, vw, Math.round(vh / 2)];
              alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
            }
            let cfgW = rgbRect[2];
            let cfgH = rgbRect[3];

            if (!item.dimensions) {
              item.dimensions = { width: cfgW, height: cfgH };
              item.fps = vapConfig?.info?.f || 24;
              item.frames = Math.floor((video.duration || 3) * item.fps);
            }
            if (!isCanceled) setIsLoaded(true);

            try {
              webgl = new WebGLVapRenderer(cfgW, cfgH);
              webgl.canvas.style.width = '100%';
              webgl.canvas.style.height = '100%';
              webgl.canvas.style.objectFit = 'contain';
              containerRef.current?.appendChild(webgl.canvas);
            } catch (e) {
              console.error("WebGL VAP error", e);
            }

            const rawVideoW = vapConfig?.info?.videoW || vw;
            const rawVideoH = vapConfig?.info?.videoH || vh;
            const scaleX = vw / (rawVideoW || vw);
            const scaleY = vh / (rawVideoH || vh);
            const srcRgbX = Math.round(rgbRect[0] * scaleX);
            const srcRgbY = Math.round(rgbRect[1] * scaleY);
            const srcRgbW = Math.round(rgbRect[2] * scaleX);
            const srcRgbH = Math.round(rgbRect[3] * scaleY);
            const srcAlphaX = Math.round(alphaRect[0] * scaleX);
            const srcAlphaY = Math.round(alphaRect[1] * scaleY);
            const srcAlphaW = Math.round(alphaRect[2] * scaleX);
            const srcAlphaH = Math.round(alphaRect[3] * scaleY);

            if (isPlayingRef.current) {
              video.play().catch(() => {});
            }

            const renderFrame = () => {
              if (isCanceled) return;
              if (webgl && video.readyState >= 2) {
                webgl.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], 10, true);
              }
              animId = requestAnimationFrame(renderFrame);
            };
            animId = requestAnimationFrame(renderFrame);
          };

          playerRef.current = {
            video,
            stopAnimation: () => {
              cancelAnimationFrame(animId);
              video.pause();
            },
            pauseAnimation: () => {
              video.pause();
            },
            startAnimation: () => {
              video.play().catch(() => {});
            }
          };
        }
        return;
      }

      if (item.type === "pag") {
        let pagFile = item.pagFile;
        if (!pagFile) {
          try {
            const PAG = await getPAG();
            pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
            item.pagFile = pagFile;
            if (!item.dimensions) {
              item.dimensions = { width: pagFile.width(), height: pagFile.height() };
              item.fps = pagFile.frameRate() || 30;
              item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);
            }
            if (!isCanceled) setIsLoaded(true);
          } catch (e) {
            console.error("PAG load error", e);
            return;
          }
        }
        
        if (isCanceled || !containerRef.current) return;
        
        if (!playerRef.current) {
          containerRef.current.innerHTML = "";
          const canvas = document.createElement("canvas");
          const canvasId = "pag_card_" + Math.random().toString(36).substring(2, 9);
          canvas.id = canvasId;
          canvas.width = item.dimensions?.width || 500;
          canvas.height = item.dimensions?.height || 500;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.objectFit = "contain";
          containerRef.current.appendChild(canvas);
          
          const PAG = await getPAG();
          const pagPlayer = await PAG.PAGPlayer.create();
          pagPlayer.setComposition(pagFile);
          const pagSurface = PAG.PAGSurface.fromCanvas('#' + canvasId);
          if (pagSurface) {
            pagSurface.updateSize();
            pagSurfaceRef.current = pagSurface;
            pagPlayer.setSurface(pagSurface);
          }
          pagPlayer.setVideoEnabled(true);
          pagPlayer.setProgress(0);
          await pagPlayer.flush();
          playerRef.current = pagPlayer;
          
          const durationMs = (pagFile.duration() / 1000) || 3000;
          let accumulatedTime = 0;
          let lastTime = Date.now();
          
          const renderLoop = async () => {
            if (isCanceled) return;
            const now = Date.now();
            const delta = now - lastTime;
            lastTime = now;
            
            if (isPlayingRef.current && playerRef.current) {
              accumulatedTime += delta;
              const progress = (accumulatedTime % durationMs) / durationMs;
              playerRef.current.setProgress(progress);
              await playerRef.current.flush();
            }
            requestAnimationFrame(renderLoop);
          };
          renderLoop();
        }
        return;
      }

      let videoItem = item.videoItem;
      if (videoItem && (videoItem.audios?.length > 0 || extractAudioData(item) !== null)) {
        setHasAudio(true);
      }
      if (!videoItem || !videoItem.images) {
        try {
          videoItem = await new Promise((resolve, reject) => {
            const parser = new SVGA.Parser();
            const bypassUrl = item.url + "#" + Math.random().toString(36).substr(2, 9);
            parser.load(bypassUrl, (vi: any) => {
              if (!vi || !vi.images) return reject(new Error("Invalid SVGA"));
              resolve(vi);
            }, reject);
          });
          item.videoItem = videoItem;
          if (!item.dimensions) {
            item.dimensions = { width: videoItem.videoSize?.width || 500, height: videoItem.videoSize?.height || 500 };
            item.fps = videoItem.FPS || videoItem.fps || 30;
            item.frames = videoItem.frames || 1;
          }
          if (videoItem && (videoItem.audios?.length > 0 || extractAudioData({ ...item, videoItem }) !== null)) {
            setHasAudio(true);
          }
          if (!isCanceled) setIsLoaded(true);
        } catch(e) {
          console.error("SVGA load error", e);
          return;
        }
      }

      if (isCanceled || !containerRef.current) return;
      
      if (!playerRef.current) {
        containerRef.current.innerHTML = "";
        const player = new SVGA.Player(containerRef.current);
        playerRef.current = player;
        player.loops = 0;
        player.clearsAfterStop = false;
        player.setContentMode("AspectFit");
        player.setVideoItem(videoItem);
      }
      
      if (isPlayingRef.current) playerRef.current.startAnimation();
      else playerRef.current.pauseAnimation();
    };

    loadAndPlay();
    return () => {
      isCanceled = true;
      if (playerRef.current) {
        if (item.type === "pag") {
          try { playerRef.current.destroy?.(); } catch (e) {}
          try { pagSurfaceRef.current?.destroy?.(); } catch (e) {}
        }
        else playerRef.current.stopAnimation();
      }
      playerRef.current = null;
      pagSurfaceRef.current = null;
    };
  }, [item.url, item.type, isVisible]); // Removed isLoaded and isPlaying from dependencies


    // Separate effect for Zoom and Preset style updates - much faster and smoother
    useEffect(() => {
    const updateCanvasStyles = () => {
        if (!wrapperRef.current || !containerRef.current) return;
        
        const wrapperWidth = wrapperRef.current.clientWidth;
        const wrapperHeight = wrapperRef.current.clientHeight;
        const svgaWidth = item.dimensions?.width || 500;
        const svgaHeight = item.dimensions?.height || 500;
  
        // Fixed container dimensions as requested
        const containerWidth = (customDimensions && customDimensions.width > 0) ? customDimensions.width : (selectedPreset ? selectedPreset.width : svgaWidth);
        const containerHeight = (customDimensions && customDimensions.height > 0) ? customDimensions.height : (selectedPreset ? selectedPreset.height : svgaHeight);
  
        // 1. Scale the SVGA to fit inside the target container
        const svgaScale = Math.min(containerWidth / svgaWidth, containerHeight / svgaHeight);
        const finalSvgaWidth = svgaWidth * svgaScale;
        const finalSvgaHeight = svgaHeight * svgaScale;
  
        // 2. Scale the container to fit inside the card wrapper
        const wrapperScale = Math.min(wrapperWidth / containerWidth, wrapperHeight / containerHeight);
  
        // Size the inner container to exactly match the scaled SVGA dimensions
        // and scale it down to fit the wrapper
        Object.assign(containerRef.current.style, {
          width: `${finalSvgaWidth}px`,
          height: `${finalSvgaHeight}px`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          // Combine the wrapper scale and the user zoom
          transform: `translate(-50%, -50%) scale(${wrapperScale * zoom})`,
          transformOrigin: 'center center',
          zIndex: '1'
        });
  
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          Object.assign(canvas.style, {
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'fill'
          });
        }
      };
  
      const resizeObserver = new ResizeObserver(() => {
        updateCanvasStyles();
      });
  
      if (wrapperRef.current) {
        resizeObserver.observe(wrapperRef.current);
      }
  
      // Use MutationObserver to catch when SVGA.Player adds the canvas
      const mutationObserver = new MutationObserver(() => {
        updateCanvasStyles();
      });
      
      if (containerRef.current) {
        mutationObserver.observe(containerRef.current, { childList: true, subtree: true });
      }
  
      updateCanvasStyles();
      const timer = setTimeout(updateCanvasStyles, 100);
      
      return () => {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
        clearTimeout(timer);
      };
    }, [selectedPreset, zoom, item.dimensions, customDimensions]);

  const togglePlay = () => {
    if (item.type === 'pag') {
      setIsPlaying(!isPlaying);
    } else if (item.type === 'vap') {
      if (isPlaying) {
        playerRef.current?.pauseAnimation?.();
      } else {
        playerRef.current?.startAnimation?.();
      }
      setIsPlaying(!isPlaying);
    } else {
      if (isPlaying) {
        playerRef.current?.pauseAnimation();
      } else {
        playerRef.current?.startAnimation();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const replay = () => {
    if (item.type === 'pag') {
      if (playerRef.current) {
        playerRef.current.setProgress(0);
        playerRef.current.flush();
      }
      setIsPlaying(true);
    } else if (item.type === 'vap') {
      if (playerRef.current?.video) {
        playerRef.current.video.currentTime = 0;
        playerRef.current.video.play().catch(() => {});
      }
      setIsPlaying(true);
    } else {
      playerRef.current?.stopAnimation();
      playerRef.current?.startAnimation();
      setIsPlaying(true);
    }
  };

  const effectiveRatio = (customDimensions && customDimensions.width > 0 && customDimensions.height > 0)
    ? (customDimensions.height / customDimensions.width)
    : selectedPreset 
    ? (selectedPreset.height / selectedPreset.width) 
    : (itemHeight / (itemWidth || 1));

  const cols = gridCols || 3;
  const baseH = cols <= 1 ? 420 : cols === 2 ? 370 : cols === 3 ? 310 : cols === 4 ? 260 : 210;
  const cardPreviewHeight = Math.min(560, Math.max(170, Math.round(effectiveRatio * baseH)));

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="group relative bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col w-full min-w-0"
    >
      {/* Preview Area - Forced Ratio */}
      <div 
        ref={wrapperRef}
        className="relative bg-slate-950/60 flex items-center justify-center overflow-hidden w-full"
        style={{ height: `${cardPreviewHeight}px` }}
      >
        {previewBg && <img src={previewBg} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" referrerPolicy="no-referrer" />}
        <div 
          ref={containerRef} 
          className="relative z-10 transition-transform duration-100"
          style={{
            opacity: item.opacity !== undefined ? item.opacity : 1,
            transform: `scale(${item.scale !== undefined ? item.scale : 1}) translate(${item.posX || 0}px, ${item.posY || 0}px)`,
            transformOrigin: 'center center'
          }}
        />

        {/* Watermark */}
        {watermark && <WatermarkOverlay watermark={watermark} settings={wmSettings} />}
        
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div className={`absolute top-4 left-4 z-30 transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onClick={onToggleSelect}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-black/40 backdrop-blur-md border-white/50 hover:border-white hover:bg-black/60 text-transparent"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </div>
        )}
        
        {/* Audio Badge */}
        {hasAudio && (
          <div className={`absolute ${onToggleSelect ? 'top-14' : 'top-4'} left-4 z-20 px-3 py-1.5 bg-indigo-500/80 backdrop-blur-md border border-indigo-400/50 rounded-xl flex items-center gap-2 shadow-lg`}>
            <Volume2 className="w-4 h-4 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">يحتوي صوت</span>
          </div>
        )}

        {/* Info Badge */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-20">
          <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-2">
            <span className="text-[10px] font-black text-white">
              {selectedPreset ? `${selectedPreset.width} × ${selectedPreset.height}` : `${itemWidth} × ${itemHeight}`}
            </span>
            {isPortrait ? <Smartphone className="w-3 h-3 text-sky-400" /> : <Monitor className="w-3 h-3 text-indigo-400" />}
          </div>
          {selectedPreset && (
            <div className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-[8px] font-black text-indigo-300 uppercase tracking-tighter text-center">
              مقاس إجباري (Fill)
            </div>
          )}
        </div>
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-6 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <button 
              onClick={replay}
              className="w-12 h-12 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="w-48 px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">تكبير العرض (Zoom)</span>
              <span className="text-[10px] font-black text-indigo-400">{Math.round(zoom * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="3" 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <button 
            onClick={onRemove}
            className="w-10 h-10 bg-red-500/20 backdrop-blur-md text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onMaximize}
            className="w-10 h-10 bg-indigo-500/20 backdrop-blur-md text-indigo-400 rounded-xl flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button 
            onClick={onDownloadGiftBundle || onDownloadSvga}
            className="w-10 h-10 bg-amber-500/20 backdrop-blur-md text-amber-300 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all shadow-lg shadow-amber-500/10"
            title="تنزيل حزمة الهدية (الملف + أحلى كادر صورة في ملف ZIP)"
          >
            <Gift className="w-5 h-5" />
          </button>
          <button 
            onClick={onDownload}
            className="w-10 h-10 bg-emerald-500/20 backdrop-blur-md text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
            title="تنزيل صورة"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button 
            onClick={onDownloadSvga}
            className="w-10 h-10 bg-blue-500/20 backdrop-blur-md text-blue-400 rounded-xl flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
            title={item.type === 'vap' ? "تنزيل ملف VAP" : item.type === 'pag' ? "تنزيل ملف PAG" : "تنزيل ملف SVGA"}
          >
            <Download className="w-5 h-5" />
          </button>
          {onExportVideo && (
            <button 
              onClick={onExportVideo}
              className={`w-10 h-10 ${item.type === 'vap' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-purple-500/20 text-purple-400'} backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-purple-500 hover:text-white transition-all`}
              title={item.type === 'vap' ? "تصدير VAP إلى MP4" : "تصدير كفيديو MP4"}
            >
              <Video className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setShowItemControls(!showItemControls)}
            className={`w-10 h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${showItemControls ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white'}`}
            title="أدوات تحكم الهدية المستقلة (الشفافية، الحجم، الموضع)"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`w-10 h-10 backdrop-blur-md rounded-xl flex items-center justify-center transition-all ${showInfo ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-5 bg-white/[0.02] z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 truncate max-w-[170px]">
            {item.type === 'vap' && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 border border-indigo-400/40 text-[9px] font-black text-indigo-300 uppercase shrink-0">
                VAP
              </span>
            )}
            {item.type === 'pag' && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/30 border border-amber-400/40 text-[9px] font-black text-amber-300 uppercase shrink-0">
                PAG
              </span>
            )}
            <h4 className="text-white font-black text-sm truncate" title={item.name}>
              {item.name}
            </h4>
          </div>
          <span className="text-[10px] text-slate-500 font-bold">
            {(item.size / 1024).toFixed(1)} KB
          </span>
        </div>
        
        {/* Preset Selector */}
        <select 
          value={item.presetId}
          onChange={(e) => onUpdatePreset(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white font-black uppercase tracking-widest focus:outline-none focus:border-indigo-500 transition-all mb-2"
        >
          <option value="auto">تلقائي (Native)</option>
          {DEVICE_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Toggle Independent Controls Panel Button */}
        <button
          type="button"
          onClick={() => setShowItemControls(!showItemControls)}
          className={`w-full py-2 px-3 rounded-xl border text-[11px] font-black flex items-center justify-between transition-all mb-3 cursor-pointer ${
            showItemControls 
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 shadow-sm' 
              : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            تحكم الهدية (الشفافية، الحجم، الموضع)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200">
            مستقل
          </span>
        </button>

        {/* Dedicated Independent Controls Panel for this SVGA Item */}
        <AnimatePresence>
          {showItemControls && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-4 p-3.5 bg-slate-900/90 border border-purple-500/30 rounded-2xl space-y-3 shadow-inner"
            >
              <div className="flex items-center justify-between text-[10px] font-black text-purple-300 border-b border-white/5 pb-1.5">
                <span>تخصيص الهدية الحالية فقط</span>
                <button
                  type="button"
                  onClick={() => onUpdateItem?.({ opacity: 1, scale: 1, posX: 0, posY: 0 })}
                  className="text-[9px] text-slate-400 hover:text-purple-300 underline cursor-pointer"
                >
                  إعادة ضبط
                </button>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300">الشفافية (Opacity)</span>
                  <span className="text-purple-400 font-mono">{Math.round((item.opacity ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((item.opacity ?? 1) * 100)}
                  onChange={(e) => onUpdateItem?.({ opacity: Number(e.target.value) / 100 })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Scale Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300">الحجم والتكبير (Scale)</span>
                  <span className="text-purple-400 font-mono">{Math.round((item.scale ?? 1) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="250"
                  value={Math.round((item.scale ?? 1) * 100)}
                  onChange={(e) => onUpdateItem?.({ scale: Number(e.target.value) / 100 })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Position X Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300">الموضع الأفقي (X)</span>
                  <span className="text-purple-400 font-mono">{item.posX || 0}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  value={item.posX || 0}
                  onChange={(e) => onUpdateItem?.({ posX: Number(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Position Y Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-300">الموضع الرأسي (Y)</span>
                  <span className="text-purple-400 font-mono">{item.posY || 0}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  value={item.posY || 0}
                  onChange={(e) => onUpdateItem?.({ posY: Number(e.target.value) })}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Avatar / Frame Fixed Dimensions Controller */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-indigo-300 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-indigo-400" />
                    تثبيت مقاس الصورة / الأفاتار
                  </span>
                  <span className="text-indigo-300 font-mono text-[9px]">
                    {item.avatarWidth || 200} × {item.avatarHeight || 200}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1 bg-black/50 border border-indigo-400/30 rounded-lg px-2 py-1">
                    <span className="text-[8px] text-slate-400 font-bold">عرض:</span>
                    <input 
                      type="number"
                      value={item.avatarWidth || 200}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const updates: any = { avatarWidth: val };
                        if (item.lockAvatarAspect !== false && item.avatarWidth && item.avatarHeight) {
                          const ratio = item.avatarHeight / item.avatarWidth;
                          updates.avatarHeight = Math.round(val * ratio);
                        }
                        onUpdateItem?.(updates);
                      }}
                      className="w-full bg-transparent text-white font-mono font-bold text-[10px] text-center focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateItem?.({ lockAvatarAspect: !(item.lockAvatarAspect !== false) })}
                    className={`p-1 rounded-md text-[9px] font-bold transition-all ${item.lockAvatarAspect !== false ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400'}`}
                    title={item.lockAvatarAspect !== false ? 'قفل نسبة أبعاد الصورة' : 'أبعاد حرة'}
                  >
                    {item.lockAvatarAspect !== false ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>

                  <div className="flex-1 flex items-center gap-1 bg-black/50 border border-indigo-400/30 rounded-lg px-2 py-1">
                    <span className="text-[8px] text-slate-400 font-bold">طول:</span>
                    <input 
                      type="number"
                      value={item.avatarHeight || 200}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const updates: any = { avatarHeight: val };
                        if (item.lockAvatarAspect !== false && item.avatarWidth && item.avatarHeight) {
                          const ratio = item.avatarWidth / item.avatarHeight;
                          updates.avatarWidth = Math.round(val * ratio);
                        }
                        onUpdateItem?.(updates);
                      }}
                      className="w-full bg-transparent text-white font-mono font-bold text-[10px] text-center focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Avatar Dimension Buttons */}
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {[
                    { label: '200 × 200', w: 200, h: 200 },
                    { label: '300 × 300', w: 300, h: 300 },
                    { label: '150 × 150', w: 150, h: 150 }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onUpdateItem?.({ avatarWidth: preset.w, avatarHeight: preset.h })}
                      className={`py-0.5 px-1 rounded bg-white/5 hover:bg-white/10 border text-[8px] font-bold transition-all text-center ${(item.avatarWidth === preset.w && item.avatarHeight === preset.h) ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10' : 'border-white/5 text-slate-400'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {showInfo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Frames</p>
                  <p className="text-xs text-white font-bold">{item.frames}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">FPS</p>
                  <p className="text-xs text-white font-bold">{item.fps}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-xs text-white font-bold">{(item.frames / item.fps).toFixed(2)}s</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Ratio</p>
                  <p className="text-xs text-white font-bold">{(itemWidth / itemHeight).toFixed(2)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default MultiSvgaViewer;
