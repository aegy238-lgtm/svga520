#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
  const pagSurfaceRef = useRef<any>(null);

  useEffect(() => {
    let isCanceled = false;

    const loadAndPlay = async () => {
      if (!containerRef.current || !wrapperRef.current) return;
      
      if (item.type === "pag") {
        let pagFile = item.pagFile;
        if (!pagFile) {
          try {
            const PAG = await getPAG();
            pagFile = await PAG.PAGFile.load(item.file);
            item.pagFile = pagFile;
            if (!item.dimensions) {
              item.dimensions = { width: pagFile.width(), height: pagFile.height() };
              item.fps = pagFile.frameRate() || 30;
              item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);
            }
            if (!isCanceled) setIsLoaded(true);
          } catch(e) {
            console.error(e);
            return;
          }
        }
        if (isCanceled || !containerRef.current) return;
        
        if (!playerRef.current) {
          containerRef.current.innerHTML = "";
          const canvas = document.createElement("canvas");
          canvas.width = item.dimensions?.width || 500;
          canvas.height = item.dimensions?.height || 500;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.objectFit = "contain";
          containerRef.current.appendChild(canvas);
          
          const PAG = await getPAG();
          const pagPlayer = await PAG.PAGPlayer.create();
          pagPlayer.setComposition(pagFile);
          const pagSurface = PAG.PAGSurface.fromCanvas(canvas);
          pagSurfaceRef.current = pagSurface;
          pagPlayer.setSurface(pagSurface);
          pagPlayer.setVideoEnabled(true);
          playerRef.current = pagPlayer;
          
          const durationMs = (pagFile.duration() / 1000) || 3000;
          let accumulatedTime = 0;
          let lastTime = Date.now();
          
          const renderLoop = async () => {
            if (isCanceled) return;
            const now = Date.now();
            const delta = now - lastTime;
            lastTime = now;
            
            if (playerRef.current) {
              accumulatedTime += delta;
              const progress = (accumulatedTime % durationMs) / durationMs;
              playerRef.current.setProgress(progress);
              await playerRef.current.flush();
            }
            requestAnimationFrame(renderLoop);
          };
          renderLoop();
        }
        return;
      }

      let videoItem = item.videoItem;
      if (!videoItem) {
        try {
          videoItem = await new Promise((resolve, reject) => {
            const parser = new SVGA.Parser();
            const bypassUrl = item.url + "#" + Math.random().toString(36).substr(2, 9);
            parser.load(bypassUrl, (vi: any) => {
              if (!vi || !vi.images) return reject(new Error("Invalid SVGA"));
              resolve(vi);
            }, reject);
          });
          item.videoItem = videoItem;
          if (!isCanceled) setIsLoaded(true);
        } catch(e) {
          console.error(e);
          return;
        }
      }

      if (isCanceled || !containerRef.current) return;
      
      if (!playerRef.current) {
        containerRef.current.innerHTML = "";
        const player = new SVGA.Player(containerRef.current);
        playerRef.current = player;
        player.setContentMode("Fill");
        player.setVideoItem(videoItem);
        player.startAnimation();
      }
    };

    loadAndPlay();
    return () => { 
      isCanceled = true; 
      if (playerRef.current) {
        if (item.type === "pag") {
          try { playerRef.current.destroy?.(); } catch (e) {}
          try { pagSurfaceRef.current?.destroy?.(); } catch (e) {}
        }
        else playerRef.current.stopAnimation();
        playerRef.current = null;
        pagSurfaceRef.current = null;
      }
    };
  }, [item.url, item.type]); // Removed isLoaded
INNER_EOF

START_LINE=1270
END_LINE=1351

head -n $((START_LINE - 1)) src/components/MultiSvgaViewer.tsx > MultiSvgaViewer_fixed2.tsx
cat replacement.txt >> MultiSvgaViewer_fixed2.tsx
tail -n +$((END_LINE + 1)) src/components/MultiSvgaViewer.tsx >> MultiSvgaViewer_fixed2.tsx
mv MultiSvgaViewer_fixed2.tsx src/components/MultiSvgaViewer.tsx
