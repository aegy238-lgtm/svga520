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
  // Fit image reasonably inside canvas if too large
  let w = imgWidth;
  let h = imgHeight;
  const maxW = Math.round(projectWidth * 0.75);
  const maxH = Math.round(projectHeight * 0.75);
  if (w > maxW || h > maxH) {
    const scale = Math.min(maxW / w, maxH / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const x = Math.round((projectWidth - w) / 2);
  const y = Math.round((projectHeight - h) / 2);

  // Generate FrameEntity array for all project frames
  const frames: any[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const isVisible = f >= startFrame && f <= endFrame;
    frames.push({
      alpha: isVisible ? 1.0 : 0.0,
      layout: { x: 0, y: 0, width: imgWidth, height: imgHeight },
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
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
      x,
      y,
      width: w,
      height: h,
      scaleX: w / (imgWidth || 1),
      scaleY: h / (imgHeight || 1),
      rotation: 0,
      opacity: 100
    },
    initialBounds: {
      x: 0,
      y: 0,
      width: imgWidth,
      height: imgHeight
    },
    aspectRatioLocked: true,
    spriteRef,
    framesCount: totalFrames,
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
