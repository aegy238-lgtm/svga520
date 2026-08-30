#!/bin/bash
# First, revert the broken substitution
sed -i 's/(DEVICE_PRESETS.find(p => p.id === item.presetId) || item.dimensions)?.width/selectedPreset ? selectedPreset.width/g' src/components/MultiSvgaViewer.tsx
sed -i 's/(DEVICE_PRESETS.find(p => p.id === item.presetId) || item.dimensions)?.height/selectedPreset ? selectedPreset.height/g' src/components/MultiSvgaViewer.tsx
sed -i "s/DEVICE_PRESETS.find(p => p.id === item.presetId) ? 'AspectFill' : 'AspectFit'/selectedPreset ? \"AspectFill\" : \"AspectFit\"/g" src/components/MultiSvgaViewer.tsx

# Now replace the entire ternary expression
sed -i 's/selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500)/DEVICE_PRESETS.find(p => p.id === item.presetId)?.width || item.dimensions?.width || 500/g' src/components/MultiSvgaViewer.tsx
sed -i 's/selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500)/DEVICE_PRESETS.find(p => p.id === item.presetId)?.height || item.dimensions?.height || 500/g' src/components/MultiSvgaViewer.tsx
sed -i "s/selectedPreset ? \"AspectFill\" : \"AspectFit\"/DEVICE_PRESETS.find(p => p.id === item.presetId) ? 'AspectFill' : 'AspectFit'/g" src/components/MultiSvgaViewer.tsx
