/**
 * AI Video Person & Object Segmentation Engine
 * High-precision browser-based video matting using MediaPipe AI & advanced canvas pixel filters
 */

import { SelfieSegmentation } from '@mediapipe/selfie_segmentation';
import * as pako from 'pako';
import { parse } from 'protobufjs';
import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';

export interface AISegmentationSettings {
  // Model
  modelAccuracy: 'general' | 'landscape'; // general = higher accuracy (256x256), landscape = faster
  
  // Edge Refinement
  edgeErosion: number;       // 0 to 10 px - cuts away outer fringes/halo
  edgeFeather: number;       // 0 to 20 px - smooths alpha borders (Gaussian blur)
  alphaThreshold: number;    // 0 to 100% - confidence cutoff
  alphaContrast: number;     // 1.0 to 3.0 - sharpens the edge gradient
  
  // Chroma & Color Spill
  despillEnabled: boolean;
  despillColor: 'green' | 'blue' | 'custom';
  despillCustomColor?: { r: number; g: number; b: number };
  despillAmount: number;     // 0 to 100%
  
  // Temporal Stabilization
  temporalSmoothing: number; // 0 to 80% (smooths mask with previous frame)
  
  // Region of Interest (ROI) - 0 to 1 normalized
  useRoi: boolean;
  roi: { x: number; y: number; width: number; height: number };
  
  // Hybrid Chroma Key (if background is green/blue/solid)
  hybridChromaEnabled: boolean;
  chromaColor: string; // Hex
  chromaTolerance: number; // 1 to 100
  chromaSmoothness: number; // 0 to 50
  
  // Output view
  viewMode: 'transparent' | 'chroma' | 'black' | 'white' | 'mask' | 'split' | 'custom';
  customBgColor: string;
  customBgImage?: string;
  splitPosition: number; // 0 to 100%
}

export const DEFAULT_SEGMENTATION_SETTINGS: AISegmentationSettings = {
  modelAccuracy: 'general',
  edgeErosion: 2,
  edgeFeather: 3,
  alphaThreshold: 45,
  alphaContrast: 1.4,
  despillEnabled: true,
  despillColor: 'green',
  despillAmount: 60,
  temporalSmoothing: 35,
  useRoi: false,
  roi: { x: 0, y: 0, width: 1, height: 1 },
  hybridChromaEnabled: false,
  chromaColor: '#00FF00',
  chromaTolerance: 30,
  chromaSmoothness: 10,
  viewMode: 'transparent',
  customBgColor: '#0f172a',
  splitPosition: 50,
};

let segmenterInstance: SelfieSegmentation | null = null;
let isInitializing = false;
let initPromise: Promise<SelfieSegmentation> | null = null;

/**
 * Initialize MediaPipe SelfieSegmentation model with CDN fallback
 */
export async function getSelfieSegmenter(modelSelection: 0 | 1 = 1): Promise<SelfieSegmentation> {
  if (segmenterInstance) {
    return segmenterInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const segmenter = new SelfieSegmentation({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        },
      });

      segmenter.setOptions({
        modelSelection: modelSelection,
        selfieMode: false,
      });

      await segmenter.initialize();
      segmenterInstance = segmenter;
      return segmenter;
    } catch (err) {
      console.warn('Failed to init SelfieSegmentation from npm, trying window global...', err);
      // Try to load script dynamically if needed
      if (!(window as any).SelfieSegmentation) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load MediaPipe SelfieSegmentation CDN script'));
          document.head.appendChild(script);
        });
      }

      const GlobalSelfie = (window as any).SelfieSegmentation;
      const segmenter = new GlobalSelfie({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      segmenter.setOptions({
        modelSelection: modelSelection,
        selfieMode: false,
      });

      await segmenter.initialize();
      segmenterInstance = segmenter;
      return segmenter;
    }
  })();

  return initPromise;
}

/**
 * Fast Morphological Erosion on Alpha Buffer
 * Shrinks the mask inward by `radius` pixels to remove edge fringe/halos
 */
