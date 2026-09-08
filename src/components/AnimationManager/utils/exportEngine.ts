import JSZip from 'jszip';
import UPNG from 'upng-js';
import lottie from 'lottie-web';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import protobuf from 'protobufjs';
import pako from 'pako';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { GifReader } from 'omggif';
import { Player as SvgaPlayer, Parser as SvgaParser } from 'svga.lite';
import { svgaSchema } from '../../../svga-proto';
import { AnimationItem, BatchExportOptions, ExportFormat, UnifiedVideoOptions } from '../types';
import { deduplicateItems } from './hashUtils';

/**
 * Trigger browser file download for a Blob
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Extract frames from a Lottie animation onto an Offscreen or standard Canvas
 */
export async function extractLottieFrames(
  lottieData: any,
  width: number,
  height: number,
  fps: number = 30,
  maxFrames: number = 600,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[] }> {
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  const anim = lottie.loadAnimation({
    container,
    renderer: 'canvas',
    loop: false,
    autoplay: false,
    animationData: JSON.parse(JSON.stringify(lottieData))
  });

  await new Promise<void>((resolve) => {
    anim.addEventListener('DOMLoaded', () => resolve());
    setTimeout(resolve, 500); // safety timeout
  });

  const totalFrames = Math.min(maxFrames, Math.max(1, Math.round(anim.totalFrames || 30)));
  const delayMs = Math.max(10, Math.round(1000 / (fps || 30)));
  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    anim.goToAndStop(i, true);
    await new Promise((r) => requestAnimationFrame(r));

    const sourceCanvas = container.querySelector('canvas');
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = width;
    targetCanvas.height = height;
    const ctx = targetCanvas.getContext('2d');

    if (ctx) {
      if (bgColor && bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      if (sourceCanvas) {
        ctx.drawImage(sourceCanvas, 0, 0, width, height);
      }
      canvases.push(targetCanvas);
      delays.push(delayMs);
    }
  }

  anim.destroy();
  document.body.removeChild(container);

  return { canvases, delays };
}

/**
 * Extract all frames from SVGA binary using svga.lite Player and Parser
 */
export async function extractPagFrames(
  file: File | Blob,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  const buffer = await file.arrayBuffer();
  const { getPAG } = await import('../../../utils/pagEngine');
  const PAG = await getPAG();
  const pagFile = await PAG.PAGFile.load(buffer);

  const width = pagFile.width() || 512;
  const height = pagFile.height() || 512;
  const fps = pagFile.frameRate() || 30;
  const durationSec = pagFile.duration() / 1000000;
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const delayMs = Math.max(16, Math.round(1000 / fps));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const pagView = await PAG.PAGView.init(pagFile, canvas);

  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    await pagView.setProgress(i / (totalFrames > 1 ? totalFrames - 1 : 1));
    await pagView.flush();

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const ctx = frameCanvas.getContext('2d');
    if (ctx) {
      if (bgColor && bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(canvas, 0, 0, width, height);
      canvases.push(frameCanvas);
      delays.push(delayMs);
    }
  }

  pagView.destroy();
  pagFile.destroy();

  return { canvases, delays, fps };
}

/**
 * Extract all frames from SVGA binary using svga.lite Player and Parser
 */
export async function extractSvgaFrames(
  file: File | Blob,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  const buffer = await file.arrayBuffer();
  const parser = new SvgaParser();
  const videoItem = await parser.do(buffer);

  const width = videoItem.videoSize?.width || 512;
  const height = videoItem.videoSize?.height || 512;
  const fps = videoItem.FPS || 30;
  const totalFrames = Math.max(1, videoItem.frames || 1);
  const delayMs = Math.max(16, Math.round(1000 / fps));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.visibility = 'hidden';
  document.body.appendChild(container);

  const playerCanvas = document.createElement('canvas');
  playerCanvas.width = width;
  playerCanvas.height = height;
  container.appendChild(playerCanvas);

  const player = new SvgaPlayer(playerCanvas);
  player.set({
    loop: 1,
    fillMode: 'forwards' as any,
    cacheFrames: true,
    intersectionObserverRender: false
  });

  await player.mount(videoItem);

  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    try {
      if ((player as any)._renderer && typeof (player as any)._renderer.drawFrame === 'function') {
        (player as any)._renderer.drawFrame(i);
      }
    } catch (err) {
      console.warn('Error drawing SVGA frame', i, err);
    }

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const ctx = frameCanvas.getContext('2d');
    if (ctx) {
      if (bgColor && bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(playerCanvas, 0, 0, width, height);
      canvases.push(frameCanvas);
      delays.push(delayMs);
    }
  }

  try {
    player.destroy();
  } catch (e) {}
  document.body.removeChild(container);

  return { canvases, delays, fps };
}

/**
 * Extract all animated frames from GIF using omggif and ImageDecoder
 */
