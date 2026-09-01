const fs = require('fs');
let code = fs.readFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', 'utf8');

const regex = /let updatedTarget = \{ \.\.\.l2 \};\n\s+if \(options\.syncMotion !== false\) \{\n\s+const \{ syncLayerMotionWithReference \} = await import\('\.\/svgaMergeEngine'\);\n\s+updatedTarget = syncLayerMotionWithReference\(l2, l1, project\.totalFrames \|\| 60\);\n\s+\} else \{\n\s+updatedTarget\.isMotionSynced = true;\n\s+updatedTarget\.motionReferenceLayerId = l1\.id;\n\s+\}\n\n\s+const updatedLayers = layers\.map\(l => l\.id === targetLayerId \? updatedTarget : l\);\n\s+setLayers\(updatedLayers\);\n\s+setSelectedLayerId\(updatedTarget\.id\);\n\s+setSelectedLayerIds\(\[updatedTarget\.id, l1\.id\]\);/g;

const replacement = `let updatedSource = { ...l1 };
      if (options.syncMotion !== false) {
        const { syncLayerMotionWithReference } = await import('./svgaMergeEngine');
        updatedSource = syncLayerMotionWithReference(l1, l2, project.totalFrames || 60);
      } else {
        updatedSource.isMotionSynced = true;
        updatedSource.motionReferenceLayerId = l2.id;
      }

      const updatedLayers = layers.map(l => l.id === sourceLayerId ? updatedSource : l);
      
      setLayers(updatedLayers);
      setSelectedLayerId(updatedSource.id);
      setSelectedLayerIds([updatedSource.id, l2.id]);`;

const newCode = code.replace(regex, replacement);
fs.writeFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', newCode);