export function erodeMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return alpha;

  const output = new Uint8ClampedArray(alpha.length);
  const r = Math.min(radius, 8);

  for (let y = 0; y < height; y++) {
    const yMin = Math.max(0, y - r);
    const yMax = Math.min(height - 1, y + r);

    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - r);
      const xMax = Math.min(width - 1, x + r);

      let minVal = 255;

      // Sample local neighborhood
      for (let ny = yMin; ny <= yMax; ny++) {
        const rowOffset = ny * width;
        for (let nx = xMin; nx <= xMax; nx++) {
          const val = alpha[rowOffset + nx];
          if (val < minVal) {
            minVal = val;
          }
        }
      }

      output[y * width + x] = minVal;
    }
  }

  return output;
}

/**
 * Fast 2-pass Gaussian / Box Blur for Alpha Feathering
 */
export function featherMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return alpha;

  const r = Math.min(radius, 15);
  const temp = new Float32Array(alpha.length);
  const output = new Uint8ClampedArray(alpha.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const xMin = Math.max(0, x - r);
      const xMax = Math.min(width - 1, x + r);
      let sum = 0;
      let count = 0;
      for (let nx = xMin; nx <= xMax; nx++) {
        sum += alpha[rowOffset + nx];
        count++;
      }
      temp[rowOffset + x] = sum / count;
    }
  }

  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const yMin = Math.max(0, y - r);
      const yMax = Math.min(height - 1, y + r);
      let sum = 0;
      let count = 0;
      for (let ny = yMin; ny <= yMax; ny++) {
        sum += temp[ny * width + x];
        count++;
      }
      output[y * width + x] = Math.round(sum / count);
    }
  }

  return output;
}

/**
 * Apply De-Spill (Green/Blue background reflection neutralization)
 */
export function applyDeSpill(
  r: number,
  g: number,
  b: number,
  despillType: 'green' | 'blue' | 'custom',
  amount: number
): { r: number; g: number; b: number } {
  if (amount <= 0) return { r, g, b };
  const factor = amount / 100;

  if (despillType === 'green') {
    // Green spill suppression: G should not exceed average of R and B
    const maxAllowedGreen = (r + b) / 2;
    if (g > maxAllowedGreen) {
      const excess = g - maxAllowedGreen;
      const newG = g - excess * factor;
      return { r, g: Math.max(0, Math.round(newG)), b };
    }
  } else if (despillType === 'blue') {
    const maxAllowedBlue = (r + g) / 2;
    if (b > maxAllowedBlue) {
      const excess = b - maxAllowedBlue;
      const newB = b - excess * factor;
      return { r, g, b: Math.max(0, Math.round(newB)) };
    }
  }

  return { r, g, b };
}

/**
 * Convert Hex Color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 0, g: 255, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Segment a single frame from video/canvas and render the cut result to an output canvas
 */
