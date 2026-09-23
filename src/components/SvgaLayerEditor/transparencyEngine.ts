export interface FadeConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type CropShape = 
  | 'rect' 
  | 'square' 
  | 'circle' 
  | 'ellipse' 
  | 'rounded-rect' 
  | 'capsule' 
  | 'diamond';

export interface CropConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
  shape?: CropShape;
  cornerRadius?: number;
}

export interface CropFeather {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const DEFAULT_FADE_CONFIG: FadeConfig = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
};

export const DEFAULT_CROP_CONFIG: CropConfig = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  shape: 'rect',
  cornerRadius: 25
};

export const DEFAULT_CROP_FEATHER: CropFeather = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0
};

export function isTransparencyActive(fade?: FadeConfig, crop?: CropConfig): boolean {
  if (fade && (fade.top > 0 || fade.bottom > 0 || fade.left > 0 || fade.right > 0)) {
    return true;
  }
  if (crop && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0 || (crop.shape && crop.shape !== 'rect'))) {
    return true;
  }
  return false;
}

/**
 * Returns dynamic CSS properties for real-time visual edge fade, shape crop, and feather
 * allowing MP4 videos and SVGA canvas elements to reflect transparency changes in 60fps immediately.
 */
export function getCombinedCssMaskStyle(
  fadeConfig?: FadeConfig,
  cropConfig?: CropConfig,
  cropFeather?: CropFeather
): React.CSSProperties {
  const f = fadeConfig || DEFAULT_FADE_CONFIG;
  const c = cropConfig || DEFAULT_CROP_CONFIG;
  const feather = cropFeather || DEFAULT_CROP_FEATHER;

  const hasFade = (f.top > 0 || f.bottom > 0 || f.left > 0 || f.right > 0);
  const hasCrop = (c.top > 0 || c.bottom > 0 || c.left > 0 || c.right > 0 || (c.shape && c.shape !== 'rect'));
  const hasFeather = (feather.top > 0 || feather.bottom > 0 || feather.left > 0 || feather.right > 0);

  if (!hasFade && !hasCrop && !hasFeather) {
    return {};
  }

  const shape = c.shape || 'rect';
  const cornerRadius = c.cornerRadius ?? 25;

  // 1. Build Vertical Gradient
  const topFadeEnd = Math.min(100, Math.max(c.top, c.top + f.top + feather.top));
  const bottomFadeStart = Math.max(0, Math.min(100 - c.bottom, 100 - (c.bottom + f.bottom + feather.bottom)));
  const vGrad = `linear-gradient(to bottom, transparent 0%, transparent ${c.top}%, black ${topFadeEnd}%, black ${bottomFadeStart}%, transparent ${100 - c.bottom}%, transparent 100%)`;

  // 2. Build Horizontal Gradient
  const leftFadeEnd = Math.min(100, Math.max(c.left, c.left + f.left + feather.left));
  const rightFadeStart = Math.max(0, Math.min(100 - c.right, 100 - (c.right + f.right + feather.right)));
  const hGrad = `linear-gradient(to right, transparent 0%, transparent ${c.left}%, black ${leftFadeEnd}%, black ${rightFadeStart}%, transparent ${100 - c.right}%, transparent 100%)`;

  let maskImage = `${vGrad}, ${hGrad}`;
  let clipPath: string | undefined = undefined;
  let borderRadius: string | undefined = undefined;

  if (shape === 'circle') {
    clipPath = 'circle(50% at 50% 50%)';
  } else if (shape === 'ellipse') {
    const rx = Math.max(5, 50 - Math.max(c.left, c.right));
    const ry = Math.max(5, 50 - Math.max(c.top, c.bottom));
    clipPath = `ellipse(${rx}% ${ry}% at 50% 50%)`;
  } else if (shape === 'capsule') {
    borderRadius = '9999px';
    if (!hasFade && !hasFeather) {
      clipPath = `inset(${c.top}% ${c.right}% ${c.bottom}% ${c.left}% round 9999px)`;
    }
  } else if (shape === 'rounded-rect' || (shape === 'rect' && cornerRadius > 0)) {
    borderRadius = `${cornerRadius}px`;
    if (!hasFade && !hasFeather && (c.top > 0 || c.bottom > 0 || c.left > 0 || c.right > 0)) {
      clipPath = `inset(${c.top}% ${c.right}% ${c.bottom}% ${c.left}% round ${cornerRadius}px)`;
    }
  } else if (shape === 'rect' && !hasFade && !hasFeather && (c.top > 0 || c.bottom > 0 || c.left > 0 || c.right > 0)) {
    clipPath = `inset(${c.top}% ${c.right}% ${c.bottom}% ${c.left}%)`;
  }

  return {
    WebkitMaskImage: maskImage,
    maskImage: maskImage,
    WebkitMaskComposite: 'source-in, destination-in' as any,
    maskComposite: 'intersect' as any,
    clipPath,
    borderRadius
  };
}

