const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the CPU loop in handleExportMP4 (and preview/SVGA if we want to) with WebGL call
// First, we need to create the WebGL renderer instance inside the handleExport functions.

// Find handleExportSVGA
const handleExportSVGARegex = /const handleExportSVGA = async \(\) => \{([\s\S]*?)const rgbCanvas = document\.createElement\('canvas'\);/g;

code = code.replace(handleExportSVGARegex, (match, body) => {
    return \`const handleExportSVGA = async () => {\${body}
      let webglRenderer: WebGLVapRenderer | null = null;
      try {
        webglRenderer = new WebGLVapRenderer(origW, origH);
      } catch (e) {
        console.warn('WebGL not supported, falling back to CPU (will be slower)');
      }
      
      const rgbCanvas = document.createElement('canvas');\`;
});

// Find the CPU loop in SVGA
const cpuLoopSVGARegex = /const rgbData = rgbCtx\.getImageData[\s\S]*?rgbCtx\.putImageData\(compData, 0, 0\);/g;
code = code.replace(cpuLoopSVGARegex, \`
        if (webglRenderer) {
           const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
           rgbCtx.clearRect(0, 0, origW, origH);
           rgbCtx.drawImage(glCanvas, 0, 0);
        } else {
            const rgbData = rgbCtx.getImageData(0, 0, origW, origH);
            const alphaData = alphaCtx.getImageData(0, 0, origW, origH);
            const compositeImageData = rgbCtx.createImageData(origW, origH);
            const compData = compositeImageData.data;
            const rgbPixels = rgbData.data;
            const alphaPixels = alphaData.data;
            const pixelCount = origW * origH;
            const threshold = alphaThreshold;

            for (let p = 0; p < pixelCount; p++) {
              const idx = p * 4;
              
              const aR = alphaPixels[idx];
              const aG = alphaPixels[idx + 1];
              const aB = alphaPixels[idx + 2];

              const rawAlpha = Math.round(0.299 * aR + 0.587 * aG + 0.114 * aB);

              if (rawAlpha <= threshold) {
                compData[idx] = 0;
                compData[idx + 1] = 0;
                compData[idx + 2] = 0;
                compData[idx + 3] = 0;
              } else {
                let aVal = rawAlpha;
                if (aVal < 255) {
                  aVal = Math.min(255, Math.round(((rawAlpha - threshold) / (255 - threshold)) * 255));
                }
                const alphaRatio = aVal / 255;
                let r = rgbPixels[idx];
                let g = rgbPixels[idx + 1];
                let b = rgbPixels[idx + 2];
                if (unmultiplyAlpha && alphaRatio > 0.02) {
                  r = Math.min(255, Math.max(0, Math.round(r / alphaRatio)));
                  g = Math.min(255, Math.max(0, Math.round(g / alphaRatio)));
                  b = Math.min(255, Math.max(0, Math.round(b / alphaRatio)));
                }
                compData[idx] = r;
                compData[idx + 1] = g;
                compData[idx + 2] = b;
                compData[idx + 3] = aVal;
              }
            }
            rgbCtx.putImageData(compData, 0, 0);
        }
\`);

// Same for handleExportVAP (MP4)
const handleExportVAPRegex = /const handleExportVAP = async \(isStandardMP4: boolean = false\) => \{([\s\S]*?)let audioDataChunks: any\[\] = \[\];/g;
code = code.replace(handleExportVAPRegex, (match, body) => {
    return \`const handleExportVAP = async (isStandardMP4: boolean = false) => {\${body}
      let webglRenderer: WebGLVapRenderer | null = null;
      if (isStandardMP4) {
          try {
            webglRenderer = new WebGLVapRenderer(origW, origH);
          } catch (e) {
            console.warn('WebGL not supported');
          }
      }
      let audioDataChunks: any[] = [];\`;
});

const cpuLoopVAPRegex = /const rgbData = rgbCtx\.getImageData[\s\S]*?rgbCtx\.putImageData\(compData, 0, 0\);/g;
code = code.replace(cpuLoopVAPRegex, \`
            if (webglRenderer) {
                const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
                rgbCtx.clearRect(0, 0, origW, origH);
                rgbCtx.drawImage(glCanvas, 0, 0);
            } else {
                const rgbData = rgbCtx.getImageData(0, 0, origW, origH);
                const alphaData = alphaCtx.getImageData(0, 0, origW, origH);
                const compData = rgbCtx.createImageData(origW, origH);
                const dest = compData.data;
                const rgbPixels = rgbData.data;
                const alphaPixels = alphaData.data;
                const pixelCount = origW * origH;
                const threshold = alphaThreshold;

                for (let p = 0; p < pixelCount; p++) {
                  const idx = p * 4;
                  const aR = alphaPixels[idx];
                  const aG = alphaPixels[idx + 1];
                  const aB = alphaPixels[idx + 2];
                  const rawAlpha = Math.round(0.299 * aR + 0.587 * aG + 0.114 * aB);

                  if (rawAlpha <= threshold) {
                    dest[idx] = 0;
                    dest[idx + 1] = 0;
                    dest[idx + 2] = 0;
                    dest[idx + 3] = 0;
                  } else {
                    let aVal = rawAlpha;
                    if (aVal < 255) {
                      aVal = Math.min(255, Math.round(((rawAlpha - threshold) / (255 - threshold)) * 255));
                    }
                    const alphaRatio = aVal / 255;
                    let r = rgbPixels[idx];
                    let g = rgbPixels[idx + 1];
                    let b = rgbPixels[idx + 2];
                    if (unmultiplyAlpha && alphaRatio > 0.02) {
                      r = Math.min(255, Math.max(0, Math.round(r / alphaRatio)));
                      g = Math.min(255, Math.max(0, Math.round(g / alphaRatio)));
                      b = Math.min(255, Math.max(0, Math.round(b / alphaRatio)));
                    }
                    dest[idx] = r;
                    dest[idx + 1] = g;
                    dest[idx + 2] = b;
                    dest[idx + 3] = aVal;
                  }
                }
                rgbCtx.putImageData(compData, 0, 0);
            }
\`);

fs.writeFileSync(path, code);
console.log('Applied WebGL usage in export');
