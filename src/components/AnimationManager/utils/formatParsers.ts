import JSZip from 'jszip';
import UPNG from 'upng-js';
import { SupportedFormat, AnimationItem } from '../types';
import { computeFileHash } from './hashUtils';

/**
 * Detect format based on filename and header bytes
 */
export async function detectFormat(file: File): Promise<SupportedFormat> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'svga') return 'svga';
  if (ext === 'pag') return 'pag';
  if (ext === 'lottie') return 'dotlottie';
  if (ext === 'gif') return 'gif';
  if (ext === 'webp') return 'webp';
  if (ext === 'apng') return 'apng';

  // If JSON, test if it's Lottie
  if (ext === 'json') {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.v && parsed.layers && typeof parsed.fr !== 'undefined') {
        return 'lottie';
      }
    } catch {
      // not lottie json
    }
  }

  // Check binary magic bytes for PNG/APNG
  try {
    const slice = await file.slice(0, 4096).arrayBuffer();
    const uint8 = new Uint8Array(slice);

    // Check PNG signature: 137 80 78 71 13 10 26 10
    if (
      uint8[0] === 0x89 &&
      uint8[1] === 0x50 &&
      uint8[2] === 0x4e &&
      uint8[3] === 0x47
    ) {
      // Look for 'acTL' chunk (Animation Control)
      // Chunk type bytes: 0x61 0x63 0x54 0x4c
      for (let i = 8; i < uint8.length - 4; i++) {
        if (
          uint8[i] === 0x61 &&
          uint8[i + 1] === 0x63 &&
          uint8[i + 2] === 0x54 &&
          uint8[i + 3] === 0x4c
        ) {
          return 'apng';
        }
      }
      return 'png';
    }

    // Check GIF signature: GIF87a or GIF89a
    if (
      uint8[0] === 0x47 &&
      uint8[1] === 0x49 &&
      uint8[2] === 0x46 &&
      uint8[3] === 0x38
    ) {
      return 'gif';
    }

    // Check WebP signature: RIFF ... WEBP
    if (
      uint8[0] === 0x52 &&
      uint8[1] === 0x49 &&
      uint8[2] === 0x46 &&
      uint8[3] === 0x46 &&
      uint8[8] === 0x57 &&
      uint8[9] === 0x45 &&
      uint8[10] === 0x42 &&
      uint8[11] === 0x50
    ) {
      return 'webp';
    }
  } catch (e) {
    console.warn('Magic byte inspection failed:', e);
  }

  // Default fallback
  if (ext === 'png') return 'png';
  return 'png';
}

/**
 * Load an image to extract natural dimensions
 */
function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 512, height: img.naturalHeight || 512 });
    };
    img.onerror = () => {
      resolve({ width: 512, height: 512 });
    };
    img.src = url;
  });
}

/**
 * Parse a file into a fully populated AnimationItem
 */
