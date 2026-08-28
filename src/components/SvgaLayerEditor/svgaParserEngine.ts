import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData } from './types';

const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

// Helper to get natural dimensions of an image from dataURL
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 100, height: img.naturalHeight || 100 });
    };
    img.onerror = () => {
      resolve({ width: 100, height: 100 });
    };
    img.src = dataUrl;
  });
}

export async function parseSvgaToProject(file: File): Promise<{
  project: SVGAProjectData;
  layers: EditableLayer[];
}> {
  const buffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(buffer);

  // Check for ZIP signature (SVGA 1.0)
  const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && uint8Array[2] === 0x03 && uint8Array[3] === 0x04;
  if (isZip) {
    throw new Error('الملف بصيغة SVGA 1.0 (ZIP القديمة). يرجى استخدام ملف SVGA 2.0.');
  }

  let inflated: Uint8Array;
  try {
    inflated = pako.inflate(uint8Array);
  } catch {
    try {
      inflated = pako.inflateRaw(uint8Array);
    } catch {
      inflated = uint8Array;
    }
  }

  const decoded = MovieEntity.decode(inflated);
  const movie = MovieEntity.toObject(decoded, {
    keepCase: true,
    longs: Number,
    enums: Number,
    bytes: Uint8Array,
    defaults: false,
    arrays: true,
    objects: true,
    oneofs: true
  } as any);

  const width = Math.round(movie.params?.viewBoxWidth || 500);
  const height = Math.round(movie.params?.viewBoxHeight || 500);
  const fps = Math.max(1, Math.round(movie.params?.fps || 30));
  const totalFrames = Math.max(1, Math.round(movie.params?.frames || 60));
  const durationSec = parseFloat((totalFrames / fps).toFixed(2));

  // Extract raw images and dataURLs
  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};
  const imageDimensions: Record<string, { width: number; height: number }> = {};

  if (movie.images) {
    for (const [key, val] of Object.entries(movie.images)) {
      if (typeof val === 'string') {
        const url = (val as string).startsWith('data:') ? (val as string) : `data:image/png;base64,${val}`;
        imagesMap[key] = url;
        const b64 = url.split(',')[1] || url;
        const bin = atob(b64);
        const b = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        rawImages[key] = b;
      } else if (val instanceof Uint8Array || Array.isArray(val)) {
        const bytes = val instanceof Uint8Array ? val : new Uint8Array(val);
        rawImages[key] = bytes;
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        imagesMap[key] = `data:image/png;base64,${btoa(binary)}`;
      }
    }

    // Preload image dimensions
    await Promise.all(
      Object.entries(imagesMap).map(async ([key, url]) => {
        const dims = await getImageDimensions(url);
        imageDimensions[key] = dims;
      })
    );
  }

  const project: SVGAProjectData = {
    fileName: file.name,
    fileSize: file.size,
    width,
    height,
    fps,
    totalFrames,
    durationSec,
    imagesMap,
    rawImages,
    audios: movie.audios || [],
    rawMovie: movie
  };

  // Build Editable Layers from Sprites
  const layers: EditableLayer[] = [];
  const sprites = movie.sprites || [];

  sprites.forEach((sprite: any, idx: number) => {
    const imageKey = sprite.imageKey || `layer_${idx}`;
    const frames = sprite.frames || [];
    const imgDims = imageDimensions[imageKey] || { width: 100, height: 100 };
    
    // Check if sprite has any explicit alpha > 0
    const hasAnyExplicitAlpha = frames.some((fr: any) => fr && fr.alpha !== undefined && fr.alpha > 0.005);

    // Helper to determine if a frame is active
    const isFrameActive = (fr: any): boolean => {
      if (!fr) return false;
      if (hasAnyExplicitAlpha) {
        return fr.alpha !== undefined && fr.alpha > 0.005;
      }
      return fr.alpha === undefined || fr.alpha > 0.005;
    };

    // Find representative layout and keyframe bounds
    let initialX = 0;
    let initialY = 0;
    let initialW = imgDims.width;
    let initialH = imgDims.height;
    let hasFoundValidBounds = false;
    let startFrame = 0;
    let endFrame = frames.length > 0 ? frames.length - 1 : totalFrames - 1;
    let hasShapes = false;
    let hasTransform = false;

    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f];
      if (!fr) continue;
      
      if (fr.shapes && fr.shapes.length > 0) hasShapes = true;
      if (fr.transform) hasTransform = true;

      const active = isFrameActive(fr);

      if (!hasFoundValidBounds && active) {
        const tx = fr.transform?.tx ?? 0;
        const ty = fr.transform?.ty ?? 0;
        const lx = fr.layout?.x ?? 0;
        const ly = fr.layout?.y ?? 0;
        const lw = fr.layout?.width;
        const lh = fr.layout?.height;

        initialX = tx + lx;
        initialY = ty + ly;
        initialW = (lw && lw > 0) ? lw : imgDims.width;
        initialH = (lh && lh > 0) ? lh : imgDims.height;
        hasFoundValidBounds = true;
        startFrame = f;
      }

      if (active) {
        endFrame = f;
      }
    }

    // Fallback if no active frame found
    if (!hasFoundValidBounds && frames.length > 0) {
      const firstFr = frames[0] || {};
      initialX = (firstFr.transform?.tx ?? 0) + (firstFr.layout?.x ?? 0);
      initialY = (firstFr.transform?.ty ?? 0) + (firstFr.layout?.y ?? 0);
      initialW = (firstFr.layout?.width && firstFr.layout.width > 0) ? firstFr.layout.width : imgDims.width;
      initialH = (firstFr.layout?.height && firstFr.layout.height > 0) ? firstFr.layout.height : imgDims.height;
    }

    // Determine layer type
    let layerType: 'image' | 'shape' | 'composite' = 'image';
    if (hasShapes && !imagesMap[imageKey]) {
      layerType = 'shape';
    } else if (hasShapes && imagesMap[imageKey]) {
      layerType = 'composite';
    }

    const layerName = sprite.imageKey ? sprite.imageKey : `Layer_${idx + 1}`;

    layers.push({
      id: `layer_${idx}_${imageKey}`,
      originalIndex: idx,
      imageKey,
      name: layerName,
      type: layerType,
      visible: true,
      locked: true,
      thumbnailUrl: imagesMap[imageKey] || undefined,
      transform: {
        x: initialX,
        y: initialY,
        width: initialW,
        height: initialH,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 100
      },
      initialBounds: {
        x: initialX,
        y: initialY,
        width: initialW,
        height: initialH
      },
      aspectRatioLocked: true,
      spriteRef: sprite,
      matteKey: sprite.matteKey,
      framesCount: frames.length,
      keyframeSummary: {
        startFrame,
        endFrame,
        hasShapes,
        hasTransform
      }
    });
  });

  return { project, layers };
}

