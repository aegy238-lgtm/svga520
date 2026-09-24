const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/<PagToSvgaStudio/, '{showPagConverter && (\n        <PagToSvgaStudio');
fs.writeFileSync('src/App.tsx', content);
