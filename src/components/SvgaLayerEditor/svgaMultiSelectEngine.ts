import { EditableLayer } from './types';

export interface MultiSelectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Calculate collective bounding box for arbitrary set of selected layer IDs
 */
export function getSelectedLayersBounds(layers: EditableLayer[], targetIds: string[]): MultiSelectBounds | null {
  const targetLayers = layers.filter(l => targetIds.includes(l.id));
  if (targetLayers.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const l of targetLayers) {
    const lx = l.transform.x;
    const ly = l.transform.y;
    const lw = l.transform.width || l.initialBounds.width || 10;
    const lh = l.transform.height || l.initialBounds.height || 10;

    minX = Math.min(minX, lx);
    minY = Math.min(minY, ly);
    maxX = Math.max(maxX, lx + lw);
    maxY = Math.max(maxY, ly + lh);
  }

  if (minX === Infinity) return null;

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return { minX, minY, maxX, maxY, width, height, centerX, centerY };
}

/**
 * Collective transformation on all layers in targetIds array
 */
export function transformSelectedLayers(
  layers: EditableLayer[],
  targetIds: string[],
  deltas: {
    dx?: number;
    dy?: number;
    scaleMultiplier?: number;
    scaleMultiplierX?: number;
    scaleMultiplierY?: number;
    flipHorizontally?: boolean;
    flipVertically?: boolean;
    rotationDelta?: number;
    setRotation?: number;
    opacityDelta?: number;
    setOpacity?: number;
    alignToCanvas?: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'centerAll';
    canvasWidth?: number;
    canvasHeight?: number;
  }
): EditableLayer[] {
  if (targetIds.length === 0) return layers;

  const bounds = getSelectedLayersBounds(layers, targetIds);
  if (!bounds) return layers;

  const { centerX, centerY, minX, minY, maxX, maxY, width, height } = bounds;
  let dx = deltas.dx || 0;
  let dy = deltas.dy || 0;

  // Handle alignment to canvas if requested
  if (deltas.alignToCanvas && deltas.canvasWidth && deltas.canvasHeight) {
    const cw = deltas.canvasWidth;
    const ch = deltas.canvasHeight;

    if (deltas.alignToCanvas === 'left') {
      dx = -minX;
    } else if (deltas.alignToCanvas === 'right') {
      dx = cw - maxX;
    } else if (deltas.alignToCanvas === 'centerX') {
      dx = (cw / 2) - centerX;
    } else if (deltas.alignToCanvas === 'top') {
      dy = -minY;
    } else if (deltas.alignToCanvas === 'bottom') {
      dy = ch - maxY;
    } else if (deltas.alignToCanvas === 'centerY') {
      dy = (ch / 2) - centerY;
    } else if (deltas.alignToCanvas === 'centerAll') {
      dx = (cw / 2) - centerX;
      dy = (ch / 2) - centerY;
    }
  }

  const scaleMult = deltas.scaleMultiplier || 1.0;
  const scaleMultX = deltas.scaleMultiplierX ?? scaleMult;
  const scaleMultY = deltas.scaleMultiplierY ?? scaleMult;
  const rotDelta = deltas.rotationDelta || 0;
  const rad = (rotDelta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return layers.map(l => {
    if (!targetIds.includes(l.id)) return l;

    const cur = l.transform;

    // 1. Shift position
    let px = cur.x + dx;
    let py = cur.y + dy;

    // 2. Scale relative to collective center
    if (scaleMultX !== 1.0) {
      px = centerX + (px - centerX) * scaleMultX;
    }
    if (scaleMultY !== 1.0) {
      py = centerY + (py - centerY) * scaleMultY;
    }

    // 3. Flip horizontally / vertically around collective center
    let newScaleX = cur.scaleX * scaleMultX;
    let newScaleY = cur.scaleY * scaleMultY;

    if (deltas.flipHorizontally) {
      const relX = px - centerX;
      px = centerX - relX;
      newScaleX = -newScaleX;
    }
    if (deltas.flipVertically) {
      const relY = py - centerY;
      py = centerY - relY;
      newScaleY = -newScaleY;
    }

    // 4. Rotate relative to collective center
    if (rotDelta !== 0) {
      const relX = px - centerX;
      const relY = py - centerY;
      px = centerX + (relX * cos - relY * sin);
      py = centerY + (relX * sin + relY * cos);
    }

    const newWidth = Math.max(1, Number((cur.width * scaleMultX).toFixed(2)));
    const newHeight = Math.max(1, Number((cur.height * scaleMultY).toFixed(2)));
    newScaleX = Number(newScaleX.toFixed(4));
    newScaleY = Number(newScaleY.toFixed(4));
    
    let newRotation = cur.rotation;
    if (deltas.setRotation !== undefined) {
      newRotation = Math.round(deltas.setRotation % 360);
    } else if (rotDelta !== 0) {
      newRotation = Math.round((cur.rotation + rotDelta) % 360);
    }

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
 * Bulk reorder selected layers in the layer stack (top, bottom, up, down)
 * Preserves relative ordering among the selected layers.
 */
export function reorderSelectedLayers(
  layers: EditableLayer[],
  targetIds: string[],
  direction: 'up' | 'down' | 'top' | 'bottom'
): EditableLayer[] {
  if (targetIds.length === 0) return layers;

  if (direction === 'top') {
    const selected = layers.filter(l => targetIds.includes(l.id));
    const unselected = layers.filter(l => !targetIds.includes(l.id));
    return [...selected, ...unselected];
  }

  if (direction === 'bottom') {
    const selected = layers.filter(l => targetIds.includes(l.id));
    const unselected = layers.filter(l => !targetIds.includes(l.id));
    return [...unselected, ...selected];
  }

  if (direction === 'up') {
    const newLayers = [...layers];
    for (let i = 0; i < newLayers.length; i++) {
      if (targetIds.includes(newLayers[i].id)) {
        if (i > 0 && !targetIds.includes(newLayers[i - 1].id)) {
          // Swap with previous unselected layer
          const temp = newLayers[i];
          newLayers[i] = newLayers[i - 1];
          newLayers[i - 1] = temp;
        }
      }
    }
    return newLayers;
  }

  if (direction === 'down') {
    const newLayers = [...layers];
    for (let i = newLayers.length - 1; i >= 0; i--) {
      if (targetIds.includes(newLayers[i].id)) {
        if (i < newLayers.length - 1 && !targetIds.includes(newLayers[i + 1].id)) {
          // Swap with next unselected layer
          const temp = newLayers[i];
          newLayers[i] = newLayers[i + 1];
          newLayers[i + 1] = temp;
        }
      }
    }
    return newLayers;
  }

  return layers;
}

/**
 * Move all selected layers together above or below a specific target layer
 */
export function moveSelectedLayersToTarget(
  layers: EditableLayer[],
  targetIds: string[],
  targetLayerId: string,
  position: 'above' | 'below'
): EditableLayer[] {
  if (targetIds.length === 0 || targetIds.includes(targetLayerId)) return layers;

  const selected = layers.filter(l => targetIds.includes(l.id));
  const unselected = layers.filter(l => !targetIds.includes(l.id));

  const targetIdx = unselected.findIndex(l => l.id === targetLayerId);
  if (targetIdx === -1) return layers;

  const insertIdx = position === 'above' ? targetIdx : targetIdx + 1;
  const result = [...unselected];
  result.splice(insertIdx, 0, ...selected);
  return result;
}

/**
 * Duplicate all selected layers simultaneously
 */
export function duplicateSelectedLayers(
  layers: EditableLayer[],
  targetIds: string[],
  mirror: boolean = false,
  canvasWidth: number = 500
): { updatedLayers: EditableLayer[]; newSelectedIds: string[] } {
  if (targetIds.length === 0) {
    return { updatedLayers: layers, newSelectedIds: [] };
  }

  const newSelectedIds: string[] = [];
  const clonedLayers: EditableLayer[] = [];

  for (const layer of layers) {
    if (targetIds.includes(layer.id)) {
      const timestamp = Date.now();
      const randKey = Math.random().toString(36).substring(2, 6);
      const newId = `layer_${timestamp}_${randKey}_copy`;
      newSelectedIds.push(newId);

      const cloned: EditableLayer = JSON.parse(JSON.stringify(layer));
      cloned.id = newId;
      cloned.locked = false;
      cloned.name = `${layer.name} (نسخة ${mirror ? 'معكوسة' : ''})`;
      cloned.isDuplicate = true;
      cloned.sourceLayerId = layer.id;
      cloned.isMotionSynced = false;
      cloned.motionReferenceLayerId = undefined;

      if (mirror) {
        cloned.transform.x = canvasWidth - layer.transform.x;
        cloned.transform.scaleX = -layer.transform.scaleX;
        if (cloned.transform.rotation) {
          cloned.transform.rotation = -cloned.transform.rotation;
        }
        if (cloned.keyframes) {
          cloned.keyframes.forEach(kf => {
            if (kf.x !== undefined) kf.x = canvasWidth - kf.x;
            if (kf.scaleX !== undefined) kf.scaleX = -kf.scaleX;
            if (kf.rotation !== undefined) kf.rotation = -kf.rotation;
          });
        }
      } else {
        cloned.transform.x = layer.transform.x + 20;
        cloned.transform.y = layer.transform.y + 20;
        if (cloned.keyframes) {
          cloned.keyframes.forEach(kf => {
            if (kf.x !== undefined) kf.x += 20;
            if (kf.y !== undefined) kf.y += 20;
          });
        }
      }

      // Initialize cloned layer's own isolated snapshot
      cloned.originalInitialBounds = {
        x: cloned.transform.x,
        y: cloned.transform.y,
        width: cloned.transform.width,
        height: cloned.transform.height
      };
      cloned.initialBounds = { ...cloned.originalInitialBounds };
      cloned.originalTransform = JSON.parse(JSON.stringify(cloned.transform));
      cloned.originalSpriteFrames = JSON.parse(JSON.stringify(cloned.spriteRef?.frames || []));
      cloned.originalKeyframes = cloned.keyframes ? JSON.parse(JSON.stringify(cloned.keyframes)) : undefined;

      clonedLayers.push(cloned);
    }
  }

  return {
    updatedLayers: [...clonedLayers, ...layers],
    newSelectedIds
  };
}

/**
 * Delete all selected layers in one operation
 */
export function deleteSelectedLayers(
  layers: EditableLayer[],
  targetIds: string[]
): EditableLayer[] {
  return layers.filter(l => !targetIds.includes(l.id));
}

