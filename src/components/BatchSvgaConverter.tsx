import React, { useState, useRef, useEffect } from 'react';
import { UserRecord, AppSettings } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { logActivity } from '../utils/logger';
import { 
  Download, Trash2, Upload, Play, Check, X, Layers, Settings, RefreshCw, 
  Video, FileVideo, Gauge, Eye, Image as ImageIcon, Shield, Sparkles, 
  Sliders, Type, Palette, ShieldAlert, StopCircle, ArrowDownCircle
} from 'lucide-react';
import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';
import { exportAsGif, exportAsWebm } from './AnimationManager/utils/exportEngine';
import { extractAllSvgaAudioTracks, mixAudioTracksToBuffer, encodeAudioBufferToMuxer } from '../utils/svgaVideoAudioExporter';
import { MultiFormatAnimationPlayer, ViewerItem, detectViewerFormat } from './MultiFormatAnimationPlayer';
import { drawCustomBackground, drawAnimatedWatermark, WatermarkConfig } from '../utils/watermarkAndBackground';
import { convertItemToStandardMp4 } from '../utils/universalMp4Converter';

declare var SVGA: any;
declare var VideoEncoder: any;
declare var VideoFrame: any;

export type BatchExportFormat = 'yyeva' | 'vap' | 'mp4' | 'webm' | 'gif' | 'png_seq';

interface SvgaFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  targetFormat?: BatchExportFormat;
}

interface BatchSvgaConverterProps {
  onCancel: () => void;
  currentUser: UserRecord | null;
  settings: AppSettings | null;
  onLoginRequired: () => void;
  onSubscriptionRequired: () => void;
  initialFiles?: File[];
}

/**
 * Helper to pause execution based on chosen rendering speed to allow canvas updates
 */
const waitDelay = async (mode: 'turbo' | 'fast' | 'balanced' | 'accurate') => {
  if (mode === 'turbo') {
    await new Promise(r => setTimeout(r, 6));
  } else if (mode === 'fast') {
    await new Promise(r => setTimeout(r, 16));
  } else if (mode === 'balanced') {
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 12)));
  } else {
    await new Promise(r => setTimeout(r, 45));
  }
};

/**
 * Get proper file extension and suffix based on format
 */
const getExportSuffix = (format: BatchExportFormat) => {
  switch (format) {
    case 'yyeva': return '_YYEVA.mp4';
    case 'vap': return '_VAP.mp4';
    case 'mp4': return '.mp4';
    case 'webm': return '.webm';
    case 'gif': return '.gif';
    case 'png_seq': return '_Sequence.zip';
    default: return '.mp4';
  }
};

/**
 * Real client-side injection of 'vapc' (Tencent VAP) and 'yyea' (YYEVA) metadata box structure in standard MP4 files.
 */
const injectMetadataBoxes = (
  buffer: ArrayBuffer,
  singleWidth: number,
  singleHeight: number,
  totalFrames: number,
  fps: number,
  format: 'vap' | 'yyeva'
): ArrayBuffer => {
  const isYYEVA = format === 'yyeva';
  const videoW = singleWidth * 2;
  const videoH = singleHeight;

  // Compliant user data JSON config structure
  const config = {
    descript: {
      width: singleWidth,
      height: singleHeight,
      isEffect: 0,
      matchVersion: "1.0",
      rgbFrame: isYYEVA ? [0, 0, singleWidth, singleHeight] : [singleWidth, 0, singleWidth, singleHeight],
      alphaFrame: isYYEVA ? [singleWidth, 0, singleWidth, singleHeight] : [0, 0, singleWidth, singleHeight],
      fps: fps,
      totalFrame: totalFrames,
      version: 1
    },
    info: {
      v: 2,
      f: totalFrames,
      w: singleWidth,
      h: singleHeight,
      fps: fps,
      videoW: videoW,
      videoH: videoH,
      aFrame: isYYEVA ? [singleWidth, 0, singleWidth, singleHeight] : [0, 0, singleWidth, singleHeight],
      rgbFrame: isYYEVA ? [0, 0, singleWidth, singleHeight] : [singleWidth, 0, singleWidth, singleHeight],
      isVapx: 0,
      codeTag: isYYEVA ? ["common", "yyeva"] : ["common"],
      orien: 0
    }
  };

  const jsonStr = JSON.stringify(config);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // Box 1: Build 'vapc' box
  const vapcSize = 8 + jsonBytes.length;
  const vapcBuffer = new Uint8Array(vapcSize);
  const vapcView = new DataView(vapcBuffer.buffer);
  vapcView.setUint32(0, vapcSize);
  vapcBuffer[4] = 0x76; // 'v'
  vapcBuffer[5] = 0x61; // 'a'
  vapcBuffer[6] = 0x70; // 'p'
  vapcBuffer[7] = 0x63; // 'c'
  vapcBuffer.set(jsonBytes, 8);

  let extraSize = vapcSize;
  let yyeaBuffer: Uint8Array | null = null;

  if (isYYEVA) {
    // Box 2: Build 'yyea' box for YYEVA player compatibility
    const yyeaSize = 8 + jsonBytes.length;
    yyeaBuffer = new Uint8Array(yyeaSize);
    const yyeaView = new DataView(yyeaBuffer.buffer);
    yyeaView.setUint32(0, yyeaSize);
    yyeaBuffer[4] = 0x79; // 'y'
    yyeaBuffer[5] = 0x79; // 'y'
    yyeaBuffer[6] = 0x65; // 'e'
    yyeaBuffer[7] = 0x61; // 'a'
    yyeaBuffer.set(jsonBytes, 8);
    extraSize += yyeaSize;
  }

  const combined = new Uint8Array(buffer.byteLength + extraSize);
  combined.set(new Uint8Array(buffer), 0);
  
  let offset = buffer.byteLength;
  combined.set(vapcBuffer, offset);
  offset += vapcSize;

  if (yyeaBuffer) {
    combined.set(yyeaBuffer, offset);
  }

  return combined.buffer;
};

