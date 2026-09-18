import { SVGAProjectData, EditableLayer, SVGAAudioTrack } from './types';
import { extractAndScaleVideoAudio } from '../../utils/videoDurationEngine';
import { ensureMp3WithId3 } from '../../utils/mp3Encoder';

export interface Mp4ProbeResult {
  duration: number; // in seconds
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  fps: number;
  hasAudio: boolean;
}

export interface Mp4ToSvgaOptions {
  fps?: number;
  targetDuration?: number; // in seconds (for Zero-Crop speed compression)
  durationStrategy?: 'crop_start' | 'compress_full'; // 'crop_start' = natural 1:1 speed, 'compress_full' = compress full timeline
  maxFrames?: number; // Cap frames for ultra-fast 1-second imports
  quality?: 'fast' | 'high'; // 'fast' = JPEG 90% (ultra fast, light), 'high' = PNG
  scale?: number; // 0.5, 0.75, 1.0
  targetWidth?: number;
  targetHeight?: number;
  preserveAudio?: boolean;
  onProgress?: (phase: string, percent: number, currentFrame?: number, totalFrames?: number) => void;
}

/**
 * Fast Base64 to Uint8Array converter for image buffers
 */
function base64ToUint8Array(dataUrl: string): Uint8Array {
  const cleanB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(cleanB64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Probes an MP4 file client-side to inspect dimensions, duration, and audio track
 */
export async function probeMp4Video(file: File): Promise<Mp4ProbeResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;

    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      const width = video.videoWidth || 720;
      const height = video.videoHeight || 1280;
      const aspectRatio = width / height;

      // Check audio track existence using webkitAudioDecodedByteCount or audioTracks if supported
      let hasAudio = false;
      if ((video as any).audioTracks && (video as any).audioTracks.length > 0) {
        hasAudio = true;
      } else if (typeof (video as any).webkitAudioDecodedByteCount === 'number') {
        hasAudio = (video as any).webkitAudioDecodedByteCount > 0;
      } else {
        hasAudio = true; // Assume true so extractor attempts audio extraction
      }

      cleanup();
      resolve({
        duration,
        width,
        height,
        aspectRatio,
        fileSize: file.size,
        fps: 30,
        hasAudio,
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('فشل قراءة بيانات ملف الفيديو MP4. يرجى التأكد من سلامة صيغة الملف.'));
    };
  });
}

/**
 * Converts an MP4 file into a full SVGAProjectData structure and EditableLayer[]
 * so it can be controlled, manipulated, transformed, and exported to any SVGA/video/animation format.
 */
