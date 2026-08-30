import { fastReplaceAudioInVap, extractAudioFromVap, getFFmpeg } from "../utils/vapFFmpeg";
import { extractAudioInBrowser, getAudioChunksForMuxer } from "../utils/clientAudio";
import { extractVapConfigFromBlob } from "../utils/vapEngine";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, X, Info, BoxSelect, FileVideo, RefreshCw, Box, Download, 
  Sliders, Palette, CheckCircle2, Play, Pause, Sparkles, 
  Gauge, ArrowDownCircle, AlertCircle, Loader2, Eye, ShieldCheck,
  Check, RefreshCcw, Music, Volume2, VolumeX, Trash2, Plus,
  FileAudio, Headphones, Film, HelpCircle, Video,
  Stamp, Move, Square, Maximize2, SlidersHorizontal, Activity, Compass,
  Image as ImageIcon, Camera, Lock, Unlock, Zap, Copy, Package
} from 'lucide-react';
import { UserRecord } from '../types';
// @ts-ignore
import Vap from 'video-animation-player';
import { Player as SvgaPlayer, Parser as SvgaParser } from 'svga.lite';
import UPNG from 'upng-js';
import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';
import { encodeSVGA } from '../utils/svgaEncoder';
import { AudioEditorModal } from './AudioEditorModal';

// Helper for calculating animated square watermark position
export const computeWatermarkPosition = (
  progress: number,
  canvasW: number,
  canvasH: number,
  sizePct: number,
  motionType: string,
  motionAmount: number,
  speed: number,
  positionAnchor: string
) => {
  const side = Math.max(16, Math.round(Math.min(canvasW, canvasH) * (sizePct / 100)));
  const margin = Math.max(8, Math.round(side * 0.15));
  const availW = Math.max(0, canvasW - side - margin * 2);
  const availH = Math.max(0, canvasH - side - margin * 2);
  const intensity = Math.max(0, Math.min(1, motionAmount / 100));

  let baseX = margin;
  let baseY = margin;

  if (positionAnchor === 'center') {
    baseX = (canvasW - side) / 2;
    baseY = (canvasH - side) / 2;
  } else if (positionAnchor === 'top-left') {
    baseX = margin;
    baseY = margin;
  } else if (positionAnchor === 'top-right') {
    baseX = canvasW - side - margin;
    baseY = margin;
  } else if (positionAnchor === 'bottom-left') {
    baseX = margin;
    baseY = canvasH - side - margin;
  } else if (positionAnchor === 'bottom-right') {
    baseX = canvasW - side - margin;
    baseY = canvasH - side - margin;
  }

  let x = baseX;
  let y = baseY;

  const t = progress * speed * Math.PI * 2;

  if (motionType === 'floating') {
    const dx = Math.sin(t) * (availW * 0.45 * intensity);
    const dy = Math.cos(t * 1.35) * (availH * 0.45 * intensity);
    x = baseX + dx;
    y = baseY + dy;
  } else if (motionType === 'bounce') {
    const fx = Math.abs(((progress * speed * 1.5) % 2) - 1);
    const fy = Math.abs(((progress * speed * 1.15 + 0.35) % 2) - 1);
    const targetX = margin + fx * availW;
    const targetY = margin + fy * availH;
    x = baseX + (targetX - baseX) * intensity;
    y = baseY + (targetY - baseY) * intensity;
  } else if (motionType === 'orbit') {
    const rx = (availW / 2) * intensity;
    const ry = (availH / 2) * intensity;
    const centerX = (canvasW - side) / 2;
    const centerY = (canvasH - side) / 2;
    x = centerX + Math.cos(t) * rx;
    y = centerY + Math.sin(t) * ry;
  } else if (motionType === 'diagonal') {
    const sweep = (Math.sin(t) + 1) / 2;
    const dx = (sweep - 0.5) * availW * intensity;
    const dy = (sweep - 0.5) * availH * intensity;
    x = baseX + dx;
    y = baseY + dy;
  } else if (motionType === 'wave') {
    const sweepX = (progress * speed) % 1;
    const dx = (sweepX - 0.5) * availW * intensity;
    const dy = Math.sin(sweepX * Math.PI * 4) * (availH * 0.35 * intensity);
    x = baseX + dx;
    y = baseY + dy;
  }

  // Ensure watermark stays safely within canvas boundaries
  x = Math.max(margin / 2, Math.min(canvasW - side - margin / 2, x));
  y = Math.max(margin / 2, Math.min(canvasH - side - margin / 2, y));

  return { x, y, side };
};

// Helper for rendering high-precision square watermark onto canvas context
export const drawSquareWatermarkToContext = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  side: number,
  opacity: number,
  borderRadius: number,
  hasBorder: boolean
) => {
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, opacity));

  // Rounded Square path
  const r = Math.min(borderRadius, side / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + side - r, y);
  ctx.quadraticCurveTo(x + side, y, x + side, y + r);
  ctx.lineTo(x + side, y + side - r);
  ctx.quadraticCurveTo(x + side, y + side, x + side - r, y + side);
  ctx.lineTo(x + r, y + side);
  ctx.quadraticCurveTo(x, y + side, x, y + side - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  // Subtle drop shadow for clarity over any background
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = Math.max(4, side * 0.08);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(2, side * 0.04);

  // Clip to square
  ctx.save();
  ctx.clip();

  // Crop & draw image covering the square area
  const nw = img.naturalWidth || img.width || side;
  const nh = img.naturalHeight || img.height || side;
  const minDim = Math.min(nw, nh);
  const sx = (nw - minDim) / 2;
  const sy = (nh - minDim) / 2;

  ctx.drawImage(img, sx, sy, minDim, minDim, x, y, side, side);
  ctx.restore();

  if (hasBorder) {
    ctx.lineWidth = Math.max(1.5, side * 0.025);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.stroke();
  }

  ctx.restore();
};

interface UniversalMotionToolsProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
}

interface VapConfig {
  info: {
    v?: number;
    f?: number;
    w?: number;
    h?: number;
    videoW?: number;
    videoH?: number;
    aFrame?: number[];
    rgbFrame?: number[];
    orientation?: string;
  };
}


class WebGLVapRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  texture: WebGLTexture;
  aPosition: number;
  aTexCoord: number;
  uImage: WebGLUniformLocation | null;
  uRgbRect: WebGLUniformLocation | null;
  uAlphaRect: WebGLUniformLocation | null;
  uThreshold: WebGLUniformLocation | null;
  uUnmultiply: WebGLUniformLocation | null;

  constructor(width: number, height: number, existingCanvas?: HTMLCanvasElement) {
    this.canvas = existingCanvas || document.createElement('canvas');
    this.canvas.width = Math.max(2, width);
    this.canvas.height = Math.max(2, height);
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) ||
               (this.canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) as WebGLRenderingContext);
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

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
      precision highp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec4 u_rgbRect;
      uniform vec4 u_alphaRect;
      uniform float u_threshold;
      uniform float u_unmultiply;

      void main() {
        vec2 rgbCoord = vec2(u_rgbRect.x + v_texCoord.x * u_rgbRect.z, u_rgbRect.y + v_texCoord.y * u_rgbRect.w);
        vec2 alphaCoord = vec2(u_alphaRect.x + v_texCoord.x * u_alphaRect.z, u_alphaRect.y + v_texCoord.y * u_alphaRect.w);

        vec4 rgbPixel = texture2D(u_image, rgbCoord);
        vec4 alphaPixel = texture2D(u_image, alphaCoord);

        float rawAlpha = 0.299 * alphaPixel.r + 0.587 * alphaPixel.g + 0.114 * alphaPixel.b;
        
        if (rawAlpha <= u_threshold) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            float aVal = min(1.0, (rawAlpha - u_threshold) / (1.0 - u_threshold));
            vec3 color = rgbPixel.rgb;
            if (u_unmultiply > 0.5 && aVal > 0.02) {
                color = clamp(color / aVal, 0.0, 1.0);
            }
            gl_FragColor = vec4(color, aVal);
        }
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs!);
    gl.attachShader(this.program, fs!);
    gl.linkProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord');
    this.uImage = gl.getUniformLocation(this.program, 'u_image');
    this.uRgbRect = gl.getUniformLocation(this.program, 'u_rgbRect');
    this.uAlphaRect = gl.getUniformLocation(this.program, 'u_alphaRect');
    this.uThreshold = gl.getUniformLocation(this.program, 'u_threshold');
    this.uUnmultiply = gl.getUniformLocation(this.program, 'u_unmultiply');

    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,   1.0, -1.0,   -1.0,  1.0,
      -1.0,  1.0,   1.0, -1.0,    1.0,  1.0
    ]), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       0.0,  1.0,   1.0,  1.0,    0.0,  0.0,
       0.0,  0.0,   1.0,  1.0,    1.0,  0.0
    ]), gl.STATIC_DRAW);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  render(video: HTMLVideoElement, rgbRect: number[], alphaRect: number[], threshold: number, unmultiply: boolean) {
    const gl = this.gl;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(this.uImage, 0);

    gl.uniform4f(this.uRgbRect, rgbRect[0]/vw, rgbRect[1]/vh, rgbRect[2]/vw, rgbRect[3]/vh);
    gl.uniform4f(this.uAlphaRect, alphaRect[0]/vw, alphaRect[1]/vh, alphaRect[2]/vw, alphaRect[3]/vh);
    gl.uniform1f(this.uThreshold, threshold / 255.0);
    gl.uniform1f(this.uUnmultiply, unmultiply ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }
}

