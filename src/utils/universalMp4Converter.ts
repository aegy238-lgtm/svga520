import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';
import { drawCustomBackground, drawAnimatedWatermark, WatermarkConfig } from './watermarkAndBackground';
import { extractVapConfigFromBlob, seekVideoToFrame, WebGLVapRenderer, prepareAudioDataChunks } from './vapEngine';
import { extractAllSvgaAudioTracks, mixAudioTracksToBuffer, encodeAudioBufferToMuxer } from './svgaVideoAudioExporter';
import { extractGifFrames } from '../components/AnimationManager/utils/exportEngine';

export type SupportedSourceFormat = 'yyeva' | 'vap' | 'mp4' | 'webm' | 'gif' | 'png_seq' | 'svga';

export interface UniversalConvertItem {
  id: string;
  name: string;
  format: SupportedSourceFormat;
  file?: File;
  url: string;
  size?: number;
}

export interface UniversalConvertOptions {
  bgType?: 'black' | 'white' | 'green' | 'custom';
  customBgUrl?: string | null;
  customBgMode?: 'cover' | 'contain' | 'stretch';
  watermarkConfig?: WatermarkConfig;
  quality?: 'high' | 'medium' | 'low';
  targetResolution?: 'original' | '720p' | '1080p';
  onProgress?: (percent: number, statusText: string) => void;
  cancelSignal?: { cancelled: boolean };
}

export interface UniversalConvertResult {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  totalFrames: number;
}

const makeEven = (n: number) => {
  const val = Math.max(2, Math.round(n));
  return val % 2 === 0 ? val : val + 1;
};

/**
 * Determines the most universally compatible AVC (H.264) codec supported by the browser.
 * Ensures strict playback compatibility with WhatsApp, Android, iOS, and social platforms.
 */
async function getCompatibleAvcCodec(width: number, height: number): Promise<string> {
  const pixels = width * height;
  const candidates = pixels > 2073600
    ? ['avc1.640033', 'avc1.4d0033', 'avc1.4d002a', 'avc1.42001f']
    : ['avc1.4d002a', 'avc1.640028', 'avc1.42001f', 'avc1.4d001f'];

  for (const c of candidates) {
    try {
      if (typeof (window as any).VideoEncoder?.isConfigSupported === 'function') {
        const support = await (window as any).VideoEncoder.isConfigSupported({
          codec: c,
          width,
          height,
          bitrate: 4000000,
          framerate: 30,
          avc: { format: 'avc' }
        });
        if (support?.supported) return c;
      }
    } catch {}
  }
  return 'avc1.4d002a';
}

/**
 * Preloads background image if custom background is specified
 */
async function loadBgImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Helper to ensure a File or Blob is available from the item
 */
async function getBlobFromItem(item: UniversalConvertItem): Promise<Blob> {
  if (item.file) return item.file;
  const res = await fetch(item.url);
  return await res.blob();
}

/**
 * Safely loads a video element from Blob or URL with proper MIME type assignment,
 * multi-event listeners, fallback timers, and error diagnosis.
 */
function loadVideoSafely(
  source: Blob | string,
  fileName?: string
): Promise<{ video: HTMLVideoElement; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.autoplay = false;

    let blobUrl = '';
    if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        video.crossOrigin = 'anonymous';
      }
      blobUrl = source;
      video.src = source;
    } else {
      // Determine correct mime type if missing or generic
      let mimeType = source.type;
      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '') {
        const lowerName = (fileName || '').toLowerCase();
        if (lowerName.endsWith('.webm')) mimeType = 'video/webm';
        else if (lowerName.endsWith('.mp4')) mimeType = 'video/mp4';
        else mimeType = 'video/mp4';
      }
      const typedBlob = source.type === mimeType ? source : new Blob([source], { type: mimeType });
      blobUrl = URL.createObjectURL(typedBlob);
      video.src = blobUrl;
    }

    let isDone = false;
    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
      if (blobUrl && typeof source !== 'string') {
        try { URL.revokeObjectURL(blobUrl); } catch {}
      }
    };

    const handleSuccess = () => {
      if (!isDone) {
        isDone = true;
        resolve({ video, cleanup });
      }
    };

    const handleError = (e?: any) => {
      if (!isDone) {
        isDone = true;
        const mediaErr = video.error;
        let msg = 'فشل تحميل وتشغيل الفيديو';
        if (mediaErr) {
          if (mediaErr.code === 3) {
            msg = 'فشل فك ترميز ملف الفيديو (تأكد من سلامة صيغة الملف)';
          } else if (mediaErr.code === 4) {
            msg = 'صيغة الفيديو أو ترميزه غير مدعوم في المتصفح الحالي';
          } else if (mediaErr.code === 2) {
            msg = 'خطأ شبكة أثناء قراءة الفيديو';
          }
        }
        cleanup();
        reject(new Error(msg));
      }
    };

    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        handleSuccess();
      }
    };
    video.onloadeddata = handleSuccess;
    video.oncanplay = handleSuccess;
    video.oncanplaythrough = handleSuccess;
    video.onerror = handleError;

    video.load();

    // Fallback timer if events don't fire but video is loaded
    setTimeout(() => {
      if (!isDone) {
        if (video.readyState >= 1 || (video.videoWidth > 0 && video.videoHeight > 0)) {
          handleSuccess();
        } else {
          handleError();
        }
      }
    }, 8000);
  });
}

