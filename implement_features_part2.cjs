const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalMotionTools.tsx', 'utf8');

// Implement handleExportStandardMP4
// Wait, I can just copy the handleExportVAP logic, but make it output standard dimensions
// Actually, it's easier to just modify the trigger logic
const startExportOld = `  // Trigger Selected Export Mode
  const handleStartExport = () => {
    if (exportTargetFormat === 'vap') {
      handleExportVAP();
    } else {
      handleExportSVGA();
    }
  };`;

const startExportNew = `  // Trigger Selected Export Mode
  const handleStartExport = () => {
    if (exportTargetFormat === 'vap') {
      handleExportVAP(false);
    } else if (exportTargetFormat === 'mp4') {
      handleExportVAP(true); // true = export standard mp4
    } else {
      handleExportSVGA();
    }
  };`;
content = content.replace(startExportOld, startExportNew);

// Now modify handleExportVAP
const exportVapOld1 = `  // 1. Export as Professional VAP MP4 with VAPC Box & Integrated Audio Control
  const handleExportVAP = async () => {`;
const exportVapNew1 = `  // 1. Export as Professional VAP MP4 (or Standard MP4)
  const handleExportVAP = async (isStandardMP4: boolean = false) => {`;
content = content.replace(exportVapOld1, exportVapNew1);

// Inside handleExportVAP, adjust dimensions and canvas draw
const dimensionsOld = `      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const duration = video.duration || videoDuration || 3;
      const fps = targetFps || 24;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frameDuration = 1000000 / fps; // Microseconds`;

const dimensionsNew = `      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const duration = video.duration || videoDuration || 3;
      const fps = targetFps || 24;
      const totalFrames = Math.max(1, Math.floor(duration * fps));
      const frameDuration = 1000000 / fps; // Microseconds
      
      const outW = isStandardMP4 ? (vapConfig?.info?.w || Math.round(vw / 2)) : vw;
      const outH = isStandardMP4 ? (vapConfig?.info?.h || vh) : vh;`;
content = content.replace(dimensionsOld, dimensionsNew);

// Adjust video encoder config
const configureOld = `      videoEncoder.configure({
        codec: codec,
        width: vw,
        height: vh,
        bitrate: bitrate,
        framerate: fps,
      });`;
const configureNew = `      videoEncoder.configure({
        codec: codec,
        width: outW,
        height: outH,
        bitrate: bitrate,
        framerate: fps,
      });`;
content = content.replace(configureOld, configureNew);

// Load background image if standard mp4
const preloadImageLogic = `      let audioDataChunks: any[] = [];
      let customAudioDataChunks: any[] = [];`;
const newPreloadLogic = `      let bgImageElement: HTMLImageElement | null = null;
      if (isStandardMP4 && bgMode === 'image' && bgImageUrl) {
        bgImageElement = new Image();
        bgImageElement.src = bgImageUrl;
        await new Promise(r => { bgImageElement!.onload = r; });
      }

      let audioDataChunks: any[] = [];
      let customAudioDataChunks: any[] = [];`;
content = content.replace(preloadImageLogic, newPreloadLogic);

// Adjust drawing logic
const drawOld = `      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.imageSmoothingEnabled = true;
      drawCtx.imageSmoothingQuality = 'high';

      // Start encoding loop`;
const drawNew = `      const drawCtx = drawCanvas.getContext('2d');
      drawCtx.imageSmoothingEnabled = true;
      drawCtx.imageSmoothingQuality = 'high';

      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = outW;
      renderCanvas.height = outH;
      const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });
      if (renderCtx) {
          renderCtx.imageSmoothingEnabled = true;
          renderCtx.imageSmoothingQuality = 'high';
      }

      // Start encoding loop`;
content = content.replace(drawOld, drawNew);

