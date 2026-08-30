const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

content = content.replace(
  '<div className="flex flex-col lg:flex-row flex-1 overflow-hidden">',
  '<div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">'
);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
