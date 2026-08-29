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
} from "lucide-react";

// Protection Mask Object definition
export interface ProtectionMask {
  id: string;
  type: "brush" | "circle" | "rect";
  // For shape types (normalized 0 to 1 for responsive coordinates)
  x: number; // center x (0..1)
  y: number; // center y (0..1)
  radiusX?: number; // 0..1
  radiusY?: number; // 0..1
  width?: number; // 0..1
  height?: number; // 0..1
  // For freehand brush paths (list of normalized points {x, y})
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
  // Protection Masks (prevent alpha transparency from cutting these protected regions)
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

  // Studio Active Tool Mode: 'pipette' | 'brush' | 'circle' | 'rect'
  const [activeTool, setActiveTool] = useState<
    "pipette" | "brush" | "circle" | "rect"
  >("pipette");
  const [brushSize, setBrushSize] = useState<number>(24);
  const [brushFeather, setBrushFeather] = useState<number>(10);
  const [enableMotionTracking, setEnableMotionTracking] =
    useState<boolean>(true);

  // Eyedropper Loupe state
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );
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

  // Drawing state for Protection Mask
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragCurrent, setDragCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
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

  // Optical Flow / Motion Tracking Update for Protection Masks during playback
  const updateMotionTracking = useCallback(
    (
      currentTCtx: CanvasRenderingContext2D,
      vw: number,
      vh: number,
      dt: number,
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

      // Small sample block matching around each mask center
      const currentData = currentTCtx.getImageData(0, 0, vw, vh).data;
      const prevData = prevCtx.getImageData(0, 0, vw, vh).data;

      let changed = false;
      const updatedMasks = masks.map((mask) => {
        if (!mask.motionTracking) return mask;

        // Mask center in pixel coords
        const cx = Math.floor(mask.x * vw);
        const cy = Math.floor(mask.y * vh);

        // Window size for motion search
        const win = 14;
        const searchRange = 10;

        let bestDx = 0;
        let bestDy = 0;
        let minDiff = Infinity;

        for (let dy = -searchRange; dy <= searchRange; dy += 2) {
          for (let dx = -searchRange; dx <= searchRange; dx += 2) {
            let diff = 0;
            let count = 0;

            for (let sy = -win; sy <= win; sy += 4) {
              const prevY = cy + sy;
              const currY = cy + sy + dy;
              if (
                prevY < 0 ||
                prevY >= vh ||
                currY < 0 ||
                currY >= vh
              )
                continue;

              for (let sx = -win; sx <= win; sx += 4) {
                const prevX = cx + sx;
                const currX = cx + sx + dx;
                if (
                  prevX < 0 ||
                  prevX >= vw ||
                  currX < 0 ||
                  currX >= vw
                )
                  continue;

                const pIdx = (prevY * vw + prevX) * 4;
                const cIdx = (currY * vw + currX) * 4;

                const dr = Math.abs(currentData[cIdx] - prevData[pIdx]);
                const dg = Math.abs(currentData[cIdx + 1] - prevData[pIdx + 1]);
                const db = Math.abs(currentData[cIdx + 2] - prevData[pIdx + 2]);
                diff += dr + dg + db;
                count++;
              }
            }

            if (count > 0 && diff < minDiff) {
              minDiff = diff;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        // Apply smooth motion displacement
        if (Math.abs(bestDx) > 0.5 || Math.abs(bestDy) > 0.5) {
          changed = true;
          const shiftX = (bestDx * 0.4) / vw;
          const shiftY = (bestDy * 0.4) / vh;
          const newX = Math.max(0.01, Math.min(0.99, mask.x + shiftX));
          const newY = Math.max(0.01, Math.min(0.99, mask.y + shiftY));

          // Also shift points if brush type
          let newPoints = mask.points;
          if (mask.points && mask.points.length > 0) {
            newPoints = mask.points.map((p) => ({
              x: Math.max(0.01, Math.min(0.99, p.x + shiftX)),
              y: Math.max(0.01, Math.min(0.99, p.y + shiftY)),
            }));
          }

          return {
            ...mask,
            x: newX,
            y: newY,
            points: newPoints,
          };
        }

        return mask;
      });

      if (changed) {
        setSettings((prev) => ({
          ...prev,
          protectionMasks: updatedMasks,
        }));
      }

      prevCtx.drawImage(currentTCtx.canvas, 0, 0, vw, vh);
    },
    [settings.protectionMasks],
  );

  // Helper: check if a pixel is inside any protection mask and return protection strength 0..1
  const getProtectionFactor = useCallback(
    (
      px: number,
      py: number,
      vw: number,
      vh: number,
      masks: ProtectionMask[],
    ): number => {
      if (!masks || masks.length === 0) return 0;

      const normX = px / vw;
      const normY = py / vh;

      let maxProtection = 0;

      for (const m of masks) {
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
            maxProtection = 1;
            break;
          } else if (m.feather > 0 && dist <= r + m.feather) {
            const f = 1 - (dist - r) / m.feather;
            if (f > maxProtection) maxProtection = f;
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
            maxProtection = 1;
            break;
          } else if (m.feather > 0) {
            // Check distance to bounding box
            const dx = Math.max(left - px, 0, px - right);
            const dy = Math.max(top - py, 0, py - bottom);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= m.feather) {
              const f = 1 - dist / m.feather;
              if (f > maxProtection) maxProtection = f;
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
              maxProtection = 1;
              break;
            } else if (m.feather > 0 && dist <= bRadius + m.feather) {
              const f = 1 - (dist - bRadius) / m.feather;
              if (f > maxProtection) maxProtection = f;
            }
          }
          if (maxProtection >= 1) break;
        }
      }

      return maxProtection;
    },
    [],
  );

  // Render Frame with Chroma Filter & Protection Masks
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

      // Apply Chroma Keying + Protection Masks
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

        // Check if current pixel is inside a protected region
        const protectFactor = getProtectionFactor(px, py, vw, vh, masks);

        let minFactor = 1.0;

        for (const target of targetList) {
          // Perceptual distance calculation
          const dr = r - target.r;
          const dg = g - target.g;
          const db = b - target.b;
          const dist = Math.sqrt(
            0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db,
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

        // Apply Protection: Blend alpha back towards 1.0 (original opacity) based on protectFactor
        if (protectFactor > 0) {
          minFactor = minFactor + (1.0 - minFactor) * protectFactor;
        }

        // Apply despill to remove green/blue reflection on foreground (skip if strongly protected)
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
          // Display white for foreground, black for transparent
          data[i] = finalAlpha;
          data[i + 1] = finalAlpha;
          data[i + 2] = finalAlpha;
          data[i + 3] = 255;
        } else if (previewMode === "protect") {
          // Highlight protected zones in vivid cyan/gold overlay
          if (protectFactor > 0) {
            data[i] = Math.round(r * 0.4 + 0 * 0.6);
            data[i + 1] = Math.round(g * 0.4 + 230 * 0.6);
            data[i + 2] = Math.round(b * 0.4 + 255 * 0.6);
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
      getProtectionFactor,
      isVapInput,
      previewMode,
      settings,
      updateMotionTracking,
    ],
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

  // Canvas Mouse Move -> Eyedropper Magnifier & Color Grab OR Protection Mask Painting
  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement | HTMLCanvasElement>,
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

              const sampleSize = 11; // 11x11 pixels zoomed
              const halfSample = Math.floor(sampleSize / 2);
              const sx = Math.max(
                0,
                Math.min(tempCanvas.width - sampleSize, pixelX - halfSample),
              );
              const sy = Math.max(
                0,
                Math.min(tempCanvas.height - sampleSize, pixelY - halfSample),
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
                90,
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

    // 2. Brush Mode: Add point to path while drawing
    if (isDrawing && activeTool === "brush") {
      const normPoint = { x: pixelX / canvas.width, y: pixelY / canvas.height };
      setCurrentPoints((prev) => [...prev, normPoint]);
    }

    // 3. Shape Dragging (Circle or Rect)
    if (isDrawing && (activeTool === "circle" || activeTool === "rect")) {
      setDragCurrent({ x: pixelX / canvas.width, y: pixelY / canvas.height });
    }
  };

  const handleCanvasMouseDown = (
    e: React.MouseEvent<HTMLDivElement | HTMLCanvasElement>,
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

    // Start Mask Drawing
    setIsDrawing(true);
    const norm = { x: pixelX / canvas.width, y: pixelY / canvas.height };

    if (activeTool === "brush") {
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
      // Create new Brush Protection Mask
      const avgX =
        currentPoints.reduce((acc, p) => acc + p.x, 0) / currentPoints.length;
      const avgY =
        currentPoints.reduce((acc, p) => acc + p.y, 0) / currentPoints.length;

      const newMask: ProtectionMask = {
        id: "mask_" + Date.now(),
        type: "brush",
        x: avgX,
        y: avgY,
        points: currentPoints,
        brushRadius: brushSize,
        feather: brushFeather,
        motionTracking: enableMotionTracking,
        label: `قناع حماية حر #${(settings.protectionMasks?.length || 0) + 1}`,
      };

      setSettings((prev) => ({
        ...prev,
        protectionMasks: [...(prev.protectionMasks || []), newMask],
      }));
      setCurrentPoints([]);
      showToast("تم رسم وحماية المنطقة بنجاح 🛡️");
    } else if (dragStart && dragCurrent) {
      // Shape Mask (Circle / Rect)
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
        x: cx,
        y: cy,
        width: w,
        height: h,
        radiusX: w / 2,
        radiusY: h / 2,
        feather: brushFeather,
        motionTracking: enableMotionTracking,
        label:
          activeTool === "circle"
            ? `منطقة دائرية محمية (عيون/وجه) #${(settings.protectionMasks?.length || 0) + 1}`
            : `منطقة مستطيلة محمية #${(settings.protectionMasks?.length || 0) + 1}`,
      };

      setSettings((prev) => ({
        ...prev,
        protectionMasks: [...(prev.protectionMasks || []), newMask],
      }));
      setDragStart(null);
      setDragCurrent(null);
      showToast("تمت حماية الجزء المحدد من القص 🛡️");
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
        // Cancelled by user
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
    showToast("تم حذف قناع الحماية");
  };

  const toggleMaskTracking = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      protectionMasks: (prev.protectionMasks || []).map((m) =>
        m.id === id ? { ...m, motionTracking: !m.motionTracking } : m,
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
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-black text-sm sm:text-base flex items-center gap-2">
                  استوديو الكروما الاحترافي وقلم حماية العناصر من القص
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Pro Protection Mask & Motion Tracking
                  </span>
                </h3>
                <p className="text-slate-400 text-xs">
                  اسحب لون الكروما بدقة، واستخدم قلم وفرشاة الحماية لمنع قص
                  العيون، الملابس أو أي تفاصيل داخل الفيديو
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
              {/* Studio Active Tools Bar (Pipette vs Protection Pen / Circle / Rect) */}
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-950/70 rounded-2xl border border-white/5">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTool("pipette")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTool === "pipette"
                        ? "bg-emerald-500 text-slate-950 shadow-md"
                        : "text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    <Pipette className="w-4 h-4" />
                    قطارة اللون
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool("brush");
                      setPreviewMode("protect");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTool === "brush"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                    title="فرشاة رسم حر لحماية وتثبيت أي جزء من الفيديو"
                  >
                    <Brush className="w-4 h-4" />
                    قلم الحماية (فرشاة)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool("circle");
                      setPreviewMode("protect");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTool === "circle"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                    title="حماية دائرية للعيون أو الوجه"
                  >
                    <Circle className="w-4 h-4" />
                    دائرة (عيون/وجه)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool("rect");
                      setPreviewMode("protect");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTool === "rect"
                        ? "bg-cyan-500 text-slate-950 shadow-md"
                        : "text-cyan-300 hover:bg-cyan-500/10"
                    }`}
                  >
                    <Square className="w-4 h-4" />
                    مستطيل
                  </button>
                </div>

                {/* Brush Settings if Brush is active */}
                {activeTool === "brush" && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      حجم الفرشاة: {brushSize}px
                    </span>
                    <input
                      type="range"
                      min="8"
                      max="80"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-16 h-1 bg-white/10 rounded accent-cyan-400"
                    />
                  </div>
                )}
              </div>

              {/* Canvas View Container */}
              <div
                className={`relative w-full aspect-video rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center select-none ${
                  previewMode === "transparent"
                    ? "bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)] bg-[size:20px_20px] bg-[#0f172a]"
                    : "bg-slate-950"
                } ${
                  activeTool === "pipette"
                    ? "cursor-crosshair"
                    : activeTool === "brush"
                      ? "cursor-cell"
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

                {/* Active Drawing Preview (Shapes or Brush line) */}
                {isDrawing && activeTool === "brush" && currentPoints.length > 1 && (
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
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth={brushSize}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.8"
                    />
                  </svg>
                )}

                {/* Active Shape Dragging Preview */}
                {isDrawing && dragStart && dragCurrent && (
                  <div
                    className="absolute pointer-events-none z-30 border-2 border-cyan-400 bg-cyan-500/20 backdrop-blur-[1px]"
                    style={{
                      left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
                      top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
                      width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
                      height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
                      borderRadius: activeTool === "circle" ? "50%" : "8px",
                    }}
                  />
                )}

                {/* Existing Protection Masks Visual Overlays */}
                {(settings.protectionMasks || []).map((m, idx) => (
                  <div
                    key={m.id}
                    className="absolute pointer-events-none z-20 border-2 border-cyan-400/80 bg-cyan-500/20 rounded-xl flex items-center justify-center shadow-lg"
                    style={{
                      left: `${(m.x - (m.width || 0.1) / 2) * 100}%`,
                      top: `${(m.y - (m.height || 0.1) / 2) * 100}%`,
                      width: `${(m.width || 0.1) * 100}%`,
                      height: `${(m.height || 0.1) * 100}%`,
                      borderRadius: m.type === "circle" ? "50%" : "8px",
                    }}
                  >
                    <span className="text-[9px] font-black text-white bg-slate-950/80 px-1.5 py-0.5 rounded shadow">
                      🛡️ {idx + 1}
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
                    {/* Color Tag Badge */}
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
                    {previewMode === "transparent" &&
                      "معاينة الشفافية المفرغة 🏁"}
                    {previewMode === "original" && "الفيديو الأصلي 🎬"}
                    {previewMode === "mask" && "قناع العزل الأبيض والأسود ⚪⚫"}
                    {previewMode === "protect" && "معاينة المناطق المحمية 🛡️"}
                  </span>
                </div>

                {/* Instruction overlay */}
                {!cursorPos && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-cyan-400 text-xs font-bold border border-cyan-500/30 flex items-center gap-2 shadow-lg">
                    {activeTool === "pipette" ? (
                      <>
                        <Pipette className="w-3.5 h-3.5 animate-bounce text-emerald-400" />
                        انقر بالقلم داخل الفيديو لتحديد لون الكروما المراد عزله
                      </>
                    ) : (
                      <>
                        <Brush className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                        ارسم أو حدد الجزء (العيون/الجسم) لمنع قص الشفافية منه
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
                          video.currentTime + 0.05,
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
                  المناطق المحمية
                </button>
              </div>
            </div>

            {/* Right: Protection Masks List & Chroma Controls (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Active Protection Masks Manager */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-950 border border-cyan-500/30 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    المناطق المحمية من القص ({(settings.protectionMasks || []).length})
                  </span>
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                    Smart Protection
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  أي جزء تحدده هنا (كالعيون، الوجه، أو الشعار) سيتم استثناؤه وحمايته تماماً من القص أو الشفافية مع خاصية التتبع الحركي مع حركة الشخصية.
                </p>

                {/* List of active masks */}
                <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
                  {(settings.protectionMasks || []).length === 0 ? (
                    <div className="text-center py-4 border border-dashed border-white/10 rounded-xl text-slate-500 text-xs">
                      لم يتم إضافة أقنعة حماية بعد. اضغط على قلم الحماية أو الدائرة أعلاه وحدد العين أو أي جزء تريده.
                    </div>
                  ) : (
                    (settings.protectionMasks || []).map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-cyan-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {m.label}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>نوع: {m.type === "circle" ? "دائري" : m.type === "brush" ? "فرشاة حرة" : "مستطيل"}</span>
                              {m.motionTracking && (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <Activity className="w-2.5 h-2.5" /> تتبع الحركة مفعل
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
                            title={m.motionTracking ? "إيقاف تتبع الحركة" : "تفعيل تتبع الحركة التلقائي"}
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
                    درجة اللون المستهدفة بالعزل
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
                تطبيق الإعدادات وحماية الأجزاء المحددة
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
