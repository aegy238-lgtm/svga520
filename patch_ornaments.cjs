const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

const ornamentsCode = `
           {activeTab === 'ornaments' && (
               <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-2">
                     {['﷽', 'ﷺ', 'ﷻ', '♕', '♔', '★', '♥', '♦', '♣', '♠', 'ꕥ', '✿', '❀', '❁', '❂', '❃', '❄', '❅', '❆', '❇', '❈', '❉', '❊', '❋'].map(char => (
                        <button 
                           key={char} 
                           onClick={() => {
                              updateState({
                                  ornaments: [...state.ornaments, {
                                      id: Date.now().toString(),
                                      type: 'symbol',
                                      char,
                                      x: state.canvasWidth / 2,
                                      y: state.canvasHeight / 2,
                                      scale: 1,
                                      rotation: 0,
                                      fill: { type: 'color', color: '#ffffff' },
                                      zIndex: state.ornaments.length
                                  }]
                              });
                           }}
                           className="bg-[#020617] border border-white/10 hover:border-indigo-500 rounded-xl aspect-square flex items-center justify-center text-2xl text-white transition-colors"
                        >
                           {char}
                        </button>
                     ))}
                  </div>

                  {state.ornaments.length > 0 && (
                     <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="font-bold text-sm text-indigo-300">الزخارف المضافة</h3>
                        <div className="space-y-3">
                           {state.ornaments.map((ornament, index) => (
                              <div key={ornament.id} className="p-3 bg-white/5 rounded-xl space-y-3 relative group">
                                 <button 
                                    onClick={() => {
                                        updateState({ ornaments: state.ornaments.filter(o => o.id !== ornament.id) });
                                    }}
                                    className="absolute top-2 left-2 p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                 >
                                    ✕
                                 </button>
                                 <div className="flex justify-between items-center pr-8">
                                    <span className="text-xl">{ornament.char}</span>
                                    <input type="color" value={ornament.fill.color} onChange={e => {
                                        const newOrns = [...state.ornaments];
                                        newOrns[index] = { ...ornament, fill: { ...ornament.fill, color: e.target.value } };
                                        updateState({ ornaments: newOrns });
                                    }} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-xs text-slate-400 flex justify-between"><span>الحجم</span> <span>{Math.round(ornament.scale * 100)}%</span></label>
                                    <input type="range" min="0.1" max="5" step="0.1" value={ornament.scale} onChange={e => {
                                        const newOrns = [...state.ornaments];
                                        newOrns[index] = { ...ornament, scale: Number(e.target.value) };
                                        updateState({ ornaments: newOrns });
                                    }} className="w-full accent-indigo-500" />
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-xs text-slate-400 flex justify-between"><span>الدوران</span> <span>{ornament.rotation}°</span></label>
                                    <input type="range" min="-180" max="180" value={ornament.rotation} onChange={e => {
                                        const newOrns = [...state.ornaments];
                                        newOrns[index] = { ...ornament, rotation: Number(e.target.value) };
                                        updateState({ ornaments: newOrns });
                                    }} className="w-full accent-indigo-500" />
                                 </div>
                                 <div className="flex gap-2">
                                     <div className="flex-1 space-y-1">
                                        <label className="text-xs text-slate-400">المحور السيني</label>
                                        <input type="number" value={Math.round(ornament.x)} onChange={e => {
                                            const newOrns = [...state.ornaments];
                                            newOrns[index] = { ...ornament, x: Number(e.target.value) };
                                            updateState({ ornaments: newOrns });
                                        }} className="w-full bg-[#020617] border border-white/10 rounded px-2 py-1 text-xs text-center text-white" />
                                     </div>
                                     <div className="flex-1 space-y-1">
                                        <label className="text-xs text-slate-400">المحور الصادي</label>
                                        <input type="number" value={Math.round(ornament.y)} onChange={e => {
                                            const newOrns = [...state.ornaments];
                                            newOrns[index] = { ...ornament, y: Number(e.target.value) };
                                            updateState({ ornaments: newOrns });
                                        }} className="w-full bg-[#020617] border border-white/10 rounded px-2 py-1 text-xs text-center text-white" />
                                     </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
           )}
`;

code = code.replace(
  "{activeTab === 'settings' && (",
  ornamentsCode + "\n\n           {activeTab === 'settings' && ("
);

fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
