const fs = require('fs');
const file = './src/utils/vapFFmpeg.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `      if (audioFile && !options?.mute) {
          await ff.writeFile(audioName, await fetchFile(audioFile));
          if (options?.duration && options.duration > 0) {
            args.push('-t', options.duration.toFixed(3));
          }
          args.push('-i', audioName);
          args.push('-map', '0:v:0');
          args.push('-map', '1:a:0');
          args.push('-c:v', 'copy');
          args.push('-c:a', 'aac');
          if (options?.volume !== undefined && options.volume !== 1.0) {
            args.push('-af', \`volume=\${Math.max(0, Math.min(options.volume, 5.0)).toFixed(2)}\`);
          }
          args.push('-b:a', '192k');
          args.push('-ar', '44100');
          args.push('-ac', '2');
          args.push('-shortest');
          args.push('-movflags', '+faststart');`;

const replacement = `      if (audioFile && !options?.mute) {
          await ff.writeFile(audioName, await fetchFile(audioFile));
          if (options?.duration && options.duration > 0) {
            args.push('-t', options.duration.toFixed(3));
          }
          args.push('-i', audioName);
          args.push('-map', '0:v:0');
          args.push('-map', '1:a:0');
          args.push('-c:v', 'copy');
          args.push('-c:a', 'aac');
          if (options?.volume !== undefined && options.volume !== 1.0) {
            args.push('-af', \`volume=\${Math.max(0, Math.min(options.volume, 5.0)).toFixed(2)}\`);
          }
          args.push('-b:a', '192k');
          args.push('-ar', '44100');
          args.push('-ac', '2');
          
          if (!options?.duration || options.duration <= 0) {
             args.push('-shortest');
          }
          args.push('-movflags', '+faststart');`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(file, code);
    console.log('Successfully patched vapFFmpeg.ts');
} else {
    console.log('Target not found in vapFFmpeg.ts');
}