export const BatchSvgaConverter: React.FC<BatchSvgaConverterProps> = ({ 
  onCancel, 
  currentUser, 
  settings, 
  onLoginRequired, 
  onSubscriptionRequired, 
  initialFiles 
}) => {
  const { checkAccess } = useAccessControl();
  const [activeTab, setActiveTab] = useState<'converter' | 'viewer'>('converter');
  const [viewerItems, setViewerItems] = useState<ViewerItem[]>([]);
  const [files, setFiles] = useState<SvgaFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<BatchExportFormat>('yyeva');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [scale, setScale] = useState<number>(1);
  const [renderSpeed, setRenderSpeed] = useState<'turbo' | 'fast' | 'balanced' | 'accurate'>('balanced');
  const [previewItem, setPreviewItem] = useState<{ url: string; name: string; format: BatchExportFormat } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom Background for Display & Merging
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [customBgMode, setCustomBgMode] = useState<'cover' | 'contain' | 'stretch'>('cover');
  const [mergeBgInExport, setMergeBgInExport] = useState<boolean>(false);
  const customBgImgRef = useRef<HTMLImageElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Anti-Theft Animated Watermark
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    enabled: false,
    text: '© محتوى محمي - يمنع السرقة',
    opacity: 0.45,
    fontSize: 24,
    color: '#ffffff',
    textColor: '#ffffff',
    style: 'bouncing'
  });

  const shouldStopRef = useRef(false);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const newFiles: SvgaFile[] = initialFiles.map(file => ({
        file,
        id: Math.random().toString(36).substring(2, 11) + Date.now() + Math.random().toString(36).substr(2, 4),
        status: 'pending',
        progress: 0,
        targetFormat: exportFormat
      }));
      setFiles(newFiles);

      Promise.all(initialFiles.map(async file => {
        const detected = await detectViewerFormat(file);
        return {
          id: `init_viewer_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
          name: file.name,
          file,
          url: URL.createObjectURL(file),
          format: detected,
          size: file.size
        } as ViewerItem;
      })).then(items => {
        setViewerItems(items);
      });
    }
  }, [initialFiles]);

  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
      });
      viewerItems.forEach(item => {
        if (item.url && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
      });
      if (customBgUrl && customBgUrl.startsWith('blob:')) URL.revokeObjectURL(customBgUrl);
    };
  }, []);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomBgUrl(url);
    const img = new Image();
    img.src = url;
    customBgImgRef.current = img;
    setMergeBgInExport(true);
    if (bgFileInputRef.current) bgFileInputRef.current.value = '';
  };

  const removeCustomBg = () => {
    if (customBgUrl && customBgUrl.startsWith('blob:')) {
      URL.revokeObjectURL(customBgUrl);
    }
    setCustomBgUrl(null);
    customBgImgRef.current = null;
    setMergeBgInExport(false);
  };

  const applyFormatToAll = (fmt: BatchExportFormat) => {
    setExportFormat(fmt);
    setFiles(prev => prev.map(f => ({ ...f, targetFormat: fmt })));
  };

  const setFileTargetFormat = (id: string, fmt: BatchExportFormat) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, targetFormat: fmt } : f));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;

    const newFiles: SvgaFile[] = selectedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11) + Date.now() + Math.random().toString(36).substr(2, 4),
      status: 'pending',
      progress: 0,
      targetFormat: exportFormat
    }));
    setFiles(prev => [...prev, ...newFiles]);

    // Also populate viewer items so the viewer tab is always ready
    Promise.all(selectedFiles.map(async file => {
      const detected = await detectViewerFormat(file);
      return {
        id: `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        file,
        url: URL.createObjectURL(file),
        format: detected,
        size: file.size
      } as ViewerItem;
    })).then(items => {
      setViewerItems(prev => [...items, ...prev]);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.resultUrl) URL.revokeObjectURL(file.resultUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const stopProcessing = () => {
    shouldStopRef.current = true;
    setIsProcessing(false);
  };

  const processAll = async () => {
    if (isProcessing) return;
    
    const { allowed } = await checkAccess('svgaProcess', { subscriptionOnly: true });
    if (!allowed) {
      if (!currentUser) onLoginRequired();
      else onSubscriptionRequired();
      return;
    }

    shouldStopRef.current = false;
    setIsProcessing(true);
    
    for (let i = 0; i < files.length; i++) {
      if (shouldStopRef.current) break;
      if (files[i].status === 'done') continue;
      
      try {
        await processFile(files[i].id);
      } catch (err) {
        console.error(`Error processing ${files[i].file.name}:`, err);
        setFiles(prev => prev.map(f => f.id === files[i].id ? { ...f, status: 'error', error: String(err) } : f));
      }
    }
    
    setIsProcessing(false);
  };

  const processFile = async (id: string) => {
    const fileObj = files.find(f => f.id === id);
    if (!fileObj) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 0 } : f));

    // If file is not an SVGA file (e.g. YYEVA MP4, Tencent VAP MP4, WebM, GIF, PNG ZIP, regular MP4),
    // route directly to the Universal Converter engine with full audio preservation!
    if (!fileObj.file.name.toLowerCase().endsWith('.svga')) {
      try {
        const detected = await detectViewerFormat(fileObj.file);
        const result = await convertItemToStandardMp4({
          id: fileObj.id,
          name: fileObj.file.name,
          format: detected,
          file: fileObj.file,
          url: URL.createObjectURL(fileObj.file)
        }, {
          bgType: mergeBgInExport && customBgImgRef.current ? 'custom' : 'black',
          customBgUrl: customBgUrl,
          customBgMode: customBgMode,
          watermarkConfig: watermarkConfig.enabled ? watermarkConfig : undefined,
          quality: quality,
          onProgress: (pct) => {
            setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: pct } : f));
          }
        });

        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: 'done',
          progress: 100,
          resultBlob: result.blob,
          resultUrl: result.url
        } : f));
        return;
      } catch (err: any) {
        console.error('Non-svga conversion error:', err);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: err?.message || 'فشل التحويل' } : f));
        return;
      }
    }

    let playerDiv: HTMLDivElement | null = null;
    return new Promise<void>(async (resolve, reject) => {
      try {
        // 1. Wait for SVGA library availability
        if (typeof window !== 'undefined' && !(window as any).SVGA) {
          await new Promise((r) => {
            const t = setInterval(() => {
              if ((window as any).SVGA) {
                clearInterval(t);
                r(true);
              }
            }, 50);
            setTimeout(() => { clearInterval(t); r(false); }, 3000);
          });
        }

        const svgaLib = typeof window !== 'undefined' ? (window as any).SVGA : (typeof SVGA !== 'undefined' ? SVGA : null);
        if (!svgaLib) throw new Error("SVGA engine library is not loaded");

        const parser = new svgaLib.Parser();
        const blobUrl = URL.createObjectURL(fileObj.file);
        let videoItem: any;

        try {
          videoItem = await new Promise<any>((res, rej) => {
            if (typeof parser.load === 'function') {
              parser.load(blobUrl, (item: any) => res(item), (err: any) => rej(err));
            } else if (typeof parser.loadViaWorker === 'function') {
              parser.loadViaWorker(blobUrl, (item: any) => res(item), (err: any) => rej(err));
            } else if (typeof parser.do === 'function') {
              fileObj.file.arrayBuffer().then(buf => {
                const resDo = parser.do(buf);
                if (resDo && typeof resDo.then === 'function') {
                  resDo.then(res).catch(rej);
                } else {
                  res(resDo);
                }
              }).catch(rej);
            } else {
              rej(new Error("SVGA Parser load method not found"));
            }
          });
        } finally {
          URL.revokeObjectURL(blobUrl);
        }

        const fps = videoItem.FPS || 30;
        const totalFrames = Math.max(1, videoItem.frames || 1);
        
        // Ensure even dimensions constraint
        const rawWidth = videoItem.videoSize?.width || 1334;
        const rawHeight = videoItem.videoSize?.height || 750;
        
        let width = Math.floor((rawWidth * scale) / 2) * 2;
        let height = Math.floor((rawHeight * scale) / 2) * 2;
        
        if (isNaN(width) || width <= 0) width = 1334;
        if (isNaN(height) || height <= 0) height = 750;

        const currentFormat = fileObj.targetFormat || exportFormat;
        const isVap = currentFormat === 'vap' || currentFormat === 'yyeva';
        const isYYEVA = currentFormat === 'yyeva';
        const exportWidth = isVap ? width * 2 : width;
        const exportHeight = height;

        // 2. Setup Player container offscreen with strict layout dimensions
        playerDiv = document.createElement('div');
        playerDiv.style.width = `${width}px`;
        playerDiv.style.height = `${height}px`;
        playerDiv.style.position = 'fixed';
        playerDiv.style.left = '-9999px';
        playerDiv.style.top = '-9999px';
        playerDiv.style.overflow = 'hidden';
        document.body.appendChild(playerDiv);

        const player = new svgaLib.Player(playerDiv);
        if (typeof player.setContentMode === 'function') {
          player.setContentMode('Fill');
        }
        player.setVideoItem(videoItem);

        // 3. Wait for SVGA renderer to finish decoding internal bitmaps
        await new Promise<void>((resWait) => {
          let elapsed = 0;
          const checkInterval = setInterval(() => {
            elapsed += 40;
            const isPrepared = (player as any)._renderer?._prepared;
            if (isPrepared !== false || elapsed >= 2500) {
              clearInterval(checkInterval);
              resWait();
            }
          }, 40);
        });

        // Warm up the renderer at frame 0
        player.stepToFrame(0, false);
        await new Promise(r => setTimeout(r, 60));

        // 4. Extract and mix audio if available
        let audioBuffer: AudioBuffer | null = null;
        try {
          const tracks = await extractAllSvgaAudioTracks(videoItem);
          if (tracks.length > 0) {
            audioBuffer = await mixAudioTracksToBuffer(tracks, {
              durationSec: totalFrames / fps,
              fps,
            });
          }
        } catch (audioErr) {
          console.warn("[Batch Converter] Audio track extraction skipped/failed:", audioErr);
        }

        // ==========================================
        // Branch A: GIF Animation Export
        // ==========================================
        if (currentFormat === 'gif') {
          const canvases: HTMLCanvasElement[] = [];
          const delays: number[] = [];
          const frameDelay = Math.max(10, Math.round(1000 / fps));

          for (let i = 0; i < totalFrames; i++) {
            if (shouldStopRef.current) break;
            player.stepToFrame(i, false);
            await waitDelay(renderSpeed);

            const sourceCanvas = playerDiv.querySelector('canvas');
            if (sourceCanvas) {
              const frameCanvas = document.createElement('canvas');
              frameCanvas.width = width;
              frameCanvas.height = height;
              const fCtx = frameCanvas.getContext('2d');
              if (fCtx) {
                if (mergeBgInExport && customBgImgRef.current) {
                  drawCustomBackground(fCtx, width, height, customBgImgRef.current, customBgMode);
                }
                fCtx.drawImage(sourceCanvas, 0, 0, width, height);
                if (watermarkConfig.enabled) {
                  drawAnimatedWatermark(fCtx, width, height, i, totalFrames, watermarkConfig);
                }
              }
              canvases.push(frameCanvas);
              delays.push(frameDelay);
            }

            const prog = Math.round(((i + 1) / totalFrames) * 70);
            setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
          }

          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 85 } : f));
          const gifBlob = await exportAsGif(canvases, delays, width, height);
          const gifUrl = URL.createObjectURL(gifBlob);

          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            status: 'done', 
            progress: 100, 
            resultBlob: gifBlob, 
            resultUrl: gifUrl 
          } : f));

          if (playerDiv && playerDiv.parentNode) playerDiv.parentNode.removeChild(playerDiv);
          resolve();
          return;
        }

        // ==========================================
        // Branch B: WebM (VP9 with Alpha Channel)
        // ==========================================
        if (currentFormat === 'webm') {
          const canvases: HTMLCanvasElement[] = [];
          const delays: number[] = [];
          const frameDelay = Math.max(10, Math.round(1000 / fps));

          for (let i = 0; i < totalFrames; i++) {
            if (shouldStopRef.current) break;
            player.stepToFrame(i, false);
            await waitDelay(renderSpeed);

            const sourceCanvas = playerDiv.querySelector('canvas');
            if (sourceCanvas) {
              const frameCanvas = document.createElement('canvas');
              frameCanvas.width = width;
              frameCanvas.height = height;
              const fCtx = frameCanvas.getContext('2d');
              if (fCtx) {
                if (mergeBgInExport && customBgImgRef.current) {
                  drawCustomBackground(fCtx, width, height, customBgImgRef.current, customBgMode);
                }
                fCtx.drawImage(sourceCanvas, 0, 0, width, height);
                if (watermarkConfig.enabled) {
                  drawAnimatedWatermark(fCtx, width, height, i, totalFrames, watermarkConfig);
                }
              }
              canvases.push(frameCanvas);
              delays.push(frameDelay);
            }

            const prog = Math.round(((i + 1) / totalFrames) * 60);
            setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
          }

          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 80 } : f));
          const webmBlob = await exportAsWebm(
            canvases, 
            delays, 
            width, 
            height, 
            fps, 
            quality === 'high' ? 100 : (quality === 'medium' ? 85 : 70),
            audioBuffer,
            (p) => {
              setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 80 + Math.round(p * 20) } : f));
            }
          );
          const webmUrl = URL.createObjectURL(webmBlob);

          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            status: 'done', 
            progress: 100, 
            resultBlob: webmBlob, 
            resultUrl: webmUrl 
          } : f));

          if (playerDiv && playerDiv.parentNode) playerDiv.parentNode.removeChild(playerDiv);
          resolve();
          return;
        }

        // ==========================================
        // Branch C: PNG Sequence (ZIP package)
        // ==========================================
        if (currentFormat === 'png_seq') {
          const zip = new JSZip();

          for (let i = 0; i < totalFrames; i++) {
            if (shouldStopRef.current) break;
            player.stepToFrame(i, false);
            await waitDelay(renderSpeed);

            const sourceCanvas = playerDiv.querySelector('canvas');
            if (sourceCanvas) {
              const frameCanvas = document.createElement('canvas');
              frameCanvas.width = width;
              frameCanvas.height = height;
              const fCtx = frameCanvas.getContext('2d');
              if (fCtx) {
                if (mergeBgInExport && customBgImgRef.current) {
                  drawCustomBackground(fCtx, width, height, customBgImgRef.current, customBgMode);
                }
                fCtx.drawImage(sourceCanvas, 0, 0, width, height);
                if (watermarkConfig.enabled) {
                  drawAnimatedWatermark(fCtx, width, height, i, totalFrames, watermarkConfig);
                }
                const dataUrl = frameCanvas.toDataURL('image/png');
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                zip.file(`frame_${String(i).padStart(4, '0')}.png`, base64Data, { base64: true });
              }
            }

            const prog = Math.round(((i + 1) / totalFrames) * 85);
            setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
          }

          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: 92 } : f));
          const zipContent = await zip.generateAsync({ type: 'blob' });
          const zipUrl = URL.createObjectURL(zipContent);

          setFiles(prev => prev.map(f => f.id === id ? { 
            ...f, 
            status: 'done', 
            progress: 100, 
            resultBlob: zipContent, 
            resultUrl: zipUrl 
          } : f));

          if (playerDiv && playerDiv.parentNode) playerDiv.parentNode.removeChild(playerDiv);
          resolve();
          return;
        }

        // ==========================================
        // Branch D: MP4 Video (VAP / YYEVA / Standard MP4)
        // ==========================================
        if (typeof VideoEncoder === 'undefined') {
          throw new Error("متصفحك لا يدعم VideoEncoder لتصدير MP4 مباشرة. يرجى استخدام متصفح يدعم WebCodecs (مثل Chrome أو Edge) أو اختيار صيغة GIF أو PNG Sequence.");
        }

        // Setup primary rendering canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        // Setup dual-channel canvas for VAP / YYEVA
        const vapCanvas = isVap ? document.createElement('canvas') : null;
        if (vapCanvas) {
          vapCanvas.width = exportWidth;
          vapCanvas.height = exportHeight;
        }
        const vCtx = vapCanvas?.getContext('2d', { willReadFrequently: true });

        // Setup scratch canvas for precise alpha mask extraction
        const tempAlphaCanvas = isVap ? document.createElement('canvas') : null;
        if (tempAlphaCanvas) {
          tempAlphaCanvas.width = width;
          tempAlphaCanvas.height = height;
        }
        const tempAlphaCtx = tempAlphaCanvas?.getContext('2d', { willReadFrequently: true });

        // Setup Mp4Muxer with optional AAC Audio
        const muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: exportWidth,
            height: exportHeight,
            frameRate: fps
          },
          audio: audioBuffer ? {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate: audioBuffer.sampleRate
          } : undefined,
          fastStart: 'in-memory'
        });

        // Setup Encoder Bitrate
        let bitrate = 8000000;
        if (quality === 'low') bitrate = 2000000;
        if (quality === 'medium') bitrate = 4500000;
        if (quality === 'high') bitrate = 10000000;
        if (isVap) bitrate *= 1.8;

        let hasEncoderError = false;
        const videoEncoder = new VideoEncoder({
          output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
          error: (e: any) => {
            console.error("VideoEncoder error in batch converter:", e);
            hasEncoderError = true;
            reject(e);
          }
        });

        const videoConfig: any = {
          codec: 'avc1.4d002a', // Main Profile 4.2 - universally compatible with WhatsApp & Mobile
          width: exportWidth,
          height: exportHeight,
          bitrate: bitrate,
          framerate: fps,
          latencyMode: 'quality',
          avc: { format: 'avc' }
        };

        const support = await VideoEncoder.isConfigSupported(videoConfig);
        if (!support.supported) {
          videoConfig.codec = 'avc1.640028';
          const support2 = await VideoEncoder.isConfigSupported(videoConfig);
          if (!support2.supported) {
            videoConfig.codec = 'avc1.42001f';
          }
        }
        
        videoEncoder.configure(videoConfig);

        // Process video frames
        for (let i = 0; i < totalFrames; i++) {
          if (hasEncoderError || shouldStopRef.current) break;
          player.stepToFrame(i, false);
          
          await waitDelay(renderSpeed);
          
          const sourceCanvas = playerDiv.querySelector('canvas');
          if (sourceCanvas) {
            if (isVap && vCtx && tempAlphaCtx && tempAlphaCanvas) {
              // 1. Fill entire VAP canvas with solid black (RGB=0,0,0, A=255)
              vCtx.fillStyle = '#000000';
              vCtx.fillRect(0, 0, exportWidth, exportHeight);

              // 2. Draw custom background in RGB area if enabled
              const rgbX = isYYEVA ? 0 : width;
              if (mergeBgInExport && customBgImgRef.current) {
                vCtx.save();
                vCtx.translate(rgbX, 0);
                drawCustomBackground(vCtx, width, height, customBgImgRef.current, customBgMode);
                vCtx.restore();
              }

              // 3. Draw RGB channel (rendered on opaque black or background)
              vCtx.drawImage(sourceCanvas, rgbX, 0, width, height);

              // 4. Draw Animated Watermark in RGB area to protect against theft
              if (watermarkConfig.enabled) {
                vCtx.save();
                vCtx.translate(rgbX, 0);
                drawAnimatedWatermark(vCtx, width, height, i, totalFrames, watermarkConfig);
                vCtx.restore();
              }

              // 5. Build exact grayscale alpha mask in tempAlphaCanvas
              tempAlphaCtx.clearRect(0, 0, width, height);
              if (mergeBgInExport && customBgImgRef.current) {
                // Background merged: the entire background frame is opaque
                tempAlphaCtx.fillStyle = '#ffffff';
                tempAlphaCtx.fillRect(0, 0, width, height);
              } else {
                tempAlphaCtx.drawImage(sourceCanvas, 0, 0, width, height);
                const imgData = tempAlphaCtx.getImageData(0, 0, width, height);
                const px = imgData.data;

                // Convert every pixel's alpha value to true opaque grayscale (R=A, G=A, B=A, Alpha=255)
                for (let p = 0; p < px.length; p += 4) {
                  const alphaVal = px[p + 3];
                  px[p] = alphaVal;     // Red
                  px[p + 1] = alphaVal; // Green
                  px[p + 2] = alphaVal; // Blue
                  px[p + 3] = 255;      // Fully opaque
                }
                tempAlphaCtx.putImageData(imgData, 0, 0);

                if (watermarkConfig.enabled) {
                  tempAlphaCtx.save();
                  drawAnimatedWatermark(tempAlphaCtx, width, height, i, totalFrames, {
                    ...watermarkConfig,
                    textColor: '#ffffff',
                    opacity: 1.0
                  });
                  tempAlphaCtx.restore();
                }
              }

              // 6. Draw Alpha mask
              // YYEVA: Right (width, 0) | VAP: Left (0, 0)
              const alphaX = isYYEVA ? width : 0;
              vCtx.drawImage(tempAlphaCanvas, alphaX, 0, width, height);
              
              // 7. Encode frame with KeyFrame on frame 0 and every 30 frames
              const bitmap = await createImageBitmap(vapCanvas);
              const frame = new VideoFrame(bitmap, { timestamp: Math.round((i * 1000000) / fps) });
              videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
              frame.close();
              bitmap.close();
            } else {
              // Standard MP4: Composited cleanly on black background or custom background
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                if (mergeBgInExport && customBgImgRef.current) {
                  drawCustomBackground(ctx, width, height, customBgImgRef.current, customBgMode);
                }
                ctx.drawImage(sourceCanvas, 0, 0, width, height);
                if (watermarkConfig.enabled) {
                  drawAnimatedWatermark(ctx, width, height, i, totalFrames, watermarkConfig);
                }
                
                const bitmap = await createImageBitmap(canvas);
                const frame = new VideoFrame(bitmap, { timestamp: Math.round((i * 1000000) / fps) });
                videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
                frame.close();
                bitmap.close();
              }
            }
          }

          const prog = Math.round(((i + 1) / totalFrames) * 90);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
        }

        if (hasEncoderError) throw new Error("VideoEncoder encountered an error during frame rendering.");

        // Encode and mux audio track if available
        if (audioBuffer) {
          try {
            await encodeAudioBufferToMuxer(audioBuffer, muxer, false);
          } catch (audioMuxErr) {
            console.warn("[Batch Converter] Audio muxing skipped:", audioMuxErr);
          }
        }

        await videoEncoder.flush();
        videoEncoder.close();
        muxer.finalize();
        
        const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
        
        // Inject VAP / YYEVA compliant user data boxes
        let finalBuffer = buffer;
        if (isVap) {
          try {
            finalBuffer = injectMetadataBoxes(buffer, width, height, totalFrames, fps, currentFormat as 'vap' | 'yyeva');
          } catch (boxErr) {
            console.error("Failed to inject binary metadata boxes:", boxErr);
          }
        }

        const blob = new Blob([finalBuffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        setFiles(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: 'done', 
          progress: 100, 
          resultBlob: blob, 
          resultUrl: url 
        } : f));

        // Clean offscreen nodes
        if (playerDiv && playerDiv.parentNode) {
          playerDiv.parentNode.removeChild(playerDiv);
        }
        resolve();
      } catch (err) {
        if (playerDiv && playerDiv.parentNode) {
          playerDiv.parentNode.removeChild(playerDiv);
        }
        reject(err);
      }
    });
  };

  const downloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
    if (doneFiles.length === 0) return;

    const suffix = getExportSuffix(exportFormat);

    if (doneFiles.length === 1) {
      const link = document.createElement('a');
      link.href = doneFiles[0].resultUrl!;
      link.download = doneFiles[0].file.name.replace(/\.[^/.]+$/, '') + suffix;
      link.click();
      return;
    }

    const zip = new JSZip();
    doneFiles.forEach(f => {
      const fileName = f.file.name.replace(/\.[^/.]+$/, '') + suffix;
      zip.file(fileName, f.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    if (currentUser) {
      logActivity(currentUser, 'export', `Batch converted ${doneFiles.length} SVGA files to ${exportFormat.toUpperCase()}`);
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `converted_animations_${exportFormat}_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#020617] pt-24 pb-12 px-4 sm:px-6 font-arabic" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="space-y-2 text-right">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
                <Video className="w-6 h-6 text-pink-400" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">محول وعارض ملفات SVGA والحركات</h1>
            </div>
            <p className="text-slate-400 font-medium">تحويل فوري عالي الدقة، مع مشغل متكامل يدعم YYEVA، وTencent VAP، وWebM، وGIF، وMP4، وسلاسل PNG</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              إلغاء
            </button>
            {activeTab === 'converter' && (
              <button
                onClick={processAll}
                disabled={isProcessing || files.length === 0}
                className={`px-8 py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-pink-600/20 transition-all active:scale-95 flex items-center gap-2`}
              >
                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                بدء التحويل الجماعي
              </button>
            )}
          </div>
        </div>

        {/* Navigation Mode Switcher Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 border border-white/10 rounded-2xl mb-8 max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab('converter')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'converter'
                ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-lg shadow-pink-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            تحويل SVGA الجماعي
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('viewer')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'viewer'
                ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-lg shadow-pink-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            مشغل وعارض الصيغ الشامل
          </button>
        </div>

        {/* Tab 1: Universal Multi-Format Player & Viewer */}
        {activeTab === 'viewer' && (
          <div className="space-y-6">
            <MultiFormatAnimationPlayer 
              items={viewerItems} 
              customBgUrl={customBgUrl}
              watermarkConfig={watermarkConfig}
            />
          </div>
        )}

        {/* Tab 2: Batch SVGA Converter */}
        {activeTab === 'converter' && (
          <>
            {/* Settings Bar */}
            <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-6 mb-8 flex flex-wrap items-center gap-8 justify-between">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-pink-400" />
                  <span className="text-sm font-bold text-slate-300">خيارات التصدير:</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase">صيغة التصدير</span>
                  <div className="flex flex-wrap bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
                    <button
                      type="button"
                      onClick={() => setExportFormat('yyeva')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'yyeva' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="تنسيق YYEVA: الألوان RGB على اليسار والشفافية Alpha على اليمين مع ميتاداتا yyea مدمجة"
                    >
                      YYEVA (ألفا يمين)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('vap')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'vap' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="تنسيق Tencent VAP: الشفافية Alpha على اليسار والألوان RGB على اليمين مع ميتاداتا vapc"
                    >
                      Tencent VAP (ألفا يسار)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('mp4')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'mp4' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="فيديو MP4 قياسي بخلفية سوداء"
                    >
                      MP4 عادي
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('webm')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'webm' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="فيديو WebM VP9 شفاف حقيقي بدون تقسيم"
                    >
                      WebM شفاف
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('gif')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'gif' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="صورة متحركة GIF شفافة"
                    >
                      GIF متحرك
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('png_seq')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'png_seq' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                      title="حزمة ZIP لسلسلة إطارات PNG الشفافة"
                    >
                      سلسلة PNG (ZIP)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase">دقة الرندر والتشفير</span>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as any)}
                    className="bg-black/40 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  >
                    <option value="low">منخفضة (حجم صغير)</option>
                    <option value="medium">متوسطة متوازنة</option>
                    <option value="high">عالية الدقة (للبث والتطبيقات)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-500 uppercase">مقياس الأبعاد (Scale)</span>
                  <select
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="bg-black/40 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                  >
                    <option value="0.5">0.5x (نصف الحجم)</option>
                    <option value="1">1.0x (الحجم الأصلي الدقيق)</option>
                    <option value="1.5">1.5x (أكبر وأوضح)</option>
                    <option value="2">2.0x (دقة فائقة 2K)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-r border-white/10 pr-6">
                <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-amber-400" />
                  سرعة المعالجة والإطارات
                </span>
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setRenderSpeed('turbo')}
                    className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'turbo' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                    title="تصدير فائق السرعة"
                  >
                    برق (Turbo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderSpeed('fast')}
                    className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'fast' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    title="تصدير سريع للأداء الجيد"
                  >
                    سريع
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderSpeed('balanced')}
                    className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'balanced' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    title="المعدل الموصى به لضمان تحديث كافة الإطارات"
                  >
                    متوازن
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenderSpeed('accurate')}
                    className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'accurate' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                    title="أقصى دقة للملفات الكبيرة والمعقدة"
                  >
                    دقيق جداً
                  </button>
                </div>
              </div>
            </div>

            {/* Background & Watermark Control Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Box 1: Custom Background & Merging */}
              <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                      <ImageIcon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">خلفية العرض والدمج في الفيديو</h3>
                      <p className="text-[11px] text-slate-400 font-medium">رفع صورة خلفية لعرضها أو دمجها خلف الحركة المصدرة</p>
                    </div>
                  </div>
                  {customBgUrl && (
                    <button
                      onClick={removeCustomBg}
                      className="text-xs text-red-400 hover:text-red-300 font-bold"
                    >
                      إزالة الخلفية
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {customBgUrl ? (
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/10 group flex-shrink-0">
                      <img src={customBgUrl} alt="Background" className="w-full h-full object-cover" />
                      <button
                        onClick={() => bgFileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-all"
                      >
                        تغيير
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bgFileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4 text-pink-400" />
                      رفع صورة خلفية (PNG / JPG / WebP)
                    </button>
                  )}
                  <input
                    type="file"
                    ref={bgFileInputRef}
                    onChange={handleBgUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {customBgUrl && (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-300 font-bold flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mergeBgInExport}
                            onChange={(e) => setMergeBgInExport(e.target.checked)}
                            className="w-4 h-4 rounded text-pink-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-white font-black">دمج الخلفية في الملفات المصدّرة خلف الحركة</span>
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-bold">المقياس:</span>
                        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-[10px]">
                          {(['cover', 'contain', 'stretch'] as const).map(mode => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setCustomBgMode(mode)}
                              className={`px-2.5 py-1 rounded-md transition-all ${customBgMode === mode ? 'bg-pink-600 text-white font-black' : 'text-slate-400'}`}
                            >
                              {mode === 'cover' ? 'ملء (Cover)' : mode === 'contain' ? 'احتواء (Contain)' : 'تمديد (Stretch)'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Anti-Theft Animated Watermark */}
              <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
                      <Shield className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">علامة مائية متحركة لمنع السرقة</h3>
                      <p className="text-[11px] text-slate-400 font-medium">تتنقل باستمرار عبر الإطارات لتصعب السرقة والقص</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={watermarkConfig.enabled}
                      onChange={(e) => setWatermarkConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {watermarkConfig.enabled && (
                  <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        value={watermarkConfig.text}
                        onChange={(e) => setWatermarkConfig(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="نص العلامة المائية (مثال: حقوق الطبع © اسمك)"
                        className="flex-1 bg-black/40 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/10 focus:outline-none focus:ring-1 focus:ring-pink-500 w-full"
                      />
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 w-full sm:w-auto justify-between sm:justify-start">
                        {(['#ffffff', '#facc15', '#38bdf8', '#f43f5e'] as const).map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setWatermarkConfig(prev => ({ ...prev, textColor: color }))}
                            style={{ backgroundColor: color }}
                            className={`w-6 h-6 rounded-lg transition-transform ${watermarkConfig.textColor === color ? 'scale-110 ring-2 ring-white' : 'opacity-70'}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                      {[
                        { id: 'bouncing', label: 'عائمة ومتحركة 🎾' },
                        { id: 'diagonal_scroll', label: 'انسياب قطري 📜' },
                        { id: 'tiled', label: 'شبكة مكررة 🛡️' },
                        { id: 'corner_pulse', label: 'نبض بالزاوية 💫' }
                      ].map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setWatermarkConfig(prev => ({ ...prev, style: st.id as any }))}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-black transition-all ${watermarkConfig.style === st.id ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>الشفافية: {Math.round(watermarkConfig.opacity * 100)}%</span>
                      <input
                        type="range"
                        min={0.15}
                        max={0.9}
                        step={0.05}
                        value={watermarkConfig.opacity}
                        onChange={(e) => setWatermarkConfig(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                        className="w-40 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Area */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer mb-8"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-indigo-600 rounded-[3rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-[#0f172a]/80 border-2 border-dashed border-white/10 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-pink-500/50 transition-all">
                <div className="w-20 h-20 bg-pink-500/10 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Upload className="w-10 h-10 text-pink-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black text-white mb-1">اسحب أو ارفع أي ملفات هنا للتحويل الجماعي (SVGA, YYEVA, VAP, WebM, GIF, ZIP, MP4)</h3>
                  <p className="text-slate-400 font-bold text-xs mt-1">يدعم رفع وتحويل عدد كبير من الملفات دفعة واحدة إلى فيديو MP4 قياسي مع دمج الصوت والخلفية والعلامة المائية</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".svga,.mp4,.webm,.gif,.zip,.vap,video/*,image/*"
                  className="hidden"
                />
              </div>
            </div>

            {/* Files List */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 bg-slate-900/40 p-4 rounded-3xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-white font-black text-sm">الملفات المحددة ({files.length})</h2>
                    <span className="text-[11px] font-bold text-slate-400">
                      (المكتمل: {files.filter(f => f.status === 'done').length} | المتبقي: {files.filter(f => f.status !== 'done').length})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Bulk set all files format button */}
                    <button
                      onClick={() => applyFormatToAll(exportFormat)}
                      className="px-3 py-1.5 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-xl text-xs font-bold transition-all"
                      title="تطبيق الصيغة المحددة بالأعلى على جميع الملفات دفعة واحدة"
                    >
                      تطبيق صيغة ({exportFormat.toUpperCase()}) على الكل
                    </button>

                    {isProcessing && (
                      <button
                        onClick={stopProcessing}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        إيقاف مؤقت
                      </button>
                    )}

                    <button
                      onClick={() => setFiles([])}
                      disabled={isProcessing}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      مسح
                    </button>

                    <button
                      onClick={downloadAll}
                      disabled={!files.some(f => f.status === 'done')}
                      className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      تحميل الكل في ZIP
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {files.map((file) => {
                    const fileFmt = file.targetFormat || exportFormat;
                    return (
                      <div 
                        key={file.id}
                        className="bg-slate-900/40 border border-white/5 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-900/70 transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <FileVideo className="w-6 h-6 text-pink-400" />
                          </div>
                          
                          <div className="flex-1 min-w-0 text-right">
                            <h4 className="text-white font-bold truncate">{file.file.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-slate-500 font-black uppercase">{(file.file.size / 1024).toFixed(1)} KB</span>
                              {file.status === 'processing' && (
                                <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden max-w-[200px]">
                                  <div 
                                    className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-300"
                                    style={{ width: `${file.progress}%` }}
                                  />
                                </div>
                              )}
                              {file.status === 'error' && <span className="text-[10px] text-red-500 font-black truncate max-w-sm">{file.error}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Format selector per file & Action buttons */}
                        <div className="flex items-center gap-3 justify-end">
                          {/* Individual Target Format Dropdown */}
                          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/5">
                            <span className="text-[10px] text-slate-500 font-bold">الصيغة:</span>
                            <select
                              value={fileFmt}
                              onChange={(e) => setFileTargetFormat(file.id, e.target.value as BatchExportFormat)}
                              disabled={file.status === 'processing' || isProcessing}
                              className="bg-transparent text-pink-400 font-black text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="yyeva" className="bg-slate-900 text-white">YYEVA (ألفا يمين)</option>
                              <option value="vap" className="bg-slate-900 text-white">Tencent VAP (ألفا يسار)</option>
                              <option value="mp4" className="bg-slate-900 text-white">MP4 عادي</option>
                              <option value="webm" className="bg-slate-900 text-white">WebM شفاف</option>
                              <option value="gif" className="bg-slate-900 text-white">GIF متحرك</option>
                              <option value="png_seq" className="bg-slate-900 text-white">سلسلة PNG (ZIP)</option>
                            </select>
                          </div>

                          {file.status === 'done' && (
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-black text-[10px] uppercase">اكتمل التصدير</span>
                              {file.resultUrl && (
                                <button
                                  onClick={() => setPreviewItem({ url: file.resultUrl!, name: file.file.name, format: fileFmt })}
                                  className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/30 transition-all"
                                  title="معاينة وتشغيل فوري بقناة الألفا"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = file.resultUrl!;
                                  link.download = file.file.name.replace('.svga', getExportSuffix(fileFmt));
                                  link.click();
                                }}
                                className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                                title="تحميل"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Quick Result Preview Modal with MultiFormatAnimationPlayer */}
        {previewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir="rtl">
            <MultiFormatAnimationPlayer
              isModal
              onClose={() => setPreviewItem(null)}
              initialItem={{
                id: previewItem.name,
                name: previewItem.name,
                url: previewItem.url,
                format: previewItem.format
              }}
              customBgUrl={customBgUrl}
              watermarkConfig={watermarkConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
};
