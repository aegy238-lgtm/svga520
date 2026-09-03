/**
 * Smart Auto Detection & Auto Crop Segmentation Engine
 * High-performance Computer Vision algorithms for detecting, segmenting,
 * and cropping repeated and distinct objects (Labels, Sprites, Icons, Stickers, Badges)
 * from any composite image without relying on OCR.
 */

export interface DetectedElement {
  id: string; // Unique ID
  index: number; // 1-based sequential index (1, 2, 3...)
  label: string; // Padded label e.g. "001", "002"
  rawX: number; // Raw native coordinate without padding
  rawY: number;
  rawWidth: number;
  rawHeight: number;
  x: number; // Native coordinate with current padding
  y: number;
  width: number;
  height: number;
  selected: boolean;
  thumbnailUrl?: string; // Data URL or object URL for quick preview
}

export interface DetectionOptions {
  sensitivity: number; // 1 - 100 (default ~30)
  minWidth: number; // in pixels (default ~10)
  minHeight: number; // in pixels (default ~10)
  maxWidth?: number; // in pixels
  maxHeight?: number; // in pixels
  padding: number; // in pixels (0, 2, 5, 10, etc.)
  backgroundMode: 'auto' | 'transparent' | 'white' | 'black' | 'custom';
  customBgColor?: { r: number; g: number; b: number };
  splitTightGaps?: boolean; // Enable morphological split for adjacent touching elements
}

export interface BackgroundInfo {
  isTransparent: boolean;
  color: { r: number; g: number; b: number };
  hex: string;
  confidence: number;
}

/**
 * Detect the background color or transparency of an image
 * by sampling perimeter pixels and corners.
 */
export function detectImageBackground(ctx: CanvasRenderingContext2D, width: number, height: number): BackgroundInfo {
  // Sample perimeter pixels
  const perimeterPoints: { x: number; y: number }[] = [];
  const stepX = Math.max(1, Math.floor(width / 50));
  const stepY = Math.max(1, Math.floor(height / 50));

  // Top & Bottom edges
  for (let x = 0; x < width; x += stepX) {
    perimeterPoints.push({ x, y: 0 });
    perimeterPoints.push({ x, y: height - 1 });
  }
  // Left & Right edges
  for (let y = 0; y < height; y += stepY) {
    perimeterPoints.push({ x: 0, y });
    perimeterPoints.push({ x: width - 1, y });
  }

  // 4 corners with 5x5 patches
  for (let dy = 0; dy < 5; dy++) {
    for (let dx = 0; dx < 5; dx++) {
      if (dx < width && dy < height) {
        perimeterPoints.push({ x: dx, y: dy });
        perimeterPoints.push({ x: width - 1 - dx, y: dy });
        perimeterPoints.push({ x: dx, y: height - 1 - dy });
        perimeterPoints.push({ x: width - 1 - dx, y: height - 1 - dy });
      }
    }
  }

  let transparentCount = 0;
  const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (const pt of perimeterPoints) {
    const pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
    const [r, g, b, a] = pixel;

    if (a < 30) {
      transparentCount++;
      continue;
    }

    // Quantize color into buckets of 8 to handle minor compression artifacts
    const qr = Math.round(r / 8) * 8;
    const qg = Math.round(g / 8) * 8;
    const qb = Math.round(b / 8) * 8;
    const key = `${qr},${qg},${qb}`;

    const existing = colorBuckets.get(key);
    if (existing) {
      existing.count++;
      existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
      existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
      existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
    } else {
      colorBuckets.set(key, { r, g, b, count: 1 });
    }
  }

  const totalSamples = perimeterPoints.length;
  if (transparentCount / totalSamples > 0.35) {
    return {
      isTransparent: true,
      color: { r: 255, g: 255, b: 255 },
      hex: '#00000000',
      confidence: transparentCount / totalSamples
    };
  }

  // Find dominant color
  let dominant = { r: 255, g: 255, b: 255, count: 0 };
  for (const bucket of colorBuckets.values()) {
    if (bucket.count > dominant.count) {
      dominant = bucket;
    }
  }

  const hex = `#${dominant.r.toString(16).padStart(2, '0')}${dominant.g.toString(16).padStart(2, '0')}${dominant.b.toString(16).padStart(2, '0')}`;
  return {
    isTransparent: false,
    color: { r: dominant.r, g: dominant.g, b: dominant.b },
    hex,
    confidence: dominant.count / totalSamples
  };
}

