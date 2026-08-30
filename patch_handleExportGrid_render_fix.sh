#!/bin/bash
sed -i '408,443c\
        for (let index = 0; index < offscreenPlayers.length; index++) {\
          const { player, item, cardW, cardH, internalCanvas } = offscreenPlayers[index];\
          let x, y;\
          if (items.length === 1) {\
            x = 0;\
            y = 0;\
          } else {\
            const col = index % cols;\
            const row = Math.floor(index / cols);\
            const scaleX = canvas.width / canvasWidth;\
            const scaleY = canvas.height / canvasHeight;\
            x = (padding + col * (cardW + padding)) * scaleX;\
            y = (padding + row * (cardH + padding)) * scaleY;\
            const scaledCardW = cardW * scaleX;\
            const scaledCardH = cardH * scaleY;\
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";\
            ctx.beginPath();\
            ctx.roundRect(x, y, scaledCardW, scaledCardH, 40 * Math.min(scaleX, scaleY));\
            ctx.fill();\
          }\
          const elapsedSeconds = frame / targetFps;\
          if (item.type === "pag") {\
            const durationSec = (item.pagFile?.duration() / 1000000) || 1;\
            player.setProgress((elapsedSeconds % durationSec) / durationSec);\
            await player.flush();\
          } else {\
            const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);\
            player.stepToFrame(itemFrame, false);\
          }\
          if (internalCanvas) {\
            const sw = item.dimensions?.width || 500;\
            const sh = item.dimensions?.height || 500;\
            const scale = Math.min(cardW / sw, cardH / sh);\
            const finalW = sw * scale;\
            const finalH = sh * scale;\
            const scaleX = canvas.width / canvasWidth;\
            const scaleY = canvas.height / canvasHeight;\
            const dx = (x + (cardW * scaleX - finalW * scaleX) / 2);\
            const dy = (y + (cardH * scaleY - finalH * scaleY) / 2);\
            ctx.save();\
            ctx.beginPath();\
            if (items.length > 1) {\
              ctx.roundRect(x, y, cardW * scaleX, cardH * scaleY, 40 * Math.min(scaleX, scaleY));\
            } else {\
              ctx.rect(x, y, canvas.width, canvas.height);\
            }\
            ctx.clip();\
            ctx.drawImage(internalCanvas, dx, dy, finalW * scaleX, finalH * scaleY);\
            ctx.restore();\
          }\
        }\
' src/components/MultiSvgaViewer.tsx
