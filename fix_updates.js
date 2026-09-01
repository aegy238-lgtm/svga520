const fs = require('fs');
let code = fs.readFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', 'utf8');

// The whole handleUpdateLayerTransform up to the return object
const regex = /  const handleUpdateLayerTransform = useCallback\(\(layerId: string, deltaTransform: Partial<EditableLayer\['transform'\]>\) => \{[\s\S]*?      return l;\n    \}\)\);\n  \}, \[\]\);/g;

// Actually I will just replace the whole file from git if possible? No git.
