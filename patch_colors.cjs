const fs = require('fs');
let code = fs.readFileSync('src/components/Name3DEditor/Name3DEditor.tsx', 'utf8');

// I will refactor the Color tab to support Gradient and Image.
// It's easier to create a small sub-component for ColorFill editor.
// Or just inline it for now.

const replacement = `
                  <div className="p-4 bg-white/5 rounded-xl space-y-4">
                     <h3 className="font-bold text-sm text-indigo-300">لون الوجه الأمامي</h3>
                     
                     <div className="flex gap-2 mb-4 bg-[#020617] p-1 rounded-lg">
                        <button onClick={() => updateState({ frontFill: { ...state.frontFill, type: 'color' } })} className={\`flex-1 text-xs py-1.5 rounded \${state.frontFill.type === 'color' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>لون صلب</button>
                        <button onClick={() => updateState({ frontFill: { ...state.frontFill, type: 'gradient', gradient: state.frontFill.gradient || { color1: '#4f46e5', color2: '#ec4899', angle: 45 } } })} className={\`flex-1 text-xs py-1.5 rounded \${state.frontFill.type === 'gradient' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>تدرج</button>
                        <button onClick={() => updateState({ frontFill: { ...state.frontFill, type: 'image' } })} className={\`flex-1 text-xs py-1.5 rounded \${state.frontFill.type === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>صورة / خامة</button>
                     </div>

                     {state.frontFill.type === 'color' && (
                        <div className="flex gap-2">
                           <input type="color" value={state.frontFill.color} onChange={e => updateState({ frontFill: { ...state.frontFill, color: e.target.value } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                           <input type="text" value={state.frontFill.color} onChange={e => updateState({ frontFill: { ...state.frontFill, color: e.target.value } })} className="flex-1 bg-[#020617] border border-white/10 rounded-lg px-3 text-sm text-left" dir="ltr" />
                        </div>
                     )}

                     {state.frontFill.type === 'gradient' && state.frontFill.gradient && (
                        <div className="space-y-3">
                           <div className="flex gap-2">
                              <input type="color" value={state.frontFill.gradient.color1} onChange={e => updateState({ frontFill: { ...state.frontFill, gradient: { ...state.frontFill.gradient!, color1: e.target.value } } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                              <input type="color" value={state.frontFill.gradient.color2} onChange={e => updateState({ frontFill: { ...state.frontFill, gradient: { ...state.frontFill.gradient!, color2: e.target.value } } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                           </div>
                           <div>
                              <label className="block text-xs text-slate-400 mb-1">زاوية التدرج ({state.frontFill.gradient.angle}°)</label>
                              <input type="range" min="0" max="360" value={state.frontFill.gradient.angle} onChange={e => updateState({ frontFill: { ...state.frontFill, gradient: { ...state.frontFill.gradient!, angle: Number(e.target.value) } } })} className="w-full accent-indigo-500" />
                           </div>
                        </div>
                     )}

                     {state.frontFill.type === 'image' && (
                        <div className="space-y-2">
                           <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 cursor-pointer transition-colors">
                              <span className="text-xs text-indigo-400 font-bold">رفع صورة أو خامة</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                 if (e.target.files && e.target.files[0]) {
                                    const img = new Image();
                                    const url = URL.createObjectURL(e.target.files[0]);
                                    img.onload = () => {
                                       updateState({ frontFill: { ...state.frontFill, image: img, imageUrl: url } });
                                    };
                                    img.src = url;
                                 }
                              }} />
                           </label>
                           {state.frontFill.imageUrl && (
                              <img src={state.frontFill.imageUrl} className="w-full h-20 object-cover rounded-lg opacity-80" />
                           )}
                        </div>
                     )}
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl space-y-4">
                     <h3 className="font-bold text-sm text-indigo-300">لون الجوانب (العمق)</h3>
                     
                     <div className="flex gap-2 mb-4 bg-[#020617] p-1 rounded-lg">
                        <button onClick={() => updateState({ sideFill: { ...state.sideFill, type: 'color' } })} className={\`flex-1 text-xs py-1.5 rounded \${state.sideFill.type === 'color' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>لون صلب</button>
                        <button onClick={() => updateState({ sideFill: { ...state.sideFill, type: 'gradient', gradient: state.sideFill.gradient || { color1: '#1e1b4b', color2: '#312e81', angle: 45 } } })} className={\`flex-1 text-xs py-1.5 rounded \${state.sideFill.type === 'gradient' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>تدرج</button>
                        <button onClick={() => updateState({ sideFill: { ...state.sideFill, type: 'image' } })} className={\`flex-1 text-xs py-1.5 rounded \${state.sideFill.type === 'image' ? 'bg-indigo-600 text-white' : 'text-slate-400'}\`}>صورة / خامة</button>
                     </div>

                     {state.sideFill.type === 'color' && (
                        <div className="flex gap-2">
                           <input type="color" value={state.sideFill.color} onChange={e => updateState({ sideFill: { ...state.sideFill, color: e.target.value } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                           <input type="text" value={state.sideFill.color} onChange={e => updateState({ sideFill: { ...state.sideFill, color: e.target.value } })} className="flex-1 bg-[#020617] border border-white/10 rounded-lg px-3 text-sm text-left" dir="ltr" />
                        </div>
                     )}

                     {state.sideFill.type === 'gradient' && state.sideFill.gradient && (
                        <div className="space-y-3">
                           <div className="flex gap-2">
                              <input type="color" value={state.sideFill.gradient.color1} onChange={e => updateState({ sideFill: { ...state.sideFill, gradient: { ...state.sideFill.gradient!, color1: e.target.value } } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                              <input type="color" value={state.sideFill.gradient.color2} onChange={e => updateState({ sideFill: { ...state.sideFill, gradient: { ...state.sideFill.gradient!, color2: e.target.value } } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                           </div>
                           <div>
                              <label className="block text-xs text-slate-400 mb-1">زاوية التدرج ({state.sideFill.gradient.angle}°)</label>
                              <input type="range" min="0" max="360" value={state.sideFill.gradient.angle} onChange={e => updateState({ sideFill: { ...state.sideFill, gradient: { ...state.sideFill.gradient!, angle: Number(e.target.value) } } })} className="w-full accent-indigo-500" />
                           </div>
                        </div>
                     )}

                     {state.sideFill.type === 'image' && (
                        <div className="space-y-2">
                           <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-indigo-500/30 rounded-xl hover:bg-indigo-500/10 cursor-pointer transition-colors">
                              <span className="text-xs text-indigo-400 font-bold">رفع صورة أو خامة</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                 if (e.target.files && e.target.files[0]) {
                                    const img = new Image();
                                    const url = URL.createObjectURL(e.target.files[0]);
                                    img.onload = () => {
                                       updateState({ sideFill: { ...state.sideFill, image: img, imageUrl: url } });
                                    };
                                    img.src = url;
                                 }
                              }} />
                           </label>
                           {state.sideFill.imageUrl && (
                              <img src={state.sideFill.imageUrl} className="w-full h-20 object-cover rounded-lg opacity-80" />
                           )}
                        </div>
                     )}
                  </div>
`;