export async function extractGifFrames(
  file: File | Blob,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  // Try modern browser ImageDecoder first
  if (typeof (window as any).ImageDecoder !== 'undefined') {
    try {
      const buffer = await file.arrayBuffer();
      const decoder = new (window as any).ImageDecoder({
        data: buffer,
        type: 'image/gif'
      });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const frameCount = track?.frameCount || 1;

      if (frameCount > 1) {
        const canvases: HTMLCanvasElement[] = [];
        const delays: number[] = [];
        for (let i = 0; i < frameCount; i++) {
          const result = await decoder.decode({ frameIndex: i });
          const imgFrame = result.image;
          const c = document.createElement('canvas');
          c.width = imgFrame.displayWidth;
          c.height = imgFrame.displayHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            if (bgColor && bgColor !== 'transparent') {
              ctx.fillStyle = bgColor;
              ctx.fillRect(0, 0, c.width, c.height);
            }
            ctx.drawImage(imgFrame, 0, 0);
          }
          canvases.push(c);
          const durationMs = imgFrame.duration ? Math.round(imgFrame.duration / 1000) : 100;
          delays.push(durationMs > 0 ? durationMs : 100);
          imgFrame.close();
        }
        if (canvases.length > 0) {
          const totalDur = delays.reduce((a, b) => a + b, 0);
          const fps = totalDur > 0 ? Math.max(1, Math.round((canvases.length * 1000) / totalDur)) : 25;
          return { canvases, delays, fps };
        }
      }
    } catch (e) {
      console.warn('ImageDecoder failed for GIF, falling back to omggif:', e);
    }
  }

  // Omggif GifReader fallback
  const buffer = await file.arrayBuffer();
  const reader = new GifReader(new Uint8Array(buffer) as any);
  const numFrames = Math.max(1, reader.numFrames());
  const width = reader.width || 512;
  const height = reader.height || 512;

  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = width;
  compositeCanvas.height = height;
  const compCtx = compositeCanvas.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < numFrames; i++) {
    const frameInfo = reader.frameInfo(i);
    const rgba = new Uint8ClampedArray(width * height * 4);
    reader.decodeAndBlitFrameRGBA(i, rgba as any);

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const fCtx = frameCanvas.getContext('2d');
    if (!fCtx || !compCtx) continue;

    const imgData = new ImageData(rgba, width, height);

    if (frameInfo.disposal === 2) {
      compCtx.clearRect(0, 0, width, height);
    }
    compCtx.putImageData(imgData, 0, 0);

    if (bgColor && bgColor !== 'transparent') {
      fCtx.fillStyle = bgColor;
      fCtx.fillRect(0, 0, width, height);
    }
    fCtx.drawImage(compositeCanvas, 0, 0);

    canvases.push(frameCanvas);
    const delayMs = (frameInfo.delay > 0 ? frameInfo.delay : 10) * 10;
    delays.push(delayMs);
  }

  const totalDur = delays.reduce((a, b) => a + b, 0);
  const fps = totalDur > 0 ? Math.max(1, Math.round((canvases.length * 1000) / totalDur)) : 25;

  return { canvases, delays, fps };
}

/**
 * Extract all animated frames from WebP
 */
export async function extractWebpFrames(
  file: File | Blob,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  if (typeof (window as any).ImageDecoder !== 'undefined') {
    try {
      const buffer = await file.arrayBuffer();
      const decoder = new (window as any).ImageDecoder({
        data: buffer,
        type: 'image/webp'
      });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const frameCount = track?.frameCount || 1;
      const canvases: HTMLCanvasElement[] = [];
      const delays: number[] = [];

      for (let i = 0; i < frameCount; i++) {
        const result = await decoder.decode({ frameIndex: i });
        const imgFrame = result.image;
        const c = document.createElement('canvas');
        c.width = imgFrame.displayWidth;
        c.height = imgFrame.displayHeight;
        const ctx = c.getContext('2d');
        if (ctx) {
          if (bgColor && bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, c.width, c.height);
          }
          ctx.drawImage(imgFrame, 0, 0);
        }
        canvases.push(c);
        const durationMs = imgFrame.duration ? Math.round(imgFrame.duration / 1000) : 100;
        delays.push(durationMs > 0 ? durationMs : 100);
        imgFrame.close();
      }

      if (canvases.length > 0) {
        const totalDur = delays.reduce((a, b) => a + b, 0);
        const fps = totalDur > 0 ? Math.max(1, Math.round((canvases.length * 1000) / totalDur)) : 25;
        return { canvases, delays, fps };
      }
    } catch (e) {
      console.warn('ImageDecoder failed for WebP, using image fallback:', e);
    }
  }

  // Fallback: single image load
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });
  const width = img.naturalWidth || 512;
  const height = img.naturalHeight || 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
  }
  URL.revokeObjectURL(url);
  return { canvases: [canvas], delays: [1000], fps: 30 };
}

/**
 * Extract frames from APNG buffer
 */
export async function extractApngFrames(
  file: File,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[] }> {
  const buffer = await file.arrayBuffer();
  const decoded = UPNG.decode(buffer);
  const rgbaBuffers = UPNG.toRGBA8(decoded);

  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  for (let i = 0; i < rgbaBuffers.length; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, decoded.width, decoded.height);
    }

    const imgData = ctx.createImageData(decoded.width, decoded.height);
    imgData.data.set(new Uint8Array(rgbaBuffers[i]));

    if (bgColor && bgColor !== 'transparent') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = decoded.width;
      tempCanvas.height = decoded.height;
      tempCanvas.getContext('2d')?.putImageData(imgData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    } else {
      ctx.putImageData(imgData, 0, 0);
    }

    canvases.push(canvas);
    delays.push(decoded.frames[i]?.delay || 100);
  }

  return { canvases, delays };
}

/**
 * Fallback frame extraction for standard images
 */
export async function extractGenericImageFrames(
  item: AnimationItem,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[] }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = item.previewUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  const width = item.dimensions.width || img.naturalWidth || 512;
  const height = item.dimensions.height || img.naturalHeight || 512;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
  }

  return {
    canvases: [canvas],
    delays: [1000]
  };
}

/**
 * Get all frames and delays for ANY animation item (SVGA, GIF, WebP, APNG, Lottie, DotLottie)
 */
