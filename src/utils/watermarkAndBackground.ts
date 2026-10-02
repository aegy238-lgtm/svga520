/**
 * Utility for drawing custom background and animated anti-theft watermark onto canvases
 */

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: number; // 0.1 to 1.0
  fontSize: number; // 14 to 48
  color: string;
  style: 'bouncing' | 'diagonal_scroll' | 'tiled' | 'corner_pulse';
  textColor: string;
  showTimestamp?: boolean;
}

export interface CustomBackgroundConfig {
  enabled: boolean;
  mergeInExport: boolean;
  imageUrl: string | null;
  mode: 'cover' | 'contain' | 'stretch';
  color?: string;
}

export interface UniversalWatermarkSettings {
  enabled?: boolean;
  type?: 'text' | 'image' | 'both';
  text?: string;
  color?: string;
  opacity?: number;
  fontSize?: number;
  pattern?: 'diagonal_repeat' | 'horizontal_bands' | 'floating' | 'pulse' | 'orbit' | 'single';
  position?: string;
  isAnimated?: boolean;
  animationSpeed?: number;
  angle?: number;
  shadow?: boolean;
  logoUrl?: string | null;
  spacingX?: number;
  spacingY?: number;
  [key: string]: any;
}

/**
 * Retrieve saved watermark settings from localStorage with permanent defaults
 */
export function getSavedWatermarkSettings(): UniversalWatermarkSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        enabled: false,
        type: 'text',
        text: 'Ahmed SVGA • Ahmed SVGA',
        color: '#ffffff',
        opacity: 0.45,
        pattern: 'diagonal_repeat',
        isAnimated: true,
        animationSpeed: 5,
        angle: -25,
      };
    }
    const raw = localStorage.getItem('svga_watermark_settings');
    const pinnedText = localStorage.getItem('svga_permanent_watermark_text') || 'Ahmed SVGA • Ahmed SVGA';
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        text: parsed.text || pinnedText,
        enabled: parsed.enabled === true,
      };
    }
    return {
      enabled: false,
      type: 'text',
      text: pinnedText,
      color: '#ffffff',
      opacity: 0.45,
      pattern: 'diagonal_repeat',
      isAnimated: true,
      animationSpeed: 5,
      angle: -25,
    };
  } catch {
    return {
      enabled: false,
      type: 'text',
      text: 'Ahmed SVGA • Ahmed SVGA',
      color: '#ffffff',
      opacity: 0.45,
      pattern: 'diagonal_repeat',
      isAnimated: true,
      animationSpeed: 5,
      angle: -25,
    };
  }
}

/**
 * Draw custom background on canvas context
 */
export function drawCustomBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImg: HTMLImageElement | null,
  mode: 'cover' | 'contain' | 'stretch' = 'cover',
  solidColor?: string
) {
  if (solidColor) {
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, width, height);
  }

  if (!bgImg || !bgImg.complete || bgImg.naturalWidth === 0) return;

  const imgW = bgImg.naturalWidth;
  const imgH = bgImg.naturalHeight;

  if (mode === 'stretch') {
    ctx.drawImage(bgImg, 0, 0, width, height);
    return;
  }

  if (mode === 'contain') {
    const scale = Math.min(width / imgW, height / imgH);
    const destW = imgW * scale;
    const destH = imgH * scale;
    const destX = (width - destW) / 2;
    const destY = (height - destH) / 2;
    ctx.drawImage(bgImg, destX, destY, destW, destH);
    return;
  }

  // mode === 'cover'
  const scale = Math.max(width / imgW, height / imgH);
  const destW = imgW * scale;
  const destH = imgH * scale;
  const destX = (width - destW) / 2;
  const destY = (height - destH) / 2;
  ctx.drawImage(bgImg, destX, destY, destW, destH);
}

/**
 * Universal Watermark Drawer for Canvas
 * Draws text, image, compound badges, diagonal repeat, horizontal bands, floating, and pulse animations.
 */
