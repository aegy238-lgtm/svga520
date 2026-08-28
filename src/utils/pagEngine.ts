import { PAGInit } from 'libpag';
import { encodeSVGA, parseSVGA } from './svgaEncoder';
import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../svga-proto';

let pagModule: any = null;

export async function getPAG() {
  if (!pagModule) {
    pagModule = await PAGInit({
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return 'https://cdn.jsdelivr.net/npm/libpag@latest/lib/libpag.wasm';
        }
        return file;
      }
    });
  }
  return pagModule;
}

export interface PagMetadata {
  width: number;
  height: number;
  durationSeconds: number;
  durationMicroseconds: number;
  fps: number;
  totalFrames: number;
  tagLevel: number;
  numImages: number;
  numTexts: number;
  numLayers: number;
  fileType: 'PAG' | 'SVGA';
  originalSize: number;
  images?: Record<string, string>; // base64 representation for UI
  colors?: string[]; // Unique hex colors used in SVGA vectors
}

/**
 * Format bytes into human readable format (B, KB, MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate live estimated output size based on settings
 */
export function estimateOutputSize(params: {
  originalSize: number;
  totalFrames: number;
  origFps: number;
  targetFps: number;
  quality: number; // 1 - 100
  width: number;
  height: number;
  fileType: 'PAG' | 'SVGA';
}): { bytes: number; formatted: string } {
  const { originalSize, totalFrames, origFps, targetFps, quality, width, height, fileType } = params;
  
  const frameRatio = Math.max(0.1, targetFps / Math.max(1, origFps));
  
  // Base compression factor curve based on WebP/JPEG canvas quality
  // Quality 100% -> ~0.85 of uncompressed frame data
  // Quality 50% -> ~0.35
  // Quality 10% -> ~0.10
  const qFactor = Math.pow(quality / 100, 1.25);
  
  let estimatedBytes = 0;

  if (fileType === 'SVGA') {
    // Asset-based or frame-based recompression estimate
    const basePayload = originalSize * 0.25; // header + protobuf vector metadata
    const compressedImageAssets = (originalSize - basePayload) * Math.max(0.08, qFactor);
    estimatedBytes = (basePayload + compressedImageAssets) * frameRatio;
  } else {
    // PAG to SVGA frame sequence estimate
    const rawPixelsPerFrame = width * height * 0.08; // average PNG/WebP frame bytes
    const totalRawFramesSize = totalFrames * rawPixelsPerFrame * frameRatio;
    estimatedBytes = totalRawFramesSize * Math.max(0.05, qFactor) + 12000;
  }

  // Ensure bounds
  estimatedBytes = Math.max(15000, Math.round(estimatedBytes));
  return {
    bytes: estimatedBytes,
    formatted: formatBytes(estimatedBytes)
  };
}

/**
 * Calculate optimal quality percentage (1 - 100) to hit a target file size in bytes
 */
