const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add SVGA WebP compression toggle
// We can just add a format state and use it in export.
const stateInsertPoint = `const [exportTargetFormat, setExportTargetFormat] = useState<'svga' | 'mp4'>('mp4');`;
if (code.includes(stateInsertPoint)) {
    code = code.replace(stateInsertPoint, stateInsertPoint + `\n  const [svgaFormat, setSvgaFormat] = useState<'webp' | 'png'>('webp');`);
} else {
    // try another point
    const stateAlt = `const [compressionQuality, setCompressionQuality] = useState<number>(85);`;
    code = code.replace(stateAlt, stateAlt + `\n  const [svgaFormat, setSvgaFormat] = useState<'webp' | 'png'>('webp');`);
}

// Add the UI for this toggle under SVGA options.
// Find the Quality Slider section or Export Format section
const uiInsertPoint = `<div className="flex justify-between items-center text-xs font-bold text-slate-300">`;
// We will just add it below the Export Format selector
const formatTarget = `<div className="flex gap-2">
                    <button
                      onClick={() => setExportTargetFormat('mp4')}`;

const svgaFormatUI = `
                  {exportTargetFormat === 'svga' && (
                    <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5 mt-2">
                      <span className="text-xs font-bold text-slate-300">صيغة الصور داخل SVGA</span>
                      <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                        <button onClick={() => setSvgaFormat('webp')} className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${svgaFormat === 'webp' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}>WebP (خفيف جداً)</button>
                        <button onClick={() => setSvgaFormat('png')} className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${svgaFormat === 'png' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}>PNG (دقة قصوى)</button>
                      </div>
                    </div>
                  )}
`;

code = code.replace(`</div>\n              </div>\n\n              {/* Quality Slider */}`, `</div>\n              </div>\n${svgaFormatUI}\n              {/* Quality Slider */}`);


// 2. Modify SVGA export to use WebP
const svgaEncodeRegex = /const cnum = compressionQuality[\s\S]*?imagesMap\[imgKey\] = pngBytes;/g;
const svgaEncodeReplacement = `
        const qualityRatio = compressionQuality / 100;
        let imageBytes: Uint8Array;
        
        if (svgaFormat === 'webp') {
           // Fast hardware accelerated WebP conversion
           const dataUrl = exportCanvas.toDataURL('image/webp', qualityRatio);
           const bstr = atob(dataUrl.split(',')[1]);
           let n = bstr.length;
           const u8arr = new Uint8Array(n);
           while(n--) { u8arr[n] = bstr.charCodeAt(n); }
           imageBytes = u8arr;
        } else {
           const scaledImageData = exportCtx.getImageData(0, 0, outW, outH);
           const cnum = compressionQuality >= 95 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));
           const pngBuffer = UPNG.encode([scaledImageData.data.buffer], outW, outH, cnum);
           imageBytes = new Uint8Array(pngBuffer);
        }

        const imgKey = \`frame_\${i}\`;
        imagesMap[imgKey] = imageBytes;
`;
code = code.replace(svgaEncodeRegex, svgaEncodeReplacement);


// 3. Make Live Preview an animated playing video
// The preview effect
const previewEffectStart = `  // Render Preview Frame\n  useEffect(() => {`;
const previewEffectEnd = `  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);`;

