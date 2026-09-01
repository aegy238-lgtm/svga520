import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { ensureMp3WithId3 } from '../../utils/mp3Encoder';

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

/**
 * Exports the edited SVGA project with all animations, audios, and layer modifications preserved.
 * Optimized for high performance and large file support (no memory exhaustion).
 */
export async function exportEditedSvga(
  project: SVGAProjectData,
  layers: EditableLayer[],
  customFileName?: string
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

  exportMovie.images = exportImages;

  const newSprites: any[] = [];

  const exportContexts = buildExportContexts(layers);
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
    spriteClone.imageKey = layer.imageKey;
    if (layer.matteKey) {
      spriteClone.matteKey = layer.matteKey;
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
    }

    if (spriteClone.frames && Array.isArray(spriteClone.frames)) {
      spriteClone.frames = spriteClone.frames.map((frame: any, frameIdx: number) => {
        if (!frame) return frame;
        const newFrame = { ...frame };

        let totalA = 1, totalB = 0, totalC = 0, totalD = 1, totalTx = 0, totalTy = 0;
        let globalAlphaMul = 1;

        // Start with the layer's own animated transform
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

        return newFrame;
      });
    }

    newSprites.push(spriteClone);
  }

  exportMovie.sprites = newSprites;

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

  const errMsg = MovieEntity.verify(exportMovie);
  if (errMsg) {
    console.warn(`Protobuf verification warning: ${errMsg}`);
  }

  const message = MovieEntity.create(exportMovie);
  const encodedBuffer = MovieEntity.encode(message).finish();

  const deflated = pako.deflate(encodedBuffer, { level: 6 });
  const blob = new Blob([deflated], { type: 'application/octet-stream' });

  const finalName = customFileName 
    ? (customFileName.endsWith('.svga') ? customFileName : `${customFileName}.svga`)
    : project.fileName.replace(/\.svga$/i, '') + '_edited.svga';

  return { blob, fileName: finalName };
}