export async function getItemFrames(
  item: AnimationItem,
  bgColor: string = 'transparent'
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  if (item.format === 'lottie' || item.format === 'dotlottie') {
    if (item.lottieData) {
      const fps = item.fps || 30;
      const res = await extractLottieFrames(
        item.lottieData,
        item.dimensions.width,
        item.dimensions.height,
        fps,
        Math.max(item.frameCount || 120, 600),
        bgColor
      );
      return { ...res, fps };
    }
  }

  if (item.format === 'svga') {
    return extractSvgaFrames(item.file, bgColor);
  }

  if (item.format === 'pag') {
    return extractPagFrames(item.file, bgColor);
  }

  if (item.format === 'gif') {
    return extractGifFrames(item.file, bgColor);
  }

  if (item.format === 'webp') {
    return extractWebpFrames(item.file, bgColor);
  }

  if (item.format === 'apng') {
    const res = await extractApngFrames(item.file, bgColor);
    const totalDur = res.delays.reduce((a, b) => a + b, 0);
    const fps = totalDur > 0 ? Math.max(1, Math.round((res.canvases.length * 1000) / totalDur)) : 30;
    return { ...res, fps };
  }

  const res = await extractGenericImageFrames(item, bgColor);
  return { ...res, fps: 30 };
}

/**
 * Export frames as APNG using UPNG
 */
export async function exportAsApng(
  canvases: HTMLCanvasElement[],
  delays: number[],
  width: number,
  height: number
): Promise<Blob> {
  const rgbaFrames: ArrayBuffer[] = [];

  for (const canvas of canvases) {
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const imgData = ctx.getImageData(0, 0, width, height);
    rgbaFrames.push(imgData.data.buffer as ArrayBuffer);
  }

  const apngBuffer = UPNG.encode(rgbaFrames, width, height, 0, delays);
  return new Blob([apngBuffer], { type: 'image/png' });
}

/**
 * Export frames as animated WebP assembling VP8X, ANIM, and ANMF chunks
 */
export async function exportAsWebp(
  canvases: HTMLCanvasElement[],
  delays: number[],
  width: number,
  height: number,
  quality: number = 85
): Promise<Blob> {
  if (canvases.length === 0) throw new Error('لا توجد إطارات متوفرة للتصدير');

  if (canvases.length === 1) {
    return new Promise((resolve) => {
      canvases[0].toBlob(
        (blob) => resolve(blob || new Blob([], { type: 'image/webp' })),
        'image/webp',
        quality / 100
      );
    });
  }

  // Multi-frame Animated WebP Muxing
  const frames: { data: Uint8Array; duration: number }[] = [];

  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    const dataUrl = c.toDataURL('image/webp', quality / 100);
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    frames.push({ data: bytes, duration: delays[i] || 100 });
  }

  const chunks: Uint8Array[] = [];

  // VP8X Chunk
  const vp8x = new Uint8Array(18);
  vp8x.set([0x56, 0x50, 0x38, 0x58], 0); // 'VP8X'
  vp8x.set([0x0a, 0x00, 0x00, 0x00], 4); // Size 10
  vp8x[8] = 0x12; // Animation (bit 1) + Alpha (bit 4)
  vp8x[12] = (width - 1) & 0xff;
  vp8x[13] = ((width - 1) >> 8) & 0xff;
  vp8x[14] = ((width - 1) >> 16) & 0xff;
  vp8x[15] = (height - 1) & 0xff;
  vp8x[16] = ((height - 1) >> 8) & 0xff;
  vp8x[17] = ((height - 1) >> 16) & 0xff;
  chunks.push(vp8x);

  // ANIM Chunk
  const anim = new Uint8Array(14);
  anim.set([0x41, 0x4e, 0x49, 0x4d], 0); // 'ANIM'
  anim.set([0x06, 0x00, 0x00, 0x00], 4); // Size 6
  anim.set([0, 0, 0, 0], 8); // BG Color
  anim.set([0, 0], 12); // Loop 0 = infinite
  chunks.push(anim);

  // ANMF Chunks
  for (const frame of frames) {
    let offset = 12; // Skip RIFF header
    const frameData = frame.data;
    const frameChunks: Uint8Array[] = [];

    while (offset < frameData.length) {
      const fourCC = String.fromCharCode(...frameData.slice(offset, offset + 4));
      const size =
        frameData[offset + 4] |
        (frameData[offset + 5] << 8) |
        (frameData[offset + 6] << 16) |
        (frameData[offset + 7] << 24);

      if (fourCC === 'VP8 ' || fourCC === 'VP8L' || fourCC === 'ALPH') {
        const chunkHeader = frameData.slice(offset, offset + 8);
        const chunkPayload = frameData.slice(offset + 8, offset + 8 + size);
        const padding = size % 2 !== 0 ? new Uint8Array([0]) : new Uint8Array(0);

        const fullChunk = new Uint8Array(chunkHeader.length + chunkPayload.length + padding.length);
        fullChunk.set(chunkHeader);
        fullChunk.set(chunkPayload, 8);
        if (padding.length > 0) fullChunk.set(padding, 8 + size);

        frameChunks.push(fullChunk);
      }
      offset += 8 + size + (size % 2);
    }

    let payloadSize = 0;
    frameChunks.forEach((c) => (payloadSize += c.length));
    const anmfSize = 16 + payloadSize;

    const anmf = new Uint8Array(8 + 16);
    anmf.set([0x41, 0x4e, 0x4d, 0x46], 0); // 'ANMF'
    anmf.set(
      [anmfSize & 0xff, (anmfSize >> 8) & 0xff, (anmfSize >> 16) & 0xff, (anmfSize >> 24) & 0xff],
      4
    );

    anmf[8] = 0;
    anmf[9] = 0;
    anmf[10] = 0; // X
    anmf[11] = 0;
    anmf[12] = 0;
    anmf[13] = 0; // Y

    const w = width - 1;
    const h = height - 1;
    anmf[14] = w & 0xff;
    anmf[15] = (w >> 8) & 0xff;
    anmf[16] = (w >> 16) & 0xff;
    anmf[17] = h & 0xff;
    anmf[18] = (h >> 8) & 0xff;
    anmf[19] = (h >> 16) & 0xff;

    const dur = frame.duration;
    anmf[20] = dur & 0xff;
    anmf[21] = (dur >> 8) & 0xff;
    anmf[22] = (dur >> 16) & 0xff;

    anmf[23] = 0x01; // Blend with previous frame

    chunks.push(anmf);
    frameChunks.forEach((c) => chunks.push(c));
  }

  let totalSize = 4; // 'WEBP'
  chunks.forEach((c) => (totalSize += c.length));

  const riff = new Uint8Array(8);
  riff.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  riff.set(
    [totalSize & 0xff, (totalSize >> 8) & 0xff, (totalSize >> 16) & 0xff, (totalSize >> 24) & 0xff],
    4
  );

  const webpHeader = new Uint8Array(4);
  webpHeader.set([0x57, 0x45, 0x42, 0x50], 0); // 'WEBP'

  return new Blob([riff, webpHeader, ...chunks], { type: 'image/webp' });
}

