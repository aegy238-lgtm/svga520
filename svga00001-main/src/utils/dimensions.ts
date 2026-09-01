
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Calculates safe dimensions for video encoding (must be even numbers).
 * Aligns bounds strictly to prevent WebCodecs macroblock area limit errors.
 */
export const calculateSafeDimensions = (width: number, height: number, maxPixels: number = 9437184): Dimensions => {
  // Cap at 4096 per axis (max standard hardware encode dimension in most chromium setups)
  let maxW = Math.min(width, 4096);
  let maxH = Math.min(height, 4096);
  let scale = Math.min(1, Math.min(maxW / width, maxH / height));
  
  let safeWidth = Math.floor((width * scale) / 2) * 2;
  let safeHeight = Math.floor((height * scale) / 2) * 2;
  
  // Also ensure the 16x16 macroblock area doesn't exceed maxPixels 
  // (codec internally pads before checking limits)
  const getMacroblockArea = (w: number, h: number) => {
    return Math.ceil(w / 16) * 16 * Math.ceil(h / 16) * 16;
  };
  
  while (getMacroblockArea(safeWidth, safeHeight) > maxPixels && safeWidth > 16 && safeHeight > 16) {
    scale *= 0.95;
    safeWidth = Math.floor((width * scale) / 2) * 2;
    safeHeight = Math.floor((height * scale) / 2) * 2;
  }
  
  return {
    width: isNaN(safeWidth) || safeWidth <= 0 ? 1334 : safeWidth,
    height: isNaN(safeHeight) || safeHeight <= 0 ? 750 : safeHeight
  };
};

/**
 * Gets the default dimensions for a file based on its metadata.
 */
export const getDefaultDimensions = (metadata: any): Dimensions => {
  if (metadata?.dimensions?.width && metadata?.dimensions?.height) {
    return {
      width: metadata.dimensions.width,
      height: metadata.dimensions.height
    };
  }
  
  if (metadata?.videoItem?.videoSize?.width && metadata?.videoItem?.videoSize?.height) {
      return {
          width: metadata.videoItem.videoSize.width,
          height: metadata.videoItem.videoSize.height
      };
  }
  
  // Fallback to standard 1334x750 if no dimensions found
  return {
    width: 1334,
    height: 750
  };
};