export function calculateQualityForTarget(params: {
  targetBytes: number;
  originalSize: number;
  totalFrames: number;
  origFps: number;
  targetFps: number;
  width: number;
  height: number;
  fileType: 'PAG' | 'SVGA';
}): { quality: number; estimatedBytes: number; formatted: string } {
  const { targetBytes } = params;

  // Binary search best quality between 5% and 100%
  let low = 5;
  let high = 100;
  let bestQuality = 80;
  let closestEst = estimateOutputSize({ ...params, quality: bestQuality });

  for (let step = 0; step < 12; step++) {
    const mid = Math.round((low + high) / 2);
    const est = estimateOutputSize({ ...params, quality: mid });

    if (Math.abs(est.bytes - targetBytes) < Math.abs(closestEst.bytes - targetBytes)) {
      bestQuality = mid;
      closestEst = est;
    }

    if (est.bytes > targetBytes) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return {
    quality: Math.max(5, Math.min(100, bestQuality)),
    estimatedBytes: closestEst.bytes,
    formatted: closestEst.formatted
  };
}

export async function parsePagFile(fileOrBuffer: File | Blob | ArrayBuffer): Promise<{ pagFile: any; metadata: PagMetadata }> {
  const PAG = await getPAG();
  const blob = fileOrBuffer instanceof Blob ? fileOrBuffer : new Blob([fileOrBuffer]);
  const pagFile = await PAG.PAGFile.load(await blob.arrayBuffer());
  
  if (!pagFile) {
    throw new Error('فشل في تحليل ملف PAG. تأكد من أن الملف سليم.');
  }

  const durationMicroseconds = pagFile.duration();
  const durationSeconds = durationMicroseconds / 1000000;
  const fps = pagFile.frameRate() || 30;
  const totalFrames = Math.max(1, Math.floor(durationSeconds * fps));

  const numImages = pagFile.numImages ? pagFile.numImages() : 0;

  const images: Record<string, string> = {};
  if (numImages > 0) {
    try {
      for (let i = 0; i < numImages; i++) {
        const layers = pagFile.getLayersByEditableIndex(i, 5); // LayerType.Image is 5
        if (layers && layers.size() > 0) {
          const layer = layers.get(0);
          if (layer.imageBytes) {
            const bytes = layer.imageBytes();
            if (bytes && bytes.length > 0) {
              let mime = 'image/png';
              if (bytes[0] === 0x52 && bytes[1] === 0x49) mime = 'image/webp'; // RIFF
              else if (bytes[0] === 0xFF && bytes[1] === 0xD8) mime = 'image/jpeg';
              
              const blob = new Blob([bytes], { type: mime });
              images[`PAG_Image_${i}`] = URL.createObjectURL(blob);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to extract images from PAG", e);
    }
  }

  const metadata: PagMetadata = {
    width: pagFile.width(),
    height: pagFile.height(),
    durationSeconds: parseFloat(durationSeconds.toFixed(2)),
    durationMicroseconds,
    fps: parseFloat(fps.toFixed(2)),
    totalFrames,
    tagLevel: pagFile.tagLevel ? pagFile.tagLevel() : 4,
    numImages,
    numTexts: pagFile.numTexts ? pagFile.numTexts() : 0,
    numLayers: pagFile.numLayers ? pagFile.numLayers() : 0,
    fileType: 'PAG',
    originalSize: blob.size,
    images
  };

  return { pagFile, metadata };
}

export async function parseAnimationFile(file: File): Promise<{ metadata: PagMetadata; pagFile?: any; svgaMovie?: any }> {
  const name = file.name.toLowerCase();
  
  if (name.endsWith('.svga')) {
    const svgaMovie = await parseSVGA(file);
    const width = svgaMovie.params?.viewBoxWidth || 500;
    const height = svgaMovie.params?.viewBoxHeight || 500;
    const fps = svgaMovie.params?.fps || 30;
    const totalFrames = svgaMovie.params?.frames || 30;
    const durationSeconds = parseFloat((totalFrames / fps).toFixed(2));

    const images: Record<string, string> = {};
    if (svgaMovie.images) {
      for (const [key, uint8Arr] of Object.entries(svgaMovie.images)) {
        if (uint8Arr instanceof Uint8Array) {
          let mime = 'image/png';
          if (uint8Arr[0] === 0x52 && uint8Arr[1] === 0x49) mime = 'image/webp';
          else if (uint8Arr[0] === 0xFF && uint8Arr[1] === 0xD8) mime = 'image/jpeg';
          
          const blob = new Blob([uint8Arr], { type: mime });
          images[key] = URL.createObjectURL(blob);
        }
      }
    }

    const rgbaToHex = (r: number, g: number, b: number, a: number) => {
      const toHex = (n: number) => {
        const hex = Math.round(n * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      // For simplicity, we just extract rgb as hex (ignore alpha for color replacement mapping to keep it simple, or include it)
      // Let's just use 6-character hex for RGB
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const uniqueColors = new Set<string>();
    if (svgaMovie.sprites) {
      for (const sprite of svgaMovie.sprites) {
        if (sprite.frames) {
          for (const frame of sprite.frames) {
            if (frame.shapes) {
              for (const shape of frame.shapes) {
                if (shape.styles) {
                  if (shape.styles.fill && typeof shape.styles.fill.r === 'number') {
                    const c = shape.styles.fill;
                    uniqueColors.add(rgbaToHex(c.r, c.g, c.b, c.a));
                  }
                  if (shape.styles.stroke && typeof shape.styles.stroke.r === 'number') {
                    const c = shape.styles.stroke;
                    uniqueColors.add(rgbaToHex(c.r, c.g, c.b, c.a));
                  }
                }
              }
            }
          }
        }
      }
    }

    const metadata: PagMetadata = {
      width,
      height,
      durationSeconds,
      durationMicroseconds: durationSeconds * 1000000,
      fps,
      totalFrames,
      tagLevel: 4,
      numImages: Object.keys(svgaMovie.images || {}).length,
      numTexts: 0,
      numLayers: (svgaMovie.sprites || []).length,
      fileType: 'SVGA',
      originalSize: file.size,
      images,
      colors: Array.from(uniqueColors)
    };

    return { metadata, svgaMovie };
  } else {
    const { pagFile, metadata } = await parsePagFile(file);
    return { metadata, pagFile };
  }
}

export interface ConvertPagOptions {
  targetFps?: number;
  compressionQuality?: number; // 1 - 100
  startTime?: number; // seconds
  endTime?: number; // seconds
  imageFormat?: 'webp' | 'png' | 'jpeg';
  replacedImages?: Record<string, string>; // mapping imageKey to base64 string
  replacedColors?: Record<string, string>; // mapping original hex to new hex
  onProgress?: (progress: number, logMessage: string) => void;
}

export async function convertPagToSvga(
  fileOrBuffer: File | Blob | ArrayBuffer,
  options: ConvertPagOptions = {}
): Promise<{ svgaBlob: Blob; metadata: PagMetadata; finalFps: number; finalFrames: number; svgaSize: number }> {
  const { onProgress } = options;
  
  onProgress?.(5, 'تهيئة محرك libpag WebAssembly...');
  const PAG = await getPAG();

  onProgress?.(15, 'تحليل طبقات وملف PAG الأصلي...');
  const blob = fileOrBuffer instanceof Blob ? fileOrBuffer : new Blob([fileOrBuffer]);
  const pagFile = await PAG.PAGFile.load(await blob.arrayBuffer());
  if (!pagFile) {
    throw new Error('ملف PAG غير صالح');
  }

  // PRESERVE EXACT ORIGINAL DIMENSIONS (No scaling down of viewBox resolution!)
  const origWidth = pagFile.width();
  const origHeight = pagFile.height();
  const origFps = pagFile.frameRate() || 30;
  const origDurationSec = pagFile.duration() / 1000000;

  const targetFps = options.targetFps || origFps;
  const startTime = options.startTime || 0;
  const endTime = options.endTime || origDurationSec;
  const effectiveDuration = Math.max(0.1, endTime - startTime);
  const totalFrames = Math.max(1, Math.floor(effectiveDuration * targetFps));

  const quality = Math.max(0, Math.min(100, options.compressionQuality ?? 80));
  
  if (options.replacedImages && Object.keys(options.replacedImages).length > 0) {
    onProgress?.(20, 'تطبيق تعديلات الصور والطبقات...');
    for (const [key, base64] of Object.entries(options.replacedImages)) {
      if (key.startsWith('PAG_Image_')) {
        const index = parseInt(key.replace('PAG_Image_', ''), 10);
        if (!isNaN(index)) {
          try {
            const img = new Image();
            img.src = base64;
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            const pagImage = PAG.PAGImage.fromSource(img);
            pagFile.replaceImage(index, pagImage);
          } catch (e) {
            console.warn('Failed to replace image', key, e);
          }
        }
      }
    }
  }

  // Render canvas at 100% EXACT original width & height!
  const renderWidth = origWidth;
  const renderHeight = origHeight;

  onProgress?.(25, `استخراج الإطارات بجميتها (${totalFrames} إطار، بالأبعاد الأصلية ${renderWidth}x${renderHeight}px)...`);

  const canvasId = 'pag-render-canvas-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const canvas = document.createElement('canvas');
  canvas.id = canvasId;
  canvas.width = renderWidth;
  canvas.height = renderHeight;
  canvas.style.position = 'fixed';
  canvas.style.top = '-9999px';
  canvas.style.left = '-9999px';
  canvas.style.opacity = '0';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  let pagPlayer: any = null;
  let pagSurface: any = null;

  try {
    pagPlayer = await PAG.PAGPlayer.create();
    pagPlayer.setComposition(pagFile);
    pagSurface = PAG.PAGSurface.fromCanvas('#' + canvasId);
    pagPlayer.setSurface(pagSurface);

    const imagesMap: Record<string, Uint8Array> = {};
    const sprites: any[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const timeSec = startTime + (i / totalFrames) * effectiveDuration;
      const progressVal = timeSec / origDurationSec;
      
      pagPlayer.setProgress(Math.min(0.9999, Math.max(0, progressVal)));
      await pagPlayer.flush();

      const progressPct = 25 + Math.floor((i / totalFrames) * 55);
      if (i % 5 === 0 || i === totalFrames - 1) {
        onProgress?.(progressPct, `ضغط ومعالجة الإطار ${i + 1} من ${totalFrames} (جودة: ${quality}%)...`);
      }

      // Do not reduce dimensions to avoid pixelation or visual size reduction
      const frameWidth = origWidth;
      const frameHeight = origHeight;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = frameWidth;
      exportCanvas.height = frameHeight;
      const exportCtx = exportCanvas.getContext('2d');

      if (exportCtx) {
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';
        exportCtx.drawImage(canvas, 0, 0, origWidth, origHeight, 0, 0, frameWidth, frameHeight);

        if (quality < 100) {
          const imgData = exportCtx.getImageData(0, 0, frameWidth, frameHeight);
          const data = imgData.data;
          const levels = Math.max(2, Math.floor(8 + (quality / 100) * 247));
          const factor = 255 / (levels - 1);
          for (let j = 0; j < data.length; j += 4) {
            if (data[j+3] > 0) {
              data[j] = Math.round(Math.round(data[j] / factor) * factor);
              data[j+1] = Math.round(Math.round(data[j+1] / factor) * factor);
              data[j+2] = Math.round(Math.round(data[j+2] / factor) * factor);
              data[j+3] = Math.round(Math.round(data[j+3] / factor) * factor);
            }
          }
          exportCtx.putImageData(imgData, 0, 0);
        }
      }

      // Export as PNG so SVGA layers are visible and compatible
      const dataUrl = exportCanvas.toDataURL('image/png');
      
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      const imgKey = `frame_img_${i}`;
      imagesMap[imgKey] = bytes;

      const matrixA = origWidth / frameWidth;
      const matrixD = origHeight / frameHeight;

      const framesForSprite = [];
      for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
        framesForSprite.push({
          alpha: fIdx === i ? 1.0 : 0.0,
          layout: { x: 0, y: 0, width: frameWidth, height: frameHeight },
          transform: { a: matrixA, b: 0, c: 0, d: matrixD, tx: 0, ty: 0 }
        });
      }

      sprites.push({
        imageKey: imgKey,
        frames: framesForSprite
      });
    }

    onProgress?.(85, 'تجميع وتشفير ملف SVGA 2.0 Protobuf Deflate...');

    const movieData = {
      version: '2.0',
      params: {
        viewBoxWidth: origWidth,
        viewBoxHeight: origHeight,
        fps: Math.round(targetFps),
        frames: totalFrames
      },
      images: imagesMap,
      sprites
    };

    const svgaBlob = await encodeSVGA(movieData);

    onProgress?.(100, 'تم التحويل والضغط بنجاح!');

    const metadata: PagMetadata = {
      width: origWidth,
      height: origHeight,
      durationSeconds: parseFloat(effectiveDuration.toFixed(2)),
      durationMicroseconds: pagFile.duration(),
      fps: targetFps,
      totalFrames,
      tagLevel: pagFile.tagLevel ? pagFile.tagLevel() : 4,
      numImages: pagFile.numImages ? pagFile.numImages() : 0,
      numTexts: pagFile.numTexts ? pagFile.numTexts() : 0,
      numLayers: pagFile.numLayers ? pagFile.numLayers() : 0,
      fileType: 'PAG',
      originalSize: blob.size
    };

    return {
      svgaBlob,
      metadata,
      finalFps: Math.round(targetFps),
      finalFrames: totalFrames,
      svgaSize: svgaBlob.size
    };
  } finally {
    if (pagPlayer) {
      try { pagPlayer.destroy?.(); } catch (e) {}
    }
    if (pagSurface) {
      try { pagSurface.destroy?.(); } catch (e) {}
    }
    if (pagFile) {
      try { pagFile.destroy?.(); } catch (e) {}
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
  }
}

// Removed convertSvgaToPag since it generates invalid PAG files.

/**
 * Deep Re-compression for SVGA files directly (SVGA -> Compressed SVGA)
 * Preserves 100% of viewBox resolution and vector layers while compressing image assets!
 */
export async function compressSvgaFile(
  file: File,
  options: ConvertPagOptions = {}
): Promise<{ svgaBlob: Blob; metadata: PagMetadata; svgaSize: number }> {
  const { onProgress } = options;
  onProgress?.(10, 'فحص وتحليل ملف SVGA المخزن...');

  const svgaMovie = await parseSVGA(file);
  const origW = svgaMovie.params?.viewBoxWidth || 500;
  const origH = svgaMovie.params?.viewBoxHeight || 500;
  const origFps = svgaMovie.params?.fps || 30;
  const totalFrames = svgaMovie.params?.frames || 30;
  const quality = Math.max(0, Math.min(100, options.compressionQuality ?? 80));

  onProgress?.(25, 'إعادة ضغط الأصول والمكونات الرسومية بضغط عالي...');

  const sourceImages = svgaMovie.images || {};
  const imageKeys = Object.keys(sourceImages);
  const compressedImages: Record<string, Uint8Array> = {};

  // Do not scale down images to prevent size reduction and fog
  const scaleRatio = 1.0;

  for (let i = 0; i < imageKeys.length; i++) {
    const key = imageKeys[i];
    
    // Check if the image was replaced by the user
    let rawData = sourceImages[key];
    let isReplaced = false;
    let replacedBase64 = '';
    
    if (options.replacedImages && options.replacedImages[key]) {
      isReplaced = true;
      replacedBase64 = options.replacedImages[key];
    } else if (!rawData || rawData.length === 0) {
      continue;
    }

    onProgress?.(
      25 + Math.floor((i / Math.max(1, imageKeys.length)) * 60),
      `ضغط الأصول ${i + 1} من ${imageKeys.length}...`
    );

    try {
      // Load raw image bytes into HTML Image element
      let base64 = '';
      if (isReplaced) {
        base64 = replacedBase64;
      } else if (typeof rawData === 'string') {
        base64 = rawData.startsWith('data:') ? rawData : `data:image/png;base64,${rawData}`;
      } else {
        let mime = 'image/png';
        if (rawData[0] === 0x52 && rawData[1] === 0x49) mime = 'image/webp';
        else if (rawData[0] === 0xFF && rawData[1] === 0xD8) mime = 'image/jpeg';
        const blob = new Blob([rawData], { type: mime });
        base64 = URL.createObjectURL(blob);
      }

      const img = new Image();
      img.src = base64;
      await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });

      if (img.width && img.height) {
        const cw = Math.max(16, Math.round(img.width * scaleRatio));
        const ch = Math.max(16, Math.round(img.height * scaleRatio));

        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, cw, ch);

          if (quality < 100) {
            const imageData = ctx.getImageData(0, 0, cw, ch);
            const data = imageData.data;
            const levels = Math.max(2, Math.floor(8 + (quality / 100) * 247));
            const factor = 255 / (levels - 1);
            for (let j = 0; j < data.length; j += 4) {
              if (data[j+3] > 0) {
                data[j] = Math.round(Math.round(data[j] / factor) * factor);
                data[j+1] = Math.round(Math.round(data[j+1] / factor) * factor);
                data[j+2] = Math.round(Math.round(data[j+2] / factor) * factor);
                data[j+3] = Math.round(Math.round(data[j+3] / factor) * factor);
              }
            }
            ctx.putImageData(imageData, 0, 0);
          }

          // Use PNG to ensure SVGA compatibility (WebP fails in most SVGA players and makes it blank)
          const newUrl = canvas.toDataURL('image/png');
          const binStr = atob(newUrl.split(',')[1]);
          const bytes = new Uint8Array(binStr.length);
          for (let j = 0; j < binStr.length; j++) bytes[j] = binStr.charCodeAt(j);
          compressedImages[key] = bytes;
        } else {
          compressedImages[key] = rawData;
        }
      } else {
        compressedImages[key] = rawData;
      }
    } catch (e) {
      compressedImages[key] = rawData;
    }
  }

  const hexToRgba = (hex: string, originalA: number) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b, a: originalA };
  };

  const rgbaToHex = (r: number, g: number, b: number, a: number) => {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Replace colors in vector shapes
  if (options.replacedColors && Object.keys(options.replacedColors).length > 0 && svgaMovie.sprites) {
    for (const sprite of svgaMovie.sprites) {
      if (sprite.frames) {
        for (const frame of sprite.frames) {
          if (frame.shapes) {
            for (const shape of frame.shapes) {
              if (shape.styles) {
                if (shape.styles.fill && typeof shape.styles.fill.r === 'number') {
                  const c = shape.styles.fill;
                  const hex = rgbaToHex(c.r, c.g, c.b, c.a);
                  if (options.replacedColors[hex]) {
                    shape.styles.fill = hexToRgba(options.replacedColors[hex], c.a);
                  }
                }
                if (shape.styles.stroke && typeof shape.styles.stroke.r === 'number') {
                  const c = shape.styles.stroke;
                  const hex = rgbaToHex(c.r, c.g, c.b, c.a);
                  if (options.replacedColors[hex]) {
                    shape.styles.stroke = hexToRgba(options.replacedColors[hex], c.a);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  onProgress?.(90, 'إعادة حزم ملف SVGA المضغوط بنجاح...');

  const newMovie = {
    ...svgaMovie,
    params: {
      ...svgaMovie.params,
      fps: options.targetFps || origFps
    },
    images: compressedImages
  };

  const svgaBlob = await encodeSVGA(newMovie);
  onProgress?.(100, 'تم اكتشاف وضغط ملف SVGA بنجاح!');

  const durationSec = parseFloat((totalFrames / (options.targetFps || origFps)).toFixed(2));
  const metadata: PagMetadata = {
    width: origW,
    height: origH,
    durationSeconds: durationSec,
    durationMicroseconds: durationSec * 1000000,
    fps: options.targetFps || origFps,
    totalFrames,
    tagLevel: 4,
    numImages: Object.keys(compressedImages).length,
    numTexts: 0,
    numLayers: (svgaMovie.sprites || []).length,
    fileType: 'SVGA',
    originalSize: file.size
  };

  return {
    svgaBlob,
    metadata,
    svgaSize: svgaBlob.size
  };
}

