const fs = require('fs');
let code = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

code = code.replace(/itemsToExport\.length/g, '(itemsToExport as any[]).length');
code = code.replace(/itemsToExport\.map/g, '(itemsToExport as any[]).map');

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', code);
