import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Download, 
  Maximize2, Minimize2, Sparkles, Layers, FileVideo, Image as ImageIcon,
  Film, Settings, Info, Check, Eye, Sliders, ChevronLeft,
  ChevronRight, RefreshCw, Upload, X, ShieldCheck, Zap, Grid, Shield,
  Video, CheckCircle2, AlertCircle, StopCircle, FolderArchive, ArrowDownCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { Parser as SvgaParser, Player as SvgaPlayer } from 'svga.lite';
import { extractVapConfigFromBlob } from '../utils/vapEngine';
import { WatermarkConfig, drawAnimatedWatermark } from '../utils/watermarkAndBackground';
import { convertItemToStandardMp4, UniversalConvertResult } from '../utils/universalMp4Converter';

export type ViewerFormatType = 'yyeva' | 'vap' | 'mp4' | 'webm' | 'gif' | 'png_seq' | 'svga';

export interface ViewerItem {
  id: string;
  name: string;
  file?: File;
  url: string;
  format: ViewerFormatType;
  size?: number;
}

export interface ConvertJob {
  item: ViewerItem;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  statusText?: string;
  result?: UniversalConvertResult;
  error?: string;
}

interface MultiFormatAnimationPlayerProps {
  initialItem?: ViewerItem | null;
  items?: ViewerItem[];
  onClose?: () => void;
  isModal?: boolean;
  customBgUrl?: string | null;
  watermarkConfig?: WatermarkConfig;
}

export const detectViewerFormat = async (file: File): Promise<ViewerFormatType> => {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';

  if (ext === 'svga') return 'svga';
  if (ext === 'gif') return 'gif';
  if (ext === 'webm') return 'webm';
  if (ext === 'zip') return 'png_seq';
  
  if (name.includes('yyeva') || name.includes('right_alpha')) return 'yyeva';
  if (name.includes('vap') || name.includes('left_alpha')) return 'vap';

  if (ext === 'mp4' || ext === 'mov') {
    try {
      const config = await extractVapConfigFromBlob(file);
      if (config?.info) {
        const rgbFrame = config.info.rgbFrame || [];
        const aFrame = config.info.aFrame || [];
        // If rgb starts at 0 and alpha starts at w -> YYEVA
        if (rgbFrame[0] === 0 && aFrame[0] > 0) return 'yyeva';
        // If alpha starts at 0 and rgb starts at w -> VAP
        if (aFrame[0] === 0 && rgbFrame[0] > 0) return 'vap';
      }
    } catch (e) {
      // ignore
    }
    // Default MP4 with split or regular
    return 'yyeva'; // Default to YYEVA as it's the standard for live stream alpha videos
  }

  return 'mp4';
};