export async function processFrameWithAI(
  inputSource: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  segmenter: SelfieSegmentation,
  outputCanvas: HTMLCanvasElement,
  settings: AISegmentationSettings,
  previousAlphaMask?: Uint8ClampedArray | null
): Promise<{ alphaMask: Uint8ClampedArray }> {
  const width = outputCanvas.width;
  const height = outputCanvas.height;
  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. Run MediaPipe segmentation
  let rawSegmentationResult: any = null;
  await new Promise<void>((resolve) => {
    segmenter.onResults((results) => {
      rawSegmentationResult = results;
      resolve();
    });
    segmenter.send({ image: inputSource as any });
  });

  if (!rawSegmentationResult || !rawSegmentationResult.segmentationMask) {
    throw new Error('AI Segmentation failed to produce mask');
  }

  // 2. Draw raw mask onto a helper canvas to extract pixel values
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  if (!mCtx) throw new Error('Mask canvas context unavailable');

  mCtx.drawImage(rawSegmentationResult.segmentationMask, 0, 0, width, height);
  const maskImageData = mCtx.getImageData(0, 0, width, height);
  const maskPixels = maskImageData.data;

  // 3. Draw original frame to get RGB source pixels
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx) throw new Error('Source canvas context unavailable');

  sCtx.drawImage(inputSource as any, 0, 0, width, height);
  const srcImageData = sCtx.getImageData(0, 0, width, height);
  const srcPixels = srcImageData.data;

  // 4. Build single-channel alpha array
  const totalPixels = width * height;
  let alphaArray = new Uint8ClampedArray(totalPixels);

  const thresholdNormalized = (settings.alphaThreshold / 100) * 255;
  const contrast = settings.alphaContrast || 1.4;

  const roi = settings.useRoi ? settings.roi : { x: 0, y: 0, width: 1, height: 1 };
  const minRoiX = Math.floor(roi.x * width);
  const maxRoiX = Math.floor((roi.x + roi.width) * width);
  const minRoiY = Math.floor(roi.y * height);
  const maxRoiY = Math.floor((roi.y + roi.height) * height);

  // Chroma RGB if hybrid chroma keying is enabled
  const chromaRgb = settings.hybridChromaEnabled ? hexToRgb(settings.chromaColor) : null;
  const chromaTol = settings.chromaTolerance * 2.55;
  const chromaSmooth = settings.chromaSmoothness * 2.55;

  for (let i = 0; i < totalPixels; i++) {
    const px = i % width;
    const py = Math.floor(i / width);

    // Outside ROI -> background
    if (settings.useRoi && (px < minRoiX || px > maxRoiX || py < minRoiY || py > maxRoiY)) {
      alphaArray[i] = 0;
      continue;
    }

    // Raw AI Confidence
    let rawVal = maskPixels[i * 4]; // Red channel represents segmentation confidence

    // Hybrid Chroma Key integration
    if (settings.hybridChromaEnabled && chromaRgb) {
      const r = srcPixels[i * 4];
      const g = srcPixels[i * 4 + 1];
      const b = srcPixels[i * 4 + 2];

      const diff = Math.sqrt(
        (r - chromaRgb.r) ** 2 +
        (g - chromaRgb.g) ** 2 +
        (b - chromaRgb.b) ** 2
      );

      if (diff < chromaTol) {
        rawVal = 0; // Pure chroma
      } else if (diff < chromaTol + chromaSmooth && chromaSmooth > 0) {
        const factor = (diff - chromaTol) / chromaSmooth;
        rawVal = Math.min(rawVal, Math.round(rawVal * factor));
      }
    }

    // Apply Threshold & Contrast curve
    if (rawVal < thresholdNormalized) {
      const tFactor = rawVal / Math.max(1, thresholdNormalized);
      rawVal = Math.round(Math.pow(tFactor, contrast * 2) * thresholdNormalized);
    } else {
      const tFactor = (rawVal - thresholdNormalized) / (255 - thresholdNormalized);
      rawVal = Math.round(thresholdNormalized + Math.pow(tFactor, 1 / contrast) * (255 - thresholdNormalized));
    }

    alphaArray[i] = rawVal;
  }

  // 5. Morphological Erosion (Removes excess outer edge fringe)
  if (settings.edgeErosion > 0) {
    alphaArray = erodeMask(alphaArray, width, height, settings.edgeErosion);
  }

  // 6. Feathering & Edge Smoothing (Silky hair & anti-aliasing)
  if (settings.edgeFeather > 0) {
    alphaArray = featherMask(alphaArray, width, height, settings.edgeFeather);
  }

  // 7. Temporal Smoothing (Eliminate frame-to-frame mask jitter)
  if (previousAlphaMask && settings.temporalSmoothing > 0 && previousAlphaMask.length === totalPixels) {
    const smoothFactor = settings.temporalSmoothing / 100;
    const keepFactor = 1 - smoothFactor;
    for (let i = 0; i < totalPixels; i++) {
      alphaArray[i] = Math.round(alphaArray[i] * keepFactor + previousAlphaMask[i] * smoothFactor);
    }
  }

  // 8. Composite to output image buffer
  const outImageData = ctx.createImageData(width, height);
  const outPixels = outImageData.data;

  for (let i = 0; i < totalPixels; i++) {
    const pIdx = i * 4;
    const a = alphaArray[i];

    let r = srcPixels[pIdx];
    let g = srcPixels[pIdx + 1];
    let b = srcPixels[pIdx + 2];

    // De-spill on edge pixels
    if (settings.despillEnabled && a > 0 && a < 250) {
      const despilled = applyDeSpill(r, g, b, settings.despillColor, settings.despillAmount);
      r = despilled.r;
      g = despilled.g;
      b = despilled.b;
    }

    outPixels[pIdx] = r;
    outPixels[pIdx + 1] = g;
    outPixels[pIdx + 2] = b;
    outPixels[pIdx + 3] = a;
  }

  ctx.putImageData(outImageData, 0, 0);

  return { alphaMask: alphaArray };
}