/**
 * Universal function to convert ANY animation format (YYEVA, VAP, SVGA, WebM, GIF, PNG Seq ZIP, MP4)
 * into a single standard, professional MP4 video file.
 */
export async function convertItemToStandardMp4(
  item: UniversalConvertItem,
  options: UniversalConvertOptions = {}
): Promise<UniversalConvertResult> {
  const {
    bgType = 'black',
    customBgUrl,
    customBgMode = 'cover',
    watermarkConfig,
    quality = 'high',
    targetResolution = 'original',
    onProgress,
    cancelSignal
  } = options;

  if (typeof (window as any).VideoEncoder === 'undefined') {
    throw new Error('متصفحك لا يدعم VideoEncoder (WebCodecs). يرجى استخدام متصفح حديث مثل Google Chrome أو Microsoft Edge.');
  }

  onProgress?.(5, 'جاري فحص وتجهيز الملف...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const bgImg = (bgType === 'custom' && customBgUrl) ? await loadBgImage(customBgUrl) : null;
  const blob = await getBlobFromItem(item);

  // Router based on format
  switch (item.format) {
    case 'yyeva':
    case 'vap':
      return await convertYyevaVapToMp4(item, blob, isYyeva(item), bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
    
    case 'svga':
      return await convertSvgaToMp4(item, blob, bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
    
    case 'webm':
    case 'mp4':
      return await convertVideoToMp4(item, blob, bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
    
    case 'gif':
      return await convertGifToMp4(item, blob, bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
    
    case 'png_seq':
      return await convertPngSeqToMp4(item, blob, bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
    
    default:
      return await convertVideoToMp4(item, blob, bgType, bgImg, customBgMode, watermarkConfig, quality, targetResolution, onProgress, cancelSignal);
  }
}

function isYyeva(item: UniversalConvertItem): boolean {
  if (item.format === 'yyeva') return true;
  if (item.format === 'vap') return false;
  const name = item.name.toLowerCase();
  return name.includes('yyeva') || name.includes('right_alpha');
}

/**
 * Apply selected background onto the canvas
 */
function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch'
) {
  if (bgType === 'custom' && bgImg) {
    drawCustomBackground(ctx, width, height, bgImg, bgMode);
  } else if (bgType === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else if (bgType === 'green') {
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, width, height);
  } else {
    // Default black/dark background for clean video display
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Get optimal bitrate based on resolution and quality
 */
function getBitrate(width: number, height: number, quality: 'high' | 'medium' | 'low') {
  const pixels = width * height;
  let mult = 4.0;
  if (quality === 'medium') mult = 2.2;
  if (quality === 'low') mult = 1.2;
  const raw = Math.round(pixels * mult);
  return Math.min(20000000, Math.max(1500000, raw));
}

/**
 * 1. Convert YYEVA or Tencent VAP to Standard MP4
 * YYEVA: Left half = RGB, Right half = Alpha
 * VAP: Left half = Alpha, Right half = RGB
 */
async function convertYyevaVapToMp4(
  item: UniversalConvertItem,
  blob: Blob,
  isYYEVA: boolean,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch',
  watermarkConfig: WatermarkConfig | undefined,
  quality: 'high' | 'medium' | 'low',
  targetResolution: 'original' | '720p' | '1080p',
  onProgress?: (percent: number, statusText: string) => void,
  cancelSignal?: { cancelled: boolean }
): Promise<UniversalConvertResult> {
  onProgress?.(10, 'جاري تحليل قنوات الألفا (Alpha) والألوان...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const config = await extractVapConfigFromBlob(blob);
  const { video, cleanup } = await loadVideoSafely(blob, item.name);

  try {

    const vw = video.videoWidth || 1000;
    const vh = video.videoHeight || 1000;
    const duration = video.duration || 3;

    let nativeSingleW = Math.round(vw / 2);
    let nativeSingleH = vh;

    // Check if configuration provides exact frame specs
    if (config?.info?.w && config?.info?.h) {
      nativeSingleW = config.info.w;
      nativeSingleH = config.info.h;
    }

    let outW = nativeSingleW;
    let outH = nativeSingleH;

    if (targetResolution === '1080p') {
      if (outH > outW) { outW = 1080; outH = 1920; }
      else { outW = 1920; outH = 1080; }
    } else if (targetResolution === '720p') {
      if (outH > outW) { outW = 720; outH = 1280; }
      else { outW = 1280; outH = 720; }
    }

    outW = makeEven(outW);
    outH = makeEven(outH);

    let fps = config?.info?.fps || 30;
    if (fps <= 0 || fps > 60) fps = 30;
    const totalFrames = Math.max(1, Math.round(duration * fps));

    onProgress?.(15, 'جاري استخراج المسار الصوتي إن وجد...');
    let audioDataChunks: any[] = [];
    try {
      audioDataChunks = await prepareAudioDataChunks(blob, duration);
    } catch (e) {
      console.warn('No audio extracted or audio failed:', e);
    }
    const hasAudio = audioDataChunks.length > 0;

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: outW,
        height: outH,
        frameRate: fps
      },
      audio: hasAudio ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000
      } : undefined,
      fastStart: 'in-memory'
    });

    const bitrate = getBitrate(outW, outH, quality);
    const codecStr = await getCompatibleAvcCodec(outW, outH);

    let encoderError: any = null;
    const videoEncoder = new (window as any).VideoEncoder({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => { encoderError = e; console.error('VideoEncoder error:', e); }
    });

    videoEncoder.configure({
      codec: codecStr,
      width: outW,
      height: outH,
      bitrate: bitrate,
      framerate: fps,
      latencyMode: 'quality',
      avc: { format: 'avc' }
    });

    if (hasAudio) {
      const audioEncoder = new (window as any).AudioEncoder({
        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
        error: (e: any) => console.error('AudioEncoder error:', e)
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: 128000
      });
      for (const chunk of audioDataChunks) {
        audioEncoder.encode(chunk);
        chunk.close();
      }
      await audioEncoder.flush();
    }

    // Try WebGL renderer for fast alpha blending
    let webglRenderer: WebGLVapRenderer | null = null;
    try {
      webglRenderer = new WebGLVapRenderer(nativeSingleW, nativeSingleH);
    } catch (e) {
      console.warn('WebGL init warning in universal converter:', e);
    }

    // Prepare 2D output Canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!outCtx) throw new Error('تعذر إنشاء لوحة المعالجة');

    // Scratch canvases for fallback if WebGL is not present
    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = nativeSingleW;
    scratchCanvas.height = nativeSingleH;
    const scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });

    const rgbX = isYYEVA ? 0 : nativeSingleW;
    const alphaX = isYYEVA ? nativeSingleW : 0;

    for (let i = 0; i < totalFrames; i++) {
      if (cancelSignal?.cancelled) throw new Error('CANCELLED');
      if (encoderError) throw encoderError;

      const currentTime = Math.min(i / fps, Math.max(0, duration - 0.01));
      await seekVideoToFrame(video, currentTime);

      outCtx.clearRect(0, 0, outW, outH);

      // 1. Draw Background
      renderBackground(outCtx, outW, outH, bgType, bgImg, bgMode);

      // 2. Alpha composite animation
      if (webglRenderer) {
        const glCanvas = webglRenderer.render(
          video,
          [rgbX, 0, nativeSingleW, nativeSingleH],
          [alphaX, 0, nativeSingleW, nativeSingleH],
          10,
          true
        );
        outCtx.drawImage(glCanvas, 0, 0, outW, outH);
      } else if (scratchCtx) {
        // Fallback 2D Alpha compositing
        scratchCtx.clearRect(0, 0, nativeSingleW, nativeSingleH);
        scratchCtx.drawImage(video, rgbX, 0, nativeSingleW, nativeSingleH, 0, 0, nativeSingleW, nativeSingleH);
        
        const tempAlpha = document.createElement('canvas');
        tempAlpha.width = nativeSingleW;
        tempAlpha.height = nativeSingleH;
        const taCtx = tempAlpha.getContext('2d');
        if (taCtx) {
          taCtx.drawImage(video, alphaX, 0, nativeSingleW, nativeSingleH, 0, 0, nativeSingleW, nativeSingleH);
          const rgbData = scratchCtx.getImageData(0, 0, nativeSingleW, nativeSingleH);
          const alphaData = taCtx.getImageData(0, 0, nativeSingleW, nativeSingleH);
          const rP = rgbData.data;
          const aP = alphaData.data;
          for (let p = 0; p < rP.length; p += 4) {
            const alphaVal = (aP[p] * 0.299 + aP[p + 1] * 0.587 + aP[p + 2] * 0.114) / 255;
            rP[p + 3] = alphaVal <= 0.03 ? 0 : Math.round(alphaVal * 255);
          }
          scratchCtx.putImageData(rgbData, 0, 0);
          outCtx.drawImage(scratchCanvas, 0, 0, outW, outH);
        }
      }

      // 3. Draw Watermark if enabled
      if (watermarkConfig?.enabled) {
        drawAnimatedWatermark(outCtx, outW, outH, i, totalFrames, watermarkConfig);
      }

      // 4. Encode Video Frame
      const bitmap = await createImageBitmap(outCanvas);
      const frame = new (window as any).VideoFrame(bitmap, { timestamp: Math.round((i * 1000000) / fps) });
      videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
      frame.close();
      bitmap.close();

      const progress = 20 + Math.round((i / totalFrames) * 75);
      onProgress?.(progress, `تحويل إطار ${i + 1} من ${totalFrames} (${progress}%)...`);
    }

    await videoEncoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
    const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/_(yyeva|vap|right_alpha|left_alpha)/gi, '');
    const outFileName = `${cleanName}_standard.mp4`;

    onProgress?.(100, 'تم التحويل إلى MP4 بنجاح!');

    return {
      blob: mp4Blob,
      url: URL.createObjectURL(mp4Blob),
      fileName: outFileName,
      width: outW,
      height: outH,
      duration,
      fps,
      totalFrames
    };
  } finally {
    cleanup();
  }
}

/**
 * 2. Convert SVGA to Standard MP4
 */
async function convertSvgaToMp4(
  item: UniversalConvertItem,
  blob: Blob,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch',
  watermarkConfig: WatermarkConfig | undefined,
  quality: 'high' | 'medium' | 'low',
  targetResolution: 'original' | '720p' | '1080p',
  onProgress?: (percent: number, statusText: string) => void,
  cancelSignal?: { cancelled: boolean }
): Promise<UniversalConvertResult> {
  onProgress?.(10, 'جاري تهيئة محرك SVGA وتحليل الإطارات...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const svgaLib = typeof window !== 'undefined' ? (window as any).SVGA : null;
  if (!svgaLib) throw new Error('مكتبة SVGA غير محملة');

  const parser = new svgaLib.Parser();
  const blobUrl = URL.createObjectURL(blob);
  let videoItem: any;

  try {
    videoItem = await new Promise<any>((res, rej) => {
      if (typeof parser.load === 'function') {
        parser.load(blobUrl, (item: any) => res(item), (err: any) => rej(err));
      } else {
        blob.arrayBuffer().then(buf => {
          const r = parser.do(buf);
          if (r && typeof r.then === 'function') r.then(res).catch(rej);
          else res(r);
        }).catch(rej);
      }
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  const fps = videoItem.FPS || 30;
  const totalFrames = Math.max(1, videoItem.frames || 1);
  const duration = totalFrames / fps;

  let outW = videoItem.videoSize?.width || 1000;
  let outH = videoItem.videoSize?.height || 1000;

  if (targetResolution === '1080p') {
    if (outH > outW) { outW = 1080; outH = 1920; }
    else { outW = 1920; outH = 1080; }
  } else if (targetResolution === '720p') {
    if (outH > outW) { outW = 720; outH = 1280; }
    else { outW = 1280; outH = 720; }
  }

  outW = makeEven(outW);
  outH = makeEven(outH);

  // Setup offscreen SVGA Player
  const playerDiv = document.createElement('div');
  playerDiv.style.width = `${outW}px`;
  playerDiv.style.height = `${outH}px`;
  playerDiv.style.position = 'fixed';
  playerDiv.style.left = '-9999px';
  playerDiv.style.top = '-9999px';
  document.body.appendChild(playerDiv);

  let audioBuffer: AudioBuffer | null = null;
  try {
    const tracks = await extractAllSvgaAudioTracks(videoItem);
    if (tracks.length > 0) {
      audioBuffer = await mixAudioTracksToBuffer(tracks, { durationSec: duration, fps });
    }
  } catch (e) {
    console.warn('SVGA audio notice:', e);
  }

  try {
    const player = new svgaLib.Player(playerDiv);
    if (typeof player.setContentMode === 'function') player.setContentMode('Fill');
    player.setVideoItem(videoItem);

    await new Promise(r => setTimeout(r, 60));
    player.stepToFrame(0, false);
    await new Promise(r => setTimeout(r, 60));

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: outW,
        height: outH,
        frameRate: fps
      },
      audio: audioBuffer ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: audioBuffer.sampleRate
      } : undefined,
      fastStart: 'in-memory'
    });

    const bitrate = getBitrate(outW, outH, quality);
    const codecStr = await getCompatibleAvcCodec(outW, outH);
    const videoEncoder = new (window as any).VideoEncoder({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => console.error('VideoEncoder error in SVGA:', e)
    });

    videoEncoder.configure({
      codec: codecStr,
      width: outW,
      height: outH,
      bitrate: bitrate,
      framerate: fps,
      latencyMode: 'quality',
      avc: { format: 'avc' }
    });

    if (audioBuffer) {
      await encodeAudioBufferToMuxer(audioBuffer, muxer);
    }

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = outW;
    frameCanvas.height = outH;
    const fCtx = frameCanvas.getContext('2d');
    if (!fCtx) throw new Error('فشل إنشاء لوحة المعالجة');

    for (let i = 0; i < totalFrames; i++) {
      if (cancelSignal?.cancelled) throw new Error('CANCELLED');

      player.stepToFrame(i, false);
      await new Promise(r => setTimeout(r, 12));

      const sourceCanvas = playerDiv.querySelector('canvas');
      if (sourceCanvas) {
        fCtx.clearRect(0, 0, outW, outH);
        renderBackground(fCtx, outW, outH, bgType, bgImg, bgMode);
        fCtx.drawImage(sourceCanvas, 0, 0, outW, outH);

        if (watermarkConfig?.enabled) {
          drawAnimatedWatermark(fCtx, outW, outH, i, totalFrames, watermarkConfig);
        }

        const bitmap = await createImageBitmap(frameCanvas);
        const frame = new (window as any).VideoFrame(bitmap, { timestamp: Math.round((i * 1000000) / fps) });
        videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
        frame.close();
        bitmap.close();
      }

      const progress = 15 + Math.round((i / totalFrames) * 80);
      onProgress?.(progress, `تحويل إطار ${i + 1} من ${totalFrames} (${progress}%)...`);
    }

    await videoEncoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
    const cleanName = item.name.replace(/\.[^/.]+$/, '');
    const outFileName = `${cleanName}_standard.mp4`;

    onProgress?.(100, 'تم التحويل إلى MP4 بنجاح!');

    return {
      blob: mp4Blob,
      url: URL.createObjectURL(mp4Blob),
      fileName: outFileName,
      width: outW,
      height: outH,
      duration,
      fps,
      totalFrames
    };
  } finally {
    if (playerDiv.parentNode) playerDiv.parentNode.removeChild(playerDiv);
  }
}

/**
 * 3. Convert Standard Video (WebM / MP4) to Standard MP4
 */
async function convertVideoToMp4(
  item: UniversalConvertItem,
  blob: Blob,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch',
  watermarkConfig: WatermarkConfig | undefined,
  quality: 'high' | 'medium' | 'low',
  targetResolution: 'original' | '720p' | '1080p',
  onProgress?: (percent: number, statusText: string) => void,
  cancelSignal?: { cancelled: boolean }
): Promise<UniversalConvertResult> {
  onProgress?.(10, 'جاري فك تشفير الفيديو وقراءة الإطارات...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const { video, cleanup } = await loadVideoSafely(blob, item.name);

  try {

    const vw = video.videoWidth || 720;
    const vh = video.videoHeight || 720;
    const duration = video.duration || 3;
    const fps = 30;
    const totalFrames = Math.max(1, Math.round(duration * fps));

    let outW = vw;
    let outH = vh;

    if (targetResolution === '1080p') {
      if (outH > outW) { outW = 1080; outH = 1920; }
      else { outW = 1920; outH = 1080; }
    } else if (targetResolution === '720p') {
      if (outH > outW) { outW = 720; outH = 1280; }
      else { outW = 1280; outH = 720; }
    }

    outW = makeEven(outW);
    outH = makeEven(outH);

    let audioDataChunks: any[] = [];
    try {
      audioDataChunks = await prepareAudioDataChunks(blob, duration);
    } catch (e) {
      console.warn('Audio prep notice in video export:', e);
    }
    const hasAudio = audioDataChunks.length > 0;

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: outW,
        height: outH,
        frameRate: fps
      },
      audio: hasAudio ? {
        codec: 'aac',
        numberOfChannels: 2,
        sampleRate: 48000
      } : undefined,
      fastStart: 'in-memory'
    });

    const bitrate = getBitrate(outW, outH, quality);
    const codecStr = await getCompatibleAvcCodec(outW, outH);
    const videoEncoder = new (window as any).VideoEncoder({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => console.error('VideoEncoder error in video export:', e)
    });

    videoEncoder.configure({
      codec: codecStr,
      width: outW,
      height: outH,
      bitrate: bitrate,
      framerate: fps,
      latencyMode: 'quality',
      avc: { format: 'avc' }
    });

    if (hasAudio) {
      const audioEncoder = new (window as any).AudioEncoder({
        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
        error: (e: any) => console.error('AudioEncoder error:', e)
      });
      audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: 128000
      });
      for (const chunk of audioDataChunks) {
        audioEncoder.encode(chunk);
        chunk.close();
      }
      await audioEncoder.flush();
    }

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = outW;
    frameCanvas.height = outH;
    const fCtx = frameCanvas.getContext('2d');
    if (!fCtx) throw new Error('فشل إنشاء لوحة المعالجة');

    for (let i = 0; i < totalFrames; i++) {
      if (cancelSignal?.cancelled) throw new Error('CANCELLED');

      const currentTime = Math.min(i / fps, Math.max(0, duration - 0.01));
      await seekVideoToFrame(video, currentTime);

      fCtx.clearRect(0, 0, outW, outH);
      renderBackground(fCtx, outW, outH, bgType, bgImg, bgMode);
      fCtx.drawImage(video, 0, 0, outW, outH);

      if (watermarkConfig?.enabled) {
        drawAnimatedWatermark(fCtx, outW, outH, i, totalFrames, watermarkConfig);
      }

      const bitmap = await createImageBitmap(frameCanvas);
      const frame = new (window as any).VideoFrame(bitmap, { timestamp: Math.round((i * 1000000) / fps) });
      videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
      frame.close();
      bitmap.close();

      const progress = 15 + Math.round((i / totalFrames) * 80);
      onProgress?.(progress, `تحويل إطار ${i + 1} من ${totalFrames} (${progress}%)...`);
    }

    await videoEncoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
    const cleanName = item.name.replace(/\.[^/.]+$/, '');
    const outFileName = `${cleanName}_standard.mp4`;

    onProgress?.(100, 'تم التحويل إلى MP4 بنجاح!');

    return {
      blob: mp4Blob,
      url: URL.createObjectURL(mp4Blob),
      fileName: outFileName,
      width: outW,
      height: outH,
      duration,
      fps,
      totalFrames
    };
  } finally {
    cleanup();
  }
}

