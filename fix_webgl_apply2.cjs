const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /const handleExportSVGA = async \(\) => \{/g;
code = code.replace(regex, `const handleExportSVGA = async () => {\n      let webglRenderer: WebGLVapRenderer | null = null;\n      try {\n        webglRenderer = new WebGLVapRenderer(origW || 500, origH || 500);\n      } catch (e) {}\n`);

const cpuLoopSVGARegex = /const rgbData = rgbCtx\.getImageData\([\s\S]*?rgbCtx\.putImageData\(compData, 0, 0\);/g;
code = code.replace(cpuLoopSVGARegex, (match) => {
    return `        if (webglRenderer) {
           // Because origW/origH are defined later, we re-init if needed
           if (webglRenderer.canvas.width !== origW) {
              webglRenderer = new WebGLVapRenderer(origW, origH);
           }
           const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
           rgbCtx.clearRect(0, 0, origW, origH);
           rgbCtx.drawImage(glCanvas, 0, 0);
        } else {
${match}
        }`;
});

fs.writeFileSync(path, code);
console.log('Applied WebGL usage in SVGA');
