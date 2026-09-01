const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// We'll replace the progress logic inside handleDownloadAllCombined
content = content.replace(
  /setExportProgress\(Math\.round\(\(\(i \+ 1\) \/ items\.length\) \* 100\)\);/g,
  "setExportProgress(Math.round(((i + 1) / items.length) * 50));"
);

content = content.replace(
  /const content = await zip\.generateAsync\(\{ type: "blob" \}, \(metadata\) => setExportProgress\(Math\.round\(metadata\.percent\)\)\);/g,
  "const content = await zip.generateAsync({ type: 'blob' }, (metadata) => setExportProgress(50 + Math.round(metadata.percent / 2)));"
);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content, 'utf8');
