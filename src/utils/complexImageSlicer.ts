/**
 * Smart Complex Image Decomposer & Slicer
 * خوارزميات ذكية متقدمة لقص وتفكيك الصور المعقدة والمتداخلة
 */

import { DetectedElement } from './smartImageSegmentation';

export type DecomposeMode = 
  | 'crest_symmetric'     // تفكيك تماثلي للأطر والشارات (تاج، أجنحة، إطار، شريط)
  | 'bottleneck_valleys'  // كسر نقاط التضيّق والوصلات الرفيعة
  | 'smart_grid_2x2'      // تقسيم شبكي ذكي 2×2 مع تشذيب تلقائي
  | 'smart_grid_3x2'      // تقسيم شبكي ذكي 3×2 (أعمدة × صفوف)
  | 'smart_grid_3x3'      // تقسيم شبكي ذكي 3×3
  | 'color_clustering'    // فصل لوني وطبقي
  | 'knife_line';         // قطع تفاعلي بخط السكين

export interface DecomposeOptions {
  mode: DecomposeMode;
  padding?: number;
  sensitivity?: number;
  minPartSize?: number;
  gridCols?: number;
  gridRows?: number;
  knifeLine?: { x1: number; y1: number; x2: number; y2: number };
}

export interface DecomposeResult {
  mode: DecomposeMode;
  title: string;
  description: string;
  elements: DetectedElement[];
}

/**
 * Finds the exact non-transparent bounding box within a sub-rectangle of an image/canvas.
 */
