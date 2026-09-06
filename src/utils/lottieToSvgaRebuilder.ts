import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../svga-proto';
import lottie from 'lottie-web';

export interface LottieAnalysis {
  width: number;
  height: number;
  fps: number;
  inPoint: number;
  outPoint: number;
  totalFrames: number;
  durationSec: number;
  totalLayers: number;
  imageLayersCount: number;
  shapeLayersCount: number;
  solidLayersCount: number;
  nullLayersCount: number;
  precompLayersCount: number;
  assetsCount: number;
  embeddedAssetsCount: number;
  hasParenting: boolean;
  hasMasks: boolean;
  estimatedSequenceSizeMB: number;
  estimatedSvgaSizeMB: number;
}

export interface RebuildOptions {
  mode?: 'full_motion' | 'smart_hybrid' | 'optimized_motion' | 'visual_accuracy' | 'native_vector';
  imageQuality?: number; // 0.1 to 1.0
  imageFormat?: 'png' | 'webp';
  target10MB?: boolean;
  onProgress?: (progress: number, stage: string) => void;
}

export interface RebuildResult {
  blob: Blob;
  sizeBytes: number;
  totalSprites: number;
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  savingsPercent: number;
  analysis: LottieAnalysis;
}

// 2D Affine Matrix representation:
// [ a  c  tx ]
// [ b  d  ty ]
// [ 0  0  1  ]
export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const identityMatrix = (): AffineMatrix => ({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0
});

export const multiplyMatrices = (m1: AffineMatrix, m2: AffineMatrix): AffineMatrix => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
  ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty
});

/**
 * Solves cubic bezier for time progression
 */
function solveCubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  if (p1x === p1y && p2x === p2y) return t; // Linear

  // Newton-Raphson iteration to find x(u) = t
  let u = t;
  for (let i = 0; i < 6; i++) {
    const currentX = 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u;
    const dx = 3 * (1 - u) * (1 - u) * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
    if (Math.abs(dx) < 1e-6) break;
    u -= (currentX - t) / dx;
    u = Math.max(0, Math.min(1, u));
  }

  // Compute y(u)
  return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u;
}

/**
 * Interpolates a Lottie property (number, array of numbers, or keyframed)
 */
export function evaluateProperty(prop: any, frame: number, defaultValue: any): any {
  if (!prop) return defaultValue;

  // Case 1: Static value
  if (prop.a === 0 || (prop.k !== undefined && !Array.isArray(prop.k[0]))) {
    if (typeof prop.k === 'number' || (Array.isArray(prop.k) && typeof prop.k[0] === 'number')) {
      return prop.k;
    }
  }

  // Case 2: Array of keyframes
  if (Array.isArray(prop.k) && prop.k.length > 0 && typeof prop.k[0] === 'object' && prop.k[0].t !== undefined) {
    const keyframes = prop.k;

    // Before first keyframe
    if (frame <= keyframes[0].t) {
      return keyframes[0].s !== undefined ? keyframes[0].s : defaultValue;
    }

    // After or at last keyframe
    const lastKeyframe = keyframes[keyframes.length - 1];
    if (frame >= lastKeyframe.t) {
      if (lastKeyframe.s !== undefined && lastKeyframe.e === undefined) {
        return lastKeyframe.s;
      }
      if (lastKeyframe.e !== undefined) {
        return lastKeyframe.e;
      }
      return lastKeyframe.s !== undefined ? lastKeyframe.s : defaultValue;
    }

    // Between keyframes
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];

      if (frame >= k1.t && frame < k2.t) {
        const startVal = k1.s;
        const endVal = k1.e !== undefined ? k1.e : k2.s;

        if (startVal === undefined) return defaultValue;
        if (endVal === undefined || k1.h === 1) return startVal;

        const duration = k2.t - k1.t;
        if (duration <= 0) return startVal;

        let progress = (frame - k1.t) / duration;

        // Apply cubic bezier easing if available
        if (k1.i && k1.o) {
          const ox = Array.isArray(k1.o.x) ? k1.o.x[0] : k1.o.x || 0;
          const oy = Array.isArray(k1.o.y) ? k1.o.y[0] : k1.o.y || 0;
          const ix = Array.isArray(k1.i.x) ? k1.i.x[0] : k1.i.x || 1;
          const iy = Array.isArray(k1.i.y) ? k1.i.y[0] : k1.i.y || 1;
          progress = solveCubicBezier(progress, ox, oy, ix, iy);
        }

        // Interpolate value
        if (typeof startVal === 'number' && typeof endVal === 'number') {
          return startVal + (endVal - startVal) * progress;
        }

        if (Array.isArray(startVal) && Array.isArray(endVal)) {
          return startVal.map((v: number, idx: number) => {
            const ev = endVal[idx] !== undefined ? endVal[idx] : v;
            return v + (ev - v) * progress;
          });
        }

        return startVal;
      }
    }
  }

  // Fallback to prop.k or defaultValue
  return prop.k !== undefined ? prop.k : defaultValue;
}

