const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const effectBlock = `  // Background Throttling Prevention
  const [silentAudio] = useState(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.loop = true;
    return audio;
  });

  useEffect(() => {
    if (isExporting) {
      silentAudio.play().catch(() => {});
    } else {
      silentAudio.pause();
    }
  }, [isExporting, silentAudio]);`;

// Remove it from its current position
code = code.replace(effectBlock, '');

// Place it right after isExporting declaration
const exportState = `const [isExporting, setIsExporting] = useState<boolean>(false);`;
code = code.replace(exportState, exportState + '\n\n' + effectBlock);

fs.writeFileSync(path, code);
console.log('Fixed initialization order');
