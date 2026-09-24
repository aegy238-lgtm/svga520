import React, { useState, useRef, useEffect } from 'react';
import { UserRecord, AppSettings } from '../types';
import { useAccessControl } from '../hooks/useAccessControl';
import { logActivity } from '../utils/logger';
import { Download, Trash2, Upload, Play, Check, X, Layers, Settings, RefreshCw, Video, FileVideo, Gauge } from 'lucide-react';
import * as Mp4Muxer from 'mp4-muxer';

declare var SVGA: any;
declare var JSZip: any;
declare var VideoEncoder: any;
declare var VideoFrame: any;

interface SvgaFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
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
 * High-speed helper to pause the execution based on the chosen rendering speed
 */
const waitDelay = async (mode: 'turbo' | 'fast' | 'balanced' | 'accurate') => {
  if (mode === 'turbo') {
    await new Promise(r => setTimeout(r, 2));
  } else if (mode === 'fast') {
    await new Promise(r => setTimeout(r, 8));
  } else if (mode === 'balanced') {
    await new Promise(r => requestAnimationFrame(r));
  } else {
    await new Promise(r => setTimeout(r, 30));
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
  const [files, setFiles] = useState<SvgaFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'vap' | 'yyeva'>('yyeva');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [scale, setScale] = useState<number>(1);
  const [renderSpeed, setRenderSpeed] = useState<'turbo' | 'fast' | 'balanced' | 'accurate'>('balanced');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      const svgaFiles = initialFiles.filter(f => (f?.name || '').toLowerCase().endsWith('.svga'));
      const newFiles: SvgaFile[] = svgaFiles.map(file => ({
        file,
        id: Math.random().toString(36).substring(2, 11) + Date.now(),
        status: 'pending',
        progress: 0
      }));
      setFiles(newFiles);
    }
  }, [initialFiles]);

  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
      });
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const svgaFiles = selectedFiles.filter(f => (f?.name || '').toLowerCase().endsWith('.svga'));
    
    const newFiles: SvgaFile[] = svgaFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(2, 11) + Date.now(),
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.resultUrl) URL.revokeObjectURL(file.resultUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const processAll = async () => {
    if (isProcessing) return;
    
    const { allowed } = await checkAccess('svgaProcess', { subscriptionOnly: true });
    if (!allowed) {
      if (!currentUser) onLoginRequired();
      else onSubscriptionRequired();
      return;
    }

    setIsProcessing(true);
    
    for (let i = 0; i < files.length; i++) {
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

    return new Promise<void>(async (resolve, reject) => {
      try {
        const parser = new SVGA.Parser();
        const data = await fileObj.file.arrayBuffer();
        const videoItem = await new Promise<any>((res, rej) => {
          parser.do(data, (videoItem: any) => res(videoItem), (err: any) => rej(err));
        });

        const fps = videoItem.FPS || 30;
        const totalFrames = videoItem.frames;
        
        // Even dimensions constraint
        const rawWidth = videoItem.videoSize?.width || 1334;
        const rawHeight = videoItem.videoSize?.height || 750;
        
        let width = Math.floor((rawWidth * scale) / 2) * 2;
        let height = Math.floor((rawHeight * scale) / 2) * 2;
        
        if (isNaN(width) || width <= 0) width = 1334;
        if (isNaN(height) || height <= 0) height = 750;

        const isVap = exportFormat === 'vap' || exportFormat === 'yyeva';
        const exportWidth = isVap ? width * 2 : width;
        const exportHeight = height;

        // Setup Player container offscreen
        const playerDiv = document.createElement('div');
        playerDiv.style.width = `${width}px`;
        playerDiv.style.height = `${height}px`;
        playerDiv.style.position = 'fixed';
        playerDiv.style.left = '-9999px';
        document.body.appendChild(playerDiv);

        const player = new SVGA.Player(playerDiv);
        player.setVideoItem(videoItem);
        
        // Setup Canvas rendering channels
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const vapCanvas = isVap ? document.createElement('canvas') : null;
        if (vapCanvas) {
          vapCanvas.width = exportWidth;
          vapCanvas.height = exportHeight;
        }
        const vCtx = vapCanvas?.getContext('2d', { willReadFrequently: true });

        // Setup Mp4Muxer
        const muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: exportWidth,
            height: exportHeight,
            frameRate: fps
          },
          fastStart: 'in-memory'
        });

        // Setup Encoder Bitrate
        let bitrate = 8000000;
        if (quality === 'low') bitrate = 2000000;
        if (quality === 'medium') bitrate = 4500000;
        if (quality === 'high') bitrate = 10000000;
        if (isVap) bitrate *= 1.8; // needs double visual bandwidth for dual channels

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
          codec: 'avc1.640033', // High Profile 5.1
          width: exportWidth,
          height: exportHeight,
          bitrate: bitrate,
          framerate: fps,
          latencyMode: 'quality',
          avc: { format: 'avc' }
        };

        const support = await VideoEncoder.isConfigSupported(videoConfig);
        if (!support.supported) {
          videoConfig.codec = 'avc1.4d0033'; // Main 5.1 fallback
          const support2 = await VideoEncoder.isConfigSupported(videoConfig);
          if (!support2.supported) {
            videoConfig.codec = 'avc1.4d002a'; // Main 4.2 backup
          }
        }
        
        videoEncoder.configure(videoConfig);

        // Process Frames with specified speed
        for (let i = 0; i < totalFrames; i++) {
          if (hasEncoderError) break;
          player.stepToFrame(i, false); // Step frame without continuing animation
          
          await waitDelay(renderSpeed);
          
          const sourceCanvas = playerDiv.querySelector('canvas');
          if (sourceCanvas) {
            if (isVap && vCtx) {
              vCtx.clearRect(0, 0, exportWidth, exportHeight);
              const isYYEVA = exportFormat === 'yyeva';

              if (isYYEVA) {
                // YYEVA Layout: RGB on Left (0, 0), Alpha on Right (width, 0)
                vCtx.globalCompositeOperation = 'source-over';
                vCtx.fillStyle = '#000000';
                vCtx.fillRect(0, 0, width, height);
                vCtx.drawImage(sourceCanvas, 0, 0, width, height);
                
                vCtx.save();
                vCtx.translate(width, 0);
                vCtx.drawImage(sourceCanvas, 0, 0, width, height);
                vCtx.globalCompositeOperation = 'source-in';
                vCtx.fillStyle = '#ffffff';
                vCtx.fillRect(0, 0, width, height);
                vCtx.restore();
              } else {
                // Tencent VAP Layout: RGB on Right (width, 0), Alpha on Left (0, 0)
                vCtx.globalCompositeOperation = 'source-over';
                vCtx.fillStyle = '#000000';
                vCtx.fillRect(width, 0, width, height);
                vCtx.drawImage(sourceCanvas, width, 0, width, height);
                
                vCtx.save();
                vCtx.drawImage(sourceCanvas, 0, 0, width, height);
                vCtx.globalCompositeOperation = 'source-in';
                vCtx.fillStyle = '#ffffff';
                vCtx.fillRect(0, 0, width, height);
                vCtx.restore();
              }
              
              const frame = new VideoFrame(vapCanvas!, { timestamp: (i * 1000000) / fps });
              videoEncoder.encode(frame);
              frame.close();
            } else {
              // Standard MP4 (Black background)
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(sourceCanvas, 0, 0, width, height);
                
                const frame = new VideoFrame(canvas, { timestamp: (i * 1000000) / fps });
                videoEncoder.encode(frame);
                frame.close();
              }
            }
          }

          const prog = Math.round(((i + 1) / totalFrames) * 100);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, progress: prog } : f));
        }

        if (hasEncoderError) throw new Error("VideoEncoder crashed.");

        await videoEncoder.flush();
        videoEncoder.close();
        muxer.finalize();
        
        const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
        
        // Inject VAP / YYEVA compliant user data boxes
        let finalBuffer = buffer;
        if (isVap) {
          try {
            finalBuffer = injectMetadataBoxes(buffer, width, height, totalFrames, fps, exportFormat);
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
        document.body.removeChild(playerDiv);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  };

  const downloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.resultBlob);
    if (doneFiles.length === 0) return;

    if (doneFiles.length === 1) {
      const link = document.createElement('a');
      link.href = doneFiles[0].resultUrl!;
      link.download = doneFiles[0].file.name.replace('.svga', `_${exportFormat.toUpperCase()}.mp4`);
      link.click();
      return;
    }

    const zip = new JSZip();
    doneFiles.forEach(f => {
      zip.file(f.file.name.replace('.svga', `_${exportFormat.toUpperCase()}.mp4`), f.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    if (currentUser) {
      logActivity(currentUser, 'export', `Batch converted ${doneFiles.length} SVGA files to ${exportFormat.toUpperCase()}`);
    }

    const link = document.createElement('a');
    link.href = url;
    link.download = `converted_videos_${exportFormat}_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#020617] pt-24 pb-12 px-4 sm:px-6 font-arabic" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-2 text-right">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
                <Video className="w-6 h-6 text-pink-400" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">محول SVGA الجماعي</h1>
            </div>
            <p className="text-slate-400 font-medium">تحويل ملفات SVGA المتعددة إلى فيديوهات MP4 أو VAP أو YYEVA شفافة بنقرة واحدة</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              إلغاء
            </button>
            <button
              onClick={processAll}
              disabled={isProcessing || files.length === 0}
              className={`px-8 py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-pink-600/20 transition-all active:scale-95 flex items-center gap-2`}
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              بدء التحويل الجماعي
            </button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-6 mb-8 flex flex-wrap items-center gap-8 justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-pink-400" />
              <span className="text-sm font-bold text-slate-300">الإعدادات الذكية:</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase">صيغة التصدير المستهدفة</span>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setExportFormat('mp4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'mp4' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  فيديو MP4 عادي
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('vap')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'vap' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  title="الRGB على اليمين والشفافية (Alpha) على اليسار"
                >
                  Tencent VAP (يسار)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('yyeva')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${exportFormat === 'yyeva' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                  title="الRGB على اليسار والشفافية (Alpha) على اليمين"
                >
                  YYEVA (يمين)
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
                <option value="low">منخفضة (توفير الحجم)</option>
                <option value="medium">متوسطة متوازنة</option>
                <option value="high">عالية جداً (للبث المباشر)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase">مقياس الحجم (Scale)</span>
              <select
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="bg-black/40 text-white text-xs font-black px-4 py-2 rounded-xl border border-white/5 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              >
                <option value="0.5">0.5x (أصغر بكثير)</option>
                <option value="1">1.0x (الأصلي)</option>
                <option value="1.5">1.5x (أكبر وأوضح)</option>
                <option value="2">2.0x (دقة فائقة)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-r border-white/10 pr-6">
            <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-amber-400" />
              سرعة التصدير والتحويل
            </span>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setRenderSpeed('turbo')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'turbo' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="تصدير خارق السرعة للملفات البسيطة"
              >
                برق (Turbo)
              </button>
              <button
                type="button"
                onClick={() => setRenderSpeed('fast')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'fast' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="تصدير سريع للأداء المتوازن"
              >
                سريع
              </button>
              <button
                type="button"
                onClick={() => setRenderSpeed('balanced')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'balanced' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="المعدل المثالي لضمان تحديث الإطارات بالكامل"
              >
                متوازن
              </button>
              <button
                type="button"
                onClick={() => setRenderSpeed('accurate')}
                className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all ${renderSpeed === 'accurate' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                title="أقصى دقة للملفات الثقيلة جداً أو التي تحتوي على أصوات وفلاتر معقدة"
              >
                دقيق جداً
              </button>
            </div>
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
              <h3 className="text-xl font-black text-white mb-1">اسحب ملفات SVGA هنا للتحويل الجماعي</h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">أو اضغط لاختيار الملفات من جهازك</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".svga"
              className="hidden"
            />
          </div>
        </div>

        {/* Files List */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-6">
              <h2 className="text-white font-black uppercase tracking-widest text-sm">الملفات المحددة للتحويل ({files.length})</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setFiles([])}
                  className="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  مسح القائمة
                </button>
                <button
                  onClick={downloadAll}
                  disabled={!files.some(f => f.status === 'done')}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  تحميل الحزمة الكاملة (ZIP)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="bg-slate-900/40 border border-white/5 rounded-3xl p-4 flex items-center gap-4 group hover:bg-slate-900/70 transition-all"
                >
                  <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center">
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
                      {file.status === 'error' && <span className="text-[10px] text-red-500 font-black">{file.error}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.status === 'done' && (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-black text-[10px] uppercase">اكتمل بنجاح</span>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.resultUrl!;
                            link.download = file.file.name.replace('.svga', `_${exportFormat.toUpperCase()}.mp4`);
                            link.click();
                          }}
                          className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