export async function parseAnimationFile(file: File): Promise<AnimationItem> {
  const hash = await computeFileHash(file);
  const format = await detectFormat(file);
  const previewUrl = URL.createObjectURL(file);
  const id = `anim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const baseItem: AnimationItem = {
    id,
    name: file.name.replace(/\.[^/.]+$/, ''),
    originalName: file.name,
    format,
    size: file.size,
    dimensions: { width: 512, height: 512 },
    duration: 0,
    fps: 30,
    frameCount: 1,
    contentHash: hash,
    file,
    previewUrl,
    createdAt: Date.now(),
    status: 'loading'
  };

  try {
    if (format === 'lottie') {
      const text = await file.text();
      const lottieData = JSON.parse(text);
      const width = lottieData.w || 512;
      const height = lottieData.h || 512;
      const fps = lottieData.fr || 30;
      const ip = lottieData.ip || 0;
      const op = lottieData.op || (fps * 3);
      const frameCount = Math.max(1, Math.round(op - ip));
      const duration = Number((frameCount / fps).toFixed(2));

      return {
        ...baseItem,
        dimensions: { width, height },
        fps,
        frameCount,
        duration,
        lottieData,
        status: 'ready'
      };
    }

    if (format === 'dotlottie') {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);

      // Locate animations inside the dotLottie archive
      let animationJson: any = null;
      const extractedList: Array<{ id: string; name?: string; data: any }> = [];

      // Check manifest.json first
      const manifestFile = loadedZip.file('manifest.json');
      if (manifestFile) {
        try {
          const manifestText = await manifestFile.async('text');
          const manifest = JSON.parse(manifestText);
          if (manifest.animations && manifest.animations.length > 0) {
            const firstAnimId = manifest.animations[0].id;
            const animPath = `animations/${firstAnimId}.json`;
            const animFile = loadedZip.file(animPath) || loadedZip.file(`${firstAnimId}.json`);
            if (animFile) {
              const text = await animFile.async('text');
              animationJson = JSON.parse(text);
            }
          }
        } catch (e) {
          console.warn('Manifest reading failed in dotLottie:', e);
        }
      }

      // If still not found, search all .json files in zip
      if (!animationJson) {
        for (const [filename, zipEntry] of Object.entries(loadedZip.files)) {
          if (filename.endsWith('.json') && !filename.includes('manifest') && !zipEntry.dir) {
            try {
              const text = await zipEntry.async('text');
              const parsed = JSON.parse(text);
              if (parsed.v && parsed.layers) {
                animationJson = parsed;
                extractedList.push({ id: filename, data: parsed });
                break;
              }
            } catch {}
          }
        }
      }

      if (animationJson) {
        const width = animationJson.w || 512;
        const height = animationJson.h || 512;
        const fps = animationJson.fr || 30;
        const ip = animationJson.ip || 0;
        const op = animationJson.op || (fps * 3);
        const frameCount = Math.max(1, Math.round(op - ip));
        const duration = Number((frameCount / fps).toFixed(2));

        return {
          ...baseItem,
          dimensions: { width, height },
          fps,
          frameCount,
          duration,
          lottieData: animationJson,
          dotLottieAnimations: extractedList,
          status: 'ready'
        };
      } else {
        throw new Error('لم يتم العثور على أنيميشن Lottie صالح داخل حزمة DotLottie.');
      }
    }

    if (format === 'apng') {
      const buffer = await file.arrayBuffer();
      try {
        const decoded = UPNG.decode(buffer);
        const width = decoded.width || 512;
        const height = decoded.height || 512;
        const frameCount = decoded.frames ? decoded.frames.length : 1;
        let duration = 0;
        if (decoded.frames && decoded.frames.length > 0) {
          const totalDelayMs = decoded.frames.reduce((sum: number, f: any) => sum + (f.delay || 100), 0);
          duration = Number((totalDelayMs / 1000).toFixed(2));
        }
        const fps = duration > 0 ? Math.max(1, Math.round(frameCount / duration)) : 30;

        return {
          ...baseItem,
          dimensions: { width, height },
          fps,
          frameCount,
          duration: duration || 1,
          status: 'ready'
        };
      } catch (e) {
        console.warn('UPNG decode failed, falling back to standard image load:', e);
      }
    }

    // PAG Animation Parser
    if (format === 'pag') {
      try {
        const buffer = await file.arrayBuffer();
        const { getPAG } = await import('../../../utils/pagEngine');
        const PAG = await getPAG();
        const pagFile = await PAG.PAGFile.load(buffer);
        const width = pagFile.width() || 512;
        const height = pagFile.height() || 512;
        const fps = pagFile.frameRate() || 30;
        const durationSec = pagFile.duration() / 1000000;
        const frameCount = Math.max(1, Math.round(durationSec * fps));
        const duration = Number(durationSec.toFixed(2));
        
        pagFile.destroy();

        return {
          ...baseItem,
          dimensions: { width, height },
          fps,
          frameCount,
          duration: duration || 1,
          status: 'ready'
        };
      } catch (e) {
        console.warn('PAG parser error:', e);
      }
    }

    // SVGA Animation Parser
    if (format === 'svga') {
      try {
        const buffer = await file.arrayBuffer();
        const { Parser: SvgaParser } = await import('svga.lite');
        const parser = new SvgaParser();
        const videoItem = await parser.do(buffer);
        const width = videoItem.videoSize.width || 512;
        const height = videoItem.videoSize.height || 512;
        const fps = videoItem.FPS || 30;
        const frameCount = Math.max(1, videoItem.frames || 1);
        const duration = Number((frameCount / fps).toFixed(2));

        return {
          ...baseItem,
          dimensions: { width, height },
          fps,
          frameCount,
          duration: duration || 1,
          status: 'ready'
        };
      } catch (e) {
        console.warn('SVGA parser error:', e);
      }
    }

    // GIF Parser with exact frame count and duration
    if (format === 'gif') {
      try {
        const buffer = await file.arrayBuffer();
        const omggifModule = await import('omggif');
        const GifReader = (omggifModule as any).GifReader || (omggifModule as any).default?.GifReader;
        if (GifReader) {
          const reader = new GifReader(new Uint8Array(buffer) as any);
          const frameCount = Math.max(1, reader.numFrames());
          const width = reader.width || 512;
          const height = reader.height || 512;
          let totalDurationMs = 0;
          for (let i = 0; i < frameCount; i++) {
            const info = reader.frameInfo(i);
            const delayCs = info.delay > 0 ? info.delay : 10;
            totalDurationMs += delayCs * 10;
          }
          const duration = Number((totalDurationMs / 1000).toFixed(2));
          const fps = duration > 0 ? Math.max(1, Math.round(frameCount / duration)) : 25;

          return {
            ...baseItem,
            dimensions: { width, height },
            fps,
            frameCount,
            duration: duration || 1,
            status: 'ready'
          };
        }
      } catch (e) {
        console.warn('omggif inspection failed:', e);
      }
    }

    // WebP Parser - Detect Animation & Extract Frames & Duration from ANMF chunks
    if (format === 'webp') {
      try {
        const buffer = await file.arrayBuffer();
        const u8 = new Uint8Array(buffer);
        let anmfCount = 0;
        let totalDurationMs = 0;
        let canvasW = 512;
        let canvasH = 512;

        let offset = 12; // Skip RIFF header
        while (offset < u8.length - 8) {
          const fourCC = String.fromCharCode(u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]);
          const chunkSize = u8[offset + 4] | (u8[offset + 5] << 8) | (u8[offset + 6] << 16) | (u8[offset + 7] << 24);

          if (fourCC === 'VP8X' && offset + 18 <= u8.length) {
            canvasW = 1 + (u8[offset + 12] | (u8[offset + 13] << 8) | (u8[offset + 14] << 16));
            canvasH = 1 + (u8[offset + 15] | (u8[offset + 16] << 8) | (u8[offset + 17] << 16));
          } else if (fourCC === 'ANMF' && offset + 24 <= u8.length) {
            anmfCount++;
            // Duration is 3 bytes at offset + 8 + 12 = offset + 20
            const frameDur = u8[offset + 20] | (u8[offset + 21] << 8) | (u8[offset + 22] << 16);
            totalDurationMs += frameDur > 0 ? frameDur : 100;
          }

          offset += 8 + chunkSize + (chunkSize % 2);
        }

        if (anmfCount > 0) {
          const duration = Number((totalDurationMs / 1000).toFixed(2));
          const fps = duration > 0 ? Math.max(1, Math.round(anmfCount / duration)) : 25;
          return {
            ...baseItem,
            dimensions: { width: canvasW, height: canvasH },
            fps,
            frameCount: anmfCount,
            duration: duration || 1,
            status: 'ready'
          };
        }
      } catch (e) {
        console.warn('WebP animation chunk parsing failed:', e);
      }
    }

    // Static PNG or Fallback Image
    const dims = await getImageDimensions(previewUrl);

    return {
      ...baseItem,
      dimensions: dims,
      fps: 30,
      frameCount: 1,
      duration: 0,
      status: 'ready'
    };
  } catch (err: any) {
    console.error('Error parsing animation file:', err);
    return {
      ...baseItem,
      status: 'error',
      errorMessage: err?.message || 'فشل في قراءة بيانات الملف'
    };
  }
}