/**
 * High-performance Connected Component & Contour Detection Algorithm
 */
export async function detectObjectsInImage(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  options: Partial<DetectionOptions> = {}
): Promise<{ elements: DetectedElement[]; background: BackgroundInfo; processTimeMs: number }> {
  const startTime = performance.now();

  const width = 'naturalWidth' in imageSource ? imageSource.naturalWidth : imageSource.width;
  const height = 'naturalHeight' in imageSource ? imageSource.naturalHeight : imageSource.height;

  if (!width || !height) {
    throw new Error('Invalid image dimensions');
  }

  // Configuration defaults
  const sensitivity = options.sensitivity ?? 32;
  const minW = options.minWidth ?? Math.max(10, Math.floor(width * 0.008));
  const minH = options.minHeight ?? Math.max(10, Math.floor(height * 0.008));
  const maxW = options.maxWidth ?? Math.floor(width * 0.96);
  const maxH = options.maxHeight ?? Math.floor(height * 0.96);
  const padding = options.padding ?? 0;
  const splitTightGaps = options.splitTightGaps !== false;

  // Render to internal canvas to extract ImageData
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas 2d context');

  ctx.drawImage(imageSource, 0, 0, width, height);

  // Background analysis
  let bgInfo: BackgroundInfo;
  if (options.backgroundMode === 'transparent') {
    bgInfo = { isTransparent: true, color: { r: 255, g: 255, b: 255 }, hex: '#00000000', confidence: 1 };
  } else if (options.backgroundMode === 'white') {
    bgInfo = { isTransparent: false, color: { r: 255, g: 255, b: 255 }, hex: '#ffffff', confidence: 1 };
  } else if (options.backgroundMode === 'black') {
    bgInfo = { isTransparent: false, color: { r: 0, g: 0, b: 0 }, hex: '#000000', confidence: 1 };
  } else if (options.backgroundMode === 'custom' && options.customBgColor) {
    const c = options.customBgColor;
    const hex = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
    bgInfo = { isTransparent: false, color: c, hex, confidence: 1 };
  } else {
    bgInfo = detectImageBackground(ctx, width, height);
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Threshold distance in RGB Euclidean color space
  // Sensitivity: 1 (very strict, only huge contrast) to 100 (very sensitive, tiny difference)
  const distThreshold = Math.max(8, Math.min(180, (105 - sensitivity) * 1.5));
  const distThresholdSq = distThreshold * distThreshold;

  const bgR = bgInfo.color.r;
  const bgG = bgInfo.color.g;
  const bgB = bgInfo.color.b;
  const isTransparentBg = bgInfo.isTransparent;

  // Step 1: Create 1-byte binary foreground mask (0: bg, 1: fg)
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    if (isTransparentBg) {
      if (a > 25) {
        mask[p] = 1;
      }
    } else {
      if (a < 30) {
        mask[p] = 0;
      } else {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dr = r - bgR;
        const dg = g - bgG;
        const db = b - bgB;
        const diffSq = dr * dr + dg * dg + db * db;
        if (diffSq >= distThresholdSq) {
          mask[p] = 1;
        }
      }
    }
  }

  // Step 2: Connected Component Analysis (BFS Queue with boundary tracking)
  const visited = new Uint8Array(width * height);
  interface RawBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixelCount: number;
  }

  const rawBoxes: RawBox[] = [];

  // Reusable queue for BFS to avoid GC overhead
  const queue = new Int32Array(width * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (mask[idx] === 1 && visited[idx] === 0) {
        // Start new component flood fill
        let qHead = 0;
        let qTail = 0;
        queue[qTail++] = idx;
        visited[idx] = 1;

        let bMinX = x;
        let bMaxX = x;
        let bMinY = y;
        let bMaxY = y;
        let pCount = 0;

        while (qHead < qTail) {
          const currIdx = queue[qHead++];
          pCount++;
          const cx = currIdx % width;
          const cy = (currIdx / width) | 0;

          if (cx < bMinX) bMinX = cx;
          if (cx > bMaxX) bMaxX = cx;
          if (cy < bMinY) bMinY = cy;
          if (cy > bMaxY) bMaxY = cy;

          // 8-way connectivity for smooth diagonal contours
          const neighbors = [
            currIdx - 1, // left
            currIdx + 1, // right
            currIdx - width, // up
            currIdx + width, // down
            currIdx - width - 1, // top-left
            currIdx - width + 1, // top-right
            currIdx + width - 1, // bottom-left
            currIdx + width + 1  // bottom-right
          ];

          for (let n = 0; n < 8; n++) {
            const nIdx = neighbors[n];
            if (nIdx >= 0 && nIdx < mask.length) {
              const nx = nIdx % width;
              // Prevent wrapping across edges
              if (Math.abs(nx - cx) <= 1 && mask[nIdx] === 1 && visited[nIdx] === 0) {
                visited[nIdx] = 1;
                queue[qTail++] = nIdx;
              }
            }
          }
        }

        const compW = bMaxX - bMinX + 1;
        const compH = bMaxY - bMinY + 1;

        // Size filtering
        if (compW >= minW && compH >= minH && compW <= maxW && compH <= maxH) {
          // Density filter: object must have a reasonable foreground fill ratio (> 5%)
          // to avoid hollow borders or huge single-pixel stray lines
          const area = compW * compH;
          if (pCount / area >= 0.04) {
            rawBoxes.push({
              minX: bMinX,
              minY: bMinY,
              maxX: bMaxX,
              maxY: bMaxY,
              pixelCount: pCount
            });
          }
        }
      }
    }
  }

  // Step 3: Check for merged adjacent components (Grid Valley Split)
  // If an element is roughly 2x or 3x the median width or height of other components,
  // split it along its vertical or horizontal projection valley
  const splitBoxes: RawBox[] = [];
  if (splitTightGaps && rawBoxes.length >= 4) {
    const widths = rawBoxes.map(b => b.maxX - b.minX + 1).sort((a, b) => a - b);
    const heights = rawBoxes.map(b => b.maxY - b.minY + 1).sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length / 2)];
    const medianH = heights[Math.floor(heights.length / 2)];

    for (const box of rawBoxes) {
      const bw = box.maxX - box.minX + 1;
      const bh = box.maxY - box.minY + 1;

      // Check if multiple elements are stuck side-by-side horizontally
      if (bw > medianW * 1.75 && bw < medianW * 6 && bh >= medianH * 0.7 && bh <= medianH * 1.5) {
        // Calculate vertical projection profile inside this box
        const vProj = new Int32Array(bw);
        for (let y = box.minY; y <= box.maxY; y++) {
          const row = y * width;
          for (let x = 0; x < bw; x++) {
            if (mask[row + box.minX + x] === 1) {
              vProj[x]++;
            }
          }
        }

        // Find local valleys (minima) where elements can be cleanly split
        const splitPoints: number[] = [];
        const expectedCount = Math.round(bw / medianW);
        const approxStep = bw / expectedCount;

        for (let s = 1; s < expectedCount; s++) {
          const searchCenter = Math.round(s * approxStep);
          const searchRadius = Math.max(3, Math.round(approxStep * 0.25));
          let minVal = Infinity;
          let bestSplit = searchCenter;

          for (let x = Math.max(2, searchCenter - searchRadius); x <= Math.min(bw - 3, searchCenter + searchRadius); x++) {
            if (vProj[x] < minVal) {
              minVal = vProj[x];
              bestSplit = x;
            }
          }

          if (minVal < bh * 0.3) {
            splitPoints.push(bestSplit);
          }
        }

        if (splitPoints.length > 0) {
          let prevX = 0;
          for (const sp of splitPoints) {
            splitBoxes.push({
              minX: box.minX + prevX,
              minY: box.minY,
              maxX: box.minX + sp - 1,
              maxY: box.maxY,
              pixelCount: Math.round(box.pixelCount / (splitPoints.length + 1))
            });
            prevX = sp;
          }
          splitBoxes.push({
            minX: box.minX + prevX,
            minY: box.minY,
            maxX: box.maxX,
            maxY: box.maxY,
            pixelCount: Math.round(box.pixelCount / (splitPoints.length + 1))
          });
          continue;
        }
      }

      splitBoxes.push(box);
    }
  } else {
    splitBoxes.push(...rawBoxes);
  }

  // Step 4: Spatial Row-Column Clustering & Logical Ordering
  // Natural reading order: Top-to-bottom rows, and left-to-right columns within each row
  interface BoxWithCenter extends RawBox {
    cx: number;
    cy: number;
    w: number;
    h: number;
  }

  const boxesWithCenters: BoxWithCenter[] = splitBoxes.map(b => ({
    ...b,
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    w: b.maxX - b.minX + 1,
    h: b.maxY - b.minY + 1
  }));

  // Calculate average height for row clustering threshold
  const avgHeight = boxesWithCenters.reduce((sum, b) => sum + b.h, 0) / (boxesWithCenters.length || 1);
  const rowThreshold = Math.max(12, avgHeight * 0.55);

  // Group into horizontal rows
  boxesWithCenters.sort((a, b) => a.cy - b.cy);

  const rows: BoxWithCenter[][] = [];
  for (const box of boxesWithCenters) {
    let placed = false;
    for (const row of rows) {
      const rowAvgY = row.reduce((s, item) => s + item.cy, 0) / row.length;
      if (Math.abs(box.cy - rowAvgY) <= rowThreshold) {
        row.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([box]);
    }
  }

  // Sort rows from top to bottom
  rows.sort((r1, r2) => {
    const avgY1 = r1.reduce((s, item) => s + item.cy, 0) / r1.length;
    const avgY2 = r2.reduce((s, item) => s + item.cy, 0) / r2.length;
    return avgY1 - avgY2;
  });

  // Sort each row from left to right
  const sortedBoxes: BoxWithCenter[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.cx - b.cx);
    sortedBoxes.push(...row);
  }

  // Step 5: Format Elements with zero-padded labeling and padding
  const totalCount = sortedBoxes.length;
  const padDigits = Math.max(3, String(totalCount).length);

  const elements: DetectedElement[] = sortedBoxes.map((box, idx) => {
    const index = idx + 1;
    const label = String(index).padStart(padDigits, '0');
    const rawX = box.minX;
    const rawY = box.minY;
    const rawWidth = box.w;
    const rawHeight = box.h;

    // Apply current padding clamped to canvas boundary
    const x = Math.max(0, rawX - padding);
    const y = Math.max(0, rawY - padding);
    const x2 = Math.min(width, rawX + rawWidth + padding);
    const y2 = Math.min(height, rawY + rawHeight + padding);

    return {
      id: `elem_${index}_${Math.random().toString(36).substring(2, 7)}`,
      index,
      label,
      rawX,
      rawY,
      rawWidth,
      rawHeight,
      x,
      y,
      width: x2 - x,
      height: y2 - y,
      selected: true // By default, all newly detected elements are selected!
    };
  });

  const processTimeMs = Math.round(performance.now() - startTime);
  return {
    elements,
    background: bgInfo,
    processTimeMs
  };
}