/**
 * Export Cutout Frames to SVGA File
 */
export async function exportToSvga(
  framesCanvasList: HTMLCanvasElement[],
  fps: number,
  width: number,
  height: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const protoStr = `
    syntax = "proto3";
    package com.opensource.svga;

    message MovieParams {
        float viewBoxWidth = 1;
        float viewBoxHeight = 2;
        int32 fps = 3;
        int32 frames = 4;
    }

    message Transform {
        float a = 1;
        float b = 2;
        float c = 3;
        float d = 4;
        float tx = 5;
        float ty = 6;
    }

    message Layout {
        float x = 1;
        float y = 2;
        float width = 3;
        float height = 4;
    }

    message SpriteEntity {
        string imageKey = 1;
        repeated FrameEntity frames = 2;
        string matteKey = 3;
    }

    message FrameEntity {
        float alpha = 1;
        Layout layout = 2;
        Transform transform = 3;
        string clipPath = 4;
    }

    message MovieEntity {
        string version = 1;
        MovieParams params = 2;
        map<string, bytes> images = 3;
        repeated SpriteEntity sprites = 4;
    }
  `;

  const root = parse(protoStr).root;
  const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');

  const imagesData: Record<string, Uint8Array> = {};
  const totalFrames = framesCanvasList.length;
  const sprites: any[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const c = framesCanvasList[i];
    const dataUrl = c.toDataURL('image/png', 0.85);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j);
    }

    const key = `img_${i}`;
    imagesData[key] = bytes;

    const frameList = [];
    for (let f = 0; f < totalFrames; f++) {
      frameList.push({
        alpha: f === i ? 1.0 : 0.0,
        layout: { x: 0, y: 0, width, height },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      });
    }

    sprites.push({
      imageKey: key,
      frames: frameList,
      matteKey: '',
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100));
    }
  }

  const payload = {
    version: '2.0',
    params: {
      viewBoxWidth: width,
      viewBoxHeight: height,
      fps: fps,
      frames: totalFrames,
    },
    images: imagesData,
    sprites: sprites,
  };

  const errMsg = MovieEntity.verify(payload);
  if (errMsg) throw new Error(`SVGA verification failed: ${errMsg}`);

  const message = MovieEntity.create(payload);
  const buffer = MovieEntity.encode(message).finish();
  const deflated = pako.deflate(buffer);

  return new Blob([deflated], { type: 'application/octet-stream' });
}

/**
 * Export to VAP (MP4 side-by-side or stacked RGB + Alpha)
 */
