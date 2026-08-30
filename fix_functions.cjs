const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// The file has a broken captureFrame and handleDownloadAllCombined.
// It currently looks like:
//  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
//    if (!item.dimensions) item.dimensions = { width: 500, height: 500 };
//    const canvas = document.createElement('canvas');
//    const dw = selectedPreset ? selectedPreset.width : item.dimensions.width;
//    const dh = selectedPreset ? selectedPreset.height : item.dimensions.height;
//    canvas.width = dw;
//    canvas.height = dh;
//    const ctx = canvas.getContext('2d', { alpha: true })!;
//    ctx.clearRect(0, 0, canvas.width, canvas.height);
//    const result = await compressItemToImageSvga(item, { ... });
//    zip.file(...)
//    ...
//  };
//
// Let's replace the whole captureFrame and handleDownloadAllCombined with the correct code.

const startRegex = /const captureFrame = async \(item: MultiSvgaItem, frameIndex: number = 0\): Promise<Blob> => \{/;
const endRegex = /const handleDownloadSingleImage = async \(item: MultiSvgaItem\) => \{/;

const newFunctions = `
  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
    if (!item.dimensions) item.dimensions = { width: 500, height: 500 };
    
    const canvas = document.createElement('canvas');
    const dw = selectedPreset ? selectedPreset.width : item.dimensions.width;
    const dh = selectedPreset ? selectedPreset.height : item.dimensions.height;
    canvas.width = dw;
    canvas.height = dh;
    
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const div = document.createElement('div');
    div.style.width = dw + 'px';
    div.style.height = dh + 'px';
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    document.body.appendChild(div);

    try {
      if (item.type === 'pag') {
        const PAG = await PAGInit({ locateFile: (file) => \`https://cdn.jsdelivr.net/npm/libpag@4.3.48/lib/\${file}\` });
        const buffer = await item.file.arrayBuffer();
        const pagFile = await PAG.PAGFile.load(buffer);
        
        const pCanvas = document.createElement('canvas');
        pCanvas.width = dw;
        pCanvas.height = dh;
        div.appendChild(pCanvas);
        
        const pagPlayer = await PAG.PAGPlayer.create();
        const pagSurface = PAG.PAGSurface.FromCanvas(pCanvas);
        pagPlayer.setSurface(pagSurface);
        pagPlayer.setComposition(pagFile);
        
        const framesToJump = Math.floor((item.frames || 1) / 2);
        pagPlayer.setProgress(framesToJump / (item.frames || 1));
        await pagPlayer.flush();
        
        ctx.drawImage(pCanvas, 0, 0, dw, dh);
        
        pagPlayer.destroy();
        pagFile.destroy();
      } else {
        const player = new SVGA.Player(div);
        player.clearsAfterStop = false;
        
        let framesToJump = frameIndex;
        if (frameIndex === 0 && item.frames) {
          framesToJump = Math.floor(item.frames / 2);
        }

        await new Promise<void>((resolve) => {
          player.setVideoItem(item.videoItem);
          player.setContentMode('AspectFit');
          
          let resolved = false;
          player.onFrame = (frame) => {
              if (frame === framesToJump && !resolved) {
                   resolved = true;
                   setTimeout(() => {
                       player.pauseAnimation();
                       resolve();
                   }, 10);
              }
          };
          
          player.stepToFrame(framesToJump, true);
          
          setTimeout(() => {
              if (!resolved) {
                  resolved = true;
                  player.pauseAnimation();
                  resolve();
              }
          }, 150);
        });
        
        const svgaCanvas = div.querySelector('canvas');
        if (svgaCanvas) {
          const sw = item.dimensions.width;
          const sh = item.dimensions.height;
          const scale = Math.min(dw / sw, dh / sh);
          const finalW = sw * scale;
          const finalH = sh * scale;
          const x = (dw - finalW) / 2;
          const y = (dh - finalH) / 2;
          ctx.drawImage(svgaCanvas, x, y, finalW, finalH);
        }
      }
    } finally {
      document.body.removeChild(div);
    }

    if (watermark) {
      try {
        const wmImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = watermark;
        });

        ctx.globalAlpha = wmSettings.opacity;
        const wmSize = Math.min(canvas.width, canvas.height) * (wmSettings.size / 100);
        let wx = 0, wy = 0;
        switch(wmSettings.position) {
          case 'top-left': wx = 20; wy = 20; break;
          case 'top-right': wx = canvas.width - wmSize - 20; wy = 20; break;
          case 'bottom-left': wx = 20; wy = canvas.height - wmSize - 20; break;
          case 'bottom-right': wx = canvas.width - wmSize - 20; wy = canvas.height - wmSize - 20; break;
          case 'center': wx = (canvas.width - wmSize) / 2; wy = (canvas.height - wmSize) / 2; break;
        }
        ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
        ctx.globalAlpha = 1.0;
      } catch (e) {
        console.error("Failed to load watermark", e);
      }
    }

    return new Promise((resolve) => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  };

  const handleDownloadAllCombined = async () => {
    if (items.length === 0) return;

    const { allowed } = await checkAccess('Multi SVGA Combined Export');
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    if (currentUser) {
      logActivity(currentUser, 'export', \`SVGA Batch Export (\${items.length} files)\`);
    }

    setIsZipping(true);
    setExportProgress(0);
    
    try {
      const zip = new JSZip();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const baseName = item.name.replace(/\.[^/.]+$/, "");
        
        let parentPath = "";
        if (item.path) {
          const parts = item.path.split('/');
          parts.pop(); 
          if (parts.length > 0) {
            parentPath = parts.join('/') + '/';
          }
        }
        
        const result = await compressItemToImageSvga(item, {
          compressionQuality: 100,
          onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 50))
        });
        
        zip.file(parentPath + baseName + ".svga", result.svgaBlob);
        zip.file(parentPath + baseName + ".png", result.pngBlob);
        
        setExportProgress(Math.round(((i + 1) / items.length) * 50));
      }

      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => setExportProgress(50 + Math.round(metadata.percent / 2)));
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`SVGA_Compressed_Package_\${Date.now()}.zip\`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء التصدير: " + String(e));
    } finally {
      setIsZipping(false);
      setExportProgress(0);
    }
  };

`;

const match = content.match(startRegex);
const endMatch = content.match(endRegex);

if (match && endMatch) {
  const before = content.substring(0, match.index);
  const after = content.substring(endMatch.index);
  fs.writeFileSync('src/components/MultiSvgaViewer.tsx', before + newFunctions + after);
  console.log('Fixed');
} else {
  console.error('Could not find regexes');
}

