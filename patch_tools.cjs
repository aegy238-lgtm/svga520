const fs = require('fs');
const file = './src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(file, 'utf8');

// replace all "duration: videoDuration > 0 ? videoDuration : undefined,"
// with "duration: (vapConfig?.info?.f && (vapConfig?.info?.fps || vapConfig?.info?.f)) ? (vapConfig.info.f / (vapConfig.info.fps || 24)) : (videoDuration > 0 ? videoDuration : undefined),"

const replacement = 'duration: (vapConfig?.info?.f && (vapConfig?.info?.fps || 24)) ? (vapConfig.info.f / (vapConfig.info.fps || 24)) : (videoDuration > 0 ? videoDuration : undefined),';

code = code.replaceAll('duration: videoDuration > 0 ? videoDuration : undefined,', replacement);
fs.writeFileSync(file, code);
console.log('Successfully patched UniversalMotionTools.tsx');