export const MultiFormatAnimationPlayer: React.FC<MultiFormatAnimationPlayerProps> = ({
  initialItem,
  items: initialItems = [],
  onClose,
  isModal = false,
  customBgUrl,
  watermarkConfig
}) => {
  const [playlist, setPlaylist] = useState<ViewerItem[]>(() => {
    if (initialItem && !initialItems.some(i => i.id === initialItem.id)) {
      return [initialItem, ...initialItems];
    }
    return initialItems.length > 0 ? initialItems : (initialItem ? [initialItem] : []);
  });

  const [activeItem, setActiveItem] = useState<ViewerItem | null>(() => {
    return initialItem || (initialItems.length > 0 ? initialItems[0] : null);
  });

  // Player state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [localBgUrl, setLocalBgUrl] = useState<string | null>(customBgUrl || null);
  const [bgType, setBgType] = useState<'checkerboard' | 'dark' | 'white' | 'green' | 'custom'>(() => customBgUrl ? 'custom' : 'checkerboard');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(0);
  const [fps, setFps] = useState<number>(30);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Anti-theft animated watermark state
  const [localWatermark, setLocalWatermark] = useState<WatermarkConfig>(() => {
    return watermarkConfig || {
      enabled: false,
      text: '© محتوى محمي - يمنع السرقة',
      opacity: 0.45,
      fontSize: 24,
      color: '#ffffff',
      textColor: '#ffffff',
      style: 'bouncing'
    };
  });

  useEffect(() => {
    if (customBgUrl) {
      setLocalBgUrl(customBgUrl);
      setBgType('custom');
    }
  }, [customBgUrl]);

  useEffect(() => {
    if (watermarkConfig) {
      setLocalWatermark(watermarkConfig);
    }
  }, [watermarkConfig]);

  // Active format override (allows switching between YYEVA, VAP, MP4 on the fly)
  const [formatOverride, setFormatOverride] = useState<ViewerFormatType | null>(null);
  const currentFormat: ViewerFormatType = formatOverride || (activeItem ? activeItem.format : 'yyeva');

  // DOM and Engine references
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const svgaCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgaPlayerRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalBgUrl(url);
    setBgType('custom');
    if (bgFileInputRef.current) bgFileInputRef.current.value = '';
  };

  // PNG sequence state
  const pngFramesRef = useRef<HTMLImageElement[]>([]);
  const [pngFps, setPngFps] = useState<number>(24);

  // WebGL rendering context cache
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const glProgramRef = useRef<WebGLProgram | null>(null);
  const glTexRef = useRef<WebGLTexture | null>(null);

  // Export to MP4 State & Logic
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportJobs, setExportJobs] = useState<ConvertJob[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportBgType, setExportBgType] = useState<'black' | 'white' | 'green' | 'custom'>(() => customBgUrl ? 'custom' : 'black');
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [exportResolution, setExportResolution] = useState<'original' | '720p' | '1080p'>('original');
  const [exportWatermarkEnabled, setExportWatermarkEnabled] = useState<boolean>(localWatermark.enabled);
  const cancelExportRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const openExportModal = (itemsToExport: ViewerItem[]) => {
    if (itemsToExport.length === 0) return;
    const initialJobs: ConvertJob[] = itemsToExport.map(item => ({
      item,
      status: 'pending',
      progress: 0,
      statusText: 'في الانتظار ⏳'
    }));
    setExportJobs(initialJobs);
    setExportWatermarkEnabled(localWatermark.enabled);
    setExportBgType(localBgUrl ? 'custom' : 'black');
    setShowExportModal(true);
  };

  const startExportProcess = async () => {
    if (isExporting || exportJobs.length === 0) return;
    setIsExporting(true);
    cancelExportRef.current = { cancelled: false };

    for (let i = 0; i < exportJobs.length; i++) {
      if (cancelExportRef.current.cancelled) break;
      const currentJob = exportJobs[i];
      if (currentJob.status === 'done') continue;

      setExportJobs(prev => prev.map((job, idx) => idx === i ? { ...job, status: 'processing', progress: 5, statusText: 'جاري البدء والتحضير...' } : job));

      try {
        const result = await convertItemToStandardMp4(currentJob.item, {
          bgType: exportBgType,
          customBgUrl: localBgUrl,
          customBgMode: 'cover',
          watermarkConfig: exportWatermarkEnabled ? localWatermark : undefined,
          quality: exportQuality,
          targetResolution: exportResolution,
          cancelSignal: cancelExportRef.current,
          onProgress: (pct, msg) => {
            setExportJobs(prev => prev.map((job, idx) => idx === i ? { ...job, progress: pct, statusText: msg } : job));
          }
        });

        setExportJobs(prev => prev.map((job, idx) => idx === i ? {
          ...job,
          status: 'done',
          progress: 100,
          statusText: 'تم التحويل بنجاح! ✅',
          result
        } : job));
      } catch (err: any) {
        if (cancelExportRef.current.cancelled) break;
        console.error('Export error for item:', currentJob.item.name, err);
        setExportJobs(prev => prev.map((job, idx) => idx === i ? {
          ...job,
          status: 'error',
          progress: 0,
          error: err?.message || 'حدث خطأ أثناء التصدير',
          statusText: 'فشل التصدير'
        } : job));
      }
    }

    setIsExporting(false);
  };

  const stopExportProcess = () => {
    cancelExportRef.current.cancelled = true;
    setIsExporting(false);
  };

  const downloadJobResult = (job: ConvertJob) => {
    if (!job.result) return;
    const a = document.createElement('a');
    a.href = job.result.url;
    a.download = job.result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllJobsAsZip = async () => {
    const completedJobs = exportJobs.filter(j => j.status === 'done' && j.result);
    if (completedJobs.length === 0) return;

    if (completedJobs.length === 1 && completedJobs[0].result) {
      downloadJobResult(completedJobs[0]);
      return;
    }

    const zip = new JSZip();
    for (const job of completedJobs) {
      if (job.result) {
        zip.file(job.result.fileName, job.result.blob);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_mp4_videos_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Sync active item when props change
  useEffect(() => {
    if (initialItem) {
      setActiveItem(initialItem);
      setFormatOverride(null);
      setPlaylist(prev => {
        if (!prev.some(p => p.id === initialItem.id)) {
          return [initialItem, ...prev];
        }
        return prev;
      });
    }
  }, [initialItem]);

  // Clean WebGL resources
  const cleanupWebGL = useCallback(() => {
    if (glRef.current && glTexRef.current) {
      glRef.current.deleteTexture(glTexRef.current);
      glTexRef.current = null;
    }
    glRef.current = null;
    glProgramRef.current = null;
  }, []);

  // Initialize WebGL for Alpha Blending (YYEVA & Tencent VAP)
  const initWebGL = useCallback((canvas: HTMLCanvasElement) => {
    cleanupWebGL();
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!gl) return false;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      uniform int u_format; // 0: YYEVA (RGB left, Alpha right), 1: VAP (Alpha left, RGB right), 2: Normal MP4
      varying vec2 v_texCoord;

      void main() {
        if (u_format == 0) {
          // YYEVA: Left half is RGB, Right half is Alpha
          vec2 rgbUV = vec2(v_texCoord.x * 0.5, v_texCoord.y);
          vec2 alphaUV = vec2(v_texCoord.x * 0.5 + 0.5, v_texCoord.y);
          vec4 color = texture2D(u_image, rgbUV);
          vec4 alphaColor = texture2D(u_image, alphaUV);
          float alpha = dot(alphaColor.rgb, vec3(0.299, 0.587, 0.114));
          if (alpha <= 0.03) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
            gl_FragColor = vec4(color.rgb, alpha);
          }
        } else if (u_format == 1) {
          // Tencent VAP: Left half is Alpha, Right half is RGB
          vec2 alphaUV = vec2(v_texCoord.x * 0.5, v_texCoord.y);
          vec2 rgbUV = vec2(v_texCoord.x * 0.5 + 0.5, v_texCoord.y);
          vec4 color = texture2D(u_image, rgbUV);
          vec4 alphaColor = texture2D(u_image, alphaUV);
          float alpha = dot(alphaColor.rgb, vec3(0.299, 0.587, 0.114));
          if (alpha <= 0.03) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
            gl_FragColor = vec4(color.rgb, alpha);
          }
        } else {
          // Normal Full Video
          gl_FragColor = texture2D(u_image, v_texCoord);
        }
      }
    `;

    const createShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }

    gl.useProgram(program);

    // Setup geometry buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      0, 0,
      1, 1,
      1, 0,
    ]), gl.STATIC_DRAW);

    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    glRef.current = gl;
    glProgramRef.current = program;
    glTexRef.current = texture;

    return true;
  }, [cleanupWebGL]);

  // Load and unpack PNG sequence from ZIP
  const loadZipSequence = async (item: ViewerItem) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let buffer: ArrayBuffer;
      if (item.file) {
        buffer = await item.file.arrayBuffer();
      } else {
        const res = await fetch(item.url);
        buffer = await res.arrayBuffer();
      }

      const zip = new JSZip();
      const zipContent = await zip.loadAsync(buffer);
      const pngFileNames = Object.keys(zipContent.files)
        .filter(n => n.toLowerCase().endsWith('.png') && !n.startsWith('__MACOSX') && !n.includes('/.'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      if (pngFileNames.length === 0) {
        throw new Error('لا توجد صور PNG صالحة داخل ملف الـ ZIP.');
      }

      const images: HTMLImageElement[] = [];
      for (const name of pngFileNames) {
        const blob = await zipContent.files[name].async('blob');
        const imgUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = imgUrl;
        await new Promise(res => {
          img.onload = () => res(true);
          img.onerror = () => res(false);
        });
        images.push(img);
      }

      pngFramesRef.current = images;
      setTotalFrames(images.length);
      const w = images[0].naturalWidth || 500;
      const h = images[0].naturalHeight || 500;
      setVideoDimensions({ width: w, height: h });
      setDuration(images.length / pngFps);
      setCurrentFrame(0);
      setCurrentTime(0);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error unpacking PNG zip sequence:', err);
      setLoadError(err.message || 'فشل فك وقراءة حزمة PNG');
      setIsLoading(false);
    }
  };

  // Load SVGA animation
  const loadSvga = async (item: ViewerItem) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      let buffer: ArrayBuffer;
      if (item.file) {
        buffer = await item.file.arrayBuffer();
      } else {
        const res = await fetch(item.url);
        buffer = await res.arrayBuffer();
      }

      const parser = new SvgaParser();
      const videoItem = await parser.do(buffer);

      // Wait a tick if canvas is mounting
      let canvas = svgaCanvasRef.current;
      if (!canvas) {
        await new Promise(r => setTimeout(r, 60));
        canvas = svgaCanvasRef.current;
      }
      if (!canvas) throw new Error('فشل العثور على لوحة تشغيل SVGA');

      const w = videoItem.videoSize?.width || 500;
      const h = videoItem.videoSize?.height || 500;
      const f = videoItem.FPS || 30;
      const tf = videoItem.frames || 60;

      canvas.width = w;
      canvas.height = h;

      const player = new SvgaPlayer(canvas);
      await player.mount(videoItem);
      player.set({ loop: isLooping ? 0 : 1, fillMode: 'forwards' });
      
      player.onProcess = (process: number) => {
        const frame = Math.min(tf - 1, Math.floor(process * tf));
        setCurrentFrame(frame);
        setCurrentTime(frame / f);
      };

      player.onEnd = () => {
        if (!isLooping) setIsPlaying(false);
      };

      player.start();
      svgaPlayerRef.current = player;
      setIsPlaying(true);

      setVideoDimensions({ width: w, height: h });
      setFps(f);
      setTotalFrames(tf);
      setDuration(tf / f);
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error parsing SVGA in viewer:', err);
      setLoadError(err.message || 'فشل قراءة ملف SVGA');
      setIsLoading(false);
    }
  };

  // Main loader for the active item
  useEffect(() => {
    if (!activeItem) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (svgaPlayerRef.current) {
      try { svgaPlayerRef.current.stop(); } catch (e) {}
      svgaPlayerRef.current = null;
    }

    setCurrentTime(0);
    setCurrentFrame(0);
    setLoadError(null);

    if (activeItem.format === 'png_seq') {
      loadZipSequence(activeItem);
    } else if (activeItem.format === 'svga') {
      loadSvga(activeItem);
    } else {
      // Video (YYEVA, VAP, MP4, WebM) or GIF
      setIsLoading(true);
      const vid = videoRef.current;
      if (vid && activeItem.format !== 'gif') {
        vid.src = activeItem.url;
        vid.playbackRate = playbackSpeed;
        vid.loop = isLooping;
        vid.muted = isMuted;
        vid.load();
      } else if (activeItem.format === 'gif') {
        const img = new Image();
        img.src = activeItem.url;
        img.onload = () => {
          setVideoDimensions({ width: img.naturalWidth || 500, height: img.naturalHeight || 500 });
          setDuration(2);
          setTotalFrames(60);
          setIsLoading(false);
        };
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeItem?.id, activeItem?.url]);

  // Video loaded metadata handler
  const handleVideoLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;

    const rawW = vid.videoWidth || 750;
    const rawH = vid.videoHeight || 750;
    const isDual = currentFormat === 'yyeva' || currentFormat === 'vap';
    const renderW = isDual ? Math.round(rawW / 2) : rawW;
    const renderH = rawH;

    setVideoDimensions({ width: renderW, height: renderH });
    setDuration(vid.duration || 1);
    setFps(30);
    setTotalFrames(Math.round((vid.duration || 1) * 30));
    setIsLoading(false);

    if (canvasRef.current) {
      canvasRef.current.width = renderW;
      canvasRef.current.height = renderH;
      if (isDual) {
        initWebGL(canvasRef.current);
      }
    }

    if (isPlaying) {
      vid.play().catch(() => {});
    }
  };

  // Video Animation Render Loop (WebGL or 2D Canvas)
  useEffect(() => {
    if (activeItem?.format === 'png_seq' || activeItem?.format === 'svga' || activeItem?.format === 'gif') {
      return;
    }

    const vid = videoRef.current;
    const cvs = canvasRef.current;
    if (!vid || !cvs) return;

    const isDual = currentFormat === 'yyeva' || currentFormat === 'vap';

    const renderLoop = () => {
      if (vid && cvs && vid.readyState >= 2 && !vid.paused && !vid.ended) {
        const rawW = vid.videoWidth;
        const rawH = vid.videoHeight;
        const renderW = isDual ? Math.round(rawW / 2) : rawW;
        const renderH = rawH;

        if (cvs.width !== renderW) cvs.width = renderW;
        if (cvs.height !== renderH) cvs.height = renderH;

        if (isDual && glRef.current && glProgramRef.current && glTexRef.current) {
          // WebGL GPU shader rendering
          const gl = glRef.current;
          gl.viewport(0, 0, renderW, renderH);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, glTexRef.current);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);

          const uFormatLoc = gl.getUniformLocation(glProgramRef.current, 'u_format');
          // 0: YYEVA (RGB left, Alpha right), 1: VAP (Alpha left, RGB right)
          gl.uniform1i(uFormatLoc, currentFormat === 'yyeva' ? 0 : 1);

          gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else {
          // Standard 2D canvas drawing (WebM transparent or MP4)
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, renderW, renderH);
            if (isDual) {
              // 2D Fallback for dual channel
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = rawW;
              tempCanvas.height = rawH;
              const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
              if (tCtx) {
                tCtx.drawImage(vid, 0, 0, rawW, rawH);
                const rgbStartX = currentFormat === 'yyeva' ? 0 : renderW;
                const alphaStartX = currentFormat === 'yyeva' ? renderW : 0;

                const rgbData = tCtx.getImageData(rgbStartX, 0, renderW, renderH).data;
                const alphaData = tCtx.getImageData(alphaStartX, 0, renderW, renderH).data;
                const output = ctx.createImageData(renderW, renderH);
                const outPx = output.data;

                for (let i = 0; i < outPx.length; i += 4) {
                  const a = alphaData[i];
                  outPx[i] = rgbData[i];
                  outPx[i + 1] = rgbData[i + 1];
                  outPx[i + 2] = rgbData[i + 2];
                  outPx[i + 3] = a > 8 ? a : 0;
                }
                ctx.putImageData(output, 0, 0);
              }
            } else {
              ctx.drawImage(vid, 0, 0, renderW, renderH);
            }
          }
        }

        setCurrentTime(vid.currentTime);
        setCurrentFrame(Math.round(vid.currentTime * 30));
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [currentFormat, activeItem?.format]);

  // PNG Sequence Render Loop
  useEffect(() => {
    if (activeItem?.format !== 'png_seq' || pngFramesRef.current.length === 0) return;

    let timer: NodeJS.Timeout;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentFrame(prev => {
          const next = (prev + 1) % pngFramesRef.current.length;
          const img = pngFramesRef.current[next];
          if (img) {
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
          }
          setCurrentTime(next / pngFps);
          return next;
        });
      }, 1000 / (pngFps * playbackSpeed));
    } else {
      const img = pngFramesRef.current[currentFrame];
      if (img) {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      }
    }

    return () => clearInterval(timer);
  }, [activeItem?.format, isPlaying, pngFps, playbackSpeed, currentFrame]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (activeItem?.format === 'svga') {
      if (svgaPlayerRef.current) {
        if (isPlaying) svgaPlayerRef.current.pause();
        else svgaPlayerRef.current.start();
      }
    } else if (activeItem?.format === 'png_seq') {
      setIsPlaying(!isPlaying);
    } else {
      const vid = videoRef.current;
      if (vid) {
        if (isPlaying) {
          vid.pause();
          setIsPlaying(false);
        } else {
          vid.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Seek time handler
  const handleSeek = (timeSec: number) => {
    setCurrentTime(timeSec);
    if (activeItem?.format === 'png_seq') {
      const targetFrame = Math.min(pngFramesRef.current.length - 1, Math.max(0, Math.round(timeSec * pngFps)));
      setCurrentFrame(targetFrame);
      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (ctx && cvs && pngFramesRef.current[targetFrame]) {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(pngFramesRef.current[targetFrame], 0, 0, cvs.width, cvs.height);
      }
    } else if (activeItem?.format === 'svga') {
      if (svgaPlayerRef.current && totalFrames > 0) {
        const frame = Math.round((timeSec / duration) * totalFrames);
        svgaPlayerRef.current.stepToFrame(frame, false);
      }
    } else {
      const vid = videoRef.current;
      if (vid) {
        vid.currentTime = timeSec;
      }
    }
  };

  // Step frame forward / backward
  const stepFrame = (direction: 'forward' | 'backward') => {
    if (isPlaying) togglePlay();
    const step = direction === 'forward' ? 1 : -1;

    if (activeItem?.format === 'png_seq') {
      const next = Math.max(0, Math.min(pngFramesRef.current.length - 1, currentFrame + step));
      setCurrentFrame(next);
      handleSeek(next / pngFps);
    } else if (activeItem?.format === 'svga') {
      const next = Math.max(0, Math.min(totalFrames - 1, currentFrame + step));
      setCurrentFrame(next);
      handleSeek((next / totalFrames) * duration);
    } else {
      const vid = videoRef.current;
      if (vid) {
        const frameTime = 1 / 30;
        vid.currentTime = Math.max(0, Math.min(duration, vid.currentTime + (step * frameTime)));
      }
    }
  };

  // Handle local file uploads into viewer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: ViewerItem[] = [];
    for (const file of files) {
      const detected = await detectViewerFormat(file);
      const url = URL.createObjectURL(file);
      newItems.push({
        id: `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        file,
        url,
        format: detected,
        size: file.size
      });
    }

    setPlaylist(prev => [...newItems, ...prev]);
    setActiveItem(newItems[0]);
    setFormatOverride(null);
  };

  // Background styling
  const getBgClass = () => {
    switch (bgType) {
      case 'checkerboard':
        return 'bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%)] bg-[size:20px_20px] bg-slate-900';
      case 'dark':
        return 'bg-black';
      case 'white':
        return 'bg-white';
      case 'green':
        return 'bg-[#00ff00]';
      case 'custom':
        return 'bg-slate-950';
      default:
        return 'bg-slate-950';
    }
  };

  // Live anti-theft watermark preview loop
  useEffect(() => {
    if (!localWatermark.enabled || !watermarkCanvasRef.current) return;
    const cvs = watermarkCanvasRef.current;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let fCount = 0;
    const draw = () => {
      if (cvs.width !== cvs.clientWidth || cvs.height !== cvs.clientHeight) {
        cvs.width = cvs.clientWidth;
        cvs.height = cvs.clientHeight;
      }
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      drawAnimatedWatermark(ctx, cvs.width, cvs.height, fCount, 120, localWatermark);
      fCount = (fCount + 1) % 120;
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animId);
  }, [localWatermark]);

  // Format label & badges
  const getFormatBadge = (fmt: ViewerFormatType) => {
    switch (fmt) {
      case 'yyeva':
        return <span className="px-2.5 py-1 bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-xl text-xs font-black">YYEVA (ألفا يمين)</span>;
      case 'vap':
        return <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black">Tencent VAP (ألفا يسار)</span>;
      case 'mp4':
        return <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-black">MP4 عادي</span>;
      case 'webm':
        return <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-black">WebM شفاف</span>;
      case 'gif':
        return <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black">GIF متحرك</span>;
      case 'png_seq':
        return <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-black">سلسلة PNG (ZIP)</span>;
      case 'svga':
        return <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-black">SVGA أصلي</span>;
      default:
        return null;
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${mins}:${s.padStart(5, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-slate-950 text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden font-arabic ${isModal ? 'max-w-6xl w-full mx-auto my-auto max-h-[92vh]' : 'w-full'}`}
      dir="rtl"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/80 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
            <Eye className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white truncate max-w-sm sm:max-w-md">
                {activeItem ? activeItem.name : 'مشغل وعارض الحركات المتعدد'}
              </h2>
              {getFormatBadge(currentFormat)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">معاينة فورية مع دعم قنوات الألفا الشفافة وسلاسل الإطارات</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Watermark toggle */}
          <button
            type="button"
            onClick={() => setLocalWatermark(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              localWatermark.enabled
                ? 'bg-pink-600 text-white shadow-md'
                : 'bg-white/5 text-slate-300 hover:text-white border border-white/10'
            }`}
            title="تبديل ظهور العلامة المائية المتحركة لحماية الفيديو"
          >
            <Shield className="w-3.5 h-3.5 text-pink-300" />
            <span className="hidden sm:inline">{localWatermark.enabled ? 'العلامة: مفعلة' : 'علامة مائية'}</span>
          </button>

          {/* Quick upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black border border-white/10 transition-all flex items-center gap-1.5"
            title="إضافة ملفات للعرض"
          >
            <Upload className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">إضافة ملفات</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".mp4,.webm,.gif,.zip,.svga,.vap,video/*,image/*"
            className="hidden"
          />

          {/* Single item export button */}
          {activeItem && (
            <button
              type="button"
              onClick={() => openExportModal([activeItem])}
              className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-pink-600/25 transition-all flex items-center gap-1.5 animate-in fade-in"
              title="تصدير وتحويل هذا الملف المعروض إلى فيديو MP4 عادي واحترافي مع دمج الصوت والشفافية"
            >
              <Video className="w-3.5 h-3.5 text-pink-200" />
              <span>تصدير إلى MP4</span>
            </button>
          )}

          {/* Batch export all playlist items */}
          {playlist.length > 1 && (
            <button
              type="button"
              onClick={() => openExportModal(playlist)}
              className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              title="تصدير وتحويل جميع الملفات المعروضة إلى فيديوهات MP4 عادية دفعة واحدة"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">تصدير الكل ({playlist.length})</span>
            </button>
          )}

          {activeItem?.url && (
            <a
              href={activeItem.url}
              download={activeItem.name}
              className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl transition-all"
              title="تحميل الملف الأصلي"
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 min-h-[460px] overflow-hidden">
        {/* Left Side: Display Stage (3 Columns on Large) */}
        <div className="lg:col-span-3 flex flex-col border-b lg:border-b-0 lg:border-l border-white/10">
          {/* Stage Viewport */}
          <div className={`relative flex-1 flex items-center justify-center p-4 min-h-[360px] overflow-hidden ${getBgClass()} transition-colors`}>
            {isLoading && (
              <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
                <span className="text-xs font-black text-slate-300">جاري المعالجة والتحميل...</span>
              </div>
            )}

            {loadError && (
              <div className="absolute inset-0 z-30 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <span className="text-red-400 font-bold text-sm mb-2">{loadError}</span>
                <span className="text-xs text-slate-400">يرجى التأكد من توافق الملف أو اختيار صيغة العرض اليدوية أدناه</span>
              </div>
            )}

            {/* Custom background image if selected */}
            {bgType === 'custom' && localBgUrl && (
              <img
                src={localBgUrl}
                alt="Custom Background"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
              />
            )}

            {/* Video element (used as frame source for YYEVA, VAP, MP4, WebM) */}
            <video
              ref={videoRef}
              playsInline
              onLoadedMetadata={handleVideoLoadedMetadata}
              onEnded={() => { if (!isLooping) setIsPlaying(false); }}
              className="hidden"
            />

            {/* Render Canvas for YYEVA / VAP / WebM / PNG Sequence */}
            {(currentFormat === 'yyeva' || currentFormat === 'vap' || currentFormat === 'webm' || currentFormat === 'mp4' || currentFormat === 'png_seq') && (
              <canvas
                ref={canvasRef}
                className="max-h-[440px] max-w-full object-contain rounded-2xl shadow-2xl transition-transform relative z-10"
              />
            )}

            {/* SVGA Canvas Element */}
            {currentFormat === 'svga' && (
              <canvas
                ref={svgaCanvasRef}
                className="max-h-[440px] max-w-full object-contain rounded-2xl shadow-2xl transition-transform relative z-10"
              />
            )}

            {/* GIF Preview */}
            {currentFormat === 'gif' && activeItem && (
              <img
                src={activeItem.url}
                alt="GIF Animation"
                className="max-h-[440px] max-w-full object-contain rounded-2xl shadow-2xl relative z-10"
              />
            )}

            {/* Live animated anti-theft watermark overlay */}
            {localWatermark.enabled && (
              <canvas
                ref={watermarkCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
              />
            )}

            {/* Stage Floating Quick Background Selector */}
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/10 z-30">
              <button
                type="button"
                onClick={() => {
                  if (localBgUrl) {
                    setBgType('custom');
                  } else {
                    bgFileInputRef.current?.click();
                  }
                }}
                className={`p-1.5 rounded-xl transition-all ${bgType === 'custom' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={localBgUrl ? "الخلفية المرفوعة المخصصة" : "رفع صورة خلفية للعرض"}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={bgFileInputRef}
                onChange={handleLocalBgUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => setBgType('checkerboard')}
                className={`p-1.5 rounded-xl transition-all ${bgType === 'checkerboard' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="شبكة شفافة"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setBgType('dark')}
                className={`p-1.5 rounded-xl transition-all ${bgType === 'dark' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="خلفية سوداء"
              >
                <div className="w-4 h-4 rounded-lg bg-black border border-white/20" />
              </button>
              <button
                onClick={() => setBgType('white')}
                className={`p-1.5 rounded-xl transition-all ${bgType === 'white' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="خلفية بيضاء"
              >
                <div className="w-4 h-4 rounded-lg bg-white border border-white/20" />
              </button>
              <button
                onClick={() => setBgType('green')}
                className={`p-1.5 rounded-xl transition-all ${bgType === 'green' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title="شاشة خضراء (كروما)"
              >
                <div className="w-4 h-4 rounded-lg bg-emerald-500 border border-white/20" />
              </button>
            </div>
          </div>

          {/* Player Transport Controls Bar */}
          <div className="p-4 bg-slate-900/90 border-t border-white/10 space-y-3">
            {/* Scrubber Bar */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400 font-bold min-w-[50px]">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.01}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
              <span className="text-[11px] font-mono text-slate-400 font-bold min-w-[50px] text-left">
                {formatTime(duration)}
              </span>
            </div>

            {/* Buttons Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Playback action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => stepFrame('backward')}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all"
                  title="خطوة للخلف (إطار واحد)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-10 h-10 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-600/20 active:scale-95 transition-all"
                  title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                </button>

                <button
                  onClick={() => stepFrame('forward')}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all"
                  title="خطوة للأمام (إطار واحد)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSeek(0)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all"
                  title="إعادة من البداية"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-2 rounded-xl transition-all ${isLooping ? 'bg-pink-600/30 text-pink-400 border border-pink-500/40' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                  title={isLooping ? "التكرار مفعّل" : "التكرار معطّل"}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const nextMute = !isMuted;
                    setIsMuted(nextMute);
                    if (videoRef.current) videoRef.current.muted = nextMute;
                  }}
                  className={`p-2 rounded-xl transition-all ${!isMuted ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                  title={isMuted ? "الصوت مكتوم" : "الصوت مفعّل"}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Speed & Frame Counter */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono font-bold text-slate-400 bg-black/40 px-2.5 py-1 rounded-xl border border-white/5">
                  الإطار: {currentFrame} / {totalFrames}
                </span>

                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 text-[10px] font-black">
                  {[0.5, 1, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setPlaybackSpeed(spd);
                        if (videoRef.current) videoRef.current.playbackRate = spd;
                      }}
                      className={`px-2 py-0.5 rounded-lg transition-all ${playbackSpeed === spd ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: File Details, Format Overrides & Queue (1 Column on Large) */}
        <div className="p-4 bg-slate-900/60 flex flex-col gap-4 overflow-y-auto max-h-[580px]">
          {/* Format Switcher Widget (Manual channel placement override) */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              تفسير صيغة العرض والألفا:
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => setFormatOverride('yyeva')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'yyeva' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>YYEVA (ألفا يمين)</span>
                {currentFormat === 'yyeva' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFormatOverride('vap')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'vap' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>Tencent VAP (ألفا يسار)</span>
                {currentFormat === 'vap' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFormatOverride('mp4')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'mp4' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>MP4 عادي</span>
                {currentFormat === 'mp4' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFormatOverride('webm')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'webm' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>WebM شفاف</span>
                {currentFormat === 'webm' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFormatOverride('gif')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'gif' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>GIF متحرك</span>
                {currentFormat === 'gif' && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setFormatOverride('png_seq')}
                className={`px-3 py-2 rounded-xl text-xs font-black text-right transition-all flex items-center justify-between ${currentFormat === 'png_seq' ? 'bg-pink-600 text-white shadow-md' : 'bg-black/40 text-slate-300 hover:bg-black/60 border border-white/5'}`}
              >
                <span>سلسلة PNG (ZIP)</span>
                {currentFormat === 'png_seq' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* File Meta Information Card */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-2 text-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
              بيانات ومواصفات الملف:
            </span>
            <div className="flex items-center justify-between text-slate-400">
              <span>الأبعاد:</span>
              <span className="font-mono text-white font-bold">{videoDimensions.width} × {videoDimensions.height} px</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>معدل الإطارات:</span>
              <span className="font-mono text-white font-bold">{fps} FPS</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>عدد الإطارات:</span>
              <span className="font-mono text-white font-bold">{totalFrames} إطار</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>المدة الزمنية:</span>
              <span className="font-mono text-white font-bold">{duration.toFixed(2)} ثانية</span>
            </div>
            {activeItem?.size && (
              <div className="flex items-center justify-between text-slate-400">
                <span>حجم الملف:</span>
                <span className="font-mono text-white font-bold">{(activeItem.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
          </div>

          {/* Loaded Playlist / Queue */}
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                قائمة الملفات المعروضة ({playlist.length})
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-bold text-pink-400 hover:text-pink-300"
              >
                + إضافة
              </button>
            </div>

            {playlist.length > 0 && (
              <button
                type="button"
                onClick={() => openExportModal(playlist)}
                className="w-full py-2 px-3 bg-gradient-to-r from-pink-600/20 to-indigo-600/20 hover:from-pink-600/30 hover:to-indigo-600/30 text-pink-300 hover:text-white border border-pink-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                title="تصدير كافة الملفات المعروضة إلى فيديو MP4 عادي"
              >
                <Video className="w-3.5 h-3.5 text-pink-400" />
                <span>تصدير الكل ({playlist.length}) إلى MP4 🎬</span>
              </button>
            )}

            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {playlist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveItem(item);
                    setFormatOverride(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between group ${activeItem?.id === item.id ? 'bg-pink-600/20 border-pink-500/40 text-white' : 'bg-black/20 border-white/5 text-slate-400 hover:bg-black/40 hover:text-white'}`}
                >
                  <div className="truncate min-w-0 pr-2 flex-1">
                    <p className="font-bold truncate">{item.name}</p>
                    <span className="text-[9px] uppercase font-mono text-slate-500">{item.format}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openExportModal([item]);
                      }}
                      className="p-1 rounded-lg bg-white/5 hover:bg-pink-600 hover:text-white text-slate-400 transition-all opacity-80 group-hover:opacity-100"
                      title="تصدير هذا الملف فقط إلى MP4"
                    >
                      <Video className="w-3.5 h-3.5" />
                    </button>

                    {activeItem?.id === item.id && (
                      <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Export to Standard MP4 Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-arabic" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
                  <Video className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تصدير الحركات إلى فيديو MP4 عادي احترافي</h3>
                  <p className="text-xs text-slate-400 font-medium">تحويل فوري عالي الدقة مع دمج الخلفية، قنوات الشفافية (Alpha) والصوت الأصلي</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isExporting) stopExportProcess();
                  setShowExportModal(false);
                }}
                className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Export Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
              {/* Setting 1: Background Mode */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-slate-400">الخلفية المدمجة:</span>
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5 gap-1">
                  <button
                    type="button"
                    onClick={() => setExportBgType('black')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportBgType === 'black' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    سوداء
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportBgType('white')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportBgType === 'white' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    بيضاء
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportBgType('green')}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportBgType === 'green' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    كروما
                  </button>
                  {localBgUrl && (
                    <button
                      type="button"
                      onClick={() => setExportBgType('custom')}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportBgType === 'custom' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                    >
                      مخصصة 🖼️
                    </button>
                  )}
                </div>
              </div>

              {/* Setting 2: Quality & Resolution */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-slate-400">الدقة والجودة:</span>
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/5 gap-1">
                  <button
                    type="button"
                    onClick={() => { setExportResolution('original'); setExportQuality('high'); }}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportResolution === 'original' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    أصلية
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExportResolution('720p'); setExportQuality('medium'); }}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportResolution === '720p' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    720p
                  </button>
                  <button
                    type="button"
                    onClick={() => { setExportResolution('1080p'); setExportQuality('high'); }}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all ${exportResolution === '1080p' ? 'bg-pink-600 text-white shadow' : 'text-slate-400'}`}
                  >
                    1080p FHD
                  </button>
                </div>
              </div>

              {/* Setting 3: Watermark */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-black text-slate-400">العلامة المائية المتحركة:</span>
                <label className="flex items-center justify-between bg-slate-800/80 px-3 py-1.5 rounded-xl border border-white/5 cursor-pointer">
                  <span className="text-xs text-slate-300 font-bold">{exportWatermarkEnabled ? 'مفعلة 🛡️' : 'معطلة'}</span>
                  <input
                    type="checkbox"
                    checked={exportWatermarkEnabled}
                    onChange={(e) => setExportWatermarkEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-pink-600 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Jobs Queue List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
              {exportJobs.map((job, idx) => (
                <div
                  key={job.item.id || idx}
                  className="bg-black/30 border border-white/5 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      {job.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : job.status === 'processing' ? (
                        <RefreshCw className="w-4 h-4 text-pink-400 animate-spin" />
                      ) : job.status === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Film className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-white truncate">{job.item.name}</p>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-400">{job.item.format}</span>
                      </div>

                      {/* Status / Progress message */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${job.status === 'done' ? 'bg-emerald-500' : job.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-pink-500 to-indigo-500'}`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 min-w-[70px] text-left">
                          {job.statusText || `${job.progress}%`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Job Actions */}
                  {job.status === 'done' && job.result && (
                    <button
                      type="button"
                      onClick={() => downloadJobResult(job)}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 self-end sm:self-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل MP4</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
              <div className="text-xs font-bold text-slate-400">
                <span>المكتمل: </span>
                <span className="text-emerald-400 font-mono font-bold">{exportJobs.filter(j => j.status === 'done').length}</span>
                <span> / {exportJobs.length}</span>
              </div>

              <div className="flex items-center gap-2">
                {isExporting ? (
                  <button
                    type="button"
                    onClick={stopExportProcess}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>إيقاف المعالجة</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startExportProcess}
                    disabled={exportJobs.every(j => j.status === 'done')}
                    className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-pink-600/25 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>بدء التصدير إلى MP4 🚀</span>
                  </button>
                )}

                {exportJobs.some(j => j.status === 'done') && (
                  <button
                    type="button"
                    onClick={downloadAllJobsAsZip}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-1.5"
                  >
                    <FolderArchive className="w-4 h-4" />
                    <span>تحميل الكل (ZIP) 📦</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
