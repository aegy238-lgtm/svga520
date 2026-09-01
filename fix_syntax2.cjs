const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const errRegex = /bitrate = Math\.round\(originalBitrate \* \(1\.5 - \(cLevel \* 1\.4\)\)\); else \{[\s\S]*?\}/g;
code = code.replace(errRegex, `bitrate = Math.round(originalBitrate * (1.5 - (cLevel * 1.4)));`);

fs.writeFileSync(path, code);
