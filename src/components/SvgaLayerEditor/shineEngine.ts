import { ShineEffectConfig } from './types';

/**
 * Interface for Shine Effect Options
 */
export interface ShineEffectOptions {
  enabled?: boolean;
  beamWidth?: number;          // عرض شريط اللمعة بالبكسل (افتراضي 50)
  angleDeg?: number;           // زاوية الحركة: 90 = من فوق لتحت رأسياً، 45 = مائل
  opacity?: number;            // أقصى سطوع للمعة (0.1 إلى 1.0)
  featherSides?: number;       // درجة تلاشي وبهتان الحواف يمين وشمال (0 إلى 1)
  featherTopBottom?: number;   // درجة تلاشي وبهتان الحواف أعلى وأسفل (0 إلى 1)
  maskToAlpha?: boolean;       // قصر اللمعة على حدود الصورة فقط وحجب الفراغ الشفاف
  color?: string;              // لون اللمعة (افتراضياً أبيض 255, 255, 255)
  keyframeStart?: number;      // نقطة بداية حركة اللمعة (0.0 إلى 1.0)
  keyframeEnd?: number;        // نقطة نهاية حركة اللمعة (0.0 إلى 1.0)
  durationSeconds?: number;    // مدة اللمعة بالثواني
}

/**
 * دالة تحريك لمعة الطبقة البيضاء بحواف باهتة رباعية الاتجاه ونقاط بداية ونهاية (Keyframes)
 * 
 * @param ctx - سياق الرسم الخاص بالكانفاس (CanvasRenderingContext2D)
 * @param width - عرض الطبقة أو الكانفاس
 * @param height - ارتفاع الطبقة أو الكانفاس
 * @param progress - نسبة تقدم الأنيميشن (من 0.0 إلى 1.0) المحسوبة بين نقطة البداية والنهاية
 * @param options - خيارات الحركة وتلاشي الحواف والكي فريم
 */
export function drawAnimatedShine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  options: ShineEffectOptions = {}
) {
  if (width <= 0 || height <= 0) return;

  const {
    beamWidth = 50,
    angleDeg = 90,
    opacity = 0.85,
    featherSides = 0.85,
    featherTopBottom = 0.7,
    maskToAlpha = true,
    color = "255, 255, 255"
  } = options;

  const rad = (angleDeg * Math.PI) / 180;
  const diagonal = Math.hypot(width, height);
  const travelDistance = diagonal + beamWidth * 3;
  const currentOffset = -beamWidth * 1.5 + progress * travelDistance;

  // 1. إنشاء كانفاس مساعد مدمج لإنشاء التلاشي الناعم للحواف
  const offCanvas = document.createElement("canvas");
  const offW = Math.max(1, Math.ceil(beamWidth * 3));
  const offH = Math.max(1, Math.ceil(diagonal * 1.5));
  offCanvas.width = offW;
  offCanvas.height = offH;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) return;

  // 2. تدرج أفقي لتنعيم وبهتان أطراف اليمين واليسار (Horizontal Feathering)
  const hGrad = offCtx.createLinearGradient(0, 0, offW, 0);
  const mid = offW / 2;
  const halfBeam = (beamWidth / 2) * Math.max(0.01, featherSides);

  hGrad.addColorStop(0, `rgba(${color}, 0)`);
  hGrad.addColorStop(Math.max(0, (mid - halfBeam) / offW), `rgba(${color}, 0)`);
  hGrad.addColorStop(0.5, `rgba(${color}, ${opacity})`);
  hGrad.addColorStop(Math.min(1, (mid + halfBeam) / offW), `rgba(${color}, 0)`);
  hGrad.addColorStop(1, `rgba(${color}, 0)`);

  offCtx.fillStyle = hGrad;
  offCtx.fillRect(0, 0, offW, offH);

  // 3. تدرج رأسي لتنعيم وبهتان أطراف الأعلى والأسفل (Vertical Feathering)
  if (featherTopBottom > 0) {
    offCtx.save();
    offCtx.globalCompositeOperation = "destination-in";

    const vGrad = offCtx.createLinearGradient(0, 0, 0, offH);
    const fadeLen = offH * (featherTopBottom * 0.45);

    vGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    vGrad.addColorStop(fadeLen / offH, "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(1 - fadeLen / offH, "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    offCtx.fillStyle = vGrad;
    offCtx.fillRect(0, 0, offW, offH);
    offCtx.restore();
  }

  // 4. تطبيق اللمعة على الكانفاس الرئيسي مع قصرها على حدود الصورة (Alpha Masking)
  ctx.save();
  if (maskToAlpha) {
    ctx.globalCompositeOperation = "source-atop"; // يحافظ على شفافية الكائن الأصلي
  }

  // التدوير ونقل اللمعة على مسار السحب من فوق لتحت
  ctx.translate(width / 2, height / 2);
  ctx.rotate(rad - Math.PI / 2);
  ctx.drawImage(offCanvas, -offW / 2, -diagonal * 0.75 + currentOffset);
  ctx.restore();
}