export function trimNonTransparentBox(
  ctx: CanvasRenderingContext2D,
  subX: number,
  subY: number,
  subW: number,
  subH: number,
  alphaThreshold: number = 20
): { x: number; y: number; width: number; height: number; pixelCount: number } | null {
  const clampX = Math.max(0, Math.floor(subX));
  const clampY = Math.max(0, Math.floor(subY));
  const clampW = Math.max(1, Math.floor(subW));
  const clampH = Math.max(1, Math.floor(subH));

  const imgData = ctx.getImageData(clampX, clampY, clampW, clampH);
  const data = imgData.data;

  let minX = clampW;
  let minY = clampH;
  let maxX = -1;
  let maxY = -1;
  let pixelCount = 0;

  for (let py = 0; py < clampH; py++) {
    const rowOffset = py * clampW * 4;
    for (let px = 0; px < clampW; px++) {
      const idx = rowOffset + px * 4;
      const alpha = data[idx + 3];
      if (alpha > alphaThreshold) {
        pixelCount++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }

  if (maxX === -1 || pixelCount < 30) {
    return null;
  }

  return {
    x: clampX + minX,
    y: clampY + minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    pixelCount
  };
}

/**
 * Mode 1: Crest & Badge Symmetric Decomposition
 * تفكيك الأطر والشارات المعقدة (مثل أطر الأفاتار والرتب)
 * يستخرج التاج، الأجنحة، الإطار المركزي، والشريط السفلي
 */
export function decomposeSymmetricCrest(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetBox: { x: number; y: number; width: number; height: number },
  startIdx: number = 1
): DetectedElement[] {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(sourceImage, 0, 0);

  const { x, y, width: w, height: h } = targetBox;
  const parts: DetectedElement[] = [];

  // Segment 1: Top Crown / Crest (التاج أو الزخرفة العلوية)
  // Region: Top ~35% height, centered horizontally
  const crownTrim = trimNonTransparentBox(
    ctx,
    x + w * 0.18,
    y,
    w * 0.64,
    h * 0.38
  );
  if (crownTrim && crownTrim.width > 20 && crownTrim.height > 20) {
    const id = `part_crown_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    parts.push({
      id,
      index: startIdx + parts.length,
      label: 'تاج_علوي',
      rawX: crownTrim.x,
      rawY: crownTrim.y,
      rawWidth: crownTrim.width,
      rawHeight: crownTrim.height,
      x: crownTrim.x,
      y: crownTrim.y,
      width: crownTrim.width,
      height: crownTrim.height,
      selected: true
    });
  }

  // Segment 2: Left Wing / Left Crest (الجناح الأيسر)
  // Region: Left 42% width, middle height span
  const leftWingTrim = trimNonTransparentBox(
    ctx,
    x,
    y + h * 0.05,
    w * 0.44,
    h * 0.85
  );
  if (leftWingTrim && leftWingTrim.width > 25 && leftWingTrim.height > 25) {
    const id = `part_lwing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    parts.push({
      id,
      index: startIdx + parts.length,
      label: 'جناح_أيسر',
      rawX: leftWingTrim.x,
      rawY: leftWingTrim.y,
      rawWidth: leftWingTrim.width,
      rawHeight: leftWingTrim.height,
      x: leftWingTrim.x,
      y: leftWingTrim.y,
      width: leftWingTrim.width,
      height: leftWingTrim.height,
      selected: true
    });
  }

  // Segment 3: Right Wing / Right Crest (الجناح الأيمن)
  // Region: Right 42% width, middle height span
  const rightWingTrim = trimNonTransparentBox(
    ctx,
    x + w * 0.56,
    y + h * 0.05,
    w * 0.44,
    h * 0.85
  );
  if (rightWingTrim && rightWingTrim.width > 25 && rightWingTrim.height > 25) {
    const id = `part_rwing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    parts.push({
      id,
      index: startIdx + parts.length,
      label: 'جناح_أيمن',
      rawX: rightWingTrim.x,
      rawY: rightWingTrim.y,
      rawWidth: rightWingTrim.width,
      rawHeight: rightWingTrim.height,
      x: rightWingTrim.x,
      y: rightWingTrim.y,
      width: rightWingTrim.width,
      height: rightWingTrim.height,
      selected: true
    });
  }

  // Segment 4: Center Core / Avatar Ring (الإطار الدائري الداخلي)
  // Region: Middle 56% width, middle 56% height
  const centerRingTrim = trimNonTransparentBox(
    ctx,
    x + w * 0.22,
    y + h * 0.22,
    w * 0.56,
    h * 0.56
  );
  if (centerRingTrim && centerRingTrim.width > 30 && centerRingTrim.height > 30) {
    const id = `part_core_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    parts.push({
      id,
      index: startIdx + parts.length,
      label: 'إطار_مركزي',
      rawX: centerRingTrim.x,
      rawY: centerRingTrim.y,
      rawWidth: centerRingTrim.width,
      rawHeight: centerRingTrim.height,
      x: centerRingTrim.x,
      y: centerRingTrim.y,
      width: centerRingTrim.width,
      height: centerRingTrim.height,
      selected: true
    });
  }

  // Segment 5: Bottom Ribbon / "Top 1" Badge (شريط القمة أو الوسام السفلي)
  // Region: Lower 32% height, centered horizontally
  const bottomRibbonTrim = trimNonTransparentBox(
    ctx,
    x + w * 0.2,
    y + h * 0.68,
    w * 0.6,
    h * 0.32
  );
  if (bottomRibbonTrim && bottomRibbonTrim.width > 25 && bottomRibbonTrim.height > 15) {
    const id = `part_ribbon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    parts.push({
      id,
      index: startIdx + parts.length,
      label: 'شريط_سفلي',
      rawX: bottomRibbonTrim.x,
      rawY: bottomRibbonTrim.y,
      rawWidth: bottomRibbonTrim.width,
      rawHeight: bottomRibbonTrim.height,
      x: bottomRibbonTrim.x,
      y: bottomRibbonTrim.y,
      width: bottomRibbonTrim.width,
      height: bottomRibbonTrim.height,
      selected: true
    });
  }

  return parts;
}

/**
 * Mode 2: Bottleneck & Narrow-Bridge Decomposition
 * كشف مناطق التضيّق العمودية والأفقية وكسر الوصلات الرفيعة
 */
export function decomposeBottlenecks(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetBox: { x: number; y: number; width: number; height: number },
  startIdx: number = 1
): DetectedElement[] {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(sourceImage, 0, 0);

  const { x, y, width: w, height: h } = targetBox;
  const imgData = ctx.getImageData(x, y, w, h);
  const data = imgData.data;

  // 1. Calculate Vertical Projection (histogram of non-transparent pixels per column)
  const vProj = new Int32Array(w);
  // 2. Calculate Horizontal Projection (histogram per row)
  const hProj = new Int32Array(h);

  for (let py = 0; py < h; py++) {
    const rowOffset = py * w * 4;
    for (let px = 0; px < w; px++) {
      const alpha = data[rowOffset + px * 4 + 3];
      if (alpha > 25) {
        vProj[px]++;
        hProj[py]++;
      }
    }
  }

  // Find vertical valleys (narrow vertical gaps / connections)
  const verticalSplits: number[] = [];
  const minSplitDist = Math.max(25, w * 0.15);
  let maxV = 0;
  for (let px = 0; px < w; px++) if (vProj[px] > maxV) maxV = vProj[px];

  for (let px = Math.floor(w * 0.15); px < Math.floor(w * 0.85); px++) {
    // Check if local minimum
    if (vProj[px] < maxV * 0.28 && vProj[px] <= vProj[px - 1] && vProj[px] <= vProj[px + 1]) {
      const last = verticalSplits[verticalSplits.length - 1] ?? -999;
      if (px - last > minSplitDist) {
        verticalSplits.push(px);
      }
    }
  }

  // Find horizontal valleys
  const horizontalSplits: number[] = [];
  const minHDist = Math.max(25, h * 0.15);
  let maxH = 0;
  for (let py = 0; py < h; py++) if (hProj[py] > maxH) maxH = hProj[py];

  for (let py = Math.floor(h * 0.15); py < Math.floor(h * 0.85); py++) {
    if (hProj[py] < maxH * 0.32 && hProj[py] <= hProj[py - 1] && hProj[py] <= hProj[py + 1]) {
      const last = horizontalSplits[horizontalSplits.length - 1] ?? -999;
      if (py - last > minHDist) {
        horizontalSplits.push(py);
      }
    }
  }

  // Construct sub-rectangles from split lines
  const xBounds = [0, ...verticalSplits, w];
  const yBounds = [0, ...horizontalSplits, h];

  const parts: DetectedElement[] = [];

  for (let yi = 0; yi < yBounds.length - 1; yi++) {
    for (let xi = 0; xi < xBounds.length - 1; xi++) {
      const cellX = x + xBounds[xi];
      const cellY = y + yBounds[yi];
      const cellW = xBounds[xi + 1] - xBounds[xi];
      const cellH = yBounds[yi + 1] - yBounds[yi];

      const trimmed = trimNonTransparentBox(ctx, cellX, cellY, cellW, cellH);
      if (trimmed && trimmed.width > 20 && trimmed.height > 20) {
        const id = `part_valley_${Date.now()}_${parts.length}_${Math.random().toString(36).slice(2, 5)}`;
        parts.push({
          id,
          index: startIdx + parts.length,
          label: `جزء_${parts.length + 1}`,
          rawX: trimmed.x,
          rawY: trimmed.y,
          rawWidth: trimmed.width,
          rawHeight: trimmed.height,
          x: trimmed.x,
          y: trimmed.y,
          width: trimmed.width,
          height: trimmed.height,
          selected: true
        });
      }
    }
  }

  return parts;
}

/**
 * Mode 3: Smart Grid Slicing with Auto-Trim
 * تقطيع شبكي ذكي (2x2, 3x2, 3x3) مع تشذيب تلقائي لكل خلية
 */
export function decomposeSmartGrid(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetBox: { x: number; y: number; width: number; height: number },
  cols: number = 2,
  rows: number = 2,
  startIdx: number = 1
): DetectedElement[] {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(sourceImage, 0, 0);

  const { x, y, width: w, height: h } = targetBox;
  const cellW = w / cols;
  const cellH = h / rows;

  const parts: DetectedElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const subX = x + c * cellW;
      const subY = y + r * cellH;

      const trimmed = trimNonTransparentBox(ctx, subX, subY, cellW, cellH);
      if (trimmed && trimmed.width > 15 && trimmed.height > 15) {
        const id = `part_grid_${r}_${c}_${Date.now()}`;
        parts.push({
          id,
          index: startIdx + parts.length,
          label: `مقطع_${r + 1}x${c + 1}`,
          rawX: trimmed.x,
          rawY: trimmed.y,
          rawWidth: trimmed.width,
          rawHeight: trimmed.height,
          x: trimmed.x,
          y: trimmed.y,
          width: trimmed.width,
          height: trimmed.height,
          selected: true
        });
      }
    }
  }

  return parts;
}

/**
 * Mode 4: Interactive Knife Line Slicing
 * قص أي عنصر إلى شطرين عند خط القطع الذي يرسمه المستخدم
 */
export function sliceBoxWithKnifeLine(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetBox: DetectedElement,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  startIdx: number = 1
): DetectedElement[] {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(sourceImage, 0, 0);

  const { x, y, width: w, height: h } = targetBox;

  // Determine line orientation: mostly horizontal or mostly vertical
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const isHorizontalCut = dx >= dy;

  const cutCoord = isHorizontalCut
    ? Math.round((p1.y + p2.y) / 2)
    : Math.round((p1.x + p2.x) / 2);

  const parts: DetectedElement[] = [];

  if (isHorizontalCut) {
    // Top Half
    const topH = Math.max(5, cutCoord - y);
    const topTrim = trimNonTransparentBox(ctx, x, y, w, topH);
    if (topTrim) {
      parts.push({
        id: `slice_top_${Date.now()}`,
        index: startIdx,
        label: `${targetBox.label}_أعلى`,
        rawX: topTrim.x,
        rawY: topTrim.y,
        rawWidth: topTrim.width,
        rawHeight: topTrim.height,
        x: topTrim.x,
        y: topTrim.y,
        width: topTrim.width,
        height: topTrim.height,
        selected: true
      });
    }

    // Bottom Half
    const botY = cutCoord;
    const botH = Math.max(5, (y + h) - cutCoord);
    const botTrim = trimNonTransparentBox(ctx, x, botY, w, botH);
    if (botTrim) {
      parts.push({
        id: `slice_bot_${Date.now() + 1}`,
        index: startIdx + parts.length,
        label: `${targetBox.label}_أسفل`,
        rawX: botTrim.x,
        rawY: botTrim.y,
        rawWidth: botTrim.width,
        rawHeight: botTrim.height,
        x: botTrim.x,
        y: botTrim.y,
        width: botTrim.width,
        height: botTrim.height,
        selected: true
      });
    }
  } else {
    // Left Half
    const leftW = Math.max(5, cutCoord - x);
    const leftTrim = trimNonTransparentBox(ctx, x, y, leftW, h);
    if (leftTrim) {
      parts.push({
        id: `slice_left_${Date.now()}`,
        index: startIdx,
        label: `${targetBox.label}_يسار`,
        rawX: leftTrim.x,
        rawY: leftTrim.y,
        rawWidth: leftTrim.width,
        rawHeight: leftTrim.height,
        x: leftTrim.x,
        y: leftTrim.y,
        width: leftTrim.width,
        height: leftTrim.height,
        selected: true
      });
    }

    // Right Half
    const rightX = cutCoord;
    const rightW = Math.max(5, (x + w) - cutCoord);
    const rightTrim = trimNonTransparentBox(ctx, rightX, y, rightW, h);
    if (rightTrim) {
      parts.push({
        id: `slice_right_${Date.now() + 1}`,
        index: startIdx + parts.length,
        label: `${targetBox.label}_يمين`,
        rawX: rightTrim.x,
        rawY: rightTrim.y,
        rawWidth: rightTrim.width,
        rawHeight: rightTrim.height,
        x: rightTrim.x,
        y: rightTrim.y,
        width: rightTrim.width,
        height: rightTrim.height,
        selected: true
      });
    }
  }

  return parts;
}