// Replace the old activeTab === 'colors' block
const searchStr = `                  <div className="p-4 bg-white/5 rounded-xl space-y-4">
                     <h3 className="font-bold text-sm text-indigo-300">لون الوجه الأمامي</h3>
                     <div className="flex gap-2">
                        <input type="color" value={state.frontFill.color} onChange={e => updateState({ frontFill: { ...state.frontFill, type: 'color', color: e.target.value } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                        <input type="text" value={state.frontFill.color} onChange={e => updateState({ frontFill: { ...state.frontFill, type: 'color', color: e.target.value } })} className="flex-1 bg-[#020617] border border-white/10 rounded-lg px-3 text-sm" />
                     </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl space-y-4">
                     <h3 className="font-bold text-sm text-indigo-300">لون الجوانب (العمق)</h3>
                     <div className="flex gap-2">
                        <input type="color" value={state.sideFill.color} onChange={e => updateState({ sideFill: { ...state.sideFill, type: 'color', color: e.target.value } })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                        <input type="text" value={state.sideFill.color} onChange={e => updateState({ sideFill: { ...state.sideFill, type: 'color', color: e.target.value } })} className="flex-1 bg-[#020617] border border-white/10 rounded-lg px-3 text-sm" />
                     </div>
                  </div>`;

code = code.replace(searchStr, replacement);
fs.writeFileSync('src/components/Name3DEditor/Name3DEditor.tsx', code);
