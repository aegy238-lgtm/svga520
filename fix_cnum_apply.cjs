const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const oldLine = /const cnum = compressionQuality >= 95 \? 0 : Math\.max\(16, Math\.min\(256, Math\.round\(qualityRatio \* 256\)\)\);/g;
if(code.match(oldLine)) {
    code = code.replace(oldLine, `const cnum = compressionLevel === 0 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));`);
    fs.writeFileSync(path, code);
    console.log('Fixed UPNG cnum string');
}

// Ensure the UI is rendered correctly in the browser
