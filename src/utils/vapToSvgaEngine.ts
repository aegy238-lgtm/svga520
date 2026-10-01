import pako from 'pako';
import { parse } from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import { extractVapConfigFromBlob, VapConfig } from './vapEngine';
import { extractAudioFromVap } from './vapFFmpeg';
import { drawUniversalWatermarkOnCanvas, getSavedWatermarkSettings } from './watermarkAndBackground';

const rootProto = parse(svgaSchema).root;
const MovieEntity = rootProto.lookupType('com.opensource.svga.MovieEntity');

export type VapAlphaMode = 'auto' | 'right' | 'left' | 'top' | 'bottom';

export interface VapToSvgaOptions {
  fps?: number; // Target framerate: 15, 20, 24, 30, 60
  frameSampling?: 1 | 2 | 3; // 1 = all, 2 = 1 every 2, 3 = 1 every 3
  startSecond?: number;
  endSecond?: number;
  maxFrames?: number; // Optional frame cap
  quality?: number; // 0.1 to 1.0 (default: 0.8)
  format?: 'webp' | 'png';
  scale?: number; // 0.25 to 1.0 (default: 1.0)
  zlibLevel?: number; // 1 to 9 (default: 9)
  trimTransparentPadding?: boolean; // Trim transparent margins
  deduplicateFrames?: boolean; // Reuse identical images
  alphaMode?: VapAlphaMode;
  preserveAudio?: boolean;
  watermark?: string | null;
  wmSettings?: any;
  onProgress?: (progress: {
    percent: number;
    phase: string;
    currentFrame: number;
    totalFrames: number;
    currentThumb?: string;
    estimatedSecondsLeft?: number;
  }) => void;
}

export interface VapToSvgaResult {
  blob: Blob;
  stats: {
    originalSizeBytes: number;
    svgaSizeBytes: number;
    savedBytes: number;
    savedPercent: number;
    fps: number;
    totalFrames: number;
    viewBoxWidth: number;
    viewBoxHeight: number;
    durationSeconds: number;
    format: 'webp' | 'png';
    hasAudio: boolean;
  };
}

/**
 * Detect layout coordinates from video dimensions and metadata
 */
export const resolveVapLayout = (
  videoW: number,
  videoH: number,
  mode: VapAlphaMode,
  vapConfig?: VapConfig | null
): {
  rgbFrame: [number, number, number, number];
  aFrame: [number, number, number, number];
  viewWidth: number;
  viewHeight: number;
} => {
  // 1. If metadata explicitly defines frames and mode is auto
  if (mode === 'auto' && vapConfig?.info?.rgbFrame && vapConfig?.info?.aFrame) {
    const rf = vapConfig.info.rgbFrame;
    const af = vapConfig.info.aFrame;
    return {
      rgbFrame: [rf[0], rf[1], rf[2], rf[3]],
      aFrame: [af[0], af[1], af[2], af[3]],
      viewWidth: rf[2],
      viewHeight: rf[3]
    };
  }

  // 2. Standard Side-by-Side (Width is roughly double height, or w >= h)
  const isHorizontalSplit = videoW >= videoH;

  if (isHorizontalSplit) {
    const halfW = Math.floor(videoW / 2);
    if (mode === 'left') {
      // Alpha on Left, RGB on Right (YYEVA style)
      return {
        rgbFrame: [halfW, 0, halfW, videoH],
        aFrame: [0, 0, halfW, videoH],
        viewWidth: halfW,
        viewHeight: videoH
      };
    } else {
      // Alpha on Right, RGB on Left (Standard Tencent VAP)
      return {
        rgbFrame: [0, 0, halfW, videoH],
        aFrame: [halfW, 0, halfW, videoH],
        viewWidth: halfW,
        viewHeight: videoH
      };
    }
  } else {
    // Vertical Split
    const halfH = Math.floor(videoH / 2);
    if (mode === 'top') {
      // Alpha on Top, RGB on Bottom
      return {
        rgbFrame: [0, halfH, videoW, halfH],
        aFrame: [0, 0, videoW, halfH],
        viewWidth: videoW,
        viewHeight: halfH
      };
    } else {
      // Alpha on Bottom, RGB on Top
      return {
        rgbFrame: [0, 0, videoW, halfH],
        aFrame: [0, halfH, videoW, halfH],
        viewWidth: videoW,
        viewHeight: halfH
      };
    }
  }
};

/**
 * Trim transparent pixels bounding box calculation
 */
const getAlphaBoundingBox = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 6
): { minX: number; minY: number; maxX: number; maxY: number; isEmpty: boolean } => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, isEmpty: true };
  }

  return { minX, minY, maxX, maxY, isEmpty: false };
};

