import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData, FadeConfig, CropConfig, CropFeather } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { ensureMp3WithId3 } from '../../utils/mp3Encoder';
import { parseColorToRgb, calculateShineProgress, drawAnimatedShine, invertTransformPoint } from './shineEngine';
import { ShineVectorPoint } from './types';
import { 
  applyTransparencyToImage, 
  isTransparencyActive, 
  DEFAULT_FADE_CONFIG, 
  DEFAULT_CROP_CONFIG, 
  DEFAULT_CROP_FEATHER 
} from './transparencyEngine';

const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

// Fast memory-safe base64 to Uint8Array converter
function base64ToUint8ArrayFast(dataUrl: string): Uint8Array {
  const cleanB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(cleanB64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface ExportContext {
  layer: EditableLayer;
  parents: EditableLayer[];
}

function buildExportContexts(layers: EditableLayer[], parents: EditableLayer[] = []): ExportContext[] {
  const result: ExportContext[] = [];
  for (const l of layers) {
    if (l.isMerged && l.mergedLayers && l.mergedLayers.length > 0) {
      result.push(...buildExportContexts(l.mergedLayers, [...parents, l]));
    } else {
      result.push({ layer: l, parents });
    }
  }
  return result;
}

export interface SvgaCompressionOptions {
  mode?: 'high' | 'medium' | 'low' | 'custom';
  quality?: number; // 10 to 100
  zlibLevel?: number; // 0 to 9 (0: store, 1: fastest, 6: balanced, 9: max compression)
  compressImages?: boolean;
}

/**
 * Helper to optionally compress image bytes using HTML5 Canvas WebP encoding
 */
async function optimizeImageBytes(bytes: Uint8Array, qualityRatio: number): Promise<Uint8Array> {
  if (bytes.length < 2048) return bytes; // Skip tiny images
  try {
    const blob = new Blob([bytes]);
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return bytes;
    ctx.drawImage(bmp, 0, 0);
    const q = Math.max(0.1, Math.min(1.0, qualityRatio));
    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', q);
    });
    if (compressedBlob && compressedBlob.size < bytes.length * 0.95) {
      const arr = await compressedBlob.arrayBuffer();
      return new Uint8Array(arr);
    }
    return bytes;
  } catch {
    return bytes;
  }
}

