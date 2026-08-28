import { Name3DState, ColorFill } from '../types';

const applyFill = (ctx: CanvasRenderingContext2D, fill: ColorFill, x: number, y: number, width: number, height: number) => {
  if (fill.type === 'color') {
    ctx.fillStyle = fill.color;
  } else if (fill.type === 'gradient' && fill.gradient) {
    const rad = (fill.gradient.angle * Math.PI) / 180;
    const x1 = x + width / 2 - (Math.cos(rad) * width) / 2;
    const y1 = y + height / 2 - (Math.sin(rad) * height) / 2;
    const x2 = x + width / 2 + (Math.cos(rad) * width) / 2;
    const y2 = y + height / 2 + (Math.sin(rad) * height) / 2;
    
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, fill.gradient.color1);
    grad.addColorStop(1, fill.gradient.color2);
    ctx.fillStyle = grad;
  } else if (fill.type === 'image' && fill.image) {
    const pattern = ctx.createPattern(fill.image, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
    } else {
      ctx.fillStyle = fill.color || '#fff';
    }
  }
};

const shadeColor = (color: string, percent: number) => {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);

    R = Math.round(R * (100 + percent) / 100);
    G = Math.round(G * (100 + percent) / 100);
    B = Math.round(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  

    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
}

export const renderCanvas = (
  canvas: HTMLCanvasElement, 
  state: Name3DState,
  renderWidth?: number,
  renderHeight?: number,
  scale: number = 1
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = renderWidth || state.canvasWidth;
  const height = renderHeight || state.canvasHeight;
  
  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  if (scale !== 1) ctx.scale(scale, scale);

  if (!state.transparentBg) {
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw shadows
  if (state.shadow.enabled) {
    ctx.shadowColor = state.shadow.color;
    ctx.shadowBlur = state.shadow.blur;
    ctx.shadowOffsetX = state.shadow.offsetX;
    ctx.shadowOffsetY = state.shadow.offsetY;
  } else {
    ctx.shadowColor = 'transparent';
  }

  ctx.font = `${state.fontSize}px "${state.fontFamily}"`;
  ctx.textAlign = state.textAlign;
  (ctx as any).letterSpacing = `${state.letterSpacing}px`;
  ctx.textBaseline = 'middle';

  // We approximate width/height for gradient calculation
  const textMetrics = ctx.measureText(state.text);
  const tWidth = textMetrics.width;
  const tHeight = state.fontSize;

  const lines = state.text.split('\\n');
  const radAngle = (state.depthAngle * Math.PI) / 180;

  // Draw 3D Depth (from back to front)
  for (let i = state.depth; i > 0; i -= 1) {
    ctx.save();
    
    // Disable shadow for inner layers
    if (i < state.depth) {
      ctx.shadowColor = 'transparent';
    }

    const offsetX = Math.cos(radAngle) * i;
    const offsetY = Math.sin(radAngle) * i;

    // Simulate lighting on the side based on layer index and lighting intensity
    const lightingEffect = (i / state.depth) * state.lightingIntensity * 100;
    
    let sideFill = { ...state.sideFill };
    if (sideFill.type === 'color') {
        sideFill.color = shadeColor(sideFill.color, -lightingEffect);
    }
    
    ctx.translate(state.textX + offsetX, state.textY + offsetY);
    ctx.rotate((state.textRotation * Math.PI) / 180);
    
    applyFill(ctx, sideFill, -tWidth/2, -tHeight/2, tWidth, tHeight);
    
    lines.forEach((line, index) => {
       const yPos = index * state.lineHeight;
       ctx.fillText(line, 0, yPos);
    });
    
    ctx.restore();
  }

  // Draw Front
  ctx.save();
  // Front shadow is handled by the last depth layer, but if depth is 0, we need it here
  if (state.depth === 0 && state.shadow.enabled) {
      ctx.shadowColor = state.shadow.color;
  } else {
      ctx.shadowColor = 'transparent';
  }
  
  ctx.translate(state.textX, state.textY);
  ctx.rotate((state.textRotation * Math.PI) / 180);
  applyFill(ctx, state.frontFill, -tWidth/2, -tHeight/2, tWidth, tHeight);
  
  lines.forEach((line, index) => {
     const yPos = index * state.lineHeight;
     ctx.fillText(line, 0, yPos);
  });
  
  // Simulated Glossiness on Front
  if (state.glossiness > 0) {
      ctx.globalCompositeOperation = 'overlay';
      const glossGrad = ctx.createLinearGradient(0, -tHeight, 0, tHeight);
      glossGrad.addColorStop(0, `rgba(255,255,255,${state.glossiness / 100})`);
      glossGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
      glossGrad.addColorStop(1, `rgba(0,0,0,${state.glossiness / 200})`);
      ctx.fillStyle = glossGrad;
      lines.forEach((line, index) => {
         const yPos = index * state.lineHeight;
         ctx.fillText(line, 0, yPos);
      });
      ctx.globalCompositeOperation = 'source-over';
  }
  
  ctx.restore();

  // Draw Ornaments
  // Sort by zIndex
  const sortedOrnaments = [...state.ornaments].sort((a, b) => a.zIndex - b.zIndex);
  
  sortedOrnaments.forEach(ornament => {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.translate(ornament.x, ornament.y);
      ctx.rotate((ornament.rotation * Math.PI) / 180);
      ctx.scale(ornament.scale, ornament.scale);
      
      ctx.font = `100px Arial`; // Base size for ornaments
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      applyFill(ctx, ornament.fill, -50, -50, 100, 100);
      ctx.fillText(ornament.char, 0, 0);
      
      ctx.restore();
  });
};
