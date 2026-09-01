cat << 'INNER_EOF' > /tmp/replacement_ondrop_sync.txt
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items) as DataTransferItem[];
      const allFiles: File[] = [];
      
      const traverseFileTree = (item: any, path = ""): Promise<File[]> => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file: File) => {
              // Add a property path so we could use it if needed, though name is fine
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
      
      // EXTREMELY IMPORTANT: Extract all entries synchronously first
      const entries: any[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = (item as any).webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }
      }
      
      // Then process them asynchronously
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
  }, [handleFiles]);
INNER_EOF

awk '
NR==172 {
  system("cat /tmp/replacement_ondrop_sync.txt")
  skip=1
}
NR==222 {
  skip=0
}
!skip { print }
' src/components/MultiSvgaViewer.tsx > temp.tsx && mv temp.tsx src/components/MultiSvgaViewer.tsx