async function getFlippedImageBytes(
  originalBytes: Uint8Array,
  flipH: boolean,
  flipV: boolean
): Promise<Uint8Array> {
  try {
    const blob = new Blob([originalBytes]);
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return originalBytes;

    ctx.save();
    if (flipH && flipV) {
      ctx.translate(canvas.width, canvas.height);
      ctx.scale(-1, -1);
    } else if (flipH) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else if (flipV) {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(bmp, 0, 0);
    ctx.restore();

    const outBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    if (!outBlob) return originalBytes;
    return new Uint8Array(await outBlob.arrayBuffer());
  } catch {
    return originalBytes;
  }
}

/**
 * Generates an optimized, hardware-accelerated shine beam sprite for SVGA export
 */
async function generateShineSpriteForLayer(
  layer: EditableLayer,
  project: SVGAProjectData,
  exportImages: Record<string, Uint8Array>
): Promise<any | null> {
  const cfg = layer.shineConfig;
  if (!cfg || !cfg.enabled) return null;

  const totalFrames = project.totalFrames || 60;
  const fps = project.fps || 30;
  const beamWidth = cfg.beamWidth ?? 60;
  const style = cfg.style ?? 'soft';
  const color = cfg.color ?? '255, 255, 255';
  const opacity = cfg.opacity ?? 0.85;
  const featherSides = cfg.featherSides ?? 0.85;
  const featherTopBottom = cfg.featherTopBottom ?? 0.7;
  const direction = cfg.direction ?? 'forward';
  const speedMultiplier = cfg.speedMultiplier ?? 1.0;
  const durationSeconds = (cfg.durationSeconds ?? 2.0) / Math.max(0.1, speedMultiplier);
  const repeatInterval = cfg.repeatInterval ?? 0.5;
  const keyStart = cfg.keyframeStart ?? 0.0;
  const keyEnd = cfg.keyframeEnd ?? 1.0;

  // 1. Create beam image texture
  const diagonal = Math.hypot(project.width, project.height);
  const effBeamWidth = style === 'glow' ? Math.ceil(beamWidth * 1.6) : beamWidth;
  const offW = Math.max(16, Math.ceil(effBeamWidth * 3));
  const offH = Math.max(16, Math.ceil(diagonal * 1.8));

  const beamCanvas = document.createElement('canvas');
  beamCanvas.width = offW;
  beamCanvas.height = offH;
  const bCtx = beamCanvas.getContext('2d');
  if (!bCtx) return null;

  // Render beam profile onto beamCanvas
  const rgb = parseColorToRgb(color);
  const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const mid = offW / 2;
  const hGrad = bCtx.createLinearGradient(0, 0, offW, 0);

  if (style === 'double') {
    const coreW = (effBeamWidth * 0.25) * Math.max(0.1, featherSides);
    const wideW = (effBeamWidth * 0.75) * Math.max(0.1, featherSides);
    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - wideW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - wideW * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.3})`);
    hGrad.addColorStop(Math.max(0, (mid - coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.5})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.5})`);
    hGrad.addColorStop(Math.min(1, (mid + wideW * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.3})`);
    hGrad.addColorStop(Math.min(1, (mid + wideW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else if (style === 'sharp') {
    const coreW = Math.max(2, (effBeamWidth * 0.2) * Math.max(0.05, featherSides));
    const haloW = (effBeamWidth * 0.5) * Math.max(0.1, featherSides);
    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - haloW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(Math.min(1, (mid + haloW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else if (style === 'glow') {
    const r = (effBeamWidth * 1.2) * Math.max(0.2, featherSides);
    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - r) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - r * 0.4) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity * 0.95})`);
    hGrad.addColorStop(Math.min(1, (mid + r * 0.4) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(Math.min(1, (mid + r) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else {
    // Default 'soft'
    const r = (effBeamWidth * 0.6) * Math.max(0.1, featherSides);
    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - r) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + r) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  }

  bCtx.fillStyle = hGrad;
  bCtx.fillRect(0, 0, offW, offH);

  // Apply vertical feathering
  if (featherTopBottom > 0) {
    bCtx.globalCompositeOperation = 'destination-in';
    const vGrad = bCtx.createLinearGradient(0, 0, 0, offH);
    const fade = Math.min(0.45, 0.5 * featherTopBottom);
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(fade, 'rgba(0,0,0,1)');
    vGrad.addColorStop(1 - fade, 'rgba(0,0,0,1)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0)');
    bCtx.fillStyle = vGrad;
    bCtx.fillRect(0, 0, offW, offH);
    bCtx.globalCompositeOperation = 'source-over';
  }

  const beamBlob = await new Promise<Blob | null>(res => beamCanvas.toBlob(res, 'image/png'));
  if (!beamBlob) return null;
  const beamBytes = new Uint8Array(await beamBlob.arrayBuffer());
  const shineImageKey = `shine_beam_${layer.id}.png`;
  exportImages[shineImageKey] = beamBytes;

  // 2. Trajectory points
  const sPt = cfg.startPoint || {
    x: Math.round(layer.transform.x + layer.transform.width / 2),
    y: Math.max(0, Math.round(layer.transform.y - 30))
  };
  const ePt = cfg.endPoint || {
    x: Math.round(layer.transform.x + layer.transform.width / 2),
    y: Math.round(layer.transform.y + layer.transform.height + 30)
  };

  const dx = ePt.x - sPt.x;
  const dy = ePt.y - sPt.y;
  const pathLen = Math.hypot(dx, dy);
  const pathAngle = pathLen > 1 ? Math.atan2(dy, dx) : 0;
  const beamAngleRad = (pathLen <= 2 && cfg.angleDeg !== undefined)
    ? (cfg.angleDeg * Math.PI) / 180 + Math.PI / 2
    : pathAngle + Math.PI / 2;

  const cos = Math.cos(beamAngleRad);
  const sin = Math.sin(beamAngleRad);

  // 3. Build frames for the sprite
  const frames: any[] = [];
  const inFrame = layer.inFrame !== undefined ? layer.inFrame : 0;
  const outFrame = layer.outFrame !== undefined ? layer.outFrame : totalFrames - 1;

  for (let f = 0; f < totalFrames; f++) {
    if (f < inFrame || f > outFrame) {
      frames.push({
        alpha: 0,
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        layout: { x: -offW / 2, y: -offH / 2, width: offW, height: offH }
      });
      continue;
    }

    const { isActive, progress } = calculateShineProgress(f, totalFrames, fps, cfg);

    if (!isActive) {
      frames.push({
        alpha: 0,
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        layout: { x: -offW / 2, y: -offH / 2, width: offW, height: offH }
      });
      continue;
    }

    // Adjust for direction
    let dirProgress = progress;
    if (direction === 'reverse') {
      dirProgress = 1 - progress;
    } else if (direction === 'pingpong') {
      dirProgress = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    }

    const curX = sPt.x + dirProgress * dx;
    const curY = sPt.y + dirProgress * dy;

    frames.push({
      alpha: 1,
      transform: {
        a: cos,
        b: sin,
        c: -sin,
        d: cos,
        tx: curX,
        ty: curY
      },
      layout: {
        x: -offW / 2,
        y: -offH / 2,
        width: offW,
        height: offH
      }
    });
  }

  const shineSprite: any = {
    imageKey: shineImageKey,
    blendMode: 'screen',
    frames
  };

  if (cfg.maskToAlpha && layer.imageKey) {
    shineSprite.matteKey = layer.imageKey;
  }

  return shineSprite;
}

/**
 * Bakes the Shine Effect directly into the base layer frames (تسلسل صور مدمجة).
 * Guarantees 100% mathematical fidelity with canvas preview and seamless compatibility
 * with all mobile SVGA players without requiring advanced matte or blendMode support.
 */
async function bakeShineIntoLayerFrames(
  layer: EditableLayer,
  project: SVGAProjectData,
  exportImages: Record<string, Uint8Array>,
  spriteClone: any
): Promise<any[]> {
  const cfg = layer.shineConfig;
  if (!cfg || !cfg.enabled) return [spriteClone];

  const totalFrames = project.totalFrames || 60;
  const fps = project.fps || 30;
  const inFrame = layer.inFrame !== undefined ? layer.inFrame : 0;
  const outFrame = layer.outFrame !== undefined ? layer.outFrame : totalFrames - 1;

  // Resolve base image source
  const baseImgKey = layer.imageKey;
  let baseBlobUrl = project.imagesMap[baseImgKey];
  let revokeUrl = false;
  if (!baseBlobUrl) {
    const raw = exportImages[baseImgKey] || (project.rawImages && project.rawImages[baseImgKey]);
    if (raw) {
      baseBlobUrl = URL.createObjectURL(new Blob([raw], { type: 'image/png' }));
      revokeUrl = true;
    }
  }

  // If no base image at all, fallback to separate shine sprite
  if (!baseBlobUrl) {
    const separateSprite = await generateShineSpriteForLayer(layer, project, exportImages);
    return separateSprite ? [spriteClone, separateSprite] : [spriteClone];
  }

  const baseImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = baseBlobUrl;
  });

  if (revokeUrl) {
    URL.revokeObjectURL(baseBlobUrl);
  }

  if (!baseImg) {
    const separateSprite = await generateShineSpriteForLayer(layer, project, exportImages);
    return separateSprite ? [spriteClone, separateSprite] : [spriteClone];
  }

  const imgW = baseImg.naturalWidth || layer.transform.width || 200;
  const imgH = baseImg.naturalHeight || layer.transform.height || 200;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = imgW;
  offCanvas.height = imgH;
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return [spriteClone];

  const newFrameSprites: any[] = [];
  const bakedImageKeyMap: Record<number, string> = {};

  for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
    if (fIdx < inFrame || fIdx > outFrame) {
      continue;
    }

    const { isActive, progress } = calculateShineProgress(fIdx, totalFrames, fps, cfg);

    let activeFrameKey = baseImgKey;

    if (isActive) {
      ctx.clearRect(0, 0, imgW, imgH);
      ctx.drawImage(baseImg, 0, 0, imgW, imgH);

      // Layer transform matrix for inverted points
      const layerMatrix = spriteClone.frames[fIdx]?.transform ? [
        spriteClone.frames[fIdx].transform.a ?? 1,
        spriteClone.frames[fIdx].transform.b ?? 0,
        spriteClone.frames[fIdx].transform.c ?? 0,
        spriteClone.frames[fIdx].transform.d ?? 1,
        spriteClone.frames[fIdx].transform.tx ?? 0,
        spriteClone.frames[fIdx].transform.ty ?? 0
      ] as [number, number, number, number, number, number] : null;

      let localStart: ShineVectorPoint | undefined;
      let localEnd: ShineVectorPoint | undefined;
      if (cfg.startPoint && cfg.endPoint) {
        if (layerMatrix) {
          localStart = invertTransformPoint(cfg.startPoint.x, cfg.startPoint.y, layerMatrix);
          localEnd = invertTransformPoint(cfg.endPoint.x, cfg.endPoint.y, layerMatrix);
        } else {
          const sx = project.width > 0 ? imgW / project.width : 1;
          const sy = project.height > 0 ? imgH / project.height : 1;
          localStart = { x: cfg.startPoint.x * sx, y: cfg.startPoint.y * sy };
          localEnd = { x: cfg.endPoint.x * sx, y: cfg.endPoint.y * sy };
        }
      }

      drawAnimatedShine(ctx, imgW, imgH, progress, {
        beamWidth: cfg.beamWidth ?? 60,
        angleDeg: cfg.angleDeg ?? 90,
        opacity: cfg.opacity ?? 0.85,
        featherSides: cfg.featherSides ?? 0.85,
        featherTopBottom: cfg.featherTopBottom ?? 0.7,
        maskToAlpha: cfg.maskToAlpha ?? true,
        color: cfg.color ?? "255, 255, 255",
        style: cfg.style ?? 'soft',
        direction: cfg.direction ?? 'forward',
        localStartPoint: localStart,
        localEndPoint: localEnd
      });

      const blob = await new Promise<Blob | null>(res => offCanvas.toBlob(res, 'image/png'));
      if (blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        activeFrameKey = `shine_baked_${layer.id}_f${fIdx}.png`;
        exportImages[activeFrameKey] = bytes;
        bakedImageKeyMap[fIdx] = activeFrameKey;
      }
    }

    const frameSprite = JSON.parse(JSON.stringify(spriteClone));
    frameSprite.imageKey = activeFrameKey;
    frameSprite.frames = spriteClone.frames.map((fr: any, k: number) => {
      const cloneFr = { ...fr };
      if (k !== fIdx) {
        cloneFr.alpha = 0;
      }
      return cloneFr;
    });
    newFrameSprites.push(frameSprite);
  }

  return newFrameSprites.length > 0 ? newFrameSprites : [spriteClone];
}

