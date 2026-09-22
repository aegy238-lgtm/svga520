/**
 * Shine & Shimmer Animation Engine (محرك أنيميشن اللمعة والطبقة البيضاء)
 * 
 * الميزات:
 * 1. تحريك طبقة اللمعة البيضاء من أعلى لأسفل (Top to Bottom) أو بزاوية مائلة أو أفقية.
 * 2. حواف ناعمة بهتة (4-Way Feathered Soft Edges) من اليمين واليسار ومن الأعلى والأسفل.
 * 3. نقاط مفتاحية (Keyframes) للتحكم الدقيق في نقطة البداية ونقطة النهاية.
 * 4. قصر اللمعة على حدود الطبقة فقط (Alpha Masking / source-atop) لعدم تسريب اللمعة للفراغ الشفاف.
 * 5. دوال Easing وتكرار دوري سلس (Loop with Pause Delay).
 */

export type ShineDirection = 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'diagonal-down' | 'custom';
export type EasingType = 'linear' | 'ease-in-out' | 'ease-in' | 'ease-out';

export interface ShineConfig {
  /** زاوية الحركة أو شريط اللمعة بالدرجات (مثلاً 90 للتحرك رأسياً من فوق لتحت، أو 45 لحركة مائلة) */
  angleDeg: number;
  /** الاتجاه المضبوط مسبقاً */
  direction: ShineDirection;
  /** نقطة بداية الأنيميشن (Keyframe Start: 0.0 إلى 1.0) */
  startProgress: number;
  /** نقطة نهاية الأنيميشن (Keyframe End: 0.0 إلى 1.0) */
  endProgress: number;
  /** عرض شريط اللمعة الأساسي بالبكسل */
  beamWidth: number;
  /** درجة تلاشي وتنعيم الحواف الجانبية (يمين ويسار) من 0.0 إلى 1.0 */
  featherHorizontal: number;
  /** درجة تلاشي وتنعيم الحواف الطولية (أعلى وأسفل) من 0.0 إلى 1.0 */
  featherVertical: number;
  /** أقصى سطوع/شفافية للمعة البيضاء (0.0 إلى 1.0) */
  opacity: number;
  /** لون اللمعة (افتراضياً أبيض 255, 255, 255) */
  colorRgb: string;
  /** قصر اللمعة على البكسلات غير الشفافة فقط للطبقة (source-atop) */
  maskToAlpha: boolean;
  /** نوع منحنى الحركة (Easing) */
  easing: EasingType;
  /** مدة الدورة الكاملة بالثواني */
  durationSec: number;
  /** فترة التوقف بين كل لمعة وأخرى بالثواني */
  pauseSec: number;
  /** إضافة خط لمعة رفيع متوازي لتعزيز الانعكاس */
  secondaryBeam: boolean;
}

export const DEFAULT_SHINE_CONFIG: ShineConfig = {
  angleDeg: 90, // 90 deg = رأسي تماماً من فوق لتحت
  direction: 'top-to-bottom',
  startProgress: 0.0,
  endProgress: 1.0,
  beamWidth: 50,
  featherHorizontal: 0.85,
  featherVertical: 0.7,
  opacity: 0.8,
  colorRgb: '255, 255, 255',
  maskToAlpha: true,
  easing: 'ease-in-out',
  durationSec: 2.0,
  pauseSec: 0.8,
  secondaryBeam: true,
};

/**
 * دالة تطبيق الـ Easing على التقدم
 */
export function applyEasing(t: number, type: EasingType): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (type) {
    case 'ease-in':
      return clamped * clamped;
    case 'ease-out':
      return clamped * (2 - clamped);
    case 'ease-in-out':
      return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
    case 'linear':
    default:
      return clamped;
  }
}

/**
 * حساب التقدم الموضعي للأنيميشن مع مراعاة البداية والنهاية والتوقف
 */
export function calculateShineProgress(
  elapsedMs: number,
  config: ShineConfig
): { progress: number; isShining: boolean } {
  const durationMs = config.durationSec * 1000;
  const pauseMs = config.pauseSec * 1000;
  const totalCycleMs = durationMs + pauseMs;

  const cycleTime = elapsedMs % totalCycleMs;

  if (cycleTime > durationMs) {
    // فترة التوقف (الطبقة ثابتة بدون لمعة)
    return { progress: config.endProgress, isShining: false };
  }

  const rawNorm = cycleTime / durationMs;
  const eased = applyEasing(rawNorm, config.easing);

  // إعادة التعيين بين نقطة البداية والنهاية (Keyframes)
  const mappedProgress = config.startProgress + eased * (config.endProgress - config.startProgress);

  return {
    progress: Math.max(0, Math.min(1, mappedProgress)),
    isShining: true,
  };
}

// تخزين كاش لكائنات الكانفاس المؤقتة للأداء العالي
let cachedOffscreenCanvas: HTMLCanvasElement | null = null;

function getOffscreenCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!cachedOffscreenCanvas) {
    cachedOffscreenCanvas = document.createElement('canvas');
  }
  if (cachedOffscreenCanvas.width !== width || cachedOffscreenCanvas.height !== height) {
    cachedOffscreenCanvas.width = width;
    cachedOffscreenCanvas.height = height;
  }
  const ctx = cachedOffscreenCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  return { canvas: cachedOffscreenCanvas, ctx };
}

/**
 * الوظيفة البرمجية الأساسية: رسم أنيميشن اللمعة البيضاء بحواف بهتة رباعية الاتجاه
 * 
 * @param ctx سياق الرسم للكانفاس المستهدف
 * @param width عرض الكانفاس أو الطبقة
 * @param height ارتفاع الكانفاس أو الطبقة
 * @param progress قيمة التقدم الحالية من 0.0 إلى 1.0 (محسوبة بناءً على الكي فريمز)
 * @param config إعدادات اللمعة والحواف والاتجاه
 */
export function drawShineEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  config: Partial<ShineConfig> = {}
): void {
  const opts: ShineConfig = { ...DEFAULT_SHINE_CONFIG, ...config };

  // حساب زاوية الحركة وفقاً للاتجاه المختار
  let effectiveAngleDeg = opts.angleDeg;
  if (opts.direction === 'top-to-bottom') {
    effectiveAngleDeg = 90;
  } else if (opts.direction === 'bottom-to-top') {
    effectiveAngleDeg = 270;
  } else if (opts.direction === 'left-to-right') {
    effectiveAngleDeg = 0;
  } else if (opts.direction === 'diagonal-down') {
    effectiveAngleDeg = 45;
  }

  const rad = (effectiveAngleDeg * Math.PI) / 180;
  const diagonal = Math.sqrt(width * width + height * height);

  // حساب مسار السحب والانتقال (من خارج حدود الكانفاس قبل البداية إلى ما بعد النهاية)
  const travelDistance = diagonal + opts.beamWidth * 3;
  const startOffset = -opts.beamWidth * 1.5;
  const currentDistance = startOffset + progress * travelDistance;

  // إعداد الكانفاس المساعد لإنتاج الحواف البهتة الناعمة رباعية الأبعاد (X and Y Soft Feathering)
  const offWidth = Math.ceil(opts.beamWidth * 3);
  const offHeight = Math.ceil(diagonal * 1.5);
  const { canvas: offCanvas, ctx: offCtx } = getOffscreenCanvas(offWidth, offHeight);

  // 1. مسار التدرج الأفقي (تنعيم حواف اليمين والشمال - Horizontal Feathering)
  const hFeather = Math.max(0.01, Math.min(1.0, opts.featherHorizontal));
  const innerMid = offWidth / 2;
  const beamHalf = opts.beamWidth / 2;

  const hGradient = offCtx.createLinearGradient(0, 0, offWidth, 0);
  hGradient.addColorStop(0, `rgba(${opts.colorRgb}, 0)`);
  hGradient.addColorStop(Math.max(0, (innerMid - beamHalf * hFeather) / offWidth), `rgba(${opts.colorRgb}, 0)`);
  hGradient.addColorStop(0.5, `rgba(${opts.colorRgb}, ${opts.opacity})`);
  hGradient.addColorStop(Math.min(1, (innerMid + beamHalf * hFeather) / offWidth), `rgba(${opts.colorRgb}, 0)`);
  hGradient.addColorStop(1, `rgba(${opts.colorRgb}, 0)`);

  offCtx.fillStyle = hGradient;
  offCtx.fillRect(0, 0, offWidth, offHeight);

  // إضافة خط لمعة ثانوي رفيع موازي إن كان مفعلاً
  if (opts.secondaryBeam) {
    const secOffset = opts.beamWidth * 0.55;
    const secWidth = Math.max(2, opts.beamWidth * 0.15);
    const secGradient = offCtx.createLinearGradient(innerMid + secOffset - secWidth, 0, innerMid + secOffset + secWidth, 0);
    secGradient.addColorStop(0, `rgba(${opts.colorRgb}, 0)`);
    secGradient.addColorStop(0.5, `rgba(${opts.colorRgb}, ${opts.opacity * 0.45})`);
    secGradient.addColorStop(1, `rgba(${opts.colorRgb}, 0)`);

    offCtx.fillStyle = secGradient;
    offCtx.fillRect(innerMid + secOffset - secWidth, 0, secWidth * 2, offHeight);
  }

  // 2. مسار التدرج الرأسي (تنعيم وتلاشي الحواف من فوق ومن تحت - Vertical Feathering)
  if (opts.featherVertical > 0) {
    offCtx.save();
    offCtx.globalCompositeOperation = 'destination-in';

    const vFeather = Math.max(0.05, Math.min(1.0, opts.featherVertical));
    const fadeLen = offHeight * (vFeather * 0.5);

    const vGradient = offCtx.createLinearGradient(0, 0, 0, offHeight);
    vGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vGradient.addColorStop(Math.min(0.49, fadeLen / offHeight), 'rgba(0, 0, 0, 1)');
    vGradient.addColorStop(Math.max(0.51, 1 - fadeLen / offHeight), 'rgba(0, 0, 0, 1)');
    vGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    offCtx.fillStyle = vGradient;
    offCtx.fillRect(0, 0, offWidth, offHeight);
    offCtx.restore();
  }

  // 3. رسم طبقة اللمعة على الكانفاس الرئيسي مع القناع الذكي للطبقة
  ctx.save();

  // إذا تم تفعيل قصر اللمعة على محتوى الصورة فقط (عدم تغطية الفراغ الشفاف)
  if (opts.maskToAlpha) {
    ctx.globalCompositeOperation = 'source-atop';
  }

  // التحريك بزاوية وتحديد موضع الشعاع وفق مسار الحركة
  const cx = width / 2;
  const cy = height / 2;

  ctx.translate(cx, cy);
  ctx.rotate(rad - Math.PI / 2); // محاذاة محور الحركة عمودياً/مائلاً

  const drawX = -offWidth / 2;
  const drawY = -diagonal * 0.75 + currentDistance;

  ctx.drawImage(offCanvas, drawX, drawY);

  ctx.restore();
}

