const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// 1. Update onDrop to support directories
const onDropRegex = /const onDrop = useCallback\(\(e: React\.DragEvent\) => \{[\s\S]*?\}, \[handleFiles\]\);/;
const newOnDrop = `
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const items = e.dataTransfer.items;
      setLoadProgress({ current: 0, total: 1 });
      const filesToProcess: File[] = [];
      let totalEntries = 0;
      let processedEntries = 0;
      
      const traverseFileTree = async (item: any, path: string = '') => {
        if (!item) return;
        if (item.isFile) {
          totalEntries++;
          const file = await new Promise<File>((resolve) => item.file(resolve));
          if (file.name.toLowerCase().endsWith('.svga') || file.name.toLowerCase().endsWith('.pag')) {
            Object.defineProperty(file, 'customPath', { value: path + file.name, writable: false });
            filesToProcess.push(file);
          }
          processedEntries++;
          setLoadProgress({ current: processedEntries, total: Math.max(totalEntries, 1) });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          const entries = await new Promise<any[]>((resolve) => {
            const results: any[] = [];
            const readAll = () => {
              dirReader.readEntries((entries: any[]) => {
                if (entries.length === 0) resolve(results);
                else { results.push(...entries); readAll(); }
              });
            };
            readAll();
          });
          for (const entry of entries) {
             await traverseFileTree(entry, path + item.name + '/');
          }
        }
      };

      const promises = [];
      for (let i = 0; i < items.length; i++) {
         const item = items[i].webkitGetAsEntry();
         if (item) promises.push(traverseFileTree(item));
      }
      
      await Promise.all(promises);
      setLoadProgress(null);
      if (filesToProcess.length > 0) {
        handleFiles(filesToProcess);
      }
    } else if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);
`;
content = content.replace(onDropRegex, newOnDrop);

// 2. Update handleFiles to handle .svga and .pag and be more responsive
const handleFilesRegex = /const handleFiles = useCallback\(async \(files: FileList \| File\[\]\) => \{[\s\S]*?setLoadProgress\(null\);\s*\}, \[\]\);/;
const newHandleFiles = `
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => {
       const name = (f?.name || '').toLowerCase();
       return name.endsWith('.svga') || name.endsWith('.pag');
    });
    if (fileArray.length === 0) return;
    
    setLoadProgress({ current: 0, total: fileArray.length });
    isCanceled.current = false;
    
    // Use smaller batch size and longer wait to prevent UI freezing
    const BATCH_SIZE = 10;
    for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
      if (isCanceled.current) break;
      const batch = fileArray.slice(i, i + BATCH_SIZE);
      const newItems: MultiSvgaItem[] = batch.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        path: (file as any).customPath || file.webkitRelativePath || "",
        size: file.size,
        type: file.name.toLowerCase().endsWith('.pag') ? 'pag' : 'svga',
        presetId: 'auto'
      }));
      
      setItems(prev => [...prev, ...newItems]);
      setLoadProgress({ current: Math.min(i + BATCH_SIZE, fileArray.length), total: fileArray.length });
      await new Promise(r => setTimeout(r, 50));
    }
    setLoadProgress(null);
  }, []);
`;
content = content.replace(handleFilesRegex, newHandleFiles);

// 3. Fix handleDownloadAllCombined ZIP structure
const downloadCombinedRegex = /const handleDownloadAllCombined = async \(\) => \{[\s\S]*?URL\.revokeObjectURL\(url\);\s*\} catch \(e\) \{/
const newDownloadCombined = `
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
        
        // Put each SVGA and its image in a folder named after the file
        const itemFolder = parentPath + baseName + "/";
        
        if (item.type === "pag") {
          const result = await convertPagToSvga(item.file, { targetFps: item.fps || 30, compressionQuality: 100, onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 50)) });
          zip.file(itemFolder + baseName + ".svga", result.svgaBlob);
        } else {
          zip.file(itemFolder + baseName + ".svga", item.file);
        }
        
        const blob = await captureFrame(item, Math.floor((item.frames || 1) / 2));
        zip.file(itemFolder + baseName + ".png", blob);
        setExportProgress(Math.round(((i + 1) / items.length) * 50));
      }

      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => setExportProgress(50 + Math.round(metadata.percent / 2)));
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`SVGA_Organized_Export_\${Date.now()}.zip\`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
`;
content = content.replace(downloadCombinedRegex, newDownloadCombined);

// 4. Style the button to be distinct
const buttonRegex = /<button \s*onClick=\{handleDownloadAllCombined\}[\s\S]*?\{isZipping \? \`جاري التحضير \$\{exportProgress\}%\` : 'تنزيل الكل \(SVGA \+ صور\)'\}\s*<\/button>/;
const newButton = `
              <button 
                onClick={handleDownloadAllCombined}
                disabled={isZipping || isExporting}
                className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-2xl shadow-xl shadow-orange-600/30 font-black text-sm transition-all flex items-center gap-3 disabled:opacity-50 border border-orange-400/30 w-full md:w-auto transform hover:scale-105 active:scale-95"
              >
                {isZipping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                {isZipping ? \`جاري الضغط والتجهيز \${exportProgress}%\` : 'تصدير مجلدات منظمة (صورة + SVGA)'}
              </button>
`;
content = content.replace(buttonRegex, newButton);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content);