/**
 * 4. Convert Animated GIF to Standard MP4
 */
async function convertGifToMp4(
  item: UniversalConvertItem,
  blob: Blob,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch',
  watermarkConfig: WatermarkConfig | undefined,
  quality: 'high' | 'medium' | 'low',
  targetResolution: 'original' | '720p' | '1080p',
  onProgress?: (percent: number, statusText: string) => void,
  cancelSignal?: { cancelled: boolean }
): Promise<UniversalConvertResult> {
  onProgress?.(10, 'جاري استخراج إطارات GIF المتحركة...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const { canvases, delays, fps } = await extractGifFrames(blob, 'transparent');
  if (canvases.length === 0) throw new Error('تعذر استخراج إطارات ملف GIF');

  const totalFrames = canvases.length;
  const frameWidth = canvases[0].width;
  const frameHeight = canvases[0].height;
  const totalDurationMs = delays.reduce((a, b) => a + b, 0);
  const duration = Math.max(0.5, totalDurationMs / 1000);

  let outW = frameWidth;
  let outH = frameHeight;

  if (targetResolution === '1080p') {
    if (outH > outW) { outW = 1080; outH = 1920; }
    else { outW = 1920; outH = 1080; }
  } else if (targetResolution === '720p') {
    if (outH > outW) { outW = 720; outH = 1280; }
    else { outW = 1280; outH = 720; }
  }

  outW = makeEven(outW);
  outH = makeEven(outH);

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outW,
      height: outH,
      frameRate: Math.max(10, fps)
    },
    fastStart: 'in-memory'
  });

  const bitrate = getBitrate(outW, outH, quality);
  const codecStr = await getCompatibleAvcCodec(outW, outH);
  const videoEncoder = new (window as any).VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error('VideoEncoder error in GIF export:', e)
  });

  videoEncoder.configure({
    codec: codecStr,
    width: outW,
    height: outH,
    bitrate: bitrate,
    framerate: Math.max(10, fps),
    latencyMode: 'quality',
    avc: { format: 'avc' }
  });

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = outW;
  frameCanvas.height = outH;
  const fCtx = frameCanvas.getContext('2d');
  if (!fCtx) throw new Error('فشل إنشاء لوحة المعالجة');

  let accumTimeUs = 0;
  for (let i = 0; i < totalFrames; i++) {
    if (cancelSignal?.cancelled) throw new Error('CANCELLED');

    fCtx.clearRect(0, 0, outW, outH);
    renderBackground(fCtx, outW, outH, bgType, bgImg, bgMode);
    fCtx.drawImage(canvases[i], 0, 0, outW, outH);

    if (watermarkConfig?.enabled) {
      drawAnimatedWatermark(fCtx, outW, outH, i, totalFrames, watermarkConfig);
    }

    const bitmap = await createImageBitmap(frameCanvas);
    const frame = new (window as any).VideoFrame(bitmap, { timestamp: accumTimeUs });
    videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
    frame.close();
    bitmap.close();

    const delayMs = delays[i] || 100;
    accumTimeUs += Math.round(delayMs * 1000);

    const progress = 20 + Math.round((i / totalFrames) * 75);
    onProgress?.(progress, `تحويل إطار ${i + 1} من ${totalFrames} (${progress}%)...`);
  }

  await videoEncoder.flush();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
  const cleanName = item.name.replace(/\.[^/.]+$/, '');
  const outFileName = `${cleanName}_standard.mp4`;

  onProgress?.(100, 'تم التحويل إلى MP4 بنجاح!');

  return {
    blob: mp4Blob,
    url: URL.createObjectURL(mp4Blob),
    fileName: outFileName,
    width: outW,
    height: outH,
    duration,
    fps: Math.max(10, fps),
    totalFrames
  };
}

