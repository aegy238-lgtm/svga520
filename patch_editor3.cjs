const fs = require('fs');

let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

// First add decorTab state
if (!code.includes('const [decorTab, setDecorTab] = useState')) {
   code = code.replace(
      "const [activeTab, setActiveTab] = useState<'text' | 'colors' | '3d' | 'ornaments' | 'settings'>('text');",
      "const [activeTab, setActiveTab] = useState<'text' | 'colors' | '3d' | 'ornaments' | 'settings'>('text');\n  const [decorTab, setDecorTab] = useState<'text' | 'symbols'>('text');"
   );
}

// Find the decoration block to replace
const startIndex = code.indexOf('<div className="pt-4 border-t border-white/10 space-y-4 max-h-64 overflow-y-auto hide-scrollbar">');
const endIndex = code.indexOf('<div className="space-y-4">', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const betterUI = `
              <div className="pt-4 border-t border-white/10 space-y-3">
                 <label className="block text-xs font-bold text-slate-400">زخرفة النص (اختر لتطبيق الزخرفة)</label>
                 
                 <div className="flex gap-2 mb-2 bg-[#020617] p-1 rounded-lg border border-white/10">
                    <button onClick={() => setDecorTab('text')} className={\`flex-1 text-xs py-1.5 rounded-md transition-colors \${decorTab === 'text' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}>
                       الخطوط النقية
                    </button>
                    <button onClick={() => setDecorTab('symbols')} className={\`flex-1 text-xs py-1.5 rounded-md transition-colors \${decorTab === 'symbols' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}>
                       الرموز والإطارات
                    </button>
                 </div>
                 
                 <div className="max-h-64 overflow-y-auto hide-scrollbar space-y-4 pr-1">
                 {decorateText(state.text)
                     .filter(g => decorTab === 'symbols' ? g.category === 'رموز وإطارات' : g.category !== 'رموز وإطارات')
                     .map((group, groupIdx) => (
                     <div key={groupIdx} className="space-y-2">
                        <label className="block text-xs font-bold text-indigo-300 border-b border-white/10 pb-1">{group.category}</label>
                        <div className="grid grid-cols-2 gap-2">
                           {group.items.map((dec, idx) => (
                              <button 
                                 key={idx}
                                 onClick={() => updateState({ text: dec })}
                                 className="bg-[#020617] border border-white/10 hover:border-indigo-500 text-white p-2 rounded-lg text-xs text-center transition-colors truncate"
                              >
                                 {dec}
                              </button>
                           ))}
                        </div>
                     </div>
                 ))}
                 </div>
              </div>

              `;
    
    code = code.substring(0, startIndex) + betterUI + code.substring(endIndex);
    fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
    console.log("Successfully replaced the UI block");
} else {
    console.log("Could not find indices", {startIndex, endIndex});
}
