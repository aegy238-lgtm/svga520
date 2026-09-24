import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, RotateCcw, Volume2, VolumeX, Download, 
  Maximize2, Minimize2, Sparkles, Layers, FileVideo, Image as ImageIcon,
  Film, Music, Settings, Info, Check, Eye, Sliders, ChevronLeft,
  ChevronRight, RefreshCw, UploadCloud, ShieldCheck, Zap, HardDrive,
  Copy, FolderPlus, ArrowRight
} from 'lucide-react';
import { Player as SvgaPlayer, Parser as SvgaParser } from 'svga.lite';
import lottie from 'lottie-web';
import JSZip from 'jszip';
import UPNG from 'upng-js';
import { getPAG } from '../utils/pagEngine';
import { extractVapConfigFromBlob, detectVapChannelLayout, VapChannelLayout } from '../utils/vapEngine';
import { uploadToMegaStorage } from '../services/megaStorageService';

export type SupportedFormatType = 
  | 'SVGA'
  | 'LOTTIE'
  | 'DOTLOTTIE'
  | 'PAG'
  | 'GIF'
  | 'WEBP'
  | 'APNG'
  | 'PNG_SEQUENCE_ZIP'
  | 'MP4'
  | 'MOV'
  | 'WEBM'
  | 'VAP'
  | 'YYEVA'
  | 'DUAL_CHANNEL_VIDEO'
  | 'SVG_SMIL'
  | 'UNKNOWN';

export interface UniversalFormatDetails {
  type: SupportedFormatType;
  label: string;
  category: 'vector_anim' | 'anim_image' | 'video' | 'alpha_video' | 'svg_vector';
  categoryLabel: string;
  mimeType: string;
  badgeColor: string;
  icon: string;
}

export const FORMAT_SPECS: Record<SupportedFormatType, UniversalFormatDetails> = {
  SVGA: {
    type: 'SVGA',
    label: 'SVGA (2.0/Lite)',
    category: 'vector_anim',
    categoryLabel: 'رسوم متحركة موجهة',
    mimeType: 'application/octet-stream',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    icon: 'Layers'
  },
  LOTTIE: {
    type: 'LOTTIE',
    label: 'Lottie JSON',
    category: 'vector_anim',
    categoryLabel: 'رسوم متحركة موجهة',
    mimeType: 'application/json',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: 'Sparkles'
  },
  DOTLOTTIE: {
    type: 'DOTLOTTIE',
    label: 'DotLottie (.lottie)',
    category: 'vector_anim',
    categoryLabel: 'رسوم متحركة موجهة',
    mimeType: 'application/zip',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    icon: 'Sparkles'
  },
  PAG: {
    type: 'PAG',
    label: 'PAG Animation (.pag)',
    category: 'vector_anim',
    categoryLabel: 'رسوم متحركة موجهة',
    mimeType: 'application/octet-stream',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: 'Film'
  },
  GIF: {
    type: 'GIF',
    label: 'GIF Image',
    category: 'anim_image',
    categoryLabel: 'صور متحركة وتسلسلات',
    mimeType: 'image/gif',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: 'ImageIcon'
  },
  WEBP: {
    type: 'WEBP',
    label: 'Animated WebP',
    category: 'anim_image',
    categoryLabel: 'صور متحركة وتسلسلات',
    mimeType: 'image/webp',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: 'ImageIcon'
  },
  APNG: {
    type: 'APNG',
    label: 'APNG (Animated PNG)',
    category: 'anim_image',
    categoryLabel: 'صور متحركة وتسلسلات',
    mimeType: 'image/apng',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    icon: 'ImageIcon'
  },
  PNG_SEQUENCE_ZIP: {
    type: 'PNG_SEQUENCE_ZIP',
    label: 'PNG Sequence ZIP (تسلسل إطارات)',
    category: 'anim_image',
    categoryLabel: 'صور متحركة وتسلسلات',
    mimeType: 'application/zip',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    icon: 'Layers'
  },
  MP4: {
    type: 'MP4',
    label: 'MP4 Video',
    category: 'video',
    categoryLabel: 'ملفات الفيديو',
    mimeType: 'video/mp4',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    icon: 'FileVideo'
  },
  MOV: {
    type: 'MOV',
    label: 'MOV Video (QuickTime)',
    category: 'video',
    categoryLabel: 'ملفات الفيديو',
    mimeType: 'video/quicktime',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    icon: 'FileVideo'
  },
  WEBM: {
    type: 'WEBM',
    label: 'WebM Video',
    category: 'video',
    categoryLabel: 'ملفات الفيديو',
    mimeType: 'video/webm',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: 'FileVideo'
  },
  VAP: {
    type: 'VAP',
    label: 'VAP Video (Tencent VAP)',
    category: 'alpha_video',
    categoryLabel: 'فيديو شفاف وألفا',
    mimeType: 'video/mp4',
    badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    icon: 'Sparkles'
  },
  YYEVA: {
    type: 'YYEVA',
    label: 'YYEVA Transparent Video',
    category: 'alpha_video',
    categoryLabel: 'فيديو شفاف وألفا',
    mimeType: 'video/mp4',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    icon: 'Sparkles'
  },
  DUAL_CHANNEL_VIDEO: {
    type: 'DUAL_CHANNEL_VIDEO',
    label: 'Dual-Channel Alpha Video (ثنائي القناة)',
    category: 'alpha_video',
    categoryLabel: 'فيديو شفاف وألفا',
    mimeType: 'video/mp4',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    icon: 'Layers'
  },
  SVG_SMIL: {
    type: 'SVG_SMIL',
    label: 'SVG / SMIL Vector Animation',
    category: 'svg_vector',
    categoryLabel: 'فيكتور SVG',
    mimeType: 'image/svg+xml',
    badgeColor: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
    icon: 'Zap'
  },
  UNKNOWN: {
    type: 'UNKNOWN',
    label: 'ملف غير معروف',
    category: 'vector_anim',
    categoryLabel: 'ملفات عامة',
    mimeType: 'application/octet-stream',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: 'Info'
  }
};

