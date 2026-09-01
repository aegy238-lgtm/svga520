cat << 'INNER_EOF' > /tmp/replacement_capture3.txt
  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
    if (!item.dimensions) item.dimensions = { width: 500, height: 500 };
    
    const canvas = document.createElement('canvas');
    const dw = selectedPreset ? selectedPreset.width : item.dimensions.width;
    const dh = selectedPreset ? selectedPreset.height : item.dimensions.height;
    canvas.width = dw;
    canvas.height = dh;
    
    // Create context ONCE with alpha: true
    const ctx = canvas.getContext('2d', { alpha: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (item.type === "pag") {
      let pagFile = item.pagFile;
      if (!pagFile) {
        try {
          const PAG = await getPAG();
          pagFile = await PAG.PAGFile.load(await item.file.arrayBuffer());
          item.pagFile = pagFile;
        } catch (e) {
          console.error("PAG load error", e);
          throw e;
        }
      }
      
      const PAG = await getPAG();
      const pagView = await PAG.PAGView.init(pagFile, canvas);
      const framesToJump = frameIndex || Math.floor((item.frames || 1) / 2);
      
      const duration = pagFile.duration();
      const targetTime = (framesToJump / (item.fps || 30)) * 1000000;
      pagView.setProgress(targetTime / duration);
      await pagView.flush();
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
      
      pagView.destroy();
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const sw = pagFile.width();
      const sh = pagFile.height();
      const scale = Math.min(dw / sw, dh / sh);
      const finalW = sw * scale;
      const finalH = sh * scale;
      const x = (dw - finalW) / 2;
      const y = (dh - finalH) / 2;
      
      ctx.drawImage(tempCanvas, x, y, finalW, finalH);
    } else {
      const videoItem = await parseSvgaIfNeeded(item);
      
      const div = document.createElement('div');
      div.style.width = `${item.dimensions.width}px`;
      div.style.height = `${item.dimensions.height}px`;
      div.style.position = 'fixed';
      div.style.left = '0px';
      div.style.top = '0px';
      div.style.opacity = '0.001';
      div.style.pointerEvents = 'none';
      div.style.backgroundColor = 'transparent';
      div.style.zIndex = '-9999';
      document.body.appendChild(div);
      
      try {
        const player = new SVGA.Player(div);
        player.clearsAfterStop = false;
        
        let framesToJump = frameIndex;
        if (frameIndex === 0 && item.frames) {
          framesToJump = Math.floor(item.frames / 2);
        }

        await new Promise<void>((resolve) => {
          player.setVideoItem(videoItem);
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
          }, 150); // reduced from 500ms to 150ms to speed up batch export
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
        
        if (items.length > 50) {
           item.videoItem = undefined;
        }
      } finally {
        document.body.removeChild(div);
      }
    }
INNER_EOF

# Find start and end
START_LINE=$(grep -n "const captureFrame = async (item: MultiSvgaItem" src/components/MultiSvgaViewer.tsx | cut -d: -f1)
END_LINE=$(grep -n "// Draw Watermark" src/components/MultiSvgaViewer.tsx | cut -d: -f1 | head -n 1)

awk -v start="$START_LINE" -v end="$END_LINE" '
NR==start {
  system("cat /tmp/replacement_capture3.txt")
  skip=1
}
NR==end {
  skip=0
}
!skip { print }
' src/components/MultiSvgaViewer.tsx > temp.tsx && mv temp.tsx src/components/MultiSvgaViewer.tsx

