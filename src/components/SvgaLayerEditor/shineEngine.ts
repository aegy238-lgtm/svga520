import { ShineEffectConfig, ShineStyle, ShineDirection, ShineVectorPoint } from './types';

/**
 * Interface for Shine Effect Options
 */
export interface ShineEffectOptions {
  enabled?: boolean;
  beamWidth?: number;          // عرض شريط اللمعة بالبكسل
  angleDeg?: number;           // زاوية الحركة: 90 = رأسي من فوق لتحت، 45 = مائل
  opacity?: number;            // أقصى سطوع للمعة (0.1 إلى 1.0)
  featherSides?: number;       // درجة تلاشي وبهتان الحواف يمين وشمال (0 إلى 1)
  featherTopBottom?: number;   // درجة تلاشي وبهتان الحواف أعلى وأسفل (0 إلى 1)
  maskToAlpha?: boolean;       // قصر اللمعة على حدود الصورة فقط وحجب الفراغ الشفاف
  color?: string;              // لون اللمعة (RGB string "255, 255, 255" أو Hex "#ffffff")
  keyframeStart?: number;      // نقطة بداية حركة اللمعة (0.0 إلى 1.0)
  keyframeEnd?: number;        // نقطة نهاية حركة اللمعة (0.0 إلى 1.0)
  durationSeconds?: number;    // مدة اللمعة بالثواني
  repeatInterval?: number;     // فترة الاستراحة بين كل لمعة وأخرى بالثواني
  speedMultiplier?: number;    // مضاعف سرعة اللمعان (0.5x إلى 3.0x)
  style?: ShineStyle;          // 'soft' | 'double' | 'sharp' | 'glow'
  direction?: ShineDirection;  // 'forward' | 'reverse' | 'pingpong'
  localStartPoint?: ShineVectorPoint; // نقطة بداية المسار المحولة لمساحة الطبقة
  localEndPoint?: ShineVectorPoint;   // نقطة نهاية المسار المحولة لمساحة الطبقة
}

/**
 * Helper to parse any color format (RGB string, Hex, or rgba) into RGB values
 */
export function parseColorToRgb(colorStr: string = '255, 255, 255'): { r: number; g: number; b: number } {
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    if (!isNaN(num)) {
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    }
  } else if (trimmed.includes(',')) {
    const parts = trimmed.replace(/[rgba()]/gi, '').split(',').map(p => parseFloat(p.trim()));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return {
        r: Math.round(parts[0]),
        g: Math.round(parts[1]),
        b: Math.round(parts[2])
      };
    }
  }
  return { r: 255, g: 255, b: 255 };
}

/**
 * دالة تحريك لمعة الطبقة الاحترافية بدعم كامل لمسار المتجه (Vector Path)،
 * وأنماط اللمعان المتعددة (Soft, Double Ray, Sharp Slash, Glow Sheen)
 * واتجاهات الحركة وفترات التكرار المماثلة لـ After Effects CC Light Sweep
 */
