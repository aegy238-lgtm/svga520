import { PAGInit } from 'libpag';
import SVGA from 'svga.lite';
import { encodeSVGA } from './svgaEncoder';
import type { MultiSvgaItem } from '../components/MultiSvgaViewer';

export interface CompressionOptions {
  compressionQuality?: number;
  onProgress?: (progress: number, message: string) => void;
}

export async function compressItemToImageSvga(
  item: MultiSvgaItem,
  options: CompressionOptions
): Promise<{ svgaBlob: Blob; pngBlob: Blob }> {
  const quality = Math.max(0, Math.min(100, options.compressionQuality ?? 100));
  
  options.onProgress?.(5, 'جاري تحضير المحرك للضغط...');

  let totalFrames = item.frames || 30;
  let fps = item.fps || 30;
  let width = item.dimensions?.width || 500;
  let height = item.dimensions?.height || 500;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to create canvas context');

  const imagesMap: Record<string, Uint8Array> = {};
  const sprites: any[] = [];
  
  let pagPlayer: any = null;
  let pagFile: any = null;
  let svgaPlayer: any = null;
  
  const div = document.createElement('div');
  div.style.width = width + 'px';
  div.style.height = height + 'px';
  div.style.position = 'absolute';
  div.style.left = '-9999px';
  div.style.top = '-9999px';
  document.body.appendChild(div);

  try {
    if (item.type === 'pag') {
      const PAG = await PAGInit({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/libpag@4.3.48/lib/${file}` });
      const buffer = await item.file.arrayBuffer();
      pagFile = await PAG.PAGFile.load(buffer);
      if (!pagFile) throw new Error('Failed to load PAG file');
      
      const pCanvas = document.createElement('canvas');
      pCanvas.width = width;
      pCanvas.height = height;
      div.appendChild(pCanvas);
      
      pagPlayer = await PAG.PAGPlayer.create();
      // @ts-ignore - libpag types are inconsistent
      const pagSurface = PAG.PAGSurface.fromCanvas ? PAG.PAGSurface.fromCanvas(pCanvas) : PAG.PAGSurface.FromCanvas(pCanvas);
      pagPlayer.setSurface(pagSurface);
      pagPlayer.setComposition(pagFile);
      
      let dur = pagFile.duration() * pagFile.frameRate() / 1000000;
      if (dur > 0) totalFrames = Math.floor(dur);
      
      for (let i = 0; i < totalFrames; i++) {
        options.onProgress?.(10 + Math.floor((i / totalFrames) * 70), `ضغط الطبقات وإطار ${i + 1} من ${totalFrames}...`);
        
        pagPlayer.setProgress(i / totalFrames);
        await pagPlayer.flush();
        
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(pCanvas, 0, 0, width, height);
        
        await captureAndCompressCanvas(ctx, width, height, quality, i, totalFrames, imagesMap, sprites);
      }
      
    } else {
      const sCanvasNew = document.createElement('canvas');
      sCanvasNew.width = width;
      sCanvasNew.height = height;
      div.appendChild(sCanvasNew);
      svgaPlayer = new SVGA.Player(sCanvasNew);
      svgaPlayer.clearsAfterStop = false;
      await svgaPlayer.setVideoItem(item.videoItem);
      svgaPlayer.setContentMode('AspectFit');
      
      const sCanvas = div.querySelector('canvas') as HTMLCanvasElement;
      
      for (let i = 0; i < totalFrames; i++) {
        options.onProgress?.(10 + Math.floor((i / totalFrames) * 70), `ضغط الطبقات وإطار ${i + 1} من ${totalFrames}...`);
        
        await new Promise<void>((resolve) => {
          let resolved = false;
          svgaPlayer.onFrame = (frame: number) => {
            if (frame === i && !resolved) {
              resolved = true;
              setTimeout(() => { svgaPlayer.pauseAnimation(); resolve(); }, 10);
            }
          };
          svgaPlayer.stepToFrame(i, true);
          setTimeout(() => { if (!resolved) { resolved = true; svgaPlayer.pauseAnimation(); resolve(); } }, 150);
        });
        
        ctx.clearRect(0, 0, width, height);
        if (sCanvas) {
           ctx.drawImage(sCanvas, 0, 0, width, height);
        }
        
        await captureAndCompressCanvas(ctx, width, height, quality, i, totalFrames, imagesMap, sprites);
      }
    }
    
    options.onProgress?.(85, 'تجميع وتشفير ملف SVGA المضغوط...');
    const movieData = {
      version: '2.0',
      params: { viewBoxWidth: width, viewBoxHeight: height, fps: Math.round(fps), frames: totalFrames },
      images: imagesMap,
      sprites
    };
    
    const svgaBlob = await encodeSVGA(movieData);
    
    let pngBlob: Blob;
    const midFrame = Math.floor(totalFrames / 2);
    if (imagesMap[`frame_img_${midFrame}`]) {
      const bytes = imagesMap[`frame_img_${midFrame}`];
      pngBlob = new Blob([bytes], { type: 'image/png' });
    } else {
      pngBlob = new Blob([], { type: 'image/png' });
    }
    
    options.onProgress?.(100, 'اكتمل الضغط!');
    
    return { svgaBlob, pngBlob };
    
  } finally {
    if (pagPlayer) { try { pagPlayer.destroy(); } catch(e){} }
    if (pagFile) { try { pagFile.destroy(); } catch(e){} }
    if (svgaPlayer) { try { svgaPlayer.clear(); } catch(e){} }
    document.body.removeChild(div);
  }
}

async function captureAndCompressCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  quality: number,
  frameIndex: number,
  totalFrames: number,
  imagesMap: Record<string, Uint8Array>,
  sprites: any[]
) {
  if (quality < 100) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const levels = Math.max(2, Math.floor(8 + (quality / 100) * 247));
    const factor = 255 / (levels - 1);
    for (let j = 0; j < data.length; j += 4) {
      if (data[j+3] > 0) {
        data[j] = Math.round(Math.round(data[j] / factor) * factor);
        data[j+1] = Math.round(Math.round(data[j+1] / factor) * factor);
        data[j+2] = Math.round(Math.round(data[j+2] / factor) * factor);
        data[j+3] = Math.round(Math.round(data[j+3] / factor) * factor);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const eCtx = exportCanvas.getContext('2d');
  if (eCtx) eCtx.drawImage(ctx.canvas, 0, 0);

  const dataUrl = exportCanvas.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let j = 0; j < binaryString.length; j++) {
    bytes[j] = binaryString.charCodeAt(j);
  }

  const imgKey = `frame_img_${frameIndex}`;
  imagesMap[imgKey] = bytes;

  const framesForSprite = [];
  for (let fIdx = 0; fIdx < totalFrames; fIdx++) {
     framesForSprite.push({
       alpha: fIdx === frameIndex ? 1.0 : 0.0,
       layout: { x: 0, y: 0, width: width, height: height },
       transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
     });
  }
  
  sprites.push({
    imageKey: imgKey,
    frames: framesForSprite
  });
}