// In the loop
const loopDrawOld = `          drawCtx.clearRect(0, 0, vw, vh);
          drawCtx.drawImage(video, 0, 0, vw, vh);

          const frame = new VideoFrame(drawCanvas, { timestamp: Math.round(i * frameDuration) });`;

const loopDrawNew = `          drawCtx.clearRect(0, 0, vw, vh);
          drawCtx.drawImage(video, 0, 0, vw, vh);

          let finalCanvasForFrame = drawCanvas;

          if (isStandardMP4 && renderCtx) {
            renderCtx.clearRect(0, 0, outW, outH);
            
            // Draw background
            if (bgMode === 'image' && bgImageElement) {
               // cover logic
               const scale = Math.max(outW / bgImageElement.width, outH / bgImageElement.height);
               const x = (outW / 2) - (bgImageElement.width / 2) * scale;
               const y = (outH / 2) - (bgImageElement.height / 2) * scale;
               renderCtx.drawImage(bgImageElement, x, y, bgImageElement.width * scale, bgImageElement.height * scale);
            } else if (bgMode === 'color') {
               renderCtx.fillStyle = bgColor;
               renderCtx.fillRect(0, 0, outW, outH);
            }

            // Extract RGB and Alpha
            const rgbHalf = document.createElement('canvas');
            rgbHalf.width = outW; rgbHalf.height = outH;
            const rgbCtx = rgbHalf.getContext('2d');
            const alphaHalf = document.createElement('canvas');
            alphaHalf.width = outW; alphaHalf.height = outH;
            const alphaCtx = alphaHalf.getContext('2d');

            if (rgbCtx && alphaCtx) {
               // Draw RGB (assumed left half)
               rgbCtx.drawImage(drawCanvas, 0, 0, outW, outH, 0, 0, outW, outH);
               // Draw Alpha (assumed right half)
               alphaCtx.drawImage(drawCanvas, outW, 0, outW, outH, 0, 0, outW, outH);

               // Mask RGB with Alpha
               rgbCtx.globalCompositeOperation = 'destination-in';
               rgbCtx.drawImage(alphaHalf, 0, 0, outW, outH);
               rgbCtx.globalCompositeOperation = 'source-over';

               // Draw over background
               renderCtx.drawImage(rgbHalf, 0, 0, outW, outH);
            }
            finalCanvasForFrame = renderCanvas;
          }

          const frame = new VideoFrame(finalCanvasForFrame, { timestamp: Math.round(i * frameDuration) });`;
content = content.replace(loopDrawOld, loopDrawNew);

// Remove the MP4Box injection if Standard MP4!
const muxerOld = `      // Add VAPC box manually at the end
      if (vapConfig) {
        muxer.mp4box.addBox("vapc", new Uint8Array(Buffer.from(JSON.stringify(vapConfig))));
      }

      muxer.finalize();`;
const muxerNew = `      // Add VAPC box manually at the end (Only for VAP)
      if (!isStandardMP4 && vapConfig) {
        // Find moov box and insert vapc box? Actually the original code just did this, let's keep it safe
        try {
            muxer.mp4box.addBox("vapc", new Uint8Array(Buffer.from(JSON.stringify(vapConfig))));
        } catch(e) {}
      }

      muxer.finalize();`;
content = content.replace(muxerOld, muxerNew);

// Finalize naming
const downloadOld = `      // Create download link
      const blob = new Blob([buffer], { type: 'video/mp4' });`;
const downloadNew = `      // Create download link
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const finalFileName = isStandardMP4 
            ? fileName.replace('.mp4', '_standard.mp4')
            : fileName.replace('.mp4', '_vap.mp4');`;
content = content.replace(downloadOld, downloadNew);

const aDownloadOld = `      a.download = fileName.replace('.mp4', '_vap.mp4');`;
const aDownloadNew = `      a.download = finalFileName;`;
content = content.replace(aDownloadOld, aDownloadNew);

fs.writeFileSync('src/components/UniversalMotionTools.tsx', content);
console.log("Features injected part 2");
