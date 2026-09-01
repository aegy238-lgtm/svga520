const fs = require('fs');
const path = 'src/components/UniversalMotionTools.tsx';
let code = fs.readFileSync(path, 'utf8');

const successSectionRegex = /<div className="flex items-center gap-3">[\s\S]*?<CheckCircle className="w-6 h-6" \/>[\s\S]*?<\/div>/;

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

code = code.replace(successSectionRegex, (match) => match + exportStatsUI);

fs.writeFileSync(path, code);
console.log('Fixed success UI');
