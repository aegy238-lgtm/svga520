import * as pako from 'pako';
import { parse } from 'protobufjs';
import UPNG from 'upng-js';
import JSZip from 'jszip';
import { getSelfieSegmenter } from './aiVideoSegmentation';

export type ElementCategory = 'character' | 'cartoon' | 'gift' | 'object';

export interface BoundingBox {
  x: number; // pixels in video width
  y: number; // pixels in video height
  width: number;
  height: number;
}

export interface DetectedVideoElement {
  id: string;
  index: number;
  name: string;
  category: ElementCategory;
  categoryLabelAr: string;
  thumbnailDataUrl: string;
  bounds: BoundingBox;        // Base frame bounds
  motionBounds: BoundingBox;  // Union bounds across tracked frames
  frameBBoxes: Record<number, BoundingBox>; // Per-frame tracked bounding boxes
  areaPercent: number;
  frameCount: number;
  durationSec: number;
  estimatedSizeKb: number;
  visible: boolean;
  locked: boolean;
  overlapWarning?: boolean;
  overlapMessage?: string;
  customPadding: number; // Extra crop margin in pixels
  cropMode: 'tight' | 'scene'; // tight = crop to element bounds, scene = preserve full scene coordinates
  // Optional manual mask overrides (stored at analysis grid resolution: maskW x maskH)
  manualMask?: Uint8Array;
  maskWidth?: number;
  maskHeight?: number;
  savedMaskSnapshot?: Uint8Array;
  frameMasks?: Record<number, Uint8Array>;
}

export interface SmartChromaSettings {
  enabled: boolean;
  mode: 'auto' | 'manual';
  keyColor: string; // Hex e.g. '#00ff00'
  keyRgb: { r: number; g: number; b: number };
  tolerance: number;        // 0 - 100 (Color similarity)
  smoothness: number;       // 0 - 50  (Spread / softness)
  spillSuppression: number; // 0 - 100 (Green reflection removal)
  edgeFeather: number;      // 0 - 15 px
  edgeChoke: number;        // -10 to +10 px (shrink/expand matte)
  edgeOpacity: number;      // 10 - 100%
  shadowRemoval: number;    // 0 - 100% (remove dark green shadows)
  temporalStabilization: number; // 0 - 80% (prevent frame flicker)
  bgPreviewMode: 'checker' | 'dark' | 'black' | 'white' | 'custom';
  customBgColor: string;
}

export const DEFAULT_SMART_CHROMA_SETTINGS: SmartChromaSettings = {
  enabled: true,
  mode: 'auto',
  keyColor: '#00ff00',
  keyRgb: { r: 0, g: 255, b: 0 },
  tolerance: 34,
  smoothness: 14,
  spillSuppression: 75,
  edgeFeather: 2,
  edgeChoke: 1,
  edgeOpacity: 100,
  shadowRemoval: 25,
  temporalStabilization: 30,
  bgPreviewMode: 'checker',
  customBgColor: '#0f172a',
};

export interface SmartCompressionConfig {
  preset: 'light' | 'balanced' | 'strong' | 'custom';
  imageQuality: number;      // 10 - 100
  pngColors: number;         // 0 (lossless) or 32 - 256 (UPNG palette quantization with alpha)
  targetFps: number;         // 12, 15, 20, 24, 30, 60
  dimensionScale: number;    // 0.25 to 1.0
  deduplicateFrames: boolean;// Reuse identical sprite keys across static frames
  stripMetadata: boolean;
  similarityThreshold: number; // 0 to 15 (pixel diff threshold for frame deduplication)
}

export const DEFAULT_SMART_COMPRESSION: SmartCompressionConfig = {
  preset: 'balanced',
  imageQuality: 85,
  pngColors: 256,
  targetFps: 24,
  dimensionScale: 1.0,
  deduplicateFrames: true,
  stripMetadata: true,
  similarityThreshold: 3,
};

export interface SvgaVerificationReport {
  isValid: boolean;
  version: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  fps: number;
  frames: number;
  spriteCount: number;
  uniqueImageCount: number;
  compressedSizeBytes: number;
  uncompressedSizeBytes: number;
  savingsPercent: number;
  warnings: string[];
}

export interface ElementExportResult {
  elementId: string;
  elementName: string;
  fileName: string;
  blob: Blob;
  url: string;
  originalRawBytes: number;
  compressedBytes: number;
  savingsPercent: number;
  deduplicatedFramesCount: number;
  verification: SvgaVerificationReport;
}

/**
 * Convert Hex string to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Auto-detect dominant background color by sampling the outer border pixels of the video frame
 */