export function drawUniversalWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  settings?: UniversalWatermarkSettings | null,
  wmImg?: HTMLImageElement | null
) {
  const activeSettings = settings || getSavedWatermarkSettings();
  if (!activeSettings || activeSettings.enabled !== true) return;

  const opacity = activeSettings.opacity !== undefined ? activeSettings.opacity : 0.45;
  const color = activeSettings.color || '#ffffff';
  const rawText = activeSettings.text || (typeof window !== 'undefined' ? localStorage.getItem('svga_permanent_watermark_text') : null) || 'Ahmed SVGA • Ahmed SVGA';
  const text = rawText.trim();
  const pattern = activeSettings.pattern || (activeSettings.isAnimated ? 'floating' : 'diagonal_repeat');
  const type = activeSettings.type || (wmImg ? (text ? 'both' : 'image') : 'text');
  const angle = activeSettings.angle !== undefined ? activeSettings.angle : -25;
  let hasText = (type === 'text' || type === 'both' || !wmImg) && !!text;
  let hasImage = (type === 'image' || type === 'both') && !!wmImg && wmImg.complete && wmImg.naturalWidth > 0;

  if (!hasText && !hasImage && text) {
    hasText = true;
  }

  if (!hasText && !hasImage) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, opacity));

  const fontSize = Math.max(12, activeSettings.fontSize || Math.round(Math.min(width, height) * 0.038));
  ctx.font = `900 ${fontSize}px "Noto Sans Arabic", "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  if (activeSettings.shadow !== false) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  const textW = hasText ? ctx.measureText(text).width : 0;
  const imgSize = hasImage ? Math.max(18, Math.round(fontSize * 1.4)) : 0;
  const compoundW = textW + (hasImage ? imgSize + (hasText ? 8 : 0) : 0);

  const drawCompoundBadge = (x: number, y: number) => {
    let curX = x;
    if (hasImage && wmImg) {
      ctx.drawImage(wmImg, curX, y - imgSize / 2, imgSize, imgSize);
      curX += imgSize + (hasText ? 8 : 0);
    }
    if (hasText) {
      ctx.fillText(text, curX, y);
    }
  };

  const isAnimated = activeSettings.isAnimated !== false;
  const animSpeed = activeSettings.animationSpeed || 5;
  const animOffset = isAnimated ? (frame * animSpeed * 1.2) : 0;

  if (pattern === 'diagonal_repeat') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((angle * Math.PI) / 180);

    const stepX = Math.max(120, (activeSettings.spacingX || 200) + compoundW);
    const stepY = Math.max(50, activeSettings.spacingY || 120);
    const diag = Math.sqrt(width * width + height * height) * 1.5;

    const driftX = isAnimated ? ((animOffset * 1.1) % stepX) : 0;
    const driftY = isAnimated ? ((animOffset * 0.7) % stepY) : 0;

    let rowIndex = 0;
    for (let y = -diag - stepY; y <= diag + stepY; y += stepY) {
      const rowOffset = (rowIndex % 2 === 0) ? 0 : (stepX / 2);
      for (let x = -diag - stepX; x <= diag + stepX; x += stepX) {
        drawCompoundBadge(x + rowOffset - compoundW / 2 + driftX, y + driftY);
      }
      rowIndex++;
    }
    ctx.restore();
  } else if (pattern === 'horizontal_bands') {
    ctx.save();
    const stepY = Math.max(60, activeSettings.spacingY || 140);
    const stepX = Math.max(140, (activeSettings.spacingX || 240) + compoundW);
    const driftX = isAnimated ? ((animOffset * 1.5) % stepX) : 0;
    for (let y = 50; y < height; y += stepY) {
      for (let x = -compoundW - stepX; x < width + compoundW + stepX; x += stepX) {
        drawCompoundBadge(x + driftX, y);
      }
    }
    ctx.restore();
  } else if (pattern === 'floating') {
    const speed = activeSettings.animationSpeed || 5;
    const pxPerFrame = speed * 1.5;
    const badgeW = compoundW + 28;
    const badgeH = Math.max(fontSize, imgSize) + 16;
    const maxX = Math.max(1, width - badgeW);
    const maxY = Math.max(1, height - badgeH);
    const distX = frame * pxPerFrame;
    const distY = frame * pxPerFrame * 0.75;
    const modX = distX % (maxX * 2);
    const modY = distY % (maxY * 2);
    const wx = modX > maxX ? (maxX * 2) - modX : modX;
    const wy = modY > maxY ? (maxY * 2) - modY : modY;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 18, 0.85)';
    ctx.strokeStyle = `${color}45`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(wx, wy, badgeW, badgeH, 14);
    else ctx.rect(wx, wy, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(wx + 14, wy + badgeH / 2);
    ctx.restore();
  } else if (pattern === 'pulse') {
    const scale = 1 + Math.sin(frame * 0.1) * 0.05;
    const badgeW = (compoundW + 24) * scale;
    const badgeH = (Math.max(fontSize, imgSize) + 16) * scale;
    const wx = width - badgeW - 20;
    const wy = height - badgeH - 20;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 18, 0.85)';
    ctx.strokeStyle = `${color}50`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(wx, wy, badgeW, badgeH, 14);
    else ctx.rect(wx, wy, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(wx + 12, wy + badgeH / 2);
    ctx.restore();
  } else {
    // Single position
    let px = 20;
    let py = 20;
    const margin = 24;
    switch (activeSettings.position) {
      case 'top-left': px = margin; py = margin; break;
      case 'top-right': px = width - compoundW - margin; py = margin; break;
      case 'bottom-left': px = margin; py = height - fontSize - margin; break;
      case 'bottom-right': px = width - compoundW - margin; py = height - fontSize - margin; break;
      case 'center': px = (width - compoundW) / 2; py = height / 2; break;
      case 'top-center': px = (width - compoundW) / 2; py = margin; break;
      case 'bottom-center': px = (width - compoundW) / 2; py = height - fontSize - margin; break;
      case 'center-left': px = margin; py = height / 2; break;
      case 'center-right': px = width - compoundW - margin; py = height / 2; break;
      default: px = width - compoundW - margin; py = height - fontSize - margin;
    }
    drawCompoundBadge(px, py + fontSize / 2);
  }

  ctx.restore();
}

/**
 * Legacy Draw animated anti-theft watermark for frame `frameIndex`
 */
export function drawAnimatedWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameIndex: number,
  totalFrames: number,
  config: WatermarkConfig
) {
  if (!config.enabled || !config.text) return;

  const styleMap: Record<string, UniversalWatermarkSettings['pattern']> = {
    'bouncing': 'floating',
    'diagonal_scroll': 'diagonal_repeat',
    'tiled': 'diagonal_repeat',
    'corner_pulse': 'pulse'
  };

  const adaptedSettings: UniversalWatermarkSettings = {
    enabled: config.enabled,
    type: 'text',
    text: config.text,
    color: config.textColor || '#ffffff',
    opacity: config.opacity || 0.45,
    fontSize: config.fontSize,
    pattern: styleMap[config.style] || 'diagonal_repeat',
    isAnimated: true,
    animationSpeed: 5,
  };

  drawUniversalWatermarkOnCanvas(ctx, width, height, frameIndex, adaptedSettings, null);
}
