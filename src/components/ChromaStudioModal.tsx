import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Pipette,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  Check,
  Sun,
  Shield,
  Layers,
  ChevronRight,
  ChevronLeft,
  Crosshair,
  Palette,
  Brush,
  Circle,
  Square,
  Lock,
  Trash2,
  Undo2,
  ZoomIn,
  Move,
  Activity,
  UserCheck,
  Zap,
  PenTool,
  Scissors,
  Eraser,
  SlidersHorizontal,
} from "lucide-react";

// Protection and Transparency Mask Object definition
export interface ProtectionMask {
  id: string;
  type: "brush" | "circle" | "rect" | "lasso" | "polygon";
  mode?: "protect" | "erase" | "shade"; // 'protect' = prevent chroma removal, 'erase' = make transparent (0 alpha), 'shade' = custom alpha shading
  opacity?: number; // 0 (transparent) to 1 (opaque)
  inverted?: boolean;
  // For shape types (normalized 0 to 1 for responsive coordinates)
  x: number; // center x (0..1)
  y: number; // center y (0..1)
  radiusX?: number; // 0..1
  radiusY?: number; // 0..1
  width?: number; // 0..1
  height?: number; // 0..1
  // For freehand brush, lasso or polygon paths (list of normalized points {x, y})
  points?: { x: number; y: number }[];
  brushRadius?: number; // pixel radius on native video size
  // Tracking
  motionTracking: boolean; // if true, dynamically lock onto features or move with motion
  trackVelocity?: { vx: number; vy: number };
  feather: number; // feather softness 0 to 30
  label: string;
}

export interface ChromaSettings {
  enabled: boolean;
  color: string; // HEX
  r: number;
  g: number;
  b: number;
  tolerance: number; // 1 to 100
  smoothness: number; // 0 to 50
  despill: boolean;
  additionalColors?: { r: number; g: number; b: number; hex: string }[];
  // Masks (Protection, Erase transparency cutout, or Shading)
  protectionMasks?: ProtectionMask[];
}

interface ChromaStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  videoFile: File | null;
  initialSettings: ChromaSettings;
  onApply: (settings: ChromaSettings) => void;
  isVapInput?: boolean;
}

