const fs = require('fs');
let code = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf-8');

code = code.replace(
  "  FileAudio, Headphones, Film\n  Layers, FolderOpen, Activity\n} from 'lucide-react';",
  "  FileAudio, Headphones, Film,\n  Layers, FolderOpen, Activity\n} from 'lucide-react';"
);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', code);
