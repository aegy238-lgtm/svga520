// High-performance image format conversion & sniffing utilities for SVGA Studio layers
// Supports converting WebP, PNG, JPEG, GIF to any target image format with lossless/high quality
export type SupportedImageFormat = 'image/png' | 'image/webp' | 'image/jpeg';

export interface FormatSniffResult {
  mimeType: string;
  formatName: 'PNG' | 'WEBP' | 'JPEG' | 'GIF' | 'SVG' | 'UNKNOWN';
}

/**
 * Accurately sniff the exact image format from raw bytes or dataUrl header
 */
export function sniffImageFormat(dataUrlOrBytes: string | Uint8Array): FormatSniffResult {
  if (typeof dataUrlOrBytes === 'string') {
    if (dataUrlOrBytes.startsWith('data:image/webp')) return { mimeType: 'image/webp', formatName: 'WEBP' };
    if (dataUrlOrBytes.startsWith('data:image/png')) return { mimeType: 'image/png', formatName: 'PNG' };
    if (dataUrlOrBytes.startsWith('data:image/jpeg') || dataUrlOrBytes.startsWith('data:image/jpg')) return { mimeType: 'image/jpeg', formatName: 'JPEG' };
    if (dataUrlOrBytes.startsWith('data:image/gif')) return { mimeType: 'image/gif', formatName: 'GIF' };
    if (dataUrlOrBytes.startsWith('data:image/svg+xml')) return { mimeType: 'image/svg+xml', formatName: 'SVG' };
  }

  let bytes: Uint8Array;
  if (dataUrlOrBytes instanceof Uint8Array) {
    bytes = dataUrlOrBytes;
  } else {
    try {
      const cleanB64 = dataUrlOrBytes.includes(',') ? dataUrlOrBytes.split(',')[1] : dataUrlOrBytes;
      const bin = atob(cleanB64.slice(0, 64)); // only need the first few bytes
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return { mimeType: 'image/png', formatName: 'PNG' };
    }
  }

  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { mimeType: 'image/png', formatName: 'PNG' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return { mimeType: 'image/jpeg', formatName: 'JPEG' };
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mimeType: 'image/webp', formatName: 'WEBP' };
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mimeType: 'image/gif', formatName: 'GIF' };
  }

  return { mimeType: 'image/png', formatName: 'PNG' };
}

/**
 * Converts an image dataURL or raw bytes to another format (e.g. WebP to PNG or WebP to JPEG)
 * Preserves native resolution and alpha transparency.
 */
export async function convertImageData(
  dataUrlOrBytes: string | Uint8Array,
  targetMime: SupportedImageFormat = 'image/png',
  quality: number = 0.95,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ dataUrl: string; bytes: Uint8Array; width: number; height: number }> {
  let src = '';
  let objectUrlToRevoke: string | null = null;

  if (typeof dataUrlOrBytes === 'string') {
    src = dataUrlOrBytes;
  } else {
    const sniff = sniffImageFormat(dataUrlOrBytes);
    const blob = new Blob([dataUrlOrBytes], { type: sniff.mimeType });
    src = URL.createObjectURL(blob);
    objectUrlToRevoke = src;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 100;
        const naturalH = img.naturalHeight || img.height || 100;

        const width = (targetWidth && targetWidth > 0) ? Math.round(targetWidth) : naturalW;
        const height = (targetHeight && targetHeight > 0) ? Math.round(targetHeight) : naturalH;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          reject(new Error('Failed to create 2d canvas context'));
          return;
        }

        // Apply high quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // If target is JPEG and doesn't support alpha, fill with white or keep transparent for PNG/WEBP
        if (targetMime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(targetMime, quality);

        canvas.toBlob((blob) => {
          if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
          if (!blob) {
            // fallback: convert base64 to bytes
            const cleanB64 = dataUrl.split(',')[1] || '';
            const bin = atob(cleanB64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            resolve({ dataUrl, bytes, width, height });
            return;
          }

          blob.arrayBuffer().then((ab) => {
            resolve({
              dataUrl,
              bytes: new Uint8Array(ab),
              width,
              height
            });
          }).catch(reject);
        }, targetMime, quality);
      } catch (err) {
        if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
      reject(new Error('Failed to load image for conversion: ' + err));
    };

    img.src = src;
  });
}