/**
 * 5. Convert PNG Sequence (ZIP) to Standard MP4
 */
async function convertPngSeqToMp4(
  item: UniversalConvertItem,
  blob: Blob,
  bgType: 'black' | 'white' | 'green' | 'custom',
  bgImg: HTMLImageElement | null,
  bgMode: 'cover' | 'contain' | 'stretch',
  watermarkConfig: WatermarkConfig | undefined,
  quality: 'high' | 'medium' | 'low',
  targetResolution: 'original' | '720p' | '1080p',
  onProgress?: (percent: number, statusText: string) => void,
  cancelSignal?: { cancelled: boolean }
): Promise<UniversalConvertResult> {
  onProgress?.(10, 'جاري فك ضغط سلسلة الصور من ملف ZIP...');
  if (cancelSignal?.cancelled) throw new Error('CANCELLED');

  const zip = await JSZip.loadAsync(blob);
  const imageFiles: { name: string; file: JSZip.JSZipObject }[] = [];

  zip.forEach((path, entry) => {
    if (!entry.dir && /\.(png|jpe?g|webp)$/i.test(path)) {
      imageFiles.push({ name: path, file: entry });
    }
  });

  if (imageFiles.length === 0) {
    throw new Error('لم يتم العثور على أي ملفات صور (PNG/JPG) داخل الملف المضغوط');
  }

  // Sort natural numeric order (e.g. frame_001.png, frame_002.png)
  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  onProgress?.(15, `تم العثور على ${imageFiles.length} إطار، جاري التحضير...`);

  // Load first image to determine base resolution
  const firstBlob = await imageFiles[0].file.async('blob');
  const firstBitmap = await createImageBitmap(firstBlob);
  const frameWidth = firstBitmap.width;
  const frameHeight = firstBitmap.height;
  firstBitmap.close();

  let outW = frameWidth;
  let outH = frameHeight;

  if (targetResolution === '1080p') {
    if (outH > outW) { outW = 1080; outH = 1920; }
    else { outW = 1920; outH = 1080; }
  } else if (targetResolution === '720p') {
    if (outH > outW) { outW = 720; outH = 1280; }
    else { outW = 1280; outH = 720; }
  }

  outW = makeEven(outW);
  outH = makeEven(outH);

  const fps = 30;
  const totalFrames = imageFiles.length;
  const duration = totalFrames / fps;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outW,
      height: outH,
      frameRate: fps
    },
    fastStart: 'in-memory'
  });

  const bitrate = getBitrate(outW, outH, quality);
  const codecStr = await getCompatibleAvcCodec(outW, outH);
  const videoEncoder = new (window as any).VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error('VideoEncoder error in PNG seq export:', e)
  });

  videoEncoder.configure({
    codec: codecStr,
    width: outW,
    height: outH,
    bitrate: bitrate,
    framerate: fps,
    latencyMode: 'quality',
    avc: { format: 'avc' }
  });

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = outW;
  frameCanvas.height = outH;
  const fCtx = frameCanvas.getContext('2d');
  if (!fCtx) throw new Error('فشل إنشاء لوحة المعالجة');

  for (let i = 0; i < totalFrames; i++) {
    if (cancelSignal?.cancelled) throw new Error('CANCELLED');

    const imgBlob = await imageFiles[i].file.async('blob');
    const bitmap = await createImageBitmap(imgBlob);

    fCtx.clearRect(0, 0, outW, outH);
    renderBackground(fCtx, outW, outH, bgType, bgImg, bgMode);
    fCtx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close();

    if (watermarkConfig?.enabled) {
      drawAnimatedWatermark(fCtx, outW, outH, i, totalFrames, watermarkConfig);
    }

    const frameBitmap = await createImageBitmap(frameCanvas);
    const frame = new (window as any).VideoFrame(frameBitmap, { timestamp: Math.round((i * 1000000) / fps) });
    videoEncoder.encode(frame, { keyFrame: i % 30 === 0 || i === 0 });
    frame.close();
    frameBitmap.close();

    const progress = 20 + Math.round((i / totalFrames) * 75);
    onProgress?.(progress, `معالجة صورة ${i + 1} من ${totalFrames} (${progress}%)...`);
  }

  await videoEncoder.flush();
  muxer.finalize();

  const buffer = muxer.target.buffer;
  const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
  const cleanName = item.name.replace(/\.[^/.]+$/, '');
  const outFileName = `${cleanName}_standard.mp4`;

  onProgress?.(100, 'تم التحويل إلى MP4 بنجاح!');

  return {
    blob: mp4Blob,
    url: URL.createObjectURL(mp4Blob),
    fileName: outFileName,
    width: outW,
    height: outH,
    duration,
    fps,
    totalFrames
  };
}
