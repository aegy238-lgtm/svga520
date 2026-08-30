#!/bin/bash
sed -i '429,431c\
          const elapsedSeconds = frame / targetFps;\
          if (item.type === "pag") {\
            const durationSec = (item.pagFile?.duration() / 1000000) || 1;\
            player.setProgress((elapsedSeconds % durationSec) / durationSec);\
            // pag flushing might need await, but since we are in sync loop, we can just do it, or rely on it being fast\
          } else {\
            const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);\
            player.stepToFrame(itemFrame, false);\
          }\
' src/components/MultiSvgaViewer.tsx