/**
 * Creates a brand new, empty SVGA project with custom dimensions, FPS, and frames count.
 */
export function createNewSvgaProject(options: {
  name?: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}): { project: SVGAProjectData; layers: EditableLayer[] } {
  const width = Math.max(10, Math.min(4000, Math.round(options.width || 750)));
  const height = Math.max(10, Math.min(4000, Math.round(options.height || 1334)));
  const fps = Math.max(1, Math.min(120, Math.round(options.fps || 30)));
  const durationSec = Math.max(0.1, Math.min(60, options.durationSec || 2));
  const totalFrames = Math.max(1, Math.min(3600, Math.round(durationSec * fps)));
  const fileName = options.name ? (options.name.endsWith('.svga') ? options.name : `${options.name}.svga`) : 'new_project.svga';

  const rawMovie: any = {
    version: "2.0",
    params: {
      viewBoxWidth: width,
      viewBoxHeight: height,
      fps: fps,
      frames: totalFrames
    },
    images: {},
    sprites: [],
    audios: []
  };

  const project: SVGAProjectData = {
    fileName,
    fileSize: 0,
    width,
    height,
    fps,
    totalFrames,
    durationSec: totalFrames / fps,
    imagesMap: {},
    rawImages: {},
    audios: [],
    rawMovie
  };

  return { project, layers: [] };
}
