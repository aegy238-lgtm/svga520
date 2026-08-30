const fs = require('fs');
let code = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// The global replace broke some things probably. Or maybe the previous lint was delayed.
// Let's just fix it properly.
