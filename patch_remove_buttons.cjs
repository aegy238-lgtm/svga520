const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// Remove handleDownloadAllImages and handleDownloadAllSvga buttons
const buttonsRegex = /<button[\s\S]*?onClick=\{handleDownloadAllImages\}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick=\{handleDownloadAllSvga\}[\s\S]*?<\/button>/;

content = content.replace(buttonsRegex, '');

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content);
