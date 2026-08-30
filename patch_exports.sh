#!/bin/bash
sed -i '687,691c\
    for (let i = 0; i < items.length; i++) {\
      const item = items[i];\
      if (item.type === "pag") {\
        const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 100)) });\
        folder?.file(item.name.replace(/\\.[^/.]+$/, "") + ".svga", result.svgaBlob);\
      } else {\
        folder?.file(item.name, item.file);\
        setExportProgress(Math.round(((i + 1) / items.length) * 100));\
      }\
    }\
' src/components/MultiSvgaViewer.tsx

sed -i '719,723c\
    for (let i = 0; i < items.length; i++) {\
      const item = items[i];\
      if (item.type === "pag") {\
        const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 100)) });\
        svgaFolder?.file(item.name.replace(/\\.[^/.]+$/, "") + ".svga", result.svgaBlob);\
      } else {\
        svgaFolder?.file(item.name, item.file);\
      }\
      const blob = await captureFrame(item, Math.floor(item.frames / 2));\
      imgFolder?.file(item.name.replace(/\\.[^/.]+$/, "") + ".png", blob);\
      setExportProgress(Math.round(((i + 1) / items.length) * 100));\
    }\
' src/components/MultiSvgaViewer.tsx
