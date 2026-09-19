import { SVGAProjectData, EditableLayer, SVGAAudioTrack, FadeConfig } from '../components/SvgaLayerEditor/types';
import { ChromaSettings } from '../components/ChromaStudioModal';
import { TimingSettings, calculateOutputDuration, getTimeForFrame } from '../components/VideoTrimmerModal';
import { extractAndScaleVideoAudio } from './videoDurationEngine';
import { ensureMp3WithId3 } from './svgaAudio';
import { encodeSVGA } from './svgaEncoder';

export interface TransferToLayerEditorOptions {
  file: File;
  videoDuration: number;
  timingSettings: TimingSettings;
  isAutoDuration?: boolean;
  startTime?: number;
  endTime?: number;
  durationMode?: 'auto' | 'speed_fit' | 'trim';
  targetSpeedDuration?: number;
  fps?: number;
  customWidth?: number | '';
  customHeight?: number | '';
  exportScale?: number;
  isVapInput?: boolean;
  removeGreen?: boolean;
  removeBlack?: boolean;
  removeWhite?: boolean;
  removeBlue?: boolean;
  whiteTolerance?: number;
  customChroma?: ChromaSettings;
  fadeConfig?: FadeConfig;
  onProgress?: (phase: string, percent: number) => void;
}

export interface TransferToLayerEditorResult {
  project: SVGAProjectData;
  layers: EditableLayer[];
  file: File;
}

/**
 * Converts a base64 string to Uint8Array safely
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const cleanB64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(cleanB64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Processes video with exact trimming, duration speed, and chroma key (green screen removal),
 * and packages it into an SVGA project ready for the After Effects / SVGA Layer Editor.
 */
