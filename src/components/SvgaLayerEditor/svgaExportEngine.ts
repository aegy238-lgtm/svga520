import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { ensureMp3WithId3 } from '../../utils/mp3Encoder';

const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

/**
 * Exports the edited SVGA project with all animations, audios, and layer modifications preserved.
 */
export async function exportEditedSvga(
  project: SVGAProjectData,
  layers: EditableLayer[],
  customFileName?: string
): Promise<{ blob: Blob; fileName: string }> {
  const exportMovie: any = JSON.parse(JSON.stringify(project.rawMovie));

  // Explicitly set SVGA 2.0 version string
  exportMovie.version = "2.0";

  // 1. Prepare images dictionary preserving raw audio and binary assets, updating replaced images
  const exportImages: Record<string, Uint8Array> = {};

  // First copy all raw images and audio files intact
  if (project.rawImages) {
    for (const [key, bytes] of Object.entries(project.rawImages)) {
      if (bytes instanceof Uint8Array) {
        exportImages[key] = bytes;
      } else if (bytes && (bytes as any).buffer instanceof ArrayBuffer) {
        exportImages[key] = new Uint8Array((bytes as any).buffer);
      }
    }
  }

  // Then encode any updated images from imagesMap
  for (const [key, dataUrl] of Object.entries(project.imagesMap)) {
    if (dataUrl && dataUrl.startsWith('data:')) {
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        exportImages[key] = bytes;
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

  // Ensure all embedded audio tracks have their binary bytes present in exportImages and are ID3 tagged
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
            const b64 = src.split(',')[1];
            if (b64) {
              const bin = atob(b64);
              const b = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
              rawTrackBytes = b;
            }
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

  // 2. Prepare Sprites according to layers list
  // Notice: In SVGA protobuf, sprites array is rendered 0 -> N (bottom to top).
  // Preserving all motion paths, frame transforms, vector shapes, alpha, clipPath, and matteKeys
  const newSprites: any[] = [];

  for (const layer of layers) {
    if (!layer.visible) {
      // If user completely hid the layer, we omit it from output
      continue;
    }

    // Clone the original sprite definition
    const spriteClone = JSON.parse(JSON.stringify(layer.spriteRef || {}));
    spriteClone.imageKey = layer.imageKey;
    if (layer.matteKey) {
      spriteClone.matteKey = layer.matteKey;
    }

    const initialBounds = layer.initialBounds;
    const pivotX = initialBounds.x + initialBounds.width / 2;
    const pivotY = initialBounds.y + initialBounds.height / 2;

    // If frames are missing or empty (e.g. newly created layer), populate default frames
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

    // Update each frame in sprite (evaluating keyframe animation per frame)
    if (spriteClone.frames && Array.isArray(spriteClone.frames)) {
      spriteClone.frames = spriteClone.frames.map((frame: any, frameIdx: number) => {
        if (!frame) return frame;
        const newFrame = { ...frame };

        // Calculate animated transform at this exact frame
        const animTransform = getLayerAnimatedTransform(layer, frameIdx);
        const { x, y, scaleX, scaleY, rotation, opacity } = animTransform;

        const deltaX = x - initialBounds.x;
        const deltaY = y - initialBounds.y;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const globalAlphaMul = Math.max(0, Math.min(1, opacity / 100));

        const hasUserTransform = deltaX !== 0 || deltaY !== 0 || scaleX !== 1 || scaleY !== 1 || rotation !== 0;

        // Adjust alpha
        if (newFrame.alpha !== undefined) {
          newFrame.alpha = parseFloat((newFrame.alpha * globalAlphaMul).toFixed(3));
        } else if (globalAlphaMul < 1) {
          newFrame.alpha = globalAlphaMul;
        }

        // Adjust Transform Matrix according to SVGAPlayer affine math
        if (hasUserTransform) {
          const currTransform = newFrame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
          const fA = currTransform.a !== undefined ? currTransform.a : 1;
          const fB = currTransform.b !== undefined ? currTransform.b : 0;
          const fC = currTransform.c !== undefined ? currTransform.c : 0;
          const fD = currTransform.d !== undefined ? currTransform.d : 1;
          const fTx = currTransform.tx !== undefined ? currTransform.tx : 0;
          const fTy = currTransform.ty !== undefined ? currTransform.ty : 0;

          // User affine transformation around pivot:
          const uA = scaleX * cos;
          const uB = scaleX * sin;
          const uC = -scaleY * sin;
          const uD = scaleY * cos;
          const uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
          const uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);

          // Combined matrix T_final = T_user * T_frame
          const newA = uA * fA + uC * fB;
          const newB = uB * fA + uD * fB;
          const newC = uA * fC + uC * fD;
          const newD = uB * fC + uD * fD;
          const newTx = uA * fTx + uC * fTy + uTx;
          const newTy = uB * fTx + uD * fTy + uTy;

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

  // 3. Preserve Audios and Params precisely
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

  // 4. Verify & Encode Protobuf with SVGA 2.0 MovieEntity schema
  const errMsg = MovieEntity.verify(exportMovie);
  if (errMsg) {
    throw new Error(`Protobuf verification failed: ${errMsg}`);
  }

  const message = MovieEntity.fromObject(exportMovie);
  const encodedBuffer = MovieEntity.encode(message).finish();

  // 5. Deflate compression (zlib standard RFC 1950)
  const deflated = pako.deflate(encodedBuffer, { level: 9 });
  const blob = new Blob([deflated], { type: 'application/octet-stream' });

  const finalName = customFileName 
    ? (customFileName.endsWith('.svga') ? customFileName : `${customFileName}.svga`)
    : project.fileName.replace(/\.svga$/i, '') + '_edited.svga';

  return { blob, fileName: finalName };
}
