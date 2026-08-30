#!/bin/bash
sed -i '772,782c\
  const handleDownloadSvga = async (item: MultiSvgaItem) => {\
    if (currentUser) {\
      logActivity(currentUser, "export", `Single SVGA/PAG File Download: ${item.name}`);\
    }\
    let url = "";\
    let downloadName = item.name;\
    if (item.type === "pag") {\
      setIsExporting(true);\
      try {\
        const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(p) });\
        url = URL.createObjectURL(result.svgaBlob);\
        downloadName = item.name.replace(/\\.[^/.]+$/, "") + ".svga";\
      } catch (e) {\
        console.error(e);\
        alert("Failed to convert");\
        setIsExporting(false);\
        return;\
      }\
      setIsExporting(false);\
    } else {\
      url = URL.createObjectURL(item.file);\
    }\
    const a = document.createElement("a");\
    a.href = url;\
    a.download = downloadName;\
    a.click();\
    URL.revokeObjectURL(url);\
  };\
' src/components/MultiSvgaViewer.tsx
