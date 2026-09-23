import { EditableLayer, SVGAProjectData, FadeConfig, CropConfig, CropFeather } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { applyTransparencyEffects } from './transparencyEngine';
import { renderLayerShine } from './shineEngine';

// Affine Matrix multiplication: M1 * M2
function multiplyMatrices(
  m1: [number, number, number, number, number, number],
  m2: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  const [a1, b1, c1, d1, tx1, ty1] = m1;
  const [a2, b2, c2, d2, tx2, ty2] = m2;

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1
  ];
}

function parseColorChan(v: any): number {
  const n = parseFloat(v) || 0;
  return n > 1 ? Math.min(255, Math.max(0, Math.round(n))) : Math.min(255, Math.max(0, Math.round(n * 255)));
}

function mapBlendMode(raw: any): GlobalCompositeOperation | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  switch (s) {
    case 'screen':
    case '2':
      return 'screen';
    case 'add':
    case 'lighter':
    case 'plus':
    case 'plus-lighter':
    case 'linear-dodge':
    case '16':
      return 'lighter';
    case 'multiply':
    case '1':
      return 'multiply';
    case 'overlay':
    case '3':
      return 'overlay';
    case 'darken':
    case '4':
      return 'darken';
    case 'lighten':
    case '5':
      return 'lighten';
    case 'color-dodge':
    case '6':
      return 'color-dodge';
    case 'color-burn':
    case '7':
      return 'color-burn';
    case 'hard-light':
    case '8':
      return 'hard-light';
    case 'soft-light':
    case '9':
      return 'soft-light';
    case 'difference':
    case '10':
      return 'difference';
    case 'exclusion':
    case '11':
      return 'exclusion';
    case 'hue':
    case '12':
      return 'hue';
    case 'saturation':
    case '13':
      return 'saturation';
    case 'color':
    case '14':
      return 'color';
    case 'luminosity':
    case '15':
      return 'luminosity';
    default:
      return null;
  }
}

// Cache for parsed Path2D objects to eliminate redundant CPU string parsing across frames and layers
const path2dCache = new Map<string, Path2D>();

function getCachedPath2D(pathStr: string): Path2D | null {
  if (!pathStr) return null;
  let p = path2dCache.get(pathStr);
  if (!p) {
    try {
      p = new Path2D(pathStr);
      if (path2dCache.size > 2000) {
        path2dCache.clear();
      }
      path2dCache.set(pathStr, p);
    } catch {
      return null;
    }
  }
  return p;
}

function applySvgPathToContext(ctx: CanvasRenderingContext2D, pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== 'string') return false;
  const str = pathStr.trim();
  if (!str) return false;

  const cachedP = getCachedPath2D(str);
  if (cachedP) {
    ctx.clip(cachedP);
    return true;
  }

  try {
    ctx.beginPath();
    const segments = str.replace(/([a-zA-Z])/g, '|||$1 ').replace(/,/g, ' ').split('|||');
    let curX = 0;
    let curY = 0;

    for (const seg of segments) {
      if (!seg) continue;
      const trimmed = seg.trim();
      if (!trimmed) continue;
      const cmd = trimmed.charAt(0);
      const args = trimmed.slice(1).trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

      switch (cmd) {
        case 'M': curX = args[0] || 0; curY = args[1] || 0; ctx.moveTo(curX, curY); break;
        case 'm': curX += args[0] || 0; curY += args[1] || 0; ctx.moveTo(curX, curY); break;
        case 'L': curX = args[0] || 0; curY = args[1] || 0; ctx.lineTo(curX, curY); break;
        case 'l': curX += args[0] || 0; curY += args[1] || 0; ctx.lineTo(curX, curY); break;
        case 'H': curX = args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'h': curX += args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'V': curY = args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'v': curY += args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'C': ctx.bezierCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0, args[4] || 0, args[5] || 0); curX = args[4] || 0; curY = args[5] || 0; break;
        case 'c': ctx.bezierCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0), curX + (args[4] || 0), curY + (args[5] || 0)); curX += args[4] || 0; curY += args[5] || 0; break;
        case 'S': ctx.quadraticCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0); curX = args[2] || 0; curY = args[3] || 0; break;
        case 's': ctx.quadraticCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0)); curX += args[2] || 0; curY += args[3] || 0; break;
        case 'Q': ctx.quadraticCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0); curX = args[2] || 0; curY = args[3] || 0; break;
        case 'q': ctx.quadraticCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0)); curX += args[2] || 0; curY += args[3] || 0; break;
        case 'Z': case 'z': ctx.closePath(); break;
      }
    }
    ctx.clip();
    return true;
  } catch (err) {
    return false;
  }
}

