import { EditableLayer, SVGAProjectData } from './types';

// Helper to convert an image File or Blob to DataURL and Uint8Array
export async function fileToImageBuffer(file: File | Blob): Promise<{
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 200, height: img.naturalHeight || 200 });
    img.onerror = () => resolve({ width: 200, height: 200 });
    img.src = dataUrl;
  });

  return { dataUrl, bytes, width, height };
}

// Helper to flip an image horizontally and/or vertically and return its buffer
export async function getFlippedImageBuffer(
  source: Uint8Array | string | Blob,
  flipH: boolean = true,
  flipV: boolean = false
): Promise<{
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}> {
  let imgSource = '';
  let needRevoke = false;
  if (typeof source === 'string') {
    imgSource = source;
  } else if (source instanceof Blob) {
    imgSource = URL.createObjectURL(source);
    needRevoke = true;
  } else if (source instanceof Uint8Array) {
    const blob = new Blob([source as any], { type: 'image/png' });
    imgSource = URL.createObjectURL(blob);
    needRevoke = true;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(e);
    el.src = imgSource;
  });

  const w = img.naturalWidth || 200;
  const h = img.naturalHeight || 200;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.save();
  ctx.translate(flipH ? w : 0, flipV ? h : 0);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();

  if (needRevoke && imgSource.startsWith('blob:')) {
    URL.revokeObjectURL(imgSource);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Failed to create flipped blob');
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return { dataUrl, bytes, width: w, height: h };
}

// Generate new Image Layer
export function createImageLayer(
  imageKey: string,
  layerName: string,
  dataUrl: string,
  imgWidth: number,
  imgHeight: number,
  projectWidth: number,
  projectHeight: number,
  totalFrames: number,
  startFrame: number = 0,
  endFrame: number = totalFrames - 1
): EditableLayer {
  // Use scaleFit to fit inside project keeping aspect ratio if larger than canvas
  let scaleFit = 1;
  const padding = 20; // Some margin
  const availW = Math.max(10, projectWidth - padding * 2);
  const availH = Math.max(10, projectHeight - padding * 2);

  if (imgWidth > availW || imgHeight > availH) {
    scaleFit = Math.min(availW / (imgWidth || 1), availH / (imgHeight || 1));
  }

  const finalW = Math.round((imgWidth || 100) * scaleFit);
  const finalH = Math.round((imgHeight || 100) * scaleFit);
  
  // Center it in the canvas
  const finalX = Math.round((projectWidth - finalW) / 2);
  const finalY = Math.round((projectHeight - finalH) / 2);

  // Generate FrameEntity array for all project frames
  const frames: any[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const isVisible = f >= startFrame && f <= endFrame;
    frames.push({
      alpha: isVisible ? 1.0 : 0.0,
      layout: { x: 0, y: 0, width: imgWidth, height: imgHeight },
      // Apply the translation and scale directly to the frame so it draws exactly where the bounds say
      transform: { a: scaleFit, b: 0, c: 0, d: scaleFit, tx: finalX, ty: finalY }
    });
  }

  const spriteRef = {
    imageKey,
    frames
  };

  return {
    id: `layer_${Date.now()}_${imageKey}`,
    originalIndex: 0,
    imageKey,
    name: layerName,
    type: 'image',
    visible: true,
    locked: false,
    thumbnailUrl: dataUrl,
    transform: {
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100
    },
    initialBounds: {
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH
    },
    originalInitialBounds: {
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH
    },
    originalTransform: {
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100
    },
    originalSpriteFrames: JSON.parse(JSON.stringify(frames)),
    aspectRatioLocked: true,
    spriteRef,
    framesCount: totalFrames,
    inFrame: startFrame,
    outFrame: endFrame,
    trackColor: '#ef4444', // Red track bar color for newly added assets
    keyframeSummary: {
      startFrame,
      endFrame,
      hasShapes: false,
      hasTransform: true
    }
  };
}