/**
 * Export frames as animated GIF with 256-color quantization and transparency
 */
export async function exportAsGif(
  canvases: HTMLCanvasElement[],
  delays: number[],
  width: number,
  height: number
): Promise<Blob> {
  try {
    const gif = GIFEncoder();
    const total = canvases.length;

    for (let i = 0; i < total; i++) {
      const canvas = canvases[i];
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const imgData = ctx.getImageData(0, 0, width, height);
      const rgba = imgData.data;

      // Quantize into 256 colors palette with transparency
      const palette = quantize(rgba, 256);
      const index = applyPalette(rgba, palette);
      const delayMs = delays[i] || 100;

      gif.writeFrame(index, width, height, {
        palette,
        delay: delayMs,
        transparent: true,
        dispose: 2 // restore to background
      });
    }

    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } catch (err) {
    console.warn('gifenc failed, fallback to APNG representation:', err);
    return exportAsApng(canvases, delays, width, height);
  }
}

/**
 * Export frames or Lottie data as SVGA 2.0 binary Blob
 */
export async function exportAsSvga(
  canvases: HTMLCanvasElement[],
  delays: number[],
  width: number,
  height: number,
  fps: number = 30,
  lottieData?: any,
  compressionLevel: number = 80
): Promise<Blob> {
  // If Lottie data is available, try vector rebuilder first
  if (lottieData) {
    try {
      const { rebuildLottieToSvga } = await import('../../../utils/lottieToSvgaRebuilder');
      const result = await rebuildLottieToSvga(lottieData, {
        mode: 'smart_hybrid',
        target10MB: false
      });
      if (result && result.blob && result.blob.size > 0) {
        return result.blob;
      }
    } catch (err) {
      console.warn('Lottie vector rebuild failed, falling back to frame sequence SVGA:', err);
    }
  }

  // Frame sequence to SVGA 2.0
  const root = protobuf.parse(svgaSchema).root;
  const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');

  const totalFrames = Math.max(1, canvases.length);
  const imagesData: Record<string, Uint8Array> = {};
  const finalSprites: any[] = [];

  // 0% (compressionLevel=0) -> 16 colors, 100% (compressionLevel=100) -> 0 (lossless)
  const cnum = compressionLevel >= 95 ? 0 : Math.max(16, Math.round(256 * (compressionLevel / 100)));

  // Compress individual PNG frames using UPNG before adding to protobuf
  for (let i = 0; i < totalFrames; i++) {
    const canvas = canvases[i];
    let bytes: Uint8Array;

    if (cnum > 0) {
      // High compression using UPNG quantization
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const upngBuffer = UPNG.encode([imgData.data.buffer as ArrayBuffer], width, height, cnum);
        bytes = new Uint8Array(upngBuffer);
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];
        const binaryStr = atob(base64Data);
        bytes = new Uint8Array(binaryStr.length);
        for (let k = 0; k < binaryStr.length; k++) bytes[k] = binaryStr.charCodeAt(k);
      }
    } else {
      // Lossless using browser's native fast PNG encoder
      const dataUrl = canvas.toDataURL('image/png');
      const base64Data = dataUrl.split(',')[1];
      const binaryStr = atob(base64Data);
      bytes = new Uint8Array(binaryStr.length);
      for (let k = 0; k < binaryStr.length; k++) {
        bytes[k] = binaryStr.charCodeAt(k);
      }
    }

    const currentKey = `img_${i}`;
    imagesData[currentKey] = bytes;

    finalSprites.push({
      imageKey: currentKey,
      frames: new Array(totalFrames).fill(null).map((_, idx) =>
        idx === i
          ? { alpha: 1.0, layout: { x: 0, y: 0, width, height }, transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } }
          : { alpha: 0, layout: { x: 0, y: 0, width, height }, transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } }
      )
    });
  }

  const payload = {
    version: '2.0',
    params: {
      viewBoxWidth: width,
      viewBoxHeight: height,
      fps: Math.max(1, fps),
      frames: totalFrames
    },
    images: imagesData,
    sprites: finalSprites,
    audios: []
  };

  const movie = MovieEntity.create(payload);
  const buffer = MovieEntity.encode(movie).finish();
  
  // map 0-100 (where 0 is max compression) to pako 1-9 (where 9 is max compression)
  const pakoLevel = Math.max(1, Math.min(9, Math.round(9 - (compressionLevel / 100) * 8))) as any;
  const deflated = pako.deflate(buffer, { level: pakoLevel });
  
  return new Blob([deflated], { type: 'application/octet-stream' });
}

/**
 * Export frames as a ZIP of individual PNG frames
 */
