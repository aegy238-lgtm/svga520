import { EditableLayer, SVGAProjectData } from './types';
import { parseSvgaToProject } from './svgaParserEngine';

export interface MergeSvgaOptions {
  placement: 'center' | 'top' | 'bottom' | 'asIs';
  scaleMode: 'fit' | 'original' | 'custom';
  customScale?: number;
  layerPosition: 'top' | 'bottom';
  loopFrames: boolean;
}

export interface MergeResult {
  updatedProject: SVGAProjectData;
  updatedLayers: EditableLayer[];
  importedGroupId: string;
  importedGroupName: string;
  importedLayersCount: number;
}

/**
 * Merge and overlay an external SVGA file into the current active SVGA project.
 * Preserves all animations, shapes, vectors, and textures under a unified group.
 */
export async function mergeSvgaFileIntoProject(
  incomingFile: File,
  currentProject: SVGAProjectData,
  currentLayers: EditableLayer[],
  options: Partial<MergeSvgaOptions> = {}
): Promise<MergeResult> {
  const mergedOptions: MergeSvgaOptions = {
    placement: options.placement || 'center',
    scaleMode: options.scaleMode || 'fit',
    customScale: options.customScale || 1.0,
    layerPosition: options.layerPosition || 'top',
    loopFrames: options.loopFrames !== undefined ? options.loopFrames : true
  };

  // 1. Parse the incoming SVGA file
  const { project: incomingProject, layers: incomingLayers } = await parseSvgaToProject(incomingFile);

  // 2. Generate unique identifiers & namespaces
  const timestamp = Date.now();
  const randKey = Math.random().toString(36).substring(2, 7);
  const importedGroupId = `group_${timestamp}_${randKey}`;
  const importedGroupName = incomingFile.name.replace(/\.svga$/i, '') || 'SVGA مدمج';
  const prefix = `mrg_${randKey}_`;

  // 3. Namespace images to prevent any collision
  const updatedImagesMap: Record<string, string> = { ...currentProject.imagesMap };
  const updatedRawImages: Record<string, Uint8Array> = { ...currentProject.rawImages };
  const keyTranslation: Record<string, string> = {};

  for (const [key, dataUrl] of Object.entries(incomingProject.imagesMap)) {
    const namespacedKey = `${prefix}${key}`;
    keyTranslation[key] = namespacedKey;
    updatedImagesMap[namespacedKey] = dataUrl;
    if (incomingProject.rawImages[key]) {
      updatedRawImages[namespacedKey] = incomingProject.rawImages[key];
    }
  }

  // 4. Calculate scaling & positioning relative to current project canvas
  const curW = currentProject.width || 500;
  const curH = currentProject.height || 500;
  const inW = incomingProject.width || 500;
  const inH = incomingProject.height || 500;

  let scaleFactor = mergedOptions.customScale || 1.0;
  if (mergedOptions.scaleMode === 'fit') {
    if (inW > curW || inH > curH) {
      scaleFactor = Math.min((curW * 0.85) / inW, (curH * 0.85) / inH);
    } else {
      scaleFactor = Math.min(curW / inW, curH / inH, 1.0);
    }
  }

  const scaledW = inW * scaleFactor;
  const scaledH = inH * scaleFactor;

  let offsetX = 0;
  let offsetY = 0;

  if (mergedOptions.placement === 'center') {
    offsetX = (curW - scaledW) / 2;
    offsetY = (curH - scaledH) / 2;
  } else if (mergedOptions.placement === 'top') {
    offsetX = (curW - scaledW) / 2;
    offsetY = curH * 0.05;
  } else if (mergedOptions.placement === 'bottom') {
    offsetX = (curW - scaledW) / 2;
    offsetY = curH - scaledH - curH * 0.05;
  }

  // 5. Adapt timeline frames & sprite entities
  const curTotalFrames = currentProject.totalFrames || 60;
  const inTotalFrames = incomingProject.totalFrames || 30;

  const transformedImportedLayers: EditableLayer[] = incomingLayers.map((layer, idx) => {
    const namespacedImageKey = keyTranslation[layer.imageKey] || `${prefix}${layer.imageKey}`;
    const namespacedMatteKey = layer.matteKey ? (keyTranslation[layer.matteKey] || `${prefix}${layer.matteKey}`) : undefined;

    // Clone and adapt frames to match current project frame duration
    const originalFrames = layer.spriteRef?.frames || [];
    const adaptedFrames: any[] = [];

    for (let f = 0; f < curTotalFrames; f++) {
      let sourceFrame: any;
      if (mergedOptions.loopFrames) {
        sourceFrame = originalFrames[f % inTotalFrames] || originalFrames[0] || {};
      } else {
        sourceFrame = f < inTotalFrames ? originalFrames[f] : null;
      }

      if (sourceFrame) {
        adaptedFrames.push(JSON.parse(JSON.stringify(sourceFrame)));
      } else {
        // Frame outside active range -> alpha = 0
        adaptedFrames.push({
          alpha: 0,
          layout: { x: 0, y: 0, width: layer.initialBounds.width, height: layer.initialBounds.height },
          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
        });
      }
    }

    // Apply scaling and offsets to the layer transform
    const newX = Number((layer.transform.x * scaleFactor + offsetX).toFixed(2));
    const newY = Number((layer.transform.y * scaleFactor + offsetY).toFixed(2));
    const newW = Number((layer.transform.width * scaleFactor).toFixed(2));
    const newH = Number((layer.transform.height * scaleFactor).toFixed(2));
    const newScaleX = Number((layer.transform.scaleX * scaleFactor).toFixed(4));
    const newScaleY = Number((layer.transform.scaleY * scaleFactor).toFixed(4));

    const newInitialX = Number((layer.initialBounds.x * scaleFactor + offsetX).toFixed(2));
    const newInitialY = Number((layer.initialBounds.y * scaleFactor + offsetY).toFixed(2));
    const newInitialW = Number((layer.initialBounds.width * scaleFactor).toFixed(2));
    const newInitialH = Number((layer.initialBounds.height * scaleFactor).toFixed(2));

    const clonedSpriteRef = {
      imageKey: namespacedImageKey,
      matteKey: namespacedMatteKey,
      frames: adaptedFrames
    };

    return {
      ...layer,
      id: `mrg_${timestamp}_${idx}_${randKey}`,
      originalIndex: currentLayers.length + idx,
      imageKey: namespacedImageKey,
      name: `${layer.name} (${importedGroupName})`,
      thumbnailUrl: updatedImagesMap[namespacedImageKey] || layer.thumbnailUrl,
      groupId: importedGroupId,
      groupName: importedGroupName,
      transform: {
        ...layer.transform,
        x: newX,
        y: newY,
        width: newW,
        height: newH,
        scaleX: newScaleX,
        scaleY: newScaleY
      },
      initialBounds: {
        x: newInitialX,
        y: newInitialY,
        width: newInitialW,
        height: newInitialH
      },
      spriteRef: clonedSpriteRef,
      framesCount: curTotalFrames,
      keyframeSummary: {
        startFrame: 0,
        endFrame: curTotalFrames - 1,
        hasShapes: layer.keyframeSummary?.hasShapes || false,
        hasTransform: true
      }
    };
  });

  // 6. Assemble merged project data & layers
  const updatedProject: SVGAProjectData = {
    ...currentProject,
    imagesMap: updatedImagesMap,
    rawImages: updatedRawImages
  };

  const updatedLayers = mergedOptions.layerPosition === 'top'
    ? [...transformedImportedLayers, ...currentLayers]
    : [...currentLayers, ...transformedImportedLayers];

  return {
    updatedProject,
    updatedLayers,
    importedGroupId,
    importedGroupName,
    importedLayersCount: transformedImportedLayers.length
  };
}

