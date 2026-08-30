#!/bin/bash
sed -i '1439,1499c\
      if (item.type === "pag") {\
        let pagFile = item.pagFile;\
        if (!pagFile) {\
          const PAG = await getPAG();\
          pagFile = await PAG.PAGFile.load(item.file);\
          item.pagFile = pagFile;\
          if (!item.dimensions) {\
            item.dimensions = { width: pagFile.width(), height: pagFile.height() };\
            item.fps = pagFile.frameRate() || 30;\
            item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);\
          }\
          if (!isCanceled) setIsLoaded(true);\
        }\
        if (isCanceled || !containerRef.current) return;\
        containerRef.current.innerHTML = "";\
        const canvas = document.createElement("canvas");\
        canvas.width = item.dimensions.width;\
        canvas.height = item.dimensions.height;\
        canvas.style.width = "100%";\
        canvas.style.height = "100%";\
        canvas.style.objectFit = "contain";\
        containerRef.current.appendChild(canvas);\
        const PAG = await getPAG();\
        const pagPlayer = await PAG.PAGPlayer.create();\
        pagPlayer.setComposition(pagFile);\
        const pagSurface = PAG.PAGSurface.fromCanvas(canvas);\
        pagPlayer.setSurface(pagSurface);\
        pagPlayer.setVideoEnabled(true);\
        playerRef.current = pagPlayer;\
        const renderLoop = async () => {\
          if (isCanceled) return;\
          if (pagPlayer) {\
            const progress = (Date.now() % 3000) / 3000;\
            pagPlayer.setProgress(progress);\
            await pagPlayer.flush();\
          }\
          requestAnimationFrame(renderLoop);\
        };\
        renderLoop();\
        return;\
      }\
\
      let videoItem = item.videoItem;\
      if (!videoItem || !videoItem.images) {\
        try {\
          videoItem = await new Promise((resolve, reject) => {\
            const parser = new SVGA.Parser();\
            const bypassUrl = item.url + "#" + Math.random().toString(36).substr(2, 9);\
            parser.load(bypassUrl, (vi: any) => {\
              if (!vi || !vi.images) return reject(new Error("Invalid SVGA"));\
              resolve(vi);\
            }, reject);\
          });\
          item.videoItem = videoItem;\
          if (!item.dimensions) {\
            item.dimensions = { width: videoItem.videoSize?.width || 500, height: videoItem.videoSize?.height || 500 };\
            item.fps = videoItem.FPS || videoItem.fps || 30;\
            item.frames = videoItem.frames || 1;\
          }\
          if (!isCanceled) setIsLoaded(true);\
        } catch(e) {\
          console.error("SVGA load error", e);\
          return;\
        }\
      }\
\
      if (isCanceled || !containerRef.current) return;\
      containerRef.current.innerHTML = "";\
      const player = new SVGA.Player(containerRef.current);\
      playerRef.current = player;\
      player.loops = 0;\
      player.clearsAfterStop = false;\
      player.setContentMode("AspectFit");\
      player.setVideoItem(videoItem);\
      if (isPlaying) player.startAnimation();\
    };\
' src/components/MultiSvgaViewer.tsx