export function autoDetectBackgroundColor(imageData: ImageData): {
  hex: string;
  rgb: { r: number; g: number; b: number };
  recommendedTolerance: number;
  isGreenScreen: boolean;
} {
  const { data, width, height } = imageData;
  const buckets = new Map<string, { count: number; rSum: number; gSum: number; bSum: number }>();

  const samplePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Quantize to 16-level buckets to find dominant background cluster
    const key = `${r >> 4}_${g >> 4}_${b >> 4}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
    } else {
      buckets.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
    }
  };

  const stepX = Math.max(1, Math.floor(width / 40));
  const stepY = Math.max(1, Math.floor(height / 40));

  for (let x = 0; x < width; x += stepX) {
    samplePixel(x, 2);
    samplePixel(x, Math.max(0, height - 3));
  }
  for (let y = 0; y < height; y += stepY) {
    samplePixel(2, y);
    samplePixel(Math.max(0, width - 3), y);
  }

  let bestBucket = { count: 0, rSum: 0, gSum: 255, bSum: 0 };
  for (const b of buckets.values()) {
    if (b.count > bestBucket.count) {
      bestBucket = b;
    }
  }

  const r = Math.round(bestBucket.rSum / Math.max(1, bestBucket.count));
  const g = Math.round(bestBucket.gSum / Math.max(1, bestBucket.count));
  const b = Math.round(bestBucket.bSum / Math.max(1, bestBucket.count));
  const isGreenScreen = g > r + 35 && g > b + 35;

  return {
    hex: rgbToHex(r, g, b),
    rgb: { r, g, b },
    recommendedTolerance: isGreenScreen ? 36 : 26,
    isGreenScreen,
  };
}

/**
 * Apply Advanced Chroma Key, Spill Suppression, Shadow Removal & Edge Refinement to an ImageData buffer
 */
export function applySmartChromaKeyToFrame(
  imageData: ImageData,
  chroma: SmartChromaSettings,
  elementMask?: Uint8Array | null,
  maskWidth?: number,
  maskHeight?: number,
  prevAlphaBuffer?: Uint8ClampedArray | null
): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  const alphaOut = new Uint8ClampedArray(totalPixels);

  const kr = chroma.keyRgb.r;
  const kg = chroma.keyRgb.g;
  const kb = chroma.keyRgb.b;

  // Convert key color to YCbCr chrominance for lighting-invariant chroma keying
  const keyCb = 128 - 0.168736 * kr - 0.331264 * kg + 0.5 * kb;
  const keyCr = 128 + 0.5 * kr - 0.418688 * kg - 0.081312 * kb;

  const baseTol = (chroma.tolerance / 100) * 145;
  const spread = Math.max(2, (chroma.smoothness / 100) * 90);
  const shadowFactor = chroma.shadowRemoval / 100;
  const spillFactor = chroma.spillSuppression / 100;
  const edgeOpacityScale = chroma.edgeOpacity / 100;
  const isGreenDominantKey = kg > kr + 20 && kg > kb + 20;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    let r = data[idx];
    let g = data[idx + 1];
    let b = data[idx + 2];
    let a = data[idx + 3];

    if (chroma.enabled) {
      // YCbCr chrominance distance + weighted RGB distance
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const chromaDist = Math.hypot(cb - keyCb, cr - keyCr);

      const dr = r - kr;
      const dg = g - kg;
      const db = b - kb;
      const rgbDist = Math.sqrt(dr * dr * 0.25 + dg * dg * 0.5 + db * db * 0.25);

      // Combine chroma and RGB distance so dark green shadows are also caught when shadowRemoval > 0
      const effectiveDist = chromaDist * (0.65 + shadowFactor * 0.25) + rgbDist * (0.35 - shadowFactor * 0.15);

      let chromaAlpha = 255;
      if (effectiveDist < baseTol) {
        chromaAlpha = 0;
      } else if (effectiveDist < baseTol + spread) {
        const t = (effectiveDist - baseTol) / spread;
        // Smoothstep curve for natural anti-aliased edge
        const smoothT = t * t * (3 - 2 * t);
        chromaAlpha = Math.round(smoothT * 255);
      }

      a = Math.min(a, chromaAlpha);

      // Green Spill Suppression (removes green bounce light on hair/skin/edges)
      if (spillFactor > 0 && a > 0) {
        if (isGreenDominantKey) {
          const maxRB = Math.max(r, b);
          const avgRB = (r + b) * 0.5;
          if (g > avgRB) {
            const spillExcess = g - avgRB;
            // Suppress stronger on semi-transparent edge pixels
            const edgeWeight = a < 240 ? Math.min(1, spillFactor * 1.25) : spillFactor * 0.75;
            g = Math.round(g - spillExcess * edgeWeight);
            // Restore subtle luminance so desaturated edges don't turn dark gray
            const lumaBoost = Math.round(spillExcess * edgeWeight * 0.22);
            r = Math.min(255, r + lumaBoost);
            b = Math.min(255, b + lumaBoost);
          }
          // Extra halo cleanup on outer semi-transparent border
          if (a < 180 && g > maxRB) {
            g = maxRB;
          }
        } else {
          // Generic custom color spill suppression
          const colorMatch = Math.max(0, 1 - effectiveDist / (baseTol + spread * 1.5));
          if (colorMatch > 0) {
            const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            const desat = colorMatch * spillFactor;
            r = Math.round(r * (1 - desat) + luma * desat);
            g = Math.round(g * (1 - desat) + luma * desat);
            b = Math.round(b * (1 - desat) + luma * desat);
          }
        }
      }
    }

    // Apply per-element isolation mask if provided
    if (elementMask && maskWidth && maskHeight) {
      const py = Math.floor(i / width);
      const px = i - py * width;
      const mx = Math.min(maskWidth - 1, Math.floor((px * maskWidth) / width));
      const my = Math.min(maskHeight - 1, Math.floor((py * maskHeight) / height));
      const maskVal = elementMask[my * maskWidth + mx]; // 0 - 255
      a = Math.round((a * maskVal) / 255);
    }

    if (a < 255 && edgeOpacityScale !== 1) {
      a = Math.min(255, Math.round(a * edgeOpacityScale));
    }

    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    alphaOut[i] = a;
  }

  // Apply morphological Choke (Erosion / Dilation) on alphaOut if non-zero
  let processedAlpha = alphaOut;
  if (chroma.edgeChoke !== 0) {
    processedAlpha = applyAlphaChoke(processedAlpha, width, height, chroma.edgeChoke);
  }

  // Apply fast separable box-blur Feathering on alpha edges if edgeFeather > 0
  if (chroma.edgeFeather > 0) {
    processedAlpha = applyAlphaFeather(processedAlpha, width, height, Math.min(10, Math.round(chroma.edgeFeather)));
  }

  // Apply Temporal Stabilization with previous frame alpha to eliminate edge flickering
  if (prevAlphaBuffer && prevAlphaBuffer.length === totalPixels && chroma.temporalStabilization > 0) {
    const blend = Math.min(0.8, chroma.temporalStabilization / 100);
    for (let i = 0; i < totalPixels; i++) {
      const curr = processedAlpha[i];
      const prev = prevAlphaBuffer[i];
      // Only smooth subtle edge fluctuations; preserve fast large movements
      if (Math.abs(curr - prev) < 95) {
        processedAlpha[i] = Math.round(curr * (1 - blend) + prev * blend);
      }
    }
  }

  for (let i = 0; i < totalPixels; i++) {
    data[i * 4 + 3] = processedAlpha[i];
  }

  return processedAlpha;
}

function applyAlphaChoke(alpha: Uint8ClampedArray, w: number, h: number, amount: number): Uint8ClampedArray {
  const radius = Math.min(4, Math.abs(Math.round(amount)));
  if (radius === 0) return alpha;
  const isErode = amount > 0;
  const out = new Uint8ClampedArray(alpha.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = isErode ? 255 : 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const rowOffset = ny * w;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const val = alpha[rowOffset + nx];
          if (isErode) {
            if (val < best) best = val;
          } else {
            if (val > best) best = val;
          }
        }
      }
      out[y * w + x] = best;
    }
  }
  return out;
}

function applyAlphaFeather(alpha: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return alpha;
  const temp = new Uint8ClampedArray(alpha.length);
  const out = new Uint8ClampedArray(alpha.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) {
          sum += alpha[row + nx];
          count++;
        }
      }
      temp[row + x] = Math.round(sum / count);
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) {
          sum += temp[ny * w + x];
          count++;
        }
      }
      out[y * w + x] = Math.round(sum / count);
    }
  }

  return out;
}

/**
 * Multi-Object AI & Connected-Component Spatial Segmentation + Multi-Frame Tracker
 * Detects multiple distinct characters, gifts, cartoon figures, and moving elements
 * and tracks their trajectories across the video without swapping identities.
 */
export async function analyzeAndSegmentVideoElements(
  video: HTMLVideoElement,
  chroma: SmartChromaSettings,
  options: {
    trimStart: number;
    trimEnd: number;
    fps: number;
    minElementAreaPercent?: number;
    splitMultiRows?: boolean;
    useAiPersonModel?: boolean;
    onProgress?: (percent: number, message: string) => void;
  }
): Promise<DetectedVideoElement[]> {
  const {
    trimStart,
    trimEnd,
    fps,
    minElementAreaPercent = 0.35,
    splitMultiRows = true,
    useAiPersonModel = true,
    onProgress,
  } = options;

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const duration = Math.max(0.1, trimEnd - trimStart);
  const totalFrames = Math.max(1, Math.round(duration * fps));

  // Analysis grid resolution (fast & accurate for connected components)
  const gridW = 240;
  const gridH = Math.max(135, Math.round((vh / vw) * gridW));

  const workCanvas = document.createElement('canvas');
  workCanvas.width = gridW;
  workCanvas.height = gridH;
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true })!;

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = vw;
  fullCanvas.height = vh;
  const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true })!;

  onProgress?.(5, 'جاري تهيئة محرك الذكاء الاصطناعي وفاحص الطبقات...');

  let aiSegmenter: any = null;
  if (useAiPersonModel) {
    try {
      aiSegmenter = await getSelfieSegmenter(1);
    } catch {
      // Fallback to chroma + spatial saliency if offline
    }
  }

  // Sample frames across the video to build spatial occupancy & track individual trajectories
  const numSampleFrames = Math.min(24, Math.max(6, Math.ceil(duration * 4)));
  const sampleTimestamps: number[] = [];
  for (let i = 0; i < numSampleFrames; i++) {
    const t = trimStart + (i / Math.max(1, numSampleFrames - 1)) * Math.max(0, duration - 0.05);
    sampleTimestamps.push(t);
  }

  const originalTime = video.currentTime;
  const seekTo = (t: number) =>
    new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });

  // Tracked objects list across sample frames
  interface TrackedCluster {
    id: string;
    firstSeenSample: number;
    baseBox: BoundingBox; // in grid coords
    unionBox: BoundingBox; // in grid coords
    sampleBoxes: Record<number, BoundingBox>; // sampleIdx -> grid box
    accumulatedMask: Uint16Array; // gridW * gridH frequency map
    colorSignature: { r: number; g: number; b: number };
    overlapDetected: boolean;
    overlapWithIds: Set<string>;
    peakArea: number;
  }

  const trackedClusters: TrackedCluster[] = [];
  let firstFrameCanvasDataUrl = '';

  for (let sIdx = 0; sIdx < sampleTimestamps.length; sIdx++) {
    const t = sampleTimestamps[sIdx];
    const pct = Math.round(10 + ((sIdx + 1) / sampleTimestamps.length) * 65);
    onProgress?.(pct, `جاري تحليل وفصل العناصر في الإطار ${sIdx + 1} من ${sampleTimestamps.length}...`);

    await seekTo(t);
    workCtx.clearRect(0, 0, gridW, gridH);
    workCtx.drawImage(video, 0, 0, gridW, gridH);
    const frameData = workCtx.getImageData(0, 0, gridW, gridH);

    // If first frame and auto chroma is enabled, refine background color detection
    const activeChroma = { ...chroma };
    if (sIdx === 0 && chroma.mode === 'auto') {
      const autoBg = autoDetectBackgroundColor(frameData);
      activeChroma.keyColor = autoBg.hex;
      activeChroma.keyRgb = autoBg.rgb;
      activeChroma.tolerance = autoBg.recommendedTolerance;
    }

    // 1. Foreground mask from Chroma / Background difference
    const fgBinary = new Uint8Array(gridW * gridH);
    const alphaBuffer = applySmartChromaKeyToFrame(
      new ImageData(new Uint8ClampedArray(frameData.data), gridW, gridH),
      activeChroma
    );

    // Optional AI mask fusion if background is not green screen
    let aiMaskData: ImageData | null = null;
    if (aiSegmenter && !activeChroma.enabled) {
      try {
        aiMaskData = await new Promise<ImageData | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 800);
          aiSegmenter.onResults((res: any) => {
            clearTimeout(timer);
            if (res?.segmentationMask) {
              const c = document.createElement('canvas');
              c.width = gridW;
              c.height = gridH;
              const cx = c.getContext('2d')!;
              cx.drawImage(res.segmentationMask, 0, 0, gridW, gridH);
              resolve(cx.getImageData(0, 0, gridW, gridH));
            } else {
              resolve(null);
            }
          });
          aiSegmenter.send({ image: workCanvas }).catch(() => {
            clearTimeout(timer);
            resolve(null);
          });
        });
      } catch {
        aiMaskData = null;
      }
    }

    for (let i = 0; i < gridW * gridH; i++) {
      const a = aiMaskData ? Math.max(alphaBuffer[i], aiMaskData.data[i * 4]) : alphaBuffer[i];
      fgBinary[i] = a > 65 ? 1 : 0;
    }

    // 2. Morphological closing (dilate 1px then erode 1px) to connect small gaps inside a character
    const closedMask = morphologicalClose(fgBinary, gridW, gridH, 1);

    // 3. If splitMultiRows is active, detect deep valleys between side-by-side / multi-row characters
    const separatedMask = splitMultiRows
      ? splitTouchingClustersByProjectionValleys(closedMask, gridW, gridH)
      : closedMask;

    // 4. Connected-Component Labeling (8-connectivity Flood Fill)
    const rawComponents = extractConnectedComponents(
      separatedMask,
      frameData.data,
      gridW,
      gridH,
      minElementAreaPercent
    );

    // 5. Match rawComponents in current frame to existing trackedClusters (IoU + Centroid + Color matching)
    const matchedClusterIndices = new Set<number>();

    for (const comp of rawComponents) {
      let bestClusterIdx = -1;
      let bestScore = -1;

      const compCx = comp.box.x + comp.box.width / 2;
      const compCy = comp.box.y + comp.box.height / 2;

      for (let cIdx = 0; cIdx < trackedClusters.length; cIdx++) {
        const cluster = trackedClusters[cIdx];
        // Get most recent bounding box of this cluster
        const prevSampleKeys = Object.keys(cluster.sampleBoxes).map(Number);
        const lastKey = prevSampleKeys[prevSampleKeys.length - 1];
        const lastBox = cluster.sampleBoxes[lastKey] || cluster.baseBox;

        const lastCx = lastBox.x + lastBox.width / 2;
        const lastCy = lastBox.y + lastBox.height / 2;

        const iou = computeBoxIoU(comp.box, lastBox);
        const dist = Math.hypot(compCx - lastCx, compCy - lastCy);
        const maxAllowedDist = Math.max(gridW, gridH) * 0.22;

        if (dist > maxAllowedDist && iou === 0) continue;

        const distScore = Math.max(0, 1 - dist / maxAllowedDist);
        const colorDiff =
          (Math.abs(comp.color.r - cluster.colorSignature.r) +
            Math.abs(comp.color.g - cluster.colorSignature.g) +
            Math.abs(comp.color.b - cluster.colorSignature.b)) /
          (255 * 3);
        const colorScore = 1 - colorDiff;

        const totalScore = iou * 0.5 + distScore * 0.35 + colorScore * 0.15;
        if (totalScore > 0.28 && totalScore > bestScore) {
          bestScore = totalScore;
          bestClusterIdx = cIdx;
        }
      }

      if (bestClusterIdx !== -1) {
        const cluster = trackedClusters[bestClusterIdx];
        if (matchedClusterIndices.has(bestClusterIdx)) {
          // Two components matched the same cluster or merged blob
          cluster.overlapDetected = true;
        }
        matchedClusterIndices.add(bestClusterIdx);
        cluster.sampleBoxes[sIdx] = comp.box;
        cluster.unionBox = unionBoundingBoxes(cluster.unionBox, comp.box);
        cluster.peakArea = Math.max(cluster.peakArea, comp.pixelCount);
        for (const pIdx of comp.pixels) {
          cluster.accumulatedMask[pIdx]++;
        }
      } else {
        // Create new tracked cluster
        const newMask = new Uint16Array(gridW * gridH);
        for (const pIdx of comp.pixels) {
          newMask[pIdx] = 1;
        }
        trackedClusters.push({
          id: `elem_${trackedClusters.length + 1}_${Date.now().toString(36)}`,
          firstSeenSample: sIdx,
          baseBox: { ...comp.box },
          unionBox: { ...comp.box },
          sampleBoxes: { [sIdx]: { ...comp.box } },
          accumulatedMask: newMask,
          colorSignature: { ...comp.color },
          overlapDetected: false,
          overlapWithIds: new Set<string>(),
          peakArea: comp.pixelCount,
        });
      }
    }

    // Check pairwise overlap between active clusters in this sample frame
    for (let i = 0; i < trackedClusters.length; i++) {
      for (let j = i + 1; j < trackedClusters.length; j++) {
        const boxA = trackedClusters[i].sampleBoxes[sIdx];
        const boxB = trackedClusters[j].sampleBoxes[sIdx];
        if (boxA && boxB) {
          const iou = computeBoxIoU(boxA, boxB);
          if (iou > 0.18) {
            trackedClusters[i].overlapDetected = true;
            trackedClusters[j].overlapDetected = true;
            trackedClusters[i].overlapWithIds.add(trackedClusters[j].id);
            trackedClusters[j].overlapWithIds.add(trackedClusters[i].id);
          }
        }
      }
    }
  }

  // Filter out transient noise blobs that appeared in only 1 sample with tiny area
  const minSamplesRequired = sampleTimestamps.length > 4 ? 2 : 1;
  let validClusters = trackedClusters.filter(
    (c) =>
      Object.keys(c.sampleBoxes).length >= minSamplesRequired ||
      (c.peakArea / (gridW * gridH)) * 100 >= minElementAreaPercent * 2
  );

  // If no distinct clusters found (e.g. full-frame video), create 1 primary element covering the main subject
  if (validClusters.length === 0) {
    const fullMask = new Uint16Array(gridW * gridH);
    fullMask.fill(sampleTimestamps.length);
    validClusters = [
      {
        id: `elem_main_${Date.now().toString(36)}`,
        firstSeenSample: 0,
        baseBox: { x: Math.round(gridW * 0.05), y: Math.round(gridH * 0.05), width: Math.round(gridW * 0.9), height: Math.round(gridH * 0.9) },
        unionBox: { x: Math.round(gridW * 0.05), y: Math.round(gridH * 0.05), width: Math.round(gridW * 0.9), height: Math.round(gridH * 0.9) },
        sampleBoxes: { 0: { x: Math.round(gridW * 0.05), y: Math.round(gridH * 0.05), width: Math.round(gridW * 0.9), height: Math.round(gridH * 0.9) } },
        accumulatedMask: fullMask,
        colorSignature: { r: 200, g: 200, b: 200 },
        overlapDetected: false,
        overlapWithIds: new Set(),
        peakArea: gridW * gridH * 0.8,
      },
    ];
  }

  // Sort clusters naturally: top-to-bottom rows, then left-to-right (ideal for 2 rows of characters!)
  const rowHeightThreshold = gridH * 0.25;
  validClusters.sort((a, b) => {
    const rowDiff = a.unionBox.y - b.unionBox.y;
    if (Math.abs(rowDiff) > rowHeightThreshold) {
      return rowDiff;
    }
    return a.unionBox.x - b.unionBox.x;
  });

  onProgress?.(85, 'جاري توليد الصور المصغرة والأقنعة المستقلة لكل عنصر...');

  // Seek back to trimStart to render high-res isolated thumbnails for each detected element
  await seekTo(trimStart);
  fullCtx.clearRect(0, 0, vw, vh);
  fullCtx.drawImage(video, 0, 0, vw, vh);
  const firstFullFrame = fullCtx.getImageData(0, 0, vw, vh);
  if (chroma.mode === 'auto') {
    const autoBg = autoDetectBackgroundColor(firstFullFrame);
    chroma.keyColor = autoBg.hex;
    chroma.keyRgb = autoBg.rgb;
  }
  applySmartChromaKeyToFrame(firstFullFrame, chroma);
  fullCtx.putImageData(firstFullFrame, 0, 0);
  firstFrameCanvasDataUrl = fullCanvas.toDataURL('image/png');

  const scaleX = vw / gridW;
  const scaleY = vh / gridH;

  const results: DetectedVideoElement[] = validClusters.map((cluster, idx) => {
    const num = idx + 1;

    // Convert unionBox & baseBox from grid coordinates to actual video pixel coordinates
    const pixelUnionBox: BoundingBox = {
      x: Math.max(0, Math.floor(cluster.unionBox.x * scaleX)),
      y: Math.max(0, Math.floor(cluster.unionBox.y * scaleY)),
      width: Math.min(vw, Math.ceil(cluster.unionBox.width * scaleX)),
      height: Math.min(vh, Math.ceil(cluster.unionBox.height * scaleY)),
    };

    const pixelBaseBox: BoundingBox = {
      x: Math.max(0, Math.floor(cluster.baseBox.x * scaleX)),
      y: Math.max(0, Math.floor(cluster.baseBox.y * scaleY)),
      width: Math.min(vw, Math.ceil(cluster.baseBox.width * scaleX)),
      height: Math.min(vh, Math.ceil(cluster.baseBox.height * scaleY)),
    };

    // Interpolate per-frame bounding boxes for all frames 0..totalFrames-1
    const frameBBoxes: Record<number, BoundingBox> = {};
    for (let f = 0; f < totalFrames; f++) {
      const norm = f / Math.max(1, totalFrames - 1);
      const exactSample = norm * (sampleTimestamps.length - 1);
      const s0 = Math.floor(exactSample);
      const s1 = Math.min(sampleTimestamps.length - 1, s0 + 1);
      const tLerp = exactSample - s0;

      const b0 = cluster.sampleBoxes[s0] || cluster.unionBox;
      const b1 = cluster.sampleBoxes[s1] || b0;

      frameBBoxes[f] = {
        x: Math.round((b0.x + (b1.x - b0.x) * tLerp) * scaleX),
        y: Math.round((b0.y + (b1.y - b0.y) * tLerp) * scaleY),
        width: Math.round((b0.width + (b1.width - b0.width) * tLerp) * scaleX),
        height: Math.round((b0.height + (b1.height - b0.height) * tLerp) * scaleY),
      };
    }

    // Build clean binary spatial mask (gridW x gridH) for this element's motion region
    const manualMask = new Uint8Array(gridW * gridH);
    const padX = 3;
    const padY = 3;
    const minX = Math.max(0, cluster.unionBox.x - padX);
    const minY = Math.max(0, cluster.unionBox.y - padY);
    const maxX = Math.min(gridW - 1, cluster.unionBox.x + cluster.unionBox.width + padX);
    const maxY = Math.min(gridH - 1, cluster.unionBox.y + cluster.unionBox.height + padY);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const pIdx = y * gridW + x;
        if (cluster.accumulatedMask[pIdx] > 0) {
          manualMask[pIdx] = 255;
        } else {
          // Include immediate interior of the element's bounding region unless claimed by another cluster
          let claimedByOther = false;
          for (let otherIdx = 0; otherIdx < validClusters.length; otherIdx++) {
            if (otherIdx !== idx && validClusters[otherIdx].accumulatedMask[pIdx] > 0) {
              claimedByOther = true;
              break;
            }
          }
          if (!claimedByOther) {
            manualMask[pIdx] = 255;
          }
        }
      }
    }

    // Generate cropped thumbnail for this element
    const thumbCanvas = document.createElement('canvas');
    const thumbSize = 120;
    thumbCanvas.width = thumbSize;
    thumbCanvas.height = thumbSize;
    const tCtx = thumbCanvas.getContext('2d')!;
    const bw = Math.max(16, pixelUnionBox.width);
    const bh = Math.max(16, pixelUnionBox.height);
    const scale = Math.min((thumbSize - 12) / bw, (thumbSize - 12) / bh);
    const drawW = bw * scale;
    const drawH = bh * scale;
    tCtx.drawImage(
      fullCanvas,
      pixelUnionBox.x,
      pixelUnionBox.y,
      bw,
      bh,
      (thumbSize - drawW) / 2,
      (thumbSize - drawH) / 2,
      drawW,
      drawH
    );

    const aspect = bw / Math.max(1, bh);
    const areaPercent = Number(((cluster.peakArea / (gridW * gridH)) * 100).toFixed(1));
    let category: ElementCategory = 'character';
    let categoryLabelAr = 'شخصية / كائن متحرك';
    if (aspect > 0.45 && aspect < 1.35 && areaPercent > 2.5) {
      category = 'character';
      categoryLabelAr = 'شخصية / كرتون';
    } else if (areaPercent <= 2.5) {
      category = 'gift';
      categoryLabelAr = 'هدية / مؤثر بصري';
    } else {
      category = 'cartoon';
      categoryLabelAr = 'مجسم / عنصر مستقل';
    }

    const estBytesPerFrame = (bw * bh * 0.32) / 1024;
    const estimatedSizeKb = Math.max(18, Math.round(estBytesPerFrame * Math.min(totalFrames, 60) * 0.45));

    return {
      id: cluster.id,
      index: num,
      name: `عنصر #${num} (${category === 'character' ? 'شخصية' : category === 'gift' ? 'مؤثر' : 'مجسم'})`,
      category,
      categoryLabelAr,
      thumbnailDataUrl: thumbCanvas.toDataURL('image/png') || firstFrameCanvasDataUrl,
      bounds: pixelBaseBox,
      motionBounds: pixelUnionBox,
      frameBBoxes,
      areaPercent,
      frameCount: totalFrames,
      durationSec: Number(duration.toFixed(2)),
      estimatedSizeKb,
      visible: true,
      locked: false,
      overlapWarning: cluster.overlapDetected,
      overlapMessage: cluster.overlapDetected
        ? 'تم رصد تقارب أو تداخل جزئي مع عنصر مجاور في بعض الإطارات — يمكنك مراجعة القناع وتعديله يدوياً عند الحاجة.'
        : undefined,
      customPadding: 8,
      cropMode: 'tight',
      manualMask,
      maskWidth: gridW,
      maskHeight: gridH,
      savedMaskSnapshot: new Uint8Array(manualMask),
      frameMasks: {},
    };
  });

  await seekTo(originalTime);
  onProgress?.(100, `اكتمل التحليل الذكي! تم اكتشاف وفصل ${results.length} عنصر مستقل.`);
  return results;
}

