const fs = require('fs');

function fix(file) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/\\`/g, '`');
    code = code.replace(/\\\$/g, '$');
    fs.writeFileSync(file, code);
}

fix('src/components/Name3DEditor/Name3DEditor.tsx');
fix('src/components/Name3DEditor/utils/canvasRenderer.ts');
