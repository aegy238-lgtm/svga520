import { DetectedElement } from './smartImageSegmentation';

export type LabelTextMode = 'auto_number' | 'custom_list';
export type LabelStyleType = 'solid' | 'gradient' | 'metallic' | 'glossy' | 'texture';
export type GradientPresetKey = 'gold' | 'silver' | 'platinum' | 'ruby' | 'emerald' | 'royal_blue' | 'cyber_neon' | 'fire' | 'custom';

export interface IconLabelConfig {
  // Mode & Sequence
  textMode: LabelTextMode;
  startNumber: number; // e.g. 0 or 100
  step: number; // default 1
  endNumber?: number;
  paddingDigits: number; // 0 for "0", 2 for "01", 3 for "001", etc.
  prefix: string; // e.g. "VIP-" or "Lv."
  suffix: string; // e.g. "★"
  customNamesList: string[]; // for custom_list mode

  // Position & Geometry (Relative to Icon Box)
  positionX: number; // 0 to 100% (horizontal center offset)
  positionY: number; // 0 to 100% (vertical center offset)
  offsetX: number; // pixel fine-tuning
  offsetY: number; // pixel fine-tuning
  fontSize: number; // in pixels
  fontSizeRatio: number; // as percentage of icon height (e.g. 28%)
  useRelativeFontSize: boolean;
  fontWeight: 'normal' | 'bold' | '900';
  fontFamily: string;
  letterSpacing: number; // px
  rotation: number; // -180 to 180 degrees
  textAlign: 'center' | 'left' | 'right';
  opacity: number; // 0 to 100

  // 3D Visual Effects
  is3D: boolean;
  depth3D: number; // 1 to 25 px extrusion
  angle3D: number; // 0 to 360 degrees
  sideColor3D: string;
  bevel: boolean;
  reflection: boolean;

  // Colors & Fills
  styleType: LabelStyleType;
  solidColor: string;
  gradientPreset: GradientPresetKey;
  gradientColor1: string;
  gradientColor2: string;
  gradientAngle: number; // 0 to 360 deg
  
  // Texture Image
  textureImageUrl: string | null;
  textureImageElement: HTMLImageElement | null;

  // Stroke & Outlines
  stroke: {
    enabled: boolean;
    color: string;
    width: number;
  };

  // Shadow & Glow
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };

  glow: {
    enabled: boolean;
    color: string;
    blur: number;
  };
}

export const GRADIENT_PRESETS: Record<GradientPresetKey, { name: string; color1: string; color2: string; side3D: string }> = {
  gold: {
    name: 'ذهبي ملكي (Royal Gold)',
    color1: '#FFE259',
    color2: '#FFA751',
    side3D: '#B8860B'
  },
  silver: {
    name: 'فضي لامع (Bright Silver)',
    color1: '#FFFFFF',
    color2: '#B0B8C4',
    side3D: '#64748B'
  },
  platinum: {
    name: 'بلاتينيوم كريستال (Platinum)',
    color1: '#E0F2FE',
    color2: '#7DD3FC',
    side3D: '#0284C7'
  },
  ruby: {
    name: 'ياقوتي ملكي (Ruby Red)',
    color1: '#FF512F',
    color2: '#DD2476',
    side3D: '#881337'
  },
  emerald: {
    name: 'زمردي براق (Emerald Green)',
    color1: '#10B981',
    color2: '#047857',
    side3D: '#064E3B'
  },
  royal_blue: {
    name: 'أزرق ملكي (Royal Blue)',
    color1: '#38BDF8',
    color2: '#1D4ED8',
    side3D: '#1E3A8A'
  },
  cyber_neon: {
    name: 'نيون فوسفوري (Cyber Neon)',
    color1: '#A3E635',
    color2: '#06B6D4',
    side3D: '#0F766E'
  },
  fire: {
    name: 'ناري متوهج (Fire Flame)',
    color1: '#FBBF24',
    color2: '#DC2626',
    side3D: '#7F1D1D'
  },
  custom: {
    name: 'تدرج مخصص (Custom)',
    color1: '#FBBF24',
    color2: '#DC2626',
    side3D: '#451A03'
  }
};

