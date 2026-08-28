import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData } from './types';
import { getLayerAnimatedTransform } from './motionEngine';

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
  exportMovie.audios = project.audios || [];
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
