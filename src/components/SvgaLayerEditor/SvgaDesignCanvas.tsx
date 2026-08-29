import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { EditableLayer, SVGAProjectData, CanvasTool, GuideLine } from './types';
import { getLayerAnimatedTransform } from './motionEngine';
import { 
  ZoomIn, ZoomOut, RefreshCw, Maximize2, 
  Grid, Compass, Eye, Shield, RotateCcw,
  Focus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Move, Crosshair
} from 'lucide-react';

interface SvgaDesignCanvasProps {
  project: SVGAProjectData;
  layers: EditableLayer[];
  selectedLayerId: string | null;
  selectedLayerIds?: string[];
  currentFrame: number;
  activeTool: CanvasTool;
  zoom: number;
  panOffset: { x: number; y: number };
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  bgColor: string;
  onSelectLayer: (layerId: string | null, isMulti?: boolean) => void;
  onUpdateLayerTransform: (layerId: string, transform: Partial<EditableLayer['transform']>) => void;
  onBulkUpdateTransforms?: (updates: Array<{ id: string; transform: Partial<EditableLayer['transform']> }>) => void;
  onZoomChange: (zoom: number) => void;
  onPanChange: (offset: { x: number; y: number }) => void;
  onDeleteLayer?: (layerId: string) => void;
}

type DragHandleType = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | 'rot' | 'pan';

interface Point {
  x: number;
  y: number;
}

// Matrix multiplication: M1 * M2
// [a1 c1 tx1] * [a2 c2 tx2]
// [b1 d1 ty1]   [b2 d2 ty2]
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

// Transform point with affine matrix [a, b, c, d, tx, ty]
function transformPoint(m: [number, number, number, number, number, number], x: number, y: number): Point {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5]
  };
}

// Helper to render SVGA vector shapes if present
function renderSvgaShapes(ctx: CanvasRenderingContext2D, shapes: any[]) {
  if (!shapes || !Array.isArray(shapes)) return;

  for (const shape of shapes) {
    if (!shape) continue;
    ctx.save();

    if (shape.transform) {
      const { a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0 } = shape.transform;
      ctx.transform(a, b, c, d, tx, ty);
    }

    const styles = shape.styles || {};
    if (styles.fill) {
      const { r = 0, g = 0, b = 0, a = 1 } = styles.fill;
      ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    }
    if (styles.stroke) {
      const { r = 0, g = 0, b = 0, a = 1 } = styles.stroke;
      ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
      ctx.lineWidth = styles.strokeWidth || 1;
      if (styles.lineCap) ctx.lineCap = styles.lineCap.toLowerCase();
      if (styles.lineJoin) ctx.lineJoin = styles.lineJoin.toLowerCase();
    }

    if (shape.shape && shape.shape.d) {
      try {
        const p = new Path2D(shape.shape.d);
        if (styles.fill) ctx.fill(p);
        if (styles.stroke) ctx.stroke(p);
      } catch (e) {}
    } else if (shape.rect) {
      const { x = 0, y = 0, width = 0, height = 0, rx = 0 } = shape.rect;
      if (rx > 0 && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, rx);
        if (styles.fill) ctx.fill();
        if (styles.stroke) ctx.stroke();
      } else {
        if (styles.fill) ctx.fillRect(x, y, width, height);
        if (styles.stroke) ctx.strokeRect(x, y, width, height);
      }
    } else if (shape.ellipse) {
      const { x = 0, y = 0, radiusX = 0, radiusY = 0 } = shape.ellipse;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (styles.fill) ctx.fill();
      if (styles.stroke) ctx.stroke();
    }

    ctx.restore();
  }
}