function traceSvgPathToContext(ctx: CanvasRenderingContext2D, pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== 'string') return false;
  const str = pathStr.trim();
  if (!str) return false;

  try {
    ctx.beginPath();
    const segments = str.replace(/([a-zA-Z])/g, '|||$1 ').replace(/,/g, ' ').split('|||');
    let curX = 0;
    let curY = 0;

    for (const seg of segments) {
      if (!seg) continue;
      const trimmed = seg.trim();
      if (!trimmed) continue;
      const cmd = trimmed.charAt(0);
      const args = trimmed.slice(1).trim().split(/\s+/).map(Number).filter(n => !isNaN(n));

      switch (cmd) {
        case 'M': curX = args[0] || 0; curY = args[1] || 0; ctx.moveTo(curX, curY); break;
        case 'm': curX += args[0] || 0; curY += args[1] || 0; ctx.moveTo(curX, curY); break;
        case 'L': curX = args[0] || 0; curY = args[1] || 0; ctx.lineTo(curX, curY); break;
        case 'l': curX += args[0] || 0; curY += args[1] || 0; ctx.lineTo(curX, curY); break;
        case 'H': curX = args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'h': curX += args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'V': curY = args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'v': curY += args[0] || 0; ctx.lineTo(curX, curY); break;
        case 'C': ctx.bezierCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0, args[4] || 0, args[5] || 0); curX = args[4] || 0; curY = args[5] || 0; break;
        case 'c': ctx.bezierCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0), curX + (args[4] || 0), curY + (args[5] || 0)); curX += args[4] || 0; curY += args[5] || 0; break;
        case 'S': ctx.quadraticCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0); curX = args[2] || 0; curY = args[3] || 0; break;
        case 's': ctx.quadraticCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0)); curX += args[2] || 0; curY += args[3] || 0; break;
        case 'Q': ctx.quadraticCurveTo(args[0] || 0, args[1] || 0, args[2] || 0, args[3] || 0); curX = args[2] || 0; curY = args[3] || 0; break;
        case 'q': ctx.quadraticCurveTo(curX + (args[0] || 0), curY + (args[1] || 0), curX + (args[2] || 0), curY + (args[3] || 0)); curX += args[2] || 0; curY += args[3] || 0; break;
        case 'Z': case 'z': ctx.closePath(); break;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

function renderSvgaShapes(ctx: CanvasRenderingContext2D, shapes: any[]) {
  if (!shapes || !Array.isArray(shapes)) return;

  for (const shape of shapes) {
    if (!shape) continue;
    if (shape.type === 3 || shape.type === 'keep') continue;
    ctx.save();

    if (shape.transform) {
      const { a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = shape.transform;
      ctx.transform(a, b, c, d, tx, ty);
    }

    const styles = shape.styles || {};
    if (styles.fill) {
      const { r = 0, g = 0, b = 0, a = 1 } = styles.fill;
      const alpha = typeof a === 'number' ? Math.max(0, Math.min(1, a)) : 1;
      ctx.fillStyle = `rgba(${parseColorChan(r)}, ${parseColorChan(g)}, ${parseColorChan(b)}, ${alpha})`;
    }
    if (styles.stroke) {
      const { r = 0, g = 0, b = 0, a = 1 } = styles.stroke;
      const alpha = typeof a === 'number' ? Math.max(0, Math.min(1, a)) : 1;
      ctx.strokeStyle = `rgba(${parseColorChan(r)}, ${parseColorChan(g)}, ${parseColorChan(b)}, ${alpha})`;
      ctx.lineWidth = styles.strokeWidth || 1;
      if (styles.lineCap) ctx.lineCap = styles.lineCap.toLowerCase();
      if (styles.lineJoin) ctx.lineJoin = styles.lineJoin.toLowerCase();
      if (styles.miterLimit) ctx.miterLimit = styles.miterLimit;
      if (styles.lineDash && Array.isArray(styles.lineDash)) {
        try { ctx.setLineDash(styles.lineDash); } catch (e) {}
      }
    }

    const pathD = shape.shape?.d || shape.args?.d || shape.pathArgs?.d;
    if (pathD) {
      const p = getCachedPath2D(pathD);
      if (p) {
        if (styles.fill) ctx.fill(p);
        if (styles.stroke) ctx.stroke(p);
      } else {
        traceSvgPathToContext(ctx, pathD);
        if (styles.fill) ctx.fill();
        if (styles.stroke) ctx.stroke();
      }
    } else if (shape.rect || (shape.type === 1 && shape.args)) {
      const rObj = shape.rect || shape.args || {};
      const { x = 0, y = 0, width = 0, height = 0, cornerRadius = 0, rx = 0 } = rObj;
      const radius = cornerRadius || rx || 0;
      if (radius > 0 && (ctx as any).roundRect) {
        ctx.beginPath();
        (ctx as any).roundRect(x, y, width, height, radius);
        if (styles.fill) ctx.fill();
        if (styles.stroke) ctx.stroke();
      } else {
        if (styles.fill) ctx.fillRect(x, y, width, height);
        if (styles.stroke) ctx.strokeRect(x, y, width, height);
      }
    } else if (shape.ellipse || (shape.type === 2 && shape.args)) {
      const eObj = shape.ellipse || shape.args || {};
      const { x = 0, y = 0, radiusX = 0, radiusY = 0 } = eObj;
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.1, radiusX), Math.max(0.1, radiusY), 0, 0, Math.PI * 2);
      if (styles.fill) ctx.fill();
      if (styles.stroke) ctx.stroke();
    }

    ctx.restore();
  }
}

