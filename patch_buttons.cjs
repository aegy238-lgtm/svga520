const fs = require('fs');
let content = fs.readFileSync('src/components/MultiSvgaViewer.tsx', 'utf8');

// Replace the 3 buttons with 1 unified button
const buttonsRegex = /<button[^>]*handleDownloadAllImages[\s\S]*?<\/button>\s*<button[^>]*handleDownloadAllSvga[\s\S]*?<\/button>\s*<button[^>]*handleDownloadAllCombined[\s\S]*?<\/button>/;

const newButton = `
              <button 
                onClick={handleDownloadAllCombined}
                disabled={isZipping || isExporting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/20 font-black text-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isZipping ? \`جاري الضغط والتحضير \${exportProgress}%\` : 'تصدير كل الملفات (ضغط احترافي)'}
              </button>
`;

content = content.replace(buttonsRegex, newButton);

fs.writeFileSync('src/components/MultiSvgaViewer.tsx', content);
