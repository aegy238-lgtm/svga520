#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
    useEffect(() => {
      let isCanceled = false;
      const loadAndPlay = async () => {
        if (!isVisible) {
          if (playerRef.current) {
            if (item.type === "pag") playerRef.current.destroy?.();
            else playerRef.current.stopAnimation();
            playerRef.current = null;
          }
          if (containerRef.current) containerRef.current.innerHTML = "";
          item.videoItem = undefined;
          return;
        }

        if (item.type === "pag") {
          let pagFile = item.pagFile;
          if (!pagFile) {
            const PAG = await getPAG();
            pagFile = await PAG.PAGFile.load(item.file);
            item.pagFile = pagFile;
            if (!item.dimensions) {
              item.dimensions = { width: pagFile.width(), height: pagFile.height() };
              item.fps = pagFile.frameRate() || 30;
              item.frames = Math.floor((pagFile.duration() / 1000000) * item.fps);
            }
            if (!isCanceled) setIsLoaded(true);
          }
          if (isCanceled || !containerRef.current) return;
          containerRef.current.innerHTML = "";
          const canvas = document.createElement("canvas");
          canvas.width = item.dimensions.width;
          canvas.height = item.dimensions.height;
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.objectFit = "contain";
          containerRef.current.appendChild(canvas);
          const PAG = await getPAG();
          const pagPlayer = await PAG.PAGPlayer.create();
          pagPlayer.setComposition(pagFile);
          const pagSurface = PAG.PAGSurface.fromCanvas(canvas);
          pagPlayer.setSurface(pagSurface);
          pagPlayer.setVideoEnabled(true);
          playerRef.current = pagPlayer;
          const durationMs = (pagFile.duration() / 1000) || 3000;
          const startTime = Date.now();
          const renderLoop = async () => {
            if (isCanceled) return;
            if (pagPlayer) {
              const elapsed = Date.now() - startTime;
              const progress = (elapsed % durationMs) / durationMs;
              pagPlayer.setProgress(progress);
              await pagPlayer.flush();
            }
            requestAnimationFrame(renderLoop);
          };
          if (isPlaying) renderLoop();
          return;
        }

        let videoItem = item.videoItem;
        if (!videoItem || !videoItem.images) {
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
            if (!item.dimensions) {
              item.dimensions = { width: videoItem.videoSize?.width || 500, height: videoItem.videoSize?.height || 500 };
              item.fps = videoItem.FPS || videoItem.fps || 30;
              item.frames = videoItem.frames || 1;
            }
            if (!isCanceled) setIsLoaded(true);
          } catch(e) {
            console.error("SVGA load error", e);
            return;
          }
        }

        if (isCanceled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const player = new SVGA.Player(containerRef.current);
        playerRef.current = player;
        player.loops = 0;
        player.clearsAfterStop = false;
        player.setContentMode("AspectFit");
        player.setVideoItem(videoItem);
        if (isPlaying) player.startAnimation();
      };

      loadAndPlay();
      return () => {
        isCanceled = true;
        if (playerRef.current) {
          if (item.type === "pag") playerRef.current.destroy?.();
          else playerRef.current.stopAnimation();
        }
      };
    }, [item.url, isLoaded, item.type, isVisible, isPlaying]);
INNER_EOF

START_LINE=1475
END_LINE=1565

head -n $((START_LINE - 1)) src/components/MultiSvgaViewer.tsx > MultiSvgaViewer_fixed.tsx
cat replacement.txt >> MultiSvgaViewer_fixed.tsx
tail -n +$((END_LINE + 1)) src/components/MultiSvgaViewer.tsx >> MultiSvgaViewer_fixed.tsx
mv MultiSvgaViewer_fixed.tsx src/components/MultiSvgaViewer.tsx