/**
 * Exports the edited SVGA project with all animations, audios, and layer modifications preserved.
 * Optimized for high performance and large file support (no memory exhaustion).
 */
export async function exportEditedSvga(
  project: SVGAProjectData,
  layers: EditableLayer[],
  customFileName?: string,
  transparencyOptions?: {
    fadeConfig?: FadeConfig;
    cropConfig?: CropConfig;
    cropFeather?: CropFeather;
  },
  compressionOptions?: SvgaCompressionOptions
): Promise<{ blob: Blob; fileName: string }> {
  const exportMovie: any = {
    version: "2.0"
  };

  const exportImages: Record<string, Uint8Array> = {};

  if (project.rawImages) {
    for (const [key, bytes] of Object.entries(project.rawImages)) {
      if (bytes instanceof Uint8Array) {
        exportImages[key] = bytes;
      } else if (bytes && (bytes as any).buffer instanceof ArrayBuffer) {
        exportImages[key] = new Uint8Array((bytes as any).buffer);
      }
    }
  }

  if (project.imagesMap) {
    for (const [key, dataUrl] of Object.entries(project.imagesMap)) {
      if (!exportImages[key]) {
        if (dataUrl && dataUrl.startsWith('data:')) {
          try {
            exportImages[key] = base64ToUint8ArrayFast(dataUrl);
          } catch (e) {
            console.warn('Error converting dataUrl for key:', key, e);
          }
        } else if (dataUrl && dataUrl.startsWith('blob:')) {
          try {
            const res = await fetch(dataUrl);
            const ab = await res.arrayBuffer();
            exportImages[key] = new Uint8Array(ab);
          } catch (e) {
            console.warn('Could not fetch blob for key:', key, e);
          }
        }
      }
    }
  }

  // Ensure all layer thumbnails (e.g. newly mirrored layers or imported assets) are resolved into exportImages
  for (const l of layers) {
    if (l.imageKey && !exportImages[l.imageKey] && l.thumbnailUrl) {
      if (l.thumbnailUrl.startsWith('data:')) {
        try {
          exportImages[l.imageKey] = base64ToUint8ArrayFast(l.thumbnailUrl);
        } catch (e) {
          console.warn('Could not convert layer thumbnail to bytes:', l.name, e);
        }
      } else if (l.thumbnailUrl.startsWith('blob:')) {
        try {
          const res = await fetch(l.thumbnailUrl);
          const ab = await res.arrayBuffer();
          exportImages[l.imageKey] = new Uint8Array(ab);
        } catch (e) {
          console.warn('Could not fetch layer blob for key:', l.imageKey, e);
        }
      }
    }
  }

  if (project.audios && Array.isArray(project.audios)) {
    for (const track of project.audios) {
      const key = track.audioKey;
      let rawTrackBytes: Uint8Array | null = exportImages[key] || null;

      if (!rawTrackBytes) {
        if (project.rawImages && project.rawImages[key]) {
          const raw = project.rawImages[key];
          if (raw instanceof Uint8Array) {
            rawTrackBytes = raw;
          } else if ((raw as any)?.buffer instanceof ArrayBuffer) {
            rawTrackBytes = new Uint8Array((raw as any).buffer);
          }
        } else if (project.imagesMap && project.imagesMap[key]) {
          const src = project.imagesMap[key];
          if (src.startsWith('data:')) {
            try {
              rawTrackBytes = base64ToUint8ArrayFast(src);
            } catch (e) {}
          } else if (src.startsWith('blob:')) {
            try {
              const res = await fetch(src);
              const ab = await res.arrayBuffer();
              rawTrackBytes = new Uint8Array(ab);
            } catch (e) {}
          }
        }
      }

      if (rawTrackBytes && rawTrackBytes.length > 0) {
        exportImages[key] = ensureMp3WithId3(rawTrackBytes);
      }
    }
  }

  const exportContexts = buildExportContexts(layers);

  // Guarantee every layer has its image asset exported
  for (const ctx of exportContexts) {
    if (ctx.layer.isVideoSequence) {
      const pfx = ctx.layer.sequencePrefix || 'frame_';
      for (let fIdx = 0; fIdx < project.totalFrames; fIdx++) {
        const candidateKeys = [
          `${pfx}${fIdx}.png`,
          `${pfx}${fIdx}.jpg`,
          `${pfx}${fIdx}.jpeg`,
          `${pfx}${fIdx}.webp`,
          `${pfx}${fIdx}`
        ];
        const matchedK = candidateKeys.find(ck => 
          (project.rawImages && project.rawImages[ck]) || 
          (project.imagesMap && project.imagesMap[ck])
        ) || `${pfx}${fIdx}.png`;

        if (!exportImages[matchedK]) {
          if (project.rawImages && project.rawImages[matchedK]) {
            const raw = project.rawImages[matchedK];
            exportImages[matchedK] = raw instanceof Uint8Array ? raw : new Uint8Array((raw as any).buffer);
          } else if (project.imagesMap && project.imagesMap[matchedK]) {
            const src = project.imagesMap[matchedK];
            if (src.startsWith('data:')) {
              try {
                exportImages[matchedK] = base64ToUint8ArrayFast(src);
              } catch (e) {}
            }
          }
        }
      }
    }

    const key = ctx.layer.imageKey || ctx.layer.spriteRef?.imageKey;
    if (key && !exportImages[key]) {
      const src = ctx.layer.thumbnailUrl || (project.imagesMap && project.imagesMap[key]);
      if (src && src.startsWith('data:')) {
        try {
          exportImages[key] = base64ToUint8ArrayFast(src);
        } catch (e) {}
      } else if (src && src.startsWith('blob:')) {
        try {
          const res = await fetch(src);
          const ab = await res.arrayBuffer();
          exportImages[key] = new Uint8Array(ab);
        } catch (e) {}
      }
    }
  }

  // Apply Edge Fade and Advanced Crop to image assets if active
  const activeFade = transparencyOptions?.fadeConfig || project.fadeConfig || DEFAULT_FADE_CONFIG;
  const activeCrop = transparencyOptions?.cropConfig || project.cropConfig || DEFAULT_CROP_CONFIG;
  const activeFeather = transparencyOptions?.cropFeather || project.cropFeather || DEFAULT_CROP_FEATHER;

  if (isTransparencyActive(activeFade, activeCrop)) {
    const audioKeys = new Set((project.audios || []).map(a => a.audioKey));
    
    for (const [key, bytes] of Object.entries(exportImages)) {
      if (audioKeys.has(key)) {
        continue; // Protect audio tracks from image processing
      }
      
      const matchingCtx = exportContexts.find(c => c.layer.imageKey === key);
      const layerBounds = matchingCtx?.layer?.initialBounds || (matchingCtx ? {
        x: matchingCtx.layer.transform?.x || 0,
        y: matchingCtx.layer.transform?.y || 0,
        width: matchingCtx.layer.transform?.width || project.width,
        height: matchingCtx.layer.transform?.height || project.height
      } : undefined);

      try {
        const processedBytes = await applyTransparencyToImage(
          bytes,
          activeFade,
          activeCrop,
          activeFeather,
          layerBounds,
          project.width,
          project.height
        );
        exportImages[key] = processedBytes;
      } catch (err) {
        console.warn(`Could not apply transparency to image asset ${key}:`, err);
      }
    }
  }

  // Apply optional image compression if requested by the user
  const shouldCompressImages = Boolean(
    compressionOptions?.compressImages ||
    compressionOptions?.mode === 'low' ||
    (compressionOptions?.quality && compressionOptions.quality < 95)
  );
  if (shouldCompressImages) {
    const audioKeys = new Set((project.audios || []).map(a => a.audioKey));
    const qualityRatio = (compressionOptions?.quality ? compressionOptions.quality : (compressionOptions?.mode === 'low' ? 60 : 80)) / 100;
    for (const [key, bytes] of Object.entries(exportImages)) {
      if (audioKeys.has(key)) continue; // Never compress audio as images
      try {
        exportImages[key] = await optimizeImageBytes(bytes, qualityRatio);
      } catch (e) {
        console.warn(`Could not optimize image asset ${key}:`, e);
      }
    }
  }

  exportMovie.images = exportImages;

  const newSprites: any[] = [];
  const spritesToExport = [...exportContexts].reverse();

  for (const ctx of spritesToExport) {
    const layer = ctx.layer;
    if (!layer.visible) {
      continue;
    }
    
    // If any parent is hidden, hide this layer too
    if (ctx.parents.some(p => !p.visible)) {
      continue;
    }

    const spriteClone = layer.spriteRef ? JSON.parse(JSON.stringify(layer.spriteRef)) : {};
    let activeImageKey = layer.imageKey || spriteClone.imageKey;

    const baseAnimTransform = getLayerAnimatedTransform(layer, 0);
    const hasOriginalHFlip = Boolean(
      layer.isMirroredLayer ||
      (layer.originalSpriteFrames?.some((fr: any) => fr?.transform && fr.transform.a !== undefined && fr.transform.a < -0.01)) ||
      (layer.spriteRef?.frames?.some((fr: any) => fr?.transform && fr.transform.a !== undefined && fr.transform.a < -0.01))
    );
    const isFlipH = baseAnimTransform.scaleX < 0 || (hasOriginalHFlip && !(activeImageKey && activeImageKey.includes('_mirrored_')));
    const isFlipV = baseAnimTransform.scaleY < 0;
    const isAlreadyFlipped = Boolean(
      activeImageKey && (activeImageKey.includes('_mirrored_') || activeImageKey.startsWith('flipped_'))
    );

    if (!isAlreadyFlipped && (isFlipH || isFlipV) && activeImageKey) {
      if (!exportImages[activeImageKey]) {
        const raw = project.rawImages && project.rawImages[activeImageKey];
        if (raw instanceof Uint8Array) {
          exportImages[activeImageKey] = raw;
        } else if ((raw as any)?.buffer instanceof ArrayBuffer) {
          exportImages[activeImageKey] = new Uint8Array((raw as any).buffer);
        } else {
          const src = layer.thumbnailUrl || (project.imagesMap && project.imagesMap[activeImageKey]);
          if (src && src.startsWith('data:')) {
            try { exportImages[activeImageKey] = base64ToUint8ArrayFast(src); } catch {}
          }
        }
      }

      if (exportImages[activeImageKey]) {
        const flippedKey = `flipped_${isFlipH ? 'h' : ''}${isFlipV ? 'v' : ''}_${activeImageKey}`;
        if (!exportImages[flippedKey]) {
          try {
            exportImages[flippedKey] = await getFlippedImageBytes(exportImages[activeImageKey], isFlipH, isFlipV);
          } catch (e) {
            console.warn('Could not generate flipped image bytes for layer:', layer.name, e);
          }
        }
        if (exportImages[flippedKey]) {
          activeImageKey = flippedKey;
        }
      }
    }

    spriteClone.imageKey = activeImageKey;
    if (layer.matteKey) {
      spriteClone.matteKey = layer.matteKey;
    } else {
      delete spriteClone.matteKey;
    }
    if (layer.blendMode) {
      spriteClone.blendMode = layer.blendMode;
    }

    const initialBounds = layer.initialBounds || { x: 0, y: 0, width: 100, height: 100 };
    const pivotX = initialBounds.x + initialBounds.width / 2;
    const pivotY = initialBounds.y + initialBounds.height / 2;

    if (!spriteClone.frames || !Array.isArray(spriteClone.frames) || spriteClone.frames.length === 0) {
      spriteClone.frames = Array.from({ length: project.totalFrames }, () => ({
        alpha: 1,
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        layout: { 
          x: initialBounds.x, 
          y: initialBounds.y, 
          width: initialBounds.width, 
          height: initialBounds.height 
        }
      }));
    } else if (spriteClone.frames.length < project.totalFrames) {
      // Loop or extend frames to ensure complete playback for repeated layers across full duration
      const origLen = spriteClone.frames.length;
      const expanded: any[] = [];
      for (let f = 0; f < project.totalFrames; f++) {
        if (f < origLen) {
          expanded.push(spriteClone.frames[f]);
        } else if (origLen === 1) {
          expanded.push(JSON.parse(JSON.stringify(spriteClone.frames[0])));
        } else if (origLen > 0) {
          expanded.push(JSON.parse(JSON.stringify(spriteClone.frames[f % origLen])));
        }
      }
      spriteClone.frames = expanded;
    }

    if (spriteClone.frames && Array.isArray(spriteClone.frames)) {
      spriteClone.frames = spriteClone.frames.map((frame: any, frameIdx: number) => {
        if (!frame) return frame;
        const newFrame = { ...frame };

        let totalA = 1, totalB = 0, totalC = 0, totalD = 1, totalTx = 0, totalTy = 0;
        let globalAlphaMul = 1;

        // Start with the layer's own animated transform
        const inFrame = layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0);
        const outFrame = layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (project.totalFrames - 1));
        if (frameIdx < inFrame || frameIdx > outFrame) {
          globalAlphaMul = 0;
        }

        const animTransform = getLayerAnimatedTransform(layer, frameIdx);
        const { x, y, scaleX, scaleY, rotation, opacity } = animTransform;
        
        const deltaX = x - initialBounds.x;
        const deltaY = y - initialBounds.y;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        globalAlphaMul *= Math.max(0, Math.min(1, opacity / 100));

        const absScaleX = Math.abs(scaleX);
        const absScaleY = Math.abs(scaleY);

        let uA = absScaleX * cos;
        let uB = absScaleX * sin;
        let uC = -absScaleY * sin;
        let uD = absScaleY * cos;
        let uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
        let uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);

        totalA = uA;
        totalB = uB;
        totalC = uC;
        totalD = uD;
        totalTx = uTx;
        totalTy = uTy;

        // Apply parent transforms from bottom up (closest parent to highest ancestor)
        // ctx.parents is ordered from root to immediate parent. So we iterate backwards.
        for (let i = ctx.parents.length - 1; i >= 0; i--) {
          const pLayer = ctx.parents[i];
          const pBounds = pLayer.initialBounds || { x: 0, y: 0, width: 100, height: 100 };
          const pPivotX = pBounds.x + pBounds.width / 2;
          const pPivotY = pBounds.y + pBounds.height / 2;

          const pAnim = getLayerAnimatedTransform(pLayer, frameIdx);
          const pDeltaX = pAnim.x - pBounds.x;
          const pDeltaY = pAnim.y - pBounds.y;
          const pRad = (pAnim.rotation * Math.PI) / 180;
          const pCos = Math.cos(pRad);
          const pSin = Math.sin(pRad);

          globalAlphaMul *= Math.max(0, Math.min(1, pAnim.opacity / 100));

          const pA = pAnim.scaleX * pCos;
          const pB = pAnim.scaleX * pSin;
          const pC = -pAnim.scaleY * pSin;
          const pD = pAnim.scaleY * pCos;
          const pTx = (pPivotX + pDeltaX) - (pA * pPivotX + pC * pPivotY);
          const pTy = (pPivotY + pDeltaY) - (pB * pPivotX + pD * pPivotY);

          // Multiply Parent Matrix * Current Total Matrix
          const nA = pA * totalA + pC * totalB;
          const nB = pB * totalA + pD * totalB;
          const nC = pA * totalC + pC * totalD;
          const nD = pB * totalC + pD * totalD;
          const nTx = pA * totalTx + pC * totalTy + pTx;
          const nTy = pB * totalTx + pD * totalTy + pTy;

          totalA = nA;
          totalB = nB;
          totalC = nC;
          totalD = nD;
          totalTx = nTx;
          totalTy = nTy;
        }

        const hasUserTransform = totalA !== 1 || totalB !== 0 || totalC !== 0 || totalD !== 1 || totalTx !== 0 || totalTy !== 0;

        if (newFrame.alpha !== undefined) {
          newFrame.alpha = parseFloat((newFrame.alpha * globalAlphaMul).toFixed(3));
        } else if (globalAlphaMul < 1) {
          newFrame.alpha = globalAlphaMul;
        }

        if (hasUserTransform) {
          const currTransform = newFrame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
          const fA = currTransform.a !== undefined ? currTransform.a : 1;
          const fB = currTransform.b !== undefined ? currTransform.b : 0;
          const fC = currTransform.c !== undefined ? currTransform.c : 0;
          const fD = currTransform.d !== undefined ? currTransform.d : 1;
          const fTx = currTransform.tx !== undefined ? currTransform.tx : 0;
          const fTy = currTransform.ty !== undefined ? currTransform.ty : 0;

          // Combined matrix T_final = T_total_user * T_frame
          const newA = totalA * fA + totalC * fB;
          const newB = totalB * fA + totalD * fB;
          const newC = totalA * fC + totalC * fD;
          const newD = totalB * fC + totalD * fD;
          const newTx = totalA * fTx + totalC * fTy + totalTx;
          const newTy = totalB * fTx + totalD * fTy + totalTy;

          newFrame.transform = {
            a: parseFloat(newA.toFixed(5)),
            b: parseFloat(newB.toFixed(5)),
            c: parseFloat(newC.toFixed(5)),
            d: parseFloat(newD.toFixed(5)),
            tx: parseFloat(newTx.toFixed(2)),
            ty: parseFloat(newTy.toFixed(2))
          };
        }

        if (layer.blendMode && !newFrame.blendMode) {
          newFrame.blendMode = layer.blendMode;
        }

        return newFrame;
      });
    }

    if (layer.isVideoSequence) {
      const pfx = layer.sequencePrefix || 'frame_';
      for (let fIdx = 0; fIdx < project.totalFrames; fIdx++) {
        const candidateKeys = [
          `${pfx}${fIdx}.png`,
          `${pfx}${fIdx}.jpg`,
          `${pfx}${fIdx}.jpeg`,
          `${pfx}${fIdx}.webp`,
          `${pfx}${fIdx}`
        ];
        const matchedKey = candidateKeys.find(ck => 
          (project.rawImages && project.rawImages[ck]) || 
          (project.imagesMap && project.imagesMap[ck]) ||
          exportImages[ck]
        ) || `${pfx}${fIdx}.png`;

        const frameSprite = JSON.parse(JSON.stringify(spriteClone));
        frameSprite.imageKey = matchedKey;
        frameSprite.frames = spriteClone.frames.map((fr: any, k: number) => {
          const cloneFr = { ...fr };
          if (k !== fIdx) {
            cloneFr.alpha = 0;
          }
          return cloneFr;
        });
        newSprites.push(frameSprite);
      }
    } else if (layer.shineConfig && layer.shineConfig.enabled && (layer.shineConfig.exportMode === 'merge' || layer.shineExportMode === 'merge') && !layer.isShineLayer) {
      // MODE 1: Merge Shine with Base Layer Frames (Bake into layer frame sequence)
      try {
        const bakedSprites = await bakeShineIntoLayerFrames(layer, project, exportImages, spriteClone);
        newSprites.push(...bakedSprites);
      } catch (err) {
        console.warn(`Could not bake shine for layer ${layer.name}, falling back to standard sprite:`, err);
        newSprites.push(spriteClone);
      }
    } else {
      // Standard layer export
      if (!layer.isShineLayer) {
        newSprites.push(spriteClone);
      }
    }

    // MODE 2: Separate Shine Layer Sprite (hardware accelerated beam with matteKey or standalone)
    if (layer.shineConfig && layer.shineConfig.enabled) {
      const isSeparate = layer.shineConfig.exportMode === 'separate' || layer.shineExportMode === 'separate' || layer.isShineLayer;
      if (isSeparate) {
        try {
          const shineSprite = await generateShineSpriteForLayer(layer, project, exportImages);
          if (shineSprite) {
            newSprites.push(shineSprite);
          }
        } catch (err) {
          console.warn(`Could not generate shine sprite for layer ${layer.name}:`, err);
        }
      }
    }
  }

  // Embed comprehensive project metadata into the SVGA binary so shine and layer configs never disappear
  try {
    const metaObj = {
      version: 2,
      savedAt: Date.now(),
      layers: layers.map(l => ({
        id: l.id,
        imageKey: l.imageKey,
        name: l.name,
        isShineLayer: l.isShineLayer,
        shineExportMode: l.shineExportMode || l.shineConfig?.exportMode,
        shineConfig: l.shineConfig,
        linkedMirroredLayerId: l.linkedMirroredLayerId,
        isMirroredLayer: l.isMirroredLayer,
        autoSyncMirroredAsset: l.autoSyncMirroredAsset,
        autoFlipMirroredAsset: l.autoFlipMirroredAsset
      })),
      fadeConfig: transparencyOptions?.fadeConfig,
      cropConfig: transparencyOptions?.cropConfig,
      cropFeather: transparencyOptions?.cropFeather
    };
    exportImages['__svga_editor_meta__.json'] = new TextEncoder().encode(JSON.stringify(metaObj));
  } catch (e) {
    console.warn('Failed to embed editor metadata:', e);
  }

  // Ensure every sprite has its imageKey in exportImages if available
  for (const s of newSprites) {
    const k = s.imageKey;
    if (k && !exportImages[k]) {
      const cleanK = k.replace(/\.(png|jpe?g|webp|svg)$/i, '');
      const found = exportImages[cleanK] || 
                    exportImages[`${cleanK}.png`] || 
                    exportImages[k.toLowerCase()] || 
                    exportImages[`img_${cleanK}`];
      if (found) {
        exportImages[k] = found;
      }
    }
  }

  exportMovie.sprites = newSprites;
  exportMovie.images = exportImages;

  exportMovie.audios = (project.audios || []).map((a: any) => ({
    audioKey: a.audioKey,
    startFrame: Math.max(0, Math.round(a.startFrame || 0)),
    endFrame: Math.max(Math.round(a.startFrame || 0) + 1, Math.round(a.endFrame || project.totalFrames || 60)),
    startTime: Math.max(0, Math.round(a.startTime || 0)),
    totalTime: Math.max(10, Math.round(a.totalTime || ((project.totalFrames || 60) / (project.fps || 30)) * 1000))
  }));

  exportMovie.params = {
    viewBoxWidth: project.width,
    viewBoxHeight: project.height,
    fps: project.fps,
    frames: project.totalFrames
  };

  console.log('Export Movie Debug:', {
    version: exportMovie.version,
    spritesCount: exportMovie.sprites?.length,
    imagesCount: Object.keys(exportMovie.images || {}).length,
    params: exportMovie.params
  });

  const errMsg = MovieEntity.verify(exportMovie);
  if (errMsg) {
    console.warn(`Protobuf verification warning: ${errMsg}`);
  }

  const message = MovieEntity.create(exportMovie);
  const encodedBuffer = MovieEntity.encode(message).finish();

  // Determine zlib compression level (0 - 9)
  let targetZlibLevel: pako.DeflateFunctionOptions["level"] = 6;
  if (typeof compressionOptions?.zlibLevel === 'number') {
    targetZlibLevel = Math.max(0, Math.min(9, Math.round(compressionOptions.zlibLevel))) as any;
  } else if (compressionOptions?.mode === 'low') {
    targetZlibLevel = 9; // maximum compression
  } else if (compressionOptions?.mode === 'medium') {
    targetZlibLevel = 6; // balanced
  } else if (compressionOptions?.mode === 'high') {
    targetZlibLevel = 6; // standard lossless
  }

  const deflated = pako.deflate(encodedBuffer, { level: targetZlibLevel });
  const blob = new Blob([deflated], { type: 'application/octet-stream' });

  const finalName = customFileName 
    ? (customFileName.endsWith('.svga') ? customFileName : `${customFileName}.svga`)
    : project.fileName.replace(/\.svga$/i, '') + '_edited.svga';

  return { blob, fileName: finalName };
}