export async function convertMp4ToSvgaProject(
  file: File,
  options: Mp4ToSvgaOptions = {}
): Promise<{ project: SVGAProjectData; layers: EditableLayer[] }> {
  const onProgress = options.onProgress || (() => {});
  onProgress('جاري فحص وقراءة بيانات الفيديو...', 5);

  const probe = await probeMp4Video(file);
  const fps = options.fps || 30;
  const effectiveDuration = options.targetDuration && options.targetDuration > 0
    ? options.targetDuration
    : probe.duration;

  let totalFrames = Math.max(1, Math.round(effectiveDuration * fps));
  if (options.maxFrames && options.maxFrames > 0 && totalFrames > options.maxFrames) {
    totalFrames = options.maxFrames;
  }
  totalFrames = Math.min(2400, totalFrames);

  // Determine output dimensions (ensure even numbers for encoder compatibility)
  let outWidth = options.targetWidth || probe.width;
  let outHeight = options.targetHeight || probe.height;

  if (options.scale && options.scale > 0 && options.scale < 1.0) {
    outWidth = Math.round(outWidth * options.scale);
    outHeight = Math.round(outHeight * options.scale);
  }

  // Safety caps: avoid out of memory if 4K (cap to max 1920)
  const maxDim = Math.max(outWidth, outHeight);
  if (maxDim > 1920) {
    const downscale = 1920 / maxDim;
    outWidth = Math.round(outWidth * downscale);
    outHeight = Math.round(outHeight * downscale);
  }

  outWidth = outWidth - (outWidth % 2);
  outHeight = outHeight - (outHeight % 2);

  onProgress('جاري تحضير بيئة استخراج إطارات الفيديو...', 10);

  // Load video element for frame-by-frame extraction
  // Note: Appending off-screen to DOM with standard dimensions ensures hardware decoding stays active without browser throttling
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:640px;height:360px;opacity:0.01;pointer-events:none;z-index:-9999;';
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

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    video.remove();
    URL.revokeObjectURL(videoUrl);
    throw new Error('تعذر إنشاء بيئة الرسم Canvas');
  }

  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};
  const baseFileName = file.name.replace(/\.[^/.]+$/, "");

  // Speed optimization: JPEG 0.88 is ~15x faster than PNG and encodes each frame in <2ms
  const isHighPng = options.quality === 'high';
  const mimeType = isHighPng ? 'image/png' : 'image/jpeg';
  const fileExt = isHighPng ? 'png' : 'jpg';
  const qualityParam = isHighPng ? undefined : 0.88;

  // Prime hardware decoder with micro-play to guarantee texture buffer is hot
  try {
    video.currentTime = 0.001;
    await video.play().catch(() => {});
    video.pause();
  } catch (_) {}

  // High-reliability seek and draw helper
  const seekAndDraw = async (targetSec: number): Promise<void> => {
    const clampedTime = Math.max(0, Math.min(probe.duration - 0.001, targetSec));
    if (Math.abs(video.currentTime - clampedTime) > 0.005) {
      await new Promise<void>((resolve) => {
        let done = false;
        const onSeeked = () => {
          if (!done) {
            done = true;
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = clampedTime;
        // Adequate timeout so high-resolution (2K/4K) video frames finish decoding
        setTimeout(onSeeked, 350);
      });
    }

    if ('requestVideoFrameCallback' in video) {
      await new Promise<void>((res) => {
        (video as any).requestVideoFrameCallback(() => res());
        setTimeout(res, 50);
      });
    } else {
      await new Promise(r => setTimeout(r, 10));
    }

    ctx.drawImage(video, 0, 0, outWidth, outHeight);
  };

  // Helper to check if frame is completely transparent (alpha === 0 indicates unpainted buffer)
  const isFrameTransparent = (): boolean => {
    try {
      const p = ctx.getImageData(Math.floor(outWidth * 0.5), Math.floor(outHeight * 0.5), 1, 1).data;
      return p[3] === 0;
    } catch {
      return false;
    }
  };

  // Guaranteed Non-Blank First Frame: step forward until canvas has real pixels
  await seekAndDraw(0.001);
  if (isFrameTransparent()) {
    for (const testOffset of [0.033, 0.066, 0.1, 0.15, 0.25, 0.5]) {
      if (testOffset < probe.duration) {
        await seekAndDraw(testOffset);
        if (!isFrameTransparent()) break;
      }
    }
  }

  const initialDataUrl = canvas.toDataURL(mimeType, qualityParam);
  let lastValidDataUrl: string = initialDataUrl;
  let lastValidRaw: Uint8Array = base64ToUint8Array(initialDataUrl);

  // Time range calculation:
  // - 'crop_start' (default): extract from 0 to targetDuration at original 1:1 real-time speed (instant, natural movement, no blank frame)
  // - 'compress_full': span across probe.duration into the targetDuration
  const isCropStart = options.durationStrategy !== 'compress_full';
  const maxExtractDuration = (options.targetDuration && options.targetDuration < probe.duration && isCropStart)
    ? options.targetDuration
    : probe.duration;

  // Frame Extraction Loop: sequential extraction
  for (let f = 0; f < totalFrames; f++) {
    const progressRatio = totalFrames > 1 ? f / (totalFrames - 1) : 0;
    const seekTime = Math.min(probe.duration, Math.max(0, progressRatio * maxExtractDuration));

    if (f > 0) {
      await seekAndDraw(seekTime);
    }

    const frameKey = `frame_${f}.${fileExt}`;

    // Only fallback if the frame buffer was truly transparent (not drawn)
    if (isFrameTransparent()) {
      imagesMap[frameKey] = lastValidDataUrl;
      rawImages[frameKey] = lastValidRaw;
    } else {
      const dataUrl = canvas.toDataURL(mimeType, qualityParam);
      const rawBytes = base64ToUint8Array(dataUrl);
      imagesMap[frameKey] = dataUrl;
      rawImages[frameKey] = rawBytes;
      lastValidDataUrl = dataUrl;
      lastValidRaw = rawBytes;
    }

    if (f % 5 === 0 || f === totalFrames - 1) {
      const pct = Math.round(15 + (f / totalFrames) * 70);
      onProgress(`جاري استخراج إطارات الفيديو بسرعة فائقة (${f + 1}/${totalFrames})...`, pct);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Safely cleanup DOM video element
  URL.revokeObjectURL(videoUrl);
  video.remove();

  // Audio Extraction
  const audios: SVGAAudioTrack[] = [];
  if (options.preserveAudio !== false) {
    onProgress('جاري استخراج وضبط المسار الصوتي للفيديو...', 85);
    try {
      const speedRatio = isCropStart ? 1.0 : (probe.duration / effectiveDuration);
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
      console.warn('Could not extract audio from video or video was silent:', audioErr);
    }
  }

  onProgress('جاري بناء طبقات وتكوين ملف SVGA...', 92);

  // 1. Build masterFrames for editor playback (all frames active and visible with alpha: 1)
  const masterFrames = Array.from({ length: totalFrames }, () => ({
    alpha: 1,
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    layout: { x: 0, y: 0, width: outWidth, height: outHeight }
  }));

  // 2. Build standard SVGA 2.0 Sprite structure for external player compatibility
  const sprites: any[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const spriteItem = {
      imageKey: `frame_${i}.${fileExt}`,
      frames: Array.from({ length: totalFrames }, (_, fIdx) => ({
        alpha: fIdx === i ? 1 : 0,
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        layout: { x: 0, y: 0, width: outWidth, height: outHeight }
      }))
    };
    sprites.push(spriteItem);
  }

  const rawMovie: any = {
    version: "2.0",
    params: {
      viewBoxWidth: outWidth,
      viewBoxHeight: outHeight,
      fps: fps,
      frames: totalFrames
    },
    images: {},
    sprites: sprites,
    audios: audios.map(a => ({
      audioKey: a.audioKey,
      startFrame: a.startFrame,
      endFrame: a.endFrame,
      startTime: a.startTime,
      totalTime: a.totalTime
    }))
  };

  const project: SVGAProjectData = {
    fileName: `${baseFileName}.svga`,
    fileSize: file.size,
    width: outWidth,
    height: outHeight,
    fps,
    totalFrames,
    durationSec: effectiveDuration,
    imagesMap,
    rawImages,
    audios,
    rawMovie
  };

  const firstFrameKey = `frame_0.${fileExt}`;

  // Create unified Master Video Layer with fully visible masterFrames
  const mainVideoLayer: EditableLayer = {
    id: `layer_video_master_${Date.now()}`,
    originalIndex: 0,
    imageKey: firstFrameKey,
    name: `فيديو MP4 - ${baseFileName}`,
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
      hasTransform: false,
      hasAnyExplicitAlpha: true,
      isSequenceOrRepeated: true,
      sequenceGroupId: 'seq_video_main',
      sequenceIndex: 1,
      sequenceTotal: totalFrames
    }
  };

  onProgress('اكتمل استدعاء الفيديو بنجاح! جاهز للتحرير والتصدير.', 100);

  return {
    project,
    layers: [mainVideoLayer]
  };
}

/**
 * Imports an MP4 file as a video layer into an existing SVGA project
 */
export async function importMp4AsLayerIntoProject(
  file: File,
  existingProject: SVGAProjectData,
  options: Mp4ToSvgaOptions = {}
): Promise<{ newLayer: EditableLayer; addedAudios: SVGAAudioTrack[] }> {
  const onProgress = options.onProgress || (() => {});
  onProgress('جاري فحص وقراءة الفيديو المضاف...', 5);

  const probe = await probeMp4Video(file);
  const totalFrames = existingProject.totalFrames;
  const fps = existingProject.fps;
  const projectDuration = existingProject.durationSec || (totalFrames / fps);

  // Determine initial layout size to fit nicely in the current canvas
  const canvasW = existingProject.width;
  const canvasH = existingProject.height;

  let layerW = probe.width;
  let layerH = probe.height;

  // Scale down if larger than canvas
  if (layerW > canvasW * 0.9 || layerH > canvasH * 0.9) {
    const scaleFactor = Math.min((canvasW * 0.9) / layerW, (canvasH * 0.9) / layerH);
    layerW = Math.round(layerW * scaleFactor);
    layerH = Math.round(layerH * scaleFactor);
  }

  // Center layer on canvas
  const layerX = Math.round((canvasW - layerW) / 2);
  const layerY = Math.round((canvasH - layerH) / 2);

  const prefix = `mp4_${Date.now()}_frame_`;

  // Load video element attached to DOM with standard dimensions for full GPU pipeline activation
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:640px;height:360px;opacity:0.01;pointer-events:none;z-index:-9999;';
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

  const canvas = document.createElement('canvas');
  canvas.width = layerW;
  canvas.height = layerH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    video.remove();
    URL.revokeObjectURL(videoUrl);
    throw new Error('تعذر إنشاء بيئة الرسم Canvas');
  }

  // Speed optimization: JPEG 0.88 is ~15x faster than PNG
  const isHighPng = options.quality === 'high';
  const mimeType = isHighPng ? 'image/png' : 'image/jpeg';
  const fileExt = isHighPng ? 'png' : 'jpg';
  const qualityParam = isHighPng ? undefined : 0.88;

  // Prime hardware decoder
  try {
    video.currentTime = 0.001;
    await video.play().catch(() => {});
    video.pause();
  } catch (_) {}

  const seekAndDrawLayer = async (targetSec: number): Promise<void> => {
    const clampedTime = Math.max(0, Math.min(probe.duration - 0.001, targetSec));
    if (Math.abs(video.currentTime - clampedTime) > 0.005) {
      await new Promise<void>((resolve) => {
        let done = false;
        const onSeeked = () => {
          if (!done) {
            done = true;
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.currentTime = clampedTime;
        setTimeout(onSeeked, 350);
      });
    }

    if ('requestVideoFrameCallback' in video) {
      await new Promise<void>((res) => {
        (video as any).requestVideoFrameCallback(() => res());
        setTimeout(res, 50);
      });
    } else {
      await new Promise(r => setTimeout(r, 10));
    }

    ctx.drawImage(video, 0, 0, layerW, layerH);
  };

  const isLayerCanvasTransparent = (): boolean => {
    try {
      const p = ctx.getImageData(Math.floor(layerW * 0.5), Math.floor(layerH * 0.5), 1, 1).data;
      return p[3] === 0;
    } catch {
      return false;
    }
  };

  // Guaranteed Non-Blank First Frame: step forward until canvas has real pixels
  await seekAndDrawLayer(0.001);
  if (isLayerCanvasTransparent()) {
    for (const testOffset of [0.033, 0.066, 0.1, 0.15, 0.25, 0.5]) {
      if (testOffset < probe.duration) {
        await seekAndDrawLayer(testOffset);
        if (!isLayerCanvasTransparent()) break;
      }
    }
  }

  const initialLayerDataUrl = canvas.toDataURL(mimeType, qualityParam);
  let lastLayerDataUrl: string = initialLayerDataUrl;
  let lastLayerRaw: Uint8Array = base64ToUint8Array(initialLayerDataUrl);

  const isLayerCropStart = options.durationStrategy !== 'compress_full';
  const maxLayerExtractDuration = (options.targetDuration && options.targetDuration < probe.duration && isLayerCropStart)
    ? options.targetDuration
    : probe.duration;

  // Extract frames matching existing project's totalFrames
  for (let f = 0; f < totalFrames; f++) {
    const progressRatio = totalFrames > 1 ? f / (totalFrames - 1) : 0;
    const seekTime = Math.min(probe.duration, Math.max(0, progressRatio * maxLayerExtractDuration));

    if (f > 0) {
      await seekAndDrawLayer(seekTime);
    }

    const frameKey = `${prefix}${f}.${fileExt}`;

    if (isLayerCanvasTransparent()) {
      existingProject.imagesMap[frameKey] = lastLayerDataUrl;
      if (existingProject.rawImages) {
        existingProject.rawImages[frameKey] = lastLayerRaw;
      }
    } else {
      const dataUrl = canvas.toDataURL(mimeType, qualityParam);
      const rawBytes = base64ToUint8Array(dataUrl);
      existingProject.imagesMap[frameKey] = dataUrl;
      if (existingProject.rawImages) {
        existingProject.rawImages[frameKey] = rawBytes;
      }
      lastLayerDataUrl = dataUrl;
      lastLayerRaw = rawBytes;
    }

    if (f % 5 === 0 || f === totalFrames - 1) {
      onProgress(`جاري دمج إطارات الفيديو بسرعة فائقة (${f + 1}/${totalFrames})...`, 10 + Math.round((f / totalFrames) * 75));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  URL.revokeObjectURL(videoUrl);
  video.remove();

  // Extract Audio if present
  const addedAudios: SVGAAudioTrack[] = [];
  if (options.preserveAudio !== false) {
    try {
      const speedRatio = isLayerCropStart ? 1.0 : (probe.duration / projectDuration);
      const audioResult = await extractAndScaleVideoAudio(file, projectDuration, speedRatio, 'mp3');
      if (audioResult && audioResult.audioBytes && audioResult.audioBytes.length > 0) {
        const audioBytesWithId3 = ensureMp3WithId3(audioResult.audioBytes);
        const audioKey = `audio_mp4_${Date.now()}`;
        const audioBlob = new Blob([audioBytesWithId3], { type: 'audio/mp3' });
        const audioDataUrl = URL.createObjectURL(audioBlob);

        existingProject.imagesMap[audioKey] = audioDataUrl;
        if (existingProject.rawImages) {
          existingProject.rawImages[audioKey] = audioBytesWithId3;
        }

        const track: SVGAAudioTrack = {
          audioKey,
          startFrame: 0,
          endFrame: totalFrames - 1,
          startTime: 0,
          totalTime: Math.round(projectDuration * 1000),
          name: `صوت فيديو ${file.name}`,
          dataUrl: audioDataUrl,
          durationSec: projectDuration
        };

        existingProject.audios.push(track);
        addedAudios.push(track);
      }
    } catch (e) {
      console.warn('Could not extract audio for added MP4 layer:', e);
    }
  }

  const baseFileName = file.name.replace(/\.[^/.]+$/, "");
  const firstFrameKey = `${prefix}0.${fileExt}`;

  // Build masterFrames with alpha: 1 so the layer is fully visible and editable
  const masterFrames = Array.from({ length: totalFrames }, () => ({
    alpha: 1,
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    layout: { x: 0, y: 0, width: layerW, height: layerH }
  }));

  const newLayer: EditableLayer = {
    id: `layer_mp4_${Date.now()}`,
    originalIndex: 0,
    imageKey: firstFrameKey,
    name: `طبقة فيديو - ${baseFileName}`,
    type: 'image',
    visible: true,
    locked: false,
    thumbnailUrl: existingProject.imagesMap[firstFrameKey],
    inFrame: 0,
    outFrame: totalFrames - 1,
    isVideoSequence: true,
    sequencePrefix: prefix,
    sequenceGroupId: `seq_${prefix}`,
    sequenceIndex: 1,
    sequenceTotal: totalFrames,
    transform: {
      x: layerX,
      y: layerY,
      width: layerW,
      height: layerH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100
    },
    initialBounds: {
      x: layerX,
      y: layerY,
      width: layerW,
      height: layerH
    },
    originalInitialBounds: {
      x: layerX,
      y: layerY,
      width: layerW,
      height: layerH
    },
    originalTransform: {
      x: layerX,
      y: layerY,
      width: layerW,
      height: layerH,
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
      hasTransform: false,
      hasAnyExplicitAlpha: true,
      isSequenceOrRepeated: true,
      sequenceGroupId: `seq_${prefix}`,
      sequenceIndex: 1,
      sequenceTotal: totalFrames
    }
  };

  onProgress('تم دمج طبقة الفيديو بنجاح!', 100);

  return { newLayer, addedAudios };
}