/**
 * دالة إدارة حلقة التشغيل وتحديد نقاط بداية ونهاية الأنيميشن (Keyframes)
 */
export function startShineAnimation(
  canvas: HTMLCanvasElement,
  imageLayer: HTMLCanvasElement | HTMLImageElement,
  keyframeStart = 0.0, // نقطة بداية الحركة (مثلاً 0% أو 10%)
  keyframeEnd = 1.0,   // نقطة نهاية الحركة (مثلاً 100% أو 90%)
  durationSeconds = 2.0, // مدة اللمعة بالثواني
  options: ShineEffectOptions = {}
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let startTime = performance.now();
  let animId: number;

  function loop(now: number) {
    const elapsed = (now - startTime) / 1000;
    const cycle = elapsed % (durationSeconds + 0.8); // 0.8 ثانية استراحة بين الدورات

    // مسح وإعادة رسم الطبقة الأصلية الثابتة
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageLayer, 0, 0, canvas.width, canvas.height);

    if (cycle <= durationSeconds) {
      // حساب التقدم بين نقطة البداية ونقطة النهاية (Keyframes Interpolation)
      const normalizedTime = cycle / durationSeconds;
      const progress = keyframeStart + normalizedTime * (keyframeEnd - keyframeStart);

      // استدعاء دالة رسم اللمعة
      drawAnimatedShine(ctx, canvas.width, canvas.height, progress, {
        angleDeg: 90,           // 90 تعني سحب رأسي من فوق لتحت
        featherSides: 0.85,     // تخفيف الحواف يمين ويسار
        featherTopBottom: 0.7,  // تخفيف الحواف فوق وتحت
        opacity: 0.8,
        beamWidth: 60,
        maskToAlpha: true,
        ...options
      });
    }

    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);
  return () => {
    if (animId) cancelAnimationFrame(animId);
  };
}

/**
 * Helper to render layer shine during SVGA frame rendering or preview
 */
export function renderLayerShine(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentFrame: number,
  totalFrames: number,
  config?: ShineEffectConfig
) {
  if (!config || !config.enabled) return;

  const keyStart = config.keyframeStart ?? 0.0;
  const keyEnd = config.keyframeEnd ?? 1.0;
  
  const total = Math.max(1, totalFrames - 1);
  const normTime = (currentFrame % totalFrames) / total;

  // Keyframes Interpolation
  const progress = keyStart + normTime * (keyEnd - keyStart);

  drawAnimatedShine(ctx, width, height, progress, {
    beamWidth: config.beamWidth ?? 50,
    angleDeg: config.angleDeg ?? 90,
    opacity: config.opacity ?? 0.85,
    featherSides: config.featherSides ?? 0.85,
    featherTopBottom: config.featherTopBottom ?? 0.7,
    maskToAlpha: config.maskToAlpha ?? true,
    color: config.color ?? "255, 255, 255"
  });
}
