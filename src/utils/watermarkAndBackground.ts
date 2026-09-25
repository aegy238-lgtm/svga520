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
 * Draw animated anti-theft watermark for frame `frameIndex`
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

  ctx.save();
  const text = config.text.trim();
  const baseSize = config.fontSize || Math.max(16, Math.round(width * 0.04));
  ctx.font = `bold ${baseSize}px "Noto Sans Arabic", "Segoe UI", sans-serif`;

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = baseSize * 1.2;

  const safeTotal = Math.max(1, totalFrames);
  const t = (frameIndex % safeTotal) / safeTotal;

  if (config.style === 'bouncing') {
    // Triangular wave bounce formula to traverse the full viewport
    const bounce = (val: number, max: number) => {
      if (max <= 0) return 0;
      const m = Math.abs(val % (max * 2));
      return m < max ? m : (max * 2 - m);
    };

    const speedX = (width * 1.5) / safeTotal;
    const speedY = (height * 1.8) / safeTotal;
    const maxX = Math.max(10, width - textW - 20);
    const maxY = Math.max(20, height - textH - 20);

    const x = 10 + bounce(frameIndex * speedX, maxX);
    const y = 20 + textH + bounce(frameIndex * speedY, maxY);

    ctx.globalAlpha = config.opacity || 0.45;

    // Draw dark protective stroke + vibrant glowing text fill
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, Math.round(baseSize * 0.15));
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(text, x, y);

    ctx.fillStyle = config.textColor || '#ffffff';
    ctx.fillText(text, x, y);

  } else if (config.style === 'diagonal_scroll') {
    // Smooth diagonal scrolling banner
    const totalDistX = width + textW * 2;
    const totalDistY = height + textH * 2;
    const x = (frameIndex * (totalDistX / safeTotal)) % totalDistX - textW;
    const y = (frameIndex * (totalDistY / safeTotal)) % totalDistY;

    ctx.globalAlpha = config.opacity || 0.45;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = config.textColor || '#ffffff';
    ctx.fillText(text, x, y);

  } else if (config.style === 'tiled') {
    // Subtle repeating tiled pattern rotated by -30 degrees with shifting motion
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.globalAlpha = (config.opacity || 0.3) * 0.5;
    ctx.fillStyle = config.textColor || '#ffffff';

    const stepX = textW * 2.2;
    const stepY = textH * 3.5;
    const shift = (frameIndex * 2) % stepX;

    for (let py = -height; py < height * 2; py += stepY) {
      for (let px = -width; px < width * 2; px += stepX) {
        ctx.fillText(text, px + shift, py);
      }
    }
  } else {
    // corner_pulse: subtle breathing in corner with slight orbital drift
    const pulse = 0.7 + 0.3 * Math.sin((frameIndex / safeTotal) * Math.PI * 4);
    ctx.globalAlpha = (config.opacity || 0.5) * pulse;

    const x = width - textW - 20;
    const y = height - 25;

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = config.textColor || '#ffffff';
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}