function morphologicalClose(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const dilated = new Uint8Array(w * h);
  const eroded = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w && mask[ny * w + nx] > maxVal) {
            maxVal = 1;
          }
        }
      }
      dilated[y * w + x] = maxVal;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minVal = 1;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w && dilated[ny * w + nx] < minVal) {
            minVal = 0;
          }
        }
      }
      eroded[y * w + x] = minVal;
    }
  }

  return eroded;
}

/**
 * Splits touching or closely packed multi-row/multi-column characters by finding deep valleys in projection histograms
 */
function splitTouchingClustersByProjectionValleys(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(mask);

  // 1. Horizontal row projection to detect distinct horizontal rows of characters
  const rowCounts = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      sum += out[y * w + x];
    }
    rowCounts[y] = sum;
  }

  // Find low-density horizontal valleys between busy character rows
  for (let y = 10; y < h - 10; y++) {
    if (rowCounts[y] > 0 && rowCounts[y] <= w * 0.025) {
      const aboveMax = Math.max(...rowCounts.subarray(Math.max(0, y - 20), y));
      const belowMax = Math.max(...rowCounts.subarray(y + 1, Math.min(h, y + 21)));
      if (aboveMax > w * 0.12 && belowMax > w * 0.12) {
        for (let x = 0; x < w; x++) {
          out[y * w + x] = 0;
        }
      }
    }
  }

  // 2. Vertical column projection to separate slightly touching side-by-side characters
  const colCounts = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y < h; y++) {
      sum += out[y * w + x];
    }
    colCounts[x] = sum;
  }

  for (let x = 8; x < w - 8; x++) {
    if (colCounts[x] > 0 && colCounts[x] <= h * 0.03) {
      const leftMax = Math.max(...colCounts.subarray(Math.max(0, x - 16), x));
      const rightMax = Math.max(...colCounts.subarray(x + 1, Math.min(w, x + 17)));
      if (leftMax > h * 0.15 && rightMax > h * 0.15) {
        for (let y = 0; y < h; y++) {
          out[y * w + x] = 0;
        }
      }
    }
  }

  return out;
}

