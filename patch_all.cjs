const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// 1. Interface
content = content.replace(/name: string;\n\s*size: number;/, "name: string;\n  path?: string;\n  size: number;");

// 2. handleFiles path property (around line 156-164)
content = content.replace(
  "name: file.name,\n        size: file.size,",
  "name: file.name,\n        path: (file as any).customPath || file.webkitRelativePath || \"\",\n        size: file.size,"
);

// 3. onDrop sync (we will use regex to find onDrop)
const onDropReplacement = `  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items) as DataTransferItem[];
      const allFiles: File[] = [];
      
      const traverseFileTree = (item: any, path = ""): Promise<File[]> => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              Object.defineProperty(file, 'customPath', { value: path });
              resolve([file]);
            });
          } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const files: File[] = [];
            const readEntries = () => {
              dirReader.readEntries(async (entries: any[]) => {
                if (entries.length === 0) {
                  resolve(files);
                } else {
                  for (const entry of entries) {
                    const entryFiles = await traverseFileTree(entry, path + item.name + "/");
                    files.push(...entryFiles);
                  }
                  readEntries();
                }
              });
            };
            readEntries();
          } else {
            resolve([]);
          }
        });
      };
      
      const entries: any[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = (item as any).webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }
      }
      
      for (const entry of entries) {
        const files = await traverseFileTree(entry);
        allFiles.push(...files);
      }
      
      if (allFiles.length > 0) {
        handleFiles(allFiles);
      }
    } else if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles]);`;

content = content.replace(/  const onDrop = useCallback\(async \(e: React\.DragEvent\) => \{[\s\S]*?  \}, \[handleFiles\]\);/, onDropReplacement);

// 4. captureFrame replacement
const captureFrameRegex = /  const captureFrame = async \(item: MultiSvgaItem, frameIndex: number = 0\): Promise<Blob> => \{[\s\S]*?    \} finally \{\n      document\.body\.removeChild\(div\);\n    \}\n  \};\n/g;

const newCaptureFrame = `  const captureFrame = async (item: MultiSvgaItem, frameIndex: number = 0): Promise<Blob> => {
    if (!item.dimensions) item.dimensions = { width: 500, height: 500 };
    
    const canvas = document.createElement('canvas');
    const dw = selectedPreset ? selectedPreset.width : item.dimensions.width;
    const dh = selectedPreset ? selectedPreset.height : item.dimensions.height;
    canvas.width = dw;
    canvas.height = dh;
    
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
      div.style.width = \`\${item.dimensions.width}px\`;
      div.style.height = \`\${item.dimensions.height}px\`;
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
        if (items.length > 50) {
           item.videoItem = undefined;
        }
      } finally {
        document.body.removeChild(div);
      }
    }
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png");
    });
  };
`;

content = content.replace(captureFrameRegex, newCaptureFrame);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content, 'utf8');
