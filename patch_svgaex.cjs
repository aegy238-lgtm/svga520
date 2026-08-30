const fs = require('fs');
const content = fs.readFileSync('src/utils/svgaExExport.ts', 'utf8');
const newContent = content.replace(
  /const extension =[\s\S]*?: "\.mp3";\s*const audioKey = "quantum_audio_ex" \+ extension;/g,
  'const audioKey = "quantum_audio_ex.mp3"; // Force .mp3 extension for official platform compatibility'
);
fs.writeFileSync('src/utils/svgaExExport.ts', newContent);
