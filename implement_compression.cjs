const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Rename compressionQuality to compressionLevel
code = code.replace(/const \[compressionQuality, setCompressionQuality\] = useState<number>\(85\);/, `const [compressionLevel, setCompressionLevel] = useState<number>(0);\n  const [exportStats, setExportStats] = useState<{original: number, compressed: number, savedPct: string} | null>(null);`);

// 2. Replace uses of compressionQuality in estimateFileSize
code = code.replace(/if \(compressionQuality === 100\).*?bitrate = originalBitrate \* \(compressionQuality \/ 85\);/g, `const cLevel = compressionLevel / 100;
    bitrate = originalBitrate * (1.5 - (cLevel * 1.4));`);

// 3. Replace uses of compressionQuality in MP4 export
code = code.replace(/if \(compressionQuality === 100\) \{[\s\S]*?bitrate = Math\.round\(originalBitrate \* scale\);\n      \}/g, `const cLevel = compressionLevel / 100;
      bitrate = Math.round(originalBitrate * (1.5 - (cLevel * 1.4)));`);

// 4. Replace uses of compressionQuality in SVGA export
code = code.replace(/const qualityRatio = compressionQuality \/ 100;/g, `const cLevel = compressionLevel / 100;
        const qualityRatio = 1.0 - (cLevel * 0.9);`);
code = code.replace(/const cnum = compressionQuality >= 95 \? 0 : Math\.max\(16, Math\.min\(256, Math\.round\(qualityRatio \* 256\)\)\);/g, `const cnum = compressionLevel === 0 ? 0 : Math.max(16, Math.min(256, Math.round(qualityRatio * 256)));`);

// 5. Save the export stats when export is successful
// Find setExportedBlob and add setExportStats
code = code.replace(/setExportedBlob\(url\);/g, `setExportedBlob(url);
      if (sourceFile && blob) {
        const saved = Math.max(0, ((sourceFile.size - blob.size) / sourceFile.size) * 100).toFixed(1);
        setExportStats({ original: sourceFile.size, compressed: blob.size, savedPct: saved });
      }`);
code = code.replace(/setExportedBlob\(svgaUrl\);/g, `setExportedBlob(svgaUrl);
      if (sourceFile && svgaBlob) {
        const saved = Math.max(0, ((sourceFile.size - svgaBlob.size) / sourceFile.size) * 100).toFixed(1);
        setExportStats({ original: sourceFile.size, compressed: svgaBlob.size, savedPct: saved });
      }`);
// Before export starts, clear the stats
code = code.replace(/setExportedBlob\(null\);/g, `setExportedBlob(null);\n    setExportStats(null);`);


// 6. Update the Quality Slider UI
const oldUI = `              {/* Quality Slider */}
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

const newUI = `              {/* Compression Slider */}
              <div className="relative space-y-3 p-4 rounded-2xl bg-[#0f121a] border border-indigo-500/20 shadow-inner">
                <div className="flex justify-between items-center text-xs font-black">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Activity className="w-4 h-4" />
                    <span>مستوى الضغط (Compression)</span>
                  </div>
                  <span className={\`font-mono px-2.5 py-1 rounded-md border \${compressionLevel === 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : compressionLevel < 50 ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}\`}>
                    {compressionLevel}%
                  </span>
                </div>
                
                <div className="pt-2">
                  <div className="relative">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="1"
                      value={compressionLevel}
                      onChange={(e) => setCompressionLevel(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    />
                    <div 
                      className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-rose-500 rounded-lg pointer-events-none" 
                      style={{ width: \`\${compressionLevel}%\` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-2">
                    <button onClick={() => setCompressionLevel(0)} className="hover:text-emerald-400 transition-colors">0% (أعلى جودة)</button>
                    <button onClick={() => setCompressionLevel(50)} className="hover:text-indigo-400 transition-colors">50% (متوازن)</button>
                    <button onClick={() => setCompressionLevel(100)} className="hover:text-rose-400 transition-colors">100% (أقصى ضغط)</button>
                  </div>
                  
                  {/* Presets */}
                  <div className="flex gap-2 mt-4">
                    {[
                      { label: 'بدون ضغط', val: 0 },
                      { label: 'جودة عالية', val: 25 },
                      { label: 'متوازن', val: 50 },
                      { label: 'حجم صغير', val: 75 },
                      { label: 'أقصى ضغط', val: 100 }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        onClick={() => setCompressionLevel(preset.val)}
                        className={\`flex-1 py-1.5 text-[9px] font-bold rounded-lg border transition-all \${compressionLevel === preset.val ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 border-white/5 hover:bg-slate-800'}\`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>`;

code = code.replace(oldUI, newUI);

// 7. Update export stats display
const successUIInsertPoint = `<div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-black text-sm">تم التصدير بنجاح!</h3>
                <p className="text-slate-400 text-xs font-medium mt-0.5">الملف جاهز للتحميل والمشاركة</p>
              </div>
            </div>`;

const exportStatsUI = `
            {exportStats && (
              <div className="mt-4 p-4 bg-[#0a0d14] rounded-xl border border-white/5 flex gap-4 text-center divide-x divide-white/10 flex-row-reverse">
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">الحجم الأصلي</span>
                    <span className="text-xs text-white font-mono font-bold">{(exportStats.original / 1024 / 1024).toFixed(2)} MB</span>
                 </div>
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">الحجم النهائي</span>
                    <span className="text-xs text-emerald-400 font-mono font-bold">{(exportStats.compressed / 1024 / 1024).toFixed(2)} MB</span>
                 </div>
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold mb-1">نسبة التوفير</span>
                    <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">{exportStats.savedPct}%</span>
                 </div>
              </div>
            )}
`;

code = code.replace(successUIInsertPoint, successUIInsertPoint + exportStatsUI);

fs.writeFileSync(path, code);
console.log('Successfully implemented compression UI and logic');