interface RawConnectedComponent {
  box: BoundingBox;
  pixelCount: number;
  pixels: number[];
  color: { r: number; g: number; b: number };
}

function extractConnectedComponents(
  binaryMask: Uint8Array,
  rgbaData: Uint8ClampedArray,
  w: number,
  h: number,
  minAreaPercent: number
): RawConnectedComponent[] {
  const visited = new Uint8Array(w * h);
  const minPixels = Math.max(14, Math.floor((w * h * minAreaPercent) / 100));
  const components: RawConnectedComponent[] = [];
  const queue = new Int32Array(w * h);

  for (let i = 0; i < w * h; i++) {
    if (binaryMask[i] === 0 || visited[i] === 1) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const pixels: number[] = [];

    while (head < tail) {
      const curr = queue[head++];
      pixels.push(curr);

      const cy = Math.floor(curr / w);
      const cx = curr - cy * w;

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      const rgbaIdx = curr * 4;
      rSum += rgbaData[rgbaIdx];
      gSum += rgbaData[rgbaIdx + 1];
      bSum += rgbaData[rgbaIdx + 2];

      // 8-neighbors
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= h) continue;
        const rowOffset = ny * w;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= w) continue;
          const nIdx = rowOffset + nx;
          if (binaryMask[nIdx] === 1 && visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
          }
        }
      }
    }

    if (pixels.length >= minPixels) {
      components.push({
        box: {
          x: minX,
          y: minY,
          width: Math.max(4, maxX - minX + 1),
          height: Math.max(4, maxY - minY + 1),
        },
        pixelCount: pixels.length,
        pixels,
        color: {
          r: Math.round(rSum / pixels.length),
          g: Math.round(gSum / pixels.length),
          b: Math.round(bSum / pixels.length),
        },
      });
    }
  }

  return components;
}

