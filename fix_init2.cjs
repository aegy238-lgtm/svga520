const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Extract // Render Preview Frame block
let previewIdx = code.indexOf('  // Render Preview Frame');
let estimateIdx = code.indexOf('  // Estimate File Size');

// Both were added in the previous patch. The estimateFileSize was modified to be below it. 
// But wait, estimateFileSize was added near `activeTooltip` originally.
// The effect block starts at `  // Render Preview Frame` and ends before `  // Estimate File Size`.

// Actually, let's just use regex or manual string extraction.
const estimateBlockStart = code.indexOf('  // Estimate File Size');
const estimateBlockEndSearch = `    return (estimatedSizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';\n  };`;
const estimateBlockEnd = code.indexOf(estimateBlockEndSearch) + estimateBlockEndSearch.length;
const estimateBlock = code.substring(estimateBlockStart, estimateBlockEnd);

const previewBlockStart = code.indexOf('  // Render Preview Frame');
const previewBlockEndSearch = `}, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);`;
const previewBlockEnd = code.indexOf(previewBlockEndSearch) + previewBlockEndSearch.length;
const previewBlock = code.substring(previewBlockStart, previewBlockEnd);

// Remove them from their current positions
code = code.replace(estimateBlock, '');
code = code.replace(previewBlock, '');

// Place them after cancelExportRef
const targetSearch = `const cancelExportRef = useRef<boolean>(false);`;
code = code.replace(targetSearch, targetSearch + '\n\n' + estimateBlock + '\n\n' + previewBlock);

fs.writeFileSync(path, code);
console.log('Fixed initialization order 2');
