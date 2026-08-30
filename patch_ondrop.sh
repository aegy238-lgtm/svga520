cat << 'INNER_EOF' > /tmp/replacement_ondrop.txt
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      const allFiles: File[] = [];
      
      const traverseFileTree = (item: any, path = ""): Promise<File[]> => {
        return new Promise((resolve) => {
          if (item.isFile) {
            item.file((file: File) => resolve([file]));
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
      
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const files = await traverseFileTree(entry);
            allFiles.push(...files);
          }
        }
      }
      if (allFiles.length > 0) {
        handleFiles(allFiles);
      }
    } else if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, [handleFiles]);
INNER_EOF

# Replace lines 172-178
awk '
NR==172 {
  system("cat /tmp/replacement_ondrop.txt")
  skip=1
}
NR==179 {
  skip=0
}
!skip { print }
' src/components/MultiSvgaViewer.tsx > temp.tsx && mv temp.tsx src/components/MultiSvgaViewer.tsx

