const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// Find preview effect
const previewRegex = /function drawPreviewBlend\(\) \{([\s\S]*?)rgbCtx\.putImageData\(compData, 0, 0\);/g;
code = code.replace(previewRegex, (match, body) => {
    return \`function drawPreviewBlend() {
          let webglRenderer = null;
          try {
             webglRenderer = new WebGLVapRenderer(cfgW, cfgH);
          } catch(e) {}
          
          if (webglRenderer) {
             const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
             ctx.drawImage(glCanvas, 0, 0, cfgW, cfgH);
          } else {
\${match.replace('function drawPreviewBlend() {', '')}
          }\`;
});

fs.writeFileSync(path, code);
console.log('Applied WebGL to preview');