/**
 * Detects format type from File name, extension, and content
 */
export async function detectFormat(file: File): Promise<SupportedFormatType> {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';

  if (ext === 'svga') return 'SVGA';
  if (ext === 'pag') return 'PAG';
  if (ext === 'lottie') return 'DOTLOTTIE';
  if (ext === 'gif') return 'GIF';
  if (ext === 'webp') return 'WEBP';
  if (ext === 'apng' || ext === 'png') return 'APNG';
  if (ext === 'svg') return 'SVG_SMIL';
  if (ext === 'vap') return 'VAP';
  if (name.includes('yyeva')) return 'YYEVA';
  if (name.includes('vap')) return 'VAP';
  if (name.includes('alpha') || name.includes('trans') || name.includes('透明')) return 'DUAL_CHANNEL_VIDEO';

  if (ext === 'json') {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.v || parsed.layers || parsed.fr || parsed.assets) {
        return 'LOTTIE';
      }
      if (parsed.movie || parsed.sprites || parsed.viewBox) {
        return 'SVGA';
      }
    } catch {
      // ignore
    }
  }

  if (ext === 'zip') {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const fileNames = Object.keys(contents.files);
      if (fileNames.some(f => f === 'spec.json' || f === 'movie.json')) return 'SVGA';
      const isLottieZip = fileNames.some(f => f.includes('manifest.json') || f.endsWith('.json'));
      if (isLottieZip) return 'DOTLOTTIE';
      
      const pngCount = fileNames.filter(f => f.toLowerCase().endsWith('.png') && !f.startsWith('__MACOSX')).length;
      if (pngCount > 0) return 'PNG_SEQUENCE_ZIP';
    } catch {
      // ignore
    }
  }

  if (ext === 'mp4' || ext === 'mov' || ext === 'webm') {
    try {
      const vapConfig = await extractVapConfigFromBlob(file);
      if (vapConfig) {
        if (vapConfig.descript || (vapConfig as any).isYYEVA) return 'YYEVA';
        return 'VAP';
      }
    } catch {
      // ignore
    }
    return 'MP4';
  }

  return 'UNKNOWN';
}

interface UniversalMultiFormatPlayerModalProps {
  file: File | null;
  onClose: () => void;
  onOpenInEditor?: (file: File) => void;
  onConvertToSvga?: (file: File) => void;
}

