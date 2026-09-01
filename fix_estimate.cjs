const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /if \(compressionQuality === 100\).*?bitrate = originalBitrate \* \(compressionQuality \/ 85\);/g;

// check if the replace worked
if(code.includes('if (compressionQuality === 100)')) {
    code = code.replace(regex, `const cLevel = compressionLevel / 100;
    bitrate = originalBitrate * (1.5 - (cLevel * 1.4));`);
    fs.writeFileSync(path, code);
    console.log('Fixed estimate');
} else {
    console.log('Already fixed or not found');
}
