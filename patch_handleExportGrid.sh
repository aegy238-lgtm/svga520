#!/bin/bash
sed -i '336,360c\
        const w = items.length === 1 ? (selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500)) : cardW;\
        const h = items.length === 1 ? (selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500)) : cardH;\
        const div = document.createElement("div");\
        div.style.width = w + "px";\
        div.style.height = h + "px";\
        div.style.position = "absolute";\
        div.style.left = "0";\
        div.style.top = "0";\
        renderContainer.appendChild(div);\
        let player, internalCanvas;\
        if (item.type === "pag") {\
          const PAG = await getPAG();\
          let pagFile = item.pagFile;\
          if (!pagFile) {\
            pagFile = await PAG.PAGFile.load(item.file);\
            item.pagFile = pagFile;\
          }\
          internalCanvas = document.createElement("canvas");\
          internalCanvas.width = item.dimensions?.width || 500;\
          internalCanvas.height = item.dimensions?.height || 500;\
          internalCanvas.style.width = "100%";\
          internalCanvas.style.height = "100%";\
          internalCanvas.style.objectFit = "contain";\
          div.appendChild(internalCanvas);\
          player = await PAG.PAGPlayer.create();\
          player.setComposition(pagFile);\
          const pagSurface = PAG.PAGSurface.fromCanvas(internalCanvas);\
          player.setSurface(pagSurface);\
          player.setVideoEnabled(true);\
          await player.flush();\
        } else {\
          const videoItem = await parseSvgaIfNeeded(item);\
          player = new SVGA.Player(div);\
          player.setVideoItem(videoItem);\
          player.setContentMode(selectedPreset ? "AspectFill" : "AspectFit");\
          internalCanvas = div.querySelector("canvas");\
        }\
        offscreenPlayers.push({ player, div, item, cardW, cardH, internalCanvas });\
' src/components/MultiSvgaViewer.tsx

sed -i '361,363c\
      // Wait for initialization and warmup\
      await new Promise(resolve => setTimeout(resolve, 1500));\
      offscreenPlayers.forEach(async ({ player, item }) => {\
        if (item.type === "pag") {\
          player.setProgress(0);\
          await player.flush();\
        } else {\
          player.stepToFrame(0, false);\
        }\
      });\
' src/components/MultiSvgaViewer.tsx
