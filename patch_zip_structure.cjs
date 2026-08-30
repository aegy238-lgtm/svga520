const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// Change `const itemFolder = parentPath + baseName + "/";` to `const itemFolder = parentPath;`
const target = 'const itemFolder = parentPath + baseName + "/";';
const replacement = 'const itemFolder = parentPath;';

content = content.replace(target, replacement);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content);