function computeBoxIoU(a: BoundingBox, b: BoundingBox): number {
  const xA = Math.max(a.x, b.x);
  const yA = Math.max(a.y, b.y);
  const xB = Math.min(a.x + a.width, b.x + b.width);
  const yB = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;
  if (interArea <= 0) return 0;

  const unionArea = a.width * a.height + b.width * b.height - interArea;
  return unionArea > 0 ? interArea / unionArea : 0;
}

function unionBoundingBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * SVGA 2.0 Protobuf Schema Definition
 */
const SVGA_PROTO_SCHEMA = `
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

let cachedMovieEntityType: any = null;
function getSvgaMovieEntityType() {
  if (!cachedMovieEntityType) {
    const root = parse(SVGA_PROTO_SCHEMA).root;
    cachedMovieEntityType = root.lookupType('com.opensource.svga.MovieEntity');
  }
  return cachedMovieEntityType;
}

/**
 * Compress an RGBA Canvas frame into an optimized PNG Uint8Array preserving full Alpha transparency
 */
function encodeCanvasToCompressedPngBytes(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  compression: SmartCompressionConfig
): Uint8Array {
  const w = canvas.width;
  const h = canvas.height;

  // Use UPNG palette quantization when pngColors > 0 and <= 256 for dramatic size reduction with full alpha
  if (compression.pngColors > 0 && compression.pngColors <= 256 && compression.preset !== 'light') {
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const cnum =
        compression.preset === 'strong'
          ? Math.min(128, compression.pngColors)
          : compression.pngColors;
      const pngArrayBuffer = UPNG.encode([imgData.data.buffer], w, h, cnum);
      return new Uint8Array(pngArrayBuffer);
    } catch {
      // Fallback to standard PNG encoding
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compute mean absolute difference between two RGBA buffers to detect duplicate static frames
 */
function computeFrameDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return 999;
  let diffSum = 0;
  const step = 16; // Sample every 4th pixel for speed
  let samples = 0;
  for (let i = 0; i < a.length; i += step) {
    diffSum +=
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]) +
      Math.abs(a[i + 3] - b[i + 3]);
    samples += 4;
  }
  return samples > 0 ? diffSum / samples : 0;
}

/**
 * Verify a generated SVGA 2.0 binary Blob by inflating and decoding its Protobuf MovieEntity
 */
export async function verifySvga2Binary(
  svgaBlob: Blob,
  uncompressedBytesEstimate: number
): Promise<SvgaVerificationReport> {
  const warnings: string[] = [];
  try {
    const arrayBuffer = await svgaBlob.arrayBuffer();
    const inflated = pako.inflate(new Uint8Array(arrayBuffer));
    const MovieEntity = getSvgaMovieEntityType();
    const decoded: any = MovieEntity.decode(inflated);

    const version = decoded.version || '2.0';
    const vw = decoded.params?.viewBoxWidth || 0;
    const vh = decoded.params?.viewBoxHeight || 0;
    const fps = decoded.params?.fps || 0;
    const frames = decoded.params?.frames || 0;
    const spriteCount = Array.isArray(decoded.sprites) ? decoded.sprites.length : 0;
    const uniqueImageCount = decoded.images ? Object.keys(decoded.images).length : 0;

    if (vw <= 0 || vh <= 0) warnings.push('أبعاد المشهد غير صالحة');
    if (frames <= 0) warnings.push('عدد الإطارات صفر');
    if (spriteCount <= 0) warnings.push('لا توجد طبقات Sprites داخل الملف');
    if (uniqueImageCount <= 0) warnings.push('لا توجد أصول صور مدمجة داخل الملف');

    const rawBase = Math.max(svgaBlob.size, uncompressedBytesEstimate);
    const savingsPercent =
      rawBase > svgaBlob.size
        ? Math.max(1, Math.round(((rawBase - svgaBlob.size) / rawBase) * 100))
        : 0;

    return {
      isValid: vw > 0 && vh > 0 && frames > 0 && spriteCount > 0 && uniqueImageCount > 0,
      version,
      viewBoxWidth: vw,
      viewBoxHeight: vh,
      fps,
      frames,
      spriteCount,
      uniqueImageCount,
      compressedSizeBytes: svgaBlob.size,
      uncompressedSizeBytes: rawBase,
      savingsPercent,
      warnings,
    };
  } catch (err: any) {
    return {
      isValid: false,
      version: 'unknown',
      viewBoxWidth: 0,
      viewBoxHeight: 0,
      fps: 0,
      frames: 0,
      spriteCount: 0,
      uniqueImageCount: 0,
      compressedSizeBytes: svgaBlob.size,
      uncompressedSizeBytes: uncompressedBytesEstimate,
      savingsPercent: 0,
      warnings: [`فشل التحقق من بنية SVGA 2.0: ${err?.message || 'خطأ غير معروف'}`],
    };
  }
}

/**
 * Export a single isolated element (or full scene) to a genuine SVGA 2.0 file
 * Preserves full frame-by-frame motion, alpha transparency, chroma despill, and coordinates.
 */
export async function exportIsolatedElementToSvga2(
  video: HTMLVideoElement,
  element: DetectedVideoElement,
  chroma: SmartChromaSettings,
  compression: SmartCompressionConfig,
  trimStart: number,
  trimEnd: number,
  onProgress?: (percent: number, phase: string) => void
): Promise<ElementExportResult> {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const duration = Math.max(0.1, trimEnd - trimStart);
  const fps = compression.targetFps || 24;
  const totalFrames = Math.max(1, Math.min(600, Math.round(duration * fps)));
  const scale = Math.max(0.25, Math.min(1.0, compression.dimensionScale || 1.0));

  // Compute padded crop bounds around the element's motion trajectory
  const pad = Math.max(0, element.customPadding || 0);
  const cropX = Math.max(0, element.motionBounds.x - pad);
  const cropY = Math.max(0, element.motionBounds.y - pad);
  const cropW = Math.min(vw - cropX, element.motionBounds.width + pad * 2);
  const cropH = Math.min(vh - cropY, element.motionBounds.height + pad * 2);

  const scaledCropW = Math.max(4, Math.round((cropW * scale) / 2) * 2);
  const scaledCropH = Math.max(4, Math.round((cropH * scale) / 2) * 2);

  // If cropMode === 'tight', viewBox is the tight cropped size.
  // If cropMode === 'scene', viewBox is the full scene size and Layout places the cropped sprite at (cropX, cropY)!
  const viewBoxWidth =
    element.cropMode === 'scene'
      ? Math.max(4, Math.round((vw * scale) / 2) * 2)
      : scaledCropW;
  const viewBoxHeight =
    element.cropMode === 'scene'
      ? Math.max(4, Math.round((vh * scale) / 2) * 2)
      : scaledCropH;

  const spriteLayoutX = element.cropMode === 'scene' ? Math.round(cropX * scale) : 0;
  const spriteLayoutY = element.cropMode === 'scene' ? Math.round(cropY * scale) : 0;

  // Offscreen canvases
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = vw;
  fullCanvas.height = vh;
  const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true })!;

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = scaledCropW;
  cropCanvas.height = scaledCropH;
  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;

  const imagesMap: Record<string, Uint8Array> = {};
  const frameToImageKey: string[] = [];

  let prevAlphaBuffer: Uint8ClampedArray | null = null;
  let prevCroppedRgba: Uint8ClampedArray | null = null;
  let lastUniqueImageKey = '';
  let deduplicatedCount = 0;
  let uncompressedBytesEstimate = 0;

  const originalTime = video.currentTime;
  const seekTo = (t: number) =>
    new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = t;
    });

  for (let f = 0; f < totalFrames; f++) {
    const t = trimStart + (f / Math.max(1, totalFrames)) * duration;
    const pct = Math.round(((f + 1) / totalFrames) * 82);
    onProgress?.(pct, `جاري معالجة وعزل الإطار ${f + 1}/${totalFrames} للعنصر (${element.name})...`);

    await seekTo(t);
    fullCtx.clearRect(0, 0, vw, vh);
    fullCtx.drawImage(video, 0, 0, vw, vh);
    const frameImgData = fullCtx.getImageData(0, 0, vw, vh);

    // Choose per-frame mask if edited on this frame, otherwise element's spatial mask
    const activeMask = element.frameMasks?.[f] || element.manualMask || null;

    prevAlphaBuffer = applySmartChromaKeyToFrame(
      frameImgData,
      chroma,
      activeMask,
      element.maskWidth,
      element.maskHeight,
      prevAlphaBuffer
    );

    fullCtx.putImageData(frameImgData, 0, 0);

    // Draw tightly cropped element region onto cropCanvas
    cropCtx.clearRect(0, 0, scaledCropW, scaledCropH);
    cropCtx.drawImage(
      fullCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      scaledCropW,
      scaledCropH
    );

    const croppedData = cropCtx.getImageData(0, 0, scaledCropW, scaledCropH).data;

    // Smart Frame Deduplication check
    if (
      compression.deduplicateFrames &&
      prevCroppedRgba &&
      lastUniqueImageKey &&
      computeFrameDifference(croppedData, prevCroppedRgba) <= compression.similarityThreshold
    ) {
      frameToImageKey.push(lastUniqueImageKey);
      deduplicatedCount++;
      continue;
    }

    prevCroppedRgba = new Uint8ClampedArray(croppedData);
    const imageKey = `img_${element.index}_f${f}`;
    lastUniqueImageKey = imageKey;

    // Estimate raw unquantized PNG size for accurate compression reporting
    const rawPngDataUrl = cropCanvas.toDataURL('image/png');
    uncompressedBytesEstimate += Math.round((rawPngDataUrl.length * 3) / 4);

    const compressedPngBytes = encodeCanvasToCompressedPngBytes(cropCanvas, cropCtx, compression);
    imagesMap[imageKey] = compressedPngBytes;
    frameToImageKey.push(imageKey);

    if (f % 6 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(88, 'جاري بناء حزمة SVGA 2.0 وضغط البيانات...');

  // Build SVGA 2.0 Sprites list (one SpriteEntity per unique imageKey, active on its corresponding frames)
  const uniqueKeys = Object.keys(imagesMap);
  const sprites = uniqueKeys.map((imgKey) => {
    const framesList = [];
    for (let f = 0; f < totalFrames; f++) {
      const isActive = frameToImageKey[f] === imgKey;
      framesList.push({
        alpha: isActive ? 1.0 : 0.0,
        layout: {
          x: spriteLayoutX,
          y: spriteLayoutY,
          width: scaledCropW,
          height: scaledCropH,
        },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      });
    }
    return {
      imageKey: imgKey,
      frames: framesList,
    };
  });

  const MovieEntity = getSvgaMovieEntityType();
  const payload = {
    version: '2.0',
    params: {
      viewBoxWidth,
      viewBoxHeight,
      fps,
      frames: totalFrames,
    },
    images: imagesMap,
    sprites,
  };

  const message = MovieEntity.create(payload);
  const pbBuffer = MovieEntity.encode(message).finish();
  const deflated = pako.deflate(pbBuffer, { level: 9 });
  const svgaBlob = new Blob([deflated], { type: 'application/octet-stream' });

  onProgress?.(95, 'جاري التحقق من سلامة ملف SVGA 2.0 الناتج...');
  const verification = await verifySvga2Binary(svgaBlob, uncompressedBytesEstimate);

  await seekTo(originalTime);
  onProgress?.(100, 'تم التصدير والتحقق بنجاح!');

  const safeName = element.name.replace(/[^\w\u0600-\u06FF_-]+/g, '_');
  const fileName = `${safeName}_${viewBoxWidth}x${viewBoxHeight}_${fps}fps.svga`;

  return {
    elementId: element.id,
    elementName: element.name,
    fileName,
    blob: svgaBlob,
    url: URL.createObjectURL(svgaBlob),
    originalRawBytes: verification.uncompressedSizeBytes,
    compressedBytes: svgaBlob.size,
    savingsPercent: verification.savingsPercent,
    deduplicatedFramesCount: deduplicatedCount,
    verification,
  };
}

/**
 * Package multiple exported SVGA elements + JSON report into a single downloadable ZIP archive
 */
export async function createBatchSvgaZipArchive(
  exportsList: ElementExportResult[],
  sourceVideoName: string
): Promise<{ zipBlob: Blob; zipUrl: string; zipFileName: string }> {
  const zip = new JSZip();
  const reportItems = [];

  for (const item of exportsList) {
    const arrBuf = await item.blob.arrayBuffer();
    zip.file(item.fileName, arrBuf);
    reportItems.push({
      elementId: item.elementId,
      elementName: item.elementName,
      fileName: item.fileName,
      svgaVersion: item.verification.version,
      dimensions: `${item.verification.viewBoxWidth}x${item.verification.viewBoxHeight}`,
      fps: item.verification.fps,
      frames: item.verification.frames,
      originalRawBytes: item.originalRawBytes,
      compressedBytes: item.compressedBytes,
      savingsPercent: `${item.savingsPercent}%`,
      deduplicatedFrames: item.deduplicatedFramesCount,
      verified: item.verification.isValid,
    });
  }

  const report = {
    studio: 'Smart MP4 Studio — AI + SVGA 2.0',
    sourceVideo: sourceVideoName,
    exportedAt: new Date().toISOString(),
    totalElementsExported: exportsList.length,
    elements: reportItems,
  };

  zip.file('export_report.json', JSON.stringify(report, null, 2));

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const baseName = sourceVideoName.replace(/\.[^.]+$/, '');
  const zipFileName = `${baseName}_Smart_SVGA_Elements_${exportsList.length}.zip`;

  return {
    zipBlob,
    zipUrl: URL.createObjectURL(zipBlob),
    zipFileName,
  };
}

/**
 * Built-in Procedural Test Video Generator for immediate verification of:
 * 1. 'multi_row': 6 animated cartoon/gift characters in 2 rows on a bright green screen (#00FF00)
 * 2. 'single_hero': 1 detailed character with glowing crown & hair strands on a green screen
 * 3. 'overlapping': 2 moving characters that cross paths to test overlap detection & manual mask correction
 */
export async function generateBuiltInTestMp4Video(
  preset: 'multi_row' | 'single_hero' | 'overlapping',
  onProgress?: (pct: number, msg: string) => void
): Promise<File> {
  const width = 960;
  const height = 540;
  const fps = 24;
  const durationSec = 2.5;
  const totalFrames = Math.round(fps * durationSec);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : 'video/mp4';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });

  recorder.start();

  const drawCartoonCharacter = (
    cx: number,
    cy: number,
    radius: number,
    bodyColor: string,
    accentColor: string,
    phase: number,
    label: string
  ) => {
    const bounceY = Math.sin(phase * Math.PI * 2) * 10;
    const waveAngle = Math.sin(phase * Math.PI * 4) * 0.35;

    ctx.save();
    ctx.translate(cx, cy + bounceY);

    // Character Cape / Aura
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(0, 14, radius * 0.85, radius * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Character Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Waving Arms
    ctx.save();
    ctx.rotate(waveAngle);
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(-radius * 1.05, -8, radius * 0.35, 16, 8);
    ctx.roundRect(radius * 0.7, -8, radius * 0.35, 16, 8);
    ctx.fill();
    ctx.restore();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-radius * 0.25, -radius * 0.12, radius * 0.11, 0, Math.PI * 2);
    ctx.arc(radius * 0.25, -radius * 0.12, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();

    // Eye Sparkles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.16, radius * 0.04, 0, Math.PI * 2);
    ctx.arc(radius * 0.22, -radius * 0.16, radius * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, radius * 0.05, radius * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Golden Crown on Top
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, -radius * 0.68);
    ctx.lineTo(-radius * 0.2, -radius * 0.98);
    ctx.lineTo(0, -radius * 0.75);
    ctx.lineTo(radius * 0.2, -radius * 0.98);
    ctx.lineTo(radius * 0.4, -radius * 0.68);
    ctx.closePath();
    ctx.fill();

    // Badge number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, radius * 0.52);

    ctx.restore();
  };

  for (let f = 0; f < totalFrames; f++) {
    const progress = f / totalFrames;
    onProgress?.(Math.round(progress * 100), `جاري توليد فيديو الاختبار (${f + 1}/${totalFrames})...`);

    // Pure Chroma Green Screen Background
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, width, height);

    if (preset === 'multi_row') {
      // 6 distinct characters arranged in 2 rows (3 top row, 3 bottom row)
      const configs = [
        { x: 200, y: 150, color: '#ef4444', accent: '#f97316', label: 'P1' },
        { x: 480, y: 150, color: '#3b82f6', accent: '#6366f1', label: 'P2' },
        { x: 760, y: 150, color: '#ec4899', accent: '#a855f7', label: 'P3' },
        { x: 200, y: 390, color: '#eab308', accent: '#f59e0b', label: 'P4' },
        { x: 480, y: 390, color: '#06b6d4', accent: '#0ea5e9', label: 'P5' },
        { x: 760, y: 390, color: '#8b5cf6', accent: '#d946ef', label: 'P6' },
      ];
      configs.forEach((c, idx) => {
        drawCartoonCharacter(c.x, c.y, 58, c.color, c.accent, progress + idx * 0.15, c.label);
      });
    } else if (preset === 'single_hero') {
      drawCartoonCharacter(width / 2, height / 2, 125, '#6366f1', '#ec4899', progress, 'HERO');
    } else {
      // Overlapping characters moving towards center
      const offset = Math.sin(progress * Math.PI) * 110;
      drawCartoonCharacter(340 + offset, 270, 78, '#ef4444', '#f97316', progress, 'A');
      drawCartoonCharacter(620 - offset, 270, 78, '#3b82f6', '#8b5cf6', progress + 0.25, 'B');
    }

    await new Promise((r) => setTimeout(r, 1000 / fps));
  }

  recorder.stop();
  const videoBlob = await stopPromise;
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  return new File([videoBlob], `smart_test_${preset}.${ext}`, { type: mimeType });
}
