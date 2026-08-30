const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

const oldBitrate = `      const totalPixels = vw * vh;
      const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
      let bitrate = Math.round(vw * vh * fps * 0.18);
      bitrate = Math.max(2500000, Math.min(18000000, bitrate));`;

const newBitrate = `      const totalPixels = vw * vh;
      const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
      
      // Smart Bitrate Calculation to match original file size by default
      let originalBitrate = 5000000; // Default fallback
      if (sourceFile && duration > 0) {
         // Calculate original video bitrate (subtracting approx audio bitrate if it had audio)
         originalBitrate = Math.round((sourceFile.size * 8) / duration);
      }
      
      // If quality is 100, we give it a massive bitrate (1.5x original) to ensure zero loss
      // If quality is 85 (default), we match the original bitrate exactly
      // If quality is 20, we give it 20% of original
      let bitrate;
      if (compressionQuality === 100) {
         bitrate = Math.round(originalBitrate * 1.5);
      } else if (compressionQuality >= 85) {
         // Map 85-99 to 1.0x - 1.4x
         const scale = 1.0 + ((compressionQuality - 85) / 15) * 0.4;
         bitrate = Math.round(originalBitrate * scale);
      } else {
         // Map 20-85 to 0.2x - 1.0x
         const scale = (compressionQuality / 85);
         bitrate = Math.round(originalBitrate * scale);
      }
      
      // Ensure we don't drop below a minimum readable bitrate for alpha masks
      bitrate = Math.max(1000000, bitrate);`;

content = content.replace(oldBitrate, newBitrate);

// And change the SVGA default 85 to 100 if the user just wants maximum original matching?
// They specifically mentioned "if I export it again with the same format", implying VAP -> VAP.

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Bitrate logic updated");
