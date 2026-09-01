#!/bin/bash
sed -i 's|import { handleSvgaExExport } from "../utils/svgaExExport";|import { handleSvgaExExport } from "../utils/svgaExExport";\nimport { validateMp3File } from "../utils/validateMp3";|g' src/components/Workspace.tsx
