#!/bin/bash
sed -i 's/selectedPreset ? selectedPreset.width/(DEVICE_PRESETS.find(p => p.id === item.presetId) || item.dimensions)?.width/g' src/components/MultiSvgaViewer.tsx
sed -i 's/selectedPreset ? selectedPreset.height/(DEVICE_PRESETS.find(p => p.id === item.presetId) || item.dimensions)?.height/g' src/components/MultiSvgaViewer.tsx
sed -i "s/selectedPreset ? \"AspectFill\" : \"AspectFit\"/DEVICE_PRESETS.find(p => p.id === item.presetId) ? 'AspectFill' : 'AspectFit'/g" src/components/MultiSvgaViewer.tsx