/**
 * Re-calculate padding on existing elements without re-running full detection
 */
export function applyPaddingToElements(
  elements: DetectedElement[],
  padding: number,
  canvasWidth: number,
  canvasHeight: number
): DetectedElement[] {
  return elements.map(el => {
    const x = Math.max(0, el.rawX - padding);
    const y = Math.max(0, el.rawY - padding);
    const x2 = Math.min(canvasWidth, el.rawX + el.rawWidth + padding);
    const y2 = Math.min(canvasHeight, el.rawY + el.rawHeight + padding);
    return {
      ...el,
      x,
      y,
      width: x2 - x,
      height: y2 - y
    };
  });
}

/**
 * Crop a single element from source image and return a Blob
 */
export function cropElementToBlob(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  element: DetectedElement,
  format: 'png' | 'webp' | 'jpeg' = 'png',
  quality = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, Math.round(element.width));
      cropCanvas.height = Math.max(1, Math.round(element.height));

      const ctx = cropCanvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot create crop 2d context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw slice directly from original source image at full native resolution
      ctx.drawImage(
        sourceImage,
        element.x,
        element.y,
        element.width,
        element.height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      cropCanvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate image blob'));
        },
        mime,
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate a fast dataURL thumbnail for preview cards
 */
export function generateThumbnailUrl(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  element: DetectedElement,
  maxThumbSize = 120
): string {
  try {
    const scale = Math.min(1, maxThumbSize / Math.max(element.width, element.height));
    const thumbW = Math.max(1, Math.round(element.width * scale));
    const thumbH = Math.max(1, Math.round(element.height * scale));

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(
      sourceImage,
      element.x,
      element.y,
      element.width,
      element.height,
      0,
      0,
      thumbW,
      thumbH
    );
    return thumbCanvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * Mathematically robust 2D grid/reading-order sorting.
 * Clusters items into distinct horizontal rows using median height and sweep-line tolerance,
 * sorts each row strictly left-to-right, and sorts rows strictly top-to-bottom.
 * Guaranteed 100% transitive and deterministic.
 */
export function sortElementsNaturalReadingOrder<T extends { x: number; y: number; width: number; height: number }>(items: T[]): T[] {
  if (items.length <= 1) return [...items];

  // 1. Calculate median height of elements to handle slight offsets
  const heights = items.map(it => it.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 20;
  const rowTolerance = Math.max(10, medianH * 0.45);

  // 2. Sort by y center initially
  const withCenter = items.map(item => ({
    item,
    cx: item.x + item.width / 2,
    cy: item.y + item.height / 2
  })).sort((a, b) => a.cy - b.cy);

  // 3. Cluster into rows
  const rows: { cySum: number; count: number; members: typeof withCenter }[] = [];

  for (const entry of withCenter) {
    let matchedRow: typeof rows[0] | null = null;
    let minDistance = Infinity;

    for (const r of rows) {
      const avgCy = r.cySum / r.count;
      const dist = Math.abs(entry.cy - avgCy);
      if (dist <= rowTolerance && dist < minDistance) {
        minDistance = dist;
        matchedRow = r;
      }
    }

    if (matchedRow) {
      matchedRow.members.push(entry);
      matchedRow.cySum += entry.cy;
      matchedRow.count += 1;
    } else {
      rows.push({
        cySum: entry.cy,
        count: 1,
        members: [entry]
      });
    }
  }

  // 4. Sort rows by vertical position (top to bottom)
  rows.sort((r1, r2) => (r1.cySum / r1.count) - (r2.cySum / r2.count));

  // 5. Within each row, sort from left to right
  const result: T[] = [];
  for (const row of rows) {
    row.members.sort((a, b) => a.item.x - b.item.x);
    for (const m of row.members) {
      result.push(m.item);
    }
  }

  return result;
}