export function drawAnimatedShine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rawProgress: number,
  options: ShineEffectOptions = {}
) {
  if (width <= 0 || height <= 0) return;
  if (rawProgress < 0 || rawProgress > 1) return;

  const {
    beamWidth = 60,
    angleDeg = 90,
    opacity = 0.85,
    featherSides = 0.85,
    featherTopBottom = 0.7,
    maskToAlpha = true,
    color = "255, 255, 255",
    style = 'soft',
    direction = 'forward',
    localStartPoint,
    localEndPoint
  } = options;

  // Calculate direction-adjusted progress
  let progress = rawProgress;
  if (direction === 'reverse') {
    progress = 1 - rawProgress;
  } else if (direction === 'pingpong') {
    progress = rawProgress < 0.5 ? rawProgress * 2 : (1 - rawProgress) * 2;
  }

  // Parse color
  const rgb = parseColorToRgb(color);
  const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

  // Diagonal & Dimension calculations
  const diagonal = Math.hypot(width, height);

  // Position & Angle from Vector Path (if provided) or from AngleDeg
  let centerX = width / 2;
  let centerY = height / 2;
  let beamAngleRad = (angleDeg * Math.PI) / 180;

  if (localStartPoint && localEndPoint) {
    const dx = localEndPoint.x - localStartPoint.x;
    const dy = localEndPoint.y - localStartPoint.y;
    const pathLen = Math.hypot(dx, dy);

    if (pathLen > 1) {
      // Path trajectory angle
      const pathAngle = Math.atan2(dy, dx);
      // Beam line is perpendicular to travel direction
      beamAngleRad = pathAngle + Math.PI / 2;

      // Current center point along the path
      centerX = localStartPoint.x + progress * dx;
      centerY = localStartPoint.y + progress * dy;
    } else {
      centerX = localStartPoint.x;
      centerY = localStartPoint.y;
    }
  } else {
    // Default angle-based trajectory across layer bounding box
    const travelDistance = diagonal + beamWidth * 3;
    const currentOffset = -beamWidth * 1.5 + progress * travelDistance;

    const rad = (angleDeg * Math.PI) / 180;
    // Offset along the travel angle
    centerX = width / 2 + Math.cos(rad) * (currentOffset - diagonal * 0.5);
    centerY = height / 2 + Math.sin(rad) * (currentOffset - diagonal * 0.5);
    beamAngleRad = rad + Math.PI / 2;
  }

  // 1. إنشاء كانفاس مساعد مدمج لإنشاء شريط اللمعة حسب النمط المختار
  const effBeamWidth = style === 'glow' ? Math.ceil(beamWidth * 1.6) : beamWidth;
  const offW = Math.max(10, Math.ceil(effBeamWidth * 3));
  const offH = Math.max(10, Math.ceil(diagonal * 2));

  const offCanvas = document.createElement("canvas");
  offCanvas.width = offW;
  offCanvas.height = offH;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) return;

  const mid = offW / 2;
  const hGrad = offCtx.createLinearGradient(0, 0, offW, 0);

  // Apply chosen shine style profile
  if (style === 'double') {
    // Double Ray (After Effects CC Light Sweep style: sharp core ray + wider secondary gleam)
    const coreW = (effBeamWidth * 0.25) * Math.max(0.1, featherSides);
    const wideW = (effBeamWidth * 0.75) * Math.max(0.1, featherSides);

    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - wideW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - wideW * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.3})`);
    hGrad.addColorStop(Math.max(0, (mid - coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.5})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.5})`);
    hGrad.addColorStop(Math.min(1, (mid + wideW * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.3})`);
    hGrad.addColorStop(Math.min(1, (mid + wideW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else if (style === 'sharp') {
    // Sharp Slash / Crystal: Razor-sharp beam with intense brilliance and tight falloff
    const sharpW = (effBeamWidth * 0.35) * Math.max(0.05, featherSides);

    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - sharpW * 1.5) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - sharpW) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + sharpW) / offW), `rgba(${rgbStr}, ${opacity * 0.6})`);
    hGrad.addColorStop(Math.min(1, (mid + sharpW * 1.5) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else if (style === 'glow') {
    // Glow Sheen: Wide, soft atmospheric diffusion
    const glowW = (effBeamWidth * 0.9) * Math.max(0.1, featherSides);

    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - glowW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity * 0.85})`);
    hGrad.addColorStop(Math.min(1, (mid + glowW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else if (style === 'star') {
    // Starburst Flare: Intense core glare with radial stellar shimmer
    const coreW = (effBeamWidth * 0.2) * Math.max(0.05, featherSides);
    const flareW = (effBeamWidth * 0.6) * Math.max(0.1, featherSides);

    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - flareW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - flareW * 0.4) / offW), `rgba(${rgbStr}, ${opacity * 0.4})`);
    hGrad.addColorStop(Math.max(0, (mid - coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.8})`);
    hGrad.addColorStop(0.5, `rgba(255, 255, 255, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + coreW) / offW), `rgba(${rgbStr}, ${opacity * 0.8})`);
    hGrad.addColorStop(Math.min(1, (mid + flareW * 0.4) / offW), `rgba(${rgbStr}, ${opacity * 0.4})`);
    hGrad.addColorStop(Math.min(1, (mid + flareW) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  } else {
    // 'soft' - Smooth bell curve gradient (default)
    const halfBeam = (effBeamWidth / 2) * Math.max(0.05, featherSides);

    hGrad.addColorStop(0, `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - halfBeam * 1.2) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(Math.max(0, (mid - halfBeam * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.45})`);
    hGrad.addColorStop(0.5, `rgba(${rgbStr}, ${opacity})`);
    hGrad.addColorStop(Math.min(1, (mid + halfBeam * 0.5) / offW), `rgba(${rgbStr}, ${opacity * 0.45})`);
    hGrad.addColorStop(Math.min(1, (mid + halfBeam * 1.2) / offW), `rgba(${rgbStr}, 0)`);
    hGrad.addColorStop(1, `rgba(${rgbStr}, 0)`);
  }

  offCtx.fillStyle = hGrad;
  offCtx.fillRect(0, 0, offW, offH);

  // 2. تدرج رأسي لتنعيم وبهتان أطراف الأعلى والأسفل (Vertical Feathering)
  if (featherTopBottom > 0) {
    offCtx.save();
    offCtx.globalCompositeOperation = "destination-in";

    const vGrad = offCtx.createLinearGradient(0, 0, 0, offH);
    const fadeLen = offH * (featherTopBottom * 0.45);

    vGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    vGrad.addColorStop(Math.max(0.01, fadeLen / offH), "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(Math.min(0.99, 1 - fadeLen / offH), "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    offCtx.fillStyle = vGrad;
    offCtx.fillRect(0, 0, offW, offH);
    offCtx.restore();
  }

  // 3. تطبيق اللمعة على الكانفاس الرئيسي مع قصرها على حدود الصورة (Alpha Masking)
  ctx.save();
  if (maskToAlpha) {
    ctx.globalCompositeOperation = "source-atop"; // يحافظ على شفافية الكائن الأصلي
  }

  // نقل الكانفاس لمركز الشعاع والتدوير
  ctx.translate(centerX, centerY);
  ctx.rotate(beamAngleRad);
  ctx.drawImage(offCanvas, -offW / 2, -offH / 2);
  ctx.restore();
}

/**
 * Helper to invert a 2D affine transform matrix:
 * [a, b, c, d, tx, ty]
 * maps (X, Y) -> (x, y) in local layer space
 */
export function invertTransformPoint(
  px: number,
  py: number,
  matrix?: [number, number, number, number, number, number] | null
): ShineVectorPoint {
  if (!matrix) return { x: px, y: py };

  const [a, b, c, d, tx, ty] = matrix;
  const det = a * d - b * c;

  if (Math.abs(det) < 1e-6) {
    return { x: px - tx, y: py - ty };
  }

  const invX = (d * (px - tx) - c * (py - ty)) / det;
  const invY = (-b * (px - tx) + a * (py - ty)) / det;
  return { x: invX, y: invY };
}

/**
 * Helper to calculate normalized shine progress across animation timeline
 * Used by both live preview and export engine for 100% mathematical identity
 */
export function calculateShineProgress(
  currentFrame: number,
  totalFrames: number,
  fps: number = 30,
  config?: ShineEffectConfig
): { isActive: boolean; progress: number } {
  if (!config || !config.enabled) return { isActive: false, progress: 0 };
  if (totalFrames <= 0) return { isActive: false, progress: 0 };

  const keyStart = config.keyframeStart ?? 0.0;
  const keyEnd = config.keyframeEnd ?? 1.0;
  const repeatInterval = config.repeatInterval ?? 0.5; // pause between sweeps in seconds
  const speedMultiplier = config.speedMultiplier ?? 1.0;
  const durationSec = (config.durationSeconds ?? 2.0) / Math.max(0.1, speedMultiplier);

  let progress = 0;
  let isActive = true;

  if (repeatInterval > 0) {
    // Periodic sweep with calm pause interval
    const cyclePeriodSec = durationSec + repeatInterval;
    const currentSec = currentFrame / Math.max(1, fps);
    const cycleTimeSec = currentSec % cyclePeriodSec;

    if (cycleTimeSec > durationSec) {
      // In pause interval between sweeps
      isActive = false;
    } else {
      const sweepNorm = cycleTimeSec / durationSec;
      progress = keyStart + sweepNorm * (keyEnd - keyStart);
    }
  } else {
    // Continuous loop synchronized with timeline keyframe range
    const total = Math.max(1, totalFrames - 1);
    const normTime = (currentFrame % totalFrames) / total;

    if (normTime < keyStart || normTime > keyEnd) {
      isActive = false;
    } else {
      const range = Math.max(0.001, keyEnd - keyStart);
      progress = (normTime - keyStart) / range;
    }
  }

  if (progress < 0 || progress > 1) {
    isActive = false;
  }

  return { isActive, progress };
}

/**
 * Helper to render layer shine during SVGA frame rendering, preview, and export
 */
export function renderLayerShine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentFrame: number,
  totalFrames: number,
  config?: ShineEffectConfig,
  projectWidth?: number,
  projectHeight?: number,
  layerMatrix?: [number, number, number, number, number, number] | null,
  fps: number = 30
) {
  if (!config || !config.enabled) return;
  if (width <= 0 || height <= 0 || totalFrames <= 0) return;

  const { isActive, progress } = calculateShineProgress(currentFrame, totalFrames, fps, config);
  if (!isActive) return;

  // Convert Project Canvas Vector Points to Layer Local Space
  let localStart: ShineVectorPoint | undefined;
  let localEnd: ShineVectorPoint | undefined;

  if (config.startPoint && config.endPoint) {
    if (layerMatrix) {
      localStart = invertTransformPoint(config.startPoint.x, config.startPoint.y, layerMatrix);
      localEnd = invertTransformPoint(config.endPoint.x, config.endPoint.y, layerMatrix);
    } else {
      // Fallback: proportional scaling if layer bounds differ from project bounds
      const sx = projectWidth && projectWidth > 0 ? width / projectWidth : 1;
      const sy = projectHeight && projectHeight > 0 ? height / projectHeight : 1;
      localStart = { x: config.startPoint.x * sx, y: config.startPoint.y * sy };
      localEnd = { x: config.endPoint.x * sx, y: config.endPoint.y * sy };
    }
  }

  drawAnimatedShine(ctx, width, height, progress, {
    beamWidth: config.beamWidth ?? 60,
    angleDeg: config.angleDeg ?? 90,
    opacity: config.opacity ?? 0.85,
    featherSides: config.featherSides ?? 0.85,
    featherTopBottom: config.featherTopBottom ?? 0.7,
    maskToAlpha: config.maskToAlpha ?? true,
    color: config.color ?? "255, 255, 255",
    style: config.style ?? 'soft',
    direction: config.direction ?? 'forward',
    localStartPoint: localStart,
    localEndPoint: localEnd
  });
}
