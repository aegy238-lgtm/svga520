const fs = require('fs');

const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add estimated size function and silent audio state
const importsSearch = `import { \n  Upload, X, Info`;
const importsReplacement = `import { \n  Upload, X, Info, BoxSelect,`;

if (!code.includes('BoxSelect')) {
    code = code.replace(importsSearch, importsReplacement);
}

const stateSearch = `  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);`;
const stateReplacement = `  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Background Throttling Prevention
  const [silentAudio] = useState(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    audio.loop = true;
    return audio;
  });

  useEffect(() => {
    if (isExporting) {
      silentAudio.play().catch(() => {});
    } else {
      silentAudio.pause();
    }
  }, [isExporting, silentAudio]);

  // Preview Modal State
  const [showLivePreview, setShowLivePreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Estimate File Size
  const estimateFileSize = () => {
    if (!sourceFile || videoDuration === 0) return 'غير محدد';
    let originalBitrate = (sourceFile.size * 8) / videoDuration;
    let bitrate;
    if (compressionQuality === 100) bitrate = originalBitrate * 1.5;
    else if (compressionQuality >= 85) bitrate = originalBitrate * (1.0 + ((compressionQuality - 85) / 15) * 0.4);
    else bitrate = originalBitrate * (compressionQuality / 85);
    bitrate = Math.max(1000000, bitrate);
    
    let estimatedSizeInBytes = (bitrate * videoDuration) / 8;
    const shouldIncludeAudio = ((audioFile || audioUrl) && !isAudioMuted) || !muteOriginalAudio;
    if (shouldIncludeAudio) {
      estimatedSizeInBytes += (128000 * videoDuration) / 8;
    }
    
    if (exportTargetFormat === 'svga') {
      estimatedSizeInBytes *= 0.85;
    } else if (exportTargetFormat === 'mp4') {
      estimatedSizeInBytes *= 1.1;
    }
    
    if (estimatedSizeInBytes < 1024 * 1024) {
      return (estimatedSizeInBytes / 1024).toFixed(1) + ' KB';
    }
    return (estimatedSizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
`;

if (!code.includes('estimateFileSize')) {
    code = code.replace(stateSearch, stateReplacement);
}


// 2. Add UI for buttons
const buttonSearch = `              ) : exportSuccess && exportedBlob ? (`;
const buttonReplacement = `              ) : exportSuccess && exportedBlob ? (`;

const exportButtonSearch = `              ) : (
                <button
                  disabled={!fileUrl}
                  onClick={handleStartExport}`;

const exportButtonReplacement = `              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-slate-400 font-bold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> الحجم التقريبي المتوقع:</span>
                    <span className="text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-inner">
                      {estimateFileSize()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!fileUrl}
                      onClick={() => setShowLivePreview(true)}
                      className="flex-1 py-3.5 bg-[#141824] hover:bg-[#1a1f2e] text-white rounded-2xl font-black text-xs transition-all border border-white/10 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Eye className="w-4 h-4 text-indigo-400" />
                      معاينة الإخراج
                    </button>
                    <button
                      disabled={!fileUrl}
                      onClick={handleStartExport}
                      className={\`flex-[2] py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg \${
                        fileUrl
                          ? exportTargetFormat === 'svga'
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/25 cursor-pointer hover:scale-[1.01]'
                            : exportTargetFormat === 'vap'
                            ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/25 cursor-pointer hover:scale-[1.01]'
                            : 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/25 cursor-pointer hover:scale-[1.01]'
                          : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                      }\`}
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      {exportTargetFormat === 'svga' 
                        ? 'تصدير 2.0 SVGA نقي' 
                        : exportTargetFormat === 'vap' 
                        ? 'تصدير VAP مُعالج' 
                        : 'تصدير MP4 نقي'}
                    </button>
                  </div>
                </div>
`;

if (!code.includes('الحجم التقريبي المتوقع')) {
  // Replace the old button block. We need to be careful with the exact match.
  // Instead of replacing the block, let's use regex or split.
  let parts = code.split(exportButtonSearch);
  if (parts.length === 2) {
      // Find the closing of the button tag
      let rest = parts[1];
      let btnCloseIdx = rest.indexOf('</button>');
      if (btnCloseIdx !== -1) {
          code = parts[0] + exportButtonReplacement + rest.substring(btnCloseIdx + 9);
      }
  }
}

// 3. Add Live Preview Modal
// We'll append it before the final </div> of the component.
const modalCode = `
      {/* Live Preview Modal */}
      {showLivePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0C0E14] border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#141824]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm">معاينة الإخراج النهائي</h3>
                  <p className="text-slate-400 text-[11px] font-medium mt-0.5">شكل الملف النهائي مع تأثيراتك</p>
                </div>
              </div>
              <button onClick={() => setShowLivePreview(false)} className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iIzIyMiI+PC9yZWN0Pgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPC9zdmc+')]">
              <canvas 
                ref={previewCanvasRef} 
                className="max-h-[500px] max-w-full rounded-lg shadow-2xl border border-white/20"
                style={{ 
                  boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8), 0 0 20px rgba(99, 102, 241, 0.15)'
                }}
              />
              <p className="absolute bottom-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white/80 border border-white/10 shadow-lg">
                معاينة تقريبية (يتم تحديث الإطار الأول)
              </p>
            </div>
          </div>
        </div>
      )}
`;

const endSearch = `    </div>
  );
};`;
if (!code.includes('Live Preview Modal')) {
    code = code.replace(endSearch, modalCode + endSearch);
}

