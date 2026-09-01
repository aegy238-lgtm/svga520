#!/bin/bash
sed -i '1235,1295c\
const SvgaPlayer: React.FC<{ item: any }> = ({ item }) => {\
  const wrapperRef = useRef<HTMLDivElement>(null);\
  const containerRef = useRef<HTMLDivElement>(null);\
  const playerRef = useRef<any>(null);\
  const [isLoaded, setIsLoaded] = useState(false);\
\
  useEffect(() => {\
    let isCanceled = false;\
\
    const loadAndPlay = async () => {\
      if (!containerRef.current || !wrapperRef.current) return;\
      \
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
            const progress = (Date.now() % 3000) / 3000; // Fake loop\
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
      if (!videoItem) {\
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
          if (!isCanceled) setIsLoaded(true);\
        } catch(e) {\
          console.error(e);\
          return;\
        }\
      }\
\
      if (isCanceled || !containerRef.current) return;\
      \
      containerRef.current.innerHTML = "";\
      const player = new SVGA.Player(containerRef.current);\
      playerRef.current = player;\
      player.setContentMode("Fill");\
      player.setVideoItem(videoItem);\
      player.startAnimation();\
    };\
\
    loadAndPlay();\
    return () => { isCanceled = true; if(item.type === "svga") playerRef.current?.stopAnimation(); };\
  }, [item.url, isLoaded, item.type]);\
' src/components/MultiSvgaViewer.tsx
