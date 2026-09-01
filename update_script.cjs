const fs = require('fs');
let code = fs.readFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', 'utf8');

const regex = /\/\/ Merge Two Specific Layers together.*?setIsMergingLayers\(false\);\n    }\n  }, \[project, layers, pushHistory\]\);/s;

const replacement = `// Merge Two Specific Layers together (with motion synchronization and isolated separation)
  const handleMergeTwoLayers = useCallback(async (
    sourceLayerId: string, 
    targetLayerId: string, 
    options: { syncMotion?: boolean } = {}
  ) => {
    if (!project) return;
    const l1 = layers.find(l => l.id === sourceLayerId);
    const l2 = layers.find(l => l.id === targetLayerId);
    if (!l1 || !l2) {
      setErrorMessage('الطبقات المحددة للربط والدمج غير موجودة');
      return;
    }

    setIsMergingLayers(true);
    try {
      let updatedTarget = { ...l2 };
      if (options.syncMotion !== false) {
        const { syncLayerMotionWithReference } = await import('./svgaMergeEngine');
        updatedTarget = syncLayerMotionWithReference(l2, l1, project.totalFrames || 60);
      } else {
        updatedTarget.isMotionSynced = true;
        updatedTarget.motionReferenceLayerId = l1.id;
      }

      const updatedLayers = layers.map(l => l.id === targetLayerId ? updatedTarget : l);
      
      setLayers(updatedLayers);
      setSelectedLayerId(updatedTarget.id);
      setSelectedLayerIds([updatedTarget.id, l1.id]);
      pushHistory(updatedLayers);
      
      setSuccessToast(\`تم ربط حركة "\${l2.name}" لتتبع "\${l1.name}" بنجاح!\`);
    } catch (err: any) {
      console.error("Failed to merge two layers:", err);
      setErrorMessage(err?.message || 'حدث خطأ أثناء ربط الطبقتين');
    } finally {
      setIsMergingLayers(false);
    }
  }, [project, layers, pushHistory]);`;

const newCode = code.replace(regex, replacement);
fs.writeFileSync('src/components/SvgaLayerEditor/SvgaLayerEditor.tsx', newCode);
