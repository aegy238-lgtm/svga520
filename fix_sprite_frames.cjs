const fs = require('fs');
let code = fs.readFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', 'utf8');

const regex1 = /if \(newKeyframes\) \{\n\s+newKeyframes = newKeyframes\.map\(kf => \(\{\n\s+\.\.\.kf,\n\s+x: kf\.x !== undefined \? kf\.x \+ dx : undefined,\n\s+y: kf\.y !== undefined \? kf\.y \+ dy : undefined\n\s+\}\)\);\n\s+\}\n\s+\}/;

const replacement1 = `if (newKeyframes) {
            newKeyframes = newKeyframes.map(kf => ({
              ...kf,
              x: kf.x !== undefined ? kf.x + dx : undefined,
              y: kf.y !== undefined ? kf.y + dy : undefined
            }));
          }
        }
        
        let newSpriteRef = l.spriteRef;
        if (newSpriteRef && newSpriteRef.frames && (dx !== 0 || dy !== 0)) {
          newSpriteRef = {
            ...newSpriteRef,
            frames: newSpriteRef.frames.map(fr => {
              if (fr && fr.transform) {
                return {
                  ...fr,
                  transform: {
                    ...fr.transform,
                    tx: (fr.transform.tx || 0) + dx,
                    ty: (fr.transform.ty || 0) + dy
                  }
                };
              }
              return fr;
            })
          };
        }`;

// Replace for handleUpdateLayerTransform
code = code.replace(regex1, replacement1);

// The same logic is in handleBulkUpdateTransforms, let's just do a generic replace for both.
// Wait, I will just apply the same regex twice since there are two matches.
code = code.replace(regex1, replacement1);

fs.writeFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', code);
