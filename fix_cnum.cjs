const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /const cnum = compressionLevel === 0 \? 0 : Math\.max\(16, Math\.min\(256, Math\.round\(qualityRatio \* 256\)\)\);/g;
if(code.includes('const cnum = compressionLevel === 0 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));')) {
    // If qualityRatio goes from 1.0 (no comp) to 0.1 (max comp)
    // Then cnum goes from 256 (no comp) to 25 (max comp)
    // This is correct. UPNG max colors is 256.
    console.log('UPNG cnum logic is correct');
} else {
    // Maybe we didn't replace it correctly
    const oldRegex = /const cnum = compressionQuality >= 95 \? 0 : Math\.max\(16, Math\.min\(256, Math\.round\(qualityRatio \* 256\)\)\);/g;
    if(code.match(oldRegex)) {
        code = code.replace(oldRegex, `const cnum = compressionLevel === 0 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));`);
        fs.writeFileSync(path, code);
        console.log('Fixed UPNG cnum');
    }
}
