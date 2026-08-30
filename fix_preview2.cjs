const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const previewRegex = /function drawPreviewBlend\(\) \{/g;
code = code.replace(previewRegex, `function drawPreviewBlend() {
          let webglRenderer: WebGLVapRenderer | null = null;
          try {
             webglRenderer = new WebGLVapRenderer(cfgW, cfgH);
          } catch(e) {}`);

const previewLoopRegex = /const rgbData = rgbCtx\.getImageData\([\s\S]*?rgbCtx\.putImageData\(compData, 0, 0\);/g;
code = code.replace(previewLoopRegex, (match) => {
    return `
          if (webglRenderer) {
             const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
             rgbCtx.clearRect(0, 0, cfgW, cfgH);
             rgbCtx.drawImage(glCanvas, 0, 0, cfgW, cfgH);
          } else {
${match}
          }`;
});

// Also fix handleExportVAP
const regexVAP = /const handleExportVAP = async \(isStandardMP4: boolean = false\) => \{/g;
code = code.replace(regexVAP, `const handleExportVAP = async (isStandardMP4: boolean = false) => {\n      let webglRenderer: WebGLVapRenderer | null = null;\n      try {\n        webglRenderer = new WebGLVapRenderer(500, 500);\n      } catch (e) {}\n`);

fs.writeFileSync(path, code);
console.log('Applied everything');