/**
 * Calculate the bounding box and centroid of all layers in a group
 */
export function getGroupBounds(layers: EditableLayer[], groupId: string): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  groupLayers: EditableLayer[];
} | null {
  const groupLayers = layers.filter(l => l.groupId === groupId);
  if (groupLayers.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const l of groupLayers) {
    const lx = l.transform.x;
    const ly = l.transform.y;
    const lw = l.transform.width || l.initialBounds.width || 50;
    const lh = l.transform.height || l.initialBounds.height || 50;

    minX = Math.min(minX, lx);
    minY = Math.min(minY, ly);
    maxX = Math.max(maxX, lx + lw);
    maxY = Math.max(maxY, ly + lh);
  }

  const width = Math.max(10, maxX - minX);
  const height = Math.max(10, maxY - minY);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return { minX, minY, maxX, maxY, width, height, centerX, centerY, groupLayers };
}

/**
 * Transform all layers in a group collectively (Scale, Move, Rotate, Opacity)
 */
export function transformLayerGroup(
  layers: EditableLayer[],
  groupId: string,
  deltas: {
    dx?: number;
    dy?: number;
    scaleMultiplier?: number;
    rotationDelta?: number;
    opacityDelta?: number;
    setOpacity?: number;
  }
): EditableLayer[] {
  const bounds = getGroupBounds(layers, groupId);
  if (!bounds) return layers;

  const { centerX, centerY } = bounds;
  const dx = deltas.dx || 0;
  const dy = deltas.dy || 0;
  const scaleMult = deltas.scaleMultiplier || 1.0;
  const rotDelta = deltas.rotationDelta || 0;
  const rad = (rotDelta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return layers.map(l => {
    if (l.groupId !== groupId) return l;

    const cur = l.transform;

    // 1. Shift position
    let px = cur.x + dx;
    let py = cur.y + dy;

    // 2. Scale relative to group center
    if (scaleMult !== 1.0) {
      px = centerX + (px - centerX) * scaleMult;
      py = centerY + (py - centerY) * scaleMult;
    }

    // 3. Rotate relative to group center
    if (rotDelta !== 0) {
      const relX = px - centerX;
      const relY = py - centerY;
      px = centerX + (relX * cos - relY * sin);
      py = centerY + (relX * sin + relY * cos);
    }

    const newWidth = Number((cur.width * scaleMult).toFixed(2));
    const newHeight = Number((cur.height * scaleMult).toFixed(2));
    const newScaleX = Number((cur.scaleX * scaleMult).toFixed(4));
    const newScaleY = Number((cur.scaleY * scaleMult).toFixed(4));
    const newRotation = Math.round((cur.rotation + rotDelta) % 360);

    let newOpacity = cur.opacity;
    if (deltas.setOpacity !== undefined) {
      newOpacity = Math.max(0, Math.min(100, deltas.setOpacity));
    } else if (deltas.opacityDelta !== undefined) {
      newOpacity = Math.max(0, Math.min(100, cur.opacity + deltas.opacityDelta));
    }

    return {
      ...l,
      transform: {
        ...cur,
        x: Number(px.toFixed(2)),
        y: Number(py.toFixed(2)),
        width: newWidth,
        height: newHeight,
        scaleX: newScaleX,
        scaleY: newScaleY,
        rotation: newRotation,
        opacity: newOpacity
      }
    };
  });
}

/**
 * Compound a parent transformation matrix onto a child layer's local bounds and keyframes
 */
export function compoundTransformToLayer(
  child: EditableLayer,
  parentTransform: EditableLayer['transform'],
  parentBounds: { x: number; y: number; width: number; height: number }
): EditableLayer {
  const cloned: EditableLayer = JSON.parse(JSON.stringify(child));

  const deltaX = parentTransform.x - parentBounds.x;
  const deltaY = parentTransform.y - parentBounds.y;
  const scaleX = parentTransform.scaleX || 1;
  const scaleY = parentTransform.scaleY || 1;
  const rotation = parentTransform.rotation || 0;
  const isIdentity = deltaX === 0 && deltaY === 0 && scaleX === 1 && scaleY === 1 && rotation === 0 && parentTransform.opacity === 100;

  if (isIdentity) {
    return cloned;
  }

  const pivotX = parentBounds.x + parentBounds.width / 2;
  const pivotY = parentBounds.y + parentBounds.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const uA = scaleX * cos;
  const uB = scaleX * sin;
  const uC = -scaleY * sin;
  const uD = scaleY * cos;
  const uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
  const uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);

  const transformPoint = (x: number, y: number) => ({
    x: uA * x + uC * y + uTx,
    y: uB * x + uD * y + uTy
  });

  const curPos = transformPoint(cloned.transform.x, cloned.transform.y);

  cloned.transform.x = Number(curPos.x.toFixed(2));
  cloned.transform.y = Number(curPos.y.toFixed(2));
  cloned.transform.width = Number(((cloned.transform.width || 50) * scaleX).toFixed(2));
  cloned.transform.height = Number(((cloned.transform.height || 50) * scaleY).toFixed(2));
  cloned.transform.scaleX = Number((cloned.transform.scaleX * scaleX).toFixed(4));
  cloned.transform.scaleY = Number((cloned.transform.scaleY * scaleY).toFixed(4));
  cloned.transform.rotation = Math.round((cloned.transform.rotation + rotation) % 360);
  cloned.transform.opacity = Math.round((cloned.transform.opacity * (parentTransform.opacity / 100)));

  if (cloned.keyframes && cloned.keyframes.length > 0) {
    cloned.keyframes = cloned.keyframes.map(kf => {
      const newKf = { ...kf };
      if (newKf.x !== undefined && newKf.y !== undefined) {
        const p = transformPoint(newKf.x, newKf.y);
        newKf.x = Number(p.x.toFixed(2));
        newKf.y = Number(p.y.toFixed(2));
      }
      if (newKf.scaleX !== undefined) newKf.scaleX = Number((newKf.scaleX * scaleX).toFixed(4));
      if (newKf.scaleY !== undefined) newKf.scaleY = Number((newKf.scaleY * scaleY).toFixed(4));
      if (newKf.rotation !== undefined) newKf.rotation = Math.round((newKf.rotation + rotation) % 360);
      if (newKf.opacity !== undefined) newKf.opacity = Math.round((newKf.opacity * (parentTransform.opacity / 100)));
      return newKf;
    });
  }

  // If the child itself is a merged layer with sublayers, recurse into its sublayers!
  if (cloned.mergedLayers && cloned.mergedLayers.length > 0) {
    cloned.mergedLayers = cloned.mergedLayers.map(sub =>
      compoundTransformToLayer(sub, parentTransform, parentBounds)
    );
  }

  return cloned;
}

