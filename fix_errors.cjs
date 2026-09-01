const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace compressionQuality with compressionLevel in lines 745-747
code = code.replace(/if \(compressionQuality === 100\).*?bitrate = originalBitrate \* \(compressionQuality \/ 85\);/g, `const cLevel = compressionLevel / 100;
    bitrate = originalBitrate * (1.5 - (cLevel * 1.4));`);

const qualityBlock = `    if (compressionQuality === 100) bitrate = originalBitrate * 1.5;
    else if (compressionQuality >= 85) bitrate = originalBitrate * (1.0 + ((compressionQuality - 85) / 15) * 0.4);
    else bitrate = originalBitrate * (compressionQuality / 85);`;

code = code.replace(qualityBlock, `    const cLevel = compressionLevel / 100;
    bitrate = originalBitrate * (1.5 - (cLevel * 1.4));`);


const missingOrigW = /if \(isStandardMP4 && \(origW % 2 !== 0 \|\| origH % 2 !== 0\)\) \{/g;
code = code.replace(missingOrigW, `if (isStandardMP4 && (outW % 2 !== 0 || outH % 2 !== 0)) {`);


const qualityUI = `              {/* Quality Slider */}
              <div className="relative space-y-1.5 p-3.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>مستوى الضغط والجودة (UPNG / MP4)</span>
                    <button 
                      onMouseEnter={() => setActiveTooltip('quality')}
                      onMouseLeave={() => setActiveTooltip(null)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-emerald-400 font-bold">{compressionQuality}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  step="5"
                  value={compressionQuality}
                  onChange={(e) => setCompressionQuality(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>أصغر حجم (20%)</span>
                  <span>مطابق للأصلي (85%)</span>
                  <span>أعلى جودة (100%)</span>
                </div>
                {activeTooltip === 'quality' && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-[#1A1D27] border border-emerald-500/30 rounded-xl shadow-xl z-50 animate-in fade-in zoom-in duration-200">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400 block mb-1">ما هو مستوى الضغط والجودة؟</strong>
                      هذا الخيار يتحكم في العلاقة بين وضوح الصورة وحجم الملف النهائي عند استخراجه كـ SVGA أو VAP.
                      <br/>- <strong className="text-red-400">إذا خفضته:</strong> سيتم تصغير مساحة الملف بشكل كبير جداً، ولكن ستنخفض جودة ألوان الصورة قليلاً.
                      <br/>- <strong className="text-indigo-300">مطابق للأصلي (85%):</strong> سيتم مطابقة حجم وضغط الملف النهائي بنفس حجم ومواصفات الملف الأساسي المرفوع تماماً (وهذا هو الخيار الافتراضي الأفضل).
                      <br/>- <strong className="text-emerald-400">إذا رفعته (100%):</strong> ستكون الجودة أقوى بكثير من الأصلي، مما قد يزيد من حجم الملف.
                    </p>
                  </div>
                )}
              </div>`;

code = code.replace(qualityUI, '');

fs.writeFileSync(path, code);
console.log('Fixed compile errors in UniversalMotionTools.tsx');

const dashboardPath = 'src/components/Dashboard.tsx';
let dCode = fs.readFileSync(dashboardPath, 'utf8');
dCode = dCode.replace(/<Uploader\s*\n\s*onUpload=\{handleUpload\}\s*\n\s*onConverterOpen=\{onConverterOpen\}\s*\n\s*onMultiSvgaOpen=\{onMultiSvgaOpen\}\s*\n\s*onBatchImageOpen=\{onBatchImageOpen\}\s*\n\s*onPagConverterOpen=\{onPagConverterOpen\}\s*\n\s*\/>/g, `<Uploader 
          onUpload={handleUpload} 
          onConverterOpen={onConverterOpen}
          onMultiSvgaOpen={onMultiSvgaOpen}
          onBatchImageOpen={onBatchImageOpen}
          onPagConverterOpen={onPagConverterOpen}
          isUploading={false}
        />`);
fs.writeFileSync(dashboardPath, dCode);
console.log('Fixed compile errors in Dashboard.tsx');

