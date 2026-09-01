const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// The duplicate section starts with `// Preview Modal State` and ends before `// Extract VAP configuration from MP4 vapc box`
const startMarker = `  // Preview Modal State`;
const endMarker = `  // Extract VAP configuration from MP4 vapc box`;

const startIndex = code.lastIndexOf(startMarker);
const endIndex = code.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const chunkToRemove = code.substring(startIndex, endIndex);
    code = code.replace(chunkToRemove, '');
    
    // Now we need to move the REAL showLivePreview and estimateFileSize down.
    // They are currently up near the top. Let's find them.
    const realPreviewStart = code.indexOf(`  // Preview Modal State`);
    const realEstimateStart = code.indexOf(`  // Estimate File Size`);
    const realEffectStart = code.indexOf(`  // Render Preview Frame`);
    
    // We'll just clean up the file manually by replacing the bad parts.
    fs.writeFileSync(path, code);
    console.log('Removed bad chunk at end');
} else {
    console.log('Could not find chunk');
}