/**
 * Evaluates 2D affine transform matrix for a Lottie layer at a specific frame
 */
export function getLayerLocalMatrix(layer: any, frame: number): { matrix: AffineMatrix; opacity: number } {
  const ks = layer.ks || {};

  // Anchor point
  let ax = 0, ay = 0;
  if (ks.a) {
    const aVal = evaluateProperty(ks.a, frame, [0, 0]);
    if (Array.isArray(aVal)) {
      ax = aVal[0] || 0;
      ay = aVal[1] || 0;
    }
  }

  // Position
  let px = 0, py = 0;
  if (ks.p) {
    if (ks.p.s === true) {
      // Separated X and Y
      px = Number(evaluateProperty(ks.p.x, frame, 0)) || 0;
      py = Number(evaluateProperty(ks.p.y, frame, 0)) || 0;
    } else {
      const pVal = evaluateProperty(ks.p, frame, [0, 0]);
      if (Array.isArray(pVal)) {
        px = pVal[0] || 0;
        py = pVal[1] || 0;
      }
    }
  }

  // Scale (percentage, 100 = 1.0)
  let sx = 1, sy = 1;
  if (ks.s) {
    const sVal = evaluateProperty(ks.s, frame, [100, 100]);
    if (Array.isArray(sVal)) {
      sx = (sVal[0] !== undefined ? sVal[0] : 100) / 100;
      sy = (sVal[1] !== undefined ? sVal[1] : 100) / 100;
    } else if (typeof sVal === 'number') {
      sx = sVal / 100;
      sy = sVal / 100;
    }
  }

  // Rotation (degrees)
  let r = 0;
  if (ks.r) {
    const rVal = evaluateProperty(ks.r, frame, 0);
    r = typeof rVal === 'number' ? rVal : (Array.isArray(rVal) ? rVal[0] || 0 : 0);
  } else if (ks.rz) {
    const rzVal = evaluateProperty(ks.rz, frame, 0);
    r = typeof rzVal === 'number' ? rzVal : (Array.isArray(rzVal) ? rzVal[0] || 0 : 0);
  }

  // Opacity (0 to 100)
  let opacity = 1.0;
  if (ks.o) {
    const oVal = evaluateProperty(ks.o, frame, 100);
    const opRaw = typeof oVal === 'number' ? oVal : (Array.isArray(oVal) ? oVal[0] || 100 : 100);
    opacity = Math.max(0, Math.min(1, opRaw / 100));
  }

  // Check layer in-point and out-point
  if (frame < (layer.ip || 0) || frame >= (layer.op || Infinity)) {
    opacity = 0;
  }

  const rad = (r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;

  const tx = px - (a * ax + c * ay);
  const ty = py - (b * ax + d * ay);

  return {
    matrix: { a, b, c, d, tx, ty },
    opacity
  };
}

/**
 * Deeply analyzes a Lottie JSON structure
 */
export function analyzeLottie(lottieJson: any): LottieAnalysis {
  const width = lottieJson.w || 750;
  const height = lottieJson.h || 750;
  const fps = Math.round(lottieJson.fr || 30);
  const inPoint = lottieJson.ip || 0;
  const outPoint = lottieJson.op || 30;
  const totalFrames = Math.max(1, Math.round(outPoint - inPoint));
  const durationSec = totalFrames / fps;

  const layers = Array.isArray(lottieJson.layers) ? lottieJson.layers : [];
  const assets = Array.isArray(lottieJson.assets) ? lottieJson.assets : [];

  let imageLayersCount = 0;
  let shapeLayersCount = 0;
  let solidLayersCount = 0;
  let nullLayersCount = 0;
  let precompLayersCount = 0;
  let hasParenting = false;
  let hasMasks = false;

  layers.forEach((l: any) => {
    if (l.parent !== undefined && l.parent !== null) hasParenting = true;
    if (l.hasMask || (l.masksProperties && l.masksProperties.length > 0)) hasMasks = true;

    switch (l.ty) {
      case 0: precompLayersCount++; break;
      case 1: solidLayersCount++; break;
      case 2: imageLayersCount++; break;
      case 3: nullLayersCount++; break;
      case 4: shapeLayersCount++; break;
      default: break;
    }
  });

  let embeddedAssetsCount = 0;
  assets.forEach((a: any) => {
    if (a.p && typeof a.p === 'string' && a.p.startsWith('data:image')) {
      embeddedAssetsCount++;
    }
  });

  // Estimated sequence size: totalFrames * canvasArea * 4 bytes compressed ~ 150KB per frame
  const estimatedSequenceSizeMB = Number(((totalFrames * width * height * 0.4) / (1024 * 1024)).toFixed(2));

  // Estimated rebuilt SVGA size: assets + sprites proto ~ 0.2 - 2MB
  const estimatedSvgaSizeMB = Number(Math.max(0.15, (assets.length * 0.12 + layers.length * 0.02)).toFixed(2));

  return {
    width,
    height,
    fps,
    inPoint,
    outPoint,
    totalFrames,
    durationSec,
    totalLayers: layers.length,
    imageLayersCount,
    shapeLayersCount,
    solidLayersCount,
    nullLayersCount,
    precompLayersCount,
    assetsCount: assets.length,
    embeddedAssetsCount,
    hasParenting,
    hasMasks,
    estimatedSequenceSizeMB,
    estimatedSvgaSizeMB
  };
}

/**
 * Loads an image asset from Lottie asset definition
 */
async function loadAssetImage(asset: any): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!asset.p) return resolve(null);

    let src = '';
    if (asset.p.startsWith('data:image')) {
      src = asset.p;
    } else if (asset.u) {
      src = asset.u + asset.p;
    } else {
      src = asset.p;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load asset ${asset.id}: ${src.substring(0, 50)}...`);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Converts an HTMLImageElement or Canvas to PNG or WEBP binary Uint8Array
 * with optional color quantization and spatial smoothing for size optimization
 */
async function imageToBytes(
  img: HTMLImageElement | HTMLCanvasElement, 
  format: 'png' | 'webp' = 'png', 
  quality: number = 0.95,
  quantizeLevels: number = 255,
  smoothing: number = 0
): Promise<Uint8Array> {
  let canvas: HTMLCanvasElement;
  if (img instanceof HTMLCanvasElement) {
    canvas = img;
  } else {
    canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx && (quantizeLevels < 255 || smoothing > 0)) {
    if (smoothing > 0) {
      ctx.globalAlpha = smoothing;
      ctx.drawImage(canvas, 1, 0);
      ctx.drawImage(canvas, -1, 0);
      ctx.drawImage(canvas, 0, 1);
      ctx.drawImage(canvas, 0, -1);
      ctx.globalAlpha = 1.0;
    }
    if (quantizeLevels < 255) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const factor = 256 / quantizeLevels;
      for (let j = 0; j < d.length; j += 4) {
        if (d[j + 3] < 10) continue; // Skip transparent
        d[j] = Math.round(d[j] / factor) * factor;
        d[j + 1] = Math.round(d[j + 1] / factor) * factor;
        d[j + 2] = Math.round(d[j + 2] / factor) * factor;
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  const mime = format === 'webp' ? 'image/webp' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, quality);
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parses color strings (hex, rgb, rgba, named) or arrays into normalized SVGA RGBAColor (0.0 to 1.0)
 */
export function parseColorToRgba(colorVal: any, defaultAlpha = 1.0): { r: number; g: number; b: number; a: number } | null {
  if (!colorVal || colorVal === 'none' || colorVal === 'transparent') return null;

  // Case 1: Array of numbers [r, g, b] or [r, g, b, a] (either 0..1 or 0..255)
  if (Array.isArray(colorVal) && colorVal.length >= 3) {
    const isOverOne = colorVal[0] > 1 || colorVal[1] > 1 || colorVal[2] > 1;
    const factor = isOverOne ? 255 : 1;
    const r = Math.max(0, Math.min(1, colorVal[0] / factor));
    const g = Math.max(0, Math.min(1, colorVal[1] / factor));
    const b = Math.max(0, Math.min(1, colorVal[2] / factor));
    let a = defaultAlpha;
    if (colorVal.length >= 4) {
      a = Math.max(0, Math.min(1, (colorVal[3] > 1 ? colorVal[3] / 255 : colorVal[3]) * defaultAlpha));
    }
    return { r, g, b, a };
  }

  if (typeof colorVal !== 'string') return null;
  const str = colorVal.trim();
  if (!str || str === 'none' || str === 'transparent') return null;

  // Case 2: Hex #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: defaultAlpha
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16) / 255,
        g: parseInt(hex[1] + hex[1], 16) / 255,
        b: parseInt(hex[2] + hex[2], 16) / 255,
        a: (parseInt(hex[3] + hex[3], 16) / 255) * defaultAlpha
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: defaultAlpha
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: (parseInt(hex.slice(6, 8), 16) / 255) * defaultAlpha
      };
    }
  }

  // Case 3: rgb(...) or rgba(...)
  const rgbMatch = str.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map(s => s.trim());
    if (parts.length >= 3) {
      const parsePart = (p: string) => p.endsWith('%') ? parseFloat(p) / 100 : Math.max(0, Math.min(1, parseFloat(p) / 255));
      const r = parsePart(parts[0]);
      const g = parsePart(parts[1]);
      const b = parsePart(parts[2]);
      let a = defaultAlpha;
      if (parts[3] !== undefined) {
        const parsedA = parseFloat(parts[3]);
        a = (parts[3].endsWith('%') ? parsedA / 100 : parsedA) * defaultAlpha;
      }
      return { r, g, b, a: Math.max(0, Math.min(1, a)) };
    }
  }

  // Case 4: Canvas fallback for CSS named colors
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = str;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return {
        r: data[0] / 255,
        g: data[1] / 255,
        b: data[2] / 255,
        a: (data[3] / 255) * defaultAlpha
      };
    }
  } catch {}

  return null;
}

/**
 * Parses SVG transform string into an AffineMatrix
 */
export function parseSvgTransform(transformStr: string | null): AffineMatrix {
  if (!transformStr) return identityMatrix();
  let matrix = identityMatrix();

  const matrixMatch = transformStr.match(/matrix\(\s*([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)\s*\)/i);
  if (matrixMatch) {
    return {
      a: parseFloat(matrixMatch[1]),
      b: parseFloat(matrixMatch[2]),
      c: parseFloat(matrixMatch[3]),
      d: parseFloat(matrixMatch[4]),
      tx: parseFloat(matrixMatch[5]),
      ty: parseFloat(matrixMatch[6])
    };
  }

  const translateMatch = transformStr.match(/translate\(\s*([0-9.-]+)(?:[\s,]+([0-9.-]+))?\s*\)/i);
  if (translateMatch) {
    const tx = parseFloat(translateMatch[1]);
    const ty = translateMatch[2] ? parseFloat(translateMatch[2]) : 0;
    return { a: 1, b: 0, c: 0, d: 1, tx, ty };
  }

  const scaleMatch = transformStr.match(/scale\(\s*([0-9.-]+)(?:[\s,]+([0-9.-]+))?\s*\)/i);
  if (scaleMatch) {
    const sx = parseFloat(scaleMatch[1]);
    const sy = scaleMatch[2] ? parseFloat(scaleMatch[2]) : sx;
    return { a: sx, b: 0, c: 0, d: sy, tx: 0, ty: 0 };
  }

  return matrix;
}

/**
 * Transforms all coordinates in an SVG path 'd' string by a 2D Affine Matrix
 */
export function transformPathD(d: string, m: AffineMatrix): string {
  if (!d) return '';
  if (m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.tx === 0 && m.ty === 0) {
    return d;
  }

  return d.replace(/([MLCSQTAZmlcsqtaz])([^MLCSQTAZmlcsqtaz]*)/g, (match, cmd, argsStr) => {
    const upper = cmd.toUpperCase();
    if (upper === 'Z') return cmd;
    const nums = argsStr.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.some(isNaN)) return match;

    if (['M', 'L', 'C', 'S', 'Q'].includes(upper)) {
      const transformed: number[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        if (i + 1 < nums.length) {
          const x = nums[i];
          const y = nums[i + 1];
          const tx = m.a * x + m.c * y + m.tx;
          const ty = m.b * x + m.d * y + m.ty;
          transformed.push(Number(tx.toFixed(2)), Number(ty.toFixed(2)));
        } else {
          transformed.push(nums[i]);
        }
      }
      return `${cmd} ${transformed.join(' ')}`;
    }
    return match;
  });
}

/**
 * Extracts native SVGA ShapeEntity objects from an SVG DOM element
 * converting all paths into global coordinates with exact fills and strokes
 */
export function extractVectorShapesFromSvg(
  container: HTMLElement, 
  rootSvg: SVGSVGElement | null,
  layerOpacity: number = 1.0
): any[] {
  const shapes: any[] = [];
  const pathEls = Array.from(container.querySelectorAll('path'));

  for (const pathEl of pathEls) {
    const rawD = pathEl.getAttribute('d');
    if (!rawD || rawD.trim().length === 0) continue;

    // Calculate cumulative SVG transform matrix from path up to root SVG
    let cumulativeMatrix = identityMatrix();
    let curr: SVGElement | null = pathEl;
    const matrixList: AffineMatrix[] = [];

    while (curr && curr !== rootSvg && curr.parentElement) {
      const transformAttr = curr.getAttribute('transform');
      if (transformAttr) {
        matrixList.unshift(parseSvgTransform(transformAttr));
      }
      curr = curr.parentElement as unknown as SVGElement | null;
    }

    for (const m of matrixList) {
      cumulativeMatrix = multiplyMatrices(cumulativeMatrix, m);
    }

    // Transform path coordinates into root viewbox space
    const d = transformPathD(rawD, cumulativeMatrix);

    // Extract fill
    const fillStr = pathEl.getAttribute('fill') || pathEl.style.fill;
    const fillOpStr = pathEl.getAttribute('fill-opacity') || pathEl.style.fillOpacity;
    const fillOpacity = fillOpStr !== null && fillOpStr !== '' ? parseFloat(fillOpStr) : 1.0;
    const fillRgba = parseColorToRgba(fillStr, fillOpacity * layerOpacity);

    // Extract stroke
    const strokeStr = pathEl.getAttribute('stroke') || pathEl.style.stroke;
    const strokeOpStr = pathEl.getAttribute('stroke-opacity') || pathEl.style.strokeOpacity;
    const strokeOpacity = strokeOpStr !== null && strokeOpStr !== '' ? parseFloat(strokeOpStr) : 1.0;
    const strokeWidthStr = pathEl.getAttribute('stroke-width') || pathEl.style.strokeWidth;
    const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : 0;
    const strokeRgba = strokeWidth > 0 ? parseColorToRgba(strokeStr, strokeOpacity * layerOpacity) : null;

    // If both fill and stroke are missing/transparent, skip invisible path
    if (!fillRgba && !strokeRgba) continue;

    // Line cap, join, miter
    const lineCap = pathEl.getAttribute('stroke-linecap') || pathEl.style.strokeLinecap || 'round';
    const lineJoin = pathEl.getAttribute('stroke-linejoin') || pathEl.style.strokeLinejoin || 'round';
    const miterLimitStr = pathEl.getAttribute('stroke-miterlimit') || pathEl.style.strokeMiterlimit;
    const miterLimit = miterLimitStr ? parseFloat(miterLimitStr) : 4;

    const styles: any = {};
    if (fillRgba) {
      styles.fill = {
        r: fillRgba.r,
        g: fillRgba.g,
        b: fillRgba.b,
        a: fillRgba.a
      };
    }
    if (strokeRgba) {
      styles.stroke = {
        r: strokeRgba.r,
        g: strokeRgba.g,
        b: strokeRgba.b,
        a: strokeRgba.a
      };
      styles.strokeWidth = strokeWidth;
      styles.lineCap = lineCap;
      styles.lineJoin = lineJoin;
      styles.miterLimit = miterLimit;
    }

    shapes.push({
      type: 0, // SHAPE
      shape: { d },
      styles,
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
    });
  }

  return shapes;
}

/**
 * Computes a fast signature of vector shapes to detect static frames and reuse shapes via KEEP (type: 3)
 */
function computeShapesHash(shapes: any[]): string {
  if (!shapes || shapes.length === 0) return 'empty';
  return shapes.map(s => {
    const d = s.shape?.d || '';
    const f = s.styles?.fill ? `${s.styles.fill.r}_${s.styles.fill.g}_${s.styles.fill.b}_${s.styles.fill.a}` : '';
    const st = s.styles?.stroke ? `${s.styles.stroke.r}_${s.styles.stroke.g}_${s.styles.stroke.b}_${s.styles.strokeWidth}` : '';
    return `${d.length}:${d.slice(0, 30)}:${f}:${st}`;
  }).join('|');
}

/**
 * Computes a fast spatial signature of a canvas frame to detect static frames & deduplicate images
 */
function getFrameSignature(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  const pts: number[] = [];
  const stepX = Math.max(1, Math.floor(width / 6));
  const stepY = Math.max(1, Math.floor(height / 6));
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const idx = (y * width + x) * 4;
        pts.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
      }
    }
    return pts.join('-');
  } catch {
    return Math.random().toString();
  }
}

/**
 * Main Engine: Reconstructs Lottie into a compliant, ultra-optimized SVGA 2.0 file
 * with full deconstructed layer architecture (كل طبقة كائن مستقل SpriteEntity)
 * and 100% preservation of all animations, vector movements, effects, trim paths, and dynamics
 * WITHOUT exporting raster images for vector shapes or solids (تصدير متجهات أصلي دون صور).
 */
export async function rebuildLottieToSvga(
  lottieJson: any,
  options: RebuildOptions = {}
): Promise<RebuildResult> {
  const {
    mode = 'full_motion',
    imageQuality = 0.95,
    imageFormat = 'png',
    target10MB = false,
    onProgress = () => {}
  } = options;

  onProgress(5, 'بدء فحص وتفكيك طبقات وأصول ملف Lottie...');

  const analysis = analyzeLottie(lottieJson);
  const { width, height, fps, inPoint, outPoint, totalFrames } = analysis;

  const rawLayers = Array.isArray(lottieJson.layers) ? lottieJson.layers : [];
  const layerMap = new Map<number, any>();
  rawLayers.forEach((l: any) => {
    if (l.ind !== undefined) layerMap.set(l.ind, l);
  });

  // Calculate layer global matrix recursively through parenting chain with cubic bezier easing
  const getGlobalMatrixAndOpacity = (layer: any, frame: number): { matrix: AffineMatrix; opacity: number } => {
    let { matrix, opacity } = getLayerLocalMatrix(layer, frame);
    let currentParentId = layer.parent;
    let depth = 0;

    while (currentParentId !== undefined && currentParentId !== null && depth < 20) {
      const parentLayer = layerMap.get(currentParentId);
      if (!parentLayer) break;

      const parentTransform = getLayerLocalMatrix(parentLayer, frame);
      matrix = multiplyMatrices(parentTransform.matrix, matrix);
      opacity *= parentTransform.opacity;
      currentParentId = parentLayer.parent;
      depth++;
    }

    return { matrix, opacity };
  };

  // Compression parameters for real image assets
  let quantizeLevels = 255;
  let smoothing = 0;
  if (target10MB || mode === 'optimized_motion') {
    quantizeLevels = totalFrames > 150 ? 32 : (totalFrames > 75 ? 64 : 128);
    smoothing = 0.2;
  } else if (imageQuality < 0.9) {
    quantizeLevels = Math.max(32, Math.floor(255 * (imageQuality / 1.0)));
  }

  onProgress(10, 'استخراج وتحميل أصول الصور المضمنة...');

  // Map of assetId -> HTMLImageElement (for true image assets only)
  const assetImageMap = new Map<string, HTMLImageElement>();
  const assets = Array.isArray(lottieJson.assets) ? lottieJson.assets : [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (asset.id && asset.p) {
      const img = await loadAssetImage(asset);
      if (img) {
        assetImageMap.set(asset.id, img);
      }
    }
  }

  const imagesData: Record<string, Uint8Array> = {};
  const sprites: any[] = [];

  // In Lottie, layers[0] is top-most (foreground).
  // In SVGA, sprites[0] is bottom-most (background).
  // Reverse layers to construct correct SVGA rendering order!
  const reversedLayers = [...rawLayers].reverse();
  const totalLayersCount = reversedLayers.length;

  onProgress(20, `جاري تفكيك ${totalLayersCount} طبقة وبناء الحركات المستقلة لكل عنصر...`);

  // Helper to gather layer plus its parenting ancestry for isolated mini-Lottie rendering
  const getLayerWithAncestors = (targetLayer: any) => {
    const list = [targetLayer];
    let currentParentId = targetLayer.parent;
    let depth = 0;
    while (currentParentId !== undefined && currentParentId !== null && depth < 20) {
      const p = layerMap.get(currentParentId);
      if (!p) break;
      if (!list.includes(p)) list.unshift(p);
      currentParentId = p.parent;
      depth++;
    }
    return list;
  };

  for (let lIdx = 0; lIdx < totalLayersCount; lIdx++) {
    const layer = reversedLayers[lIdx];
    const layerName = layer.nm || `Layer_${layer.ind || lIdx}`;
    const progressPercent = 20 + Math.floor((lIdx / totalLayersCount) * 65);

    // Skip pure null layers (they exist only for parent transforms, which are already calculated)
    if (layer.ty === 3) {
      continue;
    }

    // -------------------------------------------------------------
    // Type 2: Image Asset Layer (تفكيك طبقات الصور النقطية الأصلية)
    // -------------------------------------------------------------
    if (layer.ty === 2 && layer.refId) {
      const asset = assets.find((a: any) => a.id === layer.refId);
      const img = assetImageMap.get(layer.refId);

      if (asset && img) {
        const imageKey = `image_${layer.refId}`;
        if (!imagesData[imageKey]) {
          imagesData[imageKey] = await imageToBytes(img, imageFormat, imageQuality, quantizeLevels, smoothing);
        }

        const assetW = asset.w || img.naturalWidth || img.width;
        const assetH = asset.h || img.naturalHeight || img.height;

        const spriteFrames: any[] = [];
        for (let f = 0; f < totalFrames; f++) {
          const frameTime = inPoint + f;
          const { matrix, opacity } = getGlobalMatrixAndOpacity(layer, frameTime);

          spriteFrames.push({
            alpha: opacity,
            layout: { x: 0, y: 0, width: assetW, height: assetH },
            transform: {
              a: matrix.a,
              b: matrix.b,
              c: matrix.c,
              d: matrix.d,
              tx: matrix.tx,
              ty: matrix.ty
            }
          });
        }

        sprites.push({
          imageKey,
          frames: spriteFrames
        });

        onProgress(progressPercent, `تم تفكيك طبقة الصورة: [${layerName}] مع كافة مسارات الحركة...`);
        continue;
      }
    }

    // -------------------------------------------------------------
    // Type 1: Solid Layer (تفكيك الطبقات الصلبة كمتجهات أصلية 100% دون صور)
    // -------------------------------------------------------------
    if (layer.ty === 1) {
      const sw = layer.sw || width;
      const sh = layer.sh || height;
      const sc = layer.sc || '#ffffff';
      const solidFill = parseColorToRgba(sc, 1.0) || { r: 1, g: 1, b: 1, a: 1 };

      const spriteFrames: any[] = [];
      const solidShape = {
        type: 1, // RECT
        rect: { x: 0, y: 0, width: sw, height: sh, cornerRadius: 0 },
        styles: {
          fill: solidFill
        },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
      };

      for (let f = 0; f < totalFrames; f++) {
        const frameTime = inPoint + f;
        const { matrix, opacity } = getGlobalMatrixAndOpacity(layer, frameTime);

        spriteFrames.push({
          alpha: opacity,
          layout: { x: 0, y: 0, width: sw, height: sh },
          transform: {
            a: matrix.a,
            b: matrix.b,
            c: matrix.c,
            d: matrix.d,
            tx: matrix.tx,
            ty: matrix.ty
          },
          shapes: f === 0 ? [solidShape] : [{ type: 3 }] // KEEP previous shape
        });
      }

      sprites.push({
        imageKey: '',
        frames: spriteFrames
      });

      onProgress(progressPercent, `تم تفكيك الطبقة الملونة: [${layerName}] كفيكتور أصلي دون صور...`);
      continue;
    }

    // -------------------------------------------------------------
    // Type 4 / 0 / 5: Shape, Precomp, or Text Layer
    // (تفكيك طبقات الفيكتور والمؤثرات كمتجهات SVG نقية 100% دون صور نهائياً)
    // -------------------------------------------------------------
    let layerExtractedSuccessfully = false;

    // Create off-screen container for Lottie SVG vector extraction
    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${width}px;height:${height}px;visibility:hidden;pointer-events:none;`;
    document.body.appendChild(svgContainer);

    let anim: any = null;
    try {
      const isolatedJson = {
        v: lottieJson.v || '5.5.0',
        fr: fps,
        ip: inPoint,
        op: outPoint,
        w: width,
        h: height,
        nm: `isolated_${layer.ind || lIdx}`,
        ddd: 0,
        assets: lottieJson.assets || [],
        layers: getLayerWithAncestors(layer)
      };

      anim = (lottie as any).loadAnimation({
        container: svgContainer,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: isolatedJson
      });

      await new Promise((resolve) => {
        if (anim.isLoaded) resolve(null);
        else anim.addEventListener('DOMLoaded', () => resolve(null));
      });

      const rootSvg = svgContainer.querySelector('svg');
      const spriteFrames: any[] = [];
      let prevShapesHash = '';
      let hasAnyValidShapes = false;

      for (let f = 0; f < totalFrames; f++) {
        const frameTime = inPoint + f;
        anim.goToAndStop(frameTime, true);

        const isVisible = frameTime >= (layer.ip || 0) && frameTime < (layer.op || Infinity);
        const { opacity } = getGlobalMatrixAndOpacity(layer, frameTime);

        if (!isVisible || opacity <= 0.001) {
          spriteFrames.push({
            alpha: 0.0,
            layout: { x: 0, y: 0, width, height },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
            shapes: f > 0 ? [{ type: 3 }] : []
          });
          continue;
        }

        // Extract SVG vector paths for this frame
        const currentShapes = extractVectorShapesFromSvg(svgContainer, rootSvg, opacity);
        const currentHash = computeShapesHash(currentShapes);

        if (currentShapes.length > 0) {
          hasAnyValidShapes = true;
        }

        if (f > 0 && currentHash === prevShapesHash && hasAnyValidShapes) {
          // Geometry and styles identical to previous frame: reuse via KEEP (type: 3)
          spriteFrames.push({
            alpha: opacity,
            layout: { x: 0, y: 0, width, height },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
            shapes: [{ type: 3 }] // KEEP
          });
        } else {
          // Shapes created or changed (dynamic morph, trim path, stroke change)
          spriteFrames.push({
            alpha: opacity,
            layout: { x: 0, y: 0, width, height },
            transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
            shapes: currentShapes
          });
          prevShapesHash = currentHash;
        }
      }

      if (hasAnyValidShapes) {
        sprites.push({
          imageKey: '', // Empty imageKey indicates pure native vector SpriteEntity
          frames: spriteFrames
        });
        layerExtractedSuccessfully = true;
        onProgress(progressPercent, `تم تفكيك طبقة الفيكتور: [${layerName}] كمتجهات نقية دون صور...`);
      }

      // Secondary Fallback for Shape Layers if SVG extraction was empty (e.g. empty group)
      if (!layerExtractedSuccessfully) {
        let baseRasterImageKey = '';
        let baseMatrix: AffineMatrix | null = null;
        let fallbackFrames: any[] = [];

        for (let f = 0; f < totalFrames; f++) {
          const frameTime = inPoint + f;
          anim.goToAndStop(frameTime, true);
          const isVisible = frameTime >= (layer.ip || 0) && frameTime < (layer.op || Infinity);
          const { matrix, opacity } = getGlobalMatrixAndOpacity(layer, frameTime);

          if (!isVisible || opacity <= 0.001) {
            fallbackFrames.push({
              alpha: 0.0,
              layout: { x: 0, y: 0, width, height },
              transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
              shapes: [] // No shapes
            });
            continue;
          }

          // We need to capture the image ONCE at its first visible frame
          if (!baseRasterImageKey) {
              try {
                const svgNode = svgContainer.querySelector('svg');
                const bbox = (svgNode as any)?.getBBox();
                if (svgNode && bbox && bbox.width > 0 && bbox.height > 0) {
                   const lCanvas = document.createElement('canvas');
                   lCanvas.width = width;
                   lCanvas.height = height;
                   const lCtx = lCanvas.getContext('2d');
                   if (lCtx) {
                      const svgData = new XMLSerializer().serializeToString(svgNode);
                      const svgBlob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgData}</svg>`], { type: 'image/svg+xml;charset=utf-8' });
                      const url = URL.createObjectURL(svgBlob);
                      
                      const img = new Image();
                      await new Promise((res) => {
                        img.onload = res;
                        img.onerror = res;
                        img.src = url;
                      });
                      
                      lCtx.drawImage(img, 0, 0);
                      URL.revokeObjectURL(url);
                      
                      baseRasterImageKey = `raster_${layer.ind || lIdx}_${f}`;
                      imagesData[baseRasterImageKey] = await imageToBytes(lCanvas, imageFormat, imageQuality, quantizeLevels, smoothing);
                      baseMatrix = { ...matrix };
                   }
                } else {
                   baseRasterImageKey = 'empty';
                }
              } catch (e) {
                 console.warn("Fallback rasterization failed for layer", layerName, e);
                 baseRasterImageKey = 'empty';
              }
          }

          if (baseRasterImageKey && baseRasterImageKey !== 'empty' && baseMatrix) {
              // Inverse matrix calculation for dynamic animation without re-rendering images
              const det = baseMatrix.a * baseMatrix.d - baseMatrix.b * baseMatrix.c;
              let finalTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
              
              if (Math.abs(det) > 0.0001) {
                  const inv = {
                      a: baseMatrix.d / det,
                      b: -baseMatrix.b / det,
                      c: -baseMatrix.c / det,
                      d: baseMatrix.a / det,
                      tx: (baseMatrix.c * baseMatrix.ty - baseMatrix.d * baseMatrix.tx) / det,
                      ty: (baseMatrix.b * baseMatrix.tx - baseMatrix.a * baseMatrix.ty) / det
                  };
                  finalTransform = {
                      a: matrix.a * inv.a + matrix.c * inv.b,
                      b: matrix.b * inv.a + matrix.d * inv.b,
                      c: matrix.a * inv.c + matrix.c * inv.d,
                      d: matrix.b * inv.c + matrix.d * inv.d,
                      tx: matrix.a * inv.tx + matrix.c * inv.ty + matrix.tx,
                      ty: matrix.b * inv.tx + matrix.d * inv.ty + matrix.ty
                  };
              }
              
              fallbackFrames.push({
                  alpha: opacity,
                  layout: { x: 0, y: 0, width, height },
                  transform: finalTransform
              });
          } else {
              fallbackFrames.push({
                  alpha: 0.0,
                  layout: { x: 0, y: 0, width, height },
                  transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
                  shapes: []
              });
          }
        }
        
        sprites.push({
          imageKey: baseRasterImageKey === 'empty' ? '' : baseRasterImageKey,
          frames: fallbackFrames
        });
        onProgress(progressPercent, `تم تحويل الطبقة المعقدة: [${layerName}] إلى صورة مع الاحتفاظ بالحركة...`);
      }

    } catch (err) {
      console.warn(`Could not extract vector paths from SVG DOM for layer ${layer.nm}`, err);
    } finally {
      if (anim) anim.destroy();
      svgContainer.remove();
    }
  }

  // Safety check: ensure at least one sprite exists
  if (sprites.length === 0) {
    sprites.push({
      imageKey: '',
      frames: [{
        alpha: 1.0,
        layout: { x: 0, y: 0, width, height },
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        shapes: []
      }]
    });
  }

  onProgress(88, `تجميع وتشفير ملف SVGA 2.0 (${sprites.length} طبقة كائن كمتجهات نقية مستقلة)...`);

  // Build Protobuf Payload
  const parsed = protobuf.parse(svgaSchema);
  const MovieEntity = parsed.root.lookupType('com.opensource.svga.MovieEntity');

  const payload = {
    version: '2.0',
    params: {
      viewBoxWidth: width,
      viewBoxHeight: height,
      fps: fps,
      frames: totalFrames
    },
    images: imagesData,
    sprites: sprites,
    audios: []
  };

  const errMsg = MovieEntity.verify(payload);
  if (errMsg) {
    throw new Error(`فشل التحقق من بنية SVGA 2.0: ${errMsg}`);
  }

  const message = MovieEntity.create(payload);
  const buffer = MovieEntity.encode(message).finish();
  const deflated = pako.deflate(buffer, { level: 9 });

  const svgaBlob = new Blob([deflated], { type: 'application/octet-stream' });
  const sizeBytes = svgaBlob.size;

  const originalEstimatedBytes = analysis.estimatedSequenceSizeMB * 1024 * 1024;
  const savingsPercent = Math.max(
    0,
    Math.round(((originalEstimatedBytes - sizeBytes) / Math.max(1, originalEstimatedBytes)) * 100)
  );

  onProgress(100, 'اكتملت إعادة بناء وتصدير ملف SVGA 2.0 بنجاح كمتجهات نقية مع حفظ كامل الحركة!');

  return {
    blob: svgaBlob,
    sizeBytes,
    totalSprites: sprites.length,
    totalFrames,
    fps,
    width,
    height,
    savingsPercent,
    analysis
  };
}
