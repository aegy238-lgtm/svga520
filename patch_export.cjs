const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

const exportBlock = `        {/* Export Button */}
        <div className="p-4 border-t border-white/10 bg-[#020617]/50 space-y-3">
           <div className="flex gap-2">
              <select id="exportFormat" className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg p-2 text-xs focus:border-indigo-500">
                 <option value="png">PNG (شَـفّاف)</option>
                 <option value="jpeg">JPEG (أبيض)</option>
                 <option value="webp">WebP (جودة عالية)</option>
              </select>
              <select id="exportScale" className="flex-1 bg-[#0f172a] border border-white/10 rounded-lg p-2 text-xs focus:border-indigo-500">
                 <option value="1">دقة عادية (1x)</option>
                 <option value="2">دقة عالية (2x)</option>
                 <option value="4">دقة فائقة (4x)</option>
              </select>
           </div>
           <button onClick={() => {
               const format = (document.getElementById('exportFormat') as HTMLSelectElement).value as 'png'|'jpeg'|'webp';
               const scale = Number((document.getElementById('exportScale') as HTMLSelectElement).value);
               if (!canvasRef.current) return;
               const exportCanvas = document.createElement('canvas');
               renderCanvas(exportCanvas, state, state.canvasWidth * scale, state.canvasHeight * scale);
               if (format === 'jpeg' && state.transparentBg) {
                   const ctx = exportCanvas.getContext('2d');
                   if (ctx) {
                       ctx.globalCompositeOperation = 'destination-over';
                       ctx.fillStyle = '#ffffff';
                       ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                   }
               }
               const url = exportCanvas.toDataURL(\`image/\${format}\`, 1.0);
               const a = document.createElement('a');
               a.href = url;
               a.download = \`3D_Name_\${Date.now()}.\${format}\`;
               a.click();
           }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
              <Download className="w-5 h-5" /> تصدير التصميم
           </button>
        </div>`;

code = code.replace(
  /{[\s\S]*?\/\* Export Button \*\/[\s\S]*?تصدير PNG عالي الدقة[\s\S]*?<\/button>\s*<\/div>/,
  exportBlock
);

fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
