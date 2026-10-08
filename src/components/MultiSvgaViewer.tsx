import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, Play, Pause, RotateCcw, Trash2, Maximize2, Info, Upload, FolderUp, X, Download, 
  Image as ImageIcon, ShieldCheck, Shield, ShieldAlert, Scroll, Monitor, Smartphone, Loader2, Camera, Video, Film, FileVideo, 
  Volume2, Music, SquareCheck, Gift, Sparkles, FileText, Lock, Unlock, Key, Square, CheckSquare, 
  Check, SlidersHorizontal, Sliders, Clock, Plus, Minus, Zap, Archive, FileCode, CheckCircle2, Globe,
  Grid, LayoutGrid, Type, Palette, RotateCw, RefreshCw, Pin, Bookmark, Star, FastForward
} from 'lucide-react';
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
import { isSvgaContent, detectIsSvga, ensureSvgaFile } from '../utils/svgaUniversalEngine';
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
import { 
  exportAsVap, 
  exportAsYyeva, 
  exportAsGif, 
  exportAsWebp, 
  exportAsApng, 
  exportAsPngFramesZip 
} from './AnimationManager/utils/exportEngine';

export type ViewerExportFormat = 'mp4' | 'webm' | 'vap' | 'yyeva' | 'gif' | 'webp' | 'apng' | 'png_seq' | 'svga';
import { downloadDesignerInfoFile } from '../utils/designerInfo';
import { drawUniversalWatermarkOnCanvas, getSavedWatermarkSettings } from '../utils/watermarkAndBackground';
import { extractSvgaFromPdfFile, PdfUnlockRequest } from '../utils/pdfSvgaExtractor';
import { generateSvgaAllInOnePdf, SvgaPdfItem } from '../utils/svgaAllInOnePdfGenerator';
import { SvgaActionDock } from './SvgaActionDock';
import { VideoDurationSpeedModal } from './VideoDurationSpeedModal';
import { MultiSvgaWatermarkModal } from './MultiSvgaWatermarkModal';
import { AeExportModal } from './AeExportModal';

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

export type ViewerWatermarkPattern = 
  | 'smooth_right_glide' 
  | 'wave_3d' 
  | 'diagonal_repeat' 
  | 'horizontal_bands' 
  | 'floating' 
  | 'circular_orbit' 
  | 'cube_rotation' 
  | 'pulse' 
  | 'single_position' 
  | 'custom_drag';

export type ViewerWatermarkShape = 
  | 'pill' 
  | 'glass_card' 
  | 'neon_glow' 
  | 'futuristic_hud' 
  | 'stamp_seal' 
  | 'ribbon_badge' 
  | 'golden_vip' 
  | 'minimal_clean';

export type ViewerWatermarkType = 'text' | 'image' | 'both';
export type ViewerWatermarkPosition = 
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' 
  | 'top-center' | 'bottom-center' | 'center-left' | 'center-right';

export interface ViewerWatermarkSettings {
  enabled: boolean;
  type: ViewerWatermarkType;
  text: string;
  logoUrl?: string | null;
  pattern: ViewerWatermarkPattern;
  shape?: ViewerWatermarkShape;
  position: ViewerWatermarkPosition;
  customX?: number; // 0 to 100 percentage
  customY?: number; // 0 to 100 percentage
  opacity: number;
  fontSize: number;
  color: string;
  angle: number;
  spacingX: number;
  spacingY: number;
  shadow: boolean;
  isAnimated?: boolean;
  animationSpeed?: number;
  speed?: number;
  animationType?: 'drift' | 'floating' | 'marquee' | 'pulse' | 'orbit' | 'wave_3d' | 'smooth_right_glide';
  [key: string]: any;
}

