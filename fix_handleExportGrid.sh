#!/bin/bash
cat << 'INNER_EOF' > replacement.txt
  const handleExportGrid = async () => {
    if (items.length === 0) return;

    const { allowed } = await checkAccess("Multi SVGA Export");
    if (!allowed) {
      if (onSubscriptionRequired) onSubscriptionRequired();
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    if (currentUser) {
      logActivity(currentUser, "export", `Multi SVGA Grid Export: ${items.length} files`);
    }

    const renderContainer = document.createElement("div");
    renderContainer.style.position = "fixed";
    renderContainer.style.left = "-10000px";
    renderContainer.style.top = "0";
    renderContainer.style.width = "1920px";
    renderContainer.style.height = "1080px";
    renderContainer.style.overflow = "hidden";
    renderContainer.style.zIndex = "-1000";
    renderContainer.style.pointerEvents = "none";
    document.body.appendChild(renderContainer);

    try {
      const targetFps = 30;
      let canvasWidth: number;
      let canvasHeight: number;
      let cols: number;
      let rows: number;

      if (items.length === 1) {
        const item = items[0];
        canvasWidth = selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500);
        canvasHeight = selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500);
        cols = 1;
        rows = 1;
      } else {
        canvasWidth = exportResolution === "1080p" ? 1920 : (exportResolution === "720p" ? 1280 : 1080);
        canvasHeight = exportResolution === "1080p" ? 1080 : (exportResolution === "720p" ? 720 : 1080);
        if (forceMobileSize) {
          canvasWidth = exportResolution === "1080p" ? 1080 : 720;
          canvasHeight = exportResolution === "1080p" ? 1920 : 1280;
        }
        cols = Math.ceil(Math.sqrt(items.length));
        rows = Math.ceil(items.length / cols);
      }

      const padding = items.length === 1 ? 0 : 20;
      const availableWidth = canvasWidth - (padding * (cols + 1));
      const availableHeight = canvasHeight - (padding * (rows + 1));
      const cardW = availableWidth / cols;
      const cardH = availableHeight / rows;

      const finalWidth = Math.round(canvasWidth / 2) * 2;
      const finalHeight = Math.round(canvasHeight / 2) * 2;

      const canvas = document.createElement("canvas");
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true })!;

      let maxFrames = 0;
      items.forEach(item => {
        const frames = item.frames || 1;
        const fps = item.fps || 30;
        const duration = frames / fps;
        maxFrames = Math.max(maxFrames, duration * targetFps);
      });
      const totalFrames = exportDuration ? exportDuration * targetFps : Math.min(maxFrames, 15 * targetFps);

      let bgImg: HTMLImageElement | null = null;
      if (exportBg) {
        bgImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.src = exportBg;
        });
      }

      let wmImg: HTMLImageElement | null = null;
      if (watermark) {
        wmImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.src = watermark;
        });
      }

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: "avc", width: finalWidth, height: finalHeight },
        fastStart: "in-memory"
      });

      let hasEncoderError = false;
      const videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (e) => {
          console.error("Encoder Error:", e);
          hasEncoderError = true;
          if (videoEncoder.state !== "closed") alert("خطأ في ترميز الفيديو: " + e.message);
        }
      });

      const offscreenPlayers = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const w = items.length === 1 ? (selectedPreset ? selectedPreset.width : (item.dimensions?.width || 500)) : cardW;
        const h = items.length === 1 ? (selectedPreset ? selectedPreset.height : (item.dimensions?.height || 500)) : cardH;
        
        const div = document.createElement("div");
        div.style.width = w + "px";
        div.style.height = h + "px";
        div.style.position = "absolute";
        div.style.left = "0";
        div.style.top = "0";
        renderContainer.appendChild(div);

        let player, internalCanvas;
        if (item.type === "pag") {
          const PAG = await getPAG();
          let pagFile = item.pagFile;
          if (!pagFile) {
            pagFile = await PAG.PAGFile.load(item.file);
            item.pagFile = pagFile;
          }
          internalCanvas = document.createElement("canvas");
          internalCanvas.width = item.dimensions?.width || 500;
          internalCanvas.height = item.dimensions?.height || 500;
          internalCanvas.style.width = "100%";
          internalCanvas.style.height = "100%";
          internalCanvas.style.objectFit = "contain";
          div.appendChild(internalCanvas);
          
          player = await PAG.PAGPlayer.create();
          player.setComposition(pagFile);
          const pagSurface = PAG.PAGSurface.fromCanvas(internalCanvas);
          player.setSurface(pagSurface);
          player.setVideoEnabled(true);
        } else {
          const videoItem = await parseSvgaIfNeeded(item);
          player = new SVGA.Player(div);
          player.setVideoItem(videoItem);
          player.setContentMode(selectedPreset ? "AspectFill" : "AspectFit");
          internalCanvas = div.querySelector("canvas");
        }
        
        offscreenPlayers.push({ player, div, item, cardW, cardH, internalCanvas });
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      for (let i = 0; i < offscreenPlayers.length; i++) {
        const { player, item } = offscreenPlayers[i];
        if (item.type === "pag") {
          player.setProgress(0);
          await player.flush();
        } else {
          player.stepToFrame(0, false);
        }
      }

      try {
        videoEncoder.configure({
          codec: "avc1.4D4034",
          width: finalWidth,
          height: finalHeight,
          bitrate: 4_000_000,
          framerate: targetFps
        });
      } catch (e) {
        console.error("Encoder Configuration Error:", e);
        alert("خطأ في إعدادات ترميز الفيديو: " + (e instanceof Error ? e.message : String(e)));
        document.body.removeChild(renderContainer);
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      for (let frame = 0; frame < totalFrames; frame++) {
        if (bgImg) {
          ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        for (let index = 0; index < offscreenPlayers.length; index++) {
          const { player, item, cardW, cardH, internalCanvas } = offscreenPlayers[index];
          let x, y;
          if (items.length === 1) {
            x = 0;
            y = 0;
          } else {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const scaleX = canvas.width / canvasWidth;
            const scaleY = canvas.height / canvasHeight;
            x = (padding + col * (cardW + padding)) * scaleX;
            y = (padding + row * (cardH + padding)) * scaleY;
            const scaledCardW = cardW * scaleX;
            const scaledCardH = cardH * scaleY;
            
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.beginPath();
            ctx.roundRect(x, y, scaledCardW, scaledCardH, 40 * Math.min(scaleX, scaleY));
            ctx.fill();
          }

          const elapsedSeconds = frame / targetFps;
          if (item.type === "pag") {
            const durationSec = (item.pagFile?.duration() / 1000000) || 1;
            player.setProgress((elapsedSeconds % durationSec) / durationSec);
            await player.flush();
          } else {
            const itemFrame = Math.floor(elapsedSeconds * (item.fps || 30)) % (item.frames || 1);
            player.stepToFrame(itemFrame, false);
          }

          if (internalCanvas) {
            const sw = item.dimensions?.width || 500;
            const sh = item.dimensions?.height || 500;
            const scale = Math.min(cardW / sw, cardH / sh);
            const finalW = sw * scale;
            const finalH = sh * scale;
            const scaleX = canvas.width / canvasWidth;
            const scaleY = canvas.height / canvasHeight;
            const dx = (x + (cardW * scaleX - finalW * scaleX) / 2);
            const dy = (y + (cardH * scaleY - finalH * scaleY) / 2);
            
            ctx.save();
            ctx.beginPath();
            if (items.length > 1) {
              ctx.roundRect(x, y, cardW * scaleX, cardH * scaleY, 40 * Math.min(scaleX, scaleY));
            } else {
              ctx.rect(x, y, canvas.width, canvas.height);
            }
            ctx.clip();
            ctx.drawImage(internalCanvas, dx, dy, finalW * scaleX, finalH * scaleY);
            ctx.restore();
          }
        }

        if (wmImg) {
          const wmSize = Math.min(canvas.width, canvas.height) * (wmSettings.size / 100);
          let wx = 0, wy = 0;
          switch(wmSettings.position) {
            case "top-left": wx = 40; wy = 40; break;
            case "top-right": wx = canvas.width - wmSize - 40; wy = 40; break;
            case "bottom-left": wx = 40; wy = canvas.height - wmSize - 40; break;
            case "bottom-right": wx = canvas.width - wmSize - 40; wy = canvas.height - wmSize - 40; break;
            case "center": wx = (canvas.width - wmSize) / 2; wy = (canvas.height - wmSize) / 2; break;
          }
          ctx.globalAlpha = wmSettings.opacity;
          ctx.drawImage(wmImg, wx, wy, wmSize, wmSize);
          ctx.globalAlpha = 1.0;
        }

        const timestamp = (frame / targetFps) * 1_000_000;
        const videoFrame = new VideoFrame(canvas, { timestamp });

        while (videoEncoder.encodeQueueSize > 10) {
          await new Promise(r => requestAnimationFrame(r));
        }

        if (hasEncoderError) break;
        videoEncoder.encode(videoFrame, { keyFrame: frame % 30 === 0 });
        videoFrame.close();

        if (frame % 5 === 0) {
          await new Promise(r => requestAnimationFrame(r));
          setExportProgress(Math.round((frame / totalFrames) * 100));
        }
      }

      if (videoEncoder.state !== "closed") {
        await videoEncoder.flush();
        videoEncoder.close();
      }

      muxer.finalize();
      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SVGA_Record_${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
      alert("حدث خطأ أثناء التصدير.");
    } finally {
      document.body.removeChild(renderContainer);
      setIsExporting(false);
      setExportProgress(0);
    }
  };
INNER_EOF

# Calculate lines to replace safely
START_LINE=193
END_LINE=546

# Combine first part, new content, and end part
head -n $((START_LINE - 1)) src/components/MultiSvgaViewer.tsx > MultiSvgaViewer_fixed.tsx
cat replacement.txt >> MultiSvgaViewer_fixed.tsx
tail -n +$((END_LINE + 1)) src/components/MultiSvgaViewer.tsx >> MultiSvgaViewer_fixed.tsx

mv MultiSvgaViewer_fixed.tsx src/components/MultiSvgaViewer.tsx
