import pako from 'pako';
import protobuf from 'protobufjs';
import { svgaSchema } from '../../svga-proto';
import { EditableLayer, SVGAProjectData } from './types';

const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");

// Memory-safe Uint8Array <-> Base64 helpers with chunking to prevent stack/memory crash on large files
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanB64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(cleanB64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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

  // Critical SVGA 2.0 Fidelity: Protobuf toObject with defaults:false strips numeric 0 values,
  // which causes frame.alpha to be undefined for inactive/hidden frames (alpha: 0).
  // In the raw protobuf decoded message, alpha is explicitly decoded as 0, 1, or fractional float.
  // We restore and preserve each frame's exact alpha value from decoded.
  if ((decoded as any).sprites && Array.isArray((decoded as any).sprites) && movie.sprites) {
    for (let s = 0; s < (decoded as any).sprites.length; s++) {
      const decSprite = (decoded as any).sprites[s];
      const movSprite = movie.sprites[s];
      if (decSprite && movSprite && decSprite.frames && movSprite.frames) {
        // Detect if this sprite has ANY frame with alpha > 0 in decoded data
        const hasPositiveAlpha = decSprite.frames.some((f: any) => typeof f.alpha === 'number' && f.alpha > 0.005);
        for (let f = 0; f < decSprite.frames.length; f++) {
          const decFrame = decSprite.frames[f];
          const movFrame = movSprite.frames[f];
          if (decFrame && movFrame) {
            if (typeof decFrame.alpha === 'number') {
              movFrame.alpha = decFrame.alpha;
            } else if (hasPositiveAlpha) {
              movFrame.alpha = 0;
            }
          }
        }
      }
    }
  }

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
        rawImages[key] = base64ToUint8Array(url);
      } else if (val instanceof Uint8Array || Array.isArray(val)) {
        const bytes = val instanceof Uint8Array ? val : new Uint8Array(val);
        rawImages[key] = bytes;
        imagesMap[key] = `data:image/png;base64,${uint8ArrayToBase64(bytes)}`;
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
  // Note: In SVGA Protobuf, sprites array is ordered 0 (background) to N-1 (foreground).
  // In graphic editors (Photoshop / After Effects / Figma), layers[0] represents the TOP-most (foreground) layer.
  // We reverse the array so layers[0] is at the top of the layer stack and stays in front.
  const layers: EditableLayer[] = [];
  const rawSprites = movie.sprites || [];
  const sprites = [...rawSprites].reverse();

  // Count identical imageKeys to identify repeated layers/sequences in SVGA 2.0
  const imageKeyCounts: Record<string, number> = {};
  const sequencePrefixGroups: Record<string, number[]> = {};

  sprites.forEach((s: any, sIdx: number) => {
    const k = s.imageKey || '';
    if (k) {
      imageKeyCounts[k] = (imageKeyCounts[k] || 0) + 1;
      // Also detect numbered sequence pattern like img_01, frame_02, etc.
      const match = k.match(/^(.*?)_?(\d+)(\.[a-z0-9]+)?$/i);
      if (match) {
        const prefix = match[1] || 'seq';
        if (!sequencePrefixGroups[prefix]) sequencePrefixGroups[prefix] = [];
        sequencePrefixGroups[prefix].push(sIdx);
      }
    }
  });
  const imageKeyIndexTracker: Record<string, number> = {};

  sprites.forEach((sprite: any, idx: number) => {
    const originalIndex = rawSprites.length - 1 - idx;
    const imageKey = sprite.imageKey || `layer_${originalIndex}`;
    const frames = sprite.frames || [];

    // Helper to find image dimensions with fuzzy fallback
    let imgDims = imageDimensions[imageKey];
    if (!imgDims) {
      const cleanKey = imageKey.replace(/\.(png|jpe?g|webp|svg)$/i, '');
      imgDims = imageDimensions[cleanKey] || 
                imageDimensions[`${cleanKey}.png`] || 
                imageDimensions[imageKey.toLowerCase()];
      if (!imgDims) {
        const foundEntry = Object.entries(imageDimensions).find(([k]) =>
          k.toLowerCase() === imageKey.toLowerCase() ||
          k.replace(/\.(png|jpe?g|webp|svg)$/i, '').toLowerCase() === cleanKey.toLowerCase()
        );
        if (foundEntry) imgDims = foundEntry[1];
      }
    }
    if (!imgDims) imgDims = { width: 100, height: 100 };

    // Resolve SVGA 2.0 KEEP shapes across frames (SVGA 2.0 type: 3 / "keep")
    let lastShapes: any[] = [];
    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f];
      if (!fr) continue;
      if (fr.shapes && fr.shapes.length > 0) {
        const firstShape = fr.shapes[0];
        const isKeep = firstShape && (firstShape.type === 3 || firstShape.type === 'keep' || firstShape.type === 'KEEP');
        if (isKeep) {
          fr.shapes = lastShapes;
        } else {
          lastShapes = fr.shapes;
        }
      }
    }
    
    // Check if sprite has any explicit alpha > 0
    const hasAnyExplicitAlpha = frames.some((fr: any) => fr && typeof fr.alpha === 'number' && fr.alpha > 0.005);

    // Robust helper to determine if a frame is active in SVGA 2.0
    const isFrameActive = (fr: any): boolean => {
      if (!fr) return false;
      // 1. If this sprite has explicit alpha keyframing (standard in SVGA 2.0),
      // only frames with alpha > 0.005 are active.
      if (hasAnyExplicitAlpha) {
        return typeof fr.alpha === 'number' ? fr.alpha > 0.005 : false;
      }
      // 2. If alpha is explicitly defined on this frame
      if (typeof fr.alpha === 'number') {
        return fr.alpha > 0.005;
      }
      // 3. Fallback only if this sprite has NO alpha anywhere in the file
      const hasImage = Boolean(sprite.imageKey && (imagesMap[sprite.imageKey] || imageDimensions[sprite.imageKey]));
      const hasShapes = Boolean(fr.shapes && Array.isArray(fr.shapes) && fr.shapes.length > 0);
      const hasLayout = Boolean(fr.layout && (
        (fr.layout.width !== undefined && fr.layout.width > 0) || 
        (fr.layout.height !== undefined && fr.layout.height > 0)
      ));
      const hasTransform = Boolean(fr.transform);
      const hasClip = Boolean(fr.clipPath);

      return Boolean(hasImage || hasShapes || hasLayout || hasTransform || hasClip);
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
    const activeFrames: number[] = [];

    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f];
      if (!fr) continue;
      
      if (fr.shapes && fr.shapes.length > 0) hasShapes = true;
      if (fr.transform) hasTransform = true;

      const active = isFrameActive(fr);

      if (active) {
        activeFrames.push(f);

        if (!hasFoundValidBounds) {
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

        endFrame = f;
      }
    }

    if (activeFrames.length > 0) {
      if (frames.length === 1) {
        // Single frame static layer valid across the entire animation in SVGA 2.0
        startFrame = 0;
        endFrame = Math.max(0, totalFrames - 1);
      } else {
        startFrame = activeFrames[0];
        endFrame = activeFrames[activeFrames.length - 1];
      }
    } else if (frames.length === 1) {
      // Single frame static layer valid across the animation
      startFrame = 0;
      endFrame = Math.max(0, totalFrames - 1);
    } else {
      startFrame = 0;
      endFrame = frames.length > 0 ? frames.length - 1 : Math.max(0, totalFrames - 1);
    }

    // Fallback if no active frame found
    if (!hasFoundValidBounds && frames.length > 0) {
      const firstFr = frames[0] || {};
      initialX = (firstFr.transform?.tx ?? 0) + (firstFr.layout?.x ?? 0);
      initialY = (firstFr.transform?.ty ?? 0) + (firstFr.layout?.y ?? 0);
      initialW = (firstFr.layout?.width && firstFr.layout.width > 0) ? firstFr.layout.width : imgDims.width;
      initialH = (firstFr.layout?.height && firstFr.layout.height > 0) ? firstFr.layout.height : imgDims.height;
    }

    // Determine thumbnail URL with fuzzy fallback
    let thumb = imagesMap[imageKey];
    if (!thumb) {
      const cleanKey = imageKey.replace(/\.(png|jpe?g|webp|svg)$/i, '');
      thumb = imagesMap[cleanKey] || imagesMap[`${cleanKey}.png`] || imagesMap[imageKey.toLowerCase()];
      if (!thumb) {
        const foundEntry = Object.entries(imagesMap).find(([k]) =>
          k.toLowerCase() === imageKey.toLowerCase() ||
          k.replace(/\.(png|jpe?g|webp|svg)$/i, '').toLowerCase() === cleanKey.toLowerCase()
        );
        if (foundEntry) thumb = foundEntry[1];
      }
    }

    // Determine layer type
    let layerType: 'image' | 'shape' | 'composite' = 'image';
    if (hasShapes && !thumb) {
      layerType = 'shape';
    } else if (hasShapes && thumb) {
      layerType = 'composite';
    }

    const totalWithSameKey = sprite.imageKey ? (imageKeyCounts[sprite.imageKey] || 1) : 1;
    let sequenceIndex = 1;
    if (sprite.imageKey && totalWithSameKey > 1) {
      imageKeyIndexTracker[sprite.imageKey] = (imageKeyIndexTracker[sprite.imageKey] || 0) + 1;
      sequenceIndex = imageKeyIndexTracker[sprite.imageKey];
    }

    // Check numbered sequence grouping
    let seqGroupId: string | undefined;
    let seqIndex = sequenceIndex;
    let seqTotal = totalWithSameKey;

    if (totalWithSameKey > 1) {
      seqGroupId = `seq_same_${sprite.imageKey}`;
    } else if (sprite.imageKey) {
      const match = sprite.imageKey.match(/^(.*?)_?(\d+)(\.[a-z0-9]+)?$/i);
      if (match && match[1]) {
        const pfx = match[1];
        const groupMembers = sequencePrefixGroups[pfx];
        if (groupMembers && groupMembers.length > 1) {
          seqGroupId = `seq_pfx_${pfx}`;
          seqIndex = groupMembers.indexOf(idx) + 1;
          seqTotal = groupMembers.length;
        }
      }
    }

    const baseName = sprite.imageKey ? sprite.imageKey : `Layer_${idx + 1}`;
    let layerName = baseName;
    if (totalWithSameKey > 1) {
      layerName = `${baseName} [${sequenceIndex}/${totalWithSameKey}]`;
    } else if (seqGroupId && seqTotal > 1) {
      layerName = `${baseName} (تسلسل ${seqIndex}/${seqTotal})`;
    }

    layers.push({
      id: `layer_${originalIndex}_${imageKey}`,
      originalIndex,
      imageKey,
      name: layerName,
      type: layerType,
      visible: true,
      locked: false,
      thumbnailUrl: thumb || undefined,
      inFrame: startFrame,
      outFrame: endFrame,
      sequenceGroupId: seqGroupId,
      sequenceIndex: seqIndex,
      sequenceTotal: seqTotal,
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
      originalInitialBounds: {
        x: initialX,
        y: initialY,
        width: initialW,
        height: initialH
      },
      originalTransform: {
        x: initialX,
        y: initialY,
        width: initialW,
        height: initialH,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 100
      },
      originalSpriteFrames: frames ? JSON.parse(JSON.stringify(frames)) : undefined,
      aspectRatioLocked: true,
      spriteRef: sprite,
      matteKey: sprite.matteKey,
      blendMode: sprite.blendMode || frames.find((f: any) => f && f.blendMode)?.blendMode,
      framesCount: frames.length,
      keyframeSummary: {
        startFrame,
        endFrame,
        hasShapes,
        hasTransform,
        hasAnyExplicitAlpha,
        activeFrames: activeFrames.length > 0 ? activeFrames : undefined,
        isSequenceOrRepeated: Boolean(seqGroupId || totalWithSameKey > 1 || (activeFrames.length > 0 && activeFrames.length < frames.length)),
        sequenceGroupId: seqGroupId,
        sequenceIndex: seqIndex,
        sequenceTotal: seqTotal
      }
    });
  });

  // Mark specific layers that act as a matte mask template for another layer.
  // In SVGA 2.0, matteKey references the mask layer by its originalIndex or layer ID.
  // We strictly match by exact ID or originalIndex so repeated layers sharing imageKey are NEVER falsely masked!
  const matteKeys = new Set<string>();
  layers.forEach(l => {
    if (l.matteKey) matteKeys.add(String(l.matteKey).trim());
    if (l.spriteRef?.matteKey) matteKeys.add(String(l.spriteRef.matteKey).trim());
  });
  layers.forEach(l => {
    const rawIdx = String(l.originalIndex);
    if (
      matteKeys.has(l.id) || 
      matteKeys.has(rawIdx) || 
      matteKeys.has(`layer_${rawIdx}`) ||
      (l.imageKey && matteKeys.has(l.imageKey)) ||
      (l.name && matteKeys.has(l.name)) ||
      (l.spriteRef?.imageKey && matteKeys.has(l.spriteRef.imageKey))
    ) {
      l.isMatteMask = true;
    }
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