export async function exportAsPngFramesZip(
  canvases: HTMLCanvasElement[],
  name: string,
  delays: number[]
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`${name}_frames`);

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    );
    if (blob) {
      const paddedIndex = String(i + 1).padStart(4, '0');
      folder?.file(`frame_${paddedIndex}.png`, blob);
    }
  }

  // Metadata json
  folder?.file(
    'metadata.json',
    JSON.stringify(
      {
        totalFrames: canvases.length,
        delays,
        exportedAt: new Date().toISOString(),
        generator: 'SVGA Motion Studio'
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Package Lottie JSON as DotLottie (.lottie) archive
 */
export async function packageAsDotLottie(
  lottieData: any,
  animationId: string = 'animation_1'
): Promise<Blob> {
  const zip = new JSZip();

  const manifest = {
    generator: 'SVGA Motion Studio',
    version: 1,
    author: 'SVGA Motion Studio',
    animations: [
      {
        id: animationId,
        speed: 1,
        loop: true,
        direction: 1
      }
    ]
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file(`animations/${animationId}.json`, JSON.stringify(lottieData, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Export frames to MP4 using mp4-muxer and Canvas/VideoEncoder
 */
export async function exportAsMp4(
  canvases: HTMLCanvasElement[],
  delays: number[],
  width: number,
  height: number,
  fps: number = 30,
  bgColor: string = '#000000',
  compressionLevel: number = 80
): Promise<Blob> {
  // Ensure even dimensions for H.264
  const evenWidth = width % 2 === 0 ? width : width + 1;
  const evenHeight = height % 2 === 0 ? height : height + 1;

  const minBitrate = 500_000;
  const maxBitrate = 12_000_000;
  const calculatedBitrate = Math.round(minBitrate + (compressionLevel / 100) * (maxBitrate - minBitrate));

  // Try WebCodecs VideoEncoder + mp4-muxer if available
  if (typeof VideoEncoder !== 'undefined') {
    try {
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width: evenWidth,
          height: evenHeight
        },
        fastStart: 'in-memory'
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e)
      });

      await videoEncoder.configure({
        codec: 'avc1.42001f',
        width: evenWidth,
        height: evenHeight,
        bitrate: calculatedBitrate,
        framerate: fps
      });

      let timestampMicros = 0;
      const frameDurationMicros = Math.round(1_000_000 / fps);

      for (let i = 0; i < canvases.length; i++) {
        const srcCanvas = canvases[i];
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = evenWidth;
        renderCanvas.height = evenHeight;
        const ctx = renderCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = bgColor || '#000000';
          ctx.fillRect(0, 0, evenWidth, evenHeight);
          ctx.drawImage(srcCanvas, 0, 0, evenWidth, evenHeight);
        }

        const frameDelay = delays[i] || Math.round(1000 / fps);
        const frameDurMicros = Math.round(frameDelay * 1000);

        const frame = new VideoFrame(renderCanvas, {
          timestamp: timestampMicros,
          duration: frameDurMicros
        });

        videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
        frame.close();

        timestampMicros += frameDurMicros;
      }

      await videoEncoder.flush();
      muxer.finalize();

      return new Blob([target.buffer], { type: 'video/mp4' });
    } catch (e) {
      console.warn('WebCodecs MP4 export failed, trying MediaRecorder fallback:', e);
    }
  }

  // Fallback: MediaRecorder stream
  return new Promise((resolve, reject) => {
    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = evenWidth;
    renderCanvas.height = evenHeight;
    const ctx = renderCanvas.getContext('2d');

    const stream = renderCanvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
      ? 'video/webm;codecs=h264'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.start();

    let frameIdx = 0;
    const drawNext = () => {
      if (frameIdx >= canvases.length) {
        recorder.stop();
        return;
      }
      if (ctx) {
        ctx.fillStyle = bgColor || '#000000';
        ctx.fillRect(0, 0, evenWidth, evenHeight);
        ctx.drawImage(canvases[frameIdx], 0, 0, evenWidth, evenHeight);
      }
      const delay = delays[frameIdx] || Math.round(1000 / fps);
      frameIdx++;
      setTimeout(drawNext, delay);
    };

    drawNext();
  });
}

/**
 * Export a single item to any requested format
 */
export async function exportItem(
  item: AnimationItem,
  format: ExportFormat,
  options: {
    backgroundColor?: string;
    fps?: number;
    quality?: number;
    compressionLevel?: number;
  } = {}
): Promise<{ blob: Blob; extension: string; filename: string }> {
  const { backgroundColor = 'transparent', fps = item.fps || 30, quality = 90, compressionLevel = 80 } = options;
  const cleanName = item.name.trim() || 'animation';

  if (format === 'original') {
    const ext = item.originalName.split('.').pop() || 'bin';
    return {
      blob: item.file,
      extension: ext,
      filename: `${cleanName}.${ext}`
    };
  }

  if (format === 'lottie' && item.lottieData) {
    const jsonStr = JSON.stringify(item.lottieData, null, 2);
    return {
      blob: new Blob([jsonStr], { type: 'application/json' }),
      extension: 'json',
      filename: `${cleanName}.json`
    };
  }

  if (format === 'dotlottie' && item.lottieData) {
    const blob = await packageAsDotLottie(item.lottieData, cleanName);
    return {
      blob,
      extension: 'lottie',
      filename: `${cleanName}.lottie`
    };
  }

  if (format === 'svga' && item.originalName.toLowerCase().endsWith('.svga') && item.file) {
    // If the original was SVGA, use deep compression to preserve vectors instead of flattening frames
    const { compressSvgaFile } = await import('../../../utils/pagEngine');
    const { svgaBlob } = await compressSvgaFile(item.file, {
      compressionQuality: compressionLevel,
      targetFps: fps
    });
    return {
      blob: svgaBlob,
      extension: 'svga',
      filename: `${cleanName}.svga`
    };
  }

  // Needs frame extraction
  const { canvases, delays } = await getItemFrames(item, backgroundColor);
  const width = item.dimensions.width;
  const height = item.dimensions.height;

  if (format === 'png_frames') {
    const blob = await exportAsPngFramesZip(canvases, cleanName, delays);
    return {
      blob,
      extension: 'zip',
      filename: `${cleanName}_frames.zip`
    };
  }

  if (format === 'apng') {
    const blob = await exportAsApng(canvases, delays, width, height);
    return {
      blob,
      extension: 'png',
      filename: `${cleanName}.png`
    };
  }

  if (format === 'webp') {
    const blob = await exportAsWebp(canvases, delays, width, height, quality);
    return {
      blob,
      extension: 'webp',
      filename: `${cleanName}.webp`
    };
  }

  if (format === 'gif') {
    const blob = await exportAsGif(canvases, delays, width, height);
    return {
      blob,
      extension: 'gif',
      filename: `${cleanName}.gif`
    };
  }

  if (format === 'svga') {
    const blob = await exportAsSvga(
      canvases,
      delays,
      width,
      height,
      fps,
      item.lottieData,
      compressionLevel
    );
    return {
      blob,
      extension: 'svga',
      filename: `${cleanName}.svga`
    };
  }

  if (format === 'mp4') {
    const blob = await exportAsMp4(
      canvases,
      delays,
      width,
      height,
      fps,
      backgroundColor === 'transparent' ? '#000000' : backgroundColor,
      compressionLevel
    );
    return {
      blob,
      extension: 'mp4',
      filename: `${cleanName}.mp4`
    };
  }

  // Fallback original
  return {
    blob: item.file,
    extension: item.originalName.split('.').pop() || 'bin',
    filename: item.originalName
  };
}

/**
 * Batch export multiple items packaged into a single ZIP with deduplication
 */
export async function batchExportToZip(
  items: AnimationItem[],
  options: BatchExportOptions,
  onProgress?: (progress: {
    current: number;
    total: number;
    percentage: number;
    currentName: string;
  }) => void
): Promise<Blob> {
  // Deduplicate items before export if requested
  const exportItems = options.deduplicateBeforeExport
    ? deduplicateItems(items)
    : items;

  const zip = new JSZip();
  const total = exportItems.length;

  for (let i = 0; i < total; i++) {
    const item = exportItems[i];
    const currentName = item.name || item.originalName;

    onProgress?.({
      current: i + 1,
      total,
      percentage: Math.round(((i + 0.2) / total) * 100),
      currentName
    });

    try {
      const { blob, filename } = await exportItem(item, options.format, {
        backgroundColor: options.backgroundColor,
        fps: options.fps,
        quality: options.quality,
        compressionLevel: options.compressionLevel
      });

      // Avoid filename collisions inside the ZIP
      let finalName = filename;
      let counter = 1;
      while (zip.file(finalName)) {
        const dotIdx = filename.lastIndexOf('.');
        if (dotIdx !== -1) {
          finalName = `${filename.substring(0, dotIdx)}_${counter}${filename.substring(dotIdx)}`;
        } else {
          finalName = `${filename}_${counter}`;
        }
        counter++;
      }

      zip.file(finalName, blob);
    } catch (err) {
      console.error(`Error exporting item ${item.name}:`, err);
    }

    onProgress?.({
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
      currentName
    });
  }

  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE' },
    (metadata) => {
      onProgress?.({
        current: total,
        total,
        percentage: Math.min(100, Math.round(metadata.percent)),
        currentName: 'جاري إنشاء حزمة الـ ZIP النهائية...'
      });
    }
  );
}

/**
 * Create a single unified MP4 video montage combining all selected animations
 */
export async function exportUnifiedMp4Video(
  items: AnimationItem[],
  options: UnifiedVideoOptions,
  onProgress?: (progress: {
    percentage: number;
    currentName: string;
    currentIndex: number;
    totalItems: number;
    renderedFrames: number;
    totalFrames: number;
  }) => void
): Promise<{ blob: Blob; filename: string; durationSec: number }> {
  if (items.length === 0) throw new Error('لا توجد ملفات محددة لإنشاء الفيديو');

  const {
    durationMode = 'original',
    durationPerItemSec = 3,
    fps = 30,
    resolution = { width: 1080, height: 1080, label: '1080x1080' },
    backgroundColor = '#000000',
    showItemName = true,
    transitionType = 'crossfade',
    transitionDurationSec = 0.3,
    layoutMode = 'sequential',
    backgroundImageUrl = null,
    compressionLevel = 80 // 0 = low quality (high compression), 100 = high quality
  } = options;

  const targetW = resolution.width % 2 === 0 ? resolution.width : resolution.width + 1;
  const targetH = resolution.height % 2 === 0 ? resolution.height : resolution.height + 1;
  const isOriginalDuration = durationMode === 'original';
  const transitionFrames = transitionType === 'crossfade' ? Math.round(transitionDurationSec * fps) : 0;

  // Step 1: Pre-extract frames for each item
  onProgress?.({
    percentage: 5,
    currentName: 'جاري فحص واستخراج إطارات الحركات بدقة...',
    currentIndex: 0,
    totalItems: items.length,
    renderedFrames: 0,
    totalFrames: items.length * 30
  });

  const extractedItems: Array<{
    item: AnimationItem;
    canvases: HTMLCanvasElement[];
    delays: number[];
    loopDurationMs: number;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const itm = items[i];
    onProgress?.({
      percentage: Math.round(5 + ((i + 1) / items.length) * 20),
      currentName: `جاري تجهيز: ${itm.name}`,
      currentIndex: i + 1,
      totalItems: items.length,
      renderedFrames: 0,
      totalFrames: items.length * 30
    });

    try {
      const { canvases, delays } = await getItemFrames(itm, 'transparent');
      const loopDurationMs =
        delays.reduce((sum, d) => sum + d, 0) ||
        Math.max(300, canvases.length * (1000 / (itm.fps || 30)));
      extractedItems.push({ item: itm, canvases, delays, loopDurationMs });
    } catch (err) {
      console.warn(`Failed extracting frames for ${itm.name}, using generic fallback`, err);
      const { canvases, delays } = await extractGenericImageFrames(itm, 'transparent');
      extractedItems.push({ item: itm, canvases, delays, loopDurationMs: 1000 });
    }
  }

  // Calculate total frames based on layout mode
  let itemFrameCounts: number[] = [];
  let totalFrames = 0;
  let videoFramesCount = 0;

  if (layoutMode === 'sequential') {
    itemFrameCounts = extractedItems.map((extracted) => {
      if (isOriginalDuration) {
        const durSec = Math.max(0.2, (extracted.loopDurationMs || 1000) / 1000);
        return Math.max(1, Math.round(durSec * fps));
      } else {
        return Math.max(1, Math.round(durationPerItemSec * fps));
      }
    });
    totalFrames = itemFrameCounts.reduce((sum, count) => sum + count, 0);
    videoFramesCount = totalFrames;
  } else {
    // Simultaneous modes (stacked or grid)
    let maxDurSec = 3;
    if (isOriginalDuration) {
      maxDurSec = Math.max(0.2, ...extractedItems.map(e => (e.loopDurationMs || 1000) / 1000));
    } else {
      maxDurSec = durationPerItemSec;
    }
    totalFrames = Math.max(1, Math.round(maxDurSec * fps));
    videoFramesCount = totalFrames;
    itemFrameCounts = extractedItems.map(() => totalFrames); // Everyone gets same frame count
  }

  // Calculate Bitrate from Compression Level (0-100)
  // 0% -> 500kbps, 100% -> 12Mbps
  const minBitrate = 500_000;
  const maxBitrate = 12_000_000;
  const calculatedBitrate = Math.round(minBitrate + (compressionLevel / 100) * (maxBitrate - minBitrate));

  // Load Background Image
  let bgImg: HTMLImageElement | null = null;
  if (backgroundImageUrl) {
    bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    try {
      await new Promise<void>((resolve, reject) => {
        if (!bgImg) return reject();
        bgImg.onload = () => resolve();
        bgImg.onerror = reject;
        bgImg.src = backgroundImageUrl;
      });
    } catch (e) {
      console.warn('Failed to load custom background image', e);
      bgImg = null;
    }
  }

  // Setup MP4 Muxer & WebCodecs
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: targetW,
      height: targetH
    },
    fastStart: 'in-memory'
  });

  let videoEncoder: VideoEncoder | null = null;
  if (typeof VideoEncoder !== 'undefined') {
    try {
      videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e)
      });

      await videoEncoder.configure({
        codec: 'avc1.42001f',
        width: targetW,
        height: targetH,
        bitrate: calculatedBitrate,
        framerate: fps
      });
    } catch (e) {
      console.warn('VideoEncoder configuration failed, fallback to MediaRecorder:', e);
      videoEncoder = null;
    }
  }

  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = targetW;
  renderCanvas.height = targetH;
  const ctx = renderCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر إنشاء سياق رسم الفيديو Canvas 2D');

  let mediaRecorder: MediaRecorder | null = null;
  const recordedChunks: Blob[] = [];

  if (!videoEncoder) {
    const stream = renderCanvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=h264')
      ? 'video/webm;codecs=h264'
      : 'video/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start();
  }

  const frameDurationMicros = Math.round(1_000_000 / fps);
  let globalTimestampMicros = 0;
  let renderedCount = 0;

  const drawBackground = () => {
    ctx.fillStyle = backgroundColor || '#000000';
    ctx.fillRect(0, 0, targetW, targetH);
    if (bgImg) {
      const imgRatio = bgImg.width / bgImg.height;
      const targetRatio = targetW / targetH;
      let drawW = targetW;
      let drawH = targetH;
      let drawX = 0;
      let drawY = 0;
      if (imgRatio > targetRatio) {
        drawW = targetH * imgRatio;
        drawX = (targetW - drawW) / 2;
      } else {
        drawH = targetW / imgRatio;
        drawY = (targetH - drawH) / 2;
      }
      ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    }
  };

  const drawItemFrame = (
    context: CanvasRenderingContext2D,
    extracted: typeof extractedItems[0],
    timeInItemMs: number,
    alpha: number = 1.0,
    customW?: number,
    customH?: number,
    customX?: number,
    customY?: number
  ) => {
    const { canvases, delays, loopDurationMs } = extracted;
    if (canvases.length === 0) return;

    const modTime = timeInItemMs % (loopDurationMs || 1000);
    let accum = 0;
    let frameIdx = 0;
    for (let k = 0; k < canvases.length; k++) {
      accum += delays[k] || 1000 / 30;
      if (accum >= modTime) {
        frameIdx = k;
        break;
      }
    }
    const sourceCanvas = canvases[frameIdx] || canvases[0];

    let drawW, drawH, drawX, drawY;
    
    if (customW !== undefined && customH !== undefined && customX !== undefined && customY !== undefined) {
       // Fit into bounding box while preserving aspect ratio
       const scale = Math.min(customW / sourceCanvas.width, customH / sourceCanvas.height);
       drawW = sourceCanvas.width * scale;
       drawH = sourceCanvas.height * scale;
       drawX = customX + (customW - drawW) / 2;
       drawY = customY + (customH - drawH) / 2;
    } else {
       const scale = Math.min((targetW * 0.85) / sourceCanvas.width, (targetH * 0.78) / sourceCanvas.height);
       drawW = Math.round(sourceCanvas.width * scale);
       drawH = Math.round(sourceCanvas.height * scale);
       drawX = Math.round((targetW - drawW) / 2);
       drawY = Math.round((targetH - drawH) / 2) - 20;
    }

    context.save();
    context.globalAlpha = alpha;
    context.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);
    context.restore();
  };

  if (layoutMode === 'sequential') {
    // Render loop for Sequential layout
    for (let i = 0; i < extractedItems.length; i++) {
      const curr = extractedItems[i];
      const next = i + 1 < extractedItems.length ? extractedItems[i + 1] : null;
      const currentItemFrames = itemFrameCounts[i];

      for (let f = 0; f < currentItemFrames; f++) {
        const timeInItemSec = f / fps;
        const timeInItemMs = timeInItemSec * 1000;

        drawBackground();

        // Smooth transition or direct cut
        const remainingFrames = currentItemFrames - f;
        if (next && transitionFrames > 0 && remainingFrames <= transitionFrames) {
          const tProgress = 1 - remainingFrames / transitionFrames;
          drawItemFrame(ctx, curr, timeInItemMs, 1 - tProgress);
          drawItemFrame(ctx, next, tProgress * (1000 / fps), tProgress);
        } else {
          drawItemFrame(ctx, curr, timeInItemMs, 1.0);
        }

        // Draw item watermark/title badge
        if (showItemName) {
          const badgeText = `${i + 1}/${items.length} • ${curr.item.name}`;
          ctx.font = 'bold 24px sans-serif';
          const metrics = ctx.measureText(badgeText);
          const bW = metrics.width + 50;
          const bH = 46;
          const bX = (targetW - bW) / 2;
          const bY = targetH - bH - 36;

          ctx.save();
          ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bX, bY, bW, bH, 23);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, targetW / 2, bY + bH / 2);
          ctx.restore();
        }

        if (videoEncoder) {
          const vFrame = new VideoFrame(renderCanvas, {
            timestamp: globalTimestampMicros,
            duration: frameDurationMicros
          });
          videoEncoder.encode(vFrame, { keyFrame: renderedCount % (fps * 2) === 0 });
          vFrame.close();
        } else {
          await new Promise((r) => setTimeout(r, Math.round(1000 / fps)));
        }

        globalTimestampMicros += frameDurationMicros;
        renderedCount++;

        if (renderedCount % 12 === 0 || renderedCount === totalFrames) {
          const pct = Math.round(25 + (renderedCount / totalFrames) * 72);
          onProgress?.({
            percentage: Math.min(98, pct),
            currentName: curr.item.name,
            currentIndex: i + 1,
            totalItems: items.length,
            renderedFrames: renderedCount,
            totalFrames
          });
          await new Promise((r) => requestAnimationFrame(r));
        }
      }
    }
  } else {
    // Render loop for Simultaneous layouts (Grid or Stacked Vertical)
    for (let f = 0; f < videoFramesCount; f++) {
      const timeInSec = f / fps;
      const timeInMs = timeInSec * 1000;

      drawBackground();

      if (layoutMode === 'stacked_vertical') {
        const itemHeight = targetH / items.length;
        for (let i = 0; i < extractedItems.length; i++) {
          const curr = extractedItems[i];
          const padding = itemHeight * 0.1;
          drawItemFrame(ctx, curr, timeInMs, 1.0, targetW * 0.9, itemHeight - padding * 2, targetW * 0.05, i * itemHeight + padding);
        }
      } else if (layoutMode === 'grid_simultaneous') {
        const cols = Math.ceil(Math.sqrt(items.length));
        const rows = Math.ceil(items.length / cols);
        const cellW = targetW / cols;
        const cellH = targetH / rows;
        
        for (let i = 0; i < extractedItems.length; i++) {
          const curr = extractedItems[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const paddingW = cellW * 0.1;
          const paddingH = cellH * 0.1;
          drawItemFrame(ctx, curr, timeInMs, 1.0, cellW - paddingW * 2, cellH - paddingH * 2, col * cellW + paddingW, row * cellH + paddingH);
        }
      }

      if (videoEncoder) {
        const vFrame = new VideoFrame(renderCanvas, {
          timestamp: globalTimestampMicros,
          duration: frameDurationMicros
        });
        videoEncoder.encode(vFrame, { keyFrame: renderedCount % (fps * 2) === 0 });
        vFrame.close();
      } else {
        await new Promise((r) => setTimeout(r, Math.round(1000 / fps)));
      }

      globalTimestampMicros += frameDurationMicros;
      renderedCount++;

      if (renderedCount % 12 === 0 || renderedCount === totalFrames) {
        const pct = Math.round(25 + (renderedCount / totalFrames) * 72);
        onProgress?.({
          percentage: Math.min(98, pct),
          currentName: 'جاري الرندر المتزامن...',
          currentIndex: items.length,
          totalItems: items.length,
          renderedFrames: renderedCount,
          totalFrames
        });
        await new Promise((r) => requestAnimationFrame(r));
      }
    }
  }

  onProgress?.({
    percentage: 99,
    currentName: 'جاري الانتهاء وحفظ ملف الفيديو MP4...',
    currentIndex: items.length,
    totalItems: items.length,
    renderedFrames: totalFrames,
    totalFrames
  });

  let finalBlob: Blob;
  if (videoEncoder) {
    await videoEncoder.flush();
    muxer.finalize();
    finalBlob = new Blob([target.buffer], { type: 'video/mp4' });
  } else if (mediaRecorder) {
    mediaRecorder.stop();
    await new Promise<void>((resolve) => {
      if (mediaRecorder) mediaRecorder.onstop = () => resolve();
    });
    finalBlob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'video/mp4' });
  } else {
    throw new Error('فشل تصدير الفيديو: لا يتوفر مشفر فيديو مدعوم');
  }

  const durationSec = Math.round(totalFrames / fps);
  return {
    blob: finalBlob,
    filename: `unified_animation_video_${items.length}_items.mp4`,
    durationSec
  };
}
