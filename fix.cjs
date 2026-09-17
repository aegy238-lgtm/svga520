const fs = require('fs');
let content = fs.readFileSync('src/utils/ffmpegLoader.ts', 'utf8');
content = content.replace(/const localBase[\s\S]*?cdnBases = \[\s*localBase,/g, 'const cdnBases = [');
content = content.replace(/const timeoutMs = base === localBase \? 15000 : 30000;/g, 'const timeoutMs = 30000;');
content = content.replace(/المحلية/g, '');
fs.writeFileSync('src/utils/ffmpegLoader.ts', content);
