const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const regexLoopVAP = /if \(rgbCtx && alphaCtx && rgbCanvas && alphaCanvas\) \{\s*rgbCtx\.clearRect\(0, 0, origW, origH\);\s*rgbCtx\.drawImage\(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, origW, origH\);\s*alphaCtx\.clearRect\(0, 0, origW, origH\);\s*alphaCtx\.drawImage\(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, origW, origH\);\s*const rgbData = rgbCtx\.getImageData\([\s\S]*?rgbCtx\.putImageData\(compData, 0, 0\);/g;

code = code.replace(regexLoopVAP, (match) => {
    return `if (rgbCtx && alphaCtx && rgbCanvas && alphaCanvas) {
            if (webglRenderer) {
                if (webglRenderer.canvas.width !== origW) {
                    webglRenderer = new WebGLVapRenderer(origW, origH);
                }
                const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
                rgbCtx.clearRect(0, 0, origW, origH);
                rgbCtx.drawImage(glCanvas, 0, 0);
            } else {
                rgbCtx.clearRect(0, 0, origW, origH);
                rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, origW, origH);
                alphaCtx.clearRect(0, 0, origW, origH);
                alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, origW, origH);
                
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
            }`;
});

fs.writeFileSync(path, code);
console.log('Fixed VAP loop');