export const SvgaDesignCanvas: React.FC<SvgaDesignCanvasProps> = ({
  project,
  layers,
  selectedLayerId,
  selectedLayerIds = [],
  currentFrame,
  activeTool,
  zoom,
  panOffset,
  showGrid,
  showRulers,
  showGuides,
  bgColor,
  onSelectLayer,
  onUpdateLayerTransform,
  onBulkUpdateTransforms,
  onZoomChange,
  onPanChange,
  onDeleteLayer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesCache = useRef<Record<string, HTMLImageElement>>({});

  // Effective multi-selection IDs
  const activeSelectedIds = useMemo(() => {
    if (selectedLayerIds && selectedLayerIds.length > 0) {
      return selectedLayerIds;
    }
    return selectedLayerId ? [selectedLayerId] : [];
  }, [selectedLayerIds, selectedLayerId]);

  // Active Drag / Interaction State
  const [isInteracting, setIsInteracting] = useState(false);
  const [dragHandle, setDragHandle] = useState<DragHandleType | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialTransform, setInitialTransform] = useState<EditableLayer['transform'] | null>(null);
  const [initialTransformsMap, setInitialTransformsMap] = useState<Record<string, EditableLayer['transform']>>({});
  const [activeGuides, setActiveGuides] = useState<GuideLine[]>([]);

  const selectedLayer = useMemo(() => {
    return layers.find(l => l.id === selectedLayerId) || null;
  }, [layers, selectedLayerId]);

  // Preload images into cache
  useEffect(() => {
    for (const [key, dataUrl] of Object.entries(project.imagesMap)) {
      if (!imagesCache.current[key]) {
        const img = new Image();
        img.src = dataUrl;
        imagesCache.current[key] = img;
      }
    }
  }, [project.imagesMap]);

  // Helper to convert screen client coords to Canvas design coordinates (viewBox)
  const clientToCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scale = zoom / 100;
    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;
    return { x, y };
  }, [zoom]);

  // Compute Total Matrix for a Layer at current frame (incorporating keyframe animations)
  const computeLayerMatrix = useCallback((layer: EditableLayer, frame: any) => {
    const initialBounds = layer.initialBounds;
    const animTransform = getLayerAnimatedTransform(layer, currentFrame);

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

    // User affine matrix around pivot
    const uA = scaleX * cos;
    const uB = scaleX * sin;
    const uC = -scaleY * sin;
    const uD = scaleY * cos;
    const uTx = (pivotX + deltaX) - (uA * pivotX + uC * pivotY);
    const uTy = (pivotY + deltaY) - (uB * pivotX + uD * pivotY);

    const mUser: [number, number, number, number, number, number] = [uA, uB, uC, uD, uTx, uTy];

    // Frame native matrix
    const fA = frame?.transform?.a ?? 1;
    const fB = frame?.transform?.b ?? 0;
    const fC = frame?.transform?.c ?? 0;
    const fD = frame?.transform?.d ?? 1;
    const fTx = frame?.transform?.tx ?? 0;
    const fTy = frame?.transform?.ty ?? 0;
    const mFrame: [number, number, number, number, number, number] = [fA, fB, fC, fD, fTx, fTy];

    return multiplyMatrices(mUser, mFrame);
  }, [currentFrame]);

  // Helper to determine if a layer's frame is visible/active at given frameIndex
  const getLayerFrameState = useCallback((layer: EditableLayer, frameIdx: number) => {
    const frames = layer.spriteRef?.frames;
    if (!frames || !frames[frameIdx]) return { isActive: false, frame: null, alpha: 0 };
    const frame = frames[frameIdx];

    const hasAnyExplicitAlpha = frames.some((fr: any) => fr && fr.alpha !== undefined && fr.alpha > 0.005);
    let isActive = false;
    if (hasAnyExplicitAlpha) {
      isActive = frame.alpha !== undefined && frame.alpha > 0.005;
    } else {
      isActive = frame.alpha === undefined || frame.alpha > 0.005;
    }

    const frameAlpha = isActive ? (frame.alpha !== undefined ? frame.alpha : 1.0) : 0;
    return { isActive, frame, alpha: frameAlpha };
  }, []);

  // Zoom to Selected Element (Centers and focuses tightly on the selected element)
  const handleZoomToSelection = useCallback(() => {
    if (!selectedLayer || !containerRef.current) return;
    const { isActive, frame } = getLayerFrameState(selectedLayer, currentFrame);
    if (!isActive || !frame) return;

    const totalMatrix = computeLayerMatrix(selectedLayer, frame);
    const cachedImg = imagesCache.current[selectedLayer.imageKey];
    const localW = frame.layout?.width || cachedImg?.naturalWidth || selectedLayer.initialBounds.width || 50;
    const localH = frame.layout?.height || cachedImg?.naturalHeight || selectedLayer.initialBounds.height || 50;
    const localX = frame.layout?.x || 0;
    const localY = frame.layout?.y || 0;

    const p0 = transformPoint(totalMatrix, localX, localY);
    const p2 = transformPoint(totalMatrix, localX + localW, localY + localH);
    const centerLayerX = (p0.x + p2.x) / 2;
    const centerLayerY = (p0.y + p2.y) / 2;
    const layerW = Math.max(20, Math.abs(p2.x - p0.x));
    const layerH = Math.max(20, Math.abs(p2.y - p0.y));

    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    // Target zoom so the item is clearly visible (taking up around 200px - 350px on screen)
    const targetZoom = Math.min(800, Math.max(150, Math.round(Math.min(cw / (layerW * 2.8), ch / (layerH * 2.8)) * 100)));
    
    // Canvas center
    const canvasCenterX = project.width / 2;
    const canvasCenterY = project.height / 2;
    const scale = targetZoom / 100;
    const panX = (canvasCenterX - centerLayerX) * scale;
    const panY = (canvasCenterY - centerLayerY) * scale;

    onZoomChange(targetZoom);
    onPanChange({ x: Math.round(panX), y: Math.round(panY) });
  }, [selectedLayer, currentFrame, getLayerFrameState, computeLayerMatrix, project, onZoomChange, onPanChange]);

  // Directional Micro-Nudge Function
  const handleMicroNudge = useCallback((dx: number, dy: number) => {
    if (!selectedLayer) return;
    const curX = selectedLayer.transform.x || 0;
    const curY = selectedLayer.transform.y || 0;
    onUpdateLayerTransform(selectedLayer.id, {
      x: Number((curX + dx).toFixed(2)),
      y: Number((curY + dy).toFixed(2))
    });
  }, [selectedLayer, onUpdateLayerTransform]);

  // Global Keyboard Arrow Listener for Pixel-Perfect Movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedLayer) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      let step = 1;
      if (e.shiftKey) step = 10;
      else if (e.altKey || e.ctrlKey || e.metaKey) step = 0.1;

      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') { dy = -step; }
      else if (e.key === 'ArrowDown') { dy = step; }
      else if (e.key === 'ArrowLeft') { dx = -step; }
      else if (e.key === 'ArrowRight') { dx = step; }
      else { return; }

      e.preventDefault();
      handleMicroNudge(dx, dy);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayer, handleMicroNudge]);

  // Render loop
  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = project.width;
    const height = project.height;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Checkerboard background if transparent
    if (bgColor === 'transparent') {
      const squareSize = 16;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#1e293b';
      for (let y = 0; y < height; y += squareSize) {
        for (let x = 0; x < width; x += squareSize) {
          if ((Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0) {
            ctx.fillRect(x, y, squareSize, squareSize);
          }
        }
      }
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Pixel Grid if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Render all visible layers in sequence (bottom to top)
    for (const layer of layers) {
      if (!layer.visible) continue;

      const { isActive, frame, alpha: frameAlpha } = getLayerFrameState(layer, currentFrame);
      if (!isActive || !frame) continue;

      ctx.save();

      const animTransform = getLayerAnimatedTransform(layer, currentFrame);
      const layerAlpha = Math.max(0, Math.min(1, (animTransform.opacity !== undefined ? animTransform.opacity : layer.transform.opacity) / 100));
      ctx.globalAlpha = frameAlpha * layerAlpha;

      // Apply Combined Total Matrix
      const totalMatrix = computeLayerMatrix(layer, frame);
      ctx.transform(totalMatrix[0], totalMatrix[1], totalMatrix[2], totalMatrix[3], totalMatrix[4], totalMatrix[5]);

      // Apply ClipPath if existing
      if (frame.clipPath) {
        try {
          const p = new Path2D(frame.clipPath);
          ctx.clip(p);
        } catch (e) {}
      }

      // Render Shapes if existing
      if (frame.shapes && frame.shapes.length > 0) {
        renderSvgaShapes(ctx, frame.shapes);
      }

      // Draw Image
      const cachedImg = imagesCache.current[layer.imageKey];
      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        let drawX = 0;
        let drawY = 0;
        let drawW = cachedImg.naturalWidth;
        let drawH = cachedImg.naturalHeight;

        if (frame.layout && frame.layout.width > 0 && frame.layout.height > 0) {
          drawX = frame.layout.x || 0;
          drawY = frame.layout.y || 0;
          drawW = frame.layout.width;
          drawH = frame.layout.height;
        } else if (frame.layout) {
          drawX = frame.layout.x || 0;
          drawY = frame.layout.y || 0;
        }

        ctx.drawImage(cachedImg, drawX, drawY, drawW, drawH);
      } else if (layer.type === 'shape' && (!frame.shapes || frame.shapes.length === 0)) {
        // Fallback shape box
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        const w = layer.transform.width || 100;
        const h = layer.transform.height || 100;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeRect(0, 0, w, h);
      }

      ctx.restore();
    }

    // 4. Draw Active Smart Alignment Guides
    if (showGuides && activeGuides.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      for (const guide of activeGuides) {
        ctx.beginPath();
        if (guide.type === 'vertical') {
          ctx.moveTo(guide.position, 0);
          ctx.lineTo(guide.position, height);
        } else {
          ctx.moveTo(0, guide.position);
          ctx.lineTo(width, guide.position);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Draw Selection Transform Box and Handles for Selected Layers
    const layersToHighlight = layers.filter(l => activeSelectedIds.includes(l.id) && l.visible);

    for (const targetL of layersToHighlight) {
      const isPrimary = targetL.id === selectedLayerId;
      const { isActive, frame } = getLayerFrameState(targetL, currentFrame);

      if (isActive && frame) {
        ctx.save();
        const totalMatrix = computeLayerMatrix(targetL, frame);
        const cachedImg = imagesCache.current[targetL.imageKey];

        let localX = 0;
        let localY = 0;
        let localW = cachedImg?.naturalWidth || targetL.initialBounds.width || 100;
        let localH = cachedImg?.naturalHeight || targetL.initialBounds.height || 100;

        if (frame.layout && frame.layout.width > 0 && frame.layout.height > 0) {
          localX = frame.layout.x || 0;
          localY = frame.layout.y || 0;
          localW = frame.layout.width;
          localH = frame.layout.height;
        } else if (frame.layout) {
          localX = frame.layout.x || 0;
          localY = frame.layout.y || 0;
        }

        // Transform 4 corners into canvas coordinates
        const p0 = transformPoint(totalMatrix, localX, localY); // top-left
        const p1 = transformPoint(totalMatrix, localX + localW, localY); // top-right
        const p2 = transformPoint(totalMatrix, localX + localW, localY + localH); // bottom-right
        const p3 = transformPoint(totalMatrix, localX, localY + localH); // bottom-left

        // Midpoints
        const midTop = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const midRight = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const midBottom = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
        const midLeft = { x: (p3.x + p0.x) / 2, y: (p3.y + p0.y) / 2 };
        const center = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };

        // Rotation Handle position (extended from midTop)
        const topVectorX = p1.x - p0.x;
        const topVectorY = p1.y - p0.y;
        const topLen = Math.hypot(topVectorX, topVectorY) || 1;
        const leftVectorX = p3.x - p0.x;
        const leftVectorY = p3.y - p0.y;
        const leftLen = Math.hypot(leftVectorX, leftVectorY) || 1;

        // Determine if element is visually small in design units
        const isSmallElement = topLen < 55 || leftLen < 55;
        const isTinyElement = topLen < 32 || leftLen < 32;

        const normalX = -topVectorY / topLen;
        const normalY = topVectorX / topLen;
        const rotOffset = isTinyElement ? 36 : isSmallElement ? 32 : 28;
        const rotHandle = { x: midTop.x + normalX * rotOffset, y: midTop.y + normalY * rotOffset };

        // Draw Bounding Polygon for layer
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();

        ctx.strokeStyle = isPrimary ? '#6366f1' : '#f59e0b'; // Indigo for primary, Amber for co-selected
        ctx.lineWidth = isPrimary ? 2 : 1.5;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Render Transform Handles (for primary layer, or when only 1 is selected)
        if (isPrimary || activeSelectedIds.length === 1) {
          // Rotation stem
          ctx.beginPath();
          ctx.moveTo(midTop.x, midTop.y);
          ctx.lineTo(rotHandle.x, rotHandle.y);
          ctx.strokeStyle = isPrimary ? '#6366f1' : '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Rotation Handle circle
          ctx.beginPath();
          ctx.arc(rotHandle.x, rotHandle.y, isTinyElement ? 5 : 6, 0, Math.PI * 2);
          ctx.fillStyle = isPrimary ? '#a855f7' : '#f59e0b'; // Purple or Amber rotation knob
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const handlesToDraw = isSmallElement
            ? [p0, p1, p2, p3]
            : [p0, midTop, p1, midRight, p2, midBottom, p3, midLeft];

          const handleRadius = isTinyElement ? 3.5 : isSmallElement ? 4 : 4.5;

          handlesToDraw.forEach(h => {
            ctx.beginPath();
            ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = isPrimary ? '#6366f1' : '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          });
        }

        ctx.restore();
      }
    }
  }, [project, layers, selectedLayer, activeSelectedIds, selectedLayerId, currentFrame, bgColor, showGrid, showGuides, activeGuides, computeLayerMatrix, getLayerFrameState]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  // Hit test to find layer under cursor
  const hitTestLayer = useCallback((cx: number, cy: number): string | null => {
    // Search top-to-bottom
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;

      const { isActive, frame } = getLayerFrameState(layer, currentFrame);
      if (!isActive || !frame) continue;

      const totalMatrix = computeLayerMatrix(layer, frame);
      const cachedImg = imagesCache.current[layer.imageKey];

      let localX = 0;
      let localY = 0;
      let localW = cachedImg?.naturalWidth || layer.initialBounds.width || 100;
      let localH = cachedImg?.naturalHeight || layer.initialBounds.height || 100;

      if (frame.layout && frame.layout.width > 0 && frame.layout.height > 0) {
        localX = frame.layout.x || 0;
        localY = frame.layout.y || 0;
        localW = frame.layout.width;
        localH = frame.layout.height;
      } else if (frame.layout) {
        localX = frame.layout.x || 0;
        localY = frame.layout.y || 0;
      }

      // Invert matrix to test point in local coords
      const [a, b, c, d, tx, ty] = totalMatrix;
      const det = a * d - b * c;
      if (Math.abs(det) < 0.0001) continue;

      const invA = d / det;
      const invB = -b / det;
      const invC = -c / det;
      const invD = a / det;
      const invTx = (c * ty - d * tx) / det;
      const invTy = (b * tx - a * ty) / det;

      const localPointX = invA * cx + invC * cy + invTx;
      const localPointY = invB * cx + invD * cy + invTy;

      // Generous hit tolerance for small layers so clicking near them easily grabs them
      const hitMargin = (localW < 40 || localH < 40) ? 14 : 8;

      if (
        localPointX >= localX - hitMargin &&
        localPointX <= localX + localW + hitMargin &&
        localPointY >= localY - hitMargin &&
        localPointY <= localY + localH + hitMargin
      ) {
        return layer.id;
      }
    }
    return null;
  }, [layers, currentFrame, computeLayerMatrix, getLayerFrameState]);

  // Determine handle under mouse for selected layer
  const getHandleUnderMouse = useCallback((cx: number, cy: number): DragHandleType | null => {
    if (!selectedLayer) return null;
    const { isActive, frame } = getLayerFrameState(selectedLayer, currentFrame);
    if (!isActive || !frame) return null;

    const totalMatrix = computeLayerMatrix(selectedLayer, frame);
    const cachedImg = imagesCache.current[selectedLayer.imageKey];

    let localX = 0;
    let localY = 0;
    let localW = cachedImg?.naturalWidth || selectedLayer.initialBounds.width || 100;
    let localH = cachedImg?.naturalHeight || selectedLayer.initialBounds.height || 100;

    if (frame.layout && frame.layout.width > 0 && frame.layout.height > 0) {
      localX = frame.layout.x || 0;
      localY = frame.layout.y || 0;
      localW = frame.layout.width;
      localH = frame.layout.height;
    } else if (frame.layout) {
      localX = frame.layout.x || 0;
      localY = frame.layout.y || 0;
    }

    const p0 = transformPoint(totalMatrix, localX, localY);
    const p1 = transformPoint(totalMatrix, localX + localW, localY);
    const p2 = transformPoint(totalMatrix, localX + localW, localY + localH);
    const p3 = transformPoint(totalMatrix, localX, localY + localH);

    const midTop = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const midRight = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const midBottom = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
    const midLeft = { x: (p3.x + p0.x) / 2, y: (p3.y + p0.y) / 2 };

    const topVectorX = p1.x - p0.x;
    const topVectorY = p1.y - p0.y;
    const topLen = Math.hypot(topVectorX, topVectorY) || 1;
    const leftVectorX = p3.x - p0.x;
    const leftVectorY = p3.y - p0.y;
    const leftLen = Math.hypot(leftVectorX, leftVectorY) || 1;

    const isSmallElement = topLen < 55 || leftLen < 55;
    const isTinyElement = topLen < 32 || leftLen < 32;

    const normalX = -topVectorY / topLen;
    const normalY = topVectorX / topLen;
    const rotOffset = isTinyElement ? 36 : isSmallElement ? 32 : 28;
    const rotHandle = { x: midTop.x + normalX * rotOffset, y: midTop.y + normalY * rotOffset };

    // 1. Rotation knob test (tested first, outside the box)
    if (Math.hypot(cx - rotHandle.x, cy - rotHandle.y) <= (isTinyElement ? 10 : 12)) return 'rot';

    // 2. Corner resize handles test
    const cornerHitDist = isTinyElement ? 5.5 : isSmallElement ? 7 : 10;
    if (Math.hypot(cx - p0.x, cy - p0.y) <= cornerHitDist) return 'nw';
    if (Math.hypot(cx - p1.x, cy - p1.y) <= cornerHitDist) return 'ne';
    if (Math.hypot(cx - p2.x, cy - p2.y) <= cornerHitDist) return 'se';
    if (Math.hypot(cx - p3.x, cy - p3.y) <= cornerHitDist) return 'sw';

    // 3. For large elements, test edge midpoints
    if (!isSmallElement) {
      const midHitDist = 8;
      if (Math.hypot(cx - midTop.x, cy - midTop.y) <= midHitDist) return 'n';
      if (Math.hypot(cx - midRight.x, cy - midRight.y) <= midHitDist) return 'e';
      if (Math.hypot(cx - midBottom.x, cy - midBottom.y) <= midHitDist) return 's';
      if (Math.hypot(cx - midLeft.x, cy - midLeft.y) <= midHitDist) return 'w';
    }

    // 4. Check inside polygon (or generous perimeter) for move
    const clickedLayerId = hitTestLayer(cx, cy);
    if (clickedLayerId === selectedLayer.id) return 'move';

    return null;
  }, [selectedLayer, currentFrame, computeLayerMatrix, hitTestLayer]);

  // Dynamic Hover Cursor
  const [canvasCursor, setCanvasCursor] = useState<string>('default');

  // Mouse Down Event Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || activeTool === 'hand') {
      setIsInteracting(true);
      setDragHandle('pan');
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (e.button !== 0) return;

    const isModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
    const coords = clientToCanvasCoords(e.clientX, e.clientY);
    const handle = getHandleUnderMouse(coords.x, coords.y);

    if (handle) {
      setIsInteracting(true);
      setDragHandle(handle);
      setDragStart(coords);

      // Snapshot all selected layers transforms for simultaneous collective delta manipulation
      const initialMap: Record<string, EditableLayer['transform']> = {};
      layers.forEach(l => {
        if (activeSelectedIds.includes(l.id)) {
          initialMap[l.id] = { ...l.transform };
        }
      });
      setInitialTransformsMap(initialMap);

      if (selectedLayer) {
        setInitialTransform({ ...selectedLayer.transform });
      }
    } else {
      const clickedId = hitTestLayer(coords.x, coords.y);
      if (clickedId) {
        if (isModifierKey) {
          onSelectLayer(clickedId, true);
        } else {
          // If clicking an unselected layer without Ctrl/Shift, select it
          // If clicking one of the already selected multiple layers, keep selection to drag together
          if (!activeSelectedIds.includes(clickedId)) {
            onSelectLayer(clickedId, false);
          }
        }

        const effectiveIds = activeSelectedIds.includes(clickedId) ? activeSelectedIds : [clickedId];
        const initialMap: Record<string, EditableLayer['transform']> = {};
        layers.forEach(l => {
          if (effectiveIds.includes(l.id)) {
            initialMap[l.id] = { ...l.transform };
          }
        });
        setInitialTransformsMap(initialMap);

        const targetLayer = layers.find(l => l.id === clickedId);
        if (targetLayer) {
          setIsInteracting(true);
          setDragHandle('move');
          setDragStart(coords);
          setInitialTransform({ ...targetLayer.transform });
        }
      } else {
        if (!isModifierKey) {
          onSelectLayer(null, false);
        }
      }
    }
  };

  // Mouse Move Event Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting) {
      if (activeTool === 'hand') {
        setCanvasCursor('grab');
        return;
      }
      const coords = clientToCanvasCoords(e.clientX, e.clientY);
      const handle = getHandleUnderMouse(coords.x, coords.y);

      if (handle) {
        if (handle === 'rot') setCanvasCursor('crosshair');
        else if (handle === 'nw' || handle === 'se') setCanvasCursor('nwse-resize');
        else if (handle === 'ne' || handle === 'sw') setCanvasCursor('nesw-resize');
        else if (handle === 'n' || handle === 's') setCanvasCursor('ns-resize');
        else if (handle === 'e' || handle === 'w') setCanvasCursor('ew-resize');
        else if (handle === 'move') setCanvasCursor('move');
        else setCanvasCursor('default');
      } else {
        const hoverId = hitTestLayer(coords.x, coords.y);
        if (hoverId) {
          setCanvasCursor('move');
        } else {
          setCanvasCursor('default');
        }
      }
      return;
    }

    if (dragHandle === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      onPanChange({ x: panOffset.x + dx, y: panOffset.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!selectedLayer || !initialTransform) return;

    const coords = clientToCanvasCoords(e.clientX, e.clientY);
    const deltaX = coords.x - dragStart.x;
    const deltaY = coords.y - dragStart.y;

    const isBulk = activeSelectedIds.length > 1 && onBulkUpdateTransforms;

    if (dragHandle === 'move') {
      if (isBulk) {
        // Bulk move all selected layers simultaneously
        const updates = activeSelectedIds.map(id => {
          const orig = initialTransformsMap[id] || layers.find(l => l.id === id)?.transform;
          if (!orig) return null;
          return {
            id,
            transform: {
              x: Math.round(orig.x + deltaX),
              y: Math.round(orig.y + deltaY)
            }
          };
        }).filter(Boolean) as Array<{ id: string; transform: Partial<EditableLayer['transform']> }>;

        onBulkUpdateTransforms(updates);
      } else {
        let newX = Math.round(initialTransform.x + deltaX);
        let newY = Math.round(initialTransform.y + deltaY);

        // Smart Snapping to Canvas Center / Borders
        const guides: GuideLine[] = [];
        const cx = newX + selectedLayer.initialBounds.width / 2;
        const cy = newY + selectedLayer.initialBounds.height / 2;
        const snapThreshold = 6;

        // Horizontal Center snap
        if (Math.abs(cx - project.width / 2) <= snapThreshold) {
          newX = Math.round(project.width / 2 - selectedLayer.initialBounds.width / 2);
          guides.push({ type: 'vertical', position: project.width / 2 });
        }
        // Vertical Center snap
        if (Math.abs(cy - project.height / 2) <= snapThreshold) {
          newY = Math.round(project.height / 2 - selectedLayer.initialBounds.height / 2);
          guides.push({ type: 'horizontal', position: project.height / 2 });
        }

        setActiveGuides(guides);
        onUpdateLayerTransform(selectedLayer.id, { x: newX, y: newY });
      }
    } else if (dragHandle === 'rot') {
      // Rotation Handle Dragging
      const pivotX = selectedLayer.initialBounds.x + selectedLayer.initialBounds.width / 2;
      const pivotY = selectedLayer.initialBounds.y + selectedLayer.initialBounds.height / 2;
      const centerCanvasX = pivotX + (initialTransform.x - selectedLayer.initialBounds.x);
      const centerCanvasY = pivotY + (initialTransform.y - selectedLayer.initialBounds.y);

      const angleRad = Math.atan2(coords.y - centerCanvasY, coords.x - centerCanvasX);
      let angleDeg = Math.round((angleRad * 180) / Math.PI) + 90;
      if (angleDeg > 180) angleDeg -= 360;
      if (angleDeg < -180) angleDeg += 360;

      // Snap to 45 degree increments if shift is pressed
      if (e.shiftKey) {
        angleDeg = Math.round(angleDeg / 45) * 45;
      }

      if (isBulk) {
        const rotDelta = angleDeg - initialTransform.rotation;
        const updates = activeSelectedIds.map(id => {
          const orig = initialTransformsMap[id] || layers.find(l => l.id === id)?.transform;
          if (!orig) return null;
          return {
            id,
            transform: {
              rotation: Math.round((orig.rotation + rotDelta) % 360)
            }
          };
        }).filter(Boolean) as Array<{ id: string; transform: Partial<EditableLayer['transform']> }>;

        onBulkUpdateTransforms(updates);
      } else {
        onUpdateLayerTransform(selectedLayer.id, { rotation: angleDeg });
      }
    } else if (['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'].includes(dragHandle || '')) {
      // Scaling Resize Handles
      const initW = Math.max(10, selectedLayer.initialBounds.width);
      const initH = Math.max(10, selectedLayer.initialBounds.height);
      let factorX = 1;
      let factorY = 1;

      if (dragHandle?.includes('e')) factorX = 1 + deltaX / (initW * initialTransform.scaleX);
      if (dragHandle?.includes('w')) factorX = 1 - deltaX / (initW * initialTransform.scaleX);
      if (dragHandle?.includes('s')) factorY = 1 + deltaY / (initH * initialTransform.scaleY);
      if (dragHandle?.includes('n')) factorY = 1 - deltaY / (initH * initialTransform.scaleY);

      if (selectedLayer.aspectRatioLocked || e.shiftKey) {
        const factor = Math.max(factorX, factorY);
        factorX = factor;
        factorY = factor;
      }

      const multX = Math.max(0.05, factorX);
      const multY = Math.max(0.05, factorY);

      if (isBulk) {
        const updates = activeSelectedIds.map(id => {
          const orig = initialTransformsMap[id] || layers.find(l => l.id === id)?.transform;
          const targetL = layers.find(l => l.id === id);
          if (!orig || !targetL) return null;
          const targetInitW = Math.max(10, targetL.initialBounds.width);
          const targetInitH = Math.max(10, targetL.initialBounds.height);
          const newSX = Math.max(0.05, Math.min(10, orig.scaleX * multX));
          const newSY = Math.max(0.05, Math.min(10, orig.scaleY * multY));
          return {
            id,
            transform: {
              scaleX: parseFloat(newSX.toFixed(3)),
              scaleY: parseFloat(newSY.toFixed(3)),
              width: Math.round(targetInitW * newSX),
              height: Math.round(targetInitH * newSY)
            }
          };
        }).filter(Boolean) as Array<{ id: string; transform: Partial<EditableLayer['transform']> }>;

        onBulkUpdateTransforms(updates);
      } else {
        const newScaleX = Math.max(0.05, Math.min(10, initialTransform.scaleX * multX));
        const newScaleY = Math.max(0.05, Math.min(10, initialTransform.scaleY * multY));

        onUpdateLayerTransform(selectedLayer.id, {
          scaleX: parseFloat(newScaleX.toFixed(3)),
          scaleY: parseFloat(newScaleY.toFixed(3)),
          width: Math.round(initW * newScaleX),
          height: Math.round(initH * newScaleY)
        });
      }
    }
  };

  // Mouse Up Handler
  const handleMouseUp = () => {
    setIsInteracting(false);
    setDragHandle(null);
    setInitialTransform(null);
    setActiveGuides([]);
  };

  // Wheel Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(15, Math.min(500, Math.round(zoom * zoomFactor)));
      onZoomChange(newZoom);
    } else {
      onPanChange({
        x: panOffset.x - e.deltaX * 0.8,
        y: panOffset.y - e.deltaY * 0.8
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#050811] overflow-hidden flex items-center justify-center select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: activeTool === 'hand' || dragHandle === 'pan' ? 'grab' : canvasCursor }}
    >
      {/* Floating Canvas Viewport Info Pill & Preset Quick Zoom */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-2xl shadow-xl">
        <span className="text-[11px] font-mono font-bold text-slate-300">
          {project.width} × {project.height} px
        </span>
        <div className="h-3 w-px bg-white/10" />
        <span className="text-[11px] font-mono text-indigo-400 font-bold">{zoom}%</span>

        <div className="h-3 w-px bg-white/10" />

        {/* Quick presets */}
        <div className="flex items-center gap-1">
          {[25, 50, 100, 200, 400, 800].map(pz => (
            <button
              key={pz}
              onClick={() => onZoomChange(pz)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                zoom === pz ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
              title={`مستوى التكبير ${pz}%`}
            >
              {pz}%
            </button>
          ))}
        </div>
      </div>

      {/* Floating Zoom & Reset Toolbar with Slider, Focus on Selection and Fit */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-white/10 p-1.5 px-2.5 rounded-2xl shadow-xl">
        <button
          onClick={() => onZoomChange(Math.max(10, zoom - 25))}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          title="تصغير (Zoom Out)"
        >
          <ZoomOut size={14} />
        </button>

        {/* Live Smooth Zoom Slider up to 800% */}
        <div className="flex items-center gap-1.5 w-24">
          <input
            type="range"
            min={10}
            max={800}
            step={10}
            value={zoom}
            onChange={(e) => onZoomChange(parseInt(e.target.value) || 100)}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            title={`مستوى التكبير: ${zoom}%`}
          />
        </div>

        <button
          onClick={() => {
            onZoomChange(100);
            onPanChange({ x: 0, y: 0 });
          }}
          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold text-slate-300 rounded-lg transition-colors cursor-pointer"
          title="إعادة ضبط الحجم (100%)"
        >
          100%
        </button>

        <button
          onClick={() => onZoomChange(Math.min(800, zoom + 25))}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          title="تكبير (Zoom In)"
        >
          <ZoomIn size={14} />
        </button>

        <div className="h-3 w-px bg-white/10 mx-0.5" />

        {/* Focus / Zoom to Selected Layer */}
        {selectedLayer && (
          <button
            onClick={handleZoomToSelection}
            className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-[10px] font-bold text-purple-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-purple-500/30"
            title="تكبير والتركيز على الطبقة المحددة (Focus Selected Layer)"
          >
            <Focus size={12} />
            <span>تكبير على العنصر</span>
          </button>
        )}

        {/* Auto Fit to Screen Button */}
        <button
          onClick={() => {
            if (!containerRef.current) return;
            const cw = containerRef.current.clientWidth - 80;
            const ch = containerRef.current.clientHeight - 80;
            if (cw > 0 && ch > 0 && project.width > 0 && project.height > 0) {
              const sw = cw / project.width;
              const sh = ch / project.height;
              const fit = Math.max(10, Math.min(400, Math.round(Math.min(sw, sh) * 100)));
              onZoomChange(fit);
              onPanChange({ x: 0, y: 0 });
            }
          }}
          className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-[10px] font-bold text-indigo-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-indigo-500/30"
          title="ملاءمة الكانفاس لحجم الشاشة (Fit to View)"
        >
          <Maximize2 size={11} />
          <span>ملاءمة</span>
        </button>

        <button
          onClick={() => onPanChange({ x: 0, y: 0 })}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
          title="توسيط الكانفاس (Center Pan)"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Active Selected Layer Banner */}
      {selectedLayer && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-slate-900/90 border border-indigo-500/30 text-indigo-300 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl text-xs" dir="rtl">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-bold text-white max-w-[180px] truncate">{selectedLayer.name}</span>
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md">
            X:{Math.round(selectedLayer.transform.x)} Y:{Math.round(selectedLayer.transform.y)}
          </span>
          <button
            onClick={handleZoomToSelection}
            className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 text-[10px] font-bold text-indigo-200 hover:text-white rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            title="تكبير الكانفاس على العنصر"
          >
            <Focus size={10} />
            <span>تكبير</span>
          </button>
        </div>
      )}

      {/* The Interactive Canvas Element */}
      <div
        className="relative transition-transform duration-75 shadow-2xl rounded-sm overflow-hidden"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
          transformOrigin: 'center center',
          width: `${project.width}px`,
          height: `${project.height}px`
        }}
      >
        <canvas
          ref={canvasRef}
          width={project.width}
          height={project.height}
          className="block pointer-events-none"
        />
      </div>
    </div>
  );
};