export const AVAILABLE_FONTS = [
  { name: 'Cairo (عريض كلاسيكي)', family: 'Cairo, sans-serif' },
  { name: 'Almarai (أنيق ومقروء)', family: 'Almarai, sans-serif' },
  { name: 'Tajawal (عصري للشارات)', family: 'Tajawal, sans-serif' },
  { name: 'Impact (عريض جداً للعبة)', family: 'Impact, sans-serif' },
  { name: 'Montserrat (أرقام هندسية)', family: 'Montserrat, sans-serif' },
  { name: 'Arial Black (ثقيل وواضح)', family: '"Arial Black", Gadget, sans-serif' },
  { name: 'Playfair Display (فخم ورسمي)', family: '"Playfair Display", serif' },
  { name: 'Trebuchet MS (حروف دقيقة)', family: '"Trebuchet MS", sans-serif' }
];

export const DEFAULT_LABEL_CONFIG: IconLabelConfig = {
  textMode: 'auto_number',
  startNumber: 0,
  step: 1,
  paddingDigits: 0,
  prefix: '',
  suffix: '',
  customNamesList: [],

  positionX: 50, // Center horizontally
  positionY: 50, // Center vertically
  offsetX: 0,
  offsetY: 0,
  fontSize: 24,
  fontSizeRatio: 26,
  useRelativeFontSize: true,
  fontWeight: 'bold',
  fontFamily: 'Cairo, Impact, sans-serif',
  letterSpacing: 0,
  rotation: 0,
  textAlign: 'center',
  opacity: 100,

  is3D: true,
  depth3D: 4,
  angle3D: 90, // Downwards depth
  sideColor3D: '#B8860B',
  bevel: true,
  reflection: false,

  styleType: 'gradient',
  solidColor: '#FFFFFF',
  gradientPreset: 'gold',
  gradientColor1: '#FFE259',
  gradientColor2: '#FFA751',
  gradientAngle: 90,

  textureImageUrl: null,
  textureImageElement: null,

  stroke: {
    enabled: true,
    color: '#000000',
    width: 3
  },

  shadow: {
    enabled: true,
    color: 'rgba(0,0,0,0.85)',
    blur: 6,
    offsetX: 0,
    offsetY: 4
  },

  glow: {
    enabled: false,
    color: 'rgba(255, 215, 0, 0.6)',
    blur: 8
  }
};

export interface LabelItemAudit {
  index: number; // 0-based
  elementId: string;
  elementIndex: number; // original element index
  computedLabel: string;
  filename: string;
  elementWidth: number;
  elementHeight: number;
  hasWarning: boolean;
  warningReason?: string;
}

export interface LabelValidationReport {
  isValid: boolean;
  totalIcons: number;
  assignedCount: number;
  firstNumber: string | number;
  lastNumber: string | number;
  duplicates: { value: string; count: number; indices: number[] }[];
  missing: string[];
  unlabeledCount: number;
  statusTitle: string;
  statusMessage: string;
  items: LabelItemAudit[];
}

/**
 * Generate formatted text string for an icon based on its index and label config
 */
export function formatIconText(index: number, config: IconLabelConfig): string {
  if (config.textMode === 'custom_list') {
    if (config.customNamesList && config.customNamesList.length > index) {
      const customStr = config.customNamesList[index].trim();
      return `${config.prefix}${customStr}${config.suffix}`;
    }
    // Fallback to number if list is shorter than icon count
    const numVal = config.startNumber + (index * config.step);
    return `${config.prefix}${numVal}${config.suffix}`;
  }

  const num = config.startNumber + (index * config.step);
  let numStr = String(num);

  if (config.paddingDigits > 0) {
    numStr = String(num).padStart(config.paddingDigits, '0');
  }

  return `${config.prefix}${numStr}${config.suffix}`;
}

/**
 * Generate formatted export filename for an icon (e.g. "000.png" or "VIP_025.png")
 */