export const UniversalMultiFormatPlayerModal: React.FC<UniversalMultiFormatPlayerModalProps> = ({
  file,
  onClose,
  onOpenInEditor,
  onConvertToSvga
}) => {
  // State
  const [formatType, setFormatType] = useState<SupportedFormatType>('UNKNOWN');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(30);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 750, height: 1334 });
  const [bgMode, setBgMode] = useState<'grid_dark' | 'grid_light' | 'black' | 'white' | 'green' | 'blue'>('grid_dark');
  const [alphaMode, setAlphaMode] = useState<'composite' | 'alpha_only' | 'rgb_only'>('composite');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingToMega, setUploadingToMega] = useState(false);
  const [megaUploadSuccess, setMegaUploadSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'player' | 'layers' | 'info'>('player');
  const [extractedAssets, setExtractedAssets] = useState<{ id: string; name: string; url: string; size?: string }[]>([]);
  const [animatedImageUrl, setAnimatedImageUrl] = useState<string | null>(null);

  // Refs for different player engines
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgaPlayerRef = useRef<any>(null);
  const lottieAnimRef = useRef<any>(null);
  const pagPlayerRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const framesArrayRef = useRef<HTMLImageElement[]>([]);
  const sequenceTimerRef = useRef<any>(null);

  // Initialize and load media
  useEffect(() => {
    // Suppress harmless VideoReader clearVisibilityListener warnings from destroyed WASM modules
    const handleGlobalError = (e: ErrorEvent) => {
      if (e?.message && e.message.includes('clearVisibilityListener')) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    };
    window.addEventListener('error', handleGlobalError, true);

    if (!file) {
      return () => window.removeEventListener('error', handleGlobalError, true);
    }

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);
    setExtractedAssets([]);

    const initPlayer = async () => {
      try {
        const detected = await detectFormat(file);
        if (!isMounted) return;
        setFormatType(detected);

        if (detected === 'SVGA') {
          await initSvga(file);
        } else if (detected === 'LOTTIE' || detected === 'DOTLOTTIE') {
          await initLottie(file, detected === 'DOTLOTTIE');
        } else if (detected === 'PAG') {
          await initPag(file);
        } else if (detected === 'PNG_SEQUENCE_ZIP') {
          await initPngSequence(file);
        } else if (detected === 'GIF' || detected === 'WEBP' || detected === 'APNG') {
          await initAnimatedImage(file);
        } else if (detected === 'VAP' || detected === 'YYEVA' || detected === 'DUAL_CHANNEL_VIDEO') {
          await initDualChannelVideo(file);
        } else if (detected === 'MP4' || detected === 'MOV' || detected === 'WEBM') {
          await initStandardVideo(file);
        } else if (detected === 'SVG_SMIL') {
          await initSvg(file);
        } else {
          setErrorMessage('نوع الملف غير مدعوم بالكامل أو لا يمكن قراءته.');
        }
      } catch (err: any) {
        console.error('Error loading format:', err);
        if (isMounted) setErrorMessage(err.message || 'فشل تشغيل الملف');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initPlayer();

    return () => {
      isMounted = false;
      cleanupEngines();
      window.removeEventListener('error', handleGlobalError, true);
    };
  }, [file]);

  const cleanupEngines = () => {
    if (svgaPlayerRef.current) {
      try { svgaPlayerRef.current.stop(); } catch {}
      svgaPlayerRef.current = null;
    }
    if (lottieAnimRef.current) {
      try { lottieAnimRef.current.destroy(); } catch {}
      lottieAnimRef.current = null;
    }
    if (pagPlayerRef.current) {
      try {
        if (typeof pagPlayerRef.current.stop === 'function') {
          pagPlayerRef.current.stop();
        }
        if (typeof pagPlayerRef.current.destroy === 'function') {
          pagPlayerRef.current.destroy();
        }
      } catch (e) {
        console.warn('PAG cleanup ignored safely:', e);
      }
      pagPlayerRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (sequenceTimerRef.current) {
      clearInterval(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.src = '';
      } catch {}
    }
    if (animatedImageUrl) {
      URL.revokeObjectURL(animatedImageUrl);
      setAnimatedImageUrl(null);
    }
  };

  // SVGA Engine
  const initSvga = async (fileObj: File) => {
    const buffer = await fileObj.arrayBuffer();
    const parser = new SvgaParser();
    const svgaData = await parser.do(buffer);

    setDimensions({ width: svgaData.videoSize.width, height: svgaData.videoSize.height });
    setFps(svgaData.FPS || 30);
    setTotalFrames(svgaData.frames || 1);
    setDuration((svgaData.frames || 1) / (svgaData.FPS || 30));

    // Extract images
    if (svgaData.images) {
      const assets = Object.entries(svgaData.images).map(([k, v]) => ({
        id: k,
        name: `Layer_${k}`,
        url: typeof v === 'string' ? (v.startsWith('data:') ? v : `data:image/png;base64,${v}`) : ''
      })).filter(a => a.url);
      setExtractedAssets(assets);
    }

    if (canvasRef.current) {
      const player = new SvgaPlayer(canvasRef.current);
      await player.mount(svgaData);
      player.start();
      svgaPlayerRef.current = player;

      (player as any).onProcess = () => {
        setCurrentFrame((player as any).currentFrame || 0);
        setCurrentTime(((player as any).currentFrame || 0) / (svgaData.FPS || 30));
      };
    }
  };

  // Lottie Engine
  const initLottie = async (fileObj: File, isDotLottie: boolean) => {
    let animData: any = null;

    if (isDotLottie) {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(fileObj);
      const jsonFile = Object.keys(loadedZip.files).find(f => f.endsWith('.json') && !f.includes('manifest'));
      if (jsonFile) {
        const str = await loadedZip.files[jsonFile].async('string');
        animData = JSON.parse(str);
      }
    } else {
      const text = await fileObj.text();
      animData = JSON.parse(text);
    }

    if (!animData) throw new Error('تعذر فك ضغط بيانات Lottie');

    const w = animData.w || 750;
    const h = animData.h || 1334;
    const fRate = animData.fr || 30;
    const totalF = Math.round((animData.op || 100) - (animData.ip || 0));

    setDimensions({ width: w, height: h });
    setFps(fRate);
    setTotalFrames(totalF);
    setDuration(totalF / fRate);

    // Extract assets
    if (animData.assets && Array.isArray(animData.assets)) {
      const assets = animData.assets.map((a: any, idx: number) => ({
        id: a.id || `asset_${idx}`,
        name: a.p || a.id || `Asset ${idx}`,
        url: a.p && a.p.startsWith('data:') ? a.p : (a.u ? `${a.u}${a.p}` : '')
      })).filter(a => a.url);
      setExtractedAssets(assets);
    }

    if (lottieContainerRef.current) {
      lottieContainerRef.current.innerHTML = '';
      const anim = lottie.loadAnimation({
        container: lottieContainerRef.current,
        renderer: 'svg',
        loop: isLooping,
        autoplay: isPlaying,
        animationData: animData
      });
      lottieAnimRef.current = anim;

      anim.addEventListener('enterFrame', (e: any) => {
        setCurrentFrame(Math.round(e.currentTime));
        setCurrentTime(e.currentTime / fRate);
      });
    }
  };

  // PAG Engine
  const initPag = async (fileObj: File) => {
    const PAG = await getPAG();
    const buffer = await fileObj.arrayBuffer();
    const pagFile = await PAG.PAGFile.load(buffer);

    const w = pagFile.width();
    const h = pagFile.height();
    const durSec = pagFile.duration() / 1000000;
    const fRate = pagFile.frameRate();
    const totalF = Math.round(durSec * fRate);

    setDimensions({ width: w, height: h });
    setFps(fRate);
    setDuration(durSec);
    setTotalFrames(totalF);

    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const pagView = await PAG.PAGView.init(pagFile, canvasRef.current);
      pagView.setRepeatCount(isLooping ? 0 : 1);
      await pagView.play();
      pagPlayerRef.current = pagView;

      const trackPag = () => {
        if (pagPlayerRef.current) {
          const progress = pagPlayerRef.current.getProgress();
          const frame = Math.round(progress * totalF);
          setCurrentFrame(frame);
          setCurrentTime(progress * durSec);
        }
        animFrameIdRef.current = requestAnimationFrame(trackPag);
      };
      trackPag();
    }
  };

  // PNG Sequence ZIP
  const initPngSequence = async (fileObj: File) => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(fileObj);
    const pngKeys = Object.keys(contents.files)
      .filter(f => f.toLowerCase().endsWith('.png') && !f.startsWith('__MACOSX'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (pngKeys.length === 0) throw new Error('لا توجد صور PNG داخل ملف الـ ZIP');

    const loadedImgs: HTMLImageElement[] = [];
    const assets: { id: string; name: string; url: string }[] = [];

    for (let i = 0; i < pngKeys.length; i++) {
      const blob = await contents.files[pngKeys[i]].async('blob');
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      await new Promise(r => { img.onload = r; });
      loadedImgs.push(img);

      if (i < 20) {
        assets.push({
          id: `frame_${i}`,
          name: pngKeys[i].split('/').pop() || `Frame ${i}`,
          url
        });
      }
    }

    framesArrayRef.current = loadedImgs;
    setExtractedAssets(assets);

    const firstImg = loadedImgs[0];
    const w = firstImg.naturalWidth || 750;
    const h = firstImg.naturalHeight || 1334;
    const fRate = 24;

    setDimensions({ width: w, height: h });
    setFps(fRate);
    setTotalFrames(loadedImgs.length);
    setDuration(loadedImgs.length / fRate);

    // Play loop
    let idx = 0;
    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext('2d');

      sequenceTimerRef.current = setInterval(() => {
        if (!isPlaying || loadedImgs.length === 0) return;
        ctx?.clearRect(0, 0, w, h);
        ctx?.drawImage(loadedImgs[idx], 0, 0, w, h);
        setCurrentFrame(idx);
        setCurrentTime(idx / fRate);
        idx = (idx + 1) % loadedImgs.length;
      }, 1000 / fRate);
    }
  };

  // Animated Images: GIF, WebP, APNG
  const initAnimatedImage = async (fileObj: File) => {
    const url = URL.createObjectURL(fileObj);
    setAnimatedImageUrl(url);
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; });

    const w = img.naturalWidth || 500;
    const h = img.naturalHeight || 500;
    setDimensions({ width: w, height: h });
    setFps(30);
    setTotalFrames(60);
    setDuration(2);

    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext('2d');
      ctx?.drawImage(img, 0, 0, w, h);
    }
  };

  // VAP & Transparent Dual-Channel Video
  const initDualChannelVideo = async (fileObj: File) => {
    const url = URL.createObjectURL(fileObj);
    if (!videoRef.current) return;

    const vapConfig = await extractVapConfigFromBlob(fileObj).catch(() => null);

    const vid = videoRef.current;
    vid.loop = isLooping;
    vid.muted = isMuted;
    vid.playsInline = true;

    let rgbRect: [number, number, number, number] = [0, 0, 750, 750];
    let alphaRect: [number, number, number, number] = [750, 0, 750, 750];
    let targetW = 750;
    let targetH = 750;

    const handleLoadedMetadata = () => {
      const vidW = vid.videoWidth || 750;
      const vidH = vid.videoHeight || 750;
      const isHorizontal = (vidW >= vidH) || (vidW % 2 === 0 && vidW > 1.05 * vidH);
      
      if (vapConfig?.info?.rgbFrame && vapConfig?.info?.aFrame) {
        rgbRect = vapConfig.info.rgbFrame as [number, number, number, number];
        alphaRect = vapConfig.info.aFrame as [number, number, number, number];
        targetW = vapConfig.info.w || rgbRect[2] || (isHorizontal ? Math.round(vidW / 2) : vidW);
        targetH = vapConfig.info.h || rgbRect[3] || (isHorizontal ? vidH : Math.round(vidH / 2));
      } else {
        targetW = isHorizontal ? Math.round(vidW / 2) : vidW;
        targetH = isHorizontal ? vidH : Math.round(vidH / 2);
        rgbRect = [0, 0, targetW, targetH];
        alphaRect = isHorizontal ? [targetW, 0, targetW, targetH] : [0, targetH, targetW, targetH];
      }

      setDimensions({ width: targetW, height: targetH });
      setDuration(vid.duration || 1);
      const videoFps = vapConfig?.info?.f || vapConfig?.info?.fps || 30;
      setFps(videoFps);
      setTotalFrames(Math.max(1, Math.round((vid.duration || 1) * videoFps)));
    };

    vid.onloadedmetadata = handleLoadedMetadata;
    vid.src = url;
    vid.load();
    await vid.play().catch(() => {});

    if (vid.readyState >= 1) {
      handleLoadedMetadata();
    }

    // Reusable offscreen canvas to avoid creating DOM nodes on each tick
    const offCanvas = document.createElement('canvas');
    let offCtx: CanvasRenderingContext2D | null = null;

    // Render transparent alpha channel shader loop on canvas
    const renderLoop = () => {
      if (videoRef.current && canvasRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        const v = videoRef.current;
        const cvs = canvasRef.current;
        const ctx = cvs.getContext('2d', { willReadFrequently: true });

        if (ctx && v.videoWidth > 0) {
          const vw = v.videoWidth;
          const vh = v.videoHeight;
          const outW = targetW;
          const outH = targetH;

          if (cvs.width !== outW) cvs.width = outW;
          if (cvs.height !== outH) cvs.height = outH;

          if (offCanvas.width !== vw || offCanvas.height !== vh) {
            offCanvas.width = vw;
            offCanvas.height = vh;
            offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          }

          if (offCtx) {
            offCtx.drawImage(v, 0, 0, vw, vh);
            const imgData = offCtx.getImageData(0, 0, vw, vh);
            const src = imgData.data;

            const outImgData = ctx.createImageData(outW, outH);
            const dst = outImgData.data;

            const rgbStartX = rgbRect[0];
            const rgbStartY = rgbRect[1];
            const aStartX = alphaRect[0];
            const aStartY = alphaRect[1];

            for (let y = 0; y < outH; y++) {
              for (let x = 0; x < outW; x++) {
                const rgbX = rgbStartX + x;
                const rgbY = rgbStartY + y;
                const aX = aStartX + x;
                const aY = aStartY + y;

                const rgbIdx = (rgbY * vw + rgbX) * 4;
                const aIdx = (aY * vw + aX) * 4;
                const dstIdx = (y * outW + x) * 4;

                const r = src[rgbIdx];
                const g = src[rgbIdx + 1];
                const b = src[rgbIdx + 2];

                // Calculate grayscale luminance of alpha channel
                const rawAlpha = 0.299 * src[aIdx] + 0.587 * src[aIdx + 1] + 0.114 * src[aIdx + 2];

                if (alphaMode === 'rgb_only') {
                  dst[dstIdx] = r;
                  dst[dstIdx + 1] = g;
                  dst[dstIdx + 2] = b;
                  dst[dstIdx + 3] = 255;
                } else if (alphaMode === 'alpha_only') {
                  const val = Math.round(rawAlpha);
                  dst[dstIdx] = val;
                  dst[dstIdx + 1] = val;
                  dst[dstIdx + 2] = val;
                  dst[dstIdx + 3] = 255;
                } else {
                  // Clean thresholding for 100% crisp transparency
                  if (rawAlpha <= 8) {
                    dst[dstIdx] = 0;
                    dst[dstIdx + 1] = 0;
                    dst[dstIdx + 2] = 0;
                    dst[dstIdx + 3] = 0;
                  } else {
                    const cleanAlpha = Math.min(255, Math.max(0, (rawAlpha - 8) * (255 / 247)));
                    dst[dstIdx] = r;
                    dst[dstIdx + 1] = g;
                    dst[dstIdx + 2] = b;
                    dst[dstIdx + 3] = Math.round(cleanAlpha);
                  }
                }
              }
            }

            ctx.putImageData(outImgData, 0, 0);
          }

          setCurrentTime(v.currentTime);
          setCurrentFrame(Math.round(v.currentTime * 30));
        }
      }
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  // Standard Video
  const initStandardVideo = async (fileObj: File) => {
    const url = URL.createObjectURL(fileObj);
    if (!videoRef.current) return;

    videoRef.current.src = url;
    videoRef.current.load();
    await videoRef.current.play().catch(() => {});

    videoRef.current.onloadedmetadata = () => {
      if (!videoRef.current) return;
      setDimensions({ width: videoRef.current.videoWidth, height: videoRef.current.videoHeight });
      setDuration(videoRef.current.duration || 1);
      setFps(30);
      setTotalFrames(Math.round((videoRef.current.duration || 1) * 30));
    };

    videoRef.current.ontimeupdate = () => {
      if (!videoRef.current) return;
      setCurrentTime(videoRef.current.currentTime);
      setCurrentFrame(Math.round(videoRef.current.currentTime * 30));
    };
  };

  // SVG / SMIL
  const initSvg = async (fileObj: File) => {
    const text = await fileObj.text();
    if (lottieContainerRef.current) {
      lottieContainerRef.current.innerHTML = text;
      const svgEl = lottieContainerRef.current.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        setDimensions({
          width: svgEl.viewBox?.baseVal?.width || 500,
          height: svgEl.viewBox?.baseVal?.height || 500
        });
      }
    }
  };

  // Playback Control Handlers
  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (formatType === 'SVGA' && svgaPlayerRef.current) {
      if (nextState) svgaPlayerRef.current.start();
      else svgaPlayerRef.current.pause();
    } else if ((formatType === 'LOTTIE' || formatType === 'DOTLOTTIE') && lottieAnimRef.current) {
      if (nextState) lottieAnimRef.current.play();
      else lottieAnimRef.current.pause();
    } else if (formatType === 'PAG' && pagPlayerRef.current) {
      if (nextState) pagPlayerRef.current.play();
      else pagPlayerRef.current.pause();
    } else if (videoRef.current) {
      if (nextState) videoRef.current.play();
      else videoRef.current.pause();
    }
  };

  const handleSeek = (newProgress: number) => {
    const targetTime = newProgress * duration;
    setCurrentTime(targetTime);
    setCurrentFrame(Math.round(newProgress * totalFrames));

    if (formatType === 'SVGA' && svgaPlayerRef.current) {
      svgaPlayerRef.current.step(Math.round(newProgress * totalFrames));
    } else if ((formatType === 'LOTTIE' || formatType === 'DOTLOTTIE') && lottieAnimRef.current) {
      lottieAnimRef.current.goToAndStop(Math.round(newProgress * totalFrames), true);
    } else if (formatType === 'PAG' && pagPlayerRef.current) {
      pagPlayerRef.current.setProgress(newProgress);
      pagPlayerRef.current.flush();
    } else if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleStepFrame = (delta: number) => {
    const nextFrame = Math.max(0, Math.min(totalFrames - 1, currentFrame + delta));
    handleSeek(nextFrame / Math.max(1, totalFrames));
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (lottieAnimRef.current) lottieAnimRef.current.setSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
  };

  // Upload to MEGA Cloud Storage
  const handleUploadToMega = async () => {
    if (!file) return;
    setUploadingToMega(true);
    setMegaUploadSuccess(null);
    try {
      const res = await uploadToMegaStorage(file, { sourceFeature: 'universal_player' });
      if (res.success) {
        setMegaUploadSuccess(res.downloadUrl || res.megaUrl || 'تم الرفع والتخزين السحابي في MEGA بنجاح!');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل الرفع إلى MEGA');
    } finally {
      setUploadingToMega(false);
    }
  };

  // Export current frame as PNG
  const handleCaptureFrame = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${file?.name.split('.')[0] || 'frame'}_frame_${currentFrame}.png`;
      a.click();
    }
  };

  // Download raw file
  const handleDownloadFile = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const spec = FORMAT_SPECS[formatType] || FORMAT_SPECS.UNKNOWN;

  // Background styling
  const getBgStyle = () => {
    if (bgMode === 'grid_dark') return 'bg-[#0f172a] bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]';
    if (bgMode === 'grid_light') return 'bg-slate-200 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]';
    if (bgMode === 'black') return 'bg-black';
    if (bgMode === 'white') return 'bg-white';
    if (bgMode === 'green') return 'bg-[#00ff00]';
    if (bgMode === 'blue') return 'bg-[#0066ff]';
    return 'bg-[#0b1020]';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in" dir="rtl">
      <div className="bg-[#0b1020] border border-white/15 rounded-3xl w-full max-w-6xl h-[92vh] max-h-[920px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white truncate max-w-sm">
                  {file?.name || 'مشغل الأنيميشن الشامل'}
                </h3>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${spec.badgeColor}`}>
                  {spec.label}
                </span>
                <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                  {spec.categoryLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dimensions.width}×{dimensions.height} px • {fps} FPS • {totalFrames} إطار • {duration.toFixed(2)}s • {file ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : ''}
              </p>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2">
            {onOpenInEditor && file && (
              <button
                onClick={() => {
                  onClose();
                  onOpenInEditor(file);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>فتح في محرر الطبقات</span>
              </button>
            )}

            {onConvertToSvga && file && formatType !== 'SVGA' && (
              <button
                onClick={() => {
                  onClose();
                  onConvertToSvga(file);
                }}
                className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow-md shadow-pink-600/20 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>تحويل إلى SVGA</span>
              </button>
            )}

            <button
              onClick={handleUploadToMega}
              disabled={uploadingToMega}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-medium border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="حفظ الملف في مجلد MEGA المخصص"
            >
              <HardDrive className={`w-4 h-4 ${uploadingToMega ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{uploadingToMega ? 'جاري الرفع لـ MEGA...' : 'حفظ في MEGA'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Bar for Mega Upload or Errors */}
        {megaUploadSuccess && (
          <div className="px-6 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>تم حفظ الملف بنجاح في مجلد كاش MEGA!</span>
            </div>
            <a href={megaUploadSuccess} target="_blank" rel="noreferrer" className="underline font-mono text-[11px] text-emerald-200">
              فتح الرابط ↗
            </a>
          </div>
        )}

        {errorMessage && (
          <div className="px-6 py-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Body Stage */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Visual Display Screen */}
          <div className={`flex-1 relative flex items-center justify-center p-4 overflow-hidden select-none transition-colors duration-300 ${getBgStyle()}`}>
            
            {loading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm space-y-3">
                <div className="w-10 h-10 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-xs text-indigo-300 font-medium">جاري فك تشفير وتشغيل {spec.label}...</span>
              </div>
            )}

            {/* Renderer Views Container */}
            <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden">
              
              {/* Canvas Renderer (SVGA, PAG, PNG Sequence, VAP Dual Channel) */}
              <canvas
                ref={canvasRef}
                className={`max-w-full max-h-[58vh] object-contain ${
                  ['SVGA', 'PAG', 'PNG_SEQUENCE_ZIP', 'VAP', 'YYEVA', 'DUAL_CHANNEL_VIDEO'].includes(formatType)
                    ? 'block' 
                    : 'hidden'
                }`}
              />

              {/* Animated Image Preview (GIF, WebP, APNG) */}
              {['GIF', 'WEBP', 'APNG'].includes(formatType) && animatedImageUrl && (
                <img
                  src={animatedImageUrl}
                  alt="Animated preview"
                  className="max-w-full max-h-[58vh] object-contain rounded-xl select-none"
                />
              )}

              {/* Lottie / DotLottie / SVG Vector Container */}
              <div
                ref={lottieContainerRef}
                className={`w-full h-full max-w-[500px] max-h-[58vh] flex items-center justify-center ${
                  ['LOTTIE', 'DOTLOTTIE', 'SVG_SMIL'].includes(formatType) ? 'block' : 'hidden'
                }`}
              />

              {/* HTML5 Video Element (MP4, MOV, WebM and hidden backend for VAP shader) */}
              <video
                ref={videoRef}
                loop={isLooping}
                muted={isMuted}
                playsInline
                autoPlay
                className={`max-w-full max-h-[58vh] object-contain rounded-xl ${
                  ['MP4', 'MOV', 'WEBM'].includes(formatType) ? 'block' : 'hidden'
                }`}
              />
            </div>

            {/* Quick Background & Channel Switcher Floater */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 p-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              <button
                onClick={() => setBgMode('grid_dark')}
                className={`w-6 h-6 rounded-lg border text-[10px] font-bold flex items-center justify-center transition-all ${
                  bgMode === 'grid_dark' ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-slate-800 text-slate-400'
                }`}
                title="خلفية شبكية داكنة"
              >
                🏁
              </button>
              <button
                onClick={() => setBgMode('grid_light')}
                className={`w-6 h-6 rounded-lg border text-[10px] font-bold flex items-center justify-center transition-all ${
                  bgMode === 'grid_light' ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300' : 'border-white/10 bg-slate-300 text-slate-700'
                }`}
                title="خلفية شبكية فاتحة"
              >
                ⬜
              </button>
              <button
                onClick={() => setBgMode('black')}
                className={`w-6 h-6 rounded-lg border bg-black transition-all ${
                  bgMode === 'black' ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-white/20'
                }`}
                title="خلفية سوداء"
              />
              <button
                onClick={() => setBgMode('white')}
                className={`w-6 h-6 rounded-lg border bg-white transition-all ${
                  bgMode === 'white' ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-white/20'
                }`}
                title="خلفية بيضاء"
              />
              <button
                onClick={() => setBgMode('green')}
                className={`w-6 h-6 rounded-lg border bg-[#00ff00] transition-all ${
                  bgMode === 'green' ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-white/20'
                }`}
                title="كروما خضراء"
              />
              <button
                onClick={() => setBgMode('blue')}
                className={`w-6 h-6 rounded-lg border bg-[#0066ff] transition-all ${
                  bgMode === 'blue' ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-white/20'
                }`}
                title="كروما زرقاء"
              />

              {['VAP', 'YYEVA', 'DUAL_CHANNEL_VIDEO'].includes(formatType) && (
                <div className="border-r border-white/15 pr-1.5 mr-1.5 flex items-center gap-1">
                  <button
                    onClick={() => setAlphaMode(alphaMode === 'composite' ? 'rgb_only' : 'composite')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                      alphaMode === 'composite' 
                        ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' 
                        : 'bg-slate-800 text-slate-400 border-white/10'
                    }`}
                  >
                    {alphaMode === 'composite' ? 'ألفا مدمجة' : 'RGB خام'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right/Bottom Sidebar: Layers, Assets, Specs */}
          <div className="w-full md:w-80 bg-slate-900/80 border-t md:border-t-0 md:border-r border-white/10 flex flex-col">
            
            {/* Sidebar Subtabs */}
            <div className="flex items-center border-b border-white/10 px-3 pt-3 gap-2">
              <button
                onClick={() => setActiveTab('player')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all ${
                  activeTab === 'player' 
                    ? 'bg-slate-800 text-indigo-300 border-t border-x border-white/10' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                التحكم بالتشغيل
              </button>
              <button
                onClick={() => setActiveTab('layers')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all ${
                  activeTab === 'layers' 
                    ? 'bg-slate-800 text-indigo-300 border-t border-x border-white/10' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الطبقات والعناصر ({extractedAssets.length})
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all ${
                  activeTab === 'info' 
                    ? 'bg-slate-800 text-indigo-300 border-t border-x border-white/10' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                المواصفات
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar text-right">
              
              {activeTab === 'player' && (
                <div className="space-y-4">
                  {/* Speed Controller */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">سرعة العرض (Playback Speed):</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0.25, 0.5, 1.0, 1.5, 2.0].map(s => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          className={`py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                            playbackSpeed === s
                              ? 'bg-indigo-600 text-white shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Loop & Audio toggles */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsLooping(!isLooping)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isLooping
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{isLooping ? 'تكرار دائم' : 'مرة واحدة'}</span>
                    </button>

                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        !isMuted
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      <span>{isMuted ? 'صامت' : 'صوت مفعل'}</span>
                    </button>
                  </div>

                  {/* Export Utilities */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <span className="text-xs font-semibold text-slate-300">أدوات الاستخراج والحفظ السريع:</span>
                    <button
                      onClick={handleCaptureFrame}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-white/10 flex items-center justify-between transition-colors"
                    >
                      <span>التقاط الإطار الحالي كـ PNG</span>
                      <ImageIcon className="w-4 h-4 text-indigo-400" />
                    </button>

                    <button
                      onClick={handleDownloadFile}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-white/10 flex items-center justify-between transition-colors"
                    >
                      <span>تنزيل الملف الأصلي على جهازك</span>
                      <Download className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'layers' && (
                <div className="space-y-3">
                  {extractedAssets.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      لا توجد طبقات صور مستخرجة من هذا الملف
                    </div>
                  ) : (
                    extractedAssets.map((asset, idx) => (
                      <div key={asset.id || idx} className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <img src={asset.url} alt={asset.name} className="w-9 h-9 rounded-lg object-contain bg-slate-800 border border-white/10" />
                          <div>
                            <div className="text-xs font-bold text-slate-200 truncate max-w-[130px]">{asset.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{asset.id}</div>
                          </div>
                        </div>
                        <a
                          href={asset.url}
                          download={`${asset.name}.png`}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                          title="تنزيل العنصر"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'info' && (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between">
                    <span className="text-slate-400">صيغة الملف:</span>
                    <span className="font-bold text-white">{spec.label}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between">
                    <span className="text-slate-400">الأبعاد:</span>
                    <span className="font-mono text-indigo-300">{dimensions.width} × {dimensions.height} px</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between">
                    <span className="text-slate-400">معدل الإطارات (FPS):</span>
                    <span className="font-mono text-emerald-300">{fps} fps</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between">
                    <span className="text-slate-400">إجمالي الإطارات:</span>
                    <span className="font-mono text-purple-300">{totalFrames} frame</span>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex justify-between">
                    <span className="text-slate-400">المدة الزمنية:</span>
                    <span className="font-mono text-amber-300">{duration.toFixed(2)} ثانية</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Bottom Timeline & Scrubber Bar */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/90 space-y-2">
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 w-12 text-left">
              {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
            </span>

            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={totalFrames > 0 ? currentFrame / totalFrames : 0}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />

            <span className="text-[11px] font-mono text-slate-400 w-12 text-right">
              {Math.floor(duration / 60)}:{(duration % 60).toFixed(1).padStart(4, '0')}
            </span>
          </div>

          {/* Main Controls Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStepFrame(-1)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                title="الإطار السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleTogglePlay}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center"
                title={isPlaying ? 'إيقاف مؤقت (Space)' : 'تشغيل (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => handleStepFrame(1)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                title="الإطار التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs font-mono font-semibold text-indigo-300 bg-slate-950/80 px-3 py-1 rounded-xl border border-white/10">
              الإطار: {currentFrame} / {totalFrames}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UniversalMultiFormatPlayerModal;