export const UniversalMotionTools: React.FC<UniversalMotionToolsProps> = ({
  currentUser,
  onCancel,
}) => {
  // Preload FFmpeg to make ultra-fast operations instant
  useEffect(() => {
    getFFmpeg().catch((e) => console.log("FFmpeg preload failed (will retry later):", e));
  }, []);
  // Source File State
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [vapConfig, setVapConfig] = useState<VapConfig | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 750, height: 1334 });
  const [customWidth, setCustomWidth] = useState<number>(750);
  const [customHeight, setCustomHeight] = useState<number>(1334);
  const [lockAspectRatio, setLockAspectRatio] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<number>(750 / 1334);
  const [isDragging, setIsDragging] = useState(false);

  // Helper functions for changing dimensions independently
  const handleWidthChange = (val: string | number) => {
    if (typeof val === 'string') {
      const parsed = val.replace(/[^0-9]/g, '');
      setCustomWidth(parsed === '' ? 0 : parseInt(parsed, 10));
    } else {
      setCustomWidth(Math.max(0, Math.min(4096, Math.round(val))));
    }
  };

  const handleHeightChange = (val: string | number) => {
    if (typeof val === 'string') {
      const parsed = val.replace(/[^0-9]/g, '');
      setCustomHeight(parsed === '' ? 0 : parseInt(parsed, 10));
    } else {
      setCustomHeight(Math.max(0, Math.min(4096, Math.round(val))));
    }
  };

  const handleBlurWidth = () => {
    if (!customWidth || customWidth < 16) {
      setCustomWidth(videoDimensions.width || 750);
    }
  };

  const handleBlurHeight = () => {
    if (!customHeight || customHeight < 16) {
      setCustomHeight(videoDimensions.height || 1334);
    }
  };

  const handlePresetScale = (scale: number) => {
    const origW = videoDimensions.width || 750;
    const origH = videoDimensions.height || 1334;
    const targetW = Math.max(32, Math.round(origW * scale));
    const targetH = Math.max(32, Math.round(origH * scale));
    setCustomWidth(targetW);
    setCustomHeight(targetH);
  };

  const handleResetDimensions = () => {
    const origW = videoDimensions.width || 750;
    const origH = videoDimensions.height || 1334;
    setCustomWidth(origW);
    setCustomHeight(origH);
  };

  // Audio Studio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioSize, setAudioSize] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(1.0);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioProcessProgress, setAudioProcessProgress] = useState(0);
  const [isAudioEditorModalOpen, setIsAudioEditorModalOpen] = useState(false);
  const [preProcessedVapBlob, setPreProcessedVapBlob] = useState<Blob | null>(null);
  // Export Target Format: 'svga' or 'vap'
  const [exportTargetFormat, setExportTargetFormat] = useState<'svga' | 'vap' | 'mp4'>('svga');

  // Player & Container Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgaContainerRef = useRef<HTMLDivElement>(null);
  const workspaceCanvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceVideoRef = useRef<HTMLVideoElement | null>(null);
  const webglVapRendererRef = useRef<WebGLVapRenderer | null>(null);
  const vapInstanceRef = useRef<any>(null);
  const svgaPlayerRef = useRef<SvgaPlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View Mode: 'vap' = Original VAP MP4, 'svga' = Exported SVGA Player
  const [activeViewMode, setActiveViewMode] = useState<'vap' | 'svga'>('vap');
  const [muteOriginalAudio, setMuteOriginalAudio] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isPlaybackMuted, setIsPlaybackMuted] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [copiedTooltipId, setCopiedTooltipId] = useState<string | null>(null);

  const copyTooltipInstructions = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedTooltipId(id);
      setTimeout(() => {
        setCopiedTooltipId(null);
      }, 2500);
    } catch (err) {
      console.warn("Failed to copy tooltip text:", err);
    }
  };
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);











  // Background Customization
  const [bgMode, setBgMode] = useState<'checker' | 'color' | 'image'>('checker');
  const [bgColor, setBgColor] = useState<string>('#0B0C10');
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const customColorInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingAudio, setIsExtractingAudio] = useState<boolean>(false);

  const presetColors = [
    { name: 'شبكة الشفافية', value: 'checker', color: 'transparent', isChecker: true },
    { name: 'داكن عميق', value: '#0B0C10', color: '#0B0C10' },
    { name: 'أسود خالص', value: '#000000', color: '#000000' },
    { name: 'أبيض ناصع', value: '#FFFFFF', color: '#FFFFFF' },
    { name: 'أخضر كروما', value: '#00FF00', color: '#00FF00' },
    { name: 'أزرق استوديو', value: '#0066FF', color: '#0066FF' },
    { name: 'بنفسجي نيون', value: '#8B5CF6', color: '#8B5CF6' },
    { name: 'ذهبي دافئ', value: '#F59E0B', color: '#F59E0B' },
    { name: 'أحمر قرمزي', value: '#EF4444', color: '#EF4444' },
  ];

  // Professional Quality & De-Blacking Settings
  const [unmultiplyAlpha, setUnmultiplyAlpha] = useState<boolean>(true);
  const [alphaThreshold, setAlphaThreshold] = useState<number>(8);
  const [compressionLevel, setCompressionLevel] = useState<number>(0);
  const [vapCompressionEnabled, setVapCompressionEnabled] = useState<boolean>(false); // New state for VAP compression
  const [exportStats, setExportStats] = useState<{original: number, compressed: number, savedPct: string} | null>(null);
  const [svgaFormat, setSvgaFormat] = useState<'webp' | 'png' | 'jpeg'>('webp');
  const [resolutionScale, setResolutionScale] = useState<number>(1.0);
  const [targetFps, setTargetFps] = useState<number>(24);

  // Watermark Studio State (العلامة المائية المتحركة المربعة)
  const [enableWatermark, setEnableWatermark] = useState<boolean>(false);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkName, setWatermarkName] = useState<string>('');
  const [watermarkSize, setWatermarkSize] = useState<number>(18); // 8% to 45%
  const [watermarkMotionType, setWatermarkMotionType] = useState<'floating' | 'bounce' | 'orbit' | 'diagonal' | 'wave' | 'static'>('floating');
  const [watermarkMotionAmount, setWatermarkMotionAmount] = useState<number>(50); // 0% to 100%
  const [watermarkSpeed, setWatermarkSpeed] = useState<number>(1.0); // 0.3x to 3.0x
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(90); // 10% to 100%
  const [watermarkBorderRadius, setWatermarkBorderRadius] = useState<number>(12); // 0px to 32px
  const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [watermarkBorder, setWatermarkBorder] = useState<boolean>(true);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWmCoords, setPreviewWmCoords] = useState<{ x: number; y: number; side: number }>({ x: 20, y: 20, side: 64 });

  // Live preview watermark animation loop
  useEffect(() => {
    if (!enableWatermark || !watermarkUrl) return;

    let animId: number;
    const startTime = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const dur = Math.max(1, videoDuration || 3);
      const progress = (elapsed % dur) / dur;

      const containerEl = previewContainerRef.current;
      if (containerEl) {
        const rect = containerEl.getBoundingClientRect();
        const w = rect.width || 480;
        const h = rect.height || 640;
        const coords = computeWatermarkPosition(
          progress,
          w,
          h,
          watermarkSize,
          watermarkMotionType,
          watermarkMotionAmount,
          watermarkSpeed,
          watermarkPosition
        );
        setPreviewWmCoords(coords);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    enableWatermark,
    watermarkUrl,
    watermarkSize,
    watermarkMotionType,
    watermarkMotionAmount,
    watermarkSpeed,
    watermarkPosition,
    videoDuration
  ]);

  // Create sample stylish square watermark
  const handleUseSampleWatermark = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const c = canvas.getContext('2d');
    if (!c) return;

    const grad = c.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#6366F1');
    grad.addColorStop(0.5, '#A855F7');
    grad.addColorStop(1, '#EC4899');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 256);

    c.fillStyle = 'rgba(255, 255, 255, 0.18)';
    c.beginPath();
    c.arc(128, 128, 92, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#FFFFFF';
    c.font = 'bold 36px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SVGA', 128, 108);

    c.font = 'bold 20px sans-serif';
    c.fillStyle = 'rgba(255, 255, 255, 0.92)';
    c.fillText('STUDIO', 128, 154);

    c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    c.lineWidth = 10;
    c.strokeRect(12, 12, 232, 232);

    const dataUrl = canvas.toDataURL('image/png');
    setWatermarkUrl(dataUrl);
    setWatermarkFile(null);
    setWatermarkName('Sample_Watermark_Badge.png');
    setEnableWatermark(true);
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('يرجى اختيار ملف صورة صالح (PNG / JPG / SVG / WebP)');
      return;
    }

    if (watermarkUrl && watermarkUrl.startsWith('blob:')) {
      URL.revokeObjectURL(watermarkUrl);
    }

    const url = URL.createObjectURL(file);
    setWatermarkFile(file);
    setWatermarkUrl(url);
    setWatermarkName(file.name);
    setEnableWatermark(true);
  };

  const handleRemoveWatermark = () => {
    if (watermarkUrl && watermarkUrl.startsWith('blob:')) {
      URL.revokeObjectURL(watermarkUrl);
    }
    setWatermarkUrl(null);
    setWatermarkFile(null);
    setWatermarkName('');
    setEnableWatermark(false);
  };

  // Export Progress State
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Background Throttling Prevention
  const [silentAudio] = useState(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.loop = true;
    return audio;
  });

  useEffect(() => {
    if (isExporting) {
      silentAudio.play().catch(() => {});
    } else {
      silentAudio.pause();
    }
  }, [isExporting, silentAudio]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFileSize, setExportedFileSize] = useState<string>('');
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const cancelExportRef = useRef<boolean>(false);



  useEffect(() => {
    // Attempt to mute the VAP video element
    const attemptMute = () => {
      let videoEl = containerRef.current?.querySelector('video');
      // If VAP keeps the video on the instance
      if (!videoEl && vapInstanceRef.current && vapInstanceRef.current.video) {
        videoEl = vapInstanceRef.current.video;
      }
      if (videoEl) {
        videoEl.muted = isPlaybackMuted || muteOriginalAudio;
      }
    };
    
    attemptMute();
    // Try again after a short delay in case VAP hasn't mounted it yet
    setTimeout(attemptMute, 500);
    setTimeout(attemptMute, 1500);
    
  }, [muteOriginalAudio, fileUrl, isPlaybackMuted]);


  // Preview Modal State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Preview Frame
    // Animated Live Preview
  useEffect(() => {
    if (!showLivePreview || !previewCanvasRef.current || !fileUrl) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isPlaying = true;
    let webglRenderer: WebGLVapRenderer | null = null;
    
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.src = fileUrl;

    const rgbCanvas = document.createElement('canvas');
    const rgbCtx = rgbCanvas.getContext('2d', { willReadFrequently: true });
    const alphaCanvas = document.createElement('canvas');
    const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
    
    video.onloadeddata = () => {
        video.play().catch(()=>{});
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        
        let cfgW = vapConfig?.info?.w || Math.round(vw / 2);
        let cfgH = vapConfig?.info?.h || vh;
        let rawVideoW = vapConfig?.info?.videoW || vw;
        let rawVideoH = vapConfig?.info?.videoH || vh;
        let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
        let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
        
        if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
          rgbRect = [0, 0, vw, Math.round(vh / 2)];
          alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
          cfgW = vw;
          cfgH = Math.round(vh / 2);
        }
        
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

        canvas.width = cfgW;
        canvas.height = cfgH;
        rgbCanvas.width = cfgW;
        rgbCanvas.height = cfgH;
        alphaCanvas.width = cfgW;
        alphaCanvas.height = cfgH;

        try { webglRenderer = new WebGLVapRenderer(cfgW, cfgH); } catch(e) {}
        
        const isStandardMP4 = exportTargetFormat === 'mp4';
        
        // Background Image caching
        let bgImgEl: HTMLImageElement | null = null;
        if (isStandardMP4 && bgMode === 'image' && bgImageUrl) {
             bgImgEl = new Image();
             bgImgEl.src = bgImageUrl;
        }

        let wmImgEl: HTMLImageElement | null = null;
        if (enableWatermark && watermarkUrl) {
            wmImgEl = new Image();
            wmImgEl.src = watermarkUrl;
        }

        const renderLoop = () => {
           if (!isPlaying) return;
           
           ctx.clearRect(0, 0, cfgW, cfgH);

           if (exportTargetFormat === 'svga' || isStandardMP4) {
                if (isStandardMP4) {
                     if (bgMode === 'image' && bgImgEl && bgImgEl.complete) {
                          ctx.drawImage(bgImgEl, 0, 0, cfgW, cfgH);
                     } else if (bgMode === 'color') {
                          ctx.fillStyle = bgColor;
                          ctx.fillRect(0, 0, cfgW, cfgH);
                     }
                }
                
                if (webglRenderer) {
                     const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
                     ctx.drawImage(glCanvas, 0, 0, cfgW, cfgH);
                } else if (rgbCtx && alphaCtx) {
                     // Fallback CPU
                     rgbCtx.clearRect(0, 0, cfgW, cfgH);
                     rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, cfgW, cfgH);
                     alphaCtx.clearRect(0, 0, cfgW, cfgH);
                     alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, cfgW, cfgH);
                     const rgbData = rgbCtx.getImageData(0, 0, cfgW, cfgH);
                     const alphaData = alphaCtx.getImageData(0, 0, cfgW, cfgH);
                     const compData = rgbCtx.createImageData(cfgW, cfgH);
                     const dest = compData.data;
                     const rgbPixels = rgbData.data;
                     const alphaPixels = alphaData.data;
                     for (let p = 0; p < cfgW * cfgH; p++) {
                          const idx = p * 4;
                          const rawAlpha = Math.round(0.299 * alphaPixels[idx] + 0.587 * alphaPixels[idx+1] + 0.114 * alphaPixels[idx+2]);
                          if (rawAlpha <= alphaThreshold) {
                              dest[idx+3] = 0;
                          } else {
                              let aVal = Math.min(255, Math.round(((rawAlpha - alphaThreshold) / (255 - alphaThreshold)) * 255));
                              const aRatio = aVal / 255;
                              let r = rgbPixels[idx], g = rgbPixels[idx+1], b = rgbPixels[idx+2];
                              if (unmultiplyAlpha && aRatio > 0.02) {
                                  r = Math.min(255, Math.max(0, Math.round(r / aRatio)));
                                  g = Math.min(255, Math.max(0, Math.round(g / aRatio)));
                                  b = Math.min(255, Math.max(0, Math.round(b / aRatio)));
                              }
                              dest[idx] = r; dest[idx+1] = g; dest[idx+2] = b; dest[idx+3] = aVal;
                          }
                     }
                     rgbCtx.putImageData(compData, 0, 0);
                     ctx.drawImage(rgbCanvas, 0, 0, cfgW, cfgH);
                }
           } else {
                canvas.width = vw;
                canvas.height = vh;
                ctx.drawImage(video, 0, 0, vw, vh);
           }
           
           if (enableWatermark && wmImgEl && wmImgEl.complete) {
                const dur = Math.max(1, video.duration || 3);
                const progress = (video.currentTime % dur) / dur;
                const { x, y, side } = computeWatermarkPosition(progress, cfgW, cfgH, watermarkSize, watermarkMotionType, watermarkMotionAmount, watermarkSpeed, watermarkPosition);
                drawSquareWatermarkToContext(ctx, wmImgEl, x, y, side, watermarkOpacity / 100, watermarkBorderRadius, watermarkBorder);
           }
           
           animId = requestAnimationFrame(renderLoop);
        };
        
        renderLoop();
    };

    return () => {
        isPlaying = false;
        video.pause();
        video.src = '';
        if (animId) cancelAnimationFrame(animId);
    };
  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);

  // Estimate File Size
  const estimateFileSize = () => {
    if (!sourceFile || videoDuration === 0) return 'غير محدد';
    let originalBitrate = (sourceFile.size * 8) / videoDuration;
    let bitrate;
    const cLevel = compressionLevel / 100;
    bitrate = originalBitrate * (1.5 - (cLevel * 1.4));
    bitrate = Math.max(1000000, bitrate);
    
    let estimatedSizeInBytes = (bitrate * videoDuration) / 8;
    const shouldIncludeAudio = ((audioFile || audioUrl) && !isAudioMuted) || !muteOriginalAudio;
    if (shouldIncludeAudio) {
      estimatedSizeInBytes += (128000 * videoDuration) / 8;
    }
    
    if (exportTargetFormat === 'svga') {
      estimatedSizeInBytes *= 0.85;
    } else if (exportTargetFormat === 'mp4') {
      estimatedSizeInBytes *= 1.1;
    }
    
    if (estimatedSizeInBytes < 1024 * 1024) {
      return (estimatedSizeInBytes / 1024).toFixed(1) + ' KB';
    }
    return (estimatedSizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Extract VAP configuration from MP4 vapc / yyea box
  const extractVapConfig = async (file: File): Promise<VapConfig | null> => {
    try {
      const extracted = await extractVapConfigFromBlob(file);
      if (extracted) return extracted as VapConfig;
    } catch (e) {
      console.error("Error extracting VAP config:", e);
    }
    return null;
  };

  // Process File and init VAP Player
  const processFile = async (f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.mp4') && !name.endsWith('.vap')) {
      setErrorMessage("يرجى رفع ملف فيديو بصيغة MP4 أو VAP.");
      return;
    }
    
    setSourceFile(f);
    setFileName(f.name);
    setFileSize((f.size / (1024 * 1024)).toFixed(2) + ' MB');
    setExportSuccess(false);
    setExportedBlob(null);
    setExportStats(null);
    setActiveViewMode('vap');

    const url = URL.createObjectURL(f);
    setFileUrl(url);

    // Get duration & dimensions from video element
    const tempVideo = document.createElement('video');
    tempVideo.src = url;
    
    await new Promise<void>((resolve) => {
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration || 3);
        resolve();
      };
      tempVideo.onerror = () => resolve();
    });

    if (vapInstanceRef.current) {
      try { vapInstanceRef.current.destroy(); } catch (e) {}
      vapInstanceRef.current = null;
    }

    const vw = tempVideo.videoWidth || 1500;
    const vh = tempVideo.videoHeight || 1334;

    const rawExtracted = await extractVapConfig(f);
    
    // User requested forced exact dimensions 750 * 1334 for the workspace display & animation
    const targetW = 750;
    const targetH = 1334;

    let fps = rawExtracted?.info?.f || 24;
    if (fps > 60) {
      const calculatedFps = Math.round(fps / (tempVideo.duration || 1));
      fps = (calculatedFps >= 10 && calculatedFps <= 60) ? calculatedFps : 24;
    }

    let rgbFrame = rawExtracted?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
    let aFrame = rawExtracted?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

    if (!rawExtracted?.info?.rgbFrame) {
      if (vh > vw && vw > 0) {
        rgbFrame = [0, 0, vw, Math.round(vh / 2)];
        aFrame = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
      } else {
        rgbFrame = [0, 0, Math.round(vw / 2), vh];
        aFrame = [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
      }
    }

    const completeConfig: VapConfig = {
      info: {
        v: 2,
        f: fps,
        w: targetW,
        h: targetH,
        videoW: vw,
        videoH: vh,
        aFrame: aFrame,
        rgbFrame: rgbFrame
      },
      ...(rawExtracted || {})
    };

    setVapConfig(completeConfig);

    setVideoDimensions({ width: targetW, height: targetH });
    setCustomWidth(targetW);
    setCustomHeight(targetH);
    setAspectRatio(targetW / targetH);
    setTargetFps(fps);
    setIsPlaying(true);

    // Auto-detect & extract existing audio track from the VAP video
    extractAudioFromVap(f).then((audioBlob) => {
      if (audioBlob && audioBlob.size > 200) {
        const aUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(aUrl);
        setAudioName('audio');
        setAudioSize((audioBlob.size / 1024).toFixed(0) + ' KB');
        const tempA = new Audio(aUrl);
        tempA.onloadedmetadata = () => {
          setAudioDuration(tempA.duration || tempVideo.duration || 0);
        };
      }
    }).catch(() => {
      // No existing audio track found in VAP
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  // Audio Upload & Management Handlers
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // Reset input to allow re-selection
    if (!file) return;

    setAudioFile(file);
    setAudioName(file.name);
    setAudioSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    setIsAudioMuted(false);
    setMuteOriginalAudio(true);
    setPreProcessedVapBlob(null);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setAudioDuration(tempAudio.duration || 0);
    };

    if (audioElementRef.current) {
      audioElementRef.current.src = url;
      audioElementRef.current.volume = audioVolume;
      audioElementRef.current.play().catch(() => {});
      setIsAudioPlaying(true);
    }

    // Auto-process for VAP immediately (The "Video-like" feature)
    if (sourceFile) {
       setIsProcessingAudio(true);
       setAudioProcessProgress(0);
       try {
           const finalVapBlob = await fastReplaceAudioInVap(
              sourceFile,
              file,
              {
                duration: videoDuration > 0 ? videoDuration : undefined,
                vapConfig: vapConfig,
                vapCompression: vapCompressionEnabled,
                onProgress: (p) => setAudioProcessProgress(p)
              }
            );
            if (finalVapBlob && finalVapBlob.size > 10000) {
              setPreProcessedVapBlob(finalVapBlob);
              setExportedBlob(finalVapBlob);
              setExportedFileSize((finalVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
              setExportTargetFormat('vap');
              setExportSuccess(true);
              setExportProgress(100);
              setExportStatusText('تم دمج وتجهيز ملف VAP بالصوت الجديد بنجاح!');

              // Auto show success toast briefly
              const toast = document.createElement('div');
              toast.className = 'fixed top-10 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white px-5 py-2.5 rounded-2xl shadow-xl shadow-emerald-500/25 z-[9999] text-xs font-black flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300';
              toast.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>تم دمج الصوت في VAP بنجاح وجاهز للتنزيل المباشر!</span>';
              document.body.appendChild(toast);
              setTimeout(() => {
                  toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
                  setTimeout(() => toast.remove(), 300);
              }, 2500);
            }
       } catch (error) {
           console.error("Audio pre-processing failed:", error);
       } finally {
           setIsProcessingAudio(false);
       }
    }
  };

  
  // Continuous Hardware-Accelerated WebGL VAP Workspace Renderer Loop
  useEffect(() => {
    if (activeViewMode !== 'vap' || !fileUrl || !workspaceCanvasRef.current) return;
    const canvas = workspaceCanvasRef.current;
    
    let isRunning = true;
    let animId: number;

    const targetW = 750;
    const targetH = 1334;
    canvas.width = targetW;
    canvas.height = targetH;

    let renderer = webglVapRendererRef.current;
    if (!renderer || renderer.canvas !== canvas) {
      try {
        renderer = new WebGLVapRenderer(targetW, targetH, canvas);
        webglVapRendererRef.current = renderer;
      } catch (e) {
        console.warn("WebGL renderer creation failed:", e);
      }
    }

    const video = workspaceVideoRef.current;
    if (video) {
      if (isPlaying) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }

    const renderLoop = () => {
      if (!isRunning) return;

      const vid = workspaceVideoRef.current;
      if (vid) {
        if (isPlaying && vid.paused && vid.readyState >= 2) {
          vid.play().catch(() => {});
        }

        if (vid.readyState >= 2 && vid.videoWidth > 0 && renderer) {
          const vw = vid.videoWidth;
          const vh = vid.videoHeight;

          let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
          let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

          if (!vapConfig?.info?.rgbFrame) {
            if (vh > vw && vw > 0) {
              rgbRect = [0, 0, vw, Math.round(vh / 2)];
              alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
            } else {
              rgbRect = [0, 0, Math.round(vw / 2), vh];
              alphaRect = [Math.round(vw / 2), 0, Math.round(vw / 2), vh];
            }
          }

          const rawVideoW = vapConfig?.info?.videoW || vw;
          const rawVideoH = vapConfig?.info?.videoH || vh;
          const scaleX = vw / (rawVideoW || vw);
          const scaleY = vh / (rawVideoH || vh);

          const srcRgb = [
            Math.round(rgbRect[0] * scaleX),
            Math.round(rgbRect[1] * scaleY),
            Math.round(rgbRect[2] * scaleX),
            Math.round(rgbRect[3] * scaleY)
          ];
          const srcAlpha = [
            Math.round(alphaRect[0] * scaleX),
            Math.round(alphaRect[1] * scaleY),
            Math.round(alphaRect[2] * scaleX),
            Math.round(alphaRect[3] * scaleY)
          ];

          renderer.render(vid, srcRgb, srcAlpha, alphaThreshold, unmultiplyAlpha);
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, [fileUrl, activeViewMode, isPlaying, alphaThreshold, unmultiplyAlpha, vapConfig]);

  const handleTogglePlay = () => {
    setIsPlaying(prev => {
      const next = !prev;
      if (workspaceVideoRef.current) {
        if (next) workspaceVideoRef.current.play().catch(() => {});
        else workspaceVideoRef.current.pause();
      }
      if (activeViewMode === 'vap' && vapInstanceRef.current) {
        if (next) {
          try { vapInstanceRef.current.play(); } catch(e){}
        } else {
          try { vapInstanceRef.current.pause(); } catch(e){}
        }
      }
      if (activeViewMode === 'svga' && svgaPlayerRef.current) {
        if (next) {
          svgaPlayerRef.current.start();
        } else {
          svgaPlayerRef.current.pause();
        }
      }
      return next;
    });
  };

  // Sync custom audio with isPlaying
  useEffect(() => {
    if (audioElementRef.current && audioUrl && !isAudioMuted) {
       if (isPlaying) {
         audioElementRef.current.play().then(() => setIsAudioPlaying(true)).catch(() => {});
       } else {
         audioElementRef.current.pause();
         setIsAudioPlaying(false);
       }
    }
  }, [isPlaying, audioUrl, isAudioMuted]);

  // Keep original VAP video muted if muteOriginalAudio is true OR if custom audio is active OR if playback is muted
  useEffect(() => {
    const vid = containerRef.current?.querySelector('video') || (vapInstanceRef.current as any)?.video;
    if (vid) {
      const shouldMuteVideo = isPlaybackMuted || muteOriginalAudio || !!(audioUrl && !isAudioMuted);
      vid.muted = shouldMuteVideo;
    }
  }, [isPlaybackMuted, muteOriginalAudio, audioUrl, isAudioMuted, activeViewMode, isPlaying]);

  // Handler to download transparent gift snapshot (PNG)
  const handleDownloadGiftImage = async () => {
    try {
      setIsCapturingSnapshot(true);
      let exportCanvas: HTMLCanvasElement | null = null;

      if (activeViewMode === 'vap') {
        const videoEl = containerRef.current?.querySelector('video') || (vapInstanceRef.current && vapInstanceRef.current.video);
        if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          const vw = videoEl.videoWidth;
          const vh = videoEl.videoHeight;
          let cfgW = vapConfig?.info?.w || videoDimensions.width || Math.round(vw / 2);
          let cfgH = vapConfig?.info?.h || videoDimensions.height || vh;
          let rawVideoW = vapConfig?.info?.videoW || vw;
          let rawVideoH = vapConfig?.info?.videoH || vh;
          let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
          let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

          if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
            rgbRect = [0, 0, vw, Math.round(vh / 2)];
            alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
            cfgW = vw;
            cfgH = Math.round(vh / 2);
          }

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

          const targetW = customWidth || cfgW;
          const targetH = customHeight || cfgH;

          try {
            const renderer = new WebGLVapRenderer(cfgW, cfgH);
            renderer.render(
              videoEl,
              [srcRgbX, srcRgbY, srcRgbW, srcRgbH],
              [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH],
              alphaThreshold,
              unmultiplyAlpha
            );
            
            if (renderer.canvas.width !== targetW || renderer.canvas.height !== targetH) {
              const resCanvas = document.createElement('canvas');
              resCanvas.width = targetW;
              resCanvas.height = targetH;
              const resCtx = resCanvas.getContext('2d');
              if (resCtx) {
                resCtx.drawImage(renderer.canvas, 0, 0, targetW, targetH);
                exportCanvas = resCanvas;
              } else {
                exportCanvas = renderer.canvas;
              }
            } else {
              exportCanvas = renderer.canvas;
            }
          } catch (renderErr) {
            console.warn("WebGL renderer failed for snapshot, falling back to 2D canvas:", renderErr);
          }
        }
        
        if (!exportCanvas) {
          // Fallback to workspace canvas
          if (workspaceCanvasRef.current) {
            exportCanvas = workspaceCanvasRef.current;
          } else {
            const existingCanvas = containerRef.current?.querySelector('canvas');
            if (existingCanvas) exportCanvas = existingCanvas;
          }
        }
      } else if (activeViewMode === 'svga') {
        const svgaCanvas = svgaContainerRef.current?.querySelector('canvas');
        if (svgaCanvas) exportCanvas = svgaCanvas;
      }

      if (!exportCanvas) {
        exportCanvas = document.querySelector('#anim-container canvas') as HTMLCanvasElement;
      }

      if (exportCanvas) {
        const cleanName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "gift_image";
        
        // Try toBlob first, with toDataURL fallback
        try {
          exportCanvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${cleanName}_gift.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 5000);

              setSnapshotSuccess(true);
              setTimeout(() => setSnapshotSuccess(false), 2500);
            } else {
              // Fallback to DataURL
              const dataUrl = exportCanvas!.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = `${cleanName}_gift.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              setSnapshotSuccess(true);
              setTimeout(() => setSnapshotSuccess(false), 2500);
            }
            setIsCapturingSnapshot(false);
          }, 'image/png');
        } catch (e) {
          const dataUrl = exportCanvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `${cleanName}_gift.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setSnapshotSuccess(true);
          setTimeout(() => setSnapshotSuccess(false), 2500);
          setIsCapturingSnapshot(false);
        }
      } else {
        setErrorMessage("تعذر التقاط صورة الهدية حالياً. تأكد من تشغيل العرض.");
        setIsCapturingSnapshot(false);
      }
    } catch (err) {
      console.error("Error downloading gift snapshot image:", err);
      setErrorMessage("حدث خطأ أثناء تنزيل صورة الهدية.");
      setIsCapturingSnapshot(false);
    }
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgImageUrl(URL.createObjectURL(file));
      setBgMode('image');
    }
  };

  const handleDownloadOriginalAudio = async () => {
    if (!sourceFile) return;
    setIsExtractingAudio(true);
    try {
      // 100% Client-Side In-Browser Audio Extraction
      const result = await extractAudioInBrowser(sourceFile);
      const url = URL.createObjectURL(result.wavBlob);
      const link = document.createElement('a');
      link.href = url;
      const baseName = fileName.replace(/\.[^/.]+$/, '') || 'original_audio';
      link.download = `${baseName}_audio.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIsExtractingAudio(false);
    } catch (e: any) {
      console.warn("Client audio extract failed, attempting FFmpeg fallback:", e);
      try {
        const audioBlob = await extractAudioFromVap(sourceFile);
        const url = URL.createObjectURL(audioBlob);
        const link = document.createElement('a');
        link.href = url;
        const baseName = fileName.replace(/\.[^/.]+$/, '') || 'original_audio';
        link.download = `${baseName}_audio.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setIsExtractingAudio(false);
      } catch (err) {
        console.error(err);
        setErrorMessage('تعذر استخراج الصوت من هذا الملف.');
        setIsExtractingAudio(false);
      }
    }
  };

  const handleTogglePlaybackMute = () => {
    setIsPlaybackMuted(prev => !prev);
  };

  const handleRemoveAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
    }
    setAudioFile(null);
    setAudioUrl(null);
    setAudioName('');
    setAudioDuration(0);
    setAudioSize('');
    setIsAudioPlaying(false);
    setPreProcessedVapBlob(null);
  };

  const handleToggleMute = () => {
    const nextMute = !isAudioMuted;
    setIsAudioMuted(nextMute);
    if (audioElementRef.current) {
      audioElementRef.current.muted = nextMute;
    }
  };

  const handleTogglePlayAudio = () => {
    if (!audioElementRef.current || !audioUrl) return;

    if (isAudioPlaying) {
      audioElementRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioElementRef.current.play().catch(() => {});
      setIsAudioPlaying(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setAudioVolume(newVol);
    if (audioElementRef.current) {
      audioElementRef.current.volume = newVol;
    }
  };

  const handleDownloadAudioFile = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = audioName || 'audio_track.mp3';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteAudioModal = async (
    newVolume: number,
    newFile: File | null,
    start?: number,
    end?: number
  ) => {
    if (!sourceFile) {
      alert("يرجى رفع ملف VAP أولاً لتطبيق الصوت عليه.");
      return;
    }

    setIsProcessingAudio(true);
    setAudioProcessProgress(0);

    try {
      setAudioVolume(newVolume);

      let targetAudioFile: File | Blob | null = newFile || audioFile;
      if (newFile) {
        setAudioFile(newFile);
        setAudioName(newFile.name);
        setAudioSize((newFile.size / 1024).toFixed(0) + ' KB');
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        const freshUrl = URL.createObjectURL(newFile);
        setAudioUrl(freshUrl);
        const tempA = new Audio(freshUrl);
        tempA.onloadedmetadata = () => {
          setAudioDuration(tempA.duration || videoDuration || 0);
        };
      }

      const isMuted = newVolume === 0;
      setIsAudioMuted(isMuted);

      const finalVapBlob = await fastReplaceAudioInVap(
        sourceFile,
        isMuted ? null : targetAudioFile,
        {
          duration: videoDuration > 0 ? videoDuration : undefined,
          vapConfig: vapConfig,
          volume: newVolume,
          startTime: start,
          endTime: end,
          mute: isMuted,
          vapCompression: vapCompressionEnabled,
          onProgress: (p) => setAudioProcessProgress(p),
          onStatus: (s) => setExportStatusText(s)
        }
      );

      if (finalVapBlob && finalVapBlob.size > 10000) {
        setPreProcessedVapBlob(finalVapBlob);
        setExportedBlob(finalVapBlob);
        setExportedFileSize((finalVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
        setExportTargetFormat('vap');
        setExportSuccess(true);
        setExportProgress(100);
      }
      setIsAudioEditorModalOpen(false);

      // Trigger synchronized playback
      if (audioElementRef.current && audioUrl && !isMuted) {
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.volume = Math.min(newVolume, 1);
        audioElementRef.current.play().catch(() => {});
        setIsAudioPlaying(true);
      }

      // Success notification toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-emerald-500/30 z-[9999] text-xs font-black flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300 font-cairo';
      toast.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>تم تحديث ودمج منظومة الصوت في ملف VAP بنجاح!</span>';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    } catch (err: any) {
      console.error("[VAP Audio Execute Error]:", err);
      alert(err?.message || "فشلت معالجة الصوت في ملف VAP");
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleDownloadVapZipPackage = async () => {
    const blobToDownload = exportedBlob || preProcessedVapBlob || sourceFile;
    if (!blobToDownload) return;

    try {
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const zip = new JSZip();

      // 1. Add VAP MP4
      zip.file(`${baseName}_VAP.mp4`, blobToDownload);

      // 2. Add JSON config
      const cfgToUse = vapConfig || {
        info: {
          v: 2,
          f: targetFps || 24,
          w: customWidth || videoDimensions.width || 750,
          h: customHeight || videoDimensions.height || 1334,
          videoW: (customWidth || videoDimensions.width || 750) * 2,
          videoH: customHeight || videoDimensions.height || 1334,
          aFrame: [customWidth || videoDimensions.width || 750, 0, customWidth || videoDimensions.width || 750, customHeight || videoDimensions.height || 1334],
          rgbFrame: [0, 0, customWidth || videoDimensions.width || 750, customHeight || videoDimensions.height || 1334]
        }
      };
      zip.file(`${baseName}_VAP.json`, JSON.stringify(cfgToUse, null, 2));

      // 3. Add text manifest
      const txtContent = `VAP Animation Asset Package\nFilename: ${baseName}_VAP.mp4\nDimensions: ${cfgToUse.info.w}x${cfgToUse.info.h}\nFPS: ${cfgToUse.info.f}\nAudio Track: ${!isAudioMuted && (audioFile || audioUrl) ? 'Integrated High-Quality Audio' : 'Muted/Silent'}\nEngine: Universal Motion Tools Direct Stream Remux\n`;
      zip.file(`${baseName}_VAP.txt`, txtContent);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${baseName}_VAP_package.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (zipErr) {
      console.error("Failed to generate VAP ZIP:", zipErr);
    }
  };

  // Safe Video Loader Helper
  const loadVideoForExport = async (url: string, file: File | null): Promise<HTMLVideoElement> => {
    const vid = document.createElement('video');
    vid.muted = true;
    vid.autoplay = false;
    vid.playsInline = true;
    vid.preload = 'auto';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      vid.crossOrigin = 'anonymous';
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        vid.removeEventListener('loadeddata', onReady);
        vid.removeEventListener('loadedmetadata', onReady);
        vid.removeEventListener('canplay', onReady);
        vid.removeEventListener('error', onError);
      };

      const onReady = () => {
        if (!resolved && (vid.videoWidth > 0 || vid.readyState >= 1)) {
          resolved = true;
          cleanup();
          resolve(vid);
        }
      };

      const onError = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (file) {
            const freshUrl = URL.createObjectURL(file);
            const retryVideo = document.createElement('video');
            retryVideo.muted = true;
            retryVideo.playsInline = true;
            retryVideo.preload = 'auto';
            retryVideo.onloadedmetadata = () => resolve(retryVideo);
            retryVideo.onerror = () => reject(new Error('تعذر قراءة بيانات الفيديو. يرجى التأكد من صحة ملف MP4'));
            retryVideo.src = freshUrl;
            retryVideo.load();
          } else {
            reject(new Error('تعذر قراءة بيانات الفيديو'));
          }
        }
      };

      vid.addEventListener('loadedmetadata', onReady);
      vid.addEventListener('loadeddata', onReady);
      vid.addEventListener('canplay', onReady);
      vid.addEventListener('error', onError);

      vid.src = url;
      vid.load();

      if (vid.readyState >= 1 && vid.videoWidth > 0) {
        onReady();
      }

      setTimeout(() => {
        if (!resolved) {
          if (vid.videoWidth > 0 || vid.readyState >= 1) {
            onReady();
          } else {
            onError();
          }
        }
      }, 6000);
    });
  };

  // Robust, jitter-free frame seeker that ensures the GPU / video decoder texture is fully rendered
  const seekVideoToFrame = (video: HTMLVideoElement, targetTime: number): Promise<void> => {
    return new Promise<void>((resolve) => {
      let isDone = false;
      const finish = () => {
        if (!isDone) {
          isDone = true;
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', finish);
          resolve();
        }
      };

      const onSeeked = () => {
        if ('requestVideoFrameCallback' in video) {
          (video as any).requestVideoFrameCallback(() => finish());
        } else {
          requestAnimationFrame(() => finish());
        }
      };

      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', finish, { once: true });
      video.currentTime = targetTime;

      // Safe fallback timeout in case the seeked event was missed
      setTimeout(finish, 350);
    });
  };

  // Convert Audio File or Video Audio Track to AudioData Chunks for MP4 Muxing (100% In-Browser)
  const prepareAudioDataChunks = async (
    audioBlobOrUrl: Blob | string,
    totalDuration: number
  ): Promise<any[]> => {
    return await getAudioChunksForMuxer(audioBlobOrUrl, totalDuration);
  };

  // 1. Export as Professional VAP MP4 (or Standard MP4)
  const handleFastAudioReplace = async () => {
    if (!sourceFile) return;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportSuccess(false);
    setExportedBlob(null);
    setExportStats(null);
    cancelExportRef.current = false;
    setExportStatusText('جاري استهداف واستبدال مسار الصوت فقط في ملف VAP بسرعة فائقة...');
    
    try {
        const audioToUse = isAudioMuted ? null : (audioFile || null);
        const finalVapBlob = await fastReplaceAudioInVap(
            sourceFile, 
            audioToUse, 
            {
              duration: videoDuration > 0 ? videoDuration : undefined,
              vapConfig: vapConfig,
              onProgress: (progress) => {
                setExportProgress(progress);
              },
              onStatus: (status) => {
                setExportStatusText(status);
              }
            }
        );
        
        setExportedBlob(finalVapBlob);
        setExportedFileSize((finalVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
        setExportSuccess(true);
        setExportProgress(100);
        setExportStatusText('تم استبدال مسار الصوت بنجاح مع الحفاظ الكامل على إطارات وجودة VAP!');
        
    } catch (e: any) {
        console.error("Fast audio replace error:", e);
        setExportStatusText('حدث خطأ أثناء استبدال الصوت: ' + (e?.message || e));
    } finally {
        setIsExporting(false);
    }
  };
  const handleExportVAP = async (isStandardMP4: boolean = false) => {
      let webglRenderer: WebGLVapRenderer | null = null;
      try {
        webglRenderer = new WebGLVapRenderer(500, 500);
      } catch (e) {}

    if (!fileUrl) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportSuccess(false);
    setExportedBlob(null);
    setExportStats(null);
    cancelExportRef.current = false;

    try {
      const checkOrigW = vapConfig?.info?.w || videoDimensions.width;
      const checkOrigH = vapConfig?.info?.h || videoDimensions.height;
      const isResized = customWidth > 0 && (customWidth !== checkOrigW || customHeight !== checkOrigH);
      const isUntouchedVideo = !isResized && !enableWatermark;

      // Ultra-Fast Direct Audio Path: Direct Stream Copy when exporting VAP without video-frame alterations
      if (!isStandardMP4 && sourceFile && isUntouchedVideo) {
        if (preProcessedVapBlob && preProcessedVapBlob.size > 10000) {
            setExportStatusText('جاري تجهيز ملف الـ VAP المحدث فوراً...');
            setExportedBlob(preProcessedVapBlob);
            setExportedFileSize((preProcessedVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
            setExportSuccess(true);
            setExportProgress(100);
            setExportStatusText('تم تصدير ملف VAP بنجاح مع الصوت الجديد بأعلى جودة وسرعة فائقة!');
            setIsExporting(false);

            // Auto download
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(preProcessedVapBlob);
            link.download = `${baseName}_with_audio.vap`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }

        setExportStatusText('جاري استبدال مسار الصوت فقط ودمج VAP بدون المساس بالإطارات أو الصور...');
        let actualAudioFile = audioFile;
        if (!actualAudioFile && audioUrl && !isAudioMuted && !muteOriginalAudio) {
          try {
            const res = await fetch(audioUrl);
            const blob = await res.blob();
            if (blob && blob.size > 200) {
              actualAudioFile = new File([blob], audioName || 'audio.mp3', { type: blob.type || 'audio/mp3' });
            }
          } catch (e) {}
        }
        const hasCustomAudio = !!actualAudioFile && !isAudioMuted;
        const audioToUse = hasCustomAudio ? actualAudioFile : null;
        
        try {
          const finalVapBlob = await fastReplaceAudioInVap(
            sourceFile,
            audioToUse,
            {
              duration: videoDuration > 0 ? videoDuration : undefined,
              vapConfig: vapConfig,
              volume: audioVolume,
              mute: muteOriginalAudio && !hasCustomAudio,
              vapCompression: vapCompressionEnabled,
              onProgress: (p) => setExportProgress(p),
              onStatus: (s) => setExportStatusText(s),
            }
          );

          if (finalVapBlob && finalVapBlob.size > 10000) {
            setExportedBlob(finalVapBlob);
            setPreProcessedVapBlob(finalVapBlob);
            setExportedFileSize((finalVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
            setExportSuccess(true);
            setExportProgress(100);
            setExportStatusText('تم تصدير ملف VAP بنجاح مع الصوت الجديد بأعلى سرعة وجودة!');
            setIsExporting(false);

            // Auto download
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(finalVapBlob);
            link.download = `${baseName}_with_audio.vap`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
          }
        } catch (fastErr) {
          console.warn("[VAP Export] Fast path failed, falling back to full client encoding pipeline:", fastErr);
        }
      }

      setExportStatusText('جاري تحضير محرك الفيديو وتجهيز مسار الصوت...');
      const video = await loadVideoForExport(fileUrl, sourceFile);

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const duration = video.duration || videoDuration || 3;
      const fps = targetFps || 24;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frameDuration = 1000000 / fps; // Microseconds
      
      let cfgW = vapConfig?.info?.w || Math.round(vw / 2);
      let cfgH = vapConfig?.info?.h || vh;
      let rawVideoW = vapConfig?.info?.videoW || vw;
      let rawVideoH = vapConfig?.info?.videoH || vh;

      let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
      let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

      if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
        rgbRect = [0, 0, vw, Math.round(vh / 2)];
        alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
        cfgW = vw;
        cfgH = Math.round(vh / 2);
      }

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

      const makeEven = (n: number) => Math.max(2, n % 2 === 0 ? n : n + 1);

      const origW = cfgW;
      const origH = cfgH;
      const desiredGiftW = customWidth || origW;
      const desiredGiftH = customHeight || origH;

      const scaleRatioW = desiredGiftW / (origW || 1);
      const scaleRatioH = desiredGiftH / (origH || 1);

      const outW = isStandardMP4 ? makeEven(desiredGiftW) : makeEven(Math.round(vw * scaleRatioW));
      const outH = isStandardMP4 ? makeEven(desiredGiftH) : makeEven(Math.round(vh * scaleRatioH));

      let audioDataChunks: any[] = [];
      const hasCustomAudio = !!((audioFile || audioUrl) && !isAudioMuted);
      const shouldIncludeAudio = hasCustomAudio || !muteOriginalAudio;

      if (shouldIncludeAudio) {
        setExportStatusText('جاري استخراج وتشفير المسار الصوتي للفيديو (AAC)...');
        const audioSource = hasCustomAudio ? (audioFile || audioUrl) : (sourceFile || fileUrl);
        if (audioSource) {
          audioDataChunks = await prepareAudioDataChunks(audioSource, duration);
        }
      }

      // Initialize MP4 Muxer
      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: outW,
          height: outH,
        },
        audio: shouldIncludeAudio && audioDataChunks.length > 0 ? {
          codec: 'aac',
          numberOfChannels: 2,
          sampleRate: 48000,
        } : undefined,
        fastStart: 'in-memory',
      });

      const totalPixels = outW * outH;
      const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
      
      // Smart, jitter-free Bitrate Calculation scaling with custom dimensions and compression
      let originalBitrate = 4500000;
      if (sourceFile && duration > 0 && sourceFile.size > 0) {
        originalBitrate = Math.round((sourceFile.size * 8) / duration);
      }
      
      const pixelScaleFactor = (outW * outH) / (vw * vh || 1);
      const cLevel = compressionLevel / 100;
      
      // Calculate target bitrate based on pixel surface and target compression level
      const pixelBaselineBitrate = Math.round(totalPixels * 3.0);
      const baseBitrate = Math.max(pixelBaselineBitrate, originalBitrate * pixelScaleFactor);
      
      // Smooth non-destructive compression factor (1.2x at 0% down to 0.45x at 100%)
      const compressionFactor = Math.max(0.45, 1.2 - (cLevel * 0.75));
      let bitrate = Math.round(baseBitrate * compressionFactor);
      
      // Safe minimum bitrate floor based on resolution to prevent decoder lag and stuttering
      const minSafeBitrate = Math.max(1200000, Math.round(totalPixels * 1.5));
      bitrate = Math.max(minSafeBitrate, Math.min(25000000, bitrate));

      // @ts-ignore
      const videoEncoder = new VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => console.error('VideoEncoder error:', e),
      });

      videoEncoder.configure({
        codec: codec,
        width: outW,
        height: outH,
        bitrate: bitrate,
        framerate: fps,
        bitrateMode: 'variable',
        latencyMode: 'quality',
        avc: { format: 'avc' }
      });

      let audioEncoder: any = null;
      if (shouldIncludeAudio && audioDataChunks.length > 0) {
        // @ts-ignore
        audioEncoder = new AudioEncoder({
          output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
          error: (e: any) => console.error('AudioEncoder error:', e),
        });

        audioEncoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate: 48000,
          bitrate: 128000,
        });

        for (const chunk of audioDataChunks) {
          audioEncoder.encode(chunk);
          chunk.close();
        }
        await audioEncoder.flush();
      }

      // Preload custom background image if needed for standard MP4
      let bgImgEl: HTMLImageElement | null = null;
      if (isStandardMP4 && bgMode === 'image' && bgImageUrl) {
        bgImgEl = new Image();
        bgImgEl.crossOrigin = 'anonymous';
        bgImgEl.src = bgImageUrl;
        await new Promise((res) => {
          if (!bgImgEl) return res(null);
          bgImgEl.onload = () => res(null);
          bgImgEl.onerror = () => res(null);
        });
      }

      // Preload watermark image if enabled
      let wmImgEl: HTMLImageElement | null = null;
      if (enableWatermark && watermarkUrl) {
        wmImgEl = new Image();
        wmImgEl.crossOrigin = 'anonymous';
        wmImgEl.src = watermarkUrl;
        await new Promise((res) => {
          if (!wmImgEl) return res(null);
          wmImgEl.onload = () => res(null);
          wmImgEl.onerror = () => res(null);
        });
      }

      // Main Canvas for Frame Rendering
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('فشل إنشاء سياق رسم الفيديو');

      // Helper canvases for precise VAP RGB & Alpha extraction if standard MP4
      let rgbCanvas: HTMLCanvasElement | null = null;
      let rgbCtx: CanvasRenderingContext2D | null = null;
      let alphaCanvas: HTMLCanvasElement | null = null;
      let alphaCtx: CanvasRenderingContext2D | null = null;

      if (isStandardMP4) {
        rgbCanvas = document.createElement('canvas');
        rgbCanvas.width = origW;
        rgbCanvas.height = origH;
        rgbCtx = rgbCanvas.getContext('2d', { willReadFrequently: true });

        alphaCanvas = document.createElement('canvas');
        alphaCanvas.width = origW;
        alphaCanvas.height = origH;
        alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
      }

      for (let i = 0; i < totalFrames; i++) {
        if (cancelExportRef.current) {
          setIsExporting(false);
          setExportStatusText('تم إلغاء التصدير');
          return;
        }

        const currentTime = Math.min(i / fps, Math.max(0, duration - 0.01));
        await seekVideoToFrame(video, currentTime);

        if (!isStandardMP4) {
          // Regular VAP: Draw full side-by-side / stacked VAP frame directly onto canvas
          ctx.drawImage(video, 0, 0, outW, outH);
        } else {
          // Standard MP4: Draw Background first for EVERY frame throughout the duration
          ctx.clearRect(0, 0, outW, outH);
          if (bgMode === 'image' && bgImgEl && bgImgEl.complete && bgImgEl.naturalWidth > 0) {
            ctx.drawImage(bgImgEl, 0, 0, outW, outH);
          } else if (bgMode === 'color') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, outW, outH);
          } else {
            ctx.fillStyle = bgColor || '#0B0C10';
            ctx.fillRect(0, 0, outW, outH);
          }

          // Render Alpha Blended Animation with De-black Matte Removal
          if (rgbCtx && alphaCtx && rgbCanvas && alphaCanvas) {
            rgbCtx.clearRect(0, 0, origW, origH);
            rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, origW, origH);

            alphaCtx.clearRect(0, 0, origW, origH);
            alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, origW, origH);

            if (webglRenderer) {
              if (webglRenderer.canvas.width !== origW) {
                webglRenderer = new WebGLVapRenderer(origW, origH);
              }
              const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
              rgbCtx.clearRect(0, 0, origW, origH);
              rgbCtx.drawImage(glCanvas, 0, 0);
            } else {
              const rgbData = rgbCtx.getImageData(0, 0, origW, origH);
              const alphaData = alphaCtx.getImageData(0, 0, origW, origH);

              const compData = rgbCtx.createImageData(origW, origH);
              const dest = compData.data;
              const rgbPixels = rgbData.data;
              const alphaPixels = alphaData.data;
              const pixelCount = origW * origH;
              const threshold = alphaThreshold;

              for (let p = 0; p < pixelCount; p++) {
                const idx = p * 4;
                const aR = alphaPixels[idx];
                const aG = alphaPixels[idx + 1];
                const aB = alphaPixels[idx + 2];
                const rawAlpha = Math.round(0.299 * aR + 0.587 * aG + 0.114 * aB);

                if (rawAlpha <= threshold) {
                  dest[idx] = 0;
                  dest[idx + 1] = 0;
                  dest[idx + 2] = 0;
                  dest[idx + 3] = 0;
                } else {
                  let aVal = rawAlpha;
                  if (aVal < 255) {
                    aVal = Math.min(255, Math.round(((rawAlpha - threshold) / (255 - threshold)) * 255));
                  }
                  const alphaRatio = aVal / 255;

                  let r = rgbPixels[idx];
                  let g = rgbPixels[idx + 1];
                  let b = rgbPixels[idx + 2];

                  if (unmultiplyAlpha && alphaRatio > 0.02) {
                    r = Math.min(255, Math.max(0, Math.round(r / alphaRatio)));
                    g = Math.min(255, Math.max(0, Math.round(g / alphaRatio)));
                    b = Math.min(255, Math.max(0, Math.round(b / alphaRatio)));
                  }

                  dest[idx] = r;
                  dest[idx + 1] = g;
                  dest[idx + 2] = b;
                  dest[idx + 3] = aVal;
                }
              }

              rgbCtx.putImageData(compData, 0, 0);
            }

            // Draw blended animation on top of background
            ctx.drawImage(rgbCanvas, 0, 0, outW, outH);
          }
        }

        // Draw Animated Square Watermark onto frame if enabled
        if (enableWatermark && wmImgEl && wmImgEl.complete && wmImgEl.naturalWidth > 0) {
          const wmProgress = totalFrames > 1 ? i / (totalFrames - 1) : 0;
          const { x, y, side } = computeWatermarkPosition(
            wmProgress,
            outW,
            outH,
            watermarkSize,
            watermarkMotionType,
            watermarkMotionAmount,
            watermarkSpeed,
            watermarkPosition
          );
          drawSquareWatermarkToContext(
            ctx,
            wmImgEl,
            x,
            y,
            side,
            watermarkOpacity / 100,
            watermarkBorderRadius,
            watermarkBorder
          );
        }

        const frameTimestamp = Math.round((i * 1000000) / fps);
        const nextTimestamp = Math.round(((i + 1) * 1000000) / fps);
        const actualFrameDuration = Math.max(1, nextTimestamp - frameTimestamp);

        // @ts-ignore
        const frame = new VideoFrame(canvas, {
          timestamp: frameTimestamp,
          duration: actualFrameDuration,
        });

        // Keyframe every ~12-24 frames (or at frame 0) to ensure smooth seek, buffer stability and no stutter
        const isKeyFrame = i === 0 || i % Math.max(10, Math.min(30, Math.round(fps))) === 0;
        videoEncoder.encode(frame, { keyFrame: isKeyFrame });
        frame.close();

        const pct = Math.round(((i + 1) / totalFrames) * 85);
        setExportProgress(pct);
        setExportStatusText(`تشفير إطار ${isStandardMP4 ? 'MP4' : 'VAP'} ${i + 1} من ${totalFrames} (${pct}%)`);
      }

      await videoEncoder.flush();
      videoEncoder.close();

      if (audioEncoder) {
        await audioEncoder.flush();
        audioEncoder.close();
      }

      muxer.finalize();

      const muxerBuffer = (muxer.target as Mp4Muxer.ArrayBufferTarget).buffer;
      let finalBlob: Blob;

      if (isStandardMP4) {
        setExportStatusText('تم إعداد فيديو MP4 بنجاح!');
        setExportProgress(100);
        finalBlob = new Blob([muxerBuffer], { type: 'video/mp4' });
      } else {
        setExportStatusText('جاري حقن كود وصندوق VAPC داخل ملف MP4...');
        setExportProgress(95);

        const jsonConfig = {
          info: {
            v: 2,
            f: totalFrames,
            w: desiredGiftW,
            h: desiredGiftH,
            fps: fps,
            videoW: outW,
            videoH: outH,
            aFrame: [Math.round(alphaRect[0] * scaleRatioW), Math.round(alphaRect[1] * scaleRatioH), Math.round(alphaRect[2] * scaleRatioW), Math.round(alphaRect[3] * scaleRatioH)],
            rgbFrame: [Math.round(rgbRect[0] * scaleRatioW), Math.round(rgbRect[1] * scaleRatioH), Math.round(rgbRect[2] * scaleRatioW), Math.round(rgbRect[3] * scaleRatioH)],
            isVapx: 0,
            codeTag: ["common"],
            orien: 0
          }
        };

        const jsonStr = JSON.stringify(jsonConfig);
        const jsonBytes = new TextEncoder().encode(jsonStr);
        const boxSize = 8 + jsonBytes.length;
        const boxBuffer = new Uint8Array(boxSize);
        const view = new DataView(boxBuffer.buffer);

        view.setUint32(0, boxSize);
        view.setUint8(4, 0x76); // 'v'
        view.setUint8(5, 0x61); // 'a'
        view.setUint8(6, 0x70); // 'p'
        view.setUint8(7, 0x63); // 'c'

        boxBuffer.set(jsonBytes, 8);

        const finalBuffer = new Uint8Array(muxerBuffer.byteLength + boxSize);
        finalBuffer.set(new Uint8Array(muxerBuffer), 0);
        finalBuffer.set(boxBuffer, muxerBuffer.byteLength);

        finalBlob = new Blob([finalBuffer], { type: 'video/mp4' });
      }

      setExportProgress(100);
      setExportStatusText(`تم تصدير ملف ${isStandardMP4 ? 'MP4' : 'VAP'} بنجاح!`);
      setExportedBlob(finalBlob);
      setExportedFileSize((finalBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
      setExportSuccess(true);
      setIsExporting(false);

      // Auto-download file
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const audioTag = shouldIncludeAudio ? '_with_audio' : '_silent';
      const link = document.createElement('a');
      link.href = URL.createObjectURL(finalBlob);
      link.download = isStandardMP4 
        ? `${baseName}${audioTag}.mp4`
        : `${baseName}${audioTag}.vap`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err: any) {
      console.error('Export Error:', err);
      setErrorMessage(`حدث خطأ أثناء تصدير الملف: ${err.message || err}`);
      setIsExporting(false);
      setExportStatusText('فشل التصدير');
    }
  };

  // 2. Export as High-Quality, Clean SVGA 2.0 with Embedded Audio
  const handleExportSVGA = async () => {
      let webglRenderer: WebGLVapRenderer | null = null;
      try {
        webglRenderer = new WebGLVapRenderer(videoDimensions.width || 500, videoDimensions.height || 500);
      } catch (e) {}

    if (!fileUrl) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportSuccess(false);
    setExportedBlob(null);
    setExportStats(null);
    cancelExportRef.current = false;

    try {
      setExportStatusText('جاري فحص قنوات الفيديو واستخراج الإطارات...');

      const video = await loadVideoForExport(fileUrl, sourceFile);

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let cfgW = vapConfig?.info?.w || Math.round(vw / 2);
      let cfgH = vapConfig?.info?.h || vh;
      let rawVideoW = vapConfig?.info?.videoW || vw;
      let rawVideoH = vapConfig?.info?.videoH || vh;

      let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
      let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

      if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
        rgbRect = [0, 0, vw, Math.round(vh / 2)];
        alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
        cfgW = vw;
        cfgH = Math.round(vh / 2);
      }

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

      const origW = cfgW;
      const origH = cfgH;
      const outW = customWidth || Math.max(1, Math.round(origW * resolutionScale));
      const outH = customHeight || Math.max(1, Math.round(origH * resolutionScale));

      const duration = video.duration || videoDuration || 3;
      const fps = targetFps || 24;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frameInterval = 1 / fps;

      const rgbCanvas = document.createElement('canvas');
      rgbCanvas.width = origW;
      rgbCanvas.height = origH;
      const rgbCtx = rgbCanvas.getContext('2d', { willReadFrequently: true });
      if (!rgbCtx) throw new Error('فشل إنشاء سياق RGB');

      const alphaCanvas = document.createElement('canvas');
      alphaCanvas.width = origW;
      alphaCanvas.height = origH;
      const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
      if (!alphaCtx) throw new Error('فشل إنشاء سياق Alpha');

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = outW;
      exportCanvas.height = outH;
      const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
      if (!exportCtx) throw new Error('فشل إنشاء سياق التصدير');

      // Preload watermark image if enabled
      let wmImgEl: HTMLImageElement | null = null;
      if (enableWatermark && watermarkUrl) {
        wmImgEl = new Image();
        wmImgEl.crossOrigin = 'anonymous';
        wmImgEl.src = watermarkUrl;
        await new Promise((res) => {
          if (!wmImgEl) return res(null);
          wmImgEl.onload = () => res(null);
          wmImgEl.onerror = () => res(null);
        });
      }

      const imagesMap: Record<string, Uint8Array> = {};
      const sprites: any[] = [];

      for (let i = 0; i < totalFrames; i++) {
        if (cancelExportRef.current) {
          setIsExporting(false);
          setExportStatusText('تم إلغاء التصدير');
          return;
        }

        const currentTime = Math.min(i * frameInterval, Math.max(0, duration - 0.01));
        await seekVideoToFrame(video, currentTime);

        rgbCtx.clearRect(0, 0, origW, origH);
        rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, origW, origH);

        alphaCtx.clearRect(0, 0, origW, origH);
        alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, origW, origH);

        const rgbData = rgbCtx.getImageData(0, 0, origW, origH);
        const alphaData = alphaCtx.getImageData(0, 0, origW, origH);

        const compositeImageData = rgbCtx.createImageData(origW, origH);
        const compData = compositeImageData.data;
        const rgbPixels = rgbData.data;
        const alphaPixels = alphaData.data;
        const pixelCount = origW * origH;

        const threshold = alphaThreshold;

        for (let p = 0; p < pixelCount; p++) {
          const idx = p * 4;
          
          const aR = alphaPixels[idx];
          const aG = alphaPixels[idx + 1];
          const aB = alphaPixels[idx + 2];
          const rawAlpha = Math.round(0.299 * aR + 0.587 * aG + 0.114 * aB);

          if (rawAlpha <= threshold) {
            compData[idx] = 0;
            compData[idx + 1] = 0;
            compData[idx + 2] = 0;
            compData[idx + 3] = 0;
          } else {
            let aVal = rawAlpha;
            if (aVal < 255) {
              aVal = Math.min(255, Math.round(((rawAlpha - threshold) / (255 - threshold)) * 255));
            }
            const alphaRatio = aVal / 255;

            let r = rgbPixels[idx];
            let g = rgbPixels[idx + 1];
            let b = rgbPixels[idx + 2];

            if (unmultiplyAlpha && alphaRatio > 0.02) {
              r = Math.min(255, Math.max(0, Math.round(r / alphaRatio)));
              g = Math.min(255, Math.max(0, Math.round(g / alphaRatio)));
              b = Math.min(255, Math.max(0, Math.round(b / alphaRatio)));
            }

            compData[idx] = r;
            compData[idx + 1] = g;
            compData[idx + 2] = b;
            compData[idx + 3] = aVal;
          }
        }

        rgbCtx.putImageData(compositeImageData, 0, 0);

        exportCtx.clearRect(0, 0, outW, outH);
        exportCtx.drawImage(rgbCanvas, 0, 0, origW, origH, 0, 0, outW, outH);

        // Draw Animated Square Watermark onto frame if enabled
        if (enableWatermark && wmImgEl && wmImgEl.complete && wmImgEl.naturalWidth > 0) {
          const wmProgress = totalFrames > 1 ? i / (totalFrames - 1) : 0;
          const { x, y, side } = computeWatermarkPosition(
            wmProgress,
            outW,
            outH,
            watermarkSize,
            watermarkMotionType,
            watermarkMotionAmount,
            watermarkSpeed,
            watermarkPosition
          );
          drawSquareWatermarkToContext(
            exportCtx,
            wmImgEl,
            x,
            y,
            side,
            watermarkOpacity / 100,
            watermarkBorderRadius,
            watermarkBorder
          );
        }

        const scaledImageData = exportCtx.getImageData(0, 0, outW, outH);

        
        const cLevel = compressionLevel / 100;
        const qualityRatio = 1.0 - (cLevel * 0.9);
        let imageBytes: Uint8Array;
        
        if (svgaFormat === 'webp' || svgaFormat === 'jpeg') {
           const mime = svgaFormat === 'webp' ? 'image/webp' : 'image/jpeg';
           const dataUrl = exportCanvas.toDataURL(mime, qualityRatio);
           const bstr = atob(dataUrl.split(',')[1]);
           let n = bstr.length;
           const u8arr = new Uint8Array(n);
           while(n--) { u8arr[n] = bstr.charCodeAt(n); }
           imageBytes = u8arr;
        } else {
           const scaledImageData = exportCtx.getImageData(0, 0, outW, outH);
           const cnum = compressionLevel === 0 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));
           const pngBuffer = UPNG.encode([scaledImageData.data.buffer], outW, outH, cnum);
           imageBytes = new Uint8Array(pngBuffer);
        }

        const imgKey = `frame_${i}`;
        imagesMap[imgKey] = imageBytes;


        const spriteFrames = [];
        for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
          spriteFrames.push({
            alpha: fIdx === i ? 1.0 : 0.0,
            layout: { x: 0, y: 0, width: outW, height: outH },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
          });
        }

        sprites.push({
          imageKey: imgKey,
          frames: spriteFrames
        });

        const pct = Math.round(((i + 1) / totalFrames) * 80);
        setExportProgress(pct);
        setExportStatusText(`معالجة الشفافية وضغط الإطار ${i + 1} من ${totalFrames} (${pct}%)`);
      }

      // Process Audio Track & Embedding
      const audios: any[] = [];
      const hasCustomAudio = (audioFile || audioUrl) && !isAudioMuted;
      const shouldIncludeAudio = hasCustomAudio || !muteOriginalAudio;

      if (shouldIncludeAudio) {
        setExportStatusText('جاري دمج ومعالجة المسار الصوتي داخل ملف SVGA...');
        setExportProgress(85);

        try {
          let audioBytes: Uint8Array | null = null;
          
          if (hasCustomAudio) {
              if (audioFile) {
                const buffer = await audioFile.arrayBuffer();
                audioBytes = new Uint8Array(buffer);
              } else {
                const resp = await fetch(audioUrl!);
                const buffer = await resp.arrayBuffer();
                audioBytes = new Uint8Array(buffer);
              }
          } else {
              // We need to extract the audio from the original source file.
              // We can't just pass MP4 bytes to SVGA audio player, it expects MP3/WAV/AAC.
              // So we will use the backend extraction route if available, or just fallback.
              // The user already has "Download Original Audio" feature which uses backend.
              // We can fetch it from there silently.
              if (sourceFile) {
                  const formData = new FormData();
                  formData.append('video', sourceFile);
                  formData.append('format', 'mp3');
                  formData.append('quality', '128k');

                  const res = await fetch('/api/audio/extract', {
                    method: 'POST',
                    body: formData,
                  });
                  const data = await res.json();
                  const jobId = data.jobId;

                  if (jobId) {
                      // Poll until ready
                      for (let i = 0; i < 30; i++) {
                         const statusRes = await fetch(`/api/audio/status/${jobId}`);
                         const statusData = await statusRes.json();
                         if (statusData.status === 'completed') {
                            const audioResp = await fetch(`/api/audio/download/${jobId}`);
                            const buffer = await audioResp.arrayBuffer();
                            audioBytes = new Uint8Array(buffer);
                            break;
                         } else if (statusData.status === 'failed') {
                            break;
                         }
                         await new Promise(r => setTimeout(r, 1000));
                      }
                  }
              }
          }

          if (audioBytes) {
            const audioKey = `audio_track_${Date.now()}.mp3`;
            imagesMap[audioKey] = audioBytes;

            const totalAudioMs = Math.round((audioDuration || duration) * 1000);
            audios.push({
              audioKey: audioKey,
              startFrame: 0,
              endFrame: totalFrames,
              startTime: 0,
              totalTime: totalAudioMs
            });
          }
        } catch (audioErr) {
          console.warn("Failed to embed audio in SVGA:", audioErr);
        }
      }

      // Encode Final SVGA 2.0 Binary
      setExportStatusText('تجميع وتشفير ملف SVGA 2.0 Protobuf Deflate...');
      setExportProgress(92);

      const movieData = {
        version: '2.0',
        params: {
          viewBoxWidth: outW,
          viewBoxHeight: outH,
          fps: Math.round(fps),
          frames: totalFrames
        },
        images: imagesMap,
        sprites: sprites,
        audios: audios
      };

      const svgaBlob = await encodeSVGA(movieData);
      
      setExportProgress(100);
      setExportStatusText('تم التصدير والدمج بنجاح!');
      setExportedBlob(svgaBlob);
      setExportedFileSize((svgaBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
      setExportSuccess(true);
      setIsExporting(false);

      loadSvgaPreview(svgaBlob);

    } catch (err: any) {
      console.error('Export SVGA Error:', err);
      setErrorMessage(`حدث خطأ أثناء تصدير ملف SVGA: ${err.message || err}`);
      setIsExporting(false);
      setExportStatusText('فشل التصدير');
    }
  };

  // Trigger Selected Export Mode
  const handleStartExport = () => {
    if (exportTargetFormat === 'vap') {
      handleExportVAP(false);
    } else if (exportTargetFormat === 'mp4') {
      handleExportVAP(true); // true = export standard mp4
    } else {
      handleExportSVGA();
    }
  };

  // Load and play Exported SVGA in the preview area
  const loadSvgaPreview = async (blob: Blob) => {
    try {
      setActiveViewMode('svga');
      const arrayBuffer = await blob.arrayBuffer();
      
      if (svgaContainerRef.current) {
        svgaContainerRef.current.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
        svgaContainerRef.current.appendChild(canvas);

        const parser = new SvgaParser();
        const player = new SvgaPlayer(canvas);
        svgaPlayerRef.current = player;

        const svgaData = await parser.do(arrayBuffer);
        player.set({
          loop: 0,
          cacheFrames: true,
          intersectionObserverRender: false
        } as any);
        await player.mount(svgaData);
        player.start();
      }
    } catch (e) {
      console.error("Failed to load SVGA preview:", e);
    }
  };

  // Download Exported SVGA File
  const handleDownloadSVGA = () => {
    if (!exportedBlob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(exportedBlob);
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const hasAudioTag = !isAudioMuted && (audioFile || audioUrl) ? '_with_audio' : '';
    link.download = `${baseName}${hasAudioTag}_clean.svga`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    return () => {
      if (vapInstanceRef.current) {
        try { vapInstanceRef.current.destroy(); } catch (e) {}
      }
      if (svgaPlayerRef.current) {
        try { svgaPlayerRef.current.destroy(); } catch (e) {}
      }
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [fileUrl, audioUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6" style={{ background: 'radial-gradient(circle at 50% 50%, #151824 0%, #07090E 100%)' }}>
      <div className="absolute inset-0 bg-[#07090E]/85 backdrop-blur-2xl" onClick={onCancel}></div>

      {/* Hidden Audio Element for Live Sync */}
      <audio 
        ref={audioElementRef}
        src={audioUrl || undefined}
        loop
        onEnded={() => setIsAudioPlaying(false)}
        className="hidden"
        muted={isPlaybackMuted}
      />

      <div className="relative w-full max-w-[1580px] h-[94vh] bg-[#0E1017] rounded-[2.5rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        {errorMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] min-w-[300px] p-4 bg-red-500/90 backdrop-blur-md border border-red-400/50 rounded-2xl flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-white" />
              <span className="text-white font-bold">{errorMessage}</span>
            </div>
            <button 
              onClick={() => setErrorMessage('')}
              className="text-white/80 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 sm:py-5 border-b border-white/5 bg-[#141824]/60 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <RefreshCw className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Universal Motion Workspace</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  VAP & SVGA Studio Pro
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium mt-0.5">معاينة فيديو VAP، دمج وإزالة الصوت، وتصدير بصيغة VAP (MP4) أو SVGA 2.0 بدقة متناهية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {fileUrl && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>تغيير الفيديو</span>
              </button>
            )}
            <button 
              onClick={onCancel}
              className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all hover:rotate-90 border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
          
          {/* Left Control Sidebar */}
          <div className="w-full lg:w-[420px] border-r border-white/5 bg-[#10121A] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            
            {/* 1. Source Video Card */}
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileVideo className="w-3.5 h-3.5 text-indigo-400" />
                  الفيديو المصدر (VAP)
                </span>
                {fileUrl && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    VAP Ready
                  </span>
                )}
              </div>

              {!fileUrl ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`w-full py-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/2 hover:bg-white/5 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-3 text-indigo-400 border border-indigo-500/20">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-white text-sm font-bold mb-1">اضغط لرفع فيديو VAP (MP4)</p>
                  <p className="text-[11px] text-slate-500 font-medium">أو اسحب وأفلت الملف هنا</p>
                </div>
              ) : (
                <div className="bg-[#161922] border border-white/5 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">اسم الملف:</span>
                    <span className="text-white font-bold truncate max-w-[200px]" title={fileName}>{fileName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">الحجم الأصلي:</span>
                    <span className="text-indigo-300 font-mono font-bold">{fileSize}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">الأبعاد المستخرجة:</span>
                    <span className="text-slate-200 font-mono">{videoDimensions.width} × {videoDimensions.height} px</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">معدل الإطارات:</span>
                    <span className="text-slate-200 font-mono">{targetFps} FPS</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Audio Studio & Management (إدارة ودمج وإزالة الصوت) */}
            <div className="p-5 border-b border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-pink-400" />
                  أصول واستوديو صوت VAP (Audio Assets)
                </span>
                <div className="flex items-center gap-1.5">
                  {audioUrl && (
                    <button
                      onClick={handleDownloadAudioFile}
                      title="تحميل المسار الصوتي بصيغة MP3"
                      className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ audio</span>
                  </button>
                </div>
              </div>

              {isProcessingAudio && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                   <div className="flex justify-between items-center text-xs font-bold text-emerald-400">
                     <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري معالجة ودمج الصوت...
                     </span>
                     <span>{audioProcessProgress}%</span>
                   </div>
                   <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                     <div 
                       className="h-full bg-emerald-500 transition-all duration-300"
                       style={{ width: `${audioProcessProgress}%` }}
                     />
                   </div>
                </div>
              )}

              <input 
                type="file" 
                ref={audioInputRef} 
                className="hidden" 
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" 
                onChange={handleAudioUpload} 
              />

              {audioUrl ? (
                <div className="bg-[#161922] border border-pink-500/20 rounded-2xl p-4 space-y-3 shadow-lg shadow-pink-500/5">
                  <div 
                    onClick={() => setIsAudioEditorModalOpen(true)}
                    className="flex items-center justify-between cursor-pointer hover:bg-white/[0.02] -m-1 p-1 rounded-xl transition-all"
                    title="انقر لفتح نافذة تعديل الصوت المتقدمة"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                        <FileAudio className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate max-w-[170px]" title={audioName}>
                          {audioName}
                        </p>
                        <p className="text-[10px] font-mono text-pink-300/80">
                          {audioDuration ? `${audioDuration.toFixed(1)}s` : ''} {audioSize ? `• ${audioSize}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setIsAudioEditorModalOpen(true)}
                        title="فتح أداة تعديل الصوت الاحترافية"
                        className="w-8 h-8 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 flex items-center justify-center transition-all border border-indigo-500/30 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleTogglePlayAudio}
                        title={isAudioPlaying ? "إيقاف مؤقت" : "تشغيل الصوت"}
                        className="w-8 h-8 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 flex items-center justify-center transition-all border border-pink-500/30"
                      >
                        {isAudioPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      </button>

                      <button
                        onClick={handleToggleMute}
                        title={isAudioMuted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                          isAudioMuted 
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                        }`}
                      >
                        {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={handleRemoveAudio}
                        title="حذف الصوت تماماً من الملف"
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all border border-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* VAP Audio Edit Modal Trigger Button */}
                  <button
                    onClick={() => setIsAudioEditorModalOpen(true)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-pink-500/20 via-indigo-500/20 to-purple-500/20 hover:from-pink-500/30 hover:via-indigo-500/30 hover:to-purple-500/30 text-pink-200 border border-pink-500/30 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-pink-400" />
                    <span>تعديل الصوت (VAP Audio Edit Tool)</span>
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <Volume2 className="w-3 h-3 text-slate-400 shrink-0" />
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioVolume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full accent-pink-500 h-1 bg-white/10 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 w-7 text-left">
                      {Math.round(audioVolume * 100)}%
                    </span>
                  </div>

                  {/* Processing Progress Indicator */}
                  {isProcessingAudio && (
                    <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-pink-300">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-pink-400" />
                          جاري دمج مسار الصوت الجديد مع VAP فوراً...
                        </span>
                        <span className="font-mono text-pink-400">{audioProcessProgress}%</span>
                      </div>
                      <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${Math.max(5, audioProcessProgress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Direct VAP Download Banner if processed */}
                  {preProcessedVapBlob && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ملف الـ VAP جاهز مع الصوت الجديد!
                        </span>
                        <div className="flex items-center gap-1.5">
                          {sourceFile && (
                            <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                              {preProcessedVapBlob.size >= sourceFile.size 
                                ? `+${((preProcessedVapBlob.size - sourceFile.size) / 1024).toFixed(1)} KB (حجم الصوت)`
                                : `${((preProcessedVapBlob.size - sourceFile.size) / 1024).toFixed(1)} KB`}
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-emerald-300 font-bold">
                            {(preProcessedVapBlob.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const baseName = fileName.replace(/\.[^/.]+$/, '');
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(preProcessedVapBlob);
                          link.download = `${baseName}_with_audio.vap`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-lg text-xs font-black shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تنزيل ملف VAP بالصوت فوراً</span>
                      </button>
                    </div>
                  )}

                  {/* Audio Controls Buttons */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1">
                        <button
                          onClick={() => setVapCompressionEnabled(!vapCompressionEnabled)}
                          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            vapCompressionEnabled 
                              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' 
                              : 'hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <Gauge className="w-3.5 h-3.5" />
                          <span>{vapCompressionEnabled ? 'ضغط VAP مفعل' : 'تفعيل ضغط VAP'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'vapCompression' ? null : 'vapCompression');
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            activeTooltip === 'vapCompression'
                              ? 'bg-emerald-500 text-white border-emerald-400'
                              : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-emerald-300 border-white/10'
                          }`}
                          title="عرض وشرح وظيفة زر ضغط VAP"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => audioInputRef.current?.click()}
                        className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-pink-400" />
                        <span>تغيير الصوت</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1">
                      <button
                        onClick={handleDownloadAudioFile}
                        className="w-full py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        <span>تحميل الصوت</span>
                      </button>
                    </div>

                    {/* VAP Compression Help / Tooltip Card */}
                    {activeTooltip === 'vapCompression' && (
                      <div 
                        className="p-4 bg-[#111420] border border-emerald-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                        dir="rtl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Gauge className="w-4 h-4 text-emerald-400" />
                            <h5 className="text-xs font-black text-white">دليل ميزة: تفعيل ضغط VAP (Compression)</h5>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                const text = `📋 دليل وإرشادات ميزة: تفعيل ضغط VAP (Compression)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
يقوم هذا الخيار بضغط وتحسين تدفق البيانات ومعدل البت (Bitrate) لملف فيديو VAP المدمج بالصوت، مع الحفاظ الكامل على شفافية الألفا ودقة الألوان وسلاسة حركة الهدية.

• 🟢 عند التفعيل (فتح الزر):
يقلل حجم ملف VAP بنسبة 40% إلى 60% ليصبح خفيفاً جداً وسريع التحميل الفوري داخل تطبيقات البث المباشر وغرف الدردشة لتفادي التقطيع وتوفير استهلاك باقة الإنترنت وذاكرة الهاتف.

• ⚪ عند التعطيل (قفل الزر):
يتم تصدير ملف VAP بأعلى جودة خام أصلية بدون أي إعادة ضغط للبيانات، مما يعطي أقصى دقة بصرية ممكنة ولكنه ينتج ملفاً بحجم أكبر.

• 💡 نصيحة:
يُوصى بتفعيله دائماً إذا كان الملف مخصصاً لتطبيقات الهواتف الذكية وتطبيقات البث لضمان عمل الهدية بسلاسة وسرعة فائقة.`;
                                copyTooltipInstructions('vapCompression', text);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                                copiedTooltipId === 'vapCompression'
                                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                  : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                              }`}
                              title="نسخ التعليمات كاملة"
                            >
                              {copiedTooltipId === 'vapCompression' ? (
                                <>
                                  <Check className="w-3 h-3 text-white" />
                                  <span>تم النسخ بنجاح!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>نسخ التعليمات</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setActiveTooltip(null)}
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="إغلاق"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                          <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                            <strong className="text-emerald-400 block mb-0.5 font-bold">📌 ما هي الوظيفة والفائدة؟</strong>
                            يقوم هذا الخيار بضغط وتحسين تدفق البيانات ومعدل البت (Bitrate) لملف فيديو VAP المدمج بالصوت مع الحفاظ على شفافية الفيديو ودقة الألوان وسلاسة الحركة.
                          </p>

                          <div className="space-y-1.5 pt-0.5">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                              <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                عند التفعيل (فتح الزر):
                              </strong>
                              <p className="text-slate-300 text-[11px] leading-relaxed">
                                يقلل حجم ملف VAP بنسبة <strong>40% إلى 60%</strong>، مما يجعله خفيفاً وسريع التحميل جداً داخل تطبيقات البث المباشر وغرف الدردشة لتسريع العرض وتوفير استهلاك باقة الإنترنت والذاكرة.
                              </p>
                            </div>

                            <div className="bg-slate-800/60 border border-white/10 p-2.5 rounded-xl">
                              <strong className="text-slate-300 flex items-center gap-1.5 font-bold mb-1">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                عند التعطيل (قفل الزر):
                              </strong>
                              <p className="text-slate-400 text-[11px] leading-relaxed">
                                يتم تصدير ملف VAP بأعلى جودة خام أصلية بدون أي إعادة ضغط للبيانات، مما يوفر أقصى دقة بصرية ممكنة ولكنه ينتج ملفاً أكبر حجماً.
                              </p>
                            </div>
                          </div>

                          <p className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 flex items-start gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span><strong>نصيحة:</strong> يُنصح بتفعيله للتطبيقات والبث المباشر لضمان تشغيل سريع وسلس بدون أي لاق أو تقطيع.</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                </div>
              ) : (
                <div 
                  onClick={() => audioInputRef.current?.click()}
                  className="w-full py-4 px-4 rounded-2xl border border-dashed border-pink-500/30 bg-pink-500/5 hover:bg-pink-500/10 cursor-pointer transition-all flex items-center justify-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-105 transition-all">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                      إضافة مسار صوتي للهدية (MP3 / WAV)
                    </p>
                    <p className="text-[10px] text-slate-400">سيتم دمج الصوت تلقائياً داخل ملف الـ VAP أو SVGA</p>
                  </div>
                </div>
              )}
            </div>

            
            {/* Original VAP Audio Control */}
            <div className="p-5 border-b border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  صوت ملف VAP الأصلي
                </span>
              </div>
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-300">كتم الصوت الأصلي عند التصدير</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTooltip(activeTooltip === 'muteOriginal' ? null : 'muteOriginal');
                    }}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      activeTooltip === 'muteOriginal'
                        ? 'bg-indigo-500 text-white border-indigo-400'
                        : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 border-white/10'
                    }`}
                    title="عرض وشرح وظيفة كتم الصوت الأصلي"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button 
                  onClick={async () => {
                    const nextMute = !muteOriginalAudio;
                    setMuteOriginalAudio(nextMute);
                    setPreProcessedVapBlob(null);
                    if (sourceFile) {
                      setIsProcessingAudio(true);
                      setAudioProcessProgress(0);
                      try {
                        const hasCustomAudio = !!(audioFile && !isAudioMuted);
                        const audioToUse = hasCustomAudio ? audioFile : (nextMute ? null : sourceFile);
                        const finalVapBlob = await fastReplaceAudioInVap(
                          sourceFile,
                          audioToUse,
                          {
                            duration: videoDuration > 0 ? videoDuration : undefined,
                            vapConfig: vapConfig,
                            mute: nextMute && !hasCustomAudio,
                            onProgress: (p) => setAudioProcessProgress(p)
                          }
                        );
                        setPreProcessedVapBlob(finalVapBlob);
                        setExportedBlob(finalVapBlob);
                        setExportedFileSize((finalVapBlob.size / (1024 * 1024)).toFixed(2) + ' MB');
                      } catch (e) {
                        console.warn("Re-process on mute original audio failed:", e);
                      } finally {
                        setIsProcessingAudio(false);
                      }
                    }
                  }}
                  className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${muteOriginalAudio ? 'bg-indigo-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${muteOriginalAudio ? 'left-1 translate-x-6' : 'left-1'}`} />
                </button>
              </div>

              {/* Mute Original Help / Tooltip Card */}
              {activeTooltip === 'muteOriginal' && (
                <div 
                  className="p-4 bg-[#111420] border border-blue-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                  dir="rtl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-blue-400" />
                      <h5 className="text-xs font-black text-white">دليل خيار: كتم الصوت الأصلي لملف VAP</h5>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const text = `📋 دليل وإرشادات: كتم الصوت الأصلي لملف VAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
التحكم في المسار الصوتي المدمج افتراضياً داخل ملف VAP الأصلي أثناء عملية المعالجة والتصدير.

• 🟢 عند التفعيل (فتح الزر):
يتم حذف وكتم المسار الصوتي الأصلي تماماً عند التصدير، ليصبح الفيديو صامتاً تماماً (أو يحتوي فقط على الصوت الجديد المخصص الذي قمت بإضافته).

• ⚪ عند التعطيل (قفل الزر):
يتم الاحتفاظ بالمسار الصوتي الأصلي لملف VAP كما هو بدون أي حذف أو تغيير.`;
                          copyTooltipInstructions('muteOriginal', text);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                          copiedTooltipId === 'muteOriginal'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                        }`}
                        title="نسخ التعليمات كاملة"
                      >
                        {copiedTooltipId === 'muteOriginal' ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span>تم النسخ بنجاح!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ التعليمات</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTooltip(null)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="إغلاق"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                      <strong className="text-blue-400 block mb-0.5 font-bold">📌 ما هي الوظيفة؟</strong>
                      التحكم في المسار الصوتي المدمج افتراضياً داخل ملف VAP الأصلي أثناء عملية التصدير.
                    </p>

                    <div className="space-y-1.5 pt-0.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                        <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          عند التفعيل (فتح الزر):
                        </strong>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          يتم إزالة وكتم الصوت الأصلي للفيديو نهائياً في التصدير، ليصبح ملف VAP بدون صوت قديم (أو بالصوت الجديد فقط).
                        </p>
                      </div>

                      <div className="bg-slate-800/60 border border-white/10 p-2.5 rounded-xl">
                        <strong className="text-slate-300 flex items-center gap-1.5 font-bold mb-1">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          عند التعطيل (قفل الزر):
                        </strong>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          يتم الاحتفاظ بالصوت الأصلي لملف VAP كما هو بدون أي حذف.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Download original audio extracted from VAP button */}
              <button 
                onClick={handleDownloadOriginalAudio}
                disabled={isExtractingAudio || !fileUrl}
                className="w-full py-2.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExtractingAudio ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>جاري استخراج وتحميل الصوت...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>تنزيل الصوت الأصلي للملف (MP3)</span>
                  </>
                )}
              </button>
            </div>

            {/* Watermark Studio (العلامة المائية المتحركة المربعة) */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Stamp className="w-3.5 h-3.5 text-pink-400" />
                    العلامة المائية المتحركة (مربعة)
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTooltip(activeTooltip === 'watermark' ? null : 'watermark');
                    }}
                    className={`p-1 rounded-md border transition-all cursor-pointer ${
                      activeTooltip === 'watermark'
                        ? 'bg-pink-500 text-white border-pink-400'
                        : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-pink-300 border-white/10'
                    }`}
                    title="شرح ميزة العلامة المائية المتحركة"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEnableWatermark(!enableWatermark)}
                    className={`w-11 h-5 rounded-full relative transition-colors cursor-pointer ${enableWatermark ? 'bg-pink-500' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enableWatermark ? 'left-0.5 translate-x-6' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Watermark Help / Tooltip Card */}
              {activeTooltip === 'watermark' && (
                <div 
                  className="p-4 bg-[#111420] border border-pink-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                  dir="rtl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Stamp className="w-4 h-4 text-pink-400" />
                      <h5 className="text-xs font-black text-white">دليل: العلامة المائية المتحركة (مربعة)</h5>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const text = `📋 دليل وإرشادات: العلامة المائية المتحركة (مربعة)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
إضافة وتضمين شعار أو علامة مائية متحركة ومخصصة فوق الهدية لحفظ وتوثيق الحقوق وإبراز هوية المطور أو المصمم.

• 🟢 عند التفعيل (فتح الزر):
يتم دمج الشعار أو الصورة فوق الهدية، مع إمكانية ضبط نوع الحركة (عائمة، ارتدادية، مدارية، أو ثابتة)، والتحكم في الشفافية وسرعة الحركة وحجم وموقع العلامة المائية.

• ⚪ عند التعطيل (قفل الزر):
يتم تصدير الهدية نظيفة تماماً بدون أي شعار أو علامة مائية إضافية.`;
                          copyTooltipInstructions('watermark', text);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                          copiedTooltipId === 'watermark'
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                        }`}
                        title="نسخ التعليمات كاملة"
                      >
                        {copiedTooltipId === 'watermark' ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span>تم النسخ بنجاح!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ التعليمات</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTooltip(null)}
                        className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="إغلاق"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                    <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                      <strong className="text-pink-400 block mb-0.5 font-bold">📌 ما هي الوظيفة؟</strong>
                      تضمين علامة مائية ذكية ومتحركة فوق الهدية لحماية الهوية وحفظ الحقوق.
                    </p>

                    <div className="space-y-1.5 pt-0.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                        <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          عند التفعيل (فتح الزر):
                        </strong>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          دمج الشعار المتحرك مع الهدية مع التحكم في الحركة والموقع ونسبة الشفافية والانحناء.
                        </p>
                      </div>

                      <div className="bg-slate-800/60 border border-white/10 p-2.5 rounded-xl">
                        <strong className="text-slate-300 flex items-center gap-1.5 font-bold mb-1">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          عند التعطيل (قفل الزر):
                        </strong>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          تصدير الهدية بدون أي علامة مائية.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hidden file input for watermark image */}
              <input
                ref={watermarkInputRef}
                type="file"
                accept="image/*"
                onChange={handleWatermarkUpload}
                className="hidden"
              />

              {enableWatermark && (
                <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Upload or Selected Watermark Display */}
                  {watermarkUrl ? (
                    <div className="p-3.5 bg-pink-500/5 border border-pink-500/20 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                        {/* Square Watermark Thumbnail Preview */}
                        <div 
                          className="w-14 h-14 bg-black/40 border-2 border-pink-400/50 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0 relative"
                          style={{ borderRadius: `${Math.min(16, watermarkBorderRadius / 2)}px` }}
                        >
                          <img
                            src={watermarkUrl}
                            alt="Watermark Preview"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate" title={watermarkName}>
                            {watermarkName || 'علامة مائية مربعة'}
                          </p>
                          <p className="text-[10px] text-pink-300/80 font-medium">مربعة ومتحركة على الفيديو</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => watermarkInputRef.current?.click()}
                          className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[11px] font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5"
                        >
                          <RefreshCw className="w-3 h-3 text-pink-400" />
                          <span>تغيير الصورة</span>
                        </button>
                        <button
                          onClick={handleRemoveWatermark}
                          className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[11px] font-bold transition-all border border-red-500/20 flex items-center justify-center gap-1.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        onClick={() => watermarkInputRef.current?.click()}
                        className="w-full py-4 px-4 rounded-2xl border border-dashed border-pink-500/40 bg-pink-500/5 hover:bg-pink-500/10 cursor-pointer transition-all flex items-center justify-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-105 transition-all">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors">
                            رفع صورة العلامة المائية (PNG / SVG / JPG)
                          </p>
                          <p className="text-[10px] text-slate-400">ستظهر كعلامة مربعة متحركة على الفيديو</p>
                        </div>
                      </div>

                      <button
                        onClick={handleUseSampleWatermark}
                        className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        <span>استخدام شعار تجريبي جاهز (SVGA Studio)</span>
                      </button>
                    </div>
                  )}

                  {/* Motion Type Selection (نوع الحركة) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5 text-pink-400" />
                        نمط ونوع الحركة
                      </span>
                      <span className="text-[11px] text-pink-300 font-mono">
                        {watermarkMotionType === 'floating' ? 'طافي انسيابي' :
                         watermarkMotionType === 'bounce' ? 'ارتداد حواف' :
                         watermarkMotionType === 'orbit' ? 'مداري دائري' :
                         watermarkMotionType === 'diagonal' ? 'متأرجح قطري' :
                         watermarkMotionType === 'wave' ? 'موجي' : 'ثابت بدون حركة'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'floating', label: 'طافي انسيابي' },
                        { id: 'bounce', label: 'ارتداد الحواف' },
                        { id: 'orbit', label: 'مداري دائري' },
                        { id: 'diagonal', label: 'متأرجح قطري' },
                        { id: 'wave', label: 'مسار موجي' },
                        { id: 'static', label: 'ثابت بالزاوية' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setWatermarkMotionType(item.id as any)}
                          className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all border ${
                            watermarkMotionType === item.id
                              ? 'bg-pink-500/20 text-white border-pink-500/60 shadow-sm'
                              : 'bg-white/5 text-slate-400 hover:text-white border-white/5 hover:border-white/10'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Motion Amount / Range Slider (كمية ومدى الحركة) */}
                  {watermarkMotionType !== 'static' && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-pink-400" />
                          كمية ومدى الحركة
                        </span>
                        <span className="text-pink-300 font-mono font-bold">{watermarkMotionAmount}%</span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={watermarkMotionAmount}
                        onChange={(e) => setWatermarkMotionAmount(Number(e.target.value))}
                        className="w-full accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>حركة ضيقة (0%)</span>
                        <span>متوازنة (50%)</span>
                        <span>واسعة النطاق (100%)</span>
                      </div>
                    </div>
                  )}

                  {/* Watermark Size Slider (مقاس وحجم المربع) */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5 text-pink-400" />
                        مقاس وحجم العلامة المربعة
                      </span>
                      <span className="text-pink-300 font-mono font-bold">{watermarkSize}%</span>
                    </div>

                    <input
                      type="range"
                      min="8"
                      max="40"
                      value={watermarkSize}
                      onChange={(e) => setWatermarkSize(Number(e.target.value))}
                      className="w-full accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                      <span>صغيرة (8%)</span>
                      <span>متوسطة (18%)</span>
                      <span>كبيرة وبارزة (40%)</span>
                    </div>
                  </div>

                  {/* Watermark Speed Slider (سرعة الحركة) */}
                  {watermarkMotionType !== 'static' && (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-pink-400" />
                          سرعة الحركة
                        </span>
                        <span className="text-pink-300 font-mono font-bold">{watermarkSpeed.toFixed(1)}x</span>
                      </div>

                      <input
                        type="range"
                        min="0.3"
                        max="3.0"
                        step="0.1"
                        value={watermarkSpeed}
                        onChange={(e) => setWatermarkSpeed(Number(e.target.value))}
                        className="w-full accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>هادئة (0.3x)</span>
                        <span>عادية (1.0x)</span>
                        <span>سريعة (3.0x)</span>
                      </div>
                    </div>
                  )}

                  {/* Corner Radius & Opacity */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Corner Radius */}
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <Square className="w-3 h-3 text-pink-400" />
                          انحناء المربع
                        </span>
                        <span className="text-pink-300 font-mono text-[11px] font-bold">{watermarkBorderRadius}px</span>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="32"
                        value={watermarkBorderRadius}
                        onChange={(e) => setWatermarkBorderRadius(Number(e.target.value))}
                        className="w-full accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Opacity */}
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                        <span>الشفافية</span>
                        <span className="text-pink-300 font-mono text-[11px] font-bold">{watermarkOpacity}%</span>
                      </div>

                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                        className="w-full accent-pink-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Initial Position / Anchor */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-300 block">نقطة الارتكاز / موضع البداية</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'top-left', label: 'أعلى يسار' },
                        { id: 'top-right', label: 'أعلى يمين' },
                        { id: 'center', label: 'الوسط' },
                        { id: 'bottom-left', label: 'أسفل يسار' },
                        { id: 'bottom-right', label: 'أسفل يمين' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setWatermarkPosition(pos.id as any)}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                            watermarkPosition === pos.id
                              ? 'bg-pink-500/20 text-pink-300 border-pink-500/60'
                              : 'bg-white/5 text-slate-400 hover:text-white border-white/5 hover:border-white/10'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Border Frame Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                    <span className="text-xs font-bold text-slate-300">إطار خارجي وظل للمربع</span>
                    <button
                      onClick={() => setWatermarkBorder(!watermarkBorder)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${watermarkBorder ? 'bg-pink-500' : 'bg-slate-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${watermarkBorder ? 'left-0.5 translate-x-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Background Color Switcher (قلب ألوان الخلفية) */}
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  تبديل لون وخلفية العرض
                </span>
                <span className="text-[10px] text-indigo-400 font-bold">مباشر</span>
              </div>

              <div className="grid grid-cols-6 gap-2 mb-3">
                {presetColors.slice(0, 4).map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      if (preset.isChecker) {
                        setBgMode('checker');
                      } else {
                        setBgMode('color');
                        setBgColor(preset.value);
                      }
                    }}
                    title={preset.name}
                    className={`h-9 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden ${
                      (preset.isChecker && bgMode === 'checker') || (!preset.isChecker && bgMode === 'color' && bgColor.toLowerCase() === preset.value.toLowerCase())
                        ? 'border-indigo-400 ring-2 ring-indigo-500/40 scale-105 shadow-md'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{ backgroundColor: preset.isChecker ? '#1a1c23' : preset.value }}
                  >
                    {preset.isChecker && (
                      <div className="absolute inset-0 pattern-checkered opacity-60 pointer-events-none" />
                    )}
                    {((preset.isChecker && bgMode === 'checker') || (!preset.isChecker && bgMode === 'color' && bgColor.toLowerCase() === preset.value.toLowerCase())) && (
                      <Check className={`w-4 h-4 z-10 ${preset.value === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                    )}
                  </button>
                ))}
                
                {/* Custom Color Button */}
                <button
                  onClick={() => {
                    customColorInputRef.current?.click();
                    setBgMode('color');
                  }}
                  title="لون مخصص"
                  className={`h-9 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden bg-gradient-to-tr from-pink-500 via-indigo-500 to-emerald-400 ${
                    bgMode === 'color' && !presetColors.some(p => !p.isChecker && p.value.toLowerCase() === bgColor.toLowerCase())
                      ? 'border-white ring-2 ring-purple-500/50 scale-105'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-white drop-shadow" />
                  <input
                    ref={customColorInputRef}
                    type="color"
                    value={bgColor}
                    onChange={(e) => {
                      setBgColor(e.target.value);
                      setBgMode('color');
                    }}
                    className="opacity-0 absolute inset-0 cursor-pointer pointer-events-auto"
                  />
                </button>

                {/* Upload Custom Background Image Button */}
                <button
                  onClick={() => bgImageInputRef.current?.click()}
                  title="رفع صورة كخلفية"
                  className={`h-9 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden bg-white/5 ${
                    bgMode === 'image'
                      ? 'border-purple-400 ring-2 ring-purple-500/40 scale-105 shadow-md bg-purple-500/20'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <Upload className="w-4 h-4 text-purple-300" />
                  <input
                    ref={bgImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBgImageUpload}
                    className="hidden"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-white/2 px-3 py-1.5 rounded-lg border border-white/5">
                <span>الخلفية الحالية:</span>
                <span className="font-mono text-indigo-300 font-bold truncate max-w-[150px]">
                  {bgMode === 'checker' ? 'شبكة الشفافية' : bgMode === 'image' ? 'صورة مخصصة' : bgColor}
                </span>
              </div>
            </div>

            {/* 4. De-Blacking & Precision Alpha Settings (For SVGA & Processing) */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  معالجة الشفافية وإزالة السواد
                </span>
                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Clean Matte
                </span>
              </div>

              {/* Unmultiply Alpha Toggle (Eliminates Black Halo) */}
              <div className="relative">
                <div className="flex items-start justify-between p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 transition-all">
                  <div className="flex flex-col pr-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        إزالة الهالة السوداء (De-black Matte)
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTooltip(activeTooltip === 'deblack' ? null : 'deblack');
                        }}
                        className={`p-1 rounded-md border transition-all cursor-pointer ${
                          activeTooltip === 'deblack'
                            ? 'bg-indigo-500 text-white border-indigo-400'
                            : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 border-white/10'
                        }`}
                        title="عرض وشرح وظيفة إزالة الهالة السوداء"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={unmultiplyAlpha}
                      onChange={(e) => setUnmultiplyAlpha(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-indigo-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
                {activeTooltip === 'deblack' && (
                  <div 
                    className="mt-2 p-4 bg-[#111420] border border-indigo-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                    dir="rtl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h5 className="text-xs font-black text-white">دليل خيار: إزالة الهالة السوداء (De-black Matte)</h5>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const text = `📋 دليل وإرشادات: إزالة الهالة السوداء (De-black Matte)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
يقوم هذا الخيار بفصل وتطهير الألوان المدمجة مع الخلفية السوداء في ملف VAP الأصلي (Unmultiply Alpha).

• 🟢 عند التفعيل (فتح الخيار):
ستبدو أطراف الهدية (مثل الدخان، اللهب، النيون، أو التوهج الساطع) نظيفة جداً وخالية من السواد على أي لون خلفية (سواء كانت خلفية التطبيق بيضاء أو ملونة).

• ⚪ عند التعطيل (قفل الخيار):
قد تلاحظ ظهور حواف سوداء داكنة مزعجة أو "هالة سواد" حول العناصر المضيئة خاصة إذا تم تشغيل الهدية على خلفية فاتحة.`;
                            copyTooltipInstructions('deblack', text);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                            copiedTooltipId === 'deblack'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                              : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                          }`}
                          title="نسخ التعليمات كاملة"
                        >
                          {copiedTooltipId === 'deblack' ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>تم النسخ بنجاح!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ التعليمات</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTooltip(null)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="إغلاق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                      <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                        <strong className="text-indigo-400 block mb-0.5 font-bold">📌 ما هي الوظيفة؟</strong>
                        فصل وتنقية الألوان المتداخلة مع السواد في ملف VAP لضمان شفافية نقية.
                      </p>

                      <div className="space-y-1.5 pt-0.5">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                          <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            عند التفعيل (فتح الخيار):
                          </strong>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            أطراف الهدية (الدخان، التوهج، والشرر) تظهر نظيفة وشفافة تماماً فوق أي لون خلفية بدون سواد محيط.
                          </p>
                        </div>

                        <div className="bg-slate-800/60 border border-white/10 p-2.5 rounded-xl">
                          <strong className="text-slate-300 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            عند التعطيل (قفل الخيار):
                          </strong>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            قد تظهر هالة أو حافة سواد خفيفة حول العناصر المضيئة على الخلفيات الفاتحة.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Alpha Noise Threshold */}
              <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>تنقية غباش وضوضاء الشفافية</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === 'alphaThreshold' ? null : 'alphaThreshold');
                      }}
                      className={`p-1 rounded-md border transition-all cursor-pointer ${
                        activeTooltip === 'alphaThreshold'
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 border-white/10'
                      }`}
                      title="عرض وشرح مؤشر تنقية الشفافية"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-indigo-400 font-mono">{alphaThreshold}</span>
                </div>

                <input 
                  type="range" 
                  min="0" 
                  max="25" 
                  step="1"
                  value={alphaThreshold}
                  onChange={(e) => setAlphaThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>بدون فلترة (0)</span>
                  <span>متوازن ينظف السواد (8)</span>
                  <span>قوي (25)</span>
                </div>
                
                {activeTooltip === 'alphaThreshold' && (
                  <div 
                    className="mt-2 p-4 bg-[#111420] border border-indigo-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                    dir="rtl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <h5 className="text-xs font-black text-white">دليل مؤشر: تنقية غباش الشفافية</h5>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const text = `📋 دليل وإرشادات: تنقية غباش وضوضاء الشفافية (Alpha Noise Threshold)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
تصفية ومحو البيكسلات شبه الشفافة الداكنة التي تظهر كغباش أو ضبابية حول أطراف الهدية.

• 📈 عند رفع القيمة (قوي 15 - 25):
يقوم بمسح ومحو أي ضباب خفيف حول الهدية ويجعل الحواف حادة ونظيفة جداً. ممتاز لو الهدية بها شوائب سواد، ولكن قد يقلل من نعومة الدخان الخفيف جداً.

• 📉 عند خفض القيمة (بدون فلترة 0 - 5):
يحافظ على كافة تفاصيل التوهج والضباب الأصلية بالكامل.

• ⚖️ القيمة المتوازنة (8 إلى 12):
هي الأفضل والأكثر ملاءمة لـ 95% من الهدايا.`;
                            copyTooltipInstructions('alphaThreshold', text);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                            copiedTooltipId === 'alphaThreshold'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                              : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                          }`}
                          title="نسخ التعليمات كاملة"
                        >
                          {copiedTooltipId === 'alphaThreshold' ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>تم النسخ بنجاح!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ التعليمات</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTooltip(null)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="إغلاق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                      <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                        <strong className="text-indigo-400 block mb-0.5 font-bold">📌 ما هي الوظيفة؟</strong>
                        تصفية البيكسلات الباهتة المحيطة بالهدية لمنع ظهور أي غباش أو ضبابية غير مرغوبة.
                      </p>

                      <div className="space-y-1.5 pt-0.5">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                          <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            عند رفع القيمة (قوي):
                          </strong>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            حواف حادة ومسح كامل لأي ضباب أو شوائب سواد محيطة بالهدية.
                          </p>
                        </div>

                        <div className="bg-slate-800/60 border border-white/10 p-2.5 rounded-xl">
                          <strong className="text-slate-300 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            عند خفض القيمة (بدون فلترة):
                          </strong>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            الاحتفاظ بكافة تفاصيل التوهج والدخان الخفيف كما هي.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              
              {/* SVGA Image Format */}
              {exportTargetFormat === 'svga' && (
                <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 mt-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span>صيغة الصور داخل ملف SVGA</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setSvgaFormat('webp')} 
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${svgaFormat === 'webp' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}`}
                    >
                      WebP (خفيف جداً)
                    </button>
                    <button 
                      onClick={() => setSvgaFormat('png')} 
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${svgaFormat === 'png' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}`}
                    >
                      PNG (دقة قصوى)
                    </button>
                    <button 
                      onClick={() => setSvgaFormat('jpeg')} 
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${svgaFormat === 'jpeg' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}`}
                    >
                      JPEG (بدون شفافية)
                    </button>
                  </div>
                </div>
              )}

              {/* Compression Slider */}
              <div className="relative space-y-3 p-4 rounded-2xl bg-[#0f121a] border border-indigo-500/20 shadow-inner">
                <div className="flex justify-between items-center text-xs font-black">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>ضغط الملف (Compression)</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTooltip(activeTooltip === 'compression' ? null : 'compression');
                      }}
                      className={`p-1 rounded-md border transition-all cursor-pointer ${
                        activeTooltip === 'compression'
                          ? 'bg-indigo-500 text-white border-indigo-400'
                          : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 border-white/10'
                      }`}
                      title="عرض وشرح مؤشر ضغط الملف"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {compressionLevel}%
                  </span>
                </div>

                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1"
                  value={compressionLevel}
                  onChange={(e) => setCompressionLevel(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-2 bg-slate-800 rounded-lg cursor-pointer transition-all"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0% (الأصلي)</span>
                  <span>50% (متوازن)</span>
                  <span>100% (أقصى ضغط)</span>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {[
                    { label: 'بدون ضغط', val: 0 },
                    { label: 'خفيف', val: 25 },
                    { label: 'متوازن', val: 50 },
                    { label: 'قوي', val: 75 },
                    { label: 'أقصى ضغط', val: 100 }
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setCompressionLevel(p.val)}
                      className={`py-1 rounded-lg text-[9px] font-bold transition-all border ${
                        compressionLevel === p.val 
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/30' 
                          : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Live Estimated Size Indicator */}
                {fileSize && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      الحجم التقريبي المتوقع:
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {(() => {
                        const num = parseFloat(fileSize);
                        if (isNaN(num)) return fileSize;
                        const origP = (videoDimensions.width || 750) * (videoDimensions.height || 1334);
                        const curP = (customWidth || 750) * (customHeight || 1334);
                        const pRatio = Math.max(0.05, curP / (origP || 1));
                        const factor = (1 - (compressionLevel / 100) * 0.75) * pRatio;
                        const unit = fileSize.replace(/[0-9.]/g, '').trim() || 'MB';
                        return `~${(num * factor).toFixed(2)} ${unit}`;
                      })()}
                    </span>
                  </div>
                )}

                {activeTooltip === 'compression' && (
                  <div 
                    className="mt-2 p-4 bg-[#111420] border border-indigo-500/40 rounded-2xl shadow-2xl space-y-3 select-text cursor-text animate-in fade-in zoom-in duration-200"
                    dir="rtl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                        <h5 className="text-xs font-black text-white">دليل مؤشر: ضغط الملف (Compression)</h5>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const text = `📋 دليل وإرشادات: ضغط الملف (Compression)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• الوظيفة الأساسية:
التحكم الدقيق في نسبة ضغط وتقليص حجم الملف الناتج (من 0% إلى 100%) ليلائم متطلبات البث المباشر والهواتف المحمولة.

• 🟢 نسبة 0% (الأصلي بدون ضغط):
تصدير الملف بأقصى جودة خام وبدون أي تقليل للألوان أو معدل البت.

• 🔵 نسبة 25% - 50% (خفيف إلى متوازن - موصى به):
ضغط ذكي يخفض حجم الملف بنسبة 30% إلى 50% مع الحفاظ على وضوح فائق ونعومة كاملة للحركة.

• 🟣 نسبة 75% - 100% (أقصى ضغط):
تقليص فائق لحجم الملف ليصبح صغيراً جداً وسريع التحميل على أضعف شبكات الإنترنت وأجهزة الهواتف المحدودة.`;
                            copyTooltipInstructions('compression', text);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                            copiedTooltipId === 'compression'
                              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                              : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/10'
                          }`}
                          title="نسخ التعليمات كاملة"
                        >
                          {copiedTooltipId === 'compression' ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>تم النسخ بنجاح!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ التعليمات</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTooltip(null)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="إغلاق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                      <p className="bg-white/5 p-2.5 rounded-xl border border-white/5 text-slate-200">
                        <strong className="text-indigo-400 block mb-0.5 font-bold">📌 ما هي الوظيفة؟</strong>
                        التحكم في نسبة تصغير حجم الملف وتدفق البيانات مع الحفاظ على سلاسة الحركة ونقاء الشفافية.
                      </p>

                      <div className="space-y-1.5 pt-0.5">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                          <strong className="text-emerald-400 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            0% (بدون ضغط):
                          </strong>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            أعلى جودة ومطابقة تامة للملف الأصلي بدون أي تخفيض لمعدل البت.
                          </p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl">
                          <strong className="text-blue-400 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            25% – 50% (متوازن - موصى به):
                          </strong>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            يقلل حجم الملف بنسبة 30% إلى 50% مع الحفاظ التام على جمال ووضوح الهدية.
                          </p>
                        </div>

                        <div className="bg-purple-500/10 border border-purple-500/20 p-2.5 rounded-xl">
                          <strong className="text-purple-400 flex items-center gap-1.5 font-bold mb-1">
                            <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                            75% – 100% (أقصى ضغط):
                          </strong>
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            تقليص فائق لحجم الملف لتشغيل فوري بدون أي بطء على أضعف شبكات الإنترنت.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Dimensions, Resolution & File Size Scaling (أبعاد ومقاسات الهدية وحجم الملف) */}
            <div className="p-5 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  أبعاد ومقاسات الهدية (العرض والارتفاع)
                </span>
                {(() => {
                  const origP = (videoDimensions.width || 750) * (videoDimensions.height || 1334);
                  const curP = (customWidth || 750) * (customHeight || 1334);
                  const pRatio = curP / (origP || 1);
                  if (pRatio < 0.98) {
                    const savePct = Math.max(1, Math.min(99, Math.round((1 - pRatio) * 100)));
                    return (
                      <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        توفير ~{savePct}% من الحجم
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Width and Height Input Controls - Completely Independent */}
              <div className="grid grid-cols-2 gap-3 relative">
                {/* Width Input */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-[#0f121a] border border-white/5 focus-within:border-indigo-500/50 transition-all">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1 text-slate-400">العرض (Width)</span>
                    <span className="text-[10px] text-indigo-400 font-mono">px</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number"
                      min="16"
                      max="4096"
                      value={customWidth === 0 ? '' : customWidth}
                      onChange={(e) => handleWidthChange(e.target.value)}
                      onBlur={handleBlurWidth}
                      placeholder="العرض"
                      className="w-full bg-white/5 text-white font-mono font-bold text-sm px-2.5 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                </div>

                {/* Height Input */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-[#0f121a] border border-white/5 focus-within:border-indigo-500/50 transition-all">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1 text-slate-400">الارتفاع (Height)</span>
                    <span className="text-[10px] text-indigo-400 font-mono">px</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number"
                      min="16"
                      max="4096"
                      value={customHeight === 0 ? '' : customHeight}
                      onChange={(e) => handleHeightChange(e.target.value)}
                      onBlur={handleBlurHeight}
                      placeholder="الارتفاع"
                      className="w-full bg-white/5 text-white font-mono font-bold text-sm px-2.5 py-1.5 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Independent Note & Reset */}
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  تحكم حر ومنفصل تماماً لكل مقاس
                </span>

                {(customWidth !== videoDimensions.width || customHeight !== videoDimensions.height) && (
                  <button
                    onClick={handleResetDimensions}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>استعادة الأصل ({videoDimensions.width}×{videoDimensions.height})</span>
                  </button>
                )}
              </div>

              {/* Quick Scale Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>تغيير المقاس بنسب سريعة:</span>
                  <span className="font-mono text-indigo-400 text-xs">{customWidth} × {customHeight} px</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '100% (الأصل)', scale: 1.0 },
                    { label: '75% (متوسط)', scale: 0.75 },
                    { label: '50% (نصف الحجم)', scale: 0.5 },
                    { label: '33% (مصغر)', scale: 0.33 },
                  ].map((p) => {
                    const isCurrent = Math.round(videoDimensions.width * p.scale) === customWidth;
                    return (
                      <button
                        key={p.scale}
                        onClick={() => handlePresetScale(p.scale)}
                        className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border cursor-pointer ${
                          isCurrent 
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 scale-[1.02]' 
                            : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live File Size Reduction Alert Box */}
              {(() => {
                const origP = (videoDimensions.width || 750) * (videoDimensions.height || 1334);
                const curP = (customWidth || 750) * (customHeight || 1334);
                const pRatio = curP / (origP || 1);
                if (pRatio < 0.98) {
                  const savePct = Math.max(1, Math.min(99, Math.round((1 - pRatio) * 100)));
                  return (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold block">تم تقليص الأبعاد بنجاح!</span>
                          <span className="text-[10px] text-emerald-400/80">سيتم حفظ المقاسات الجديدة ({customWidth}×{customHeight}) وتقليل حجم الملف تلقائياً عند التصدير.</span>
                        </div>
                      </div>
                      <div className="text-left shrink-0 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                        <span className="block text-[9px] text-emerald-400 font-bold">توفير بالحجم</span>
                        <span className="text-xs font-mono font-black text-emerald-300">~{savePct}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* 5. Export Target Format Selector & Download Actions */}
            <div className="p-5 mt-auto bg-[#0C0E14] border-t border-white/5 space-y-4">
              {/* Format Switcher Tabs */}
              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                  اختر صيغة التصدير المستهدفة:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setExportTargetFormat('svga')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      exportTargetFormat === 'svga'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-white/2 hover:bg-white/5 text-slate-400 border-white/5'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>SVGA 2.0</span>
                  </button>

                  <button
                    onClick={() => setExportTargetFormat('vap')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      exportTargetFormat === 'vap'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20 scale-[1.02]'
                        : 'bg-white/2 hover:bg-white/5 text-slate-400 border-white/5'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>VAP (MP4)</span>
                  </button>

                  <button
                    onClick={() => setExportTargetFormat('mp4')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border ${
                      exportTargetFormat === 'mp4'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20 scale-[1.02]'
                        : 'bg-white/2 hover:bg-white/5 text-slate-400 border-white/5'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>MP4 بخلفية</span>
                  </button>
                </div>
              </div>

              {isExporting ? (
                <div className="space-y-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-white flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      جاري التصدير والمعالجة...
                    </span>
                    <span className="text-indigo-400 font-mono">{exportProgress}%</span>
                  </div>
                  
                  <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 via-pink-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 text-center font-medium truncate">{exportStatusText}</p>

                  <button
                    onClick={() => { cancelExportRef.current = true; }}
                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all border border-red-500/20"
                  >
                    إلغاء العملية
                  </button>
                </div>
              ) : exportSuccess && exportedBlob ? (
                <div className="space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم تصدير {exportTargetFormat.toUpperCase()} بنجاح!</span>
                    </div>
                    <span className="text-emerald-300 font-mono font-bold bg-black/40 px-2 py-0.5 rounded border border-white/5">
                      {exportedFileSize}
                    </span>
                  </div>

                  
            {exportStats && (
              <div className="mt-4 p-4 bg-[#0a0d14] rounded-xl border border-white/5 flex gap-4 text-center divide-x divide-white/10 flex-row-reverse">
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">الحجم الأصلي</span>
                    <span className="text-xs text-white font-mono font-bold">{(exportStats.original / 1024 / 1024).toFixed(2)} MB</span>
                 </div>
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">الحجم النهائي</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold">{(exportStats.compressed / 1024 / 1024).toFixed(2)} MB</span>
                 </div>
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">نسبة التوفير</span>
                    <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">{exportStats.savedPct}%</span>
                 </div>
              </div>
            )}

                  {!muteOriginalAudio && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-300 bg-pink-500/10 px-3 py-1.5 rounded-xl border border-pink-500/20">
                      <Music className="w-3.5 h-3.5 text-pink-400" />
                      <span>تم تضمين المسار الصوتي داخل الملف بنجاح!</span>
                    </div>
                  )}

                  {exportTargetFormat === 'svga' ? (
                    <button
                      onClick={handleDownloadSVGA}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      تحميل ملف SVGA {!muteOriginalAudio ? 'مع الصوت المدمج' : ''}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const blobToDownload = exportedBlob || preProcessedVapBlob;
                        if (!blobToDownload) return;
                        const baseName = fileName.replace(/\.[^/.]+$/, '');
                        const isVap = exportTargetFormat === 'vap';
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blobToDownload);
                        link.download = isVap ? `${baseName}_with_audio.vap` : `${baseName}.mp4`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 hover:from-indigo-400 hover:to-purple-400 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      تحميل ملف {exportTargetFormat.toUpperCase()} النهائي {!muteOriginalAudio ? 'مع الصوت المدمج' : ''}
                    </button>
                  )}

                  {exportTargetFormat === 'vap' && (
                    <button
                      onClick={handleDownloadVapZipPackage}
                      className="w-full py-2.5 bg-[#161924] hover:bg-[#1f2433] text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Package className="w-4 h-4 text-indigo-400" />
                      <span>تحميل حزمة VAP المتكاملة (ZIP) [MP4 + JSON + TXT]</span>
                    </button>
                  )}

                  <button
                    onClick={handleStartExport}
                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    إعادة التصدير بإعدادات أخرى
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> الحجم التقريبي المتوقع:</span>
                    <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-inner">
                      {estimateFileSize()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!fileUrl}
                      onClick={() => setShowLivePreview(true)}
                      className="flex-1 py-3.5 bg-[#141824] hover:bg-[#1a1f2e] text-white rounded-2xl font-black text-xs transition-all border border-white/10 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" />
                      معاينة الإخراج
                    </button>
                    <button
                      disabled={!fileUrl}
                      onClick={handleStartExport}
                      className={`flex-[2] py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                        fileUrl
                          ? exportTargetFormat === 'svga'
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/25 cursor-pointer hover:scale-[1.01]'
                            : exportTargetFormat === 'vap'
                            ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/25 cursor-pointer hover:scale-[1.01]'
                            : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/25 cursor-pointer hover:scale-[1.01]'
                          : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      {exportTargetFormat === 'svga' 
                        ? 'تصدير 2.0 SVGA نقي' 
                        : exportTargetFormat === 'vap' 
                        ? 'تصدير VAP مُعالج' 
                        : 'تصدير MP4 نقي'}
                    </button>
                  </div>
                </div>

              )}
            </div>
          </div>

          {/* Right Workspace Preview Area */}
          <div className="flex-1 bg-[#090A0F] relative flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="video/mp4" 
              onChange={handleFileSelect} 
            />

            {fileUrl ? (
              <>
              <div 
                ref={previewContainerRef}
                className="relative w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl transition-colors duration-300 select-none"
                style={{ 
                  backgroundColor: bgMode === 'color' ? bgColor : '#0E1017',
                  backgroundImage: bgMode === 'image' && bgImageUrl ? `url(${bgImageUrl})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Checkered Pattern for Transparent Checking */}
                {bgMode === 'checker' && (
                  <div className="absolute inset-0 pattern-checkered opacity-35 pointer-events-none" />
                )}

                {/* Live Animated Square Watermark Overlay Preview */}
                {enableWatermark && watermarkUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${previewWmCoords.x}px`,
                      top: `${previewWmCoords.y}px`,
                      width: `${previewWmCoords.side}px`,
                      height: `${previewWmCoords.side}px`,
                      opacity: watermarkOpacity / 100,
                      borderRadius: `${watermarkBorderRadius}px`,
                      border: watermarkBorder ? '2px solid rgba(255, 255, 255, 0.8)' : 'none',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                      zIndex: 25,
                      pointerEvents: 'none',
                      overflow: 'hidden',
                      transition: watermarkMotionType === 'static' ? 'all 0.15s ease-out' : 'none',
                    }}
                    className="flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
                  >
                    <img
                      src={watermarkUrl}
                      alt="Animated Square Watermark"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* View Switcher Bar (VAP Video vs Exported SVGA) */}
                {exportedBlob && exportTargetFormat === 'svga' && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 z-30 shadow-2xl">
                    <button
                      onClick={() => setActiveViewMode('vap')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeViewMode === 'vap' 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileVideo className="w-3.5 h-3.5" />
                      <span>فيديو VAP الأصلي</span>
                    </button>

                    <button
                      onClick={() => setActiveViewMode('svga')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeViewMode === 'svga' 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                      <span>معاينة SVGA المصدر النظيف</span>
                    </button>
                  </div>
                )}
                
                {/* 1. VAP Player Container (Strict 750x1334 High-Performance WebGL) */}
                <div 
                  id="anim-container" 
                  ref={containerRef}
                  style={{ display: activeViewMode === 'vap' ? 'flex' : 'none' }}
                  className="relative z-10 w-full h-full max-w-[460px] max-h-[820px] aspect-[750/1334] items-center justify-center p-2"
                >
                  <video
                    ref={workspaceVideoRef}
                    src={fileUrl}
                    playsInline
                    loop
                    muted
                    autoPlay
                    crossOrigin="anonymous"
                    className="hidden"
                  />
                  <canvas
                    ref={workspaceCanvasRef}
                    width={750}
                    height={1334}
                    className="w-full h-full object-contain rounded-2xl drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)] select-none cursor-pointer"
                    onClick={handleTogglePlay}
                  />
                  <style>{`
                    #anim-container canvas { 
                      max-width: 100% !important; 
                      max-height: 100% !important; 
                      object-fit: contain; 
                      border-radius: 1.25rem;
                      filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.35));
                    }
                  `}</style>
                </div>

                {/* 2. SVGA Exported Player Container */}
                <div 
                  ref={svgaContainerRef}
                  style={{ display: activeViewMode === 'svga' ? 'flex' : 'none' }}
                  className="relative z-10 w-full h-full max-w-[520px] max-h-[820px] items-center justify-center p-4"
                />

              </div>

              {/* Unified Playback Control Bar (Moved outside the canvas) */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#141824] px-6 py-4 rounded-[2rem] border border-white/5 shadow-xl transition-all w-full max-w-3xl">
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Play/Pause & Mute Controls */}
                  <button
                    onClick={handleTogglePlay}
                    className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 shadow-indigo-600/20"
                    title={isPlaying ? "إيقاف التشغيل" : "تشغيل"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                  </button>
                  
                  <button
                    onClick={handleTogglePlaybackMute}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border shadow-lg hover:scale-105 ${
                      isPlaybackMuted 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border-white/10'
                    }`}
                    title={isPlaybackMuted ? "إلغاء كتم الصوت أثناء العرض" : "كتم الصوت أثناء العرض"}
                  >
                    {isPlaybackMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>

                  <div className="hidden sm:block h-10 w-px bg-white/10 mx-1" />
                  
                  {/* Status Indicators */}
                  <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                    <span className={`w-2 h-2 rounded-full animate-pulse ${activeViewMode === 'vap' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                    <span className={`text-xs font-bold ${activeViewMode === 'vap' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                      {activeViewMode === 'vap' ? 'VAP Real-time' : 'SVGA Live'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-300 font-mono flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                      {customWidth} × {customHeight} px
                      {(customWidth !== videoDimensions.width || customHeight !== videoDimensions.height) && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">مخصص</span>
                      )}
                    </span>
                  </div>

                  {(audioUrl || muteOriginalAudio) && (
                    <div className="flex items-center gap-2 bg-[#0C0E14] px-4 py-2 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {isPlaybackMuted || (muteOriginalAudio && !audioUrl) ? (
                          <span className="text-amber-400 flex items-center gap-1.5"><VolumeX className="w-3.5 h-3.5" /> العرض صامت</span>
                        ) : audioUrl ? (
                          <span className="text-pink-400 flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5" /> الصوت مدمج ويعمل</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Download Gift Image Button (Red-circled spot) */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadGiftImage}
                    disabled={isCapturingSnapshot}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-lg active:scale-95 hover:scale-105 border cursor-pointer ${
                      snapshotSuccess 
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/30' 
                        : 'bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white border-white/20 shadow-pink-500/25'
                    }`}
                    title="تنزيل لقطة شفافة بدقة فائقة للهدية بصيغة PNG"
                  >
                    {isCapturingSnapshot ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>جاري الالتقاط...</span>
                      </>
                    ) : snapshotSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>تم تنزيل صورة الهدية!</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 text-pink-200" />
                        <span>تنزيل صورة للهدية</span>
                        <Download className="w-3.5 h-3.5 opacity-90" />
                      </>
                    )}
                  </button>
                </div>

              </div>
              </>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className="flex flex-col items-center text-center p-12 max-w-md cursor-pointer group"
              >
                <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-[2.5rem] flex items-center justify-center mb-6 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 group-hover:border-indigo-500/40 transition-all shadow-xl shadow-indigo-500/5">
                  <Upload className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">مساحة عمل VAP و SVGA الاحترافية</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                  اسحب وأفلت فيديو VAP (MP4) لمعاينة الشفافية، إضافة وتعديل أو حذف المسار الصوتي، والتصدير بصيغة VAP (MP4) أو SVGA 2.0.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20">
                    <Film className="w-3.5 h-3.5" />
                    <span>تصدير VAP (MP4) مع VAPC Box</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>إزالة الهالات وتصدير SVGA</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-pink-400 bg-pink-500/10 px-3 py-1.5 rounded-xl border border-pink-500/20">
                    <Music className="w-3.5 h-3.5" />
                    <span>إضافة ودمج وإزالة الصوت</span>
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Live Preview Modal */}
      {showLivePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0C0E14] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#141824]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm">معاينة الإخراج النهائي</h3>
                  <p className="text-slate-400 text-[11px] font-medium mt-0.5">شكل الملف النهائي مع تأثيراتك</p>
                </div>
              </div>
              <button onClick={() => setShowLivePreview(false)} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzIyMiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPC9zdmc+')]">
              <canvas 
                ref={previewCanvasRef} 
                className="max-h-[500px] max-w-full rounded-lg shadow-2xl border border-white/20"
                style={{ 
                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(99, 102, 241, 0.15)'
                }}
              />
              <p className="absolute bottom-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white/80 border border-white/10 shadow-lg">
                معاينة تقريبية (يتم تحديث الإطار الأول)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VAP Professional Audio Editor Modal (مطابق للفيديو) */}
      <AudioEditorModal
        isOpen={isAudioEditorModalOpen}
        onClose={() => setIsAudioEditorModalOpen(false)}
        audioUrl={audioUrl}
        audioFile={audioFile}
        volume={audioVolume}
        onVolumeChange={handleVolumeChange}
        onReplace={(newF) => {
          setAudioFile(newF);
          setAudioName(newF.name);
          setAudioSize((newF.size / 1024).toFixed(0) + ' KB');
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          const freshU = URL.createObjectURL(newF);
          setAudioUrl(freshU);
        }}
        onRemove={handleRemoveAudio}
        onKeep={() => setIsAudioEditorModalOpen(false)}
        onExecute={handleExecuteAudioModal}
        isProcessing={isProcessingAudio}
      />
    </div>
  );
};
