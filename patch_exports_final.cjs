const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

content = content.replace(
  /import \{ convertPagToSvga \} from '\.\.\/utils\/pagEngine';/g,
  "import { convertPagToSvga } from '../utils/pagEngine';\nimport { compressItemToImageSvga } from '../utils/unifiedCompressor';"
);

const oldExportLogic = /if \(item\.type === "pag"\) \{[\s\S]*?zip\.file\(parentPath \+ baseName \+ "\.png", blob\);\s*setExportProgress\(Math\.round\(\(\(i \+ 1\) \/ items\.length\) \* 50\)\);\s*\}/;

const newExportLogic = `
        const result = await compressItemToImageSvga(item, {
          compressionQuality: 100, // adjust as needed
          onProgress: (p) => setExportProgress(Math.round(((i + p/100) / items.length) * 50))
        });
        zip.file(parentPath + baseName + ".svga", result.svgaBlob);
        zip.file(parentPath + baseName + ".png", result.pngBlob);
        setExportProgress(Math.round(((i + 1) / items.length) * 50));
`;

content = content.replace(oldExportLogic, newExportLogic);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content);
