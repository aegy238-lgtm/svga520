#!/bin/bash
sed -i 's/    const updateCanvasStyles = () => {/  useEffect(() => {\n    const updateCanvasStyles = () => {/g' src/components/MultiSvgaViewer.tsx
