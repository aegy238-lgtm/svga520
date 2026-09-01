const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/utils/canvasRenderer.ts', 'utf8');

code = code.replace(
  "renderWidth?: number,\n  renderHeight?: number",
  "renderWidth?: number,\n  renderHeight?: number,\n  scale: number = 1"
);

code = code.replace(
  "ctx.clearRect(0, 0, width, height);",
  "ctx.clearRect(0, 0, width, height);\n  if (scale !== 1) ctx.scale(scale, scale);"
);

fs.writeFileSync('src/components/Name3DEditor/utils/canvasRenderer.ts', code);