// Generate Shape / Text Layer by drawing to an offscreen canvas
export async function createShapeLayer(
  shapeType: 'rect' | 'circle' | 'star' | 'badge' | 'text',
  projectWidth: number,
  projectHeight: number,
  totalFrames: number,
  customText?: string,
  fillColor: string = '#f59e0b',
  strokeColor: string = '#fbbf24'
): Promise<{ layer: EditableLayer; dataUrl: string; bytes: Uint8Array }> {
  const canvas = document.createElement('canvas');
  const size = 300;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  if (shapeType === 'rect') {
    const pad = 20;
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 8;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, 24);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
      ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);
    }
  } else if (shapeType === 'circle') {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size - 40) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shapeType === 'star') {
    const cx = size / 2;
    const cy = size / 2;
    const spikes = 5;
    const outerRadius = (size - 40) / 2;
    const innerRadius = outerRadius / 2.2;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 6;
    ctx.stroke();
  } else if (shapeType === 'badge' || shapeType === 'text') {
    // Elegant Golden Badge with Text
    const w = size - 30;
    const h = 100;
    const bx = 15;
    const by = (size - h) / 2;

    // Gradient background
    const grad = ctx.createLinearGradient(bx, by, bx + w, by + h);
    grad.addColorStop(0, '#d97706');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#b45309');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(bx, by, w, h, 20);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(bx, by, w, h);
      ctx.strokeRect(bx, by, w, h);
    }

    // Text
    const label = customText || 'نص مميز';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, size / 2, size / 2);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const imageKey = `img_shape_${Date.now()}`;
  const layerNames: Record<string, string> = {
    rect: 'مستطيل هندسي',
    circle: 'دائرة ذهبية',
    star: 'نجمة مميزة',
    badge: 'شارة ذهبية',
    text: customText || 'طبقة نص'
  };

  const layer = createImageLayer(
    imageKey,
    layerNames[shapeType] || 'طبقة جديدة',
    dataUrl,
    size,
    size,
    projectWidth,
    projectHeight,
    totalFrames
  );

  return { layer, dataUrl, bytes };
}

/**
 * Generate a dedicated, independent Shine Layer (طبقة لمعة مستقلة)
 */
export function createShineLayer(
  projectWidth: number,
  projectHeight: number,
  totalFrames: number,
  targetLayer?: EditableLayer
): { layer: EditableLayer; dataUrl: string; bytes: Uint8Array; imageKey: string } {
  const canvas = document.createElement('canvas');
  const w = targetLayer ? (targetLayer.transform.width || projectWidth) : projectWidth;
  const h = targetLayer ? (targetLayer.transform.height || projectHeight) : projectHeight;
  canvas.width = Math.max(20, Math.min(2048, w));
  canvas.height = Math.max(20, Math.min(2048, h));
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const imageKey = `shine_layer_${Date.now()}`;
  const startX = targetLayer ? targetLayer.transform.x : 0;
  const startY = targetLayer ? targetLayer.transform.y : 0;

  const baseLayer = createImageLayer(
    imageKey,
    targetLayer ? `لمعة (${targetLayer.name})` : 'طبقة اللمعة (Shine Layer)',
    dataUrl,
    canvas.width,
    canvas.height,
    projectWidth,
    projectHeight,
    totalFrames
  );

  baseLayer.isShineLayer = true;
  baseLayer.trackColor = '#f59e0b';
  baseLayer.transform.x = startX;
  baseLayer.transform.y = startY;
  baseLayer.transform.width = w;
  baseLayer.transform.height = h;
  baseLayer.initialBounds = { x: startX, y: startY, width: w, height: h };

  baseLayer.shineConfig = {
    enabled: true,
    isSeparateLayer: true,
    applyScope: 'single',
    exportMode: 'separate',
    beamWidth: 60,
    angleDeg: 45,
    opacity: 0.9,
    featherSides: 0.85,
    featherTopBottom: 0.7,
    maskToAlpha: false,
    color: '255, 255, 255',
    keyframeStart: 0.0,
    keyframeEnd: 1.0,
    durationSeconds: 2.0,
    repeatInterval: 0.5,
    speedMultiplier: 1.0,
    style: 'double',
    direction: 'forward',
    startPoint: { x: startX, y: startY },
    endPoint: { x: startX + w, y: startY + h },
    editPathOnCanvas: true
  };

  return { layer: baseLayer, dataUrl, bytes, imageKey };
}