function base64ToUint8(dataUrl: string): Uint8Array {
  const cleanB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Computes shape mask alpha multiplier taking into account geometry (circle, square, rounded-rect, capsule, etc.)
 */
export function computeShapeAlphaMultiplier(
  px: number,
  py: number,
  boxLeft: number,
  boxRight: number,
  boxTop: number,
  boxBottom: number,
  shape: CropShape = 'rect',
  cornerRadius: number = 25,
  cropFeather: CropFeather,
  canvasWidth: number,
  canvasHeight: number
): number {
  const cx = (boxLeft + boxRight) / 2;
  const cy = (boxTop + boxBottom) / 2;
  const boxW = Math.max(1, boxRight - boxLeft);
  const boxH = Math.max(1, boxBottom - boxTop);

  if (shape === 'circle') {
    const r = Math.min(boxW, boxH) / 2;
    const dist = Math.hypot(px - cx, py - cy);
    const maxFeatherPct = Math.max(cropFeather.top, cropFeather.bottom, cropFeather.left, cropFeather.right);
    const fDist = Math.max(1.5, (r * maxFeatherPct) / 100);
    if (dist >= r) return 0;
    if (dist > r - fDist) return (r - dist) / fDist;
    return 1.0;
  }

  if (shape === 'ellipse') {
    const rx = boxW / 2;
    const ry = boxH / 2;
    const nd = Math.hypot((px - cx) / rx, (py - cy) / ry);
    const maxFeatherPct = Math.max(cropFeather.top, cropFeather.bottom, cropFeather.left, cropFeather.right);
    const fRatio = Math.max(0.015, maxFeatherPct / 100);
    if (nd >= 1.0) return 0;
    if (nd > 1.0 - fRatio) return (1.0 - nd) / fRatio;
    return 1.0;
  }

  if (shape === 'rounded-rect') {
    const hw = boxW / 2;
    const hh = boxH / 2;
    const cr = Math.min(hw, hh) * (Math.max(2, Math.min(95, cornerRadius)) / 100);
    const qx = Math.abs(px - cx) - (hw - cr);
    const qy = Math.abs(py - cy) - (hh - cr);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cr;
    const maxFeatherPct = Math.max(cropFeather.top, cropFeather.bottom, cropFeather.left, cropFeather.right);
    const fDist = Math.max(1.5, (Math.min(hw, hh) * maxFeatherPct) / 100);
    if (d >= 0) return 0;
    if (d > -fDist) return (-d) / fDist;
    return 1.0;
  }

  if (shape === 'capsule') {
    const hw = boxW / 2;
    const hh = boxH / 2;
    const cr = Math.min(hw, hh);
    const qx = Math.abs(px - cx) - (hw - cr);
    const qy = Math.abs(py - cy) - (hh - cr);
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cr;
    const maxFeatherPct = Math.max(cropFeather.top, cropFeather.bottom, cropFeather.left, cropFeather.right);
    const fDist = Math.max(1.5, (cr * maxFeatherPct) / 100);
    if (d >= 0) return 0;
    if (d > -fDist) return (-d) / fDist;
    return 1.0;
  }

  if (shape === 'square') {
    const halfSide = Math.min(boxW, boxH) / 2;
    const sqLeft = cx - halfSide;
    const sqRight = cx + halfSide;
    const sqTop = cy - halfSide;
    const sqBottom = cy + halfSide;

    const fTop = (canvasHeight * cropFeather.top) / 100;
    const fBottom = (canvasHeight * cropFeather.bottom) / 100;
    const fLeft = (canvasWidth * cropFeather.left) / 100;
    const fRight = (canvasWidth * cropFeather.right) / 100;

    let a = 1.0;
    if (py <= sqTop) return 0;
    if (fTop > 0 && py < sqTop + fTop) a *= ((py - sqTop) / fTop);
    if (py >= sqBottom) return 0;
    if (fBottom > 0 && py > sqBottom - fBottom) a *= ((sqBottom - py) / fBottom);
    if (px <= sqLeft) return 0;
    if (fLeft > 0 && px < sqLeft + fLeft) a *= ((px - sqLeft) / fLeft);
    if (px >= sqRight) return 0;
    if (fRight > 0 && px > sqRight - fRight) a *= ((sqRight - px) / fRight);
    return Math.max(0, Math.min(1, a));
  }

  if (shape === 'diamond') {
    const rx = boxW / 2;
    const ry = boxH / 2;
    const nd = Math.abs(px - cx) / rx + Math.abs(py - cy) / ry;
    const maxFeatherPct = Math.max(cropFeather.top, cropFeather.bottom, cropFeather.left, cropFeather.right);
    const fRatio = Math.max(0.015, maxFeatherPct / 100);
    if (nd >= 1.0) return 0;
    if (nd > 1.0 - fRatio) return (1.0 - nd) / fRatio;
    return 1.0;
  }

  // Default: Standard Rectangle Crop + Feather
  const fTop = (canvasHeight * cropFeather.top) / 100;
  const fBottom = (canvasHeight * cropFeather.bottom) / 100;
  const fLeft = (canvasWidth * cropFeather.left) / 100;
  const fRight = (canvasWidth * cropFeather.right) / 100;

  let a = 1.0;
  if (py <= boxTop) return 0;
  if (fTop > 0 && py < boxTop + fTop) a *= ((py - boxTop) / fTop);
  if (py >= boxBottom) return 0;
  if (fBottom > 0 && py > boxBottom - fBottom) a *= ((boxBottom - py) / fBottom);
  if (px <= boxLeft) return 0;
  if (fLeft > 0 && px < boxLeft + fLeft) a *= ((px - boxLeft) / fLeft);
  if (px >= boxRight) return 0;
  if (fRight > 0 && px > boxRight - fRight) a *= ((boxRight - px) / fRight);
  return Math.max(0, Math.min(1, a));
}

/**
 * High-performance direct canvas pixel manipulation for real-time edge fade & crop
 */
export function applyTransparencyEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fadeConfig: FadeConfig,
  cropConfig: CropConfig,
  cropFeather: CropFeather
) {
  const shape = cropConfig.shape || 'rect';
  const hasCrop = (cropConfig.top > 0 || cropConfig.bottom > 0 || cropConfig.left > 0 || cropConfig.right > 0 || shape !== 'rect');
  const hasFade = (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0);
  
  if (!hasFade && !hasCrop) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const fadeTopLimit = (height * fadeConfig.top) / 100;
  const fadeBottomLimit = height - (height * fadeConfig.bottom) / 100;
  const fadeLeftLimit = (width * fadeConfig.left) / 100;
  const fadeRightLimit = width - (width * fadeConfig.right) / 100;

  const cropTopLimit = (height * cropConfig.top) / 100;
  const cropBottomLimit = height - (height * cropConfig.bottom) / 100;
  const cropLeftLimit = (width * cropConfig.left) / 100;
  const cropRightLimit = width - (width * cropConfig.right) / 100;

  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width;
    const y = Math.floor((i / 4) / width);

    let alphaMult = 1.0;

    // 1. Geometric Shape Crop + Feather
    if (hasCrop) {
      alphaMult = computeShapeAlphaMultiplier(
        x,
        y,
        cropLeftLimit,
        cropRightLimit,
        cropTopLimit,
        cropBottomLimit,
        shape,
        cropConfig.cornerRadius ?? 25,
        cropFeather,
        width,
        height
      );
    }

    // 2. Edge Fade (Smooth gradient over the edges)
    if (hasFade && alphaMult > 0) {
      if (fadeConfig.top > 0 && y < fadeTopLimit) {
        alphaMult *= (y / fadeTopLimit);
      }
      if (fadeConfig.bottom > 0 && y > fadeBottomLimit) {
        alphaMult *= ((height - y) / (height - fadeBottomLimit));
      }
      if (fadeConfig.left > 0 && x < fadeLeftLimit) {
        alphaMult *= (x / fadeLeftLimit);
      }
      if (fadeConfig.right > 0 && x > fadeRightLimit) {
        alphaMult *= ((width - x) / (width - fadeRightLimit));
      }
    }

    if (alphaMult < 1) {
      data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alphaMult)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Applies edge fade and crop to an image asset (PNG bytes) taking into account its placement on the project canvas
 */
export async function applyTransparencyToImage(
  dataUrlOrBytes: string | Uint8Array,
  fadeConfig: FadeConfig,
  cropConfig: CropConfig,
  cropFeather: CropFeather,
  layerBounds?: { x: number; y: number; width: number; height: number },
  canvasWidth = 750,
  canvasHeight = 1334
): Promise<Uint8Array> {
  const shape = cropConfig.shape || 'rect';
  const hasFade = (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0);
  const hasCrop = (cropConfig.top > 0 || cropConfig.bottom > 0 || cropConfig.left > 0 || cropConfig.right > 0 || shape !== 'rect');

  if (!hasFade && !hasCrop) {
    if (dataUrlOrBytes instanceof Uint8Array) return dataUrlOrBytes;
    return base64ToUint8(dataUrlOrBytes);
  }

  return new Promise((resolve) => {
    const img = new Image();
    let src = '';
    let objectUrlToRevoke: string | null = null;
    if (typeof dataUrlOrBytes === 'string') {
      src = dataUrlOrBytes;
    } else {
      const blob = new Blob([dataUrlOrBytes], { type: 'image/png' });
      src = URL.createObjectURL(blob);
      objectUrlToRevoke = src;
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          resolve(dataUrlOrBytes instanceof Uint8Array ? dataUrlOrBytes : base64ToUint8(dataUrlOrBytes));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        const bounds = layerBounds || { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
        const bX = bounds.x ?? 0;
        const bY = bounds.y ?? 0;
        const bW = bounds.width || canvasWidth;
        const bH = bounds.height || canvasHeight;

        const fadeTopLimit = (canvasHeight * fadeConfig.top) / 100;
        const fadeBottomLimit = canvasHeight - (canvasHeight * fadeConfig.bottom) / 100;
        const fadeLeftLimit = (canvasWidth * fadeConfig.left) / 100;
        const fadeRightLimit = canvasWidth - (canvasWidth * fadeConfig.right) / 100;

        const cropTopLimit = (canvasHeight * cropConfig.top) / 100;
        const cropBottomLimit = canvasHeight - (canvasHeight * cropConfig.bottom) / 100;
        const cropLeftLimit = (canvasWidth * cropConfig.left) / 100;
        const cropRightLimit = canvasWidth - (canvasWidth * cropConfig.right) / 100;

        const featherTop = (canvasHeight * cropFeather.top) / 100;
        const featherBottom = (canvasHeight * cropFeather.bottom) / 100;
        const featherLeft = (canvasWidth * cropFeather.left) / 100;
        const featherRight = (canvasWidth * cropFeather.right) / 100;

        for (let i = 0; i < data.length; i += 4) {
          const ix = (i / 4) % img.width;
          const iy = Math.floor((i / 4) / img.width);

          // Map local image pixel to project canvas coordinates
          const cx = bX + (ix / img.width) * bW;
          const cy = bY + (iy / img.height) * bH;

          let alphaMult = 1.0;

          // 1. Geometric Shape Crop + Feather
          if (hasCrop) {
            alphaMult = computeShapeAlphaMultiplier(
              cx,
              cy,
              cropLeftLimit,
              cropRightLimit,
              cropTopLimit,
              cropBottomLimit,
              shape,
              cropConfig.cornerRadius ?? 25,
              cropFeather,
              canvasWidth,
              canvasHeight
            );
          }

          // 2. Edge Fade
          if (hasFade && alphaMult > 0) {
            if (fadeConfig.top > 0 && cy < fadeTopLimit) {
              alphaMult *= (cy / fadeTopLimit);
            }
            if (fadeConfig.bottom > 0 && cy > fadeBottomLimit) {
              alphaMult *= ((canvasHeight - cy) / (canvasHeight - fadeBottomLimit));
            }
            if (fadeConfig.left > 0 && cx < fadeLeftLimit) {
              alphaMult *= (cx / fadeLeftLimit);
            }
            if (fadeConfig.right > 0 && cx > fadeRightLimit) {
              alphaMult *= ((canvasWidth - cx) / (canvasWidth - fadeRightLimit));
            }
          }

          if (alphaMult < 1) {
            data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alphaMult)));
          }
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          if (!blob) {
            resolve(dataUrlOrBytes instanceof Uint8Array ? dataUrlOrBytes : base64ToUint8(dataUrlOrBytes));
            return;
          }
          blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))).catch(() => {
            resolve(dataUrlOrBytes instanceof Uint8Array ? dataUrlOrBytes : base64ToUint8(dataUrlOrBytes));
          });
        }, 'image/png');
      } catch (err) {
        if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
        resolve(dataUrlOrBytes instanceof Uint8Array ? dataUrlOrBytes : base64ToUint8(dataUrlOrBytes));
      }
    };

    img.onerror = () => {
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
      resolve(dataUrlOrBytes instanceof Uint8Array ? dataUrlOrBytes : base64ToUint8(dataUrlOrBytes));
    };

    img.src = src;
  });
}
