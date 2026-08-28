import { EditableLayer, LayerKeyframe, LayerTransform, KeyframeEasing } from './types';

// Standard bezier solver for cubic-bezier(p1x, p1y, p2x, p2y)
function solveCubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Newton-Raphson method to find parameter `u` where Bx(u) = t
  let u = t;
  for (let i = 0; i < 8; i++) {
    // Bx(u) = 3(1-u)^2 * u * p1x + 3(1-u) * u^2 * p2x + u^3
    const currentX = 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u;
    const dx = currentX - t;
    if (Math.abs(dx) < 1e-5) break;

    // Derivative d(Bx)/du = 3(1-u)^2*p1x + 6(1-u)*u*(p2x-p1x) + 3u^2*(1-p2x)
    const slope = 3 * (1 - u) * (1 - u) * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
    if (Math.abs(slope) < 1e-5) break;
    u -= dx / slope;
    u = Math.max(0, Math.min(1, u));
  }

  // By(u) = 3(1-u)^2 * u * p1y + 3(1-u) * u^2 * p2y + u^3
  return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u;
}

// Calculate easing progress `E(t)` where t is [0..1]
export function evaluateEasing(
  t: number, 
  easing: KeyframeEasing = 'linear', 
  customBezier?: [number, number, number, number]
): number {
  const clamped = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return clamped;
    case 'ease-in':
      return solveCubicBezier(clamped, 0.42, 0.0, 1.0, 1.0);
    case 'ease-out':
      return solveCubicBezier(clamped, 0.0, 0.0, 0.58, 1.0);
    case 'ease-in-out':
      return solveCubicBezier(clamped, 0.42, 0.0, 0.58, 1.0);
    case 'cubic-bezier':
      if (customBezier && customBezier.length === 4) {
        return solveCubicBezier(clamped, customBezier[0], customBezier[1], customBezier[2], customBezier[3]);
      }
      return solveCubicBezier(clamped, 0.25, 0.1, 0.25, 1.0);
    case 'step':
      return clamped >= 1 ? 1 : 0;
    default:
      return clamped;
  }
}

// Get the interpolated transform for a layer at a specific frame index
export function getLayerAnimatedTransform(layer: EditableLayer, frame: number): LayerTransform {
  const baseTransform: LayerTransform = { ...layer.transform };
  const keyframes = layer.keyframes;

  // If no keyframes exist, return the base static transform
  if (!keyframes || keyframes.length === 0) {
    return baseTransform;
  }

  // Sort keyframes ascending by frame
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

  // 1. If frame is before or at first keyframe
  if (frame <= sorted[0].frame) {
    const k0 = sorted[0];
    return {
      x: k0.x !== undefined ? k0.x : baseTransform.x,
      y: k0.y !== undefined ? k0.y : baseTransform.y,
      width: baseTransform.width,
      height: baseTransform.height,
      scaleX: k0.scaleX !== undefined ? k0.scaleX : baseTransform.scaleX,
      scaleY: k0.scaleY !== undefined ? k0.scaleY : baseTransform.scaleY,
      rotation: k0.rotation !== undefined ? k0.rotation : baseTransform.rotation,
      opacity: k0.opacity !== undefined ? k0.opacity : baseTransform.opacity,
    };
  }

  // 2. If frame is after or at last keyframe
  const lastKey = sorted[sorted.length - 1];
  if (frame >= lastKey.frame) {
    return {
      x: lastKey.x !== undefined ? lastKey.x : baseTransform.x,
      y: lastKey.y !== undefined ? lastKey.y : baseTransform.y,
      width: baseTransform.width,
      height: baseTransform.height,
      scaleX: lastKey.scaleX !== undefined ? lastKey.scaleX : baseTransform.scaleX,
      scaleY: lastKey.scaleY !== undefined ? lastKey.scaleY : baseTransform.scaleY,
      rotation: lastKey.rotation !== undefined ? lastKey.rotation : baseTransform.rotation,
      opacity: lastKey.opacity !== undefined ? lastKey.opacity : baseTransform.opacity,
    };
  }

  // 3. Find the two bounding keyframes [kA, kB] for each property
  const interpolateProp = (
    prop: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity',
    defaultValue: number
  ): number => {
    // Find previous keyframe with this property defined
    let prevKey: LayerKeyframe | null = null;
    let nextKey: LayerKeyframe | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const k = sorted[i];
      if (k[prop] !== undefined) {
        if (k.frame <= frame) {
          prevKey = k;
        } else if (k.frame > frame && !nextKey) {
          nextKey = k;
          break;
        }
      }
    }

    // If neither exists, fallback to base default
    if (!prevKey && !nextKey) return defaultValue;
    if (!prevKey) return nextKey![prop] !== undefined ? nextKey![prop]! : defaultValue;
    if (!nextKey) return prevKey[prop] !== undefined ? prevKey[prop]! : defaultValue;

    // Both exist: interpolate between prevKey and nextKey
    const frameDiff = nextKey.frame - prevKey.frame;
    if (frameDiff <= 0) return prevKey[prop]!;

    const rawT = (frame - prevKey.frame) / frameDiff;
    const easedT = evaluateEasing(rawT, prevKey.easing, prevKey.cubicBezier);

    const valA = prevKey[prop]!;
    const valB = nextKey[prop]!;
    return valA + (valB - valA) * easedT;
  };

  return {
    x: interpolateProp('x', baseTransform.x),
    y: interpolateProp('y', baseTransform.y),
    width: baseTransform.width,
    height: baseTransform.height,
    scaleX: interpolateProp('scaleX', baseTransform.scaleX),
    scaleY: interpolateProp('scaleY', baseTransform.scaleY),
    rotation: interpolateProp('rotation', baseTransform.rotation),
    opacity: interpolateProp('opacity', baseTransform.opacity)
  };
}

// Generate unique Keyframe ID
export function generateKeyframeId(): string {
  return 'kf_' + Math.random().toString(36).substring(2, 9);
}

// Helper to upsert a keyframe at specific frame for a layer
export function upsertKeyframe(
  layer: EditableLayer,
  frame: number,
  values: Partial<LayerTransform>,
  easing: KeyframeEasing = 'ease-in-out',
  cubicBezier: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0]
): LayerKeyframe[] {
  const existingList = layer.keyframes ? [...layer.keyframes] : [];
  const existingIdx = existingList.findIndex(k => k.frame === frame);

  if (existingIdx >= 0) {
    // Update existing keyframe
    existingList[existingIdx] = {
      ...existingList[existingIdx],
      ...values,
      easing: existingList[existingIdx].easing || easing,
      cubicBezier: existingList[existingIdx].cubicBezier || cubicBezier
    };
  } else {
    // Insert new keyframe
    existingList.push({
      id: generateKeyframeId(),
      frame,
      ...values,
      easing,
      cubicBezier
    });
  }

  return existingList.sort((a, b) => a.frame - b.frame);
}

// Helper to delete a keyframe
export function deleteKeyframe(layer: EditableLayer, keyframeId: string): LayerKeyframe[] {
  if (!layer.keyframes) return [];
  return layer.keyframes.filter(k => k.id !== keyframeId);
}

// Helper to move a keyframe to a new frame
export function moveKeyframe(layer: EditableLayer, keyframeId: string, targetFrame: number): LayerKeyframe[] {
  if (!layer.keyframes) return [];
  return layer.keyframes
    .map(k => (k.id === keyframeId ? { ...k, frame: targetFrame } : k))
    .sort((a, b) => a.frame - b.frame);
}
