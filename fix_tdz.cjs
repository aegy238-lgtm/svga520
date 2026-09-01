const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// Extract the blocks using regex or string splitting
const previewModalStateStart = `  // Preview Modal State`;
const previewModalStateEnd = `  const previewCanvasRef = useRef<HTMLCanvasElement>(null);`;

const effectStart = `  // Render Preview Frame`;
const effectEndRegex = /useEffect\(\(\) => \{[\s\S]*?\}, \[.*?\]\);/;

const estimateStart = `  // Estimate File Size`;
const estimateEndRegex = /const estimateFileSize = \(\) => \{[\s\S]*?return \(estimatedSizeInBytes \/ \(1024 \* 1024\)\)\.toFixed\(1\) \+ ' MB';\n  \};/;

// Let's just find them and replace them with empty string
let effectMatch = code.match(effectEndRegex);
let estimateMatch = code.match(estimateEndRegex);

if (effectMatch && estimateMatch) {
    let effectCode = effectMatch[0];
    let estimateCode = estimateMatch[0];
    
    // Remove the blocks
    code = code.replace(previewModalStateStart + '\n  const [showLivePreview, setShowLivePreview] = useState(false);\n  const previewCanvasRef = useRef<HTMLCanvasElement>(null);', '');
    code = code.replace(`  // Render Preview Frame\n` + effectCode, '');
    code = code.replace(`  // Estimate File Size\n` + estimateCode, '');
    
    // Now re-insert them right before `const extractVapConfig`
    const insertPoint = `  // Extract VAP configuration from MP4 vapc box`;
    
    const blockToInsert = `
  // Preview Modal State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Preview Frame
  ${effectCode}

  // Estimate File Size
  ${estimateCode}

`;
    
    code = code.replace(insertPoint, blockToInsert + insertPoint);
    
    fs.writeFileSync(path, code);
    console.log('Fixed TDZ successfully');
} else {
    console.log('Could not find matches');
    if (!effectMatch) console.log('effectMatch failed');
    if (!estimateMatch) console.log('estimateMatch failed');
}