// We'll replace the entire preview effect block with an animated one
const newPreviewEffect = `  // Animated Live Preview
  useEffect(() => {
    if (!showLivePreview || !previewCanvasRef.current || !fileUrl) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isPlaying = true;
    let webglRenderer: WebGLVapRenderer | null = null;
    
    const video = document.createElement('video');
    video.muted = true;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.src = fileUrl;

    const rgbCanvas = document.createElement('canvas');
    const rgbCtx = rgbCanvas.getContext('2d', { willReadFrequently: true });
    const alphaCanvas = document.createElement('canvas');
    const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
    
    video.onloadeddata = () => {
        video.play().catch(()=>{});
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
        rgbCanvas.width = cfgW;
        rgbCanvas.height = cfgH;
        alphaCanvas.width = cfgW;
        alphaCanvas.height = cfgH;

        try { webglRenderer = new WebGLVapRenderer(cfgW, cfgH); } catch(e) {}
        
        const isStandardMP4 = exportTargetFormat === 'mp4';
        
        // Background Image caching
        let bgImgEl: HTMLImageElement | null = null;
        if (isStandardMP4 && bgMode === 'image' && bgImageUrl) {
             bgImgEl = new Image();
             bgImgEl.src = bgImageUrl;
        }

        let wmImgEl: HTMLImageElement | null = null;
        if (enableWatermark && watermarkUrl) {
            wmImgEl = new Image();
            wmImgEl.src = watermarkUrl;
        }

        const renderLoop = () => {
           if (!isPlaying) return;
           
           ctx.clearRect(0, 0, cfgW, cfgH);

           if (exportTargetFormat === 'svga' || isStandardMP4) {
                if (isStandardMP4) {
                     if (bgMode === 'image' && bgImgEl && bgImgEl.complete) {
                          ctx.drawImage(bgImgEl, 0, 0, cfgW, cfgH);
                     } else if (bgMode === 'color') {
                          ctx.fillStyle = bgColor;
                          ctx.fillRect(0, 0, cfgW, cfgH);
                     }
                }
                
                if (webglRenderer) {
                     const glCanvas = webglRenderer.render(video, [srcRgbX, srcRgbY, srcRgbW, srcRgbH], [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH], alphaThreshold, unmultiplyAlpha);
                     ctx.drawImage(glCanvas, 0, 0, cfgW, cfgH);
                } else if (rgbCtx && alphaCtx) {
                     // Fallback CPU
                     rgbCtx.clearRect(0, 0, cfgW, cfgH);
                     rgbCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, cfgW, cfgH);
                     alphaCtx.clearRect(0, 0, cfgW, cfgH);
                     alphaCtx.drawImage(video, srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH, 0, 0, cfgW, cfgH);
                     const rgbData = rgbCtx.getImageData(0, 0, cfgW, cfgH);
                     const alphaData = alphaCtx.getImageData(0, 0, cfgW, cfgH);
                     const compData = rgbCtx.createImageData(cfgW, cfgH);
                     const dest = compData.data;
                     const rgbPixels = rgbData.data;
                     const alphaPixels = alphaData.data;
                     for (let p = 0; p < cfgW * cfgH; p++) {
                          const idx = p * 4;
                          const rawAlpha = Math.round(0.299 * alphaPixels[idx] + 0.587 * alphaPixels[idx+1] + 0.114 * alphaPixels[idx+2]);
                          if (rawAlpha <= alphaThreshold) {
                              dest[idx+3] = 0;
                          } else {
                              let aVal = Math.min(255, Math.round(((rawAlpha - alphaThreshold) / (255 - alphaThreshold)) * 255));
                              const aRatio = aVal / 255;
                              let r = rgbPixels[idx], g = rgbPixels[idx+1], b = rgbPixels[idx+2];
                              if (unmultiplyAlpha && aRatio > 0.02) {
                                  r = Math.min(255, Math.max(0, Math.round(r / aRatio)));
                                  g = Math.min(255, Math.max(0, Math.round(g / aRatio)));
                                  b = Math.min(255, Math.max(0, Math.round(b / aRatio)));
                              }
                              dest[idx] = r; dest[idx+1] = g; dest[idx+2] = b; dest[idx+3] = aVal;
                          }
                     }
                     rgbCtx.putImageData(compData, 0, 0);
                     ctx.drawImage(rgbCanvas, 0, 0, cfgW, cfgH);
                }
           } else {
                canvas.width = vw;
                canvas.height = vh;
                ctx.drawImage(video, 0, 0, vw, vh);
           }
           
           if (enableWatermark && wmImgEl && wmImgEl.complete) {
                const dur = Math.max(1, video.duration || 3);
                const progress = (video.currentTime % dur) / dur;
                const { x, y, side } = computeWatermarkPosition(progress, cfgW, cfgH, watermarkSize, watermarkMotionType, watermarkMotionAmount, watermarkSpeed, watermarkPosition);
                drawSquareWatermarkToContext(ctx, wmImgEl, x, y, side, watermarkOpacity / 100, watermarkBorderRadius, watermarkBorder);
           }
           
           animId = requestAnimationFrame(renderLoop);
        };
        
        renderLoop();
    };

    return () => {
        isPlaying = false;
        video.pause();
        video.src = '';
        if (animId) cancelAnimationFrame(animId);
    };
  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);`;

const oldEffectRegex = /useEffect\(\(\) => \{\s*if \(showLivePreview && previewCanvasRef\.current && fileUrl\) \{[\s\S]*?\}, \[showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition\]\);/;

if (code.match(oldEffectRegex)) {
    code = code.replace(oldEffectRegex, newPreviewEffect);
    fs.writeFileSync(path, code);
    console.log('Successfully injected preview and svga webp features');
} else {
    // If not matching perfectly, just try to find it via indexOf
    const effectStartIdx = code.indexOf('useEffect(() => {\n    if (showLivePreview && previewCanvasRef.current && fileUrl) {');
    if (effectStartIdx > -1) {
       const effectEndStr = '  }, [showLivePreview, fileUrl, vapConfig, alphaThreshold, unmultiplyAlpha, bgMode, bgColor, bgImageUrl, exportTargetFormat, enableWatermark, watermarkUrl, watermarkSize, watermarkPosition]);';
       const effectEndIdx = code.indexOf(effectEndStr, effectStartIdx) + effectEndStr.length;
       const oldChunk = code.substring(effectStartIdx, effectEndIdx);
       code = code.replace(oldChunk, newPreviewEffect);
       fs.writeFileSync(path, code);
       console.log('Successfully injected preview via manual index');
    } else {
       console.log('Could not find old effect');
       // let's print some lines to see where it went
       fs.writeFileSync('debug.txt', code);
    }
}
