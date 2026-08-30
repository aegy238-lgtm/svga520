const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// The exact strings to remove
const previewModalStateStr = `  // Preview Modal State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);`;

// Find // Render Preview Frame
const effectStartIdx = code.indexOf('  // Render Preview Frame');
const effectEndStr = '  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);';
const effectEndIdx = code.indexOf(effectEndStr, effectStartIdx) + effectEndStr.length;
const effectStr = code.substring(effectStartIdx, effectEndIdx);

// Find // Estimate File Size
const estimateStartIdx = code.indexOf('  // Estimate File Size');
const estimateEndStr = `    return (estimatedSizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';\n  };`;
const estimateEndIdx = code.indexOf(estimateEndStr, estimateStartIdx) + estimateEndStr.length;
const estimateStr = code.substring(estimateStartIdx, estimateEndIdx);

if (effectStartIdx > -1 && estimateStartIdx > -1) {
    code = code.replace(previewModalStateStr + '\n', '');
    code = code.replace(effectStr + '\n', '');
    code = code.replace(estimateStr + '\n', '');
    
    // Now insert them properly
    const insertPoint = `  // Extract VAP configuration from MP4 vapc box`;
    
    const blockToInsert = `${previewModalStateStr}\n\n${effectStr}\n\n${estimateStr}\n\n`;
    
    code = code.replace(insertPoint, blockToInsert + insertPoint);
    
    fs.writeFileSync(path, code);
    console.log('Fixed TDZ safely');
} else {
    console.log('Could not find strings');
}
