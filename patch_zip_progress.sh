cat << 'INNER_EOF' > /tmp/replacement_zip_progress.txt
      const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setExportProgress(Math.round(metadata.percent));
      });
INNER_EOF

sed -i 's/const content = await zip.generateAsync({ type: "blob" });/const content = await zip.generateAsync({ type: "blob" }, (metadata) => setExportProgress(Math.round(metadata.percent)));/g' src/components/MultiSvgaViewer.tsx
