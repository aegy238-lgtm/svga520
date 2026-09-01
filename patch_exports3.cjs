const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

const regex = /  const handleDownloadAllImages = async \(\) => \{[\s\S]*?  const handleDownloadSingleImage = async \(item: MultiSvgaItem\) => \{/g;

const newExports = `  const handleDownloadAllImages = async () => {
    if (items.length === 0) return;

    const { allowed } = await checkAccess('Multi SVGA Images Export');
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    
    if (currentUser) {
      logActivity(currentUser, 'export', \`Multi SVGA ZIP Export: \${items.length} files\`);
    }
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("SVGA_Screenshots");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let parentPath = "";
        if (item.path) {
          const parts = item.path.split('/');
          parts.pop();
          if (parts.length > 0) {
            parentPath = parts.join('/') + '/';
          }
        }
        const baseName = item.name.replace(/\\.[^/.]+$/, "");
        
        const blob = await captureFrame(item, Math.floor((item.frames || 1) / 2));
        folder?.file(\`\${parentPath}\${baseName}.png\`, blob);
        setExportProgress(Math.round(((i + 1) / items.length) * 100));
      }

      const content = await zip.generateAsync({ type: "blob" }, (metadata) => setExportProgress(Math.round(metadata.percent)));
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`SVGA_Images_\${Date.now()}.zip\`;
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

  const handleDownloadAllSvga = async () => {
    if (items.length === 0) return;

    const { allowed } = await checkAccess('Multi SVGA Files Export');
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    
    if (currentUser) {
      logActivity(currentUser, 'export', \`Multi SVGA Files Export: \${items.length} files\`);
    }
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("SVGA_Files");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let parentPath = "";
        if (item.path) {
          const parts = item.path.split('/');
          parts.pop();
          if (parts.length > 0) {
            parentPath = parts.join('/') + '/';
          }
        }
        const baseName = item.name.replace(/\\.[^/.]+$/, "");
        
        if (item.type === "pag") {
          const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 100)) });
          folder?.file(parentPath + baseName + ".svga", result.svgaBlob);
        } else {
          folder?.file(parentPath + baseName + ".svga", item.file);
          setExportProgress(Math.round(((i + 1) / items.length) * 100));
        }
      }

      const content = await zip.generateAsync({ type: "blob" }, (metadata) => setExportProgress(Math.round(metadata.percent)));
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`SVGA_Files_\${Date.now()}.zip\`;
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

  const handleDownloadAllCombined = async () => {
    if (items.length === 0) return;

    const { allowed } = await checkAccess('Multi SVGA Combined Export', { subscriptionOnly: true });
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsZipping(true);
    setExportProgress(0);
    
    try {
      const zip = new JSZip();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const baseName = item.name.replace(/\\.[^/.]+$/, "");
        
        let parentPath = "";
        if (item.path) {
          const parts = item.path.split('/');
          parts.pop(); // remove file name
          if (parts.length > 0) {
            parentPath = parts.join('/') + '/';
          }
        }
        
        if (item.type === "pag") {
          const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 100)) });
          zip.file(parentPath + baseName + ".svga", result.svgaBlob);
        } else {
          zip.file(parentPath + baseName + ".svga", item.file);
        }
        const blob = await captureFrame(item, Math.floor((item.frames || 1) / 2));
        zip.file(parentPath + baseName + ".png", blob);
        setExportProgress(Math.round(((i + 1) / items.length) * 100));
      }

      const content = await zip.generateAsync({ type: "blob" }, (metadata) => setExportProgress(Math.round(metadata.percent)));
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`SVGA_Full_Package_\${Date.now()}.zip\`;
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

  const handleDownloadSingleImage = async (item: MultiSvgaItem) => {`;

content = content.replace(regex, newExports);
fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content, 'utf8');
