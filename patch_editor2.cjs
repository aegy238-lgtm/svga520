const fs = require('fs');

let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

// We need to replace the decoration rendering block with a much better tabbed UI.
// First, find the exact block.
const regex = /<div className="pt-4 border-t border-white\/10 space-y-4 max-h-64 overflow-y-auto hide-scrollbar">[\s\S]*?<\/div>\s*<\/div>\s*<div className="space-y-4">/;

const betterUI = `
              <div className="pt-4 border-t border-white/10 space-y-3">
                 <label className="block text-xs font-bold text-slate-400">زخرفة النص (اختر لتطبيق الزخرفة)</label>
                 
                 <div className="flex gap-2 mb-2 bg-[#020617] p-1 rounded-lg border border-white/10">
                    <button onClick={() => updateState({ decorTab: 'text' })} className={\`flex-1 text-xs py-1.5 rounded-md transition-colors \${state.decorTab !== 'symbols' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}>
                       الخطوط النقية
                    </button>
                    <button onClick={() => updateState({ decorTab: 'symbols' })} className={\`flex-1 text-xs py-1.5 rounded-md transition-colors \${state.decorTab === 'symbols' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'}\`}>
                       الرموز والإطارات
                    </button>
                 </div>
                 
                 <div className="max-h-64 overflow-y-auto hide-scrollbar space-y-4 pr-1">
                 {decorateText(state.text)
                     .filter(g => state.decorTab === 'symbols' ? g.category === 'رموز وإطارات' : g.category !== 'رموز وإطارات')
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

              <div className="space-y-4">`;

code = code.replace(regex, betterUI);
fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