/**
 * Recursively flattens a merged layer and its nested hierarchy into a flat array of sublayers
 */
export function flattenMergedLayer(layer: EditableLayer): EditableLayer[] {
  if (!layer.isMerged || !layer.mergedLayers || layer.mergedLayers.length === 0) {
    return [JSON.parse(JSON.stringify(layer))];
  }

  const result: EditableLayer[] = [];
  for (const sub of layer.mergedLayers) {
    const compounded = compoundTransformToLayer(sub, layer.transform, layer.initialBounds);
    const subFlattened = flattenMergedLayer(compounded);
    result.push(...subFlattened);
  }
  return result;
}

/**
 * Creates an offscreen snapshot thumbnail of all sublayers rendered together at frame 0
 */
export function generateMergedLayersThumbnail(
  sublayers: EditableLayer[],
  project: SVGAProjectData,
  bounds: { x: number; y: number; width: number; height: number }
): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    const tw = Math.min(300, Math.max(64, Math.round(bounds.width || 100)));
    const th = Math.min(300, Math.max(64, Math.round(bounds.height || 100)));
    canvas.width = tw;
    canvas.height = th;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.clearRect(0, 0, tw, th);

    const scaleX = tw / Math.max(1, bounds.width);
    const scaleY = th / Math.max(1, bounds.height);

    // Draw sublayers from bottom to top so index 0 is rendered on top in thumbnail
    const sublayersToDraw = [...sublayers].reverse();
    for (const sub of sublayersToDraw) {
      if (!sub.visible) continue;
      const subX = (sub.transform.x - bounds.x) * scaleX;
      const subY = (sub.transform.y - bounds.y) * scaleY;
      const subW = (sub.transform.width || sub.initialBounds.width || 40) * scaleX;
      const subH = (sub.transform.height || sub.initialBounds.height || 40) * scaleY;

      const imgDataUrl = project.imagesMap[sub.imageKey] || sub.thumbnailUrl;
      if (imgDataUrl) {
        const img = new Image();
        img.src = imgDataUrl;
        if (img.complete && img.naturalWidth > 0) {
          ctx.globalAlpha = Math.max(0, Math.min(1, sub.transform.opacity / 100));
          ctx.drawImage(img, subX, subY, subW, subH);
        }
      }
    }

    return canvas.toDataURL('image/png');
  } catch (e) {
    return undefined;
  }
}

