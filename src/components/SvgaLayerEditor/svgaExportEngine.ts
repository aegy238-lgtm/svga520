import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData, FadeConfig, CropConfig, CropFeather } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { ensureMp3WithId3 } from '../../utils/mp3Encoder';
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
    spriteClone.imageKey = layer.imageKey || spriteClone.imageKey;
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

        let uA = scaleX * cos;
        let uB = scaleX * sin;
        let uC = -scaleY * sin;
        let uD = scaleY * cos;
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
    } else {
      newSprites.push(spriteClone);
    }
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
