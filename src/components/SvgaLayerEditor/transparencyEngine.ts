export interface FadeConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CropConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
  right: 0
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
  if (crop && (crop.top > 0 || crop.bottom > 0 || crop.left > 0 || crop.right > 0)) {
    return true;
  }
  return false;
}

function base64ToUint8(dataUrl: string): Uint8Array {
  const cleanB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
  const hasFade = (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0);
  const hasCrop = (cropConfig.top > 0 || cropConfig.bottom > 0 || cropConfig.left > 0 || cropConfig.right > 0);
  
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

  const featherTop = (height * cropFeather.top) / 100;
  const featherBottom = (height * cropFeather.bottom) / 100;
  const featherLeft = (width * cropFeather.left) / 100;
  const featherRight = (width * cropFeather.right) / 100;

  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width;
    const y = Math.floor((i / 4) / width);

    let alphaMult = 1.0;

    // 1. Crop + Feather
    if (hasCrop) {
      if (y <= cropTopLimit) {
        alphaMult = 0;
      } else if (cropFeather.top > 0 && y < cropTopLimit + featherTop) {
        alphaMult *= ((y - cropTopLimit) / featherTop);
      }
      
      if (y >= cropBottomLimit) {
        alphaMult = 0;
      } else if (cropFeather.bottom > 0 && y > cropBottomLimit - featherBottom) {
        alphaMult *= ((cropBottomLimit - y) / featherBottom);
      }

      if (x <= cropLeftLimit) {
        alphaMult = 0;
      } else if (cropFeather.left > 0 && x < cropLeftLimit + featherLeft) {
        alphaMult *= ((x - cropLeftLimit) / featherLeft);
      }

      if (x >= cropRightLimit) {
        alphaMult = 0;
      } else if (cropFeather.right > 0 && x > cropRightLimit - featherRight) {
        alphaMult *= ((cropRightLimit - x) / featherRight);
      }
    }

    // 2. Edge Fade
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
  const hasFade = (fadeConfig.top > 0 || fadeConfig.bottom > 0 || fadeConfig.left > 0 || fadeConfig.right > 0);
  const hasCrop = (cropConfig.top > 0 || cropConfig.bottom > 0 || cropConfig.left > 0 || cropConfig.right > 0);

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

          // 1. Crop + Feather
          if (hasCrop) {
            if (cy <= cropTopLimit) {
              alphaMult = 0;
            } else if (cropFeather.top > 0 && cy < cropTopLimit + featherTop) {
              alphaMult *= ((cy - cropTopLimit) / featherTop);
            }
            if (cy >= cropBottomLimit) {
              alphaMult = 0;
            } else if (cropFeather.bottom > 0 && cy > cropBottomLimit - featherBottom) {
              alphaMult *= ((cropBottomLimit - cy) / featherBottom);
            }
            if (cx <= cropLeftLimit) {
              alphaMult = 0;
            } else if (cropFeather.left > 0 && cx < cropLeftLimit + featherLeft) {
              alphaMult *= ((cx - cropLeftLimit) / featherLeft);
            }
            if (cx >= cropRightLimit) {
              alphaMult = 0;
            } else if (cropFeather.right > 0 && cx > cropRightLimit - featherRight) {
              alphaMult *= ((cropRightLimit - cx) / featherRight);
            }
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
