const fs = require('fs');
let code = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

code = code.replace(/item\.webkitGetAsEntry\(\)/g, '(item as any).webkitGetAsEntry()');
code = code.replace(/items\.length/g, '(items as any[]).length');
code = code.replace(/items\.map/g, '(items as any[]).map');

// Actually let's just use any for `items` inside the drop handler.
fs.writeFileSync('src/components/MultiSvgaViewer.tsx', code);
