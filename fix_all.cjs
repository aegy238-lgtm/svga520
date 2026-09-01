const fs = require('fs');
let code = fs.readFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', 'utf8');

const regex = /\s+\/\/ Layer Update Handlers[\s\S]*?\}, \[\]\);\n\n\s+\/\/ Bulk Transforms Handler \(e\.g\. from Canvas mouse drag or Properties Panel\)[\s\S]*?\}, \[\]\);/g;

const repl = `
  // Layer Update Handlers
  const handleUpdateLayerTransform = useCallback((layerId: string, deltaTransform: Partial<EditableLayer['transform']>) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layerId) {
        const curX = l.transform.x;
        const curY = l.transform.y;
        const newX = deltaTransform.x !== undefined ? deltaTransform.x : curX;
        const newY = deltaTransform.y !== undefined ? deltaTransform.y : curY;
        const dx = newX - curX;
        const dy = newY - curY;
        
        const newInitialBounds = { ...l.initialBounds };
        let newKeyframes = l.keyframes;
        let newSpriteRef = l.spriteRef;
        
        if (dx !== 0 || dy !== 0) {
          newInitialBounds.x += dx;
          newInitialBounds.y += dy;
          if (newKeyframes) {
            newKeyframes = newKeyframes.map(kf => ({
              ...kf,
              x: kf.x !== undefined ? kf.x + dx : undefined,
              y: kf.y !== undefined ? kf.y + dy : undefined
            }));
          }
          if (newSpriteRef && newSpriteRef.frames) {
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
          }
        }

        return {
          ...l,
          initialBounds: newInitialBounds,
          keyframes: newKeyframes,
          spriteRef: newSpriteRef,
          transform: {
            ...l.transform,
            ...deltaTransform
          }
        };
      }
      return l;
    }));
  }, []);

  // Bulk Transforms Handler (e.g. from Canvas mouse drag or Properties Panel)
  const handleBulkUpdateTransforms = useCallback((updates: Array<{ id: string; transform: Partial<EditableLayer['transform']> }>) => {
    const updatesMap = new Map(updates.map(u => [u.id, u.transform]));
    setLayers(prev => prev.map(l => {
      const delta = updatesMap.get(l.id);
      if (delta) {
        const dx = (delta.x !== undefined ? delta.x : l.transform.x) - l.transform.x;
        const dy = (delta.y !== undefined ? delta.y : l.transform.y) - l.transform.y;
        const newInitialBounds = { ...l.initialBounds };
        let newKeyframes = l.keyframes;
        let newSpriteRef = l.spriteRef;

        if (dx !== 0 || dy !== 0) {
          newInitialBounds.x += dx;
          newInitialBounds.y += dy;
          if (newKeyframes) {
            newKeyframes = newKeyframes.map(kf => ({
              ...kf,
              x: kf.x !== undefined ? kf.x + dx : undefined,
              y: kf.y !== undefined ? kf.y + dy : undefined
            }));
          }
          if (newSpriteRef && newSpriteRef.frames) {
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
          }
        }
        return {
          ...l,
          initialBounds: newInitialBounds,
          keyframes: newKeyframes,
          spriteRef: newSpriteRef,
          transform: {
            ...l.transform,
            ...delta
          }
        };
      }
      return l;
    }));
  }, []);`;

code = code.replace(regex, repl);
fs.writeFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', code);