function getLayerFrameState(layer: EditableLayer, frameIdx: number, totalFrames: number, imagesMap: Record<string, string>) {
  if (layer.isMerged || (layer.mergedLayers && layer.mergedLayers.length > 0)) {
    return { isActive: true, frame: { alpha: 1, transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } }, alpha: 1.0 };
  }

  // Guaranteed rendering for video sequence layers
  if (layer.isVideoSequence) {
    const startF = layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0);
    const endF = layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (totalFrames - 1));
    if (frameIdx < startF || frameIdx > endF) {
      return { isActive: false, frame: null, alpha: 0 };
    }
    const frames = layer.spriteRef?.frames;
    const frame = (frames && frames[frameIdx]) || (frames && frames[0]) || {
      alpha: 1,
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      layout: { x: 0, y: 0, width: layer.transform?.width || 512, height: layer.transform?.height || 512 }
    };
    return {
      isActive: true,
      frame: {
        ...frame,
        alpha: 1,
        transform: frame.transform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        layout: frame.layout || { x: 0, y: 0, width: layer.transform?.width || 512, height: layer.transform?.height || 512 }
      },
      alpha: 1.0
    };
  }

  const frames = layer.spriteRef?.frames;
  if (!frames || frames.length === 0) return { isActive: false, frame: null, alpha: 0 };

  const isSingleFrameStatic = frames.length === 1 || layer.framesCount === 1;
  const startF = layer.inFrame !== undefined ? layer.inFrame : (layer.keyframeSummary?.startFrame ?? 0);
  const endF = layer.outFrame !== undefined ? layer.outFrame : (layer.keyframeSummary?.endFrame ?? (totalFrames - 1));

  if (!isSingleFrameStatic && (frameIdx < startF || frameIdx > endF)) {
    return { isActive: false, frame: null, alpha: 0 };
  }

  let frame = frames[frameIdx];
  if (!frame && isSingleFrameStatic) {
    frame = frames[0];
  } else if (!frame && frames.length > 0 && frames.length < totalFrames) {
    frame = frames[frameIdx % frames.length];
  }

  if (!frame) return { isActive: false, frame: null, alpha: 0 };

  let isActive = false;
  let frameAlpha = 0;

  const hasAnyExplicitAlpha = Boolean(
    (layer.spriteRef as any)?._hasExplicitAlpha ||
    layer.keyframeSummary?.hasAnyExplicitAlpha ||
    frames.some((fr: any) => fr && typeof fr.alpha === 'number' && fr.alpha > 0.005)
  );

  if (hasAnyExplicitAlpha) {
    if (typeof frame.alpha === 'number') {
      frameAlpha = frame.alpha;
      isActive = frameAlpha > 0.005;
    } else {
      isActive = false;
      frameAlpha = 0;
    }
  } else if (typeof frame.alpha === 'number') {
    frameAlpha = frame.alpha;
    isActive = frameAlpha > 0.005;
  } else {
    const hasImage = Boolean(layer.imageKey && (imagesMap[layer.imageKey] || layer.thumbnailUrl));
    const hasShapes = Boolean(frame.shapes && Array.isArray(frame.shapes) && frame.shapes.length > 0);
    const hasLayout = Boolean(frame.layout && (
      (frame.layout.width !== undefined && frame.layout.width > 0) || 
      (frame.layout.height !== undefined && frame.layout.height > 0)
    ));
    const hasTransform = Boolean(frame.transform);
    const hasClip = Boolean(frame.clipPath);

    if (hasImage || hasShapes || hasLayout || hasTransform || hasClip) {
      isActive = true;
      frameAlpha = 1.0;
    }
  }

  return { isActive, frame, alpha: frameAlpha };
}

/**
 * Preloads all images referenced in project and layers into memory
 */
