export const enhanceImageCanvas = (
  image: HTMLImageElement,
  scale: number,
  adjustments: {
    sharpen: number; // 0 to 1
    contrast: number; // 1 to 2
    saturation: number; // 1 to 2
    brightness: number; // 1 to 2
    denoise: number; // 0 to 1
  }
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Extract perfect pristine alpha channel from scaled image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const baseAlpha = new Uint8ClampedArray(canvas.width * canvas.height);
  const origData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < origData.length; i += 4) {
    baseAlpha[i/4] = origData[i+3];
  }

  // 2. Clear canvas for fresh draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 3. Base Draw with Color Filters
  ctx.filter = `contrast(${adjustments.contrast * 100}%) saturate(${adjustments.saturation * 100}%) brightness(${adjustments.brightness * 100}%)`;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  // Denoise (soft subtle blur to remove pixelation, useful before sharpening)
  if (adjustments.denoise > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.filter = `blur(1.5px) contrast(${adjustments.contrast * 100}%) saturate(${adjustments.saturation * 100}%) brightness(${adjustments.brightness * 100}%)`;
    tempCtx.drawImage(image, 0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = adjustments.denoise;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Generate ImageData for Convolution (Sharpening)
  if (adjustments.sharpen > 0) {
    const width = canvas.width;
    const height = canvas.height;
    
    // Simple Sharpen matrix
    const mix = adjustments.sharpen; 
    const weights = [
      0, -mix, 0,
      -mix, 1 + 4*mix, -mix,
      0, -mix, 0
    ];
    
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);
    
    // Process on a separate buffer to avoid bleeding
    // Since images can be large (e.g., 4K), we optimize the nested loops
    const output = new Uint8ClampedArray(data.length);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstOff = (y * width + x) * 4;
        const alpha = baseAlpha[y * width + x];
        
        // Skip fully transparent pixels to save processing (optimization for PNGs)
        if (alpha === 0) {
          output[dstOff + 3] = 0;
          continue; 
        }

        let r = 0, g = 0, b = 0;
        let weightSum = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = y + cy - halfSide;
            const scx = x + cx - halfSide;
            
            // Edge checking
            const clampedY = Math.min(Math.max(scy, 0), height - 1);
            const clampedX = Math.min(Math.max(scx, 0), width - 1);
            
            const srcOff = (clampedY * width + clampedX) * 4;
            const neighborAlpha = baseAlpha[clampedY * width + clampedX];
            
            const wt = weights[cy * side + cx];
            
            // Only accumulate from pixels that have some opacity to avoid dark edges/halos
            if (neighborAlpha > 0) {
               r += data[srcOff] * wt;
               g += data[srcOff + 1] * wt;
               b += data[srcOff + 2] * wt;
               weightSum += wt;
            }
          }
        }
        
        if (Math.abs(weightSum) < 0.1) {
            output[dstOff] = data[dstOff];
            output[dstOff + 1] = data[dstOff + 1];
            output[dstOff + 2] = data[dstOff + 2];
        } else {
            // Re-normalize in case some weights were skipped
            const compensation = 1 / weightSum;
            output[dstOff] = r * compensation; 
            output[dstOff + 1] = g * compensation; 
            output[dstOff + 2] = b * compensation;
        }
        
        // Strictly restore original alpha
        output[dstOff + 3] = alpha;
      }
    }
    
    imageData.data.set(output);
  } else {
    // If not sharpening, still strictly restore base alpha to avoid filter bugs on transparent pixels
    for (let i = 0; i < data.length; i += 4) {
       data[i + 3] = baseAlpha[i/4];
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png', 1.0);
};
