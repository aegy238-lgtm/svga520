const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

code = code.replace(
  "renderCanvas(exportCanvas, state, state.canvasWidth * scale, state.canvasHeight * scale);",
  "renderCanvas(exportCanvas, state, state.canvasWidth * scale, state.canvasHeight * scale, scale);"
);

fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