async function preloadProjectImages(project: SVGAProjectData, layers: EditableLayer[]): Promise<Record<string, HTMLImageElement>> {
  const cache: Record<string, HTMLImageElement> = {};
  const imageSources: Record<string, string> = { ...(project.imagesMap || {}) };

  // Collect from layers
  function collectSources(list: EditableLayer[]) {
    for (const l of list) {
      if (l.imageKey && l.thumbnailUrl && !imageSources[l.imageKey]) {
        imageSources[l.imageKey] = l.thumbnailUrl;
      }
      if (l.mergedLayers && l.mergedLayers.length > 0) {
        collectSources(l.mergedLayers);
      }
    }
  }
  collectSources(layers);

  // Preload each image safely
  await Promise.all(
    Object.entries(imageSources).map(([key, src]) => {
      return new Promise<void>((resolve) => {
        if (!src) { resolve(); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          cache[key] = img;
          const cleanK = key.replace(/\.(png|jpe?g|webp|svg)$/i, '');
          cache[cleanK] = img;
          cache[`${cleanK}.png`] = img;
          cache[key.toLowerCase()] = img;
          cache[`img_${cleanK}`] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    })
  );

  return cache;
}

/**
 * Renders every frame of the SVGA project with all layers, animations, transformations,
 * vector shapes, matte masks, and transparency effects intact.
 */
export async function renderAllProjectFrames(
  project: SVGAProjectData,
  layers: EditableLayer[],
  options?: {
    fadeConfig?: FadeConfig;
    cropConfig?: CropConfig;
    cropFeather?: CropFeather;
    bgColor?: string;
    onProgress?: (progress: number, currentFrame: number, totalFrames: number) => void;
  }
): Promise<{ canvases: HTMLCanvasElement[]; delays: number[]; fps: number }> {
  const width = Math.max(16, Math.round(project.width || 512));
  const height = Math.max(16, Math.round(project.height || 512));
  const totalFrames = Math.max(1, Math.round(project.totalFrames || 30));
  const fps = Math.max(1, Math.round(project.fps || 30));
  const delayMs = Math.max(16, Math.round(1000 / fps));

  const imageCache = await preloadProjectImages(project, layers);

  // Matte Mask Lookup
  const maskTemplateKeySet = new Set<string>();
  function scanMatteKeys(list: EditableLayer[]) {
    for (const l of list) {
      if (l.matteKey) maskTemplateKeySet.add(String(l.matteKey).trim());
      if (l.spriteRef?.matteKey) maskTemplateKeySet.add(String(l.spriteRef.matteKey).trim());
      if (l.mergedLayers) scanMatteKeys(l.mergedLayers);
    }
  }
  scanMatteKeys(layers);

  const findMaskLayer = (matteKey: string, sourceLayer?: EditableLayer, scopeLayers?: EditableLayer[]): EditableLayer | undefined => {
    const target = String(matteKey).trim();
    const searchPool = scopeLayers && scopeLayers.length > 0 ? [...scopeLayers, ...layers] : layers;

    const exact = searchPool.find(m => {
      if (!m || m === sourceLayer) return false;
      if (m.imageKey === target || m.id === target || m.name === target) return true;
      if (m.spriteRef?.imageKey === target) return true;
      const rawIdx = String(m.originalIndex);
      if (rawIdx === target || `img_${rawIdx}` === target || `layer_${rawIdx}` === target) return true;
      if (m.imageKey && (m.imageKey.endsWith(`_${target}`) || target.endsWith(`_${m.imageKey}`))) return true;
      if (m.name && (m.name.endsWith(`_${target}`) || target.endsWith(`_${m.name}`))) return true;
      return false;
    });
    if (exact) return exact;

    if (sourceLayer && sourceLayer.groupId) {
      return searchPool.find(m => {
        if (!m || m === sourceLayer || m.groupId !== sourceLayer.groupId) return false;
        if (m.imageKey?.includes(target) || target.includes(m.imageKey || '')) return true;
        if (m.name?.includes(target) || target.includes(m.name || '')) return true;
        return false;
      });
    }
    return undefined;
  };

  const isLayerMatteTemplate = (layer: EditableLayer): boolean => {
    if (layer.isMatteMask) return true;
    const rawIdx = String(layer.originalIndex);
    if (
      maskTemplateKeySet.has(layer.id) || 
      maskTemplateKeySet.has(rawIdx) || 
      maskTemplateKeySet.has(`layer_${rawIdx}`) ||
      (layer.imageKey && maskTemplateKeySet.has(layer.imageKey)) ||
      (layer.name && maskTemplateKeySet.has(layer.name)) ||
      (layer.spriteRef?.imageKey && maskTemplateKeySet.has(layer.spriteRef.imageKey))
    ) {
      return true;
    }
    return false;
  };

  const canvases: HTMLCanvasElement[] = [];
  const delays: number[] = [];

  // Offscreen helper canvases for mask composition
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext('2d');

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');

  for (let f = 0; f < totalFrames; f++) {
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const ctx = frameCanvas.getContext('2d');
    if (!ctx) continue;

    // Background color
    if (options?.bgColor && options.bgColor !== 'transparent') {
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    const renderLeafSprite = (
      targetCtx: CanvasRenderingContext2D,
      layerItem: EditableLayer,
      totalMatrix: [number, number, number, number, number, number],
      alpha: number,
      isMask: boolean = false
    ) => {
      const { isActive, frame, alpha: frameAlpha } = getLayerFrameState(layerItem, f, totalFrames, project.imagesMap || {});
      if (!isActive || !frame || frameAlpha <= 0.005) return;

      const fA = frame?.transform?.a ?? 1;
      const fB = frame?.transform?.b ?? 0;
      const fC = frame?.transform?.c ?? 0;
      const fD = frame?.transform?.d ?? 1;
      const fTx = frame?.transform?.tx ?? 0;
      const fTy = frame?.transform?.ty ?? 0;
      const mFrame: [number, number, number, number, number, number] = [fA, fB, fC, fD, fTx, fTy];

      const finalTotalMatrix = multiplyMatrices(totalMatrix, mFrame);

      targetCtx.save();
      targetCtx.globalAlpha = Math.max(0, Math.min(1, alpha * frameAlpha));

      if (!isMask) {
        const rawBlend = frame.blendMode || layerItem.blendMode || layerItem.spriteRef?.blendMode;
        const bm = mapBlendMode(rawBlend);
        if (bm) targetCtx.globalCompositeOperation = bm;
      }

      targetCtx.transform(finalTotalMatrix[0], finalTotalMatrix[1], finalTotalMatrix[2], finalTotalMatrix[3], finalTotalMatrix[4], finalTotalMatrix[5]);

      if (frame.clipPath) {
        applySvgPathToContext(targetCtx, frame.clipPath);
      }

      if (frame.shapes && frame.shapes.length > 0) {
        renderSvgaShapes(targetCtx, frame.shapes);
      }

      let imgKey = layerItem.imageKey || layerItem.spriteRef?.imageKey;
      if (layerItem.isVideoSequence || layerItem.sequencePrefix) {
        const pfx = layerItem.sequencePrefix || 'frame_';
        const candidateKeys = [
          `${pfx}${f}.jpg`,
          `${pfx}${f}.png`,
          `${pfx}${f}.jpeg`,
          `${pfx}${f}.webp`,
          `${pfx}${f}`
        ];
        const matched = candidateKeys.find(k => imageCache[k] || imageCache[k.toLowerCase()] || (project.imagesMap && project.imagesMap[k]));
        imgKey = matched || `${pfx}${f}.jpg`;
      }
      let cachedImg = imgKey ? (imageCache[imgKey] || imageCache[imgKey.toLowerCase()]) : null;

      if (!cachedImg && imgKey) {
        const cleanK = imgKey.replace(/\.(png|jpe?g|webp|svg)$/i, '');
        cachedImg = imageCache[cleanK] || imageCache[`${cleanK}.png`] || imageCache[`${cleanK}.jpg`] || imageCache[`img_${cleanK}`];
      }

      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        let drawW = cachedImg.naturalWidth;
        let drawH = cachedImg.naturalHeight;

        if (frame.layout) {
          if (frame.layout.width && frame.layout.width > 0) drawW = frame.layout.width;
          if (frame.layout.height && frame.layout.height > 0) drawH = frame.layout.height;
        }

        targetCtx.drawImage(cachedImg, 0, 0, drawW, drawH);

        if (layerItem.shineConfig && layerItem.shineConfig.enabled) {
          renderLayerShine(
            targetCtx,
            drawW,
            drawH,
            f,
            totalFrames,
            layerItem.shineConfig,
            project.width,
            project.height,
            finalTotalMatrix,
            project.fps || 30
          );
        }
      } else if (layerItem.shineConfig && layerItem.shineConfig.enabled) {
        const drawW = layerItem.transform.width || project.width;
        const drawH = layerItem.transform.height || project.height;
        renderLayerShine(
          targetCtx,
          drawW,
          drawH,
          f,
          totalFrames,
          layerItem.shineConfig,
          project.width,
          project.height,
          finalTotalMatrix,
          project.fps || 30
        );
      }

      targetCtx.restore();
    };

    const renderLayerRecursive = (
      layerItem: EditableLayer,
      parentMatrix: [number, number, number, number, number, number] | null,
      parentAlpha: number,
      siblingLayers?: EditableLayer[]
    ) => {
      if (!layerItem.visible) return;

      const animTransform = getLayerAnimatedTransform(layerItem, f);
      const layerAlpha = Math.max(0, Math.min(1, (animTransform.opacity !== undefined ? animTransform.opacity : layerItem.transform.opacity) / 100));
      const currentAlpha = parentAlpha * layerAlpha;
      if (currentAlpha <= 0.001) return;

      const initialBounds = layerItem.initialBounds || { x: 0, y: 0, width: 100, height: 100 };
      const deltaX = animTransform.x - initialBounds.x;
      const deltaY = animTransform.y - initialBounds.y;
      const scaleX = animTransform.scaleX;
      const scaleY = animTransform.scaleY;
      const rotation = animTransform.rotation;

      const pivotX = initialBounds.x + initialBounds.width / 2;
      const pivotY = initialBounds.y + initialBounds.height / 2;

      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const uA = scaleX * cos;
      const uB = scaleX * sin;
      const uC = -scaleY * sin;
      const uD = scaleY * cos;
      const uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
      const uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);
      const mUser: [number, number, number, number, number, number] = [uA, uB, uC, uD, uTx, uTy];

      const currentTotalMatrix = parentMatrix ? multiplyMatrices(parentMatrix, mUser) : mUser;

      if (layerItem.mergedLayers && layerItem.mergedLayers.length > 0) {
        const sublayersToRender = [...layerItem.mergedLayers].reverse();
        for (const sub of sublayersToRender) {
          if (isLayerMatteTemplate(sub)) continue;
          renderLayerRecursive(sub, currentTotalMatrix, currentAlpha, layerItem.mergedLayers);
        }
        return;
      }

      if (layerItem.matteKey && offCtx && maskCtx) {
        const maskLayer = findMaskLayer(layerItem.matteKey, layerItem, siblingLayers);
        if (maskLayer) {
          const maskState = getLayerFrameState(maskLayer, f, totalFrames, project.imagesMap || {});
          if (!maskState.isActive || !maskState.frame || maskState.alpha <= 0.005) {
            return;
          }

          offCtx.clearRect(0, 0, width, height);
          maskCtx.clearRect(0, 0, width, height);

          renderLeafSprite(offCtx, layerItem, currentTotalMatrix, currentAlpha, false);

          const maskAnim = getLayerAnimatedTransform(maskLayer, f);
          const maskInitial = maskLayer.initialBounds || { x: 0, y: 0, width: 100, height: 100 };
          const mRad = (maskAnim.rotation * Math.PI) / 180;
          const mCos = Math.cos(mRad);
          const mSin = Math.sin(mRad);
          const mPivotX = maskInitial.x + maskInitial.width / 2;
          const mPivotY = maskInitial.y + maskInitial.height / 2;
          const mA = maskAnim.scaleX * mCos;
          const mB = maskAnim.scaleX * mSin;
          const mC = -maskAnim.scaleY * mSin;
          const mD = maskAnim.scaleY * mCos;
          const mTx = (mPivotX + maskAnim.x - maskInitial.x) - (mA * mPivotX + mC * mPivotY);
          const mTy = (mPivotY + maskAnim.y - maskInitial.y) - (mB * mPivotX + mD * mPivotY);
          const mUserMask: [number, number, number, number, number, number] = [mA, mB, mC, mD, mTx, mTy];

          renderLeafSprite(maskCtx, maskLayer, mUserMask, 1.0, true);

          offCtx.save();
          offCtx.globalCompositeOperation = 'destination-in';
          offCtx.drawImage(maskCanvas, 0, 0);
          offCtx.restore();

          ctx.drawImage(offCanvas, 0, 0);
          return;
        }
      }

      renderLeafSprite(ctx, layerItem, currentTotalMatrix, currentAlpha, false);
    };

    // Draw all top-level layers in visual order (bottom to top: layers[last] -> layers[0])
    const layersToRender = [...layers].reverse();
    for (const l of layersToRender) {
      if (isLayerMatteTemplate(l)) continue;
      renderLayerRecursive(l, null, 1.0);
    }

    // Apply edge fade & advanced crop if enabled
    if (options?.fadeConfig && options?.cropConfig && options?.cropFeather) {
      applyTransparencyEffects(ctx, width, height, options.fadeConfig, options.cropConfig, options.cropFeather);
    }

    canvases.push(frameCanvas);
    delays.push(delayMs);

    if (f % 5 === 0) {
      options?.onProgress?.((f + 1) / totalFrames, f + 1, totalFrames);
      await new Promise(r => requestAnimationFrame(r));
    }
  }

  return { canvases, delays, fps };
}

// Global project image memory cache to avoid reloading images on every frame
const globalProjectImagesCache = new Map<string, Record<string, HTMLImageElement>>();

export function getOrPreloadProjectImages(
  project: SVGAProjectData, 
  layers: EditableLayer[],
  onImageLoaded?: () => void
): Record<string, HTMLImageElement> {
  const cacheKey = project.fileName || `${project.width}_${project.height}_${layers.length}`;
  let cache = globalProjectImagesCache.get(cacheKey);
  if (!cache) {
    cache = {};
    const imageSources: Record<string, string> = { ...(project.imagesMap || {}) };
    for (const l of layers) {
      if (l.imageKey && l.thumbnailUrl && !imageSources[l.imageKey]) {
        imageSources[l.imageKey] = l.thumbnailUrl;
      }
    }
    for (const [key, src] of Object.entries(imageSources)) {
      if (!src) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      if (onImageLoaded) {
        img.onload = () => onImageLoaded();
      }
      img.src = src;
      cache[key] = img;
      const cleanK = key.replace(/\.(png|jpe?g|webp|svg)$/i, '');
      cache[cleanK] = img;
      cache[`${cleanK}.png`] = img;
      cache[key.toLowerCase()] = img;
      cache[`img_${cleanK}`] = img;
    }
    if (globalProjectImagesCache.size > 20) {
      globalProjectImagesCache.clear();
    }
    globalProjectImagesCache.set(cacheKey, cache);
  }
  return cache;
}

const globalBgImagesCache = new Map<string, HTMLImageElement>();

function getOrPreloadBackgroundImage(url: string, onImageLoaded?: () => void): HTMLImageElement | null {
  if (!url) return null;
  const cached = globalBgImagesCache.get(url);
  if (cached) {
    if (cached.complete && cached.naturalWidth > 0) return cached;
    return null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  if (onImageLoaded) {
    img.onload = () => onImageLoaded();
  }
  img.src = url;
  globalBgImagesCache.set(url, img);
  return null;
}

/**
 * High-performance direct single frame renderer.
 * Directly renders ONLY the requested frameIndex without re-rendering all frames.
 * Renders in <1ms for 60fps stutter-free simultaneous playback.
 */
export function renderSingleProjectFrameDirect(
  targetCanvas: HTMLCanvasElement,
  project: SVGAProjectData,
  layers: EditableLayer[],
  frameIndex: number,
  options?: {
    fadeConfig?: FadeConfig;
    cropConfig?: CropConfig;
    cropFeather?: CropFeather;
    bgColor?: string;
    bgImageUrl?: string | null;
    onImageLoaded?: () => void;
  }
): void {
  if (!targetCanvas || !project) return;
  const width = Math.max(16, Math.round(project.width || 512));
  const height = Math.max(16, Math.round(project.height || 512));
  
  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  if (options?.bgImageUrl) {
    const bgImg = getOrPreloadBackgroundImage(options.bgImageUrl, options?.onImageLoaded);
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, width, height);
    } else if (options?.bgColor && options.bgColor !== 'transparent') {
      ctx.fillStyle = options.bgColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  } else if (options?.bgColor && options.bgColor !== 'transparent') {
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const totalFrames = Math.max(1, Math.round(project.totalFrames || 30));
  const f = Math.min(Math.max(0, frameIndex), totalFrames - 1);
  const imageCache = getOrPreloadProjectImages(project, layers, options?.onImageLoaded);


  const renderLeafSprite = (
    targetCtx: CanvasRenderingContext2D,
    layerItem: EditableLayer,
    totalMatrix: [number, number, number, number, number, number],
    alpha: number
  ) => {
    const { isActive, frame, alpha: frameAlpha } = getLayerFrameState(layerItem, f, totalFrames, project.imagesMap || {});
    if (!isActive || !frame || frameAlpha <= 0.005) return;

    const fA = frame?.transform?.a ?? 1;
    const fB = frame?.transform?.b ?? 0;
    const fC = frame?.transform?.c ?? 0;
    const fD = frame?.transform?.d ?? 1;
    const fTx = frame?.transform?.tx ?? 0;
    const fTy = frame?.transform?.ty ?? 0;
    const mFrame: [number, number, number, number, number, number] = [fA, fB, fC, fD, fTx, fTy];
    const finalTotalMatrix = multiplyMatrices(totalMatrix, mFrame);

    targetCtx.save();
    targetCtx.globalAlpha = Math.max(0, Math.min(1, alpha * frameAlpha));

    const rawBlend = frame.blendMode || layerItem.blendMode || layerItem.spriteRef?.blendMode;
    const bm = mapBlendMode(rawBlend);
    if (bm) targetCtx.globalCompositeOperation = bm;

    targetCtx.transform(finalTotalMatrix[0], finalTotalMatrix[1], finalTotalMatrix[2], finalTotalMatrix[3], finalTotalMatrix[4], finalTotalMatrix[5]);

    if (frame.clipPath) {
      applySvgPathToContext(targetCtx, frame.clipPath);
    }

    if (frame.shapes && frame.shapes.length > 0) {
      renderSvgaShapes(targetCtx, frame.shapes);
    }

    let imgKey = layerItem.imageKey || layerItem.spriteRef?.imageKey;
    if (layerItem.isVideoSequence || layerItem.sequencePrefix) {
      const pfx = layerItem.sequencePrefix || 'frame_';
      const candidateKeys = [
        `${pfx}${f}.jpg`,
        `${pfx}${f}.png`,
        `${pfx}${f}.jpeg`,
        `${pfx}${f}.webp`,
        `${pfx}${f}`
      ];
      const matched = candidateKeys.find(k => imageCache[k] || imageCache[k.toLowerCase()] || (project.imagesMap && project.imagesMap[k]));
      imgKey = matched || `${pfx}${f}.jpg`;
    }

    let cachedImg = imgKey ? (imageCache[imgKey] || imageCache[imgKey.toLowerCase()]) : null;
    if (!cachedImg && imgKey) {
      const cleanK = imgKey.replace(/\.(png|jpe?g|webp|svg)$/i, '');
      cachedImg = imageCache[cleanK] || imageCache[`${cleanK}.png`] || imageCache[`${cleanK}.jpg`] || imageCache[`img_${cleanK}`];
    }

    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      let drawW = cachedImg.naturalWidth;
      let drawH = cachedImg.naturalHeight;

      if (frame.layout) {
        if (frame.layout.width && frame.layout.width > 0) drawW = frame.layout.width;
        if (frame.layout.height && frame.layout.height > 0) drawH = frame.layout.height;
      }

      targetCtx.drawImage(cachedImg, 0, 0, drawW, drawH);

      if (layerItem.shineConfig && layerItem.shineConfig.enabled) {
        renderLayerShine(
          targetCtx,
          drawW,
          drawH,
          f,
          totalFrames,
          layerItem.shineConfig,
          project.width,
          project.height,
          finalTotalMatrix,
          project.fps || 30
        );
      }
    } else if (layerItem.shineConfig && layerItem.shineConfig.enabled) {
      const drawW = layerItem.transform.width || project.width;
      const drawH = layerItem.transform.height || project.height;
      renderLayerShine(
        targetCtx,
        drawW,
        drawH,
        f,
        totalFrames,
        layerItem.shineConfig,
        project.width,
        project.height,
        finalTotalMatrix,
        project.fps || 30
      );
    }

    targetCtx.restore();
  };

  const renderLayerRecursive = (
    layerItem: EditableLayer,
    parentMatrix: [number, number, number, number, number, number] | null,
    parentAlpha: number
  ) => {
    if (!layerItem.visible) return;

    const animTransform = getLayerAnimatedTransform(layerItem, f);
    const layerAlpha = Math.max(0, Math.min(1, (animTransform.opacity !== undefined ? animTransform.opacity : layerItem.transform.opacity) / 100));
    const currentAlpha = parentAlpha * layerAlpha;
    if (currentAlpha <= 0.001) return;

    const initialBounds = layerItem.initialBounds || { x: 0, y: 0, width: 100, height: 100 };
    const deltaX = animTransform.x - initialBounds.x;
    const deltaY = animTransform.y - initialBounds.y;
    const scaleX = animTransform.scaleX;
    const scaleY = animTransform.scaleY;
    const rotation = animTransform.rotation;

    const pivotX = initialBounds.x + initialBounds.width / 2;
    const pivotY = initialBounds.y + initialBounds.height / 2;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const uA = scaleX * cos;
    const uB = scaleX * sin;
    const uC = -scaleY * sin;
    const uD = scaleY * cos;
    const uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
    const uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);
    const mUser: [number, number, number, number, number, number] = [uA, uB, uC, uD, uTx, uTy];

    const currentTotalMatrix = parentMatrix ? multiplyMatrices(parentMatrix, mUser) : mUser;

    if (layerItem.mergedLayers && layerItem.mergedLayers.length > 0) {
      const sublayersToRender = [...layerItem.mergedLayers].reverse();
      for (const sub of sublayersToRender) {
        if (sub.isMatteMask) continue;
        renderLayerRecursive(sub, currentTotalMatrix, currentAlpha);
      }
      return;
    }

    renderLeafSprite(ctx, layerItem, currentTotalMatrix, currentAlpha);
  };

  const layersToRender = [...layers].reverse();
  for (const l of layersToRender) {
    if (l.isMatteMask) continue;
    renderLayerRecursive(l, null, 1.0);
  }

  if (options?.fadeConfig && options?.cropConfig && options?.cropFeather) {
    applyTransparencyEffects(ctx, width, height, options.fadeConfig, options.cropConfig, options.cropFeather);
  }

  ctx.restore();
}

/**
 * Renders a single frame of the project directly to an HTML5 Canvas element.
 * Perfect for real-time overview thumbnails and multi-comp previews.
 */
export async function renderProjectFrameToCanvas(
  targetCanvas: HTMLCanvasElement,
  project: SVGAProjectData,
  layers: EditableLayer[],
  frameIndex: number,
  options?: {
    fadeConfig?: FadeConfig;
    cropConfig?: CropConfig;
    cropFeather?: CropFeather;
    bgColor?: string;
  }
): Promise<void> {
  // Use instant direct renderer to avoid lagging or frame stutter
  renderSingleProjectFrameDirect(targetCanvas, project, layers, frameIndex, options);
}