/**
 * 2D Affine Matrix representation [a, b, c, d, tx, ty]
 */
export type AffineMatrix = [number, number, number, number, number, number];

export function invertAffineMatrix(m: AffineMatrix): AffineMatrix {
  const [a, b, c, d, tx, ty] = m;
  let det = a * d - b * c;
  if (Math.abs(det) < 1e-7) {
    det = 1;
  }
  const aInv = d / det;
  const bInv = -b / det;
  const cInv = -c / det;
  const dInv = a / det;
  const txInv = -(aInv * tx + cInv * ty);
  const tyInv = -(bInv * tx + dInv * ty);
  return [aInv, bInv, cInv, dInv, txInv, tyInv];
}

export function multiplyAffineMatrices(m1: AffineMatrix, m2: AffineMatrix): AffineMatrix {
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

/**
 * Calculates a dynamic motion score for a layer by analyzing changes in transform and keyframes
 */
export function calculateLayerMotionScore(layer: EditableLayer): number {
  let score = 0;

  // 1. User keyframes contribution
  if (layer.keyframes && layer.keyframes.length > 1) {
    score += layer.keyframes.length * 100;
  }

  // 2. Sprite frames contribution
  const frames = layer.spriteRef?.frames;
  if (frames && Array.isArray(frames) && frames.length > 1) {
    const f0 = frames[0] || {};
    const tx0 = f0.transform?.tx ?? 0;
    const ty0 = f0.transform?.ty ?? 0;
    const a0 = f0.transform?.a ?? 1;
    const d0 = f0.transform?.d ?? 1;
    const alpha0 = f0.alpha ?? 1;

    for (let f = 1; f < frames.length; f++) {
      const fr = frames[f];
      if (!fr) continue;
      const txf = fr.transform?.tx ?? 0;
      const tyf = fr.transform?.ty ?? 0;
      const af = fr.transform?.a ?? 1;
      const df = fr.transform?.d ?? 1;
      const alphaf = fr.alpha ?? 1;

      const dPos = Math.abs(txf - tx0) + Math.abs(tyf - ty0);
      const dScaleRot = Math.abs(af - a0) + Math.abs(df - d0);
      const dAlpha = Math.abs(alphaf - alpha0);

      score += dPos + dScaleRot * 20 + dAlpha * 10;
    }
  }

  return score;
}

/**
 * Finds the primary motion driver layer among a list of layers
 */
export function findMasterMotionLayer(layers: EditableLayer[]): EditableLayer | null {
  if (!layers || layers.length === 0) return null;

  let bestLayer: EditableLayer | null = null;
  let highestScore = 0.5; // Threshold for active motion

  for (const layer of layers) {
    const score = calculateLayerMotionScore(layer);
    if (score > highestScore) {
      highestScore = score;
      bestLayer = layer;
    }
  }

  return bestLayer;
}

/**
 * Synchronizes the frame-by-frame motion, trajectory, and opacity of a target layer
 * to follow a master reference animated layer with rigid body precision.
 */
export function syncLayerMotionWithReference(
  targetLayer: EditableLayer,
  referenceLayer: EditableLayer,
  totalFrames: number
): EditableLayer {
  const clonedTarget: EditableLayer = JSON.parse(JSON.stringify(targetLayer));
  const refFrames = referenceLayer.spriteRef?.frames || [];
  
  // Find first active frame of the reference layer
  let fRefIdx = 0;
  for (let f = 0; f < refFrames.length; f++) {
    const fr = refFrames[f];
    if (fr && (fr.alpha === undefined || fr.alpha > 0.005)) {
      fRefIdx = f;
      break;
    }
  }

  const fRef0 = refFrames[fRefIdx] || refFrames[0] || {};
  const mRef0: AffineMatrix = [
    fRef0.transform?.a ?? 1,
    fRef0.transform?.b ?? 0,
    fRef0.transform?.c ?? 0,
    fRef0.transform?.d ?? 1,
    fRef0.transform?.tx ?? 0,
    fRef0.transform?.ty ?? 0
  ];
  const mRef0Inv = invertAffineMatrix(mRef0);
  const refAlpha0 = fRef0.alpha !== undefined ? fRef0.alpha : 1.0;

  // Clone or initialize target frames
  const targetFrames = clonedTarget.spriteRef?.frames || [];
  const targetInitialW = clonedTarget.initialBounds.width || 100;
  const targetInitialH = clonedTarget.initialBounds.height || 100;

  const syncedFrames: any[] = [];

  for (let f = 0; f < totalFrames; f++) {
    const refFr = refFrames[f] || refFrames[f % Math.max(1, refFrames.length)] || {};
    const mRefF: AffineMatrix = [
      refFr.transform?.a ?? 1,
      refFr.transform?.b ?? 0,
      refFr.transform?.c ?? 0,
      refFr.transform?.d ?? 1,
      refFr.transform?.tx ?? 0,
      refFr.transform?.ty ?? 0
    ];

    // Relative delta matrix of reference motion: Delta M_ref(f) = M_ref(f) * (M_ref(f0))^(-1)
    const deltaMRef = multiplyAffineMatrices(mRefF, mRef0Inv);

    // Get target's own base frame
    const targetFr = targetFrames[f] || targetFrames[0] || {};
    const mTgt0: AffineMatrix = [
      targetFr.transform?.a ?? 1,
      targetFr.transform?.b ?? 0,
      targetFr.transform?.c ?? 0,
      targetFr.transform?.d ?? 1,
      targetFr.transform?.tx ?? 0,
      targetFr.transform?.ty ?? 0
    ];

    // Combined synchronized transform: M_synced(f) = Delta M_ref(f) * M_tgt(0)
    const mSynced = multiplyAffineMatrices(deltaMRef, mTgt0);

    // Synchronize Alpha & Visibility
    const refAlpha = refFr.alpha !== undefined ? refFr.alpha : 1.0;
    const tgtAlpha = targetFr.alpha !== undefined ? targetFr.alpha : 1.0;
    let finalAlpha = tgtAlpha;
    if (refAlpha < 0.005) {
      finalAlpha = 0.0;
    } else {
      finalAlpha = Math.max(0, Math.min(1, tgtAlpha * (refAlpha / (refAlpha0 || 1))));
    }

    syncedFrames.push({
      ...targetFr,
      alpha: parseFloat(finalAlpha.toFixed(3)),
      layout: targetFr.layout || { x: 0, y: 0, width: targetInitialW, height: targetInitialH },
      transform: {
        a: parseFloat(mSynced[0].toFixed(5)),
        b: parseFloat(mSynced[1].toFixed(5)),
        c: parseFloat(mSynced[2].toFixed(5)),
        d: parseFloat(mSynced[3].toFixed(5)),
        tx: parseFloat(mSynced[4].toFixed(2)),
        ty: parseFloat(mSynced[5].toFixed(2))
      }
    });
  }

  clonedTarget.spriteRef = {
    ...clonedTarget.spriteRef,
    frames: syncedFrames
  };
  clonedTarget.framesCount = totalFrames;
  clonedTarget.isMotionSynced = true;
  clonedTarget.motionReferenceLayerId = referenceLayer.id;
  clonedTarget.keyframeSummary = {
    startFrame: referenceLayer.keyframeSummary?.startFrame ?? 0,
    endFrame: referenceLayer.keyframeSummary?.endFrame ?? (totalFrames - 1),
    hasShapes: clonedTarget.keyframeSummary?.hasShapes || false,
    hasTransform: true
  };

  // If reference layer has keyframes, mirror them
  if (referenceLayer.keyframes && referenceLayer.keyframes.length > 0) {
    clonedTarget.keyframes = JSON.parse(JSON.stringify(referenceLayer.keyframes));
  }

  return clonedTarget;
}

/**
 * Merge multiple layers into a single unified `Merged Layer`.
 * Fully preserves all keyframe animations, vectors, transforms, timing, FPS, and effects.
 * Automatically synchronizes motion so static/new layers inherit the motion of animated layers!
 * Supports cumulative merging (Merged Layer + New Layer -> Merged Layer).
 */
export function mergeLayersIntoSingleLayer(
  layersToMerge: EditableLayer[],
  allLayers: EditableLayer[],
  project: SVGAProjectData,
  options: {
    name?: string;
    isAll?: boolean;
    syncMotion?: boolean;
    motionSourceId?: string;
  } = {}
): {
  updatedLayers: EditableLayer[];
  mergedLayer: EditableLayer;
  newImagesMap?: Record<string, string>;
} {
  if (layersToMerge.length === 0) {
    throw new Error("لا توجد طبقات محددة للدمج");
  }

  // 1. Flatten all selected layers (expanding any already-merged layers while preserving their transforms)
  let flattenedSublayers: EditableLayer[] = [];
  for (const layer of layersToMerge) {
    const flattened = flattenMergedLayer(layer);
    flattenedSublayers.push(...flattened);
  }

  // 1.5. Synchronize motion: ONLY when explicitly requested for specific layers with a designated motion source
  const shouldSyncMotion = options.syncMotion === true && !!options.motionSourceId;
  let masterMotionLayer: EditableLayer | null = null;

  if (shouldSyncMotion) {
    masterMotionLayer = flattenedSublayers.find(l => l.id === options.motionSourceId) || null;

    if (masterMotionLayer) {
      const totalFrames = project.totalFrames || 60;
      flattenedSublayers = flattenedSublayers.map(sub => {
        if (sub.id === masterMotionLayer!.id) {
          return sub;
        }
        return syncLayerMotionWithReference(sub, masterMotionLayer!, totalFrames);
      });
    }
  }

  // 2. Compute the collective initial bounding box across all flattened sublayers
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (options.isAll || layersToMerge.length === allLayers.length) {
    // When merging all layers of the project, the merged container bounds match the canvas viewport
    minX = 0;
    minY = 0;
    maxX = project.width;
    maxY = project.height;
  } else {
    for (const l of flattenedSublayers) {
      const lx = l.transform.x;
      const ly = l.transform.y;
      const lw = l.transform.width || l.initialBounds.width || 20;
      const lh = l.transform.height || l.initialBounds.height || 20;

      // Filter out crazy extreme off-screen coordinates (> 2x project dimensions away)
      if (lx < -project.width || ly < -project.height || lx > project.width * 2 || ly > project.height * 2) {
        continue;
      }

      minX = Math.min(minX, lx);
      minY = Math.min(minY, ly);
      maxX = Math.max(maxX, lx + lw);
      maxY = Math.max(maxY, ly + lh);
    }

    if (minX === Infinity || !isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = project.width || 500;
      maxY = project.height || 500;
    }
  }

  const width = Math.max(10, Number((maxX - minX).toFixed(2)));
  const height = Math.max(10, Number((maxY - minY).toFixed(2)));
  const initialBounds = { x: Number(minX.toFixed(2)), y: Number(minY.toFixed(2)), width, height };

  // 3. Generate unique identifiers for the new Merged Layer
  const timestamp = Date.now();
  const randKey = Math.random().toString(36).substring(2, 7);
  const mergedId = `mrg_layer_${timestamp}_${randKey}`;
  const mergedImageKey = `mrg_img_${timestamp}_${randKey}`;

  const defaultName = options.isAll
    ? `دمج الكل (Merged Layer)`
    : layersToMerge.length > 2
    ? `دمج (${layersToMerge.length} طبقات)`
    : `دمج (${layersToMerge.map(l => l.name).join(' + ')})`;

  const mergedName = options.name || defaultName;

  // 4. Generate thumbnail for the merged layer
  const thumbnailUrl = generateMergedLayersThumbnail(flattenedSublayers, project, initialBounds) ||
    flattenedSublayers.find(l => l.thumbnailUrl)?.thumbnailUrl;

  const newImagesMap: Record<string, string> = {};
  if (thumbnailUrl) {
    newImagesMap[mergedImageKey] = thumbnailUrl;
  }

  // 5. Construct the new unified EditableLayer
  const mergedLayer: EditableLayer = {
    id: mergedId,
    originalIndex: Math.min(...layersToMerge.map(l => l.originalIndex ?? 0)),
    imageKey: mergedImageKey,
    name: mergedName,
    type: 'composite',
    visible: true,
    locked: false,
    thumbnailUrl,
    isMerged: true,
    mergedLayers: flattenedSublayers,
    mergedLayersCount: flattenedSublayers.length,
    isMotionSynced: !!masterMotionLayer,
    motionReferenceLayerId: masterMotionLayer?.id,
    aspectRatioLocked: false,
    initialBounds,
    transform: {
      x: initialBounds.x,
      y: initialBounds.y,
      width: initialBounds.width,
      height: initialBounds.height,
      scaleX: 1.0,
      scaleY: 1.0,
      rotation: 0,
      opacity: 100
    },
    keyframes: undefined, // Clean group transform at rest
    framesCount: project.totalFrames || 60,
    keyframeSummary: {
      startFrame: masterMotionLayer?.keyframeSummary?.startFrame ?? 0,
      endFrame: masterMotionLayer?.keyframeSummary?.endFrame ?? ((project.totalFrames || 60) - 1),
      hasShapes: flattenedSublayers.some(l => l.keyframeSummary?.hasShapes),
      hasTransform: true
    },
    spriteRef: {
      imageKey: mergedImageKey,
      frames: []
    }
  };

  // 6. Build updatedLayers array
  let updatedLayers: EditableLayer[];

  if (options.isAll || layersToMerge.length === allLayers.length) {
    updatedLayers = [mergedLayer];
  } else {
    const targetIds = new Set(layersToMerge.map(l => l.id));
    const firstIndex = allLayers.findIndex(l => targetIds.has(l.id));
    const insertIdx = firstIndex !== -1 ? firstIndex : 0;

    const remaining = allLayers.filter(l => !targetIds.has(l.id));
    updatedLayers = [
      ...remaining.slice(0, insertIdx),
      mergedLayer,
      ...remaining.slice(insertIdx)
    ];
  }

  return {
    updatedLayers,
    mergedLayer,
    newImagesMap
  };
}

/**
 * Ungroups a merged layer back into its individual component layers
 */
export function ungroupMergedLayer(
  mergedLayerId: string,
  allLayers: EditableLayer[]
): EditableLayer[] {
  const targetLayer = allLayers.find(l => l.id === mergedLayerId);
  if (!targetLayer || !targetLayer.isMerged || !targetLayer.mergedLayers) {
    return allLayers;
  }

  const unbundledLayers = flattenMergedLayer(targetLayer);
  const targetIndex = allLayers.findIndex(l => l.id === mergedLayerId);

  const updated = [
    ...allLayers.slice(0, targetIndex),
    ...unbundledLayers,
    ...allLayers.slice(targetIndex + 1)
  ];

  return updated;
}
