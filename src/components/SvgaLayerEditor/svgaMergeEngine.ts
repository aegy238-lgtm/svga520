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