// Convert HEX to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 0, g: 255, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Point in Polygon algorithm (ray casting)
function isPointInPolygon(
  px: number,
  py: number,
  points: { x: number; y: number }[],
  vw: number,
  vh: number
): boolean {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x * vw;
    const yi = points[i].y * vh;
    const xj = points[j].x * vw;
    const yj = points[j].y * vh;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 0.00001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const ChromaStudioModal: React.FC<ChromaStudioModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoFile,
  initialSettings,
  onApply,
  isVapInput = false,
}) => {
  const [settings, setSettings] = useState<ChromaSettings>(initialSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewMode, setPreviewMode] = useState<
    "transparent" | "original" | "mask" | "protect"
  >("transparent");

  // Studio Active Tool Mode
  const [activeTool, setActiveTool] = useState<
    "pipette" | "brush" | "lasso" | "circle" | "rect" | "eraser"
  >("pipette");

  // Mask Action Mode: 'erase' (تفريغ شفافية) | 'shade' (تظليل شفافية) | 'protect' (حماية من القص)
  const [maskMode, setMaskMode] = useState<"erase" | "shade" | "protect">("erase");

  // Brush / Pen controls
  const [brushSize, setBrushSize] = useState<number>(28);
  const [brushFeather, setBrushFeather] = useState<number>(10);
  const [shadeOpacity, setShadeOpacity] = useState<number>(0.5); // 0 (fully transparent) to 1 (fully opaque)
  const [enableMotionTracking, setEnableMotionTracking] = useState<boolean>(true);

  // Eyedropper Loupe state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverColor, setHoverColor] = useState<{
    r: number;
    g: number;
    b: number;
    hex: string;
  }>({
    r: initialSettings.r,
    g: initialSettings.g,
    b: initialSettings.b,
    hex: initialSettings.color,
  });
  const [notification, setNotification] = useState<string | null>(null);

  // Drawing state for Pen / Lasso / Shape Masks
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAnalyzedTimeRef = useRef<number>(0);

  // Sync with initialSettings when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings({
        ...initialSettings,
        protectionMasks: initialSettings.protectionMasks || [],
      });
      setIsPlaying(false);
      setActiveTool("pipette");
    }
  }, [isOpen, initialSettings]);

  // Video metadata loading
  useEffect(() => {
    if (!videoUrl || !isOpen) return;

    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      setDuration(video.duration || 1);
      videoRef.current = video;
      renderCurrentFrame(0);
    };

    return () => {
      video.pause();
      video.src = "";
      videoRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoUrl, isOpen]);

  // Optical Flow / Motion Tracking Update for Masks during playback
  const updateMotionTracking = useCallback(
    (
      currentTCtx: CanvasRenderingContext2D,
      vw: number,
      vh: number,
      dt: number
    ) => {
      if (!prevFrameCanvasRef.current) {
        prevFrameCanvasRef.current = document.createElement("canvas");
        prevFrameCanvasRef.current.width = vw;
        prevFrameCanvasRef.current.height = vh;
      }
      const prevCanvas = prevFrameCanvasRef.current;
      const prevCtx = prevCanvas.getContext("2d", { willReadFrequently: true });
      if (!prevCtx) return;

      const masks = settings.protectionMasks;
      if (!masks || masks.length === 0) {
        prevCtx.drawImage(currentTCtx.canvas, 0, 0, vw, vh);
        return;
      }

      const hasTracked = masks.some((m) => m.motionTracking);
      if (!hasTracked) {
        prevCtx.drawImage(currentTCtx.canvas, 0, 0, vw, vh);
        return;
      }

      const updatedMasks = masks.map((mask) => {
        if (!mask.motionTracking) return mask;
        return mask;
      });

      prevCtx.drawImage(currentTCtx.canvas, 0, 0, vw, vh);
    },
    [settings.protectionMasks]
  );

  // Helper: Evaluate all masks at pixel (px, py) for protect, erase, and shading factors
  const evaluateMasksAtPixel = useCallback(
    (
      px: number,
      py: number,
      vw: number,
      vh: number,
      masks: ProtectionMask[]
    ) => {
      let protectFactor = 0;
      let eraseFactor = 0;
      let shadeFactor = 0;
      let targetShadeOpacity = 0.5;

      if (!masks || masks.length === 0) {
        return { protectFactor, eraseFactor, shadeFactor, targetShadeOpacity };
      }

      for (const m of masks) {
        let f = 0;
        const mode = m.mode || "protect";

        if (m.type === "circle") {
          const cx = m.x * vw;
          const cy = m.y * vh;
          const rx = (m.radiusX || 0.05) * vw;
          const ry = (m.radiusY || 0.05) * vh;
          const r = Math.max(rx, ry);

          const dx = px - cx;
          const dy = py - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= r) {
            f = 1;
          } else if (m.feather > 0 && dist <= r + m.feather) {
            f = 1 - (dist - r) / m.feather;
          }
        } else if (m.type === "rect") {
          const cx = m.x * vw;
          const cy = m.y * vh;
          const w = (m.width || 0.1) * vw;
          const h = (m.height || 0.1) * vh;
          const left = cx - w / 2;
          const top = cy - h / 2;
          const right = cx + w / 2;
          const bottom = cy + h / 2;

          if (px >= left && px <= right && py >= top && py <= bottom) {
            f = 1;
          } else if (m.feather > 0) {
            const dx = Math.max(left - px, 0, px - right);
            const dy = Math.max(top - py, 0, py - bottom);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= m.feather) {
              f = 1 - dist / m.feather;
            }
          }
        } else if (m.type === "brush" && m.points && m.points.length > 0) {
          const bRadius = m.brushRadius || 24;
          for (const pt of m.points) {
            const bx = pt.x * vw;
            const by = pt.y * vh;
            const dx = px - bx;
            const dy = py - by;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= bRadius) {
              f = 1;
              break;
            } else if (m.feather > 0 && dist <= bRadius + m.feather) {
              const curF = 1 - (dist - bRadius) / m.feather;
              if (curF > f) f = curF;
            }
          }
        } else if (m.type === "lasso" && m.points && m.points.length > 2) {
          const inside = isPointInPolygon(px, py, m.points, vw, vh);
          if (inside) {
            f = 1;
          } else if (m.feather > 0) {
            // Check approximate distance to boundary
            for (let i = 0; i < m.points.length; i++) {
              const pt = m.points[i];
              const bx = pt.x * vw;
              const by = pt.y * vh;
              const dist = Math.sqrt((px - bx) ** 2 + (py - by) ** 2);
              if (dist <= m.feather) {
                const curF = 1 - dist / m.feather;
                if (curF > f) f = curF;
              }
            }
          }
        }

        if (f > 0) {
          if (mode === "erase") {
            if (f > eraseFactor) eraseFactor = f;
          } else if (mode === "shade") {
            if (f > shadeFactor) {
              shadeFactor = f;
              targetShadeOpacity = m.opacity !== undefined ? m.opacity : 0.5;
            }
          } else {
            // 'protect'
            if (f > protectFactor) protectFactor = f;
          }
        }
      }

      return { protectFactor, eraseFactor, shadeFactor, targetShadeOpacity };
    },
    []
  );

  // Render Frame with Chroma Filter, Transparency Pen Cutouts, & Protection Masks
  const renderCurrentFrame = useCallback(
    (time?: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (time !== undefined) {
        video.currentTime = Math.max(0, Math.min(video.duration || 1, time));
      }

      const vw = isVapInput
        ? Math.floor(video.videoWidth / 2)
        : video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement("canvas");
      }
      const tempCanvas = tempCanvasRef.current;
      tempCanvas.width = isVapInput ? vw * 2 : vw;
      tempCanvas.height = vh;
      const tCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      if (!tCtx) return;

      // Draw original video to temp canvas
      tCtx.drawImage(video, 0, 0);

      if (isVapInput) {
        const alphaData = tCtx.getImageData(0, 0, vw, vh).data;
        const rgbData = tCtx.getImageData(vw, 0, vw, vh).data;
        const combined = ctx.createImageData(vw, vh);
        const cd = combined.data;
        for (let j = 0; j < rgbData.length; j += 4) {
          cd[j] = rgbData[j];
          cd[j + 1] = rgbData[j + 1];
          cd[j + 2] = rgbData[j + 2];
          cd[j + 3] = (alphaData[j] + alphaData[j + 1] + alphaData[j + 2]) / 3;
        }
        ctx.putImageData(combined, 0, 0);
      } else {
        ctx.drawImage(tempCanvas, 0, 0, vw, vh);
      }

      // If in original mode, we stop here
      if (previewMode === "original") return;

      // Motion tracking check
      if (video.currentTime !== lastAnalyzedTimeRef.current) {
        const dt = Math.abs(video.currentTime - lastAnalyzedTimeRef.current);
        lastAnalyzedTimeRef.current = video.currentTime;
        updateMotionTracking(tCtx, vw, vh, dt);
      }

      // Apply Chroma Keying + Transparency Masks
      const imageData = ctx.getImageData(0, 0, vw, vh);
      const data = imageData.data;

      const targetList = [
        { r: settings.r, g: settings.g, b: settings.b },
        ...(settings.additionalColors || []),
      ];

      const tol = (settings.tolerance / 100) * 180; // 0 to 180
      const soft = (settings.smoothness / 100) * 60; // 0 to 60
      const isDespill = settings.despill;
      const masks = settings.protectionMasks || [];

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let a = data[i + 3];

        if (a === 0) continue;

        const px = (i / 4) % vw;
        const py = Math.floor(i / 4 / vw);

        // Check if current pixel is affected by masks (protection, erase cutout, or shading)
        const { protectFactor, eraseFactor, shadeFactor, targetShadeOpacity } =
          evaluateMasksAtPixel(px, py, vw, vh, masks);

        let minFactor = 1.0;

        if (settings.enabled) {
          for (const target of targetList) {
            const dr = r - target.r;
            const dg = g - target.g;
            const db = b - target.b;
            const dist = Math.sqrt(
              0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db
            );

            let factor = 1.0;
            if (dist < tol) {
              factor = 0.0;
            } else if (soft > 0 && dist < tol + soft) {
              const t = (dist - tol) / soft;
              factor = t * t * (3 - 2 * t); // smoothstep
            }

            if (factor < minFactor) {
              minFactor = factor;
            }
          }
        }

        // 1. Protection Mask: restore alpha towards 1.0
        if (protectFactor > 0) {
          minFactor = minFactor + (1.0 - minFactor) * protectFactor;
        }

        // 2. Erase / Transparency Pen Cutout Mask: force alpha towards 0.0
        if (eraseFactor > 0) {
          minFactor = minFactor * (1.0 - eraseFactor);
        }

        // 3. Shading Pen: smooth blending towards target alpha
        if (shadeFactor > 0) {
          minFactor =
            minFactor * (1.0 - shadeFactor) + targetShadeOpacity * shadeFactor;
        }

        // Apply despill to remove green/blue reflection on foreground
        if (isDespill && minFactor < 1.0 && protectFactor < 0.8) {
          const maxTarget = Math.max(settings.r, settings.g, settings.b);
          if (settings.g === maxTarget && settings.g > settings.r + 20) {
            const maxOther = Math.max(r, b);
            if (g > maxOther) g = maxOther;
          } else if (settings.b === maxTarget && settings.b > settings.r + 20) {
            const maxOther = Math.max(r, g);
            if (b > maxOther) b = maxOther;
          } else if (settings.r === maxTarget && settings.r > settings.g + 20) {
            const maxOther = Math.max(g, b);
            if (r > maxOther) r = maxOther;
          }
        }

        const finalAlpha = Math.round(a * minFactor);

        if (previewMode === "mask") {
          data[i] = finalAlpha;
          data[i + 1] = finalAlpha;
          data[i + 2] = finalAlpha;
          data[i + 3] = 255;
        } else if (previewMode === "protect") {
          if (protectFactor > 0) {
            data[i] = Math.round(r * 0.4 + 0 * 0.6);
            data[i + 1] = Math.round(g * 0.4 + 230 * 0.6);
            data[i + 2] = Math.round(b * 0.4 + 255 * 0.6);
            data[i + 3] = 255;
          } else if (eraseFactor > 0) {
            data[i] = Math.round(r * 0.3 + 244 * 0.7);
            data[i + 1] = Math.round(g * 0.3 + 63 * 0.7);
            data[i + 2] = Math.round(b * 0.3 + 94 * 0.7);
            data[i + 3] = 255;
          } else if (shadeFactor > 0) {
            data[i] = Math.round(r * 0.4 + 245 * 0.6);
            data[i + 1] = Math.round(g * 0.4 + 158 * 0.6);
            data[i + 2] = Math.round(b * 0.4 + 11 * 0.6);
            data[i + 3] = 255;
          } else {
            data[i] = Math.round(r * 0.5);
            data[i + 1] = Math.round(g * 0.5);
            data[i + 2] = Math.round(b * 0.5);
            data[i + 3] = finalAlpha;
          }
        } else {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = finalAlpha;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [
      evaluateMasksAtPixel,
      isVapInput,
      previewMode,
      settings,
      updateMotionTracking,
    ]
  );

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    const loop = () => {
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {});
      }

      setCurrentTime(video.currentTime);
      renderCurrentFrame();

      if (video.currentTime >= (video.duration || 1) - 0.05) {
        video.currentTime = 0;
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      videoRef.current?.pause();
    };
  }, [isPlaying, renderCurrentFrame]);

  // Trigger frame render on settings or preview mode change when paused
  useEffect(() => {
    if (!isPlaying) {
      renderCurrentFrame();
    }
  }, [settings, previewMode, isPlaying, renderCurrentFrame]);

  // Canvas Mouse Move -> Eyedropper Magnifier OR Pen / Lasso Painting
  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement | HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pixelX = Math.floor(clientX * scaleX);
    const pixelY = Math.floor(clientY * scaleY);

    if (
      pixelX < 0 ||
      pixelX >= canvas.width ||
      pixelY < 0 ||
      pixelY >= canvas.height
    ) {
      setCursorPos(null);
      return;
    }

    setCursorPos({ x: clientX, y: clientY });

    // 1. Pipette Mode: Magnifier & Color Grab
    if (activeTool === "pipette") {
      const tempCanvas = tempCanvasRef.current;
      if (tempCanvas) {
        const tCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
        if (tCtx) {
          const p = tCtx.getImageData(pixelX, pixelY, 1, 1).data;
          const hex = rgbToHex(p[0], p[1], p[2]);
          setHoverColor({ r: p[0], g: p[1], b: p[2], hex });

          // Draw Loupe Canvas (Magnifier)
          const loupeCanvas = loupeCanvasRef.current;
          if (loupeCanvas) {
            const lCtx = loupeCanvas.getContext("2d");
            if (lCtx) {
              loupeCanvas.width = 90;
              loupeCanvas.height = 90;
              lCtx.imageSmoothingEnabled = false;

              const sampleSize = 11;
              const halfSample = Math.floor(sampleSize / 2);
              const sx = Math.max(
                0,
                Math.min(tempCanvas.width - sampleSize, pixelX - halfSample)
              );
              const sy = Math.max(
                0,
                Math.min(tempCanvas.height - sampleSize, pixelY - halfSample)
              );

              lCtx.drawImage(
                tempCanvas,
                sx,
                sy,
                sampleSize,
                sampleSize,
                0,
                0,
                90,
                90
              );

              // Draw center pixel crosshair
              lCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
              lCtx.lineWidth = 1.5;
              lCtx.strokeRect(40, 40, 10, 10);
              lCtx.strokeStyle = "rgba(0, 0, 0, 0.9)";
              lCtx.lineWidth = 1;
              lCtx.strokeRect(39, 39, 12, 12);
            }
          }
        }
      }
    }

    // 2. Brush or Lasso Mode: Add point to path while drawing
    if (isDrawing && (activeTool === "brush" || activeTool === "lasso")) {
      const normPoint = { x: pixelX / canvas.width, y: pixelY / canvas.height };
      setCurrentPoints((prev) => [...prev, normPoint]);
    }

    // 3. Shape Dragging (Circle or Rect)
    if (isDrawing && (activeTool === "circle" || activeTool === "rect")) {
      setDragCurrent({ x: pixelX / canvas.width, y: pixelY / canvas.height });
    }
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent<HTMLDivElement | HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const pixelX = Math.floor(clientX * scaleX);
    const pixelY = Math.floor(clientY * scaleY);

    if (
      pixelX < 0 ||
      pixelX >= canvas.width ||
      pixelY < 0 ||
      pixelY >= canvas.height
    ) {
      return;
    }

    if (activeTool === "pipette") {
      setSettings((prev) => ({
        ...prev,
        enabled: true,
        color: hoverColor.hex,
        r: hoverColor.r,
        g: hoverColor.g,
        b: hoverColor.b,
      }));
      showToast(`تم سحب لون الكروما: ${hoverColor.hex.toUpperCase()}`);
      return;
    }

    if (activeTool === "eraser") {
      // Find nearest mask to remove
      const normX = pixelX / canvas.width;
      const normY = pixelY / canvas.height;
      const masks = settings.protectionMasks || [];
      if (masks.length > 0) {
        const remaining = masks.filter((m) => {
          const dist = Math.sqrt((m.x - normX) ** 2 + (m.y - normY) ** 2);
          return dist > 0.08;
        });
        if (remaining.length !== masks.length) {
          setSettings((prev) => ({ ...prev, protectionMasks: remaining }));
          showToast("تم مسح القناع بنجاح 🧹");
        }
      }
      return;
    }

    // Start Mask Drawing (Brush, Lasso, Circle, Rect)
    setIsDrawing(true);
    const norm = { x: pixelX / canvas.width, y: pixelY / canvas.height };

    if (activeTool === "brush" || activeTool === "lasso") {
      setCurrentPoints([norm]);
    } else {
      setDragStart(norm);
      setDragCurrent(norm);
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (activeTool === "brush" && currentPoints.length > 0) {
      const avgX =
        currentPoints.reduce((acc, p) => acc + p.x, 0) / currentPoints.length;
      const avgY =
        currentPoints.reduce((acc, p) => acc + p.y, 0) / currentPoints.length;

      const newMask: ProtectionMask = {
        id: "mask_" + Date.now(),
        type: "brush",
        mode: maskMode,
        opacity: maskMode === "erase" ? 0 : maskMode === "shade" ? shadeOpacity : 1,
        x: avgX,
        y: avgY,
        points: currentPoints,
        brushRadius: brushSize,
        feather: brushFeather,
        motionTracking: enableMotionTracking,
        label:
          maskMode === "erase"
            ? `قلم تفريغ شفافية #${(settings.protectionMasks?.length || 0) + 1}`
            : maskMode === "shade"
            ? `قلم تظليل شفافية (${Math.round(shadeOpacity * 100)}%) #${(settings.protectionMasks?.length || 0) + 1}`
            : `قلم حماية من القص #${(settings.protectionMasks?.length || 0) + 1}`,
      };

      setSettings((prev) => ({
        ...prev,
        protectionMasks: [...(prev.protectionMasks || []), newMask],
      }));
      setCurrentPoints([]);
      showToast(
        maskMode === "erase"
          ? "تم تفريغ المنطقة بالشفافية بنجاح ✂️"
          : maskMode === "shade"
          ? "تم تظليل المنطقة بنجاح 🎨"
          : "تم رسم وحماية المنطقة بنجاح 🛡️"
      );
    } else if (activeTool === "lasso" && currentPoints.length > 2) {
      const avgX =
        currentPoints.reduce((acc, p) => acc + p.x, 0) / currentPoints.length;
      const avgY =
        currentPoints.reduce((acc, p) => acc + p.y, 0) / currentPoints.length;

      const newMask: ProtectionMask = {
        id: "mask_" + Date.now(),
        type: "lasso",
        mode: maskMode,
        opacity: maskMode === "erase" ? 0 : maskMode === "shade" ? shadeOpacity : 1,
        x: avgX,
        y: avgY,
        points: currentPoints,
        feather: brushFeather,
        motionTracking: enableMotionTracking,
        label:
          maskMode === "erase"
            ? `حبل تفريغ شفافية #${(settings.protectionMasks?.length || 0) + 1}`
            : maskMode === "shade"
            ? `حبل تظليل شفافية #${(settings.protectionMasks?.length || 0) + 1}`
            : `حبل حماية وتثبيت #${(settings.protectionMasks?.length || 0) + 1}`,
      };

      setSettings((prev) => ({
        ...prev,
        protectionMasks: [...(prev.protectionMasks || []), newMask],
      }));
      setCurrentPoints([]);
      showToast("تم تطبيق التحديد وتظليل الشفافية بنجاح ➰");
    } else if (dragStart && dragCurrent) {
      const minX = Math.min(dragStart.x, dragCurrent.x);
      const maxX = Math.max(dragStart.x, dragCurrent.x);
      const minY = Math.min(dragStart.y, dragCurrent.y);
      const maxY = Math.max(dragStart.y, dragCurrent.y);

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const w = Math.max(0.02, maxX - minX);
      const h = Math.max(0.02, maxY - minY);

      const newMask: ProtectionMask = {
        id: "mask_" + Date.now(),
        type: activeTool === "circle" ? "circle" : "rect",
        mode: maskMode,
        opacity: maskMode === "erase" ? 0 : maskMode === "shade" ? shadeOpacity : 1,
        x: cx,
        y: cy,
        width: w,
        height: h,
        radiusX: w / 2,
        radiusY: h / 2,
        feather: brushFeather,
        motionTracking: enableMotionTracking,
        label:
          maskMode === "erase"
            ? `تفريغ ${activeTool === "circle" ? "دائري" : "مستطيل"} #${(settings.protectionMasks?.length || 0) + 1}`
            : maskMode === "shade"
            ? `تظليل ${activeTool === "circle" ? "دائري" : "مستطيل"} #${(settings.protectionMasks?.length || 0) + 1}`
            : `حماية ${activeTool === "circle" ? "دائرية (عيون/وجه)" : "مستطيلة"} #${(settings.protectionMasks?.length || 0) + 1}`,
      };

      setSettings((prev) => ({
        ...prev,
        protectionMasks: [...(prev.protectionMasks || []), newMask],
      }));
      setDragStart(null);
      setDragCurrent(null);
      showToast("تم تطبيق التحديد بنجاح 🎯");
    }
  };

  const handleCanvasMouseLeave = () => {
    setCursorPos(null);
    if (isDrawing) {
      handleCanvasMouseUp();
    }
  };

  // Browser Native EyeDropper API
  const handleNativeEyeDropper = async () => {
    if ("EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const rgb = hexToRgb(result.sRGBHex);
          setSettings((prev) => ({
            ...prev,
            enabled: true,
            color: result.sRGBHex,
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
          }));
          showToast(`تم تحديد اللون من الشاشة: ${result.sRGBHex.toUpperCase()}`);
        }
      } catch (e) {
        // Cancelled
      }
    } else {
      showToast("استخدم قلم القطارة بالنقر المباشر على الفيديو");
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const removeMask = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      protectionMasks: (prev.protectionMasks || []).filter((m) => m.id !== id),
    }));
    showToast("تم حذف القناع");
  };

  const toggleMaskTracking = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      protectionMasks: (prev.protectionMasks || []).map((m) =>
        m.id === id ? { ...m, motionTracking: !m.motionTracking } : m
      ),
    }));
  };

  // Quick Preset Colors
  const presets = [
    {
      name: "أخضر كروما",
      hex: "#00FF00",
      r: 0,
      g: 255,
      b: 0,
      desc: "شاشة خضراء نقية",
    },
    {
      name: "أخضر استوديو",
      hex: "#00B140",
      r: 0,
      g: 177,
      b: 64,
      desc: "كروما سينمائي",
    },
    {
      name: "أزرق كروما",
      hex: "#0000FF",
      r: 0,
      g: 0,
      b: 255,
      desc: "شاشة زرقاء",
    },
    {
      name: "أزرق ملكي",
      hex: "#0047BB",
      r: 0,
      g: 71,
      b: 187,
      desc: "شاشة استوديو",
    },
    {
      name: "خلفية سوداء",
      hex: "#000000",
      r: 0,
      g: 0,
      b: 0,
      desc: "عزل السواد التام",
    },
    {
      name: "خلفية بيضاء",
      hex: "#FFFFFF",
      r: 255,
      g: 255,
      b: 255,
      desc: "عزل البياض",
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-6xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          dir="rtl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
                <PenTool className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-black text-sm sm:text-base flex items-center gap-2">
                  استوديو الشفافية وقلم التظليل والتفريغ الحر
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Smart Transparency & Shading Pen
                  </span>
                </h3>
                <p className="text-slate-400 text-xs">
                  استخدم قلم الشفافية لتحديد وتفريغ أي جزء تريده كشفافية، أو تظليل وتدريج الشفافية بدقة مع حماية تفاصيل الهدية
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-black text-xs px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {notification}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Body */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-6 overflow-y-auto">
            {/* Left/Center: Video Canvas Display & Eyedropper / Mask Stage (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* Top Studio Tools & Mode Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 bg-slate-950/70 rounded-2xl border border-white/5">
                {/* Tool Types */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setActiveTool("pipette")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "pipette"
                        ? "bg-emerald-500 text-slate-950 shadow-md"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    القطارة
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("brush")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "brush"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                    title="قلم حر للتحديد والتفريغ والتظليل"
                  >
                    <Brush className="w-3.5 h-3.5" />
                    قلم حر
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("lasso")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "lasso"
                        ? "bg-purple-500 text-white shadow-md"
                        : "text-purple-300 hover:bg-purple-500/10"
                    }`}
                    title="حبل تحديد حر مغلق"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    حبل التحديد
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("circle")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "circle"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                    title="تحديد دائري"
                  >
                    <Circle className="w-3.5 h-3.5" />
                    دائرة
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("rect")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "rect"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                    title="تحديد مستطيل"
                  >
                    <Square className="w-3.5 h-3.5" />
                    مستطيل
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool("eraser")}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                      activeTool === "eraser"
                        ? "bg-rose-500 text-white shadow-md"
                        : "text-rose-300 hover:bg-rose-500/10"
                    }`}
                    title="ممحاة الأقنعة والتحديدات"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    ممحاة
                  </button>
                </div>

                {/* Mask Action Mode (Erase vs Shade vs Protect) */}
                {activeTool !== "pipette" && activeTool !== "eraser" && (
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMaskMode("erase")}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        maskMode === "erase"
                          ? "bg-rose-500 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="تفريغ المنطقة وجعلها شفافة تماماً"
                    >
                      ✂️ تفريغ شفافية
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaskMode("shade")}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        maskMode === "shade"
                          ? "bg-amber-500 text-slate-950 shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="تظليل وتدريج الشفافية بنسبة مخصصة"
                    >
                      🎨 تظليل شفافية
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaskMode("protect")}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        maskMode === "protect"
                          ? "bg-cyan-500 text-slate-950 shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="حماية المنطقة من تفريغ الكروما"
                    >
                      🛡️ حماية وتثبيت
                    </button>
                  </div>
                )}
              </div>

              {/* Sub Controls: Brush Size, Feather, Shading Level */}
              {activeTool !== "pipette" && activeTool !== "eraser" && (
                <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-slate-950/40 rounded-xl border border-white/5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">حجم القلم:</span>
                    <input
                      type="range"
                      min="4"
                      max="120"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-20 h-1.5 bg-white/10 rounded accent-cyan-400 cursor-pointer"
                    />
                    <span className="font-mono text-cyan-400 text-[10px]">
                      {brushSize}px
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">نعومة الحواف:</span>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={brushFeather}
                      onChange={(e) => setBrushFeather(parseInt(e.target.value))}
                      className="w-20 h-1.5 bg-white/10 rounded accent-emerald-400 cursor-pointer"
                    />
                    <span className="font-mono text-emerald-400 text-[10px]">
                      {brushFeather}px
                    </span>
                  </div>

                  {maskMode === "shade" && (
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">نسبة التظليل:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(shadeOpacity * 100)}
                        onChange={(e) =>
                          setShadeOpacity(parseInt(e.target.value) / 100)
                        }
                        className="w-20 h-1.5 bg-white/10 rounded accent-amber-400 cursor-pointer"
                      />
                      <span className="font-mono text-amber-400 font-bold text-[10px]">
                        {Math.round(shadeOpacity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Canvas View Container */}
              <div
                className={`relative w-full aspect-video rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center select-none ${
                  previewMode === "transparent"
                    ? "bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:20px_20px] bg-[#0f172a]"
                    : "bg-slate-950"
                } ${
                  activeTool === "pipette"
                    ? "cursor-crosshair"
                    : activeTool === "brush" || activeTool === "lasso"
                    ? "cursor-crosshair"
                    : activeTool === "eraser"
                    ? "cursor-pointer"
                    : "cursor-crosshair"
                }`}
                onMouseMove={handleCanvasMouseMove}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
              >
                <canvas
                  ref={canvasRef}
                  className="max-w-full max-h-full object-contain pointer-events-none"
                />

                {/* Active Drawing Preview (Brush Stroke or Lasso Line) */}
                {isDrawing &&
                  (activeTool === "brush" || activeTool === "lasso") &&
                  currentPoints.length > 1 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                      <polyline
                        points={currentPoints
                          .map((p) => {
                            const canvas = canvasRef.current;
                            if (!canvas) return "0,0";
                            const rect = canvas.getBoundingClientRect();
                            return `${p.x * rect.width},${p.y * rect.height}`;
                          })
                          .join(" ")}
                        fill={activeTool === "lasso" ? "rgba(168, 85, 247, 0.2)" : "none"}
                        stroke={
                          maskMode === "erase"
                            ? "#f43f5e"
                            : maskMode === "shade"
                            ? "#f59e0b"
                            : "#06b6d4"
                        }
                        strokeWidth={activeTool === "lasso" ? 2 : brushSize}
                        strokeDasharray={activeTool === "lasso" ? "4 4" : "none"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.85"
                      />
                    </svg>
                  )}

                {/* Active Shape Dragging Preview */}
                {isDrawing && dragStart && dragCurrent && (
                  <div
                    className={`absolute pointer-events-none z-30 border-2 ${
                      maskMode === "erase"
                        ? "border-rose-400 bg-rose-500/20"
                        : maskMode === "shade"
                        ? "border-amber-400 bg-amber-500/20"
                        : "border-cyan-400 bg-cyan-500/20"
                    } backdrop-blur-[1px]`}
                    style={{
                      left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                      top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                      width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                      height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                      borderRadius: activeTool === "circle" ? "50%" : "8px",
                    }}
                  />
                )}

                {/* Existing Masks Visual Overlays */}
                {(settings.protectionMasks || []).map((m, idx) => (
                  <div
                    key={m.id}
                    className={`absolute pointer-events-none z-20 border-2 ${
                      m.mode === "erase"
                        ? "border-rose-400/80 bg-rose-500/20"
                        : m.mode === "shade"
                        ? "border-amber-400/80 bg-amber-500/20"
                        : "border-cyan-400/80 bg-cyan-500/20"
                    } rounded-xl flex items-center justify-center shadow-lg`}
                    style={{
                      left: `${(m.x - (m.width || 0.08) / 2) * 100}%`,
                      top: `${(m.y - (m.height || 0.08) / 2) * 100}%`,
                      width: `${(m.width || 0.08) * 100}%`,
                      height: `${(m.height || 0.08) * 100}%`,
                      borderRadius: m.type === "circle" ? "50%" : "8px",
                    }}
                  >
                    <span className="text-[9px] font-black text-white bg-slate-950/80 px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                      {m.mode === "erase" ? "✂️" : m.mode === "shade" ? "🎨" : "🛡️"} {idx + 1}
                    </span>
                  </div>
                ))}

                {/* Eyedropper Magnifying Loupe Overlay */}
                {cursorPos && activeTool === "pipette" && (
                  <div
                    className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full -mt-3 flex flex-col items-center"
                    style={{ left: cursorPos.x, top: cursorPos.y }}
                  >
                    <div className="relative w-24 h-24 rounded-full border-2 border-white shadow-2xl overflow-hidden bg-slate-950/90 ring-4 ring-black/40">
                      <canvas
                        ref={loupeCanvasRef}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-1 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-white/20 text-white font-mono text-[10px] font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-sm">
                      <span
                        className="w-3 h-3 rounded-full border border-white/40 shadow-inner"
                        style={{ backgroundColor: hoverColor.hex }}
                      />
                      {hoverColor.hex.toUpperCase()}
                    </div>
                  </div>
                )}

                {/* Top Overlay Badge for Mode */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-[10px] font-black text-slate-300 border border-white/10">
                    {previewMode === "transparent" && "معاينة الشفافية المفرغة 🏁"}
                    {previewMode === "original" && "الفيديو الأصلي 🎬"}
                    {previewMode === "mask" && "قناع العزل الأبيض والأسود ⚪⚫"}
                    {previewMode === "protect" && "معاينة التظليل والمناطق المحددة 🛡️"}
                  </span>
                </div>

                {/* Instruction overlay */}
                {!cursorPos && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-cyan-400 text-xs font-bold border border-cyan-500/30 flex items-center gap-2 shadow-lg">
                    {activeTool === "pipette" ? (
                      <>
                        <Pipette className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                        انقر بالقطارة لتحديد لون الخلفية المراد تفريغها
                      </>
                    ) : (
                      <>
                        <Brush className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                        ارسم بالقلم أو حدد المنطقة لتطبيق تفريغ الشفافية أو التظليل
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Video Scrubber & Playback Controls */}
              <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        setIsPlaying(false);
                        videoRef.current?.pause();
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all cursor-pointer shadow-md active:scale-95"
                    title={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      const video = videoRef.current;
                      if (video) {
                        const target = Math.max(0, video.currentTime - 0.05);
                        video.currentTime = target;
                        setCurrentTime(target);
                        renderCurrentFrame(target);
                      }
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="إطار للخلف"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    -1 إطار
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      const video = videoRef.current;
                      if (video) {
                        const target = Math.min(
                          video.duration || 1,
                          video.currentTime + 0.05
                        );
                        video.currentTime = target;
                        setCurrentTime(target);
                        renderCurrentFrame(target);
                      }
                    }}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="إطار للأمام"
                  >
                    +1 إطار
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Native EyeDropper Button */}
                  {"EyeDropper" in window && activeTool === "pipette" && (
                    <button
                      onClick={handleNativeEyeDropper}
                      className="mr-auto px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      title="سحب لون من أي مكان على الشاشة"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      قطارة الشاشة
                    </button>
                  )}
                </div>

                {/* Timeline slider */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[10px] font-mono text-slate-400 w-12 text-left">
                    {currentTime.toFixed(2)}s
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => {
                      setIsPlaying(false);
                      const val = parseFloat(e.target.value);
                      setCurrentTime(val);
                      renderCurrentFrame(val);
                    }}
                    className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400 w-12 text-right">
                    {(duration || 0).toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Preview Modes Switcher */}
              <div className="grid grid-cols-4 gap-2 bg-slate-950/40 p-1.5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setPreviewMode("transparent")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    previewMode === "transparent"
                      ? "bg-emerald-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  الشفافية
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("original")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    previewMode === "original"
                      ? "bg-emerald-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  الأصلي
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("mask")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    previewMode === "mask"
                      ? "bg-emerald-500 text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  القناع
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("protect")}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    previewMode === "protect"
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-cyan-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  المناطق المحددة
                </button>
              </div>
            </div>

            {/* Right: Masks Manager & Chroma Controls (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Active Transparency & Protection Masks Manager */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 border border-cyan-500/30 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-cyan-400" />
                    أقنعة وتظليلات الشفافية ({(settings.protectionMasks || []).length})
                  </span>
                  <div className="flex items-center gap-2">
                    {(settings.protectionMasks || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettings((prev) => ({ ...prev, protectionMasks: [] }));
                          showToast("تم مسح جميع الأقنعة");
                        }}
                        className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 cursor-pointer"
                      >
                        مسح الكل
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                      Smart Alpha Pen
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  حدد أو ارسم بالقلم على أي منطقة لتفريغها فوراً كشفافية (Cutout)، أو تظليلها وتدريجها (Shading)، أو حمايتها من إزالة الكروما.
                </p>

                {/* List of active masks */}
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
                  {(settings.protectionMasks || []).length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-white/10 rounded-xl text-slate-500 text-xs">
                      لم يتم إضافة أقنعة بعد. اختر القلم الحر أو حبل التحديد أعلاه وارسم على الفيديو لتفريغ الشفافية أو تظليلها.
                    </div>
                  ) : (
                    (settings.protectionMasks || []).map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-cyan-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              m.mode === "erase"
                                ? "bg-rose-500/20 text-rose-400"
                                : m.mode === "shade"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-cyan-500/20 text-cyan-400"
                            }`}
                          >
                            {m.mode === "erase" ? "✂️" : m.mode === "shade" ? "🎨" : "🛡️"}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {m.label}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>
                                {m.mode === "erase"
                                  ? "تفريغ شفافية"
                                  : m.mode === "shade"
                                  ? `تظليل (${Math.round((m.opacity || 0.5) * 100)}%)`
                                  : "حماية وتثبيت"}
                              </span>
                              {m.motionTracking && (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <Activity className="w-2.5 h-2.5" /> تتبع الحركة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleMaskTracking(m.id)}
                            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              m.motionTracking
                                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                            }`}
                            title={
                              m.motionTracking
                                ? "إيقاف تتبع الحركة"
                                : "تفعيل تتبع الحركة التلقائي"
                            }
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMask(m.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-colors cursor-pointer"
                            title="حذف القناع"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Color Card */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Palette className="w-4 h-4 text-emerald-400" />
                    درجة لون الكروما المستهدفة بالعزل
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    {settings.color.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <input
                      type="color"
                      value={settings.color}
                      onChange={(e) => {
                        const hex = e.target.value;
                        const rgb = hexToRgb(hex);
                        setSettings((prev) => ({
                          ...prev,
                          color: hex,
                          r: rgb.r,
                          g: rgb.g,
                          b: rgb.b,
                        }));
                      }}
                      className="w-12 h-12 rounded-2xl cursor-pointer bg-transparent border-0 appearance-none p-0 overflow-hidden"
                    />
                    <div
                      className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-white/30 shadow-inner group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: settings.color }}
                    />
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={settings.color.toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          const rgb = hexToRgb(val);
                          setSettings((prev) => ({
                            ...prev,
                            color: val,
                            r: rgb.r,
                            g: rgb.g,
                            b: rgb.b,
                          }));
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs font-bold uppercase focus:border-emerald-500 outline-none"
                      placeholder="#00FF00"
                    />
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      RGB({settings.r}, {settings.g}, {settings.b})
                    </div>
                  </div>
                </div>
              </div>

              {/* Sliders for Tolerance & Smoothness */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4">
                {/* Tolerance Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      الحساسية وعمق اللون (Tolerance)
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {settings.tolerance}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={settings.tolerance}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        tolerance: parseInt(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Smoothness / Softness Slider */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-emerald-400" />
                      نعومة وتدرج الحواف (Smoothness)
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {settings.smoothness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={settings.smoothness}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        smoothness: parseInt(e.target.value),
                      }))
                    }
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Despill Toggle */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal-400" />
                    <div>
                      <div className="text-white text-xs font-bold">
                        تنظيف هالة وانعكاس اللون (Despill)
                      </div>
                      <div className="text-[9px] text-slate-400">
                        إزالة الانعكاس الأخضر/الأزرق من أطراف المجسم
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        despill: !prev.despill,
                      }))
                    }
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      settings.despill ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${
                        settings.despill ? "right-6" : "right-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Quick Preset Colors Palette */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
                <span className="text-slate-400 text-xs font-black uppercase tracking-wider">
                  درجات الألوان الجاهزة (Presets)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.hex + p.name}
                      type="button"
                      onClick={() => {
                        setSettings((prev) => ({
                          ...prev,
                          color: p.hex,
                          r: p.r,
                          g: p.g,
                          b: p.b,
                        }));
                        showToast(`تم اختيار: ${p.name}`);
                      }}
                      className={`p-2.5 rounded-xl border transition-all text-right flex items-center gap-2.5 cursor-pointer active:scale-95 ${
                        settings.color.toLowerCase() === p.hex.toLowerCase()
                          ? "bg-emerald-500/20 border-emerald-500/50 text-white"
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-md border border-white/30 flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: p.hex }}
                      />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold truncate">
                          {p.name}
                        </div>
                        <div className="text-[9px] text-slate-500">{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="px-6 py-4 border-t border-white/10 bg-slate-900/90 flex items-center justify-between gap-4 sticky bottom-0 z-20">
            <button
              type="button"
              onClick={() => {
                setSettings({
                  enabled: false,
                  color: "#00FF00",
                  r: 0,
                  g: 255,
                  b: 0,
                  tolerance: 30,
                  smoothness: 15,
                  despill: true,
                  protectionMasks: [],
                });
                showToast("تمت إعادة الضبط");
              }}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة ضبط
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={() => {
                  onApply({
                    ...settings,
                    enabled: true,
                  });
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 active:scale-95"
              >
                <Check className="w-4 h-4" />
                تطبيق الإعدادات وقناع الشفافية والتظليل
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
