const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// The UI we want to insert
const svgaFormatUI = `
              {/* SVGA Image Format */}
              {exportTargetFormat === 'svga' && (
                <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 mt-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span>صيغة الصور داخل ملف SVGA</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => setSvgaFormat('webp')} 
                      className={\`flex-1 py-2 rounded-xl text-xs font-bold transition-all \${svgaFormat === 'webp' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}\`}
                    >
                      WebP (خفيف جداً)
                    </button>
                    <button 
                      onClick={() => setSvgaFormat('png')} 
                      className={\`flex-1 py-2 rounded-xl text-xs font-bold transition-all \${svgaFormat === 'png' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}\`}
                    >
                      PNG (دقة قصوى)
                    </button>
                    <button 
                      onClick={() => setSvgaFormat('jpeg')} 
                      className={\`flex-1 py-2 rounded-xl text-xs font-bold transition-all \${svgaFormat === 'jpeg' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-black/40 text-slate-400 hover:text-white hover:bg-black/60'}\`}
                    >
                      JPEG (بدون شفافية)
                    </button>
                  </div>
                </div>
              )}
`;

code = code.replace('{/* Quality Slider */}', svgaFormatUI + '\n              {/* Quality Slider */}');

// Also update the state definition to include 'jpeg'
code = code.replace(`useState<'webp' | 'png'>('webp')`, `useState<'webp' | 'png' | 'jpeg'>('webp')`);

// Update the encoding logic
const encodeRegex = /if \(svgaFormat === 'webp'\) \{([\s\S]*?)imagesMap\[imgKey\] = imageBytes;/;
const newEncodeLogic = `
        if (svgaFormat === 'webp' || svgaFormat === 'jpeg') {
           const mime = svgaFormat === 'webp' ? 'image/webp' : 'image/jpeg';
           const dataUrl = exportCanvas.toDataURL(mime, qualityRatio);
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

code = code.replace(encodeRegex, newEncodeLogic.trim());

fs.writeFileSync(path, code);
console.log('Fixed SVGA UI and formats');
