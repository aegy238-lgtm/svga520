export interface ChromaTargetColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface SmartChromaOptions {
  targets: ChromaTargetColor[];
  tolerance: number;   // 1 to 100
  smoothness: number;  // 0 to 50
  despill: number;     // 0 to 100
}

/**
 * Converts RGB components to Hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Identifies the nature/type of the color for smart labeling in UI
 */
export function identifyColorType(r: number, g: number, b: number): { label: string; isChroma: boolean } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;

  // Green chroma
  if (g > 70 && g > r + 30 && g > b + 30) {
    return { label: 'كروما خضراء (Green Screen)', isChroma: true };
  }
  // Blue chroma
  if (b > 70 && b > r + 30 && b > g + 30) {
    return { label: 'كروما زرقاء (Blue Screen)', isChroma: true };
  }
  // Black background
  if (brightness < 25 && max - min < 15) {
    return { label: 'خلفية سوداء (Black Background)', isChroma: true };
  }
  // White background
  if (brightness > 235 && max - min < 15) {
    return { label: 'خلفية بيضاء (White Background)', isChroma: true };
  }
  // Cyan
  if (g > 100 && b > 100 && r < 70) {
    return { label: 'كروما سماوية (Cyan Screen)', isChroma: true };
  }
  // Magenta
  if (r > 100 && b > 100 && g < 70) {
    return { label: 'كروما أرجوانية (Magenta Screen)', isChroma: true };
  }

  return { label: 'لون محدد (Custom Color)', isChroma: false };
}

/**
 * High-speed in-place pixel chroma removal and despill processing
 */
export function processImageDataSmartChroma(
  imageData: ImageData,
  options: SmartChromaOptions
): void {
  const { targets, tolerance, smoothness, despill } = options;
  if (!targets || targets.length === 0) return;

  const data = imageData.data;
  const len = data.length;

  // Normalize tolerance: scaled to perceptual distance range (0..440)
  // Distance max between black and white is ~765. Typical tolerance 30 maps to ~80-120 dist.
  const threshDist = (tolerance / 100) * 280 + 10;
  const smoothDist = Math.max(1, (smoothness / 50) * 60);
  const despillFactor = despill / 100;

  // Pre-calculate target colors characteristics
  const parsedTargets = targets.map((t) => {
    const isGreenKey = t.g > t.r + 25 && t.g > t.b + 25;
    const isBlueKey = t.b > t.r + 25 && t.b > t.g + 25;
    const isRedKey = t.r > t.g + 25 && t.r > t.b + 25;
    return {
      r: t.r,
      g: t.g,
      b: t.b,
      isGreenKey,
      isBlueKey,
      isRedKey,
    };
  });

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    let a = data[i + 3];

    if (a === 0) continue;

    // Find minimum perceptual color distance among all sampled targets
    let minDist = 999999;
    let closestTarget = parsedTargets[0];

    for (let t = 0; t < parsedTargets.length; t++) {
      const pt = parsedTargets[t];
      const rmean = (r + pt.r) >> 1;
      const dr = r - pt.r;
      const dg = g - pt.g;
      const db = b - pt.b;
      // Perceptual color distance formula
      const distSq = (((512 + rmean) * dr * dr) >> 8) + (4 * dg * dg) + (((767 - rmean) * db * db) >> 8);
      const dist = Math.sqrt(distSq);

      if (dist < minDist) {
        minDist = dist;
        closestTarget = pt;
      }
    }

    // Alpha calculation based on distance and smoothness
    let alphaMult = 1.0;

    if (minDist <= threshDist) {
      // Within hard cut threshold -> Completely transparent
      alphaMult = 0;
    } else if (minDist < threshDist + smoothDist) {
      // In soft edge transition zone -> Smooth hermite curve
      const factor = (minDist - threshDist) / smoothDist;
      alphaMult = factor * factor * (3 - 2 * factor); // Smoothstep
    }

    // Smart Despill Filter (Eliminates color fringe/residues on semi-transparent and edge borders)
    if (despillFactor > 0 && alphaMult > 0 && alphaMult < 0.98) {
      if (closestTarget.isGreenKey) {
        // Clamp green spill on edges to the max of surrounding red and blue
        const maxRB = Math.max(r, b);
        if (g > maxRB) {
          g = Math.round(g * (1 - despillFactor) + maxRB * despillFactor);
        }
      } else if (closestTarget.isBlueKey) {
        // Clamp blue spill
        const maxRG = Math.max(r, g);
        if (b > maxRG) {
          b = Math.round(b * (1 - despillFactor) + maxRG * despillFactor);
        }
      } else if (closestTarget.isRedKey) {
        // Clamp red spill
        const maxGB = Math.max(g, b);
        if (r > maxGB) {
          r = Math.round(r * (1 - despillFactor) + maxGB * despillFactor);
        }
      } else {
        // For custom neutral or other colors, subtly suppress closeness to target color
        const spillInfluence = (1.0 - alphaMult) * despillFactor;
        r = Math.round(r * (1 - spillInfluence) + (r > closestTarget.r ? r - 20 : r + 20) * spillInfluence);
        g = Math.round(g * (1 - spillInfluence) + (g > closestTarget.g ? g - 20 : g + 20) * spillInfluence);
        b = Math.round(b * (1 - spillInfluence) + (b > closestTarget.b ? b - 20 : b + 20) * spillInfluence);
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.round(a * alphaMult);
  }
}

/**
 * Applies smart chroma removal to a single image (DataURL or Blob URL or image element)
 */
export async function applySmartChromaToSingleImage(
  imageUrl: string,
  options: SmartChromaOptions
): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processImageDataSmartChroma(imgData, options);
        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              const dUrl = canvas.toDataURL('image/png');
              const bytes = base64ToUint8(dUrl);
              resolve({ dataUrl: dUrl, bytes, width: canvas.width, height: canvas.height });
              return;
            }
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const objUrl = URL.createObjectURL(blob);
            resolve({ dataUrl: objUrl, bytes, width: canvas.width, height: canvas.height });
          },
          'image/png'
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for chroma processing'));
    };

    img.src = imageUrl;
  });
}

function base64ToUint8(dataUrl: string): Uint8Array {
  const clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
