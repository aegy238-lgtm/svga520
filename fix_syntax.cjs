const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /bitrate = Math\.round\(originalBitrate \* \(1\.5 - \(cLevel \* 1\.4\)\)\); else \{[\s\S]*?bitrate = Math\.round\(originalBitrate \* scale\);\n\s*\}/g;

code = code.replace(regex, `bitrate = Math.round(originalBitrate * (1.5 - (cLevel * 1.4)));`);

fs.writeFileSync(path, code);
console.log('Fixed syntax error');