/**
 * كود برمجي مستقل وجاهز للنسخ المباشر دون أي متطلبات خارجية (Standalone Code Snippet)
 */
export const STANDALONE_SHINE_FUNCTION_CODE = `
/**
 * دالة تحريك لمعة الطبقة البيضاء مع حواف بهتة من الجوانب والأعلى والأسفل ونقاط Keyframes
 * جاهزة للعمل مع أي عنصر Canvas 2D في React أو JavaScript خالص.
 */
function drawAnimatedShine(ctx, width, height, progress, options = {}) {
  const {
    beamWidth = 50,          // عرض شريط اللمعة
    angleDeg = 90,           // 90 = من فوق لتحت، 45 = مائل
    opacity = 0.8,           // سطوع اللمعة
    featherSides = 0.8,      // نعومة الحواف يمين وشمال (0 إلى 1)
    featherTopBottom = 0.65, // نعومة الحواف أعلى وأسفل (0 إلى 1)
    maskToAlpha = true,      // حصر اللمعة على حدود الصورة فقط
    color = "255, 255, 255"  // اللون الأبيض
  } = options;

  const rad = (angleDeg * Math.PI) / 180;
  const diagonal = Math.hypot(width, height);
  const travelDistance = diagonal + beamWidth * 3;
  const currentOffset = -beamWidth * 1.5 + progress * travelDistance;

  // 1. إنشاء كانفاس مساعد لدمج تلاشي الحواف الرباعي
  const offCanvas = document.createElement("canvas");
  const offW = Math.ceil(beamWidth * 3);
  const offH = Math.ceil(diagonal * 1.5);
  offCanvas.width = offW;
  offCanvas.height = offH;
  const offCtx = offCanvas.getContext("2d");

  // 2. تدرج أفقي لتنعيم اليمين والشمال (Horizontal Soft Edge)
  const hGrad = offCtx.createLinearGradient(0, 0, offW, 0);
  const mid = offW / 2;
  const halfBeam = (beamWidth / 2) * featherSides;
  hGrad.addColorStop(0, \`rgba(\${color}, 0)\`);
  hGrad.addColorStop(Math.max(0, (mid - halfBeam) / offW), \`rgba(\${color}, 0)\`);
  hGrad.addColorStop(0.5, \`rgba(\${color}, \${opacity})\`);
  hGrad.addColorStop(Math.min(1, (mid + halfBeam) / offW), \`rgba(\${color}, 0)\`);
  hGrad.addColorStop(1, \`rgba(\${color}, 0)\`);

  offCtx.fillStyle = hGrad;
  offCtx.fillRect(0, 0, offW, offH);

  // 3. تدرج رأسي لتنعيم الأعلى والأسفل (Vertical Soft Edge)
  if (featherTopBottom > 0) {
    offCtx.globalCompositeOperation = "destination-in";
    const vGrad = offCtx.createLinearGradient(0, 0, 0, offH);
    const fade = offH * (featherTopBottom * 0.4);
    vGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    vGrad.addColorStop(fade / offH, "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(1 - fade / offH, "rgba(0, 0, 0, 1)");
    vGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    offCtx.fillStyle = vGrad;
    offCtx.fillRect(0, 0, offW, offH);
  }

  // 4. تطبيق اللمعة على الكانفاس الرئيسي مع حفظ الشفافية
  ctx.save();
  if (maskToAlpha) {
    ctx.globalCompositeOperation = "source-atop"; // تلتزم بحدود الصورة فقط
  }

  ctx.translate(width / 2, height / 2);
  ctx.rotate(rad - Math.PI / 2);
  ctx.drawImage(offCanvas, -offW / 2, -diagonal * 0.75 + currentOffset);
  ctx.restore();
}
`;
