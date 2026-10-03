/**
 * Utility for drawing custom background and animated anti-theft watermark onto canvases
 */

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: number; // 0.1 to 1.0
  fontSize: number; // 14 to 48
  color: string;
  style: 'bouncing' | 'diagonal_scroll' | 'tiled' | 'corner_pulse' | 'wave_3d' | 'orbit_3d' | 'waterfall' | 'cube_3d' | 'perimeter_frame' | 'matrix';
  textColor: string;
  speed?: number; // 0.1 to 10 (e.g. 0.5x, 1x, 2.5x, 5x, 8x)
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
  shape?: 'pill' | 'glass_card' | 'neon_glow' | 'futuristic_hud' | 'stamp_seal' | 'ribbon_badge' | 'golden_vip' | 'minimal_clean';
  pattern?: 'smooth_right_glide' | 'wave_3d' | 'diagonal_repeat' | 'horizontal_bands' | 'floating' | 'pulse' | 'orbit' | 'circular_orbit' | 'cube_rotation' | 'single' | 'custom_drag' | 'waterfall' | 'perimeter_frame' | 'matrix_stream';
  position?: string;
  customX?: number; // 0 to 100 percentage
  customY?: number; // 0 to 100 percentage
  isAnimated?: boolean;
  animationSpeed?: number;
  speed?: number; // Speed factor (0.1x to 10x)
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
        pattern: 'wave_3d',
        isAnimated: true,
        animationSpeed: 2.5,
        speed: 2.5,
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
      pattern: 'wave_3d',
      isAnimated: true,
      animationSpeed: 2.5,
      speed: 2.5,
      angle: -25,
    };
  } catch {
    return {
      enabled: false,
      type: 'text',
      text: 'Ahmed SVGA • Ahmed SVGA',
      color: '#ffffff',
      opacity: 0.45,
      pattern: 'wave_3d',
      isAnimated: true,
      animationSpeed: 2.5,
      speed: 2.5,
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
 * Ultra-Smooth 3D Motion Physics Engine with speed control, 3D sine sweeps, perspective transforms, and fluid easing.
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
  const pattern = activeSettings.pattern || (activeSettings.isAnimated ? 'wave_3d' : 'diagonal_repeat');
  const type = activeSettings.type || (wmImg ? (text ? 'both' : 'image') : 'text');
  const angle = activeSettings.angle !== undefined ? activeSettings.angle : -25;
  let hasText = (type === 'text' || type === 'both' || !wmImg) && !!text;
  let hasImage = (type === 'image' || type === 'both') && !!wmImg && wmImg.complete && wmImg.naturalWidth > 0;

  if (!hasText && !hasImage && text) {
    hasText = true;
  }

  if (!hasText && !hasImage) return;

  // Speed physics calculation (supports speed values like 0.2x, 0.5x, 1x, 2.5x, 5x, 8x)
  const rawSpeed = activeSettings.speed ?? activeSettings.animationSpeed ?? 2.5;
  const speedFactor = rawSpeed > 10 ? rawSpeed / 5 : (rawSpeed < 0.05 ? 0.5 : rawSpeed);

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1.0, opacity));

  const fontSize = Math.max(12, activeSettings.fontSize || Math.round(Math.min(width, height) * 0.038));
  ctx.font = `900 ${fontSize}px "Noto Sans Arabic", "Tajawal", "Segoe UI", system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  if (activeSettings.shadow !== false) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
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
  const animOffset = isAnimated ? (frame * speedFactor * 4) : 0;

  if (pattern === 'smooth_right_glide') {
    // Ultra-Smooth 3D Fluid Glide starting from the Right side across the canvas with 3D tilt
    ctx.save();
    const widthMargin = compoundW + 100;
    const totalDist = width + widthMargin * 2;
    const progress = (frame * speedFactor * 3.5) % totalDist;
    
    // Smooth Right-to-Left sweep
    const baseX = width + widthMargin - progress;
    const cycle = (frame * speedFactor * 0.025) % (Math.PI * 2);
    const waveY = height * 0.5 + Math.sin(baseX * 0.005 + cycle) * (height * 0.22);
    
    // 3D Perspective Tilt & Depth Factor
    const zDepth = Math.cos(baseX * 0.006 + cycle);
    const scale = 0.82 + (zDepth + 1) * 0.18; // 0.82x to 1.18x
    const alpha3D = 0.5 + (zDepth + 1) * 0.25;

    ctx.translate(baseX, waveY);
    ctx.scale(scale, scale);
    ctx.rotate(zDepth * 0.15); // Fluid 3D Tilt angle
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, opacity * alpha3D));

    // Render Badge Box
    const badgeW = compoundW + 32;
    const badgeH = Math.max(fontSize, imgSize) + 18;
    ctx.fillStyle = 'rgba(6, 10, 24, 0.9)';
    ctx.strokeStyle = `${color}70`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 20);
    else ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(-badgeW / 2 + 16, 0);
    ctx.restore();
  } else if (pattern === 'wave_3d' || pattern === 'wave_sine') {
    // Ultra-Fluid 3D Wave Sweep from Right to Left with Perspective Depth & Tilt
    ctx.save();
    const cycle = (frame * speedFactor * 0.03) % (Math.PI * 2);
    const widthMargin = compoundW + 120;
    const totalDist = width + widthMargin * 2;
    const progress = (frame * speedFactor * 3.8) % totalDist;
    
    // Smooth Right-to-Left sweep
    const baseX = width + widthMargin - progress;
    const waveY = height / 2 + Math.sin(baseX * 0.007 + cycle) * (height * 0.28);
    
    // 3D Perspective Depth Factor (-1 to +1)
    const zDepth = Math.cos(baseX * 0.007 + cycle);
    const scale = 0.75 + (zDepth + 1) * 0.25; // 0.75x (far) to 1.25x (near)
    const alpha3D = 0.4 + (zDepth + 1) * 0.3; // Depth fading

    ctx.translate(baseX, waveY);
    ctx.scale(scale, scale);
    ctx.rotate(zDepth * 0.18); // 3D Perspective Rotation
    ctx.globalAlpha = Math.max(0.08, Math.min(1.0, opacity * alpha3D));

    // Glass Badge Container
    const badgeW = compoundW + 30;
    const badgeH = Math.max(fontSize, imgSize) + 18;
    ctx.fillStyle = 'rgba(6, 10, 24, 0.88)';
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16);
    else ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(-badgeW / 2 + 15, 0);
    ctx.restore();
  } else if (pattern === 'circular_orbit' || pattern === 'orbit') {
    // 3D Elliptical Perspective Orbit
    ctx.save();
    const angleRad = (frame * speedFactor * 0.04) % (Math.PI * 2);
    const rx = width * 0.38;
    const ry = height * 0.22;
    const cx = width / 2;
    const cy = height / 2;

    const x = cx + Math.cos(angleRad) * rx;
    const y = cy + Math.sin(angleRad) * ry;

    // 3D Z-Depth Scaling
    const z = Math.sin(angleRad);
    const scale = 0.7 + (z + 1) * 0.3;
    const depthAlpha = 0.35 + (z + 1) * 0.32;

    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(z * 0.12);
    ctx.globalAlpha = Math.max(0.08, Math.min(1.0, opacity * depthAlpha));

    const badgeW = compoundW + 30;
    const badgeH = Math.max(fontSize, imgSize) + 18;
    ctx.fillStyle = 'rgba(6, 10, 24, 0.88)';
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16);
    else ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(-badgeW / 2 + 15, 0);
    ctx.restore();
  } else if (pattern === 'cube_rotation' || pattern === 'cube_3d') {
    // 3D Floating Glass Cube Shield with Transform Matrix
    ctx.save();
    const progress = (frame * speedFactor * 0.035) % (Math.PI * 2);
    const cx = width / 2 + Math.sin(progress) * (width * 0.3);
    const cy = height / 2 + Math.cos(progress * 1.4) * (height * 0.22);

    const skewX = Math.sin(progress * 2) * 0.18;
    const scaleY = 0.82 + Math.cos(progress) * 0.18;

    ctx.translate(cx, cy);
    ctx.transform(1, skewX, 0, scaleY, 0, 0);
    ctx.globalAlpha = Math.max(0.1, Math.min(1.0, opacity));

    const badgeW = compoundW + 32;
    const badgeH = Math.max(fontSize, imgSize) + 20;
    ctx.fillStyle = 'rgba(8, 12, 28, 0.9)';
    ctx.strokeStyle = `${color}80`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16);
    else ctx.rect(-badgeW / 2, -badgeH / 2, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(-badgeW / 2 + 16, 0);
    ctx.restore();
  } else if (pattern === 'waterfall') {
    // Vertical Cascading Waterfall
    ctx.save();
    const stepX = Math.max(140, (activeSettings.spacingX || 220) + compoundW);
    const stepY = Math.max(60, activeSettings.spacingY || 130);
    const driftY = isAnimated ? ((frame * speedFactor * 3) % stepY) : 0;
    for (let x = 60; x < width + stepX; x += stepX) {
      for (let y = -stepY; y < height + stepY; y += stepY) {
        drawCompoundBadge(x, y + driftY);
      }
    }
    ctx.restore();
  } else if (pattern === 'perimeter_frame') {
    // Clockwise Perimeter Loop
    ctx.save();
    const perimeter = (width + height) * 2;
    const progress = (frame * speedFactor * 5) % perimeter;
    let x = 20, y = 20;
    if (progress < width) {
      x = progress; y = 20;
    } else if (progress < width + height) {
      x = width - compoundW - 20; y = progress - width;
    } else if (progress < width * 2 + height) {
      x = width - (progress - (width + height)) - compoundW; y = height - fontSize - 20;
    } else {
      x = 20; y = height - (progress - (width * 2 + height)) - fontSize;
    }
    drawCompoundBadge(Math.max(10, Math.min(width - compoundW - 10, x)), Math.max(20, Math.min(height - 20, y)));
    ctx.restore();
  } else if (pattern === 'matrix_stream') {
    // Falling Digital Matrix Columns
    ctx.save();
    const cols = Math.floor(width / (compoundW + 60)) || 1;
    const stepX = width / cols;
    for (let i = 0; i < cols; i++) {
      const colSpeed = (1 + (i % 3) * 0.4) * speedFactor * 2.5;
      const y = ((frame * colSpeed + i * 140) % (height + 120)) - 60;
      const x = i * stepX + 20;
      drawCompoundBadge(x, y);
    }
    ctx.restore();
  } else if (pattern === 'diagonal_repeat' || pattern === 'diagonal_scroll' || pattern === 'tiled') {
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
  } else if (pattern === 'floating' || pattern === 'bouncing') {
    const pxPerFrame = speedFactor * 3.5;
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
    ctx.fillStyle = 'rgba(5, 8, 18, 0.88)';
    ctx.strokeStyle = `${color}55`;
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
    const scale = 1 + Math.sin(frame * 0.1 * speedFactor) * 0.08;
    const badgeW = (compoundW + 24) * scale;
    const badgeH = (Math.max(fontSize, imgSize) + 16) * scale;
    const wx = width - badgeW - 20;
    const wy = height - badgeH - 20;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 18, 0.88)';
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
  } else if (pattern === 'custom_drag') {
    // Free Dragged Position (customX and customY in percentage or pixels)
    const customXPct = activeSettings.customX !== undefined ? activeSettings.customX : 80;
    const customYPct = activeSettings.customY !== undefined ? activeSettings.customY : 85;
    const badgeW = compoundW + 28;
    const badgeH = Math.max(fontSize, imgSize) + 16;
    
    // Calculate coordinates with boundary clamping
    const rawX = (customXPct / 100) * width - badgeW / 2;
    const rawY = (customYPct / 100) * height - badgeH / 2;
    const px = Math.max(10, Math.min(width - badgeW - 10, rawX));
    const py = Math.max(10, Math.min(height - badgeH - 10, rawY));

    // Optional gentle breathing hover float when animated
    const hoverY = isAnimated ? Math.sin(frame * speedFactor * 0.08) * 4 : 0;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 10, 24, 0.9)';
    ctx.strokeStyle = `${color}60`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py + hoverY, badgeW, badgeH, 16);
    else ctx.rect(px, py + hoverY, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    drawCompoundBadge(px + 14, py + hoverY + badgeH / 2);
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
    'corner_pulse': 'pulse',
    'wave_3d': 'wave_3d',
    'orbit_3d': 'circular_orbit',
    'waterfall': 'waterfall',
    'cube_3d': 'cube_rotation',
    'perimeter_frame': 'perimeter_frame',
    'matrix': 'matrix_stream'
  };

  const adaptedSettings: UniversalWatermarkSettings = {
    enabled: config.enabled,
    type: 'text',
    text: config.text,
    color: config.textColor || '#ffffff',
    opacity: config.opacity || 0.45,
    fontSize: config.fontSize,
    pattern: styleMap[config.style] || 'wave_3d',
    isAnimated: true,
    animationSpeed: config.speed || 2.5,
    speed: config.speed || 2.5,
  };

  drawUniversalWatermarkOnCanvas(ctx, width, height, frameIndex, adaptedSettings, null);
}