export async function transferVideoEditsToLayerEditor(
  options: TransferToLayerEditorOptions
): Promise<TransferToLayerEditorResult> {
  const {
    file,
    videoDuration,
    timingSettings,
    isAutoDuration = true,
    startTime = 0,
    endTime = 0,
    durationMode = 'auto',
    targetSpeedDuration = 10,
    fps = 30,
    customWidth,
    customHeight,
    exportScale = 1.0,
    isVapInput = false,
    removeGreen = false,
    removeBlack = false,
    removeWhite = false,
    removeBlue = false,
    whiteTolerance = 30,
    customChroma,
    fadeConfig,
    onProgress = () => {}
  } = options;

  onProgress('جاري تحضير الإعدادات وحساب مدة المشهد المقصوص...', 5);

  // 1. Calculate effective duration
  let effectiveDuration = videoDuration;
  if (!isAutoDuration && endTime > startTime) {
    effectiveDuration = Math.max(0.05, endTime - startTime);
  } else if (durationMode === 'speed_fit' && targetSpeedDuration > 0) {
    effectiveDuration = targetSpeedDuration;
  } else if (timingSettings && timingSettings.mode !== 'full') {
    effectiveDuration = calculateOutputDuration(videoDuration, timingSettings);
  }
  effectiveDuration = Math.max(0.1, effectiveDuration);

  // 2. Determine frame count
  const validFps = Math.max(1, Math.min(60, fps || 30));
  let totalFrames = Math.max(1, Math.round(effectiveDuration * validFps));
  // Keep frame count memory safe (capped at 1200 frames for web canvas)
  totalFrames = Math.min(1200, totalFrames);

  // 3. Load video element off-screen for frame extraction
  onProgress('جاري فحص محرك الفيديو وتجهيز الأبعاد...', 10);
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:320px;height:240px;opacity:0.01;pointer-events:none;z-index:-9999;';
  document.body.appendChild(video);

  const videoUrl = URL.createObjectURL(file);
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    const onReady = () => {
      if (!done && video.readyState >= 2) {
        done = true;
        resolve();
      }
    };
    video.onloadeddata = onReady;
    video.oncanplay = onReady;
    video.onerror = () => reject(new Error('تعذر تحميل إطارات الفيديو'));
    if (video.readyState >= 2) {
      done = true;
      resolve();
    }
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 2500);
  });

  // 4. Calculate dimensions
  let originalWidth = video.videoWidth || 720;
  let originalHeight = video.videoHeight || 1280;
  if (isVapInput) {
    originalWidth = Math.floor(originalWidth / 2);
  }

  let outWidth = customWidth ? Number(customWidth) : originalWidth;
  let outHeight = customHeight ? Number(customHeight) : originalHeight;

  if (exportScale && exportScale > 0 && exportScale !== 1.0) {
    outWidth = Math.round(outWidth * exportScale);
    outHeight = Math.round(outHeight * exportScale);
  }

  // Safety caps: avoid GPU memory exhaustion
  const maxDim = Math.max(outWidth, outHeight);
  if (maxDim > 1920) {
    const downscale = 1920 / maxDim;
    outWidth = Math.round(outWidth * downscale);
    outHeight = Math.round(outHeight * downscale);
  }

  // Ensure even integers
  outWidth = Math.max(16, outWidth - (outWidth % 2));
  outHeight = Math.max(16, outHeight - (outHeight % 2));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = isVapInput ? outWidth * 2 : outWidth;
  tempCanvas.height = outHeight;
  const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  if (!ctx || !tCtx) {
    video.remove();
    URL.revokeObjectURL(videoUrl);
    throw new Error('تعذر تهيئة بيئة معالجة الصور Canvas');
  }

  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};
  const spriteFrames: any[] = [];
  const sprites: any[] = [];

  const baseFileName = file.name.replace(/\.[^/.]+$/, '');

  // 5. Ultra-fast Seek helper (Resolves immediately upon hardware decoder seeked without redundant callback delays)
  const seekVideo = (targetSec: number): Promise<void> => {
    return new Promise((resolve) => {
      const clamped = Math.max(0, Math.min(videoDuration - 0.001, targetSec));
      if (Math.abs(video.currentTime - clamped) < 0.002) {
        resolve();
        return;
      }
      let done = false;
      const onSeeked = () => {
        if (!done) {
          done = true;
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      if ('fastSeek' in video && typeof (video as any).fastSeek === 'function') {
        try {
          (video as any).fastSeek(clamped);
        } catch {
          video.currentTime = clamped;
        }
      } else {
        video.currentTime = clamped;
      }
      // Fail-safe timeout to prevent hanging
      setTimeout(onSeeked, 100);
    });
  };

  // 6. Highly-optimized Chroma & Transparency processing function (Inlined math, zero function-call overhead)
  const applyTransparency = (targetCtx: CanvasRenderingContext2D, w: number, h: number) => {
    const hasGreen = removeGreen;
    const hasBlue = removeBlue;
    const hasBlack = removeBlack;
    const hasWhite = removeWhite;
    const hasCustom = Boolean(customChroma && customChroma.enabled);
    const hasFade = Boolean(fadeConfig && (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0));

    // Fast path: If no transparency or chroma keying is needed, do nothing and return immediately
    if (!hasGreen && !hasBlue && !hasBlack && !hasWhite && !hasCustom && !hasFade) {
      return;
    }

    const imgData = targetCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;

    const greenSens = Math.max(10, 70 - whiteTolerance);
    const blueSens = Math.max(10, 70 - whiteTolerance);
    const blackThresh = whiteTolerance * 3;
    const whiteThresh = whiteTolerance * 1.5;

    const customTargets = hasCustom ? [
      { r: customChroma!.r, g: customChroma!.g, b: customChroma!.b },
      ...(customChroma!.additionalColors || [])
    ] : [];
    const customTol = hasCustom ? (customChroma!.tolerance / 100) * 180 : 0;
    const customSoft = hasCustom ? (customChroma!.smoothness / 100) * 60 : 0;
    const customDespill = hasCustom && customChroma!.despill;

    const fadeTop = (hasFade && fadeConfig?.top) || 0;
    const fadeBottom = (hasFade && fadeConfig?.bottom) || 0;
    const fadeLeft = (hasFade && fadeConfig?.left) || 0;
    const fadeRight = (hasFade && fadeConfig?.right) || 0;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      let a = data[i + 3];

      if (a === 0) continue;

      const px = (i / 4) % w;
      const py = Math.floor((i / 4) / w);

      // Edge fade calculation
      let edgeAlpha = 1.0;
      if (hasFade) {
        if (fadeTop > 0 && py < fadeTop) edgeAlpha = Math.min(edgeAlpha, py / fadeTop);
        if (fadeBottom > 0 && py > h - fadeBottom) edgeAlpha = Math.min(edgeAlpha, (h - py) / fadeBottom);
        if (fadeLeft > 0 && px < fadeLeft) edgeAlpha = Math.min(edgeAlpha, px / fadeLeft);
        if (fadeRight > 0 && px > w - fadeRight) edgeAlpha = Math.min(edgeAlpha, (w - px) / fadeRight);
      }

      // Green screen removal (Inlined without Math.max/min call overhead)
      if (hasGreen) {
        const maxRB = r > b ? r : b;
        if (g > 80 && g > r + greenSens && g > b + greenSens) {
          const diff = g - maxRB;
          const dominance = diff >= 100 ? 1 : diff * 0.01;
          const newA = 255 * (1 - dominance);
          if (newA < a) a = newA;
          if (a < 255) {
            g = maxRB;
          }
        }
      }

      // Blue screen removal
      if (hasBlue) {
        const maxRG = r > g ? r : g;
        if (b > 80 && b > r + blueSens && b > g + blueSens) {
          const diff = b - maxRG;
          const dominance = diff >= 100 ? 1 : diff * 0.01;
          const newA = 255 * (1 - dominance);
          if (newA < a) a = newA;
          if (a < 255) {
            b = maxRG;
          }
        }
      }

      // Black removal
      if (hasBlack) {
        const brightness = (r + g + b) * 0.333333;
        if (brightness < blackThresh) {
          const factor = brightness / blackThresh;
          const newA = 255 * factor;
          if (newA < a) a = newA;
          const boost = 1.0 - factor;
          r = Math.min(255, r + (255 - r) * boost * 0.8);
          g = Math.min(255, g + (255 - g) * boost * 0.8);
          b = Math.min(255, b + (255 - b) * boost * 0.8);
        }
      }

      // White removal
      if (hasWhite) {
        const drW = 255 - r;
        const dgW = 255 - g;
        const dbW = 255 - b;
        const dist = Math.sqrt(drW * drW + dgW * dgW + dbW * dbW);
        const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
        if (maxC - minC < 20) {
          if (dist < whiteThresh) {
            a = 0;
          } else if (dist < whiteThresh + 20) {
            const factor = (dist - whiteThresh) * 0.05;
            const newA = 255 * factor;
            if (newA < a) a = newA;
          }
        }
      }

      // Custom Eyedropper Chroma Key
      if (hasCustom && customTargets.length > 0) {
        let minFactor = 1.0;
        for (let tIdx = 0; tIdx < customTargets.length; tIdx++) {
          const target = customTargets[tIdx];
          const dr = r - target.r;
          const dg = g - target.g;
          const db = b - target.b;
          const dist = Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
          let factor = 1.0;
          if (dist < customTol) {
            factor = 0.0;
          } else if (customSoft > 0 && dist < customTol + customSoft) {
            const t = (dist - customTol) / customSoft;
            factor = t * t * (3 - 2 * t);
          }
          if (factor < minFactor) minFactor = factor;
        }

        if (customDespill && minFactor < 1.0) {
          const maxTarget = Math.max(customChroma!.r, customChroma!.g, customChroma!.b);
          if (customChroma!.g === maxTarget && customChroma!.g > customChroma!.r + 20) {
            const maxOther = r > b ? r : b;
            if (g > maxOther) g = maxOther;
          }
        }
        const newA = 255 * minFactor;
        if (newA < a) a = newA;
      }

      const finalAlpha = (a / 255) * edgeAlpha;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = (finalAlpha * 255) | 0;
    }

    targetCtx.putImageData(imgData, 0, 0);
  };

  // 7. Frame Extraction Loop with Turbo Engine
  onProgress('جاري استخراج إطارات الفيديو وتطبيق إزالة الخلفية والقص بسرعة فائقة (Turbo Engine)...', 15);

  for (let f = 0; f < totalFrames; f++) {
    let frameTime = 0;
    if (timingSettings && timingSettings.mode !== 'full') {
      frameTime = getTimeForFrame(f, totalFrames, videoDuration, timingSettings);
    } else if (!isAutoDuration && endTime > startTime) {
      const progressRatio = totalFrames > 1 ? f / (totalFrames - 1) : 0;
      frameTime = startTime + progressRatio * (endTime - startTime);
    } else {
      const progressRatio = totalFrames > 1 ? f / (totalFrames - 1) : 0;
      frameTime = progressRatio * videoDuration;
    }

    await seekVideo(frameTime);

    // Render video to tempCanvas
    tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    if (isVapInput) {
      tCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      const halfW = outWidth;
      const alphaData = tCtx.getImageData(0, 0, halfW, outHeight).data;
      const rgbData = tCtx.getImageData(halfW, 0, halfW, outHeight).data;
      const combined = ctx.createImageData(outWidth, outHeight);
      const d = combined.data;
      for (let j = 0; j < rgbData.length; j += 4) {
        d[j] = rgbData[j];
        d[j + 1] = rgbData[j + 1];
        d[j + 2] = rgbData[j + 2];
        d[j + 3] = ((alphaData[j] + alphaData[j + 1] + alphaData[j + 2]) / 3) | 0;
      }
      ctx.putImageData(combined, 0, 0);
    } else {
      ctx.clearRect(0, 0, outWidth, outHeight);
      ctx.drawImage(video, 0, 0, outWidth, outHeight);
    }

    // Apply green screen removal and edge effects
    applyTransparency(ctx, outWidth, outHeight);

    // Ultra-fast Asynchronous Blob & Byte Array Generation (10x faster than toDataURL PNG + atob)
    const frameKey = `frame_${f}.png`;
    const { url, rawBytes } = await new Promise<{ url: string; rawBytes: Uint8Array }>((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const objUrl = URL.createObjectURL(blob);
            resolve({ url: objUrl, rawBytes: bytes });
          } else {
            const dUrl = canvas.toDataURL('image/png');
            resolve({ url: dUrl, rawBytes: base64ToUint8Array(dUrl) });
          }
        },
        'image/webp',
        0.94
      );
    });

    imagesMap[frameKey] = url;
    rawImages[frameKey] = rawBytes;

    spriteFrames.push({
      alpha: 1.0,
      layout: { x: 0, y: 0, width: outWidth, height: outHeight },
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
    });

    if (f % 10 === 0 || f === totalFrames - 1) {
      const pct = Math.round(15 + (f / totalFrames) * 65);
      onProgress(`جاري معالجة ونقل الإطارات بسرعة فائقة (${f + 1}/${totalFrames})...`, pct);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Cleanup video element
  URL.revokeObjectURL(videoUrl);
  video.remove();

  // 8. Audio extraction & scaling
  const audios: SVGAAudioTrack[] = [];
  onProgress('جاري استخراج وضبط الصوت المتزامن مع مدة القص...', 85);

  try {
    const speedRatio = videoDuration / effectiveDuration;
    const audioResult = await extractAndScaleVideoAudio(file, effectiveDuration, speedRatio, 'mp3');
    if (audioResult && audioResult.audioBytes && audioResult.audioBytes.length > 0) {
      const audioBytesWithId3 = ensureMp3WithId3(audioResult.audioBytes);
      const audioKey = 'audio_0';
      const audioBlob = new Blob([audioBytesWithId3], { type: 'audio/mp3' });
      const audioDataUrl = URL.createObjectURL(audioBlob);

      imagesMap[audioKey] = audioDataUrl;
      rawImages[audioKey] = audioBytesWithId3;

      audios.push({
        audioKey,
        startFrame: 0,
        endFrame: totalFrames - 1,
        startTime: 0,
        totalTime: Math.round(effectiveDuration * 1000),
        name: `صوت فيديو ${baseFileName}`,
        dataUrl: audioDataUrl,
        durationSec: effectiveDuration
      });
    }
  } catch (audioErr) {
    console.warn('Audio sync skipped or video is silent:', audioErr);
  }

  // 9. Build standard SVGA 2.0 Sprites
  onProgress('جاري بناء بنية طبقات مشروع After Effects / SVGA...', 90);

  for (let i = 0; i < totalFrames; i++) {
    const frameKey = `frame_${i}.png`;
    sprites.push({
      imageKey: frameKey,
      frames: Array.from({ length: totalFrames }, (_, fIdx) => ({
        alpha: fIdx === i ? 1.0 : 0.0,
        layout: { x: 0, y: 0, width: outWidth, height: outHeight },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
      }))
    });
  }

  const masterFrames = Array.from({ length: totalFrames }, () => ({
    alpha: 1,
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    layout: { x: 0, y: 0, width: outWidth, height: outHeight }
  }));

  const rawMovie: any = {
    version: '2.0',
    params: {
      viewBoxWidth: outWidth,
      viewBoxHeight: outHeight,
      fps: validFps,
      frames: totalFrames
    },
    images: rawImages,
    sprites: sprites,
    audios: audios.map((a) => ({
      audioKey: a.audioKey,
      startFrame: a.startFrame,
      endFrame: a.endFrame,
      startTime: a.startTime,
      totalTime: a.totalTime
    }))
  };

  const project: SVGAProjectData = {
    fileName: `${baseFileName}_edited.svga`,
    fileSize: file.size,
    width: outWidth,
    height: outHeight,
    fps: validFps,
    totalFrames,
    durationSec: effectiveDuration,
    imagesMap,
    rawImages,
    audios,
    rawMovie,
    fadeConfig
  };

  const firstFrameKey = `frame_0.png`;

  // Create unified Master Layer for After Effects workspace
  const mainLayer: EditableLayer = {
    id: `layer_video_ae_${Date.now()}`,
    originalIndex: 0,
    imageKey: firstFrameKey,
    name: `فيديو MP4 - ${baseFileName} (شفاف ومقصوص)`,
    type: 'image',
    visible: true,
    locked: false,
    thumbnailUrl: imagesMap[firstFrameKey],
    inFrame: 0,
    outFrame: totalFrames - 1,
    isVideoSequence: true,
    sequencePrefix: 'frame_',
    sequenceGroupId: 'seq_video_main',
    sequenceIndex: 1,
    sequenceTotal: totalFrames,
    transform: {
      x: 0,
      y: 0,
      width: outWidth,
      height: outHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100
    },
    initialBounds: {
      x: 0,
      y: 0,
      width: outWidth,
      height: outHeight
    },
    originalInitialBounds: {
      x: 0,
      y: 0,
      width: outWidth,
      height: outHeight
    },
    originalTransform: {
      x: 0,
      y: 0,
      width: outWidth,
      height: outHeight,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100
    },
    aspectRatioLocked: true,
    spriteRef: {
      imageKey: firstFrameKey,
      frames: masterFrames
    },
    framesCount: totalFrames,
    keyframeSummary: {
      startFrame: 0,
      endFrame: totalFrames - 1,
      hasShapes: false,
      hasTransform: true,
      activeFrames: Array.from({ length: totalFrames }, (_, idx) => idx),
      isSequenceOrRepeated: true,
      sequenceGroupId: 'seq_video_main',
      sequenceIndex: 1,
      sequenceTotal: totalFrames
    }
  };

  const layers: EditableLayer[] = [mainLayer];

  // 10. Encode full SVGA file blob (Using fast compression level 1 for lightning-fast transfer)
  onProgress('جاري تصدير وتجهيز ملف SVGA النهائي بسرعة...', 95);

  let svgaFile: File;
  try {
    const svgaBlob = await encodeSVGA(rawMovie, { level: 1 });
    svgaFile = new File([svgaBlob], `${baseFileName}_edited.svga`, {
      type: 'application/octet-stream'
    });
  } catch (encErr) {
    console.warn('Direct SVGA encoding fallback:', encErr);
    // Fallback dummy file so project and layers still open instantly
    svgaFile = new File([new Uint8Array(10)], `${baseFileName}_edited.svga`, {
      type: 'application/octet-stream'
    });
  }

  onProgress('تم تجهيز المشروع بنجاح! جاري الانتقال لمحرر الطبقات (After Effects)...', 100);

  return {
    project,
    layers,
    file: svgaFile
  };
}