export async function exportToVap(
  framesCanvasList: HTMLCanvasElement[],
  fps: number,
  width: number,
  height: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const vapWidth = width * 2;
  const vapHeight = height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = vapWidth;
  tempCanvas.height = vapHeight;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot create canvas context for VAP');

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: vapWidth,
      height: vapHeight,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  });

  await encoder.configure({
    codec: 'avc1.4d002a',
    width: vapWidth,
    height: vapHeight,
    bitrate: 4_000_000,
    framerate: fps,
  });

  const totalFrames = framesCanvasList.length;

  for (let i = 0; i < totalFrames; i++) {
    const srcCanvas = framesCanvasList[i];
    const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) continue;

    const imgData = sCtx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    // 1. Create Alpha Mask in Left half (Grayscale representation of alpha channel)
    const alphaImgData = ctx.createImageData(width, height);
    const alphaPixels = alphaImgData.data;
    for (let p = 0; p < width * height; p++) {
      const a = pixels[p * 4 + 3];
      alphaPixels[p * 4] = a;
      alphaPixels[p * 4 + 1] = a;
      alphaPixels[p * 4 + 2] = a;
      alphaPixels[p * 4 + 3] = 255;
    }

    ctx.putImageData(alphaImgData, 0, 0);

    // 2. Draw RGB image in Right half
    ctx.drawImage(srcCanvas, width, 0, width, height);

    // Create VideoFrame and encode
    const frameBitmap = await createImageBitmap(tempCanvas);
    const timestampUs = Math.round((i / fps) * 1_000_000);
    const videoFrame = new VideoFrame(frameBitmap, {
      timestamp: timestampUs,
      duration: Math.round((1 / fps) * 1_000_000),
    });

    encoder.encode(videoFrame, { keyFrame: i % 30 === 0 });
    videoFrame.close();
    frameBitmap.close();

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100));
    }
  }

  await encoder.flush();
  muxer.finalize();

  const buffer = muxer.target.buffer;

  // Add VAP Configuration metadata box
  const vapConfigJson = JSON.stringify({
    info: {
      v: 2,
      f: fps,
      w: width,
      h: height,
      fps: fps,
      videoW: vapWidth,
      videoH: vapHeight,
      aFrame: [0, 0, width, height],
      rgbFrame: [width, 0, width, height],
      isVapx: 0,
    },
  });

  const vapcBox = createVapcBox(vapConfigJson);
  const finalBlob = new Blob([buffer, vapcBox], { type: 'video/mp4' });
  return finalBlob;
}

function createVapcBox(jsonString: string): Uint8Array {
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(jsonString);
  const boxLength = 8 + jsonBytes.length;

  const box = new Uint8Array(boxLength);
  const view = new DataView(box.buffer);

  view.setUint32(0, boxLength);
  box[4] = 'v'.charCodeAt(0);
  box[5] = 'a'.charCodeAt(0);
  box[6] = 'p'.charCodeAt(0);
  box[7] = 'c'.charCodeAt(0);

  box.set(jsonBytes, 8);
  return box;
}

/**
 * Export Cutout Frames to ZIP containing transparent PNGs
 */
export async function exportToPngZip(
  framesCanvasList: HTMLCanvasElement[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = framesCanvasList.length;

  for (let i = 0; i < total; i++) {
    const c = framesCanvasList[i];
    const dataUrl = c.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const padIndex = String(i + 1).padStart(4, '0');
    zip.file(`frame_${padIndex}.png`, base64, { base64: true });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Export Cutout to Chroma Green Screen MP4 (Pure #00FF00 background)
 */
export async function exportToGreenScreenMp4(
  framesCanvasList: HTMLCanvasElement[],
  fps: number,
  width: number,
  height: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) throw new Error('Context error');

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: width,
      height: height,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('Encoder error:', e),
  });

  await encoder.configure({
    codec: 'avc1.4d002a',
    width: width,
    height: height,
    bitrate: 5_000_000,
    framerate: fps,
  });

  const totalFrames = framesCanvasList.length;

  for (let i = 0; i < totalFrames; i++) {
    // Fill pure Chroma Green #00FF00
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, width, height);

    // Draw transparent cutout frame on top
    ctx.drawImage(framesCanvasList[i], 0, 0, width, height);

    const frameBitmap = await createImageBitmap(tempCanvas);
    const timestampUs = Math.round((i / fps) * 1_000_000);
    const videoFrame = new VideoFrame(frameBitmap, {
      timestamp: timestampUs,
      duration: Math.round((1 / fps) * 1_000_000),
    });

    encoder.encode(videoFrame, { keyFrame: i % 30 === 0 });
    videoFrame.close();
    frameBitmap.close();

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100));
    }
  }

  await encoder.flush();
  muxer.finalize();

  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