/**
 * Core conversion from VAP file to SVGA Blob
 */
export const convertVapFileToSvga = async (
  file: File,
  options: VapToSvgaOptions = {}
): Promise<VapToSvgaResult> => {
  const startTime = Date.now();
  const {
    fps: targetFps = 30,
    frameSampling = 1,
    startSecond = 0,
    endSecond,
    maxFrames,
    quality = 0.8,
    format = 'webp',
    scale = 1.0,
    zlibLevel = 9,
    trimTransparentPadding = false,
    deduplicateFrames = true,
    alphaMode = 'auto',
    preserveAudio = true,
    watermark,
    wmSettings,
    onProgress
  } = options;

  // Preload watermark image if provided
  let wmImgEl: HTMLImageElement | null = null;
  const wmUrl = watermark || wmSettings?.logoUrl;
  if (wmUrl) {
    wmImgEl = new Image();
    wmImgEl.crossOrigin = 'anonymous';
    wmImgEl.src = wmUrl;
    await new Promise((res) => {
      if (!wmImgEl) return res(null);
      wmImgEl.onload = () => res(null);
      wmImgEl.onerror = () => res(null);
    });
  }

  onProgress?.({
    percent: 3,
    phase: 'تحليل ترويسة ملف VAP وقناة الشفافية...',
    currentFrame: 0,
    totalFrames: 0
  });

  // 1. Extract VAP metadata (if any)
  let vapConfig: VapConfig | null = null;
  try {
    vapConfig = await extractVapConfigFromBlob(file);
  } catch (err) {
    console.warn('VAP metadata extraction skipped:', err);
  }

  // 2. Set up HTMLVideoElement for frame stepping
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('تعذر تحميل بيانات الفيديو من ملف VAP'));
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

  const duration = video.duration || 1;
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;

  if (!videoW || !videoH) {
    URL.revokeObjectURL(videoUrl);
    throw new Error('أبعاد فيديو VAP غير صالحة');
  }

  // Calculate Layout
  const layout = resolveVapLayout(videoW, videoH, alphaMode, vapConfig);
  const [rx, ry, rw, rh] = layout.rgbFrame;
  const [ax, ay, aw, ah] = layout.aFrame;

  // ViewBox dimensions with scaling applied
  const finalViewBoxW = Math.max(1, Math.round(layout.viewWidth * scale));
  const finalViewBoxH = Math.max(1, Math.round(layout.viewHeight * scale));

  // Determine effective frames to capture
  const effectiveFps = Math.max(5, Math.min(60, targetFps));
  const actualStart = Math.max(0, startSecond);
  const actualEnd = endSecond && endSecond > actualStart ? Math.min(duration, endSecond) : duration;
  const segmentDuration = Math.max(0.1, actualEnd - actualStart);

  let rawTotalFrames = Math.round(segmentDuration * effectiveFps);
  if (maxFrames && maxFrames > 0) {
    rawTotalFrames = Math.min(rawTotalFrames, maxFrames);
  }
  rawTotalFrames = Math.max(1, rawTotalFrames);

  // Apply frame sampling step
  const frameIndices: number[] = [];
  for (let i = 0; i < rawTotalFrames; i += frameSampling) {
    frameIndices.push(i);
  }
  const totalFrames = frameIndices.length;
  const finalPlaybackFps = Math.max(5, Math.round(effectiveFps / frameSampling));

  onProgress?.({
    percent: 8,
    phase: `تم الكشف: ${layout.viewWidth}×${layout.viewHeight} | إجمالي الفريمات: ${totalFrames} بمعدل ${finalPlaybackFps} FPS`,
    currentFrame: 0,
    totalFrames
  });

  // Offscreen Canvases
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = videoW;
  fullCanvas.height = videoH;
  const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });

  const compCanvas = document.createElement('canvas');
  compCanvas.width = rw;
  compCanvas.height = rh;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalViewBoxW;
  finalCanvas.height = finalViewBoxH;
  const finalCtx = finalCanvas.getContext('2d');

  if (!fullCtx || !compCtx || !finalCtx) {
    URL.revokeObjectURL(videoUrl);
    throw new Error('تعذر تهيئة سياق Canvas 2D في المتصفح');
  }

  // Assets containers
  const imagesData: Record<string, Uint8Array> = {};
  const spritesData: any[] = [];
  const spriteFramesList: Array<{ imageKey: string; frameObj: any; frameIdx: number }> = [];

  let lastImageKey = '';
  let lastImageBytes: Uint8Array | null = null;
  let lastDataUrl = '';

  const frameTimeDelta = 1 / effectiveFps;

  for (let step = 0; step < totalFrames; step++) {
    const rawFrameIdx = frameIndices[step];
    const targetTime = actualStart + rawFrameIdx * frameTimeDelta;
    video.currentTime = Math.min(duration, Math.max(0, targetTime));

    // Wait for seek to complete
    await new Promise<void>((r) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        r();
      };
      video.addEventListener('seeked', onSeeked);
      setTimeout(() => {
        video.removeEventListener('seeked', onSeeked);
        r();
      }, 350);
    });

    // 1. Draw raw video frame onto full canvas
    fullCtx.clearRect(0, 0, videoW, videoH);
    fullCtx.drawImage(video, 0, 0, videoW, videoH);

    // 2. Extract RGB & Alpha ImageData
    const rgbData = fullCtx.getImageData(rx, ry, rw, rh);
    const alphaData = fullCtx.getImageData(ax, ay, aw, ah);

    // 3. Compose RGBA with transparent alpha
    const composed = compCtx.createImageData(rw, rh);
    const cData = composed.data;
    const rData = rgbData.data;
    const aData = alphaData.data;
    const totalPixels = rData.length;

    for (let p = 0; p < totalPixels; p += 4) {
      cData[p] = rData[p];
      cData[p + 1] = rData[p + 1];
      cData[p + 2] = rData[p + 2];
      // Grayscale average for Alpha channel
      const alphaVal = Math.round((aData[p] + aData[p + 1] + aData[p + 2]) / 3);
      cData[p + 3] = alphaVal;
    }

    compCtx.putImageData(composed, 0, 0);

    // 4. Scale to target viewBox
    finalCtx.clearRect(0, 0, finalViewBoxW, finalViewBoxH);
    if (scale !== 1.0) {
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      finalCtx.drawImage(compCanvas, 0, 0, finalViewBoxW, finalViewBoxH);
    } else {
      finalCtx.drawImage(compCanvas, 0, 0);
    }

    // 4.5. Render Watermark if active
    if (wmSettings || watermark || wmImgEl) {
      const activeSettings = wmSettings || (watermark ? { enabled: true, logoUrl: watermark, type: 'image' } : getSavedWatermarkSettings());
      drawUniversalWatermarkOnCanvas(finalCtx, finalViewBoxW, finalViewBoxH, fIdx, activeSettings, wmImgEl);
    }

    // 5. Optional Trim transparent padding
    let layoutX = 0;
    let layoutY = 0;
    let layoutW = finalViewBoxW;
    let layoutH = finalViewBoxH;
    let exportCanvas = finalCanvas;

    if (trimTransparentPadding) {
      const frameImgData = finalCtx.getImageData(0, 0, finalViewBoxW, finalViewBoxH);
      const bbox = getAlphaBoundingBox(frameImgData.data, finalViewBoxW, finalViewBoxH);
      if (!bbox.isEmpty) {
        layoutX = bbox.minX;
        layoutY = bbox.minY;
        layoutW = bbox.maxX - bbox.minX + 1;
        layoutH = bbox.maxY - bbox.minY + 1;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = layoutW;
        cropCanvas.height = layoutH;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(
            finalCanvas,
            bbox.minX,
            bbox.minY,
            layoutW,
            layoutH,
            0,
            0,
            layoutW,
            layoutH
          );
          exportCanvas = cropCanvas;
        }
      }
    }

    // 6. Encode image to WebP or PNG dataURL
    const mime = format === 'webp' ? 'image/webp' : 'image/png';
    const dataUrl = exportCanvas.toDataURL(mime, quality);

    let imageKey = `frame_${step}`;
    let isReused = false;

    // Deduplication check
    if (deduplicateFrames && lastDataUrl && lastDataUrl === dataUrl && lastImageKey) {
      imageKey = lastImageKey;
      isReused = true;
    } else {
      const base64Data = dataUrl.split(',')[1] || '';
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let b = 0; b < binaryStr.length; b++) {
        bytes[b] = binaryStr.charCodeAt(b);
      }
      imagesData[imageKey] = bytes;
      lastImageKey = imageKey;
      lastImageBytes = bytes;
      lastDataUrl = dataUrl;
    }

    // Frame Entity Layout
    const frameObj = {
      alpha: 1.0,
      layout: {
        x: layoutX,
        y: layoutY,
        width: layoutW,
        height: layoutH
      },
      transform: {
        a: 1.0,
        b: 0.0,
        c: 0.0,
        d: 1.0,
        tx: 0.0,
        ty: 0.0
      }
    };

    spriteFramesList.push({
      imageKey,
      frameObj,
      frameIdx: step
    });

    // Progress updates every 2 frames or end
    if (step % 2 === 0 || step === totalFrames - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const progressPercent = Math.min(85, Math.round(10 + (step / totalFrames) * 75));
      const framesRemaining = totalFrames - (step + 1);
      const estSeconds = step > 2 ? Math.round((elapsed / (step + 1)) * framesRemaining) : undefined;

      onProgress?.({
        percent: progressPercent,
        phase: `معالجة واستخراج الإطار ${step + 1} من ${totalFrames} (${format.toUpperCase()})...`,
        currentFrame: step + 1,
        totalFrames,
        currentThumb: dataUrl,
        estimatedSecondsLeft: estSeconds
      });

      // Allow UI thread breathing room
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  // 7. Assemble SVGA Sprites structure
  // Build 1 sprite per captured frame timeline
  for (let s = 0; s < totalFrames; s++) {
    const item = spriteFramesList[s];
    const frames = new Array(totalFrames).fill(null).map((_, idx) => {
      if (idx === item.frameIdx) {
        return item.frameObj;
      }
      return { alpha: 0.0 };
    });

    spritesData.push({
      imageKey: item.imageKey,
      frames
    });
  }

  // 8. Handle Audio Track extraction & embedding
  const audiosData: any[] = [];
  let hasEmbeddedAudio = false;

  if (preserveAudio) {
    try {
      onProgress?.({
        percent: 86,
        phase: 'استخراج وضغط مسار الصوت المدمج في VAP...',
        currentFrame: totalFrames,
        totalFrames
      });
      const audioBlob = await extractAudioFromVap(file);
      if (audioBlob && audioBlob.size > 200) {
        const audioBuffer = await audioBlob.arrayBuffer();
        const audioBytes = new Uint8Array(audioBuffer);
        const audioKey = 'audio_track';
        imagesData[audioKey] = audioBytes;
        audiosData.push({
          audioKey,
          startFrame: 0,
          endFrame: totalFrames,
          startTime: 0,
          totalTime: Math.round(segmentDuration * 1000)
        });
        hasEmbeddedAudio = true;
      }
    } catch (audioErr) {
      console.warn('Audio extraction for SVGA omitted or video has no audio:', audioErr);
    }
  }

  // 9. Encode Protobuf MovieEntity
  onProgress?.({
    percent: 90,
    phase: `ترميز بنية SVGA 2.0 وضغط Deflate (مستوى ${zlibLevel})...`,
    currentFrame: totalFrames,
    totalFrames
  });

  const svgaPayload = {
    version: '2.0',
    params: {
      viewBoxWidth: finalViewBoxW,
      viewBoxHeight: finalViewBoxH,
      fps: finalPlaybackFps,
      frames: totalFrames
    },
    images: imagesData,
    sprites: spritesData,
    audios: audiosData
  };

  const errMsg = MovieEntity.verify(svgaPayload);
  if (errMsg) {
    URL.revokeObjectURL(videoUrl);
    throw new Error(`خطأ في التحقق من بنية SVGA: ${errMsg}`);
  }

  const movieEntity = MovieEntity.create(svgaPayload);
  const protoBuffer = MovieEntity.encode(movieEntity).finish();

  // Deflate compression using user selected level (1-9)
  const safeZlibLevel = Math.max(1, Math.min(9, zlibLevel));
  const compressed = pako.deflate(protoBuffer, { level: safeZlibLevel as any });
  const svgaBlob = new Blob([compressed], { type: 'application/octet-stream' });

  // Cleanup video object URL
  URL.revokeObjectURL(videoUrl);

  const svgaSizeBytes = svgaBlob.size;
  const originalSizeBytes = file.size;
  const savedBytes = Math.max(0, originalSizeBytes - svgaSizeBytes);
  const savedPercent = originalSizeBytes > 0 ? Math.round((savedBytes / originalSizeBytes) * 100) : 0;

  onProgress?.({
    percent: 100,
    phase: 'اكتمل التحويل بنجاح! الملف جاهز للتحميل والمعاينة.',
    currentFrame: totalFrames,
    totalFrames
  });

  return {
    blob: svgaBlob,
    stats: {
      originalSizeBytes,
      svgaSizeBytes,
      savedBytes,
      savedPercent,
      fps: finalPlaybackFps,
      totalFrames,
      viewBoxWidth: finalViewBoxW,
      viewBoxHeight: finalViewBoxH,
      durationSeconds: segmentDuration,
      format,
      hasAudio: hasEmbeddedAudio
    }
  };
};
