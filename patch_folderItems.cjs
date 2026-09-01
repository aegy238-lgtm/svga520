const fs = require('fs');
let code = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

code = code.replace(/folderItems\.length/g, '(folderItems as any[]).length');
code = code.replace(/folderItems\.map/g, '(folderItems as any[]).map');

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', code);
