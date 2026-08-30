#!/bin/bash
sed -i '1467,1475c\
        const durationMs = (pagFile.duration() / 1000) || 3000;\
        const startTime = Date.now();\
        const renderLoop = async () => {\
          if (isCanceled) return;\
          if (pagPlayer) {\
            const elapsed = Date.now() - startTime;\
            const progress = (elapsed % durationMs) / durationMs;\
            pagPlayer.setProgress(progress);\
            await pagPlayer.flush();\
          }\
          requestAnimationFrame(renderLoop);\
        };\
        if (isPlaying) renderLoop();\
' src/components/MultiSvgaViewer.tsx