// 4. Draw first frame logic into previewCanvasRef when modal opens
const effectCode = `
  // Render Preview Frame
  useEffect(() => {
    if (showLivePreview && previewCanvasRef.current && fileUrl) {
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = document.createElement('video');
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.src = fileUrl;
      video.currentTime = 0.5; // grab frame at 0.5s

      video.oncanplay = () => {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;

        let cfgW = vapConfig?.info?.w || Math.round(vw / 2);
        let cfgH = vapConfig?.info?.h || vh;
        let rawVideoW = vapConfig?.info?.videoW || vw;
        let rawVideoH = vapConfig?.info?.videoH || vh;
        let rgbRect = vapConfig?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
        let alphaRect = vapConfig?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

        if (!vapConfig?.info?.rgbFrame && vh > vw && vw > 0) {
          rgbRect = [0, 0, vw, Math.round(vh / 2)];
          alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
          cfgW = vw;
          cfgH = Math.round(vh / 2);
        }

        const scaleX = vw / (rawVideoW || vw);
        const scaleY = vh / (rawVideoH || vh);
        const srcRgbX = Math.round(rgbRect[0] * scaleX);
        const srcRgbY = Math.round(rgbRect[1] * scaleY);
        const srcRgbW = Math.round(rgbRect[2] * scaleX);
        const srcRgbH = Math.round(rgbRect[3] * scaleY);
        const srcAlphaX = Math.round(alphaRect[0] * scaleX);
        const srcAlphaY = Math.round(alphaRect[1] * scaleY);
        const srcAlphaW = Math.round(alphaRect[2] * scaleX);
        const srcAlphaH = Math.round(alphaRect[3] * scaleY);

        canvas.width = cfgW;
        canvas.height = cfgH;
        
        const isStandardMP4 = exportTargetFormat === 'mp4';
        
        ctx.clearRect(0, 0, cfgW, cfgH);
        
        if (exportTargetFormat === 'svga' || isStandardMP4) {
          if (isStandardMP4) {
            if (bgMode === 'image' && bgImageUrl) {
              const img = new Image();
              img.src = bgImageUrl;
              img.onload = () => {
                ctx.drawImage(img, 0, 0, cfgW, cfgH);
                drawPreviewBlend();
              };
              return;
            } else if (bgMode === 'color') {
              ctx.fillStyle = bgColor;
              ctx.fillRect(0, 0, cfgW, cfgH);
            }
          }
          drawPreviewBlend();
        } else {
          canvas.width = vw;
          canvas.height = vh;
          ctx.drawImage(video, 0, 0, vw, vh);
        }

        function drawPreviewBlend() {
          const rgbCanvas = document.createElement('canvas');
          rgbCanvas.width = cfgW; rgbCanvas.height = cfgH;
          const rgbCtx = rgbCanvas.getContext('2d');
          
          const alphaCanvas = document.createElement('canvas');
          alphaCanvas.width = cfgW; alphaCanvas.height = cfgH;
          const alphaCtx = alphaCanvas.getContext('2d');

          if (!rgbCtx || !alphaCtx) return;

          rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, cfgW, cfgH);
          alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, cfgW, cfgH);

          const rgbData = rgbCtx.getImageData(0, 0, cfgW, cfgH);
          const alphaData = alphaCtx.getImageData(0, 0, cfgW, cfgH);
          const compData = rgbCtx.createImageData(cfgW, cfgH);
          
          for (let p = 0; p < cfgW * cfgH; p++) {
            const idx = p * 4;
            const aR = alphaData.data[idx];
            const aG = alphaData.data[idx+1];
            const aB = alphaData.data[idx+2];
            const rawAlpha = Math.round(0.299 * aR + 0.587 * aG + 0.114 * aB);

            if (rawAlpha <= alphaThreshold) {
              compData.data[idx+3] = 0;
            } else {
              let aVal = rawAlpha;
              if (aVal < 255) aVal = Math.min(255, Math.round(((rawAlpha - alphaThreshold) / (255 - alphaThreshold)) * 255));
              
              const alphaRatio = aVal / 255;
              let r = rgbData.data[idx];
              let g = rgbData.data[idx+1];
              let b = rgbData.data[idx+2];

              if (unmultiplyAlpha && alphaRatio > 0.02) {
                r = Math.min(255, Math.max(0, Math.round(r / alphaRatio)));
                g = Math.min(255, Math.max(0, Math.round(g / alphaRatio)));
                b = Math.min(255, Math.max(0, Math.round(b / alphaRatio)));
              }

              compData.data[idx] = r;
              compData.data[idx+1] = g;
              compData.data[idx+2] = b;
              compData.data[idx+3] = aVal;
            }
          }
          
          rgbCtx.putImageData(compData, 0, 0);
          ctx.drawImage(rgbCanvas, 0, 0, cfgW, cfgH);

          if (enableWatermark && watermarkUrl) {
            const wmImg = new Image();
            wmImg.src = watermarkUrl;
            wmImg.onload = () => {
              const { x, y, side } = computeWatermarkPosition(0.5, cfgW, cfgH, watermarkSize, watermarkMotionType, watermarkMotionAmount, watermarkSpeed, watermarkPosition);
              drawSquareWatermarkToContext(ctx, wmImg, x, y, side, watermarkOpacity / 100, watermarkBorderRadius, watermarkBorder);
            }
          }
        }
      };
      video.load();
    }
  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);
`;

const stateSearchForEffect = `  // Estimate File Size`;
if (!code.includes('// Render Preview Frame')) {
  code = code.replace(stateSearchForEffect, effectCode + '\n  // Estimate File Size');
}

fs.writeFileSync(path, code);
console.log('Patch successful');