const WatermarkOverlay: React.FC<{
  watermark?: string | null;
  settings: any;
  onUpdateSettings?: (newSettings: Partial<ViewerWatermarkSettings>) => void;
  onOpenModal?: () => void;
}> = ({ watermark, settings, onUpdateSettings, onOpenModal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const isEnabled = settings?.enabled !== false && (settings?.enabled || watermark || (settings?.text && settings.text.trim().length > 0));
  if (!isEnabled) return null;

  const pattern: ViewerWatermarkPattern = settings?.pattern || 'smooth_right_glide';
  const shape: ViewerWatermarkShape = settings?.shape || 'pill';
  const type: ViewerWatermarkType = settings?.type || (watermark ? (settings?.text ? 'both' : 'image') : 'text');
  const color = settings?.color || '#ffffff';
  const text = settings?.text || 'Ahmed SVGA • Ahmed SVGA';
  const opacity = settings?.opacity !== undefined ? settings.opacity : 0.45;
  const angle = settings?.angle !== undefined ? settings.angle : -25;
  const logoSrc = settings?.logoUrl || watermark || null;
  const hasText = (type === 'text' || type === 'both') && !!text.trim();
  const hasLogo = (type === 'image' || type === 'both') && !!logoSrc;
  const isAnimated = settings?.isAnimated !== false;
  const animSpeed = settings?.animationSpeed || settings?.speed || 4;
  const driftDuration = Math.max(1.8, 16 - animSpeed * 1.3);

  // Drag and Drop support
  const handleDragStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    setIsDragging(true);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const pctX = Math.max(5, Math.min(95, ((curX - rect.left) / rect.width) * 100));
      const pctY = Math.max(5, Math.min(95, ((curY - rect.top) / rect.height) * 100));

      if (onUpdateSettings) {
        onUpdateSettings({
          pattern: 'custom_drag',
          customX: Math.round(pctX),
          customY: Math.round(pctY)
        });
      }
    };

    const onEnd = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  // Speed Adjustment
  const adjustSpeed = (delta: number) => {
    if (!onUpdateSettings) return;
    const current = settings?.animationSpeed || 4;
    const next = Math.max(1, Math.min(10, current + delta));
    onUpdateSettings({ animationSpeed: next, speed: next });
  };

  const setSpeedPreset = (val: number) => {
    if (!onUpdateSettings) return;
    onUpdateSettings({ animationSpeed: val, speed: val });
  };

  // Floating bounce animation loop
  useEffect(() => {
    if (pattern !== 'floating' || !containerRef.current || !badgeRef.current || !isAnimated) return;

    let animationFrameId: number;
    let startTime: number | null = null;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const frame = Math.floor((elapsed / 1000) * 30);

      const container = containerRef.current;
      const badge = badgeRef.current;
      if (!container || !badge) return;

      const badgeW = badge.offsetWidth || 140;
      const badgeH = badge.offsetHeight || 34;
      const speed = settings?.animationSpeed || 4;
      const pxPerFrame = speed * 1.1;

      const maxX = Math.max(1, container.clientWidth - badgeW);
      const maxY = Math.max(1, container.clientHeight - badgeH);

      if (maxX > 0 && maxY > 0) {
        const distX = frame * pxPerFrame;
        const distY = frame * pxPerFrame * 0.7;

        const modX = distX % (maxX * 2);
        const modY = distY % (maxY * 2);

        const x = modX > maxX ? (maxX * 2) - modX : modX;
        const y = modY > maxY ? (maxY * 2) - modY : modY;

        badge.style.transform = `translate(${x}px, ${y}px)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isEnabled, pattern, isAnimated, settings?.animationSpeed]);

  const getShapeStyle = (): { className: string; style?: React.CSSProperties } => {
    switch (shape) {
      case 'glass_card':
        return {
          className: 'px-4 py-2 rounded-2xl backdrop-blur-xl border font-black text-xs shadow-2xl transition-all',
          style: {
            backgroundColor: 'rgba(6, 10, 24, 0.82)',
            borderColor: 'rgba(255, 255, 255, 0.22)',
            color,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
          }
        };
      case 'neon_glow':
        return {
          className: 'px-4 py-2 rounded-2xl border-2 font-black text-xs transition-all',
          style: {
            backgroundColor: 'rgba(3, 7, 18, 0.92)',
            borderColor: color,
            color,
            boxShadow: `0 0 25px ${color}80, inset 0 0 10px ${color}30`
          }
        };
      case 'futuristic_hud':
        return {
          className: 'px-4 py-2 rounded-lg border-x-4 border-y font-mono font-black text-xs tracking-widest transition-all',
          style: {
            backgroundColor: 'rgba(5, 8, 20, 0.92)',
            borderColor: color,
            color,
            boxShadow: `0 0 20px ${color}40`
          }
        };
      case 'stamp_seal':
        return {
          className: 'px-4 py-2 rounded-full border-2 border-dashed font-black text-xs -rotate-3 transition-all',
          style: {
            backgroundColor: 'rgba(20, 10, 5, 0.92)',
            borderColor: color,
            color,
            boxShadow: `0 0 20px ${color}40`
          }
        };
      case 'ribbon_badge':
        return {
          className: 'px-4 py-2 rounded-lg border-r-4 border-l border-y font-black text-xs transition-all',
          style: {
            backgroundColor: 'rgba(15, 10, 30, 0.92)',
            borderColor: color,
            color,
            boxShadow: `0 0 20px ${color}40`
          }
        };
      case 'golden_vip':
        return {
          className: 'px-4 py-2 rounded-2xl border font-black text-xs transition-all',
          style: {
            background: 'linear-gradient(135deg, rgba(30,20,5,0.95), rgba(10,5,0,0.95))',
            borderColor: '#f59e0b',
            color: '#fef08a',
            boxShadow: '0 0 25px rgba(245,158,11,0.45)'
          }
        };
      case 'minimal_clean':
        return {
          className: 'p-1 font-black text-xs transition-all',
          style: {
            color,
            textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)'
          }
        };
      case 'pill':
      default:
        return {
          className: 'flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-2xl font-black text-xs tracking-wide transition-all',
          style: {
            backgroundColor: 'rgba(5, 8, 18, 0.88)',
            borderColor: `${color}50`,
            color,
            boxShadow: `0 0 20px ${color}35`
          }
        };
    }
  };

  const shapeConfig = getShapeStyle();

  const renderBadgeContent = (extraClass = '') => (
    <span className={`inline-flex items-center gap-1.5 select-none ${extraClass}`}>
      {hasLogo && logoSrc && (
        <img src={logoSrc} className="w-4 h-4 sm:w-5 sm:h-5 object-contain inline shrink-0 drop-shadow" alt="" />
      )}
      {hasText && (
        <span 
          style={{ 
            color,
            textShadow: settings?.shadow !== false ? '0 2px 4px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.7)' : 'none'
          }}
        >
          {text}
        </span>
      )}
    </span>
  );

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-40"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <style>{`
        @keyframes wmPulseAnim {
          0%, 100% { transform: scale(0.95); opacity: ${Math.max(0.2, opacity * 0.8)}; }
          50% { transform: scale(1.06); opacity: ${opacity}; filter: drop-shadow(0 0 14px ${color}80); }
        }
        @keyframes wmGridDrift {
          0% { transform: rotate(${angle}deg) translate(0px, 0px); }
          50% { transform: rotate(${angle}deg) translate(-70px, -45px) scale(1.02); }
          100% { transform: rotate(${angle}deg) translate(-140px, -90px); }
        }
        @keyframes wmMarqueeFlow {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes wmSmoothRightGlide {
          0% { 
            transform: translateX(110%) translateY(0px) rotateY(-15deg) rotateZ(-2deg); 
            opacity: 0.2;
          }
          15% {
            opacity: ${opacity};
          }
          50% {
            transform: translateX(0%) translateY(-15px) rotateY(0deg) rotateZ(0deg);
            opacity: ${opacity};
          }
          85% {
            opacity: ${opacity};
          }
          100% { 
            transform: translateX(-110%) translateY(10px) rotateY(15deg) rotateZ(2deg); 
            opacity: 0.2;
          }
        }
        @keyframes wmWave3DLoop {
          0% { transform: translateX(120%) translateY(20px) scale(0.85) rotate(-4deg); }
          50% { transform: translateX(0%) translateY(-25px) scale(1.1) rotate(2deg); }
          100% { transform: translateX(-120%) translateY(20px) scale(0.85) rotate(-4deg); }
        }
        @keyframes wmOrbit3DLoop {
          0% { transform: translate(-50%, -50%) rotate(0deg) translateX(120px) rotate(0deg) scale(0.85); }
          50% { transform: translate(-50%, -50%) rotate(180deg) translateX(120px) rotate(-180deg) scale(1.15); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(120px) rotate(-360deg) scale(0.85); }
        }
        @keyframes wmCubeRotateLoop {
          0% { transform: translate(-50%, -50%) rotateY(0deg) rotateX(0deg); }
          50% { transform: translate(-50%, -50%) rotateY(180deg) rotateX(20deg) scale(1.08); }
          100% { transform: translate(-50%, -50%) rotateY(360deg) rotateX(0deg); }
        }
      `}</style>

      {/* Floating Speed & Mode Control Pill on Hover */}
      {onUpdateSettings && (
        <div 
          className={`absolute top-2 right-2 pointer-events-auto z-50 flex items-center gap-1.5 p-1.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-cyan-500/40 shadow-2xl transition-all duration-200 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
          dir="rtl"
        >
          <span className="text-[10px] font-bold text-slate-300 pr-1 flex items-center gap-1">
            ⚡ السرعة:
          </span>
          <button
            type="button"
            onClick={() => adjustSpeed(-1)}
            className="w-5 h-5 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 font-bold text-xs transition-all cursor-pointer"
            title="تبطيء السرعة 🐢"
          >
            -
          </button>
          <span className="text-[10px] font-mono font-black text-cyan-400 px-1">
            {animSpeed}x
          </span>
          <button
            type="button"
            onClick={() => adjustSpeed(1)}
            className="w-5 h-5 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 font-bold text-xs transition-all cursor-pointer"
            title="تسريع السرعة 🚀"
          >
            +
          </button>

          <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

          {/* Quick Speed Presets */}
          <button
            type="button"
            onClick={() => setSpeedPreset(2)}
            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold transition-all ${animSpeed <= 2 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
          >
            بطيء 🐢
          </button>
          <button
            type="button"
            onClick={() => setSpeedPreset(4)}
            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold transition-all ${animSpeed > 2 && animSpeed <= 5 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
          >
            عادي ⚡
          </button>
          <button
            type="button"
            onClick={() => setSpeedPreset(8)}
            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold transition-all ${animSpeed > 5 ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'}`}
          >
            سريع 🚀
          </button>

          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
              className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold ml-0.5"
              title="تخصيص كامل للأشكال والأنماط"
            >
              ⚙️
            </button>
          )}
        </div>
      )}

      {/* 1. Smooth Right 3D Glide Pattern (حركة انسيابية ثلاثية الأبعاد من اليمين) */}
      {pattern === 'smooth_right_glide' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity }}
        >
          <div 
            className="will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{
              animation: isAnimated ? `wmSmoothRightGlide ${driftDuration}s ease-in-out infinite` : 'none',
              perspective: '800px'
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
            title="انزلاق سلس ثلاثي الأبعاد من اليمين • يمكنك السحب والإفلات لتحديد موضع مخصص"
          >
            <div className={shapeConfig.className} style={shapeConfig.style}>
              {renderBadgeContent()}
            </div>
          </div>
        </div>
      )}

      {/* 2. Wave 3D Sweep Pattern */}
      {pattern === 'wave_3d' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity }}
        >
          <div 
            className="will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{
              animation: isAnimated ? `wmWave3DLoop ${driftDuration * 1.2}s ease-in-out infinite` : 'none',
              perspective: '1000px'
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            <div className={shapeConfig.className} style={shapeConfig.style}>
              {renderBadgeContent()}
            </div>
          </div>
        </div>
      )}

      {/* 3. Circular Orbit 3D Pattern */}
      {pattern === 'circular_orbit' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity }}
        >
          <div 
            className="absolute top-1/2 left-1/2 will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{
              animation: isAnimated ? `wmOrbit3DLoop ${driftDuration * 1.4}s linear infinite` : 'none',
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            <div className={shapeConfig.className} style={shapeConfig.style}>
              {renderBadgeContent()}
            </div>
          </div>
        </div>
      )}

      {/* 4. Cube Rotation 3D Pattern */}
      {pattern === 'cube_rotation' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity }}
        >
          <div 
            className="absolute top-1/2 left-1/2 will-change-transform pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{
              animation: isAnimated ? `wmCubeRotateLoop ${driftDuration * 1.5}s ease-in-out infinite` : 'none',
              transformStyle: 'preserve-3d',
              perspective: '800px'
            }}
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          >
            <div className={shapeConfig.className} style={shapeConfig.style}>
              {renderBadgeContent()}
            </div>
          </div>
        </div>
      )}

      {/* 5. Custom Draggable Position (السحب والإفلات الحر) */}
      {pattern === 'custom_drag' && (
        <div 
          className="absolute pointer-events-auto cursor-grab active:cursor-grabbing will-change-transform z-40 transition-transform hover:scale-105"
          style={{
            left: `${settings?.customX !== undefined ? settings.customX : 75}%`,
            top: `${settings?.customY !== undefined ? settings.customY : 80}%`,
            transform: 'translate(-50%, -50%)',
            opacity
          }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          title="موضع حر (اسحب للإفلات في أي مكان على الشاشة 🎯)"
        >
          <div className={shapeConfig.className} style={shapeConfig.style}>
            {renderBadgeContent()}
          </div>
        </div>
      )}

      {/* 6. Diagonal Repeat Pattern */}
      {pattern === 'diagonal_repeat' && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
          style={{ opacity }}
        >
          <div 
            className="w-[320%] h-[320%] -translate-x-[40%] -translate-y-[40%] flex flex-col justify-around select-none pointer-events-none will-change-transform"
            style={{ 
              transform: `rotate(${angle}deg)`,
              animation: isAnimated ? `wmGridDrift ${driftDuration}s linear infinite alternate` : 'none'
            }}
          >
            {Array.from({ length: 11 }).map((_, rowIdx) => (
              <div 
                key={rowIdx} 
                className="flex justify-around whitespace-nowrap text-xs sm:text-sm font-black tracking-wider"
                style={{ 
                  transform: rowIdx % 2 === 1 ? 'translateX(55px)' : 'none'
                }}
              >
                {Array.from({ length: 8 }).map((_, colIdx) => (
                  <span key={colIdx} className="px-5 py-2.5 inline-flex items-center gap-2 opacity-95">
                    {renderBadgeContent()}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Horizontal Bands Pattern */}
      {pattern === 'horizontal_bands' && (
        <div 
          className="absolute inset-0 flex flex-col justify-around pointer-events-none overflow-hidden py-3"
          style={{ opacity }}
        >
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div 
              key={rowIdx} 
              className="flex justify-around whitespace-nowrap text-xs font-black tracking-wider py-1 border-y border-white/5 bg-black/10 backdrop-blur-[1px] will-change-transform"
              style={{
                animation: isAnimated ? `wmMarqueeFlow ${driftDuration * 0.7}s linear infinite` : 'none'
              }}
            >
              {Array.from({ length: 8 }).map((_, colIdx) => (
                <span key={colIdx} className="px-4 inline-flex items-center gap-1.5">
                  {renderBadgeContent()}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 8. Floating Bouncing Badge */}
      {pattern === 'floating' && (
        <div
          ref={badgeRef}
          className="absolute top-2 left-2 pointer-events-auto cursor-grab active:cursor-grabbing will-change-transform"
          style={{ opacity }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          title="عائم متحرك (اسحب لتغيير الموضع)"
        >
          <div className={shapeConfig.className} style={shapeConfig.style}>
            {renderBadgeContent()}
          </div>
        </div>
      )}

      {/* 9. Pulsing Corner Badge */}
      {pattern === 'pulse' && (
        <div 
          className="absolute bottom-3 right-3 pointer-events-auto cursor-grab active:cursor-grabbing"
          style={{ animation: isAnimated ? 'wmPulseAnim 2.2s ease-in-out infinite' : 'none', opacity }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        >
          <div className={shapeConfig.className} style={shapeConfig.style}>
            {renderBadgeContent()}
          </div>
        </div>
      )}

      {/* 10. Single Fixed Position */}
      {pattern === 'single_position' && (
        <div 
          className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing p-3 flex ${
            settings?.position === 'top-left' ? 'top-2 left-2' :
            settings?.position === 'top-center' ? 'top-2 left-1/2 -translate-x-1/2' :
            settings?.position === 'top-right' ? 'top-2 right-2' :
            settings?.position === 'center-left' ? 'top-1/2 left-2 -translate-y-1/2' :
            settings?.position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
            settings?.position === 'center-right' ? 'top-1/2 right-2 -translate-y-1/2' :
            settings?.position === 'bottom-left' ? 'bottom-2 left-2' :
            settings?.position === 'bottom-center' ? 'bottom-2 left-1/2 -translate-x-1/2' :
            'bottom-2 right-2'
          }`}
          style={{ opacity }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
          title="موضع ثابت (يمكنك سحب العلامة وإفلاتها لتغيير مكانها بحرية)"
        >
          <div className={shapeConfig.className} style={shapeConfig.style}>
            {renderBadgeContent()}
          </div>
        </div>
      )}
    </div>
  );
};

const drawWatermarkOnCanvasHelper = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  settings: any,
  wmImg?: HTMLImageElement | null
) => {
  const activeSettings = settings || getSavedWatermarkSettings();
  drawUniversalWatermarkOnCanvas(ctx, width, height, frame, activeSettings, wmImg);
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
  const [exportFormat, setExportFormat] = useState<ViewerExportFormat>('mp4');
  const [presetBgs, setPresetBgs] = useState<PresetBackground[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [loadProgress, setLoadProgress] = useState<{current: number, total: number} | null>(null);
  const isCanceled = useRef(false);
  const [useNativeDuration, setUseNativeDuration] = useState(true);
  const [exportDuration, setExportDuration] = useState(10);
  const [showDurationSpeedModal, setShowDurationSpeedModal] = useState(false);
  const [gridCols, setGridCols] = useState(4);
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
  const [pdfOptionSingle, setPdfOptionSingle] = useState(true);
  const [pdfOptionCatalog, setPdfOptionCatalog] = useState(false);
  const [isExportingCustomPdf, setIsExportingCustomPdf] = useState(false);
  const [isPdfAllInOneExporting, setIsPdfAllInOneExporting] = useState(false);
  const [pdfAllInOneProgress, setPdfAllInOneProgress] = useState(0);
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const preventDuplicatesRef = useRef(true);
  const [pageSize, setPageSize] = useState<number>(36);
  const [currentPage, setCurrentPage] = useState<number>(1);
  useEffect(() => {
    preventDuplicatesRef.current = preventDuplicates;
  }, [preventDuplicates]);
  const [dedupNotice, setDedupNotice] = useState<{ count: number; names: string[] } | null>(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(true);
  const [showSideDock, setShowSideDock] = useState(false);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [isAeExportModalOpen, setIsAeExportModalOpen] = useState(false);
  const [aeExportItem, setAeExportItem] = useState<MultiSvgaItem | null>(null);

  const handleOpenAeExportModal = useCallback((item?: MultiSvgaItem) => {
    const target = item || (selectedItemId ? items.find(i => i.id === selectedItemId) : items[0]);
    if (!target) {
      alert('يرجى اختيار أو رفع ملف SVGA أولاً لتصديره ونقله إلى After Effects.');
      return;
    }
    setAeExportItem(target);
    setIsAeExportModalOpen(true);
  }, [selectedItemId, items]);

  useEffect(() => {
    (window as any).handleOpenAeExportModal = handleOpenAeExportModal;
    return () => {
      try {
        delete (window as any).handleOpenAeExportModal;
      } catch(e){}
    };
  }, [handleOpenAeExportModal]);
  
  // Use a ref to pass to child components to avoid unnecessary re-renders
  const globalPausedRef = useRef(false);
  useEffect(() => {
    globalPausedRef.current = globalPaused;
  }, [globalPaused]);

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

  const [pinnedName, setPinnedName] = useState<string>(() => {
    try {
      return localStorage.getItem('svga_permanent_watermark_text') || 'Ahmed SVGA • Ahmed SVGA';
    } catch (e) {
      return 'Ahmed SVGA • Ahmed SVGA';
    }
  });

  const [savedPresets, setSavedPresets] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('svga_saved_watermark_presets');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return ['Ahmed SVGA • Ahmed SVGA', '🔒 محتوى محمي - يمنع السرقة', 'SVGA AHMED STUDIO'];
  });

  const [pinnedNotice, setPinnedNotice] = useState<string | null>(null);

  const [wmSettings, setWmSettings] = useState<ViewerWatermarkSettings>(() => {
    try {
      const savedText = localStorage.getItem('svga_permanent_watermark_text');
      const savedRaw = localStorage.getItem('svga_watermark_settings');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        return {
          ...parsed,
          text: savedText || parsed.text || 'Ahmed SVGA • Ahmed SVGA',
          isAnimated: parsed.isAnimated !== undefined ? parsed.isAnimated : true,
          animationSpeed: parsed.animationSpeed || 5
        };
      }
      if (savedText) {
        return {
          enabled: true,
          type: 'text',
          text: savedText,
          logoUrl: null,
          pattern: 'diagonal_repeat',
          position: 'bottom-right',
          opacity: 0.35,
          fontSize: 22,
          color: '#ffffff',
          angle: -25,
          spacingX: 200,
          spacingY: 120,
          shadow: true,
          isAnimated: true,
          animationSpeed: 5
        };
      }
    } catch (e) {}
    return {
      enabled: true,
      type: 'text',
      text: 'Ahmed SVGA • Ahmed SVGA',
      logoUrl: null,
      pattern: 'diagonal_repeat',
      position: 'bottom-right',
      opacity: 0.35,
      fontSize: 22,
      color: '#ffffff',
      angle: -25,
      spacingX: 200,
      spacingY: 120,
      shadow: true,
      isAnimated: true,
      animationSpeed: 5
    };
  });

  // Guarantee permanent localStorage synchronization on every wmSettings change
  useEffect(() => {
    try {
      localStorage.setItem('svga_watermark_settings', JSON.stringify(wmSettings));
      if (wmSettings.text && wmSettings.text.trim()) {
        localStorage.setItem('svga_permanent_watermark_text', wmSettings.text.trim());
      }
    } catch (e) {}
  }, [wmSettings]);

  const updateAndSaveWmSettings = (updater: ViewerWatermarkSettings | ((prev: ViewerWatermarkSettings) => ViewerWatermarkSettings)) => {
    setWmSettings(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('svga_watermark_settings', JSON.stringify(next));
        if (next.text && next.text.trim()) {
          localStorage.setItem('svga_permanent_watermark_text', next.text.trim());
        }
      } catch (e) {}
      return next;
    });
  };

  const pinAsPermanentDefault = (textToPin?: string) => {
    const text = (textToPin !== undefined ? textToPin : wmSettings.text).trim();
    if (!text) return;
    try {
      localStorage.setItem('svga_permanent_watermark_text', text);
      setPinnedName(text);
      updateAndSaveWmSettings(prev => ({ ...prev, text }));
      setPinnedNotice(`✓ تم تثبيت "${text}" كاسم دائم لك بنجاح! سيتم اعتماده تلقائياً كل مرة.`);
      setTimeout(() => setPinnedNotice(null), 4500);
    } catch (e) {
      console.error(e);
    }
  };

  const addCustomPreset = (nameToAdd: string) => {
    const text = nameToAdd.trim();
    if (!text || savedPresets.includes(text)) return;
    const updated = [text, ...savedPresets].slice(0, 10);
    setSavedPresets(updated);
    try {
      localStorage.setItem('svga_saved_watermark_presets', JSON.stringify(updated));
      setPinnedNotice(`✓ تمت إضافة "${text}" إلى قائمة أسمائك السريعة`);
      setTimeout(() => setPinnedNotice(null), 3000);
    } catch (e) {}
  };

  const removeCustomPreset = (nameToRemove: string) => {
    const updated = savedPresets.filter(p => p !== nameToRemove);
    setSavedPresets(updated);
    try {
      localStorage.setItem('svga_saved_watermark_presets', JSON.stringify(updated));
    } catch (e) {}
  };

  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
  const [groupFolders, setGroupFolders] = useState<boolean>(false);

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

      // Check if file is SVGA directly (from internal binary content regardless of name)
      const isDirectSvga = Boolean((item.file as any).__isSvga) || (await isSvgaContent(item.file));
      if (isDirectSvga) {
        const { file: norm } = await ensureSvgaFile(item.file);
        (norm as any).__isSvga = true;
        (norm as any).__originalName = item.file.name;
        expandedList.push({ file: norm, folderName: item.folderName, folderPath: item.folderPath });
        continue;
      }

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
              } else {
                // Content-based check for files without .svga extension inside ZIP
                try {
                  const blob = await entry.async('blob');
                  const isEntrySvga = await isSvgaContent(blob);
                  if (isEntrySvga) {
                    const cleanName = filename.split('/').pop() || filename;
                    if (!cleanName.startsWith('._') && !cleanName.startsWith('.')) {
                      const pathParts = filename.split('/').filter(Boolean);
                      const folderPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : item.folderPath;
                      const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : (item.folderName || '');
                      const normName = cleanName.toLowerCase().endsWith('.svga') ? cleanName : `${cleanName}.svga`;
                      const extractedFile = new File([blob], normName, { type: 'application/octet-stream' });
                      (extractedFile as any).__isSvga = true;
                      (extractedFile as any).__originalName = cleanName;
                      expandedList.push({ file: extractedFile, folderName, folderPath });
                    }
                  }
                } catch {}
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

    const fileArray: {file: File, folderName?: string, folderPath?: string}[] = [];
    for (const f of expandedList) {
      if (!f?.file) continue;
      const name = (f.file.name || '').toLowerCase();
      if (name.startsWith('._') || name.startsWith('.')) continue;

      if ((f.file as any).__isSvga) {
        fileArray.push(f);
        continue;
      }

      if (name.endsWith('.svga') || name.endsWith('.pag') || name.endsWith('.vap') || name.endsWith('.mp4')) {
        fileArray.push(f);
        continue;
      }

      // Check content for files with other or no extensions
      try {
        const isSvga = await isSvgaContent(f.file);
        if (isSvga) {
          const { file: normalized } = await ensureSvgaFile(f.file);
          (normalized as any).__isSvga = true;
          (normalized as any).__originalName = f.file.name;
          fileArray.push({
            file: normalized,
            folderName: f.folderName,
            folderPath: f.folderPath
          });
        }
      } catch (err) {
        console.warn("SVGA content detection error for file:", f.file.name, err);
      }
    }
    if (fileArray.length === 0) return;
    
    let loadedCount = 0;
    setLoadProgress({ current: 0, total: fileArray.length });
    isCanceled.current = false;
    
    const BATCH_SIZE = 16;
    for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
      if (isCanceled.current) break;
      const batch = fileArray.slice(i, i + BATCH_SIZE);
      const newItems: MultiSvgaItem[] = (await Promise.all(batch.map(async (item) => {
        try {
          const lowerName = item.file.name.toLowerCase();
          const isPag = lowerName.endsWith('.pag');
          const isVap = lowerName.endsWith('.vap') || lowerName.endsWith('.mp4');
          const isSvga = Boolean((item.file as any).__isSvga) || lowerName.endsWith('.svga') || (!isPag && !isVap);
          const itemType: 'svga' | 'pag' | 'vap' = isPag ? 'pag' : (isVap ? 'vap' : 'svga');
          let normalizedFile = item.file;
          if (itemType === 'svga') {
            normalizedFile = await normalizeSvgaFile(item.file);
          }
          const url = URL.createObjectURL(normalizedFile);
          
          let vapConfig: any = null;
          let dimensions: { width: number; height: number } | undefined = { width: 500, height: 500 };
          let fps: number | undefined = 30;
          let frames: number | undefined = 1;
          let duration: number | undefined = 1;

          if (itemType === 'svga') {
            // High-speed ingestion: Default dimensions assigned instantly, full frame parsing done on-demand in viewport to prevent memory crash
            fps = 30;
            frames = 1;
            duration = 1;
            dimensions = { width: 500, height: 500 };
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
            file: normalizedFile,
            url,
            name: (item.file as any).__originalName || item.file.name,
            size: normalizedFile.size || item.file.size,
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
        if (renderContainer && renderContainer.parentNode) {
          renderContainer.parentNode.removeChild(renderContainer);
        }
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
      const wmUrl = watermark || wmSettings?.logoUrl;
      if (wmUrl) {
        wmImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = wmUrl;
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
        if (renderContainer && renderContainer.parentNode) {
          renderContainer.parentNode.removeChild(renderContainer);
        }
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

        // Clean MP4 Export without watermark (user requirement)
        // Watermark is excluded from exported MP4 files

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
      if (renderContainer && renderContainer.parentNode) {
        renderContainer.parentNode.removeChild(renderContainer);
      }
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleExportIndividualVideos = async (itemsToExport?: MultiSvgaItem[], formatOverride?: ViewerExportFormat) => {
    const list = itemsToExport || getActiveItems();
    if (list.length === 0) return;

    const activeFormat: ViewerExportFormat = formatOverride || exportFormat;

    // Direct SVGA export
    if (activeFormat === 'svga') {
      if (itemsToExport && itemsToExport.length === 1) {
        handleDownloadSvga(itemsToExport[0]);
      } else {
        handleDownloadAllSvga();
      }
      return;
    }

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

        const isWebM = activeFormat === 'webm';
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

          // Check if we are exporting as VAP, YYEVA, GIF, WebP, APNG, or PNG frames ZIP
          if (activeFormat === 'vap' || activeFormat === 'yyeva' || activeFormat === 'gif' || activeFormat === 'webp' || activeFormat === 'apng' || activeFormat === 'png_seq') {
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

              // Always render watermark on frames
              drawWatermarkOnCanvasHelper(fCtx, finalWidth, finalHeight, frame, wmSettings, wmImg);

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
            let fileExt = '.mp4';
            if (activeFormat === 'vap') {
              finalBlob = await exportAsVap(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight,
                targetFps,
                '1.0.5',
                mixedAudioBuffer,
                (p) => {
                  const baseProg = (i / list.length) * 88;
                  const encodeProg = (((0.4 + p * 0.6) / list.length) * 88);
                  setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + encodeProg))));
                },
                exportQualityNum
              );
              fileExt = '.mp4';
            } else if (activeFormat === 'yyeva') {
              finalBlob = await exportAsYyeva(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight,
                targetFps,
                mixedAudioBuffer,
                (p) => {
                  const baseProg = (i / list.length) * 88;
                  const encodeProg = (((0.4 + p * 0.6) / list.length) * 88);
                  setExportProgress(Math.max(1, Math.min(88, Math.round(baseProg + encodeProg))));
                },
                exportQualityNum
              );
              fileExt = '.mp4';
            } else if (activeFormat === 'gif') {
              finalBlob = await exportAsGif(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight
              );
              fileExt = '.gif';
            } else if (activeFormat === 'webp') {
              finalBlob = await exportAsWebp(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight,
                exportQualityNum
              );
              fileExt = '.webp';
            } else if (activeFormat === 'apng') {
              finalBlob = await exportAsApng(
                collectedCanvases,
                delays,
                finalWidth,
                finalHeight
              );
              fileExt = '.png';
            } else if (activeFormat === 'png_seq') {
              finalBlob = await exportAsPngFramesZip(
                collectedCanvases,
                uniqueNames[item.id] || 'frames',
                delays
              );
              fileExt = '.zip';
            } else {
              finalBlob = await exportAsGif(collectedCanvases, delays, finalWidth, finalHeight);
              fileExt = '.gif';
            }

            const cleanName = uniqueNames[item.id];
            const folderPrefix = item.folderPath ? `${item.folderPath}/` : '';
            const videoFilename = `${folderPrefix}${cleanName}${fileExt}`;

            if (streamZip) {
              const arrayBuffer = await finalBlob.arrayBuffer();
              streamZip.addFile(videoFilename, new Uint8Array(arrayBuffer));
            } else {
              const url = URL.createObjectURL(finalBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${cleanName}${fileExt}`;
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

            // Clean MP4 Export without watermark (user requirement)
            // Watermark is excluded from exported MP4 files

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
        if (tmpCanvas && tmpCanvas.parentNode) {
          tmpCanvas.parentNode.removeChild(tmpCanvas);
        }
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
    if (wmSettings.enabled || watermark) {
      try {
        let wmImg: HTMLImageElement | null = null;
        if (watermark) {
          wmImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = watermark;
          });
        }
        drawWatermarkOnCanvasHelper(ctx, canvas.width, canvas.height, 0, wmSettings, wmImg);
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

  // Global Keyboard Shortcuts: Space (Play/Pause all), Enter or Tab (Export SVGA)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable ||
        Boolean(activeEl.closest('input, textarea, select, [contenteditable="true"]'))
      );
      if (isInput) return;

      // 1. Spacebar: Play / Pause all effects
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setGlobalPaused(prev => !prev);
        return;
      }

      // 2. Enter or Tab: Export SVGA files
      if (e.code === 'Enter' || e.key === 'Enter' || e.code === 'Tab' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (!isExporting && !isZipping && items.length > 0) {
          handleDownloadAllSvga();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [items, isExporting, isZipping]);

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

  // 1) تنزيل كل ملف هدية في ملف PDF مستقل (مع الصورة والمواصفات الفنية)
  const handleDownloadSinglePdfsDirect = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى رفع أو اختيار ملفات SVGA أولاً لتنزيل ملفات الـ PDF الفردية.');
      return;
    }

    setIsExportingCustomPdf(true);
    try {
      const pdfZip = new JSZip();
      const queue = activeItems.slice(0, 30); // Process up to 30 items
      for (let idx = 0; idx < queue.length; idx++) {
        const item = queue[idx];
        const cleanName = item.name.replace(/\.[^/.]+$/, '');
        
        const canvas = document.createElement('canvas');
        const W = 1240, H = 1754; // A4 standard 150 DPI
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Background gradient
          const bgGrad = ctx.createLinearGradient(0, 0, W, H);
          bgGrad.addColorStop(0, '#090d1a');
          bgGrad.addColorStop(0.5, '#0f172a');
          bgGrad.addColorStop(1, '#131e3b');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, W, H);

          // Tech Gold Outer Border
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
          ctx.lineWidth = 4;
          ctx.strokeRect(35, 35, W - 70, H - 70);

          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(45, 45, W - 90, H - 90);

          // Header Banner
          const hGrad = ctx.createLinearGradient(70, 70, W - 140, 130);
          hGrad.addColorStop(0, '#1e293b');
          hGrad.addColorStop(1, '#0f172a');
          ctx.fillStyle = hGrad;
          if (ctx.roundRect) ctx.roundRect(70, 70, W - 140, 130, 16);
          else ctx.fillRect(70, 70, W - 140, 130);
          ctx.fill();
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 36px "Segoe UI", Tahoma, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎁 وثيقة ومواصفات أصل الهدية الرقمية', W / 2, 125);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '20px "Segoe UI", Tahoma, Arial, sans-serif';
          ctx.fillText(`Digital Gift Asset Sheet (${idx + 1} / ${queue.length}): ${cleanName}`, W / 2, 165);

          // Preview Box
          const boxX = 90, boxY = 230, boxW = W - 180, boxH = 680;
          ctx.fillStyle = '#030712';
          if (ctx.roundRect) ctx.roundRect(boxX, boxY, boxW, boxH, 20);
          else ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.fill();
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Checkered background
          const chkSize = 24;
          for (let bx = boxX + 10; bx < boxX + boxW - 10; bx += chkSize) {
            for (let by = boxY + 10; by < boxY + boxH - 10; by += chkSize) {
              const isDark = Math.floor((bx - boxX) / chkSize) % 2 === Math.floor((by - boxY) / chkSize) % 2;
              ctx.fillStyle = isDark ? '#111827' : '#1f2937';
              ctx.fillRect(bx, by, Math.min(chkSize, boxX + boxW - 10 - bx), Math.min(chkSize, boxY + boxH - 10 - by));
            }
          }

          // Capture Best Image Frame
          try {
            const bestImgBlob = await captureBestGiftFrame(item);
            const imgBitmap = await createImageBitmap(bestImgBlob);
            const iw = imgBitmap.width, ih = imgBitmap.height;
            const maxW = boxW - 80, maxH = boxH - 80;
            const scale = Math.min(maxW / iw, maxH / ih, 1.8);
            const dw = iw * scale, dh = ih * scale;
            const dx = boxX + (boxW - dw) / 2, dy = boxY + (boxH - dh) / 2;
            ctx.drawImage(imgBitmap, dx, dy, dw, dh);
          } catch (e) {
            ctx.fillStyle = '#eab308';
            ctx.font = 'bold 72px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎁', W / 2, boxY + boxH / 2);
          }

          // Information Details Card
          const cardY = 940, cardH = 620;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          if (ctx.roundRect) ctx.roundRect(boxX, cardY, boxW, cardH, 16);
          else ctx.fillRect(boxX, cardY, boxW, cardH);
          ctx.fill();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 26px "Segoe UI", Tahoma, Arial, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText('📊 البيانات الفنية ومواصفات الملف المستخرج:', boxX + boxW - 30, cardY + 50);

          const dw = item.dimensions?.width || 500;
          const dh = item.dimensions?.height || 500;
          const durSec = item.videoItem ? (item.videoItem.frames / (item.videoItem.fps || 30)).toFixed(2) : (item.frames ? (item.frames / (item.fps || 30)).toFixed(2) : '0');

          const rows = [
            { label: 'اسم الهدية / الأصل:', val: cleanName },
            { label: 'نوع وصيغة الملف:', val: `${item.type.toUpperCase()} Animation` },
            { label: 'الأبعاد المعيارية:', val: `${dw} × ${dh} بكسل` },
            { label: 'معدل الإطارات (FPS):', val: `${item.fps || item.videoItem?.fps || 30} FPS` },
            { label: 'إجمالي الإطارات والمدة:', val: `${item.frames || item.videoItem?.frames || 1} إطار (${durSec} ثانية)` },
            { label: 'حالة المؤثرات الصوتية:', val: item.hasAudio ? 'مدمج صوت MP3' : 'بدون صوت' },
            { label: 'تاريخ وساعة التصدير:', val: new Date().toLocaleString('ar-EG') }
          ];

          const startY = cardY + 110;
          rows.forEach((r, rIdx) => {
            const ry = startY + rIdx * 65;
            if (rIdx % 2 === 0) {
              ctx.fillStyle = 'rgba(255,255,255,0.03)';
              ctx.fillRect(boxX + 15, ry - 35, boxW - 30, 52);
            }
            ctx.fillStyle = '#93c5fd';
            ctx.font = 'bold 20px "Segoe UI", Tahoma, Arial, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(r.label, boxX + boxW - 35, ry);

            ctx.fillStyle = '#ffffff';
            ctx.font = '19px "Segoe UI", Tahoma, Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(r.val, boxX + 40, ry);
          });

          ctx.fillStyle = '#64748b';
          ctx.font = '16px "Segoe UI", Tahoma, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('مستخرج أصول التطبيقات وهدايا SVGA — تم التحقق والتصدير بجودة أصلية 100%', W / 2, H - 65);

          const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          doc.addImage(imgData, 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
          const pdfBlob = doc.output('blob');
          const pdfBuffer = await pdfBlob.arrayBuffer();

          pdfZip.file(`توثيق_هدية_${cleanName}.pdf`, pdfBuffer);
        }
      }

      const zipBlob = await pdfZip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقارير_PDF_لكل_هدية.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      alert(`✅ تم تنزيل حزمة تقارير PDF لجميع الهدايا بملف ZIP واحد بنجاح!`);
    } catch (err: any) {
      console.error('Single PDF export error:', err);
      alert('حدث خطأ أثناء تصدير ملفات PDF: ' + err.message);
    } finally {
      setIsExportingCustomPdf(false);
    }
  };

  // 2) تنزيل كل ملفات SVG مفتوحة ومباشرة (وليس مضغوطة / Direct Unzipped SVGs)
  const handleDownloadAllSvgsDirect = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى رفع ملفات SVGA أولاً لتنزيل مسارات ومتجهات الـ SVG.');
      return;
    }

    try {
      const svgZip = new JSZip();

      for (const item of activeItems) {
        const cleanName = item.name.replace(/\.[^/.]+$/, '');
        const videoItem = item.videoItem;
        const w = item.dimensions?.width || 500;
        const h = item.dimensions?.height || 500;

        let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
        svgContent += `  <!-- Exported from SVGA Gift: ${cleanName} -->\n`;
        svgContent += `  <rect width="100%" height="100%" fill="none"/>\n`;

        if (videoItem?.images && Object.keys(videoItem.images).length > 0) {
          Object.keys(videoItem.images).forEach((imgKey, i) => {
            const rawBytes = videoItem.images[imgKey];
            if (rawBytes) {
              const b64 = btoa(Array.from(new Uint8Array(rawBytes)).map(b => String.fromCharCode(b)).join(''));
              svgContent += `  <image id="layer_${i}_${imgKey.replace(/[^a-zA-Z0-9_]/g, '_')}" href="data:image/png;base64,${b64}" width="${w}" height="${h}" opacity="1"/>\n`;
            }
          });
        } else {
          svgContent += `  <circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)*0.4}" fill="#1e1b4b" stroke="#6366f1" stroke-width="4"/>\n`;
          svgContent += `  <text x="50%" y="50%" font-size="28" font-family="sans-serif" font-weight="bold" fill="#fef08a" text-anchor="middle" dominant-baseline="middle">🎁 ${cleanName}</text>\n`;
        }

        svgContent += `</svg>`;
        svgZip.file(`${cleanName}.svg`, svgContent);
      }

      const zipBlob = await svgZip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ملفات_SVG_المفتوحة.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      alert(`✅ تم تنزيل جميع ملفات الـ SVG المفتوحة بملف ZIP واحد بنجاح!`);
    } catch (err: any) {
      console.error('Failed to export direct SVGs:', err);
      alert('حدث خطأ أثناء تنزيل ملفات SVG المباشرة: ' + err.message);
    }
  };

  // 3) تنزيل الهدايا وصورها في مجلد مفتوح مباشر بدون أي ضغط ZIP (Unzipped Directory Picker)
  const handleDownloadToOpenFolder = async (isCustomSubfolders: boolean) => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى اختيار أو رفع ملفات الهدايا أولاً لتنزيلها في مجلد مفتوح.');
      return;
    }

    let dirHandle: any = null;
    if ('showDirectoryPicker' in window) {
      try {
        dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn('showDirectoryPicker cancelled or unsupported:', err);
      }
    }

    setIsExporting(true);
    try {
      for (let idx = 0; idx < activeItems.length; idx++) {
        const item = activeItems[idx];
        const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
        const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');

        // Get file array buffer
        const fileBuffer = await item.file.arrayBuffer();

        // Capture clearest frame image
        let coverBlob: Blob | null = null;
        try {
          coverBlob = await captureBestGiftFrame(item);
        } catch (e) {
          console.warn('Frame capture error:', e);
        }

        if (dirHandle) {
          let giftFolder = dirHandle;
          if (isCustomSubfolders) {
            // Create subfolder for each gift inside main open folder: 📁 Gift_Name/
            giftFolder = await dirHandle.getDirectoryHandle(`هدية_${cleanName}`, { create: true });
          }

          // 1. Save original gift file directly into folder
          const giftFileHandle = await giftFolder.getFileHandle(`${cleanName}.${ext}`, { create: true });
          const giftWritable = await giftFileHandle.createWritable();
          await giftWritable.write(fileBuffer);
          await giftWritable.close();

          // 2. Save cover image directly into folder
          if (coverBlob) {
            const imgFileHandle = await giftFolder.getFileHandle(`${cleanName}_صورة.png`, { create: true });
            const imgWritable = await imgFileHandle.createWritable();
            await imgWritable.write(await coverBlob.arrayBuffer());
            await imgWritable.close();
          }
        } else {
          // Fallback direct downloads for non-Chromium browsers
          const giftBlob = new Blob([fileBuffer]);
          const url1 = URL.createObjectURL(giftBlob);
          const a1 = document.createElement('a');
          a1.href = url1;
          a1.download = `${cleanName}.${ext}`;
          a1.style.display = 'none';
          document.body.appendChild(a1);
          a1.click();
          setTimeout(() => { a1.remove(); URL.revokeObjectURL(url1); }, 15000);

          if (coverBlob) {
            const url2 = URL.createObjectURL(coverBlob);
            const a2 = document.createElement('a');
            a2.href = url2;
            a2.download = `${cleanName}_صورة.png`;
            a2.style.display = 'none';
            document.body.appendChild(a2);
            a2.click();
            setTimeout(() => { a2.remove(); URL.revokeObjectURL(url2); }, 15000);
          }
        }
      }

      alert(
        dirHandle
          ? `✅ تم حفظ ${activeItems.length} هدية وصورها داخل المجلد المفتوح المحدد على جهازك مباشرة بدون ضغط!`
          : `✅ تم تنزيل ${activeItems.length} هدية وصورها مباشرة على جهازك بنجاح!`
      );
    } catch (err: any) {
      console.error('Folder download error:', err);
      alert('حدث خطأ أثناء تنزيل الهدايا في المجلد المفتوح: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsExporting(false);
    }
  };

  // 4) تنزيل جميع الهدايا والصور في فولدر واحد داخل حزمة ZIP
  const handleDownloadAllInOneFolderZip = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى اختيار أو رفع ملفات الهدايا أولاً لتنزيل الفولدر.');
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (let idx = 0; idx < activeItems.length; idx++) {
        const item = activeItems[idx];
        const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
        const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');

        const fileBuffer = await item.file.arrayBuffer();
        zip.file(`${cleanName}.${ext}`, fileBuffer);

        try {
          const coverBlob = await captureBestGiftFrame(item);
          const coverBuffer = await coverBlob.arrayBuffer();
          zip.file(`${cleanName}_صورة.png`, coverBuffer);
        } catch (e) {
          console.warn('Cover image capture failed for item', item.name, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `جميع_الهدايا_والصور_فولدر_واحد.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      alert('✅ تم تنزيل جميع الملفات والصور في فولدر واحد (ZIP) بنجاح!');
    } catch (err: any) {
      console.error('All-in-one ZIP download failed:', err);
      alert('حدث خطأ أثناء تنزيل الفولدر: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsZipping(false);
    }
  };

  // 5) تخصيص: تنزيل كل هدية بملفها وصورتها داخل فولدر مستقل داخل ZIP
  const handleDownloadCustomFolderPerGiftZip = async () => {
    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
      alert('يرجى اختيار أو رفع ملفات الهدايا أولاً لتنزيل الفولدرات المستقلة.');
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (let idx = 0; idx < activeItems.length; idx++) {
        const item = activeItems[idx];
        const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
        const ext = item.type === 'vap' ? (item.name.endsWith('.mp4') ? 'mp4' : 'vap') : (item.type === 'pag' ? 'pag' : 'svga');

        const giftFolder = zip.folder(`فولدر_هدية_${cleanName}`);
        if (giftFolder) {
          const fileBuffer = await item.file.arrayBuffer();
          giftFolder.file(`${cleanName}.${ext}`, fileBuffer);

          try {
            const coverBlob = await captureBestGiftFrame(item);
            const coverBuffer = await coverBlob.arrayBuffer();
            giftFolder.file(`${cleanName}_صورة.png`, coverBuffer);
          } catch (e) {
            console.warn('Cover image capture failed for item', item.name, e);
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تخصيص_فولدر_مستقل_لكل_هدية.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      alert('✅ تم تنزيل كل هدية بملفها وصورتها داخل فولدر مستقل (ZIP) بنجاح!');
    } catch (err: any) {
      console.error('Custom subfolders ZIP download failed:', err);
      alert('حدث خطأ أثناء تنزيل الفولدرات المستقلة: ' + (err.message || 'خطأ غير متوقع'));
    } finally {
      setIsZipping(false);
    }
  };


  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

  const totalPages = pageSize > 0 ? Math.ceil((items as any[]).length / pageSize) : 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const paginatedItems = useMemo(() => {
    if (pageSize <= 0) return items;
    const start = (safeCurrentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safeCurrentPage, pageSize]);

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
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#0c1324]/90 border border-white/10 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-xl">
          {/* Right side: Title & Stats */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">نظام العرض الذكي لملفات SVGA</h2>
                {(items as any[]).length > 0 && (
                  <div className="flex items-center gap-2 px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/25 rounded-md text-xs font-semibold text-indigo-300">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    <span>{(items as any[]).length} {(items as any[]).length === 1 ? 'ملف مرفوع' : 'ملفات'}</span>
                  </div>
                )}
              </div>
              <p className="text-slate-400 font-normal text-xs mt-0.5">
                دعم كامل لجميع المقاسات (500×500, 750×1334, 2000×2000) مع تثبيت الدقة والأبعاد
              </p>
            </div>
          </div>

          {/* Center/Left: Master Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Files */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>رفع ملفات</span>
            </button>

            {/* Upload Folders */}
            <button
              onClick={handleUploadFolders}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold text-xs border border-white/10 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="رفع مجلد كامل بالملفات الفرعية"
            >
              <FolderUp className="w-4 h-4 text-sky-400" />
              <span>رفع مجلدات</span>
            </button>

            {/* Extract from PDF */}
            <button
              onClick={handleExtractFromPdf}
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="فك واستخراج هدايا SVGA من ملفات PDF المحمية والعادية بنقرة واحدة"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span>فك من PDF</span>
            </button>

            {/* Deduplication Toggle */}
            <button
              onClick={handleToggleDeduplication}
              className={`px-3 py-2 rounded-xl font-bold text-xs border flex items-center gap-2 transition-all cursor-pointer ${
                preventDuplicates 
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300' 
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
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                  title="تحديد كل الملفات"
                >
                  <SquareCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>تحديد الكل</span>
                </button>
                <div className="w-px h-4 bg-white/10" />
                <button
                  onClick={clearAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all flex items-center gap-1.5"
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
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                showSideDock 
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="إظهار أو إخفاء لوحة العمليات الجانبية"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>لوحة جانبية</span>
            </button>
            
            {/* Toggle All Effects Button */}
            <button
              onClick={() => {
                setGlobalPaused(prev => !prev);
                const isMuted = (window as any).Howler?.mute();
                (window as any).Howler?.mute(!isMuted);
              }}
              className={`px-3 py-2 border rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                globalPaused 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
              title="إيقاف أو تشغيل جميع تأثيرات الصوت والحركة لتقليل الحمل على المتصفح والمعالج"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>{globalPaused ? 'تشغيل التأثيرات' : 'إيقاف التأثيرات'}</span>
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

        {/* Row 2: All Action & Export Buttons in Top Bar */}
        {(items as any[]).length > 0 && (
          <div className="flex flex-col gap-3">
            {/* Primary Highlighted Strip 1: Open Folder & ZIP Exports (Direct Single Folder vs Custom Subfolder per Gift) */}
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-500/60 p-4 sm:p-5 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 ring-2 ring-amber-400/30">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 text-xl">
                  📁
                </span>
                <div className="flex flex-col text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-amber-300">
                      تنزيل الفولدرات المفتوحة وحزم ZIP للهدايا والصور:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-black">
                      فولدرات جاهزة
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-medium">
                    اختر تنزيل جميع الملفات والصور في فولدر واحد أو تخصيص فولدر مستقل لكل هدية
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Button 1: Download All Files & Images in One Folder ZIP */}
                <button
                  onClick={handleDownloadAllInOneFolderZip}
                  disabled={isZipping || (items as any[]).length === 0}
                  className="px-4 py-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 rounded-2xl font-black text-xs shadow-xl shadow-amber-500/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-yellow-200"
                  title="تنزيل جميع ملفات الهدايا مع صورها المعاينة مباشرة في فولدر واحد (ZIP)"
                >
                  <FolderUp className="w-4.5 h-4.5 text-slate-950 stroke-[2.5]" />
                  <span>📁 ⬇️ تنزيل جميع الملفات والصور في فولدر واحد (ZIP)</span>
                </button>

                {/* Button 2: Customization option - Subfolder for each gift with its file and image */}
                <button
                  onClick={handleDownloadCustomFolderPerGiftZip}
                  disabled={isZipping || (items as any[]).length === 0}
                  className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-indigo-400/60"
                  title="تخصيص: تنزيل مجلد فرعي باسم كل هدية يحتوي على ملف الهدية وصورتها داخل فولدر مضغوط ZIP"
                >
                  <FolderUp className="w-4.5 h-4.5 text-indigo-200 stroke-[2.5]" />
                  <span>📂 ⬇️ تخصيص: فولدر مستقل لكل هدية يضم ملفها وصورتها (ZIP)</span>
                </button>
              </div>
            </div>

            {/* Secondary Strip: Packages, ZIPs & Video Studio */}
            <div className="bg-[#0b1120]/80 border border-white/10 p-3 sm:p-4 rounded-2xl shadow-lg backdrop-blur-md flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
              {/* Section 1: Packages & Bundles */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 pl-2 border-l border-white/10 hidden sm:inline">
                  حزم وملفات ZIP:
                </span>

                {/* Download Gift Bundles */}
                <button
                  onClick={handleDownloadAllGiftBundles}
                  disabled={isZipping || (items as any[]).length === 0}
                  className="px-3.5 py-2 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 disabled:opacity-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تنزيل حزم الهدايا كاملة (ملف الهدية + أحلى صورة كادر داخل ZIP)"
                >
                  {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  <span>تنزيل حزم الهدايا ZIP</span>
                </button>

                {/* Download All SVGA ZIP */}
                <button
                  onClick={handleDownloadAllSvga}
                  disabled={isZipping || (items as any[]).length === 0}
                  className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 disabled:opacity-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تنزيل جميع ملفات SVGA / VAP الأصلية فقط في ملف ZIP"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل كل الملفات (ZIP)</span>
                </button>

                {/* Download All Combined */}
                <button
                  onClick={handleDownloadAllCombined}
                  disabled={isZipping || (items as any[]).length === 0}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 disabled:opacity-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تنزيل شامل لجميع الملفات والصور والكتالوج"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>تنزيل الكل الشامل</span>
                </button>
              </div>

              {/* Section 2: Video Studio */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 pl-2 border-l border-white/10 hidden sm:inline">
                  استوديو الفيديو:
                </span>

                {/* Video Duration & Speed Button */}
                <button
                  onClick={() => setShowDurationSpeedModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-200 border border-amber-500/40 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md shadow-amber-500/10"
                  title="تحديد مدة وقت الفيديو (بالثواني) والتحكم في سرعة التسجيل لجميع الملفات"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>مدة وقت الفيديو ({useNativeDuration ? 'الأصلية' : `${exportDuration} ثواني`})</span>
                </button>

                {/* Convert VAP to MP4 */}
                <button
                  onClick={handleExportAllVapToMp4}
                  disabled={vapBatchProgress?.isOpen}
                  className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 disabled:opacity-50 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تحويل جميع ملفات VAP إلى MP4 بالصوت المدمج والشفافية"
                >
                  {vapBatchProgress?.isOpen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4 text-purple-300" />}
                  <span>{vapBatchProgress?.isOpen ? `تحويل (${vapBatchProgress.overallPercent}%)` : 'تحويل VAP ➔ MP4'}</span>
                </button>

                {/* Export Individual Videos ZIP */}
                <button
                  onClick={() => handleExportIndividualVideos()}
                  disabled={isExporting}
                  className="px-3.5 py-2 bg-[#0e172a] hover:bg-[#1e293b] disabled:opacity-50 text-slate-200 border border-white/10 rounded-xl font-bold text-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تصدير فيديو منفصل لكل ملف على حدة وتنزيلها مضغوطة في ملف ZIP"
                >
                  <Film className="w-4 h-4 text-indigo-400" />
                  <span>فيديو منفصل لكل ملف (ZIP)</span>
                </button>

                {/* Record Grid Video */}
                <button
                  onClick={handleExportGrid}
                  disabled={isExporting}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  title="تسجيل وتصدير فيديو مجمع للشاشة بالكامل"
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>{isExporting ? `تسجيل (${exportProgress}%)` : 'تسجيل فيديو مجمع'}</span>
                </button>
              </div>
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

              {/* Quick Column Pills 1 to 8 */}
              <div className="flex items-center justify-between gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGridCols(num)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-black transition-all ${
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

              {/* Group Folders Toggle Switch */}
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-400 mt-1 pt-1.5 border-t border-white/5">
                <span className="flex items-center gap-1.5 text-indigo-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  عرض مجلدات منفصلة:
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupFolders}
                    onChange={(e) => setGroupFolders(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500 shadow-inner"></div>
                </label>
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
                  onChange={(e) => setExportFormat(e.target.value as ViewerExportFormat)}
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

              {/* Dedicated Video Duration Control with Checkbox (علامة الصح للمدة المخصصة أو الأساسية) */}
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3 flex flex-col gap-2.5">
                {/* Header & Advanced Modal Button */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>التحكم في وقت ومدة الفيديو:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDurationSpeedModal(true)}
                    className="text-[10px] text-amber-300 hover:text-white font-bold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/25 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-all cursor-pointer"
                    title="فتح استوديو تحديد مدة وسرعة الفيديو المتقدم"
                  >
                    <span>التحكم المتقدم</span>
                  </button>
                </div>

                {/* Primary Checkbox (علامة الصح المطلوبة) */}
                <label className="flex items-center gap-2.5 px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer select-none transition-all group">
                  <input 
                    type="checkbox" 
                    checked={!useNativeDuration}
                    onChange={(e) => {
                      const isCustom = e.target.checked;
                      setUseNativeDuration(!isCustom);
                    }}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer transition-transform group-hover:scale-110"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-amber-200 group-hover:text-white flex items-center gap-1.5">
                      <span>تحديد وتخصيص مدة وقت الفيديو (بالثواني)</span>
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {!useNativeDuration 
                        ? 'مفعلة: سيتم تصدير الفيديو بالمدة التي تحددها بالأسفل' 
                        : 'غير مفعلة: يتم تصدير كل ملف بمدته الأساسية الأصلية تلقائياً'}
                    </span>
                  </div>
                </label>

                {/* State 1: When Checkbox is UNCHECKED (غير متفعلة) -> Export with Base / Native Duration */}
                {useNativeDuration ? (
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10px] text-emerald-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>يتم تصدير الفيديو بالمدة الأساسية والأصلية للملف تلقائياً</span>
                    </span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
                      المدة الأساسية ✓
                    </span>
                  </div>
                ) : (
                  /* State 2: When Checkbox is CHECKED (متفعلة) -> User specifies the exact duration */
                  <div className="flex flex-col gap-2 p-2 bg-amber-950/20 border border-amber-500/30 rounded-xl animate-fade-in">
                    <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
                      <span>حدد مدة الفيديو المطلوبة:</span>
                      <span className="font-mono bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-md">
                        {exportDuration} ثواني
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Quick Choice Buttons */}
                      {[2, 3, 5, 8, 10, 15].map(sec => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setExportDuration(sec)}
                          className={`flex-1 min-w-[34px] py-1 px-1.5 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer border text-center ${
                            exportDuration === sec 
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30 scale-105' 
                              : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:border-amber-500/40'
                          }`}
                          title={`تحديد مدة تصدير الفيديو إلى ${sec} ثواني`}
                        >
                          {sec}ث
                        </button>
                      ))}

                      {/* Stepper with + and - */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-amber-400/60 ring-1 ring-amber-400/30 px-2 py-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setExportDuration(prev => Math.max(1, prev - 1))}
                          className="text-slate-300 hover:text-white font-black text-xs px-1 cursor-pointer"
                          title="تقليل ثانية واحدة"
                        >
                          <Minus size={11} />
                        </button>
                        <input 
                          type="number" 
                          min="1" 
                          max="120"
                          value={exportDuration}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setExportDuration(val);
                          }}
                          className="w-8 bg-transparent text-amber-200 text-center font-mono font-black text-[11px] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setExportDuration(prev => Math.min(120, prev + 1))}
                          className="text-slate-300 hover:text-white font-black text-xs px-1 cursor-pointer"
                          title="زيادة ثانية واحدة"
                        >
                          <Plus size={11} />
                        </button>
                        <span className="text-[9px] text-slate-400 font-bold">ث</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Sub-Info */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px]">
                  <span className="text-amber-200/80 font-bold">
                    {useNativeDuration ? '✓ المدة الأصلية لكل ملف' : `⏱️ مدة مخصصة: ${exportDuration} ثواني`}
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white">
                    <input 
                      type="checkbox" 
                      checked={forceMobileSize}
                      onChange={(e) => setForceMobileSize(e.target.checked)}
                      className="w-3 h-3 accent-indigo-500 rounded"
                    />
                    <span>مقاس جوال (9:16)</span>
                  </label>
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

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 w-full">
          {/* Background selector with guaranteed pristine presets & no broken external images */}
          <div className="flex items-center gap-2.5 bg-slate-900/60 p-2.5 sm:p-3 rounded-2xl border border-white/10 shrink-0 backdrop-blur-md shadow-lg">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">الخلفية:</span>
            <div className="flex items-center gap-1.5">
              {/* 1. Transparent */}
              <button 
                onClick={() => setPreviewBg(null)}
                className={`w-9 h-9 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                  !previewBg ? 'border-indigo-400 bg-indigo-500/25 ring-2 ring-indigo-500/30' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
                title="خلفية شفافة (أصلية)"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>

              {/* 2. Studio Dark */}
              <button
                onClick={() => setPreviewBg('linear-gradient(135deg, #0b0f19 0%, #111827 50%, #030712 100%)')}
                className={`w-9 h-9 rounded-xl border transition-all relative overflow-hidden cursor-pointer ${
                  previewBg?.includes('#0b0f19') ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/30'
                }`}
                style={{ background: 'linear-gradient(135deg, #0b0f19, #111827)' }}
                title="استوديو داكن فاخر"
              />

              {/* 3. Cyber Navy */}
              <button
                onClick={() => setPreviewBg('linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)')}
                className={`w-9 h-9 rounded-xl border transition-all relative overflow-hidden cursor-pointer ${
                  previewBg?.includes('#1e1b4b') ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/30'
                }`}
                style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}
                title="فضاء سيبراني كحلي"
              />

              {/* 4. Pure Black */}
              <button
                onClick={() => setPreviewBg('#000000')}
                className={`w-9 h-9 rounded-xl border transition-all relative overflow-hidden cursor-pointer ${
                  previewBg === '#000000' ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/30'
                }`}
                style={{ background: '#000000' }}
                title="أسود فاحم سينمائي"
              />

              {/* 5. Custom Background Upload */}
              <button 
                onClick={() => bgInputRef.current?.click()}
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer text-slate-300 hover:text-white"
                title="رفع صورة خلفية مخصصة من جهازك"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setPreviewBg(URL.createObjectURL(e.target.files[0]))} />
            </div>
          </div>

          {/* EXACT Anti-Theft Watermark Card as in User Screenshot */}
          <div className="flex-1 max-w-2xl bg-[#090d1c] border border-pink-500/30 hover:border-pink-500/50 rounded-2xl p-4 sm:p-5 space-y-3 shadow-[0_0_25px_rgba(244,63,94,0.15)] transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30 shrink-0">
                  <Shield className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    علامة مائية متحركة لمنع السرقة
                    {wmSettings.enabled && (
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">تتنقل باستمرار عبر الإطارات لتصعيب السرقة والقص</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wmSettings.enabled}
                    onChange={(e) => setWmSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 shadow-inner"></div>
                </label>

                <button
                  type="button"
                  onClick={() => setIsWatermarkModalOpen(true)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] font-bold transition-all border border-white/10"
                  title="خيارات متقدمة ورفع شعار"
                >
                  خيارات متقدمة ⚙️
                </button>
              </div>
            </div>

            {wmSettings.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-300">
                {/* Notification toast for permanent pin */}
                {pinnedNotice && (
                  <div className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 p-2 rounded-xl flex items-center gap-1.5 animate-in fade-in duration-200 shadow-md">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{pinnedNotice}</span>
                  </div>
                )}

                {/* Text and Color Row with Pin Button */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5 shrink-0">
                    {([
                      { color: '#be185d', label: 'وردي داكن' },
                      { color: '#0284c7', label: 'أزرق سماوي' },
                      { color: '#ca8a04', label: 'ذهبي' },
                      { color: '#ffffff', label: 'أبيض' }
                    ] as const).map(({ color, label }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateAndSaveWmSettings(prev => ({ ...prev, color }))}
                        style={{ backgroundColor: color }}
                        className={`w-6 h-6 rounded-lg transition-transform cursor-pointer ${
                          wmSettings.color.toLowerCase() === color.toLowerCase() 
                            ? 'scale-110 ring-2 ring-white shadow-md' 
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={label}
                      />
                    ))}
                  </div>

                  <div className="flex-1 flex items-center gap-1.5 w-full">
                    <input
                      type="text"
                      value={wmSettings.text}
                      onChange={(e) => updateAndSaveWmSettings(prev => ({ ...prev, text: e.target.value }))}
                      placeholder="🔒 اكتب اسمك أو علامتك المائية"
                      className="flex-1 bg-black/40 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-pink-500 text-right"
                    />

                    {/* Pin as Permanent Default Button */}
                    <button
                      type="button"
                      onClick={() => pinAsPermanentDefault()}
                      className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer select-none ${
                        wmSettings.text.trim() === pinnedName.trim()
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                          : 'bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border-white/10 hover:border-amber-400/40'
                      }`}
                      title="تثبيت هذا الاسم كاسمك الافتراضي الدائم، لتجده دائماً جاهزاً في كل مرة تفتح فيها الموقع لتسريع عملك"
                    >
                      <Pin className={`w-3.5 h-3.5 ${wmSettings.text.trim() === pinnedName.trim() ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                      <span className="hidden xs:inline">
                        {wmSettings.text.trim() === pinnedName.trim() ? 'مثبت دائماً ✓' : 'تثبيت دائم 📌'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets & Permanent Name Chips Row */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-amber-300 font-black flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>أسمائي السريعة:</span>
                  </span>

                  {/* 1. Permanent Default Button */}
                  {pinnedName && (
                    <button
                      type="button"
                      onClick={() => updateAndSaveWmSettings(prev => ({ ...prev, text: pinnedName }))}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                        wmSettings.text === pinnedName 
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black' 
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-500/30'
                      }`}
                      title="استعادة اسمك المثبت دائماً بضغطة واحدة"
                    >
                      <span>📌 {pinnedName}</span>
                      <span className="text-[8px] px-1 py-0.2 rounded bg-black/40 text-amber-200 font-mono">دائم</span>
                    </button>
                  )}

                  {/* 2. Other Saved Presets */}
                  {savedPresets.filter(p => p !== pinnedName).map(preset => (
                    <div key={preset} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => updateAndSaveWmSettings(prev => ({ ...prev, text: preset }))}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                          wmSettings.text === preset
                            ? 'bg-pink-600 text-white border-pink-400 shadow-sm'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/5'
                        }`}
                      >
                        {preset}
                      </button>
                    </div>
                  ))}

                  {/* 3. Add Current Text to Presets */}
                  {wmSettings.text && !savedPresets.includes(wmSettings.text) && (
                    <button
                      type="button"
                      onClick={() => addCustomPreset(wmSettings.text)}
                      className="px-2 py-0.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[9px] font-bold transition-all cursor-pointer"
                      title="إضافة الاسم المكتوب حالياً إلى القائمة السريعة"
                    >
                      + حفظ بالقائمة
                    </button>
                  )}
                </div>

                {/* 4 Mode Buttons exactly matching screenshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                  {[
                    { id: 'floating', label: 'عائمة ومتحركة 🪄' },
                    { id: 'horizontal_bands', label: 'انسياب قطري 📜' },
                    { id: 'diagonal_repeat', label: 'شبكة مكررة 🛡️' },
                    { id: 'pulse', label: 'نبض بالزاوية 💫' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => updateAndSaveWmSettings(prev => ({ ...prev, pattern: st.id as any }))}
                      className={`py-2 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer text-center ${
                        wmSettings.pattern === st.id 
                          ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Dedicated Watermark Motion & Animation Control Row (أوبشن تحريك العلامة المائية) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-2.5 rounded-xl bg-black/40 border border-pink-500/20">
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wmSettings.isAnimated !== false}
                        onChange={(e) => updateAndSaveWmSettings(prev => ({ ...prev, isAnimated: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500 shadow-inner"></div>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                      <span className="text-xs font-black text-white">
                        تحريك العلامة المائية مستمراً 🎬
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        wmSettings.isAnimated !== false 
                          ? 'bg-pink-500/25 text-pink-200 border border-pink-500/40' 
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}>
                        {wmSettings.isAnimated !== false ? 'مفعلة (متحركة عبر الفيديو) ✓' : 'ثابتة'}
                      </span>
                    </div>
                  </div>

                  {/* Motion Speed Selector */}
                  {wmSettings.isAnimated !== false && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold">سرعة الحركة:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { speed: 2, label: 'بطيء 🐢' },
                          { speed: 5, label: 'عادي ⚡' },
                          { speed: 8, label: 'سريع 🚀' },
                        ].map(s => (
                          <button
                            key={s.speed}
                            type="button"
                            onClick={() => updateAndSaveWmSettings(prev => ({ ...prev, animationSpeed: s.speed }))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              (wmSettings.animationSpeed || 5) === s.speed
                                ? 'bg-pink-600 text-white border-pink-400 shadow-md font-black'
                                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Opacity slider with pink accent */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="font-bold">الشفافية: {Math.round(wmSettings.opacity * 100)}%</span>
                  <input
                    type="range"
                    min={0.15}
                    max={0.9}
                    step={0.05}
                    value={wmSettings.opacity}
                    onChange={(e) => updateAndSaveWmSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-48 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>
              </div>
            )}
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
            <p className="text-slate-400 text-sm font-bold tracking-wide max-w-lg mb-6">يدعم ملفات SVGA بكافة المسميات (التعرف الذكي التلقائي من المحتوى)، و VAP, PAG, ZIP وفك ملفات PDF واستخراج الـ SVGA منها</p>
            
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
            {false ? (
              Object.entries(
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
                    className={`grid gap-6 w-full transition-all ${
                      (folderItems as any[]).length === 1 
                        ? 'max-w-2xl sm:max-w-3xl mx-auto grid-cols-1' 
                        : (folderItems as any[]).length === 2
                        ? 'max-w-5xl mx-auto grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                    }`}
                    style={
                      (folderItems as any[]).length > 2 
                        ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${gridCols <= 2 ? '440px' : gridCols === 3 ? '360px' : '300px'}), 1fr))` }
                        : undefined
                    }
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
                          updateAndSaveWmSettings={updateAndSaveWmSettings}
                          globalPausedRef={globalPausedRef}
                          isGlobalPaused={globalPaused}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))
            ) : (
              <div 
                className="grid gap-6 w-full transition-all"
                style={{
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
                }}
              >
                <AnimatePresence mode="popLayout">
                  {(paginatedItems as any[]).map((item) => (
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
                      updateAndSaveWmSettings={updateAndSaveWmSettings}
                      globalPausedRef={globalPausedRef}
                      isGlobalPaused={globalPaused}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Smart High-Performance Pagination Bar (Active when items > 24) */}
            {(items as any[]).length > 24 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0c1324]/90 border border-white/10 backdrop-blur-xl shadow-xl mt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-xs">
                    ⚡
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-white block">
                      عرض {paginatedItems.length} من أصل {(items as any[]).length} ملف
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      تشغيل متزامن لجميع ملفات المعاينة نشط ({pageSize > 0 ? `كل ${paginatedItems.length} ملف بالصفحة` : 'جميع الملفات معاً'}) • سلاسة كاملة وتأثيرات مستمرة
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Page Size Switcher */}
                  <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
                    <span className="text-[10px] text-slate-400 px-2 font-bold">لكل صفحة:</span>
                    {[24, 36, 72, 0].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          pageSize === size
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {size === 0 ? 'الكل (عام)' : size}
                      </button>
                    ))}
                  </div>

                  {/* Navigation Pages */}
                  {pageSize > 0 && totalPages > 1 && (
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        السابق
                      </button>

                      <div className="px-3 py-1 text-xs font-mono font-black text-indigo-300">
                        {safeCurrentPage} / {totalPages}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-3 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        التالي
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  {(wmSettings?.enabled || watermark) && (
                    <WatermarkOverlay 
                      watermark={watermark} 
                      settings={wmSettings} 
                      onUpdateSettings={(newSettings) => updateAndSaveWmSettings(prev => ({ ...prev, ...newSettings }))}
                      onOpenModal={() => setIsWatermarkModalOpen(true)}
                    />
                  )}
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

      {/* Comprehensive Watermark Studio Modal */}
      <MultiSvgaWatermarkModal
        isOpen={isWatermarkModalOpen}
        onClose={() => setIsWatermarkModalOpen(false)}
        settings={wmSettings}
        onSave={(newSettings) => {
          updateAndSaveWmSettings(newSettings);
          if (newSettings.logoUrl) {
            setWatermark(newSettings.logoUrl);
          }
        }}
        watermarkLogo={watermark}
        onLogoChange={(url) => {
          setWatermark(url);
          updateAndSaveWmSettings(prev => ({ ...prev, logoUrl: url }));
        }}
      />

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
          onDownloadSinglePdfsDirect={handleDownloadSinglePdfsDirect}
          isExportingCustomPdf={isExportingCustomPdf}
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
          onVideoDurationSpeedOpen={() => setShowDurationSpeedModal(true)}
          exportDuration={exportDuration}
          useNativeDuration={useNativeDuration}
          onOpenWatermarkModal={() => setIsWatermarkModalOpen(true)}
          wmSettings={wmSettings}
        />
      )}

      {/* Video Duration & Speed Control Modal */}
      <VideoDurationSpeedModal
        isOpen={showDurationSpeedModal}
        onClose={() => setShowDurationSpeedModal(false)}
        initialFiles={(items as any[]).map(i => i.file).filter(Boolean)}
        currentDuration={exportDuration}
        onApplyToConverter={(targetDuration) => {
          setExportDuration(targetDuration);
          setUseNativeDuration(false);
          setShowDurationSpeedModal(false);
        }}
      />

      {/* Adobe After Effects Project & JSX Export Modal */}
      {isAeExportModalOpen && aeExportItem && (
        <AeExportModal
          isOpen={isAeExportModalOpen}
          onClose={() => setIsAeExportModalOpen(false)}
          metadata={{
            name: aeExportItem.name ? aeExportItem.name.replace(/\.[^/.]+$/, '') : 'SVGA_Project',
            width: aeExportItem.width || 500,
            height: aeExportItem.height || 500,
            fps: aeExportItem.fps || 30,
            frames: aeExportItem.frames || 60,
            version: '2.0'
          }}
          sprites={aeExportItem.videoItem?.sprites || []}
          imagesData={aeExportItem.videoItem?.images || {}}
          previewBg={previewBg}
          onSuccessToast={(msg) => alert(msg)}
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

// Global Concurrent Active Animation Pool (Allows all visible/paginated items to play smoothly)
const activeRunningAnimationIds = new Set<string>();
const animationSlotListeners = new Set<() => void>();

const notifyAnimationSlotFreed = () => {
  animationSlotListeners.forEach(listener => {
    try { listener(); } catch (_) {}
  });
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
  updateAndSaveWmSettings: (updater: any) => void;
  globalPausedRef: React.MutableRefObject<boolean>;
  isGlobalPaused?: boolean;
}> = ({ item, customDimensions, gridCols, onRemove, onMaximize, onDownload, onDownloadSvga, onDownloadGiftBundle, onExportVideo, previewBg, watermark, wmSettings, onUpdatePreset, isSelected, onToggleSelect, onUpdateItem, updateAndSaveWmSettings, globalPausedRef, isGlobalPaused }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showItemControls, setShowItemControls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
    
  const [cardDimensions, setCardDimensions] = useState<{ width: number; height: number } | null>(item.dimensions || null);

  useEffect(() => {
    if (item.dimensions && (item.dimensions.width !== cardDimensions?.width || item.dimensions.height !== cardDimensions?.height)) {
      setCardDimensions(item.dimensions);
    }
  }, [item.dimensions?.width, item.dimensions?.height]);

  // Derived properties
  const itemWidth = cardDimensions?.width || item.dimensions?.width || 500;
  const itemHeight = cardDimensions?.height || item.dimensions?.height || 500;
  const itemFrames = item.frames || 1;
  const itemFps = item.fps || 30;
  const isPortrait = itemHeight > itemWidth;
  const selectedPreset = useMemo(() => DEVICE_PRESETS.find(p => p.id === item.presetId), [item.presetId]);

  const [isVisible, setIsVisible] = useState(true);

  const isPlayingRef = useRef(isPlaying);
  const pagSurfaceRef = useRef<any>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const [isCardHovered, setIsCardHovered] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        setIsVisible(entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '1200px' });
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Concurrent slot: all mounted cards on active page or 'All' play simultaneously
  const hasActiveSlot = true;

  useEffect(() => {
    let isCanceled = false;

    const loadAndPlay = async () => {
      if (!isVisible) {
        if (playerRef.current) {
          try { playerRef.current.pauseAnimation?.(); } catch (e) {}
        }
        return;
      }

      // If player is already constructed, resume smoothly without re-rendering
      if (playerRef.current) {
        if (isPlayingRef.current && !globalPausedRef.current) {
          try { playerRef.current.startAnimation?.(); } catch (e) {}
        }
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

            const newDims = { width: cfgW, height: cfgH };
            item.dimensions = newDims;
            item.fps = vapConfig?.info?.f || 24;
            item.frames = Math.floor((video.duration || 3) * item.fps);
            setCardDimensions(newDims);
            onUpdateItem?.({ dimensions: newDims, fps: item.fps, frames: item.frames });
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

            if (isPlayingRef.current && !globalPausedRef.current) {
              video.play().catch(() => {});
            } else {
              video.pause();
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
            const newDims = { width: pagFile.width(), height: pagFile.height() };
            item.dimensions = newDims;
            item.fps = pagFile.frameRate() || 30;
            item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);
            setCardDimensions(newDims);
            onUpdateItem?.({ dimensions: newDims, fps: item.fps, frames: item.frames });
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
            
            if (isPlayingRef.current && !globalPausedRef.current && playerRef.current) {
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
          const newDims = { width: videoItem.videoSize?.width || 500, height: videoItem.videoSize?.height || 500 };
          item.dimensions = newDims;
          item.fps = videoItem.FPS || videoItem.fps || 30;
          item.frames = videoItem.frames || 1;
          setCardDimensions(newDims);
          onUpdateItem?.({ dimensions: newDims, fps: item.fps, frames: item.frames });
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
      
      if (isPlayingRef.current && !globalPausedRef.current && !isGlobalPaused) {
        playerRef.current.startAnimation();
      } else {
        playerRef.current.pauseAnimation();
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
      }
      playerRef.current = null;
      pagSurfaceRef.current = null;
    };
  }, [item.url, item.type, isVisible]);

  // Update animation state when globalPaused changes or isVisible changes or isPlaying changes
  useEffect(() => {
    if (playerRef.current) {
      if (item.type === "pag") {
        // PAG handling is manual in a render loop
      } else {
        if (isVisible && !isGlobalPaused && !globalPausedRef.current && isPlaying) {
          try { playerRef.current.startAnimation?.(); } catch (e) {}
        } else {
          try { playerRef.current.pauseAnimation?.(); } catch (e) {}
        }
      }
    }
  }, [isGlobalPaused, isVisible, isPlaying]);

    // Separate effect for Zoom and Preset style updates - much faster and smoother
    useEffect(() => {
      const updateCanvasStyles = () => {
        if (!wrapperRef.current || !containerRef.current) return;
        
        const wrapperWidth = wrapperRef.current.clientWidth;
        const wrapperHeight = wrapperRef.current.clientHeight;
        const svgaWidth = cardDimensions?.width || item.dimensions?.width || 500;
        const svgaHeight = cardDimensions?.height || item.dimensions?.height || 500;
  
        // Fixed container dimensions matching preset, custom, or native file
        const containerWidth = (customDimensions && customDimensions.width > 0) ? customDimensions.width : (selectedPreset ? selectedPreset.width : svgaWidth);
        const containerHeight = (customDimensions && customDimensions.height > 0) ? customDimensions.height : (selectedPreset ? selectedPreset.height : svgaHeight);
  
        // 1. Scale the SVGA to fit inside the target container
        const svgaScale = Math.min(containerWidth / svgaWidth, containerHeight / svgaHeight);
        const finalSvgaWidth = svgaWidth * svgaScale;
        const finalSvgaHeight = svgaHeight * svgaScale;
  
        // 2. Scale the container to fit inside the card wrapper
        const wrapperScale = Math.min(wrapperWidth / containerWidth, wrapperHeight / containerHeight);
  
        const userScale = item.scale !== undefined ? item.scale : 1;
        const userPosX = item.posX || 0;
        const userPosY = item.posY || 0;

        // Size the inner container to exactly match the scaled SVGA dimensions
        // and scale it down to fit the wrapper with zero empty spaces
        Object.assign(containerRef.current.style, {
          width: `${finalSvgaWidth}px`,
          height: `${finalSvgaHeight}px`,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${userPosX}px), calc(-50% + ${userPosY}px)) scale(${wrapperScale * zoom * userScale})`,
          transformOrigin: 'center center',
          zIndex: '1',
          opacity: item.opacity !== undefined ? String(item.opacity) : '1'
        });
  
        const canvas = containerRef.current.querySelector('canvas, video');
        if (canvas) {
          Object.assign((canvas as HTMLElement).style, {
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'contain'
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
    }, [selectedPreset, zoom, item.dimensions, cardDimensions, customDimensions, item.scale, item.posX, item.posY, item.opacity]);

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

  return (
    <motion.div 
      layout
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="group relative bg-[#0b1022]/90 hover:bg-[#0e142a] rounded-3xl border-2 border-white/10 hover:border-indigo-500/70 transition-all duration-300 hover:shadow-[0_10px_40px_rgba(99,102,241,0.2)] flex flex-col w-full min-w-0 overflow-hidden shadow-2xl"
    >
      {/* Preview Area - Matches uploaded dimensions with zero empty margin spaces */}
      <div 
        ref={wrapperRef}
        className="relative bg-slate-950/90 flex items-center justify-center overflow-hidden w-full transition-all"
        style={{ 
          aspectRatio: selectedPreset 
            ? `${selectedPreset.width} / ${selectedPreset.height}` 
            : (customDimensions && customDimensions.width > 0 && customDimensions.height > 0)
            ? `${customDimensions.width} / ${customDimensions.height}`
            : `${itemWidth} / ${itemHeight}`,
          width: '100%'
        }}
      >
        {previewBg && <img src={previewBg} alt="Background" className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" referrerPolicy="no-referrer" />}
        <div 
          ref={containerRef} 
          className="z-10 pointer-events-none"
        />

        {/* Watermark */}
        {(wmSettings?.enabled || watermark) && (
          <WatermarkOverlay 
            watermark={watermark} 
            settings={wmSettings} 
            onUpdateSettings={(newSettings) => updateAndSaveWmSettings(prev => ({ ...prev, ...newSettings }))}
            onOpenModal={() => setIsWatermarkModalOpen(true)}
          />
        )}
        
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <div className={`absolute top-3.5 left-3.5 z-30 transition-opacity duration-300 ${isSelected ? 'opacity-100' : (isCardHovered ? 'opacity-100' : 'opacity-0 pointer-events-none')}`}>
            <button
              onClick={onToggleSelect}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                isSelected ? "bg-indigo-500 border-indigo-400 text-white shadow-indigo-500/50 scale-105" : "bg-black/70 backdrop-blur-md border-white/60 hover:border-white hover:bg-black/90 text-transparent"
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
          <div className={`absolute ${onToggleSelect ? 'top-14' : 'top-3.5'} left-3.5 z-20 px-3 py-1 bg-indigo-500/90 backdrop-blur-md border border-indigo-400/60 rounded-xl flex items-center gap-1.5 shadow-xl transition-opacity duration-300 ${isCardHovered ? 'opacity-100' : 'opacity-30'}`}>
            <Volume2 className="w-4 h-4 text-white animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-wider">مدمج صوت 🔊</span>
          </div>
        )}

        {/* Info Badge */}
        <div className={`absolute bottom-3.5 left-3.5 flex flex-col gap-1.5 z-20 transition-opacity duration-300 ${isCardHovered ? 'opacity-100' : 'opacity-40'}`}>
          <div className="px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl flex items-center gap-2 shadow-xl" dir="ltr">
            <span className="text-[11px] font-black text-white font-mono tracking-wide">
              {selectedPreset ? `${selectedPreset.width} × ${selectedPreset.height}` : `${itemWidth} × ${itemHeight}`}
            </span>
            {isPortrait ? <Smartphone className="w-3.5 h-3.5 text-sky-400" /> : <Monitor className="w-3.5 h-3.5 text-indigo-400" />}
          </div>
          {selectedPreset && (
            <div className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-500/50 rounded-lg text-[9px] font-black text-indigo-200 uppercase tracking-wider text-center shadow-md">
              مقاس إجباري (Fill)
            </div>
          )}
        </div>
        
        {/* Overlay Center Controls */}
        <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-5 z-20 transition-all duration-300 ${isCardHovered ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-95'}`}>
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 bg-white text-slate-950 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.4)] cursor-pointer"
              title={isPlaying ? "إيقاف مؤقت" : "تشغيل الأنيميشن"}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button 
              onClick={replay}
              className="w-12 h-12 bg-white/25 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl cursor-pointer hover:bg-white/35 border border-white/30"
              title="إعادة التشغيل من أول إطار"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="w-48 px-4 py-2.5 bg-black/80 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col gap-1.5 shadow-2xl">
            <div className="flex justify-between items-center text-[10px] font-black text-white">
              <span className="tracking-wide">تكبير العرض (Zoom)</span>
              <span className="text-indigo-400 font-mono font-black text-xs">{Math.round(zoom * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="3" 
              step="0.1" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>

        {/* Prominent Vertical Action Dock on the SIDE (تختفي تماماً وتظهر بالكامل عند مرور الماوس فقط) */}
        <div className={`absolute top-3.5 right-3.5 flex flex-col gap-2 z-30 bg-black/95 backdrop-blur-xl p-2 rounded-2xl border-2 border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] transition-all duration-300 ${isCardHovered ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-90'}`}>
          <button 
            onClick={onRemove}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 border border-red-500/30"
            title="حذف هذا الملف"
          >
            <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button 
            onClick={onMaximize}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 border border-indigo-500/30"
            title="تكبير ملء الشاشة"
          >
            <Maximize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          {onExportVideo && (
            <button 
              onClick={onExportVideo}
              className={`w-8 h-8 sm:w-9 sm:h-9 ${item.type === 'vap' ? 'bg-indigo-600 text-white shadow-indigo-500/40' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30'} rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95`}
              title={item.type === 'vap' ? "تصدير VAP إلى MP4" : "تصدير كفيديو MP4"}
            >
              <Video className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          )}
          <button 
            onClick={onDownloadSvga}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-500/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 border border-blue-500/30"
            title={item.type === 'vap' ? "تنزيل ملف VAP" : item.type === 'pag' ? "تنزيل ملف PAG" : "تنزيل ملف SVGA"}
          >
            <Download className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button 
            onClick={onDownload}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 border border-emerald-500/30"
            title="أخذ لقطة صورة فورية"
          >
            <Camera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button 
            onClick={onDownloadGiftBundle || onDownloadSvga}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-amber-500/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 border border-amber-500/30"
            title="حزمة الهدية (الملف + أحلى كادر صورة في ملف ZIP)"
          >
            <Gift className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button 
            onClick={() => setShowItemControls(!showItemControls)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 ${showItemControls ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-purple-500/50' : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20'}`}
            title="تخصيص الهدية (الشفافية، الحجم، الموضع)"
          >
            <SlidersHorizontal className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 ${showInfo ? 'bg-indigo-500 text-white shadow-indigo-500/50' : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20'}`}
            title="تفاصيل ومعلومات الملف"
          >
            <Info className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-4 sm:p-5 bg-white/[0.03] z-10 border-t border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
            {item.type === 'vap' && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-[10px] font-black text-indigo-300 uppercase shrink-0 shadow-sm">
                VAP
              </span>
            )}
            {item.type === 'pag' && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/30 border border-amber-400/50 text-[10px] font-black text-amber-300 uppercase shrink-0 shadow-sm">
                PAG
              </span>
            )}
            {item.type !== 'vap' && item.type !== 'pag' && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/25 border border-blue-400/40 text-[10px] font-black text-blue-300 uppercase shrink-0 shadow-sm">
                SVGA
              </span>
            )}
            <h4 className="text-white font-black text-sm sm:text-base truncate tracking-wide" title={item.name}>
              {item.name}
            </h4>
          </div>
          <span className="text-xs text-slate-400 font-mono font-bold shrink-0 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
            {(item.size / 1024).toFixed(1)} KB
          </span>
        </div>
        
        {/* Preset Selector & Custom Button Row */}
        <div className="flex items-center gap-2.5">
          <select 
            value={item.presetId}
            onChange={(e) => onUpdatePreset(e.target.value)}
            className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-inner"
          >
            <option value="auto">تلقائي (Native)</option>
            {DEVICE_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowItemControls(!showItemControls)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              showItemControls 
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/30' 
                : 'bg-white/5 border-white/15 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="تحكم مخصص للهدية"
          >
            <SlidersHorizontal className="w-4 h-4 text-purple-300" />
            <span>تخصيص الهدية</span>
          </button>
        </div>

        {/* Dedicated Independent Controls Panel for this SVGA Item */}
        <AnimatePresence>
          {showItemControls && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden p-2.5 bg-slate-900/90 border border-purple-500/30 rounded-xl space-y-2.5 shadow-inner"
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