export function formatIconFilename(index: number, config: IconLabelConfig, ext: string = 'png'): string {
  if (config.textMode === 'custom_list' && config.customNamesList && config.customNamesList.length > index) {
    const rawName = config.customNamesList[index].trim().replace(/[/\\?%*:|"<>]/g, '_');
    const paddedIdx = String(index).padStart(3, '0');
    return `${paddedIdx}_${rawName || 'icon'}.${ext}`;
  }

  const num = config.startNumber + (index * config.step);
  let numStr = String(num);

  // Default filename padding matches highest number or config padding
  const pad = Math.max(config.paddingDigits, 3);
  numStr = String(num).padStart(pad, '0');

  const cleanPrefix = config.prefix.replace(/[/\\?%*:|"<>]/g, '_');
  const cleanSuffix = config.suffix.replace(/[/\\?%*:|"<>]/g, '_');

  return `${cleanPrefix}${numStr}${cleanSuffix}.${ext}`;
}

/**
 * Audits all labels and generates strict validation report (Duplicate check, Missing numbers check, Single Source of Truth)
 */
export function auditAndValidateLabels(
  elements: DetectedElement[],
  config: IconLabelConfig
): LabelValidationReport {
  const totalIcons = elements.length;
  const items: LabelItemAudit[] = [];
  const labelCounts = new Map<string, number[]>();

  for (let i = 0; i < totalIcons; i++) {
    const el = elements[i];
    const computedLabel = formatIconText(i, config);
    const filename = formatIconFilename(i, config, 'png');

    const existing = labelCounts.get(computedLabel) || [];
    existing.push(i);
    labelCounts.set(computedLabel, existing);

    items.push({
      index: i,
      elementId: el.id,
      elementIndex: el.index,
      computedLabel,
      filename,
      elementWidth: el.width,
      elementHeight: el.height,
      hasWarning: false
    });
  }

  // Check duplicates
  const duplicates: { value: string; count: number; indices: number[] }[] = [];
  labelCounts.forEach((indices, label) => {
    if (indices.length > 1) {
      duplicates.push({ value: label, count: indices.length, indices });
      indices.forEach(idx => {
        if (items[idx]) {
          items[idx].hasWarning = true;
          items[idx].warningReason = `الرقم ${label} مكرر في ${indices.length} أيقونات`;
        }
      });
    }
  });

  // Check missing numbers in sequence (if auto_number mode)
  const missing: string[] = [];
  if (config.textMode === 'auto_number' && totalIcons > 0) {
    const expectedStart = config.startNumber;
    const expectedEnd = config.startNumber + (totalIcons - 1) * config.step;
    for (let expected = expectedStart; expected <= expectedEnd; expected += config.step) {
      let expectedStr = String(expected);
      if (config.paddingDigits > 0) {
        expectedStr = String(expected).padStart(config.paddingDigits, '0');
      }
      const fullExpected = `${config.prefix}${expectedStr}${config.suffix}`;
      if (!labelCounts.has(fullExpected)) {
        missing.push(fullExpected);
      }
    }
  }

  const isValid = duplicates.length === 0 && missing.length === 0 && totalIcons > 0;
  const firstNumber = items.length > 0 ? items[0].computedLabel : config.startNumber;
  const lastNumber = items.length > 0 ? items[items.length - 1].computedLabel : config.startNumber;

  let statusTitle = 'الترقيم سليم 100% ✅';
  let statusMessage = `تم ترقيم ${totalIcons} أيقونة تسلسلياً بنجاح من (${firstNumber}) إلى (${lastNumber}) بدون أي تكرار أو نقص.`;

  if (!isValid) {
    if (duplicates.length > 0 && missing.length > 0) {
      statusTitle = 'يوجد تكرار وأرقام مفقودة ⚠️';
      statusMessage = `يوجد ${duplicates.length} أرقام مكررة و ${missing.length} أرقام مفقودة في التسلسل.`;
    } else if (duplicates.length > 0) {
      statusTitle = 'يوجد أرقام مكررة ⚠️';
      statusMessage = `يوجد ${duplicates.length} قيم مكررة، يرجى مراجعة الترقيم أو القائمة.`;
    } else if (missing.length > 0) {
      statusTitle = 'يوجد أرقام مفقودة ⚠️';
      statusMessage = `يوجد ${missing.length} أرقام مفقودة في التسلسل.`;
    }
  }

  return {
    isValid,
    totalIcons,
    assignedCount: items.length,
    firstNumber,
    lastNumber,
    duplicates,
    missing,
    unlabeledCount: 0,
    statusTitle,
    statusMessage,
    items
  };
}

/**
 * High-performance 2D/3D Text and Texture Renderer for an Icon on any Canvas Context
 */
export function renderLabelOnContext(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxW: number,
  boxH: number,
  config: IconLabelConfig
): void {
  if (!text || text.trim() === '') return;

  ctx.save();

  // 1. Calculate Font Size
  const computedFontSize = config.useRelativeFontSize
    ? Math.max(8, Math.round((boxH * config.fontSizeRatio) / 100))
    : config.fontSize;

  // 2. Calculate Center Coordinates
  const targetX = (boxW * config.positionX) / 100 + config.offsetX;
  const targetY = (boxH * config.positionY) / 100 + config.offsetY;

  // 3. Setup Transform (Translation & Rotation)
  ctx.translate(targetX, targetY);
  if (config.rotation !== 0) {
    ctx.rotate((config.rotation * Math.PI) / 180);
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, config.opacity / 100));

  // 4. Setup Text Properties
  ctx.font = `${config.fontWeight} ${computedFontSize}px ${config.fontFamily}`;
  ctx.textAlign = config.textAlign;
  ctx.textBaseline = 'middle';

  // 5. Calculate 3D extrusion vector
  const depth = config.is3D ? Math.max(1, config.depth3D) : 0;
  const radAngle = ((config.angle3D ?? 90) * Math.PI) / 180;
  const stepX = Math.cos(radAngle);
  const stepY = Math.sin(radAngle);

  // 6. Draw Glow if enabled
  if (config.glow.enabled && config.glow.blur > 0) {
    ctx.save();
    ctx.shadowColor = config.glow.color;
    ctx.shadowBlur = config.glow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = config.glow.color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // 7. Draw Drop Shadow
  if (config.shadow.enabled) {
    ctx.save();
    ctx.shadowColor = config.shadow.color;
    ctx.shadowBlur = config.shadow.blur;
    ctx.shadowOffsetX = config.shadow.offsetX + (config.is3D ? stepX * depth : 0);
    ctx.shadowOffsetY = config.shadow.offsetY + (config.is3D ? stepY * depth : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // 8. Draw 3D Extrusion Side Layers (Back to Front)
  if (config.is3D && depth > 0) {
    ctx.save();
    ctx.fillStyle = config.sideColor3D || '#451A03';
    ctx.strokeStyle = config.sideColor3D || '#451A03';
    ctx.lineWidth = config.stroke.enabled ? config.stroke.width : 1;

    for (let d = depth; d >= 1; d -= 0.5) {
      const curX = stepX * d;
      const curY = stepY * d;
      if (config.stroke.enabled) {
        ctx.strokeText(text, curX, curY);
      }
      ctx.fillText(text, curX, curY);
    }
    ctx.restore();
  }

  // 9. Prepare Front Fill (Solid, Gradient, Texture Pattern)
  let frontFillStyle: string | CanvasGradient | CanvasPattern = config.solidColor;

  if (config.styleType === 'texture' && config.textureImageElement && config.textureImageElement.complete) {
    try {
      const pattern = ctx.createPattern(config.textureImageElement, 'repeat');
      if (pattern) {
        frontFillStyle = pattern;
      }
    } catch (e) {
      console.warn('Failed to create pattern:', e);
      frontFillStyle = config.solidColor;
    }
  } else if (config.styleType === 'gradient' || config.styleType === 'metallic' || config.styleType === 'glossy') {
    let c1 = config.gradientColor1;
    let c2 = config.gradientColor2;
    if (config.gradientPreset !== 'custom' && GRADIENT_PRESETS[config.gradientPreset]) {
      c1 = GRADIENT_PRESETS[config.gradientPreset].color1;
      c2 = GRADIENT_PRESETS[config.gradientPreset].color2;
    }

    const textMetrics = ctx.measureText(text);
    const halfW = (textMetrics.width || computedFontSize * 2) / 2;
    const halfH = computedFontSize / 2;

    const gRad = ((config.gradientAngle ?? 90) * Math.PI) / 180;
    const gx1 = -Math.cos(gRad) * halfW;
    const gy1 = -Math.sin(gRad) * halfH;
    const gx2 = Math.cos(gRad) * halfW;
    const gy2 = Math.sin(gRad) * halfH;

    const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
    grad.addColorStop(0, c1);

    if (config.styleType === 'metallic' || config.styleType === 'glossy') {
      grad.addColorStop(0.45, '#FFFFFF');
      grad.addColorStop(0.55, c1);
    }
    grad.addColorStop(1, c2);
    frontFillStyle = grad;
  }

  // 10. Draw Stroke / Outline
  if (config.stroke.enabled && config.stroke.width > 0) {
    ctx.save();
    ctx.strokeStyle = config.stroke.color;
    ctx.lineWidth = config.stroke.width * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, 0, 0);
    ctx.restore();
  }

  // 11. Draw Front Face Text Fill
  ctx.fillStyle = frontFillStyle;
  ctx.fillText(text, 0, 0);

  // 12. Draw Bevel / Highlight Sheen
  if (config.bevel) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(text, -0.75, -0.75);
    ctx.restore();
  }

  // 13. Draw Subtle Reflection if enabled
  if (config.reflection) {
    ctx.save();
    ctx.translate(0, computedFontSize * 0.9);
    ctx.scale(1, -0.4);
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = frontFillStyle;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Render a single cropped icon with its high-resolution label onto a clean Canvas
 */
export function renderLabeledIconCanvas(
  sourceImage: HTMLImageElement,
  element: DetectedElement,
  labelText: string,
  config: IconLabelConfig,
  customCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const canvas = customCanvas || document.createElement('canvas');
  canvas.width = Math.max(1, element.width);
  canvas.height = Math.max(1, element.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw original icon graphic at 100% native quality
  ctx.drawImage(
    sourceImage,
    element.x,
    element.y,
    element.width,
    element.height,
    0,
    0,
    element.width,
    element.height
  );

  // Render label onto icon
  renderLabelOnContext(ctx, labelText, element.width, element.height, config);

  return canvas;
}

export interface CloneDistributionRule {
  id: string;
  sourceElementIndex: number; // which source icon to use
  fromNumber: number; // e.g. 0
  toNumber: number; // e.g. 19
  gradientPreset?: GradientPresetKey;
  hueShift?: number; // -180 to +180 deg tint adjustment
  brightness?: number; // 50% to 150%
  contrast?: number; // 50% to 150%
  customPrefix?: string;
  customSuffix?: string;
}

export interface ClonedIconItem {
  index: number;
  targetNumber: number;
  computedLabel: string;
  filename: string;
  sourceElementIndex: number;
  sourceElement: DetectedElement;
  rule?: CloneDistributionRule;
}

/**
 * Generate a complete sequence of cloned icons up to a target count (e.g. 200 icons)
 * using user-defined distribution rules or smart batch allocation
 */
export function generateClonedIconsSequence(
  sourceElements: DetectedElement[],
  totalTargetCount: number, // e.g. 200
  startNumber: number = 0,
  step: number = 1,
  config: IconLabelConfig,
  rules?: CloneDistributionRule[]
): ClonedIconItem[] {
  if (sourceElements.length === 0 || totalTargetCount <= 0) return [];

  const items: ClonedIconItem[] = [];

  for (let i = 0; i < totalTargetCount; i++) {
    const currentNum = startNumber + i * step;

    // Find matching rule if defined
    let matchedRule: CloneDistributionRule | undefined = undefined;
    if (rules && rules.length > 0) {
      matchedRule = rules.find(r => currentNum >= r.fromNumber && currentNum <= r.toNumber);
    }

    let sourceIndex = 0;
    if (matchedRule) {
      sourceIndex = Math.min(Math.max(0, matchedRule.sourceElementIndex), sourceElements.length - 1);
    } else {
      // Default: cyclic or even distribution among source elements
      // e.g. if 3 source icons and 200 total, divide 200 / 3 = ~66 per tier
      const tierSize = Math.max(1, Math.ceil(totalTargetCount / sourceElements.length));
      const calculatedTier = Math.floor(i / tierSize);
      sourceIndex = Math.min(calculatedTier, sourceElements.length - 1);
    }

    const sourceEl = sourceElements[sourceIndex] || sourceElements[0];

    // Compute text based on rule overrides or main config
    let numStr = String(currentNum);
    if (config.paddingDigits > 0) {
      numStr = String(currentNum).padStart(config.paddingDigits, '0');
    }
    const prefix = matchedRule?.customPrefix !== undefined ? matchedRule.customPrefix : config.prefix;
    const suffix = matchedRule?.customSuffix !== undefined ? matchedRule.customSuffix : config.suffix;
    const computedLabel = `${prefix}${numStr}${suffix}`;

    // Format filename e.g. "000.png"
    const pad = Math.max(config.paddingDigits, 3);
    const paddedNum = String(currentNum).padStart(pad, '0');
    const cleanPrefix = prefix.replace(/[/\\?%*:|"<>]/g, '_');
    const cleanSuffix = suffix.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${cleanPrefix}${paddedNum}${cleanSuffix}.png`;

    items.push({
      index: i,
      targetNumber: currentNum,
      computedLabel,
      filename,
      sourceElementIndex: sourceIndex,
      sourceElement: sourceEl,
      rule: matchedRule
    });
  }

  return items;
}

/**
 * Render a Cloned Icon with optional Color Filter (Hue, Brightness, Contrast) and Tier Label
 */
export function renderClonedIconCanvas(
  sourceImage: HTMLImageElement,
  item: ClonedIconItem,
  baseConfig: IconLabelConfig,
  customCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const canvas = customCanvas || document.createElement('canvas');
  canvas.width = Math.max(1, item.sourceElement.width);
  canvas.height = Math.max(1, item.sourceElement.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply visual filter to icon if specified in rule (e.g. hue-rotate for color variations)
  if (item.rule && (item.rule.hueShift || item.rule.brightness || item.rule.contrast)) {
    const filters: string[] = [];
    if (item.rule.hueShift) filters.push(`hue-rotate(${item.rule.hueShift}deg)`);
    if (item.rule.brightness) filters.push(`brightness(${item.rule.brightness}%)`);
    if (item.rule.contrast) filters.push(`contrast(${item.rule.contrast}%)`);
    ctx.filter = filters.join(' ');
  } else {
    ctx.filter = 'none';
  }

  // Draw source cropped icon
  ctx.drawImage(
    sourceImage,
    item.sourceElement.x,
    item.sourceElement.y,
    item.sourceElement.width,
    item.sourceElement.height,
    0,
    0,
    item.sourceElement.width,
    item.sourceElement.height
  );

  // Reset filter for sharp text
  ctx.filter = 'none';

  // Merge rule specific gradient if present
  const activeConfig: IconLabelConfig = {
    ...baseConfig,
    ...(item.rule?.gradientPreset ? { gradientPreset: item.rule.gradientPreset } : {})
  };

  // Render label
  renderLabelOnContext(ctx, item.computedLabel, item.sourceElement.width, item.sourceElement.height, activeConfig);

  return canvas;
}

/**
 * Helper to generate text list for clipboard copying
 */
export function generateTextListForCopy(
  items: { computedLabel: string; filename: string }[],
  format: 'numbers_only' | 'filenames' | 'comma_separated' | 'json'
): string {
  if (!items || items.length === 0) return '';

  switch (format) {
    case 'numbers_only':
      return items.map(i => i.computedLabel).join('\n');
    case 'filenames':
      return items.map(i => i.filename).join('\n');
    case 'comma_separated':
      return items.map(i => i.computedLabel).join(', ');
    case 'json':
      return JSON.stringify(items.map(i => ({ text: i.computedLabel, file: i.filename })), null, 2);
    default:
      return items.map(i => i.computedLabel).join('\n');
  }
}
